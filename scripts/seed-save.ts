/**
 * Dev tool — generate a populated `.civsave` file for testing the meta screens.
 *
 * The meta screens (Stats, Collection, Board, Decks) only get interesting once a player has some
 * progress, but grinding runs to reach that state is slow. This walks the campaign DAG to a target
 * mission and folds one finished run per mission along the way through the **real** `applyRunResult`
 * — so the resulting save is always valid and can never drift from production logic (the same reason
 * tests share prod code paths). Influence, unlocks, mission progress, lifetime counters and infinite
 * best scores all fall out of that fold; there's no separate state to keep in sync.
 *
 * Usage:
 *   npm run seed-save                              # the whole campaign (every standard mission)
 *   npm run seed-save -- --upto raiders_at_border  # only that mission's prereq chain, inclusive
 *   npm run seed-save -- --upto a,b                # several targets at once (see below)
 *   npm run seed-save -- --fixture scripts/sim/baselines/sword_chariot_city.json
 *   npm run seed-save -- --influence 500           # override the Influence balance
 *   npm run seed-save -- --seed abc --out my.civsave
 *
 * Then in-game: burger menu → Save → Load, and pick the file. (Loading replaces your current save,
 * so export a backup first if you care about it.)
 *
 * `--upto` clears each target's transitive prereqs *plus the target*, so a branch no target depends
 * on stays uncleared — `--upto raiders_at_border` seeds a "went down the Raiders branch" save with the
 * parallel branch untouched. It takes a comma-separated list because the state *just before* a
 * convergence mission is "every branch tip cleared, the convergence itself not" — naming the
 * convergence would clear it and grant its reward. Run stats are randomized off `--seed`, so the same
 * flags always produce the same file.
 *
 * `--fixture` seeds the state a **baseline fixture** describes, so a cell the simulator measures can be
 * hand-piloted under the same conditions: its mission available but *not* cleared (only its prereqs are
 * folded — clearing it would pay its reward to a player who is about to play it, which is why this is a
 * separate flag rather than `--upto`'s inclusive walk), its deck owned and built, its board unlocked.
 * The deck is bought through the real shop/sticker/deck-builder paths, so the resulting save is one the
 * economy could itself have produced; Influence is topped up when the campaign's own faucet can't cover
 * the bill, since a half-bought deck is useless to pilot. Several fixtures compose into one save.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { emptyStore, applyRunResult, exportSave, type PlayerStore } from '../src/meta/store';
import { MISSIONS, type MissionDef } from '../src/content/missions';
import { foldOrder, prereqClosure } from '../src/rules/campaign';
import {
  CORE_KEYS,
  STRATEGIC_KEYS,
  MAX_DECKS,
  addCard,
  emptyResources,
  randInt,
  seededRng,
  variantKey,
  type DeckCard,
} from '../src/rules';
import { copiesOwned, instancesOf, variantInstancesOf } from '../src/rules/collection';
import { buyTier, nextTier } from '../src/rules/shop';
import { buySticker } from '../src/rules/stickers';
import { buyBoardSticker } from '../src/rules/boardStickers';
import { STICKERS } from '../src/content/stickers';
import { BOARD_STICKERS } from '../src/content/boardStickers';
import type { BoardId } from '../src/content/boards';
import { simFileTools, type Cell } from './simFiles';
import type { RunResult } from '../src/contract';

type Rng = ReturnType<typeof seededRng>;

/** Print a clean one-line error and exit — a bad flag is a user mistake, not a stack-trace-worthy
 *  crash. */
function fail(msg: string): never {
  console.error(`seed-save: ${msg}`);
  process.exit(1);
}

/**
 * What a bare `--upto`-less run plays: every standard mission, plus one attempt at each *scored*
 * infinite mission so `bestInfinite` and the Stats leaderboard have something to show. Derived from
 * the catalogue rather than a hard-coded list, so new content is picked up for free. A `rewardless`
 * infinite mission (the sandbox) is left out: an attempt pays nothing and records no score, so it
 * would only pad the run history.
 */
function defaultTargets(): string[] {
  return Object.values(MISSIONS)
    .filter((m) => !(m.kind === 'infinite' && m.rewardless))
    .map((m) => m.id);
}

/**
 * One finished run with plausible-but-random stats. `turnsTaken` is the only stat any logic reads
 * (an infinite mission pays that much Influence and records it as a best score); `finalResources` is
 * display-only, but the Stats run-history row renders every pool, so it's written over *every* key of
 * `emptyResources()` rather than spelled out as a literal — a resource added later can't leave a hole.
 */
