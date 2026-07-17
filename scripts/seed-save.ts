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
 *   npm run seed-save -- --influence 500           # override the Influence balance
 *   npm run seed-save -- --seed abc --out my.civsave
 *
 * Then in-game: burger menu → Save → Load, and pick the file. (Loading replaces your current save,
 * so export a backup first if you care about it.)
 *
 * `--upto` clears the target's transitive prereqs *plus the target*, so a branch the target doesn't
 * depend on stays uncleared — `--upto raiders_at_border` seeds a "went down the Rites branch" save
 * with the Reading the Seasons branch untouched. Run stats are randomized off `--seed`, so the same
 * flags always produce the same file.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { emptyStore, applyRunResult, exportSave, type PlayerStore } from '../src/meta/store';
import { MISSIONS, type MissionDef } from '../src/content/missions';
import { foldOrder, prereqClosure } from '../src/rules/campaign';
import { CORE_KEYS, STRATEGIC_KEYS, emptyResources, randInt, seededRng } from '../src/rules';
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
  return {
    // An infinite mission has no win condition, so a real attempt only ever ends in collapse — it
    // pays out and scores off `turnsTaken` either way. Calling it a victory would credit the lifetime
    // win rate with a win the mission can't produce.
    outcome: infinite ? 'defeat' : 'victory',
    missionId: mission.id,
    stats: { turnsTaken: infinite ? randInt(rng, 15, 40) : randInt(rng, 6, 18), finalResources },
  };
}

// Wrap `parseArgs` so an unknown flag or stray positional (strict mode throws a raw `TypeError`)
// surfaces as the same clean `seed-save: …` one-liner as every other user mistake.
let values: { upto?: string; influence?: string; seed?: string; out?: string };
try {
  ({ values } = parseArgs({
    options: {
      upto: { type: 'string' },
      influence: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string' },
    },
    allowPositionals: false,
  }));
} catch (e) {
  fail((e as Error).message);
}

if (values.upto !== undefined && !MISSIONS[values.upto]) {
  fail(`unknown --upto mission '${values.upto}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
}

const influence = values.influence !== undefined ? Number(values.influence) : undefined;
if (influence !== undefined && (!Number.isInteger(influence) || influence < 0)) {
  fail(`--influence must be a non-negative integer, got '${values.influence}'.`);
}

const outPath = values.out ?? 'seed.civsave';
const rng = seededRng(values.seed ?? 'seed-save');
// The lifted DAG helpers throw on a bad prereq/cycle; surface that as the same clean one-liner.
let missions: MissionDef[];
try {
  missions = foldOrder(MISSIONS, prereqClosure(MISSIONS, values.upto !== undefined ? [values.upto] : defaultTargets()));
} catch (e) {
  fail((e as Error).message);
}

let store: PlayerStore = emptyStore();
for (const mission of missions) store = applyRunResult(store, runResult(mission, rng), mission);
// Overrides the spendable balance only. `lifetime.influenceEarned` stays as what the folded runs
// actually paid: it's a real lifetime total on the Stats screen, not a wallet.
if (influence !== undefined) store = { ...store, influence };

writeFileSync(outPath, exportSave(store));

console.log(`Wrote ${outPath} (${missions.length} runs folded in)`);
console.log('  played            :', missions.map((m) => m.id).join(' → '));
console.log('  influence balance :', store.influence);
console.log('  lifetime          :', store.lifetime);
console.log('  bestInfinite      :', store.bestInfinite);
console.log('  missions cleared  :', Object.keys(store.mapProgress).join(', ') || '(none)');
console.log('  boards unlocked   :', Object.keys(store.unlockedBoards).join(', ') || '(none)');