function runResult(mission: MissionDef, rng: Rng): RunResult {
  const infinite = mission.kind === 'infinite';
  const finalResources = emptyResources();
  for (const key of [...CORE_KEYS, ...STRATEGIC_KEYS]) finalResources[key] = randInt(rng, 0, 12);
  const turnsTaken = infinite ? randInt(rng, 15, 40) : randInt(rng, 6, 18);
  return {
    // An infinite mission has no win condition, so a real attempt only ever ends in collapse — it
    // pays out and scores off `stats.score` either way. Calling it a victory would credit the lifetime
    // win rate with a win the mission can't produce.
    outcome: infinite ? 'defeat' : 'victory',
    missionId: mission.id,
    // A fabricated attempt has no run state to measure a bespoke score off, so rounds stand in — which
    // is the Ice Age's own measure. A standard mission carries none, as a real result wouldn't.
    stats: { turnsTaken, ...(infinite ? { score: turnsTaken } : {}), finalResources },
  };
}

interface VariantNeed {
  card: DeckCard;
  count: number;
}

/**
 * Per card, per **variant**, the most copies any single fixture's deck holds — a max across fixtures
 * rather than a sum, because two decks may reference the same owned copy (`addCard` only refuses one
 * already in *this* deck), so N decks wanting the same variant need it owned once. Those maxes then sum
 * back up per card to what the shop has to reach: a plain copy and a stickered one are two copies.
 */
function variantNeeds(fixtures: Cell[]): Map<string, Map<string, VariantNeed>> {
  const needs = new Map<string, Map<string, VariantNeed>>();
  for (const fixture of fixtures) {
    const tally = new Map<string, VariantNeed>();
    for (const card of fixture.deck) {
      const need = tally.get(variantKey(card));
      if (need) need.count += 1;
      else tally.set(variantKey(card), { card, count: 1 });
    }
    for (const [key, need] of tally) {
      let byVariant = needs.get(need.card.cardId);
      if (!byVariant) needs.set(need.card.cardId, (byVariant = new Map()));
      if ((byVariant.get(key)?.count ?? 0) < need.count) byVariant.set(key, need);
    }
  }
  return needs;
}

/** Which mission opens `cardId`, phrased as the flag that would clear it. A fixture deck routinely reaches
 *  across to a *parallel* branch its own mission doesn't depend on (a player may well have cleared it
 *  first), and that branch is exactly what `--upto` unions in — so the missing card names its own fix. */
function unlockHint(cardId: string): string {
  const source = Object.values(MISSIONS).find((m) => m.reward?.unlockCardIds?.includes(cardId));
  return source ? ` It is unlocked by '${source.id}' — add \`--upto ${source.id}\`.` : '';
}

/**
 * Buy every fixture's deck into the store and build it — copies up the shop's tier ladder, stickers
 * through the attach path, the deck through the deck builder, each the same function the meta UI calls.
 * That is what makes the save one the real economy could have produced, and it is also why every reject
 * is fatal rather than skipped: a `null`/`'invalid'` here means the content can't reach the state the
 * fixture describes, and continuing would write a half-bought deck that reads as intact in-game.
 */
function outfit(base: PlayerStore, fixtures: Cell[]): { store: PlayerStore; log: string[] } {
  let { collection, influence, boardStickers, decks } = base;
  const earned = influence;
  let toppedUp = 0;
  /** Raise the wallet to exactly `cost` when the campaign's own faucet falls short. The deck a fixture
   *  names is the requirement; the Influence to reach it is slack, and a save handed over unable to
   *  finish the purchase is worth nothing. */
  const afford = (cost: number) => {
    if (influence >= cost) return;
    toppedUp += cost - influence;
    influence = cost;
  };

  // Board unlocks ride mission rewards, so a fixture whose board the prereqs never open is naming a
  // board the campaign can't be on at that mission — a content fact to report, not to grant around.
  for (const fixture of fixtures) {
    if (!base.unlockedBoards[fixture.board.board]) {
      fail(
        `fixture '${fixture.label}' plays board '${fixture.board.board}', which clearing '${fixture.missionId}'s prereqs never unlocks ` +
          `(unlocked: ${Object.keys(base.unlockedBoards).join(', ')}).`,
      );
    }
  }

  const needs = variantNeeds(fixtures);
  let copiesBought = 0;
  let stickersBought = 0;
  for (const cardId of [...needs.keys()].sort()) {
    const byVariant = needs.get(cardId)!;
    const wanted = [...byVariant.values()].reduce((n, need) => n + need.count, 0);
    while (copiesOwned(collection, cardId) < wanted) {
      const owned = copiesOwned(collection, cardId);
      const up = nextTier(owned);
      if (!up) {
        fail(
          owned === 0
            ? `the fixture decks need '${cardId}', which the cleared prereqs never unlock — the shop only sells copies of a card already owned.${unlockHint(cardId)}`
            : `the fixture decks need ${wanted} copies of '${cardId}', past the shop's ×8 ceiling.`,
        );
      }
      afford(up.cost);
      const bought = buyTier(collection, influence, cardId);
      if (!bought) fail(`the shop refuses a copy of '${cardId}' at ${owned} owned — wonders are unique and can't be bought.`);
      copiesBought += up.to - owned;
      ({ collection, influence } = bought);
    }
    for (const need of byVariant.values()) {
      const stickers = need.card.stickers ?? [];
      if (stickers.length === 0) continue;
      // Sticker the *highest-index* plain copies. The low ones are what `buildSeedDecks` handed the
      // starting deck, and a sticker is per-copy — working down from the top keeps that deck plain.
      for (let have = variantInstancesOf(collection, cardId, stickers).length; have < need.count; have++) {
        const target = [...instancesOf(collection, cardId)].reverse().find((inst) => !inst.stickers?.length);
        if (!target) fail(`no plain copy of '${cardId}' left to sticker ${stickers.join('+')} onto — its owned copies are already spoken for.`);
        for (const stickerId of stickers) {
          afford(STICKERS[stickerId].cost);
          const bought = buySticker(collection, influence, target.id, stickerId, base.unlockedStickers);
          if (!bought) {
            fail(
              `cannot attach '${stickerId}' to '${cardId}' — either the cleared prereqs never unlock it, it doesn't apply to that card, ` +
                `or the copy is already full.`,
            );
          }
          ({ collection, influence } = bought);
          stickersBought += 1;
        }
      }
    }
  }

  // A board carries one sticker set, so two fixtures naming it must agree — otherwise neither cell is
  // reproducible from the one save.
  const boardWants = new Map<string, { label: string; stickers: string[] }>();
  for (const fixture of fixtures) {
    const prev = boardWants.get(fixture.board.board);
    const same = [...(prev?.stickers ?? [])].sort().join() === [...fixture.board.stickers].sort().join();
    if (prev && !same) fail(`fixtures '${prev.label}' and '${fixture.label}' both play '${fixture.board.board}' with different board stickers.`);
    boardWants.set(fixture.board.board, { label: fixture.label, stickers: fixture.board.stickers });
  }
  let boardStickersBought = 0;
  for (const [boardId, want] of boardWants) {
    for (const stickerId of want.stickers) {
      afford(BOARD_STICKERS[stickerId].cost);
      const bought = buyBoardSticker(boardStickers, influence, boardId as BoardId, stickerId, base.unlockedBoardStickers);
      if (!bought) {
        fail(
          `cannot attach board sticker '${stickerId}' to '${boardId}' — either the cleared prereqs never unlock it, it doesn't apply ` +
            `to that board, or the board is full.`,
        );
      }
      ({ boardStickers, influence } = bought);
      boardStickersBought += 1;
    }
  }

  if (decks.length + fixtures.length > MAX_DECKS) {
    fail(`${fixtures.length} fixture decks plus the ${decks.length} already saved exceed the ${MAX_DECKS}-deck cap.`);
  }
  const log: string[] = [];
  for (const fixture of fixtures) {
    if (decks.some((d) => d.id === fixture.label)) fail(`a deck named '${fixture.label}' already exists in the save.`);
    let cards: string[] = [];
    for (const card of fixture.deck) {
      const next = addCard(cards, card, collection);
      if (next === 'invalid') fail(`fixture '${fixture.label}': the deck builder refuses '${variantKey(card)}' — no free owned copy of that variant.`);
      cards = next;
    }
    decks = [...decks, { id: fixture.label, name: fixture.label, cards }];
    log.push(`deck              : ${fixture.label} — ${cards.length} cards, mission ${fixture.missionId} (uncleared), board ${fixture.board.board}`);
  }
  log.push(`bought            : ${copiesBought} copies, ${stickersBought} card stickers, ${boardStickersBought} board stickers`);
  log.push(`influence ledger  : ${earned} earned + ${toppedUp} topped up − ${earned + toppedUp - influence} spent = ${influence}`);
  return { store: { ...base, collection, influence, boardStickers, decks }, log };
}

// Wrap `parseArgs` so an unknown flag or stray positional (strict mode throws a raw `TypeError`)
// surfaces as the same clean `seed-save: …` one-liner as every other user mistake.
let values: { upto?: string; fixture?: string; influence?: string; seed?: string; out?: string };
try {
  ({ values } = parseArgs({
    options: {
      upto: { type: 'string' },
      fixture: { type: 'string' },
      influence: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string' },
    },
    allowPositionals: false,
  }));
} catch (e) {
  fail((e as Error).message);
}

const csv = (s: string | undefined): string[] => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

// A comma-separated list, not a single id: a mission sitting on a *convergence* has several prereq
// branches, and seeding the state just before it means clearing every tip at once.
const uptoTargets = csv(values.upto);
for (const id of uptoTargets) {
  if (!MISSIONS[id]) fail(`unknown --upto mission '${id}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
}

// Loaded through the balance tools' own loaders, so a fixture this rejects is one `npm run sim` would
// reject too — including every cardId, sticker, board and mission id, checked against the catalogues.
const { expandBaselinePaths, loadBaseline } = simFileTools(fail);
const fixtures: Cell[] = values.fixture !== undefined ? expandBaselinePaths(csv(values.fixture)).map(loadBaseline) : [];
for (const [i, fixture] of fixtures.entries()) {
  if (fixtures.findIndex((f) => f.label === fixture.label) !== i) fail(`fixture '${fixture.label}' named twice — each builds its own deck, so ids must be distinct.`);
}

const influence = values.influence !== undefined ? Number(values.influence) : undefined;
if (influence !== undefined && (!Number.isInteger(influence) || influence < 0)) {
  fail(`--influence must be a non-negative integer, got '${values.influence}'.`);
}

const outPath = values.out ?? 'seed.civsave';
const rng = seededRng(values.seed ?? 'seed-save');
// A fixture contributes its mission's *prereqs*, never the mission — the whole point is to hand it over
// unplayed. `--upto` keeps its inclusive meaning and simply unions in, so the two compose.
const targets = fixtures.length > 0 || uptoTargets.length > 0
  ? [...fixtures.flatMap((f) => MISSIONS[f.missionId].prereqs), ...uptoTargets]
  : defaultTargets();
// The lifted DAG helpers throw on a bad prereq/cycle; surface that as the same clean one-liner.
let missions: MissionDef[];
try {
  missions = foldOrder(MISSIONS, prereqClosure(MISSIONS, targets));
} catch (e) {
  fail((e as Error).message);
}
// One check covering both ways a fixture's mission can get cleared out from under it: an `--upto` target
// that reaches it, and a second fixture it is a prereq of. Either way the save can't satisfy both asks.
for (const fixture of fixtures) {
  if (missions.some((m) => m.id === fixture.missionId)) {
    fail(`fixture '${fixture.label}' wants '${fixture.missionId}' left unplayed, but another target clears it.`);
  }
}

let store: PlayerStore = emptyStore();
for (const mission of missions) store = applyRunResult(store, runResult(mission, rng), mission);

const purchases = fixtures.length > 0 ? outfit(store, fixtures) : undefined;
if (purchases) store = purchases.store;
// Overrides the spendable balance only. `lifetime.influenceEarned` stays as what the folded runs
// actually paid: it's a real lifetime total on the Stats screen, not a wallet — which is also why a
// fixture top-up never touches it.
if (influence !== undefined) store = { ...store, influence };

writeFileSync(outPath, exportSave(store));

console.log(`Wrote ${outPath} (${missions.length} runs folded in)`);
console.log('  played            :', missions.map((m) => m.id).join(' → ') || '(none)');
console.log('  influence balance :', store.influence);
console.log('  lifetime          :', store.lifetime);
console.log('  bestInfinite      :', store.bestInfinite);
console.log('  missions cleared  :', Object.keys(store.mapProgress).join(', ') || '(none)');
console.log('  boards unlocked   :', Object.keys(store.unlockedBoards).join(', ') || '(none)');
for (const line of purchases?.log ?? []) console.log(`  ${line}`);
