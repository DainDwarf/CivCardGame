import type { CardInstance, GameState, PendingInteraction, PlacedCard } from '../rules';

/**
 * A **canonical transposition key** for a run state — the string the oracle search (`sim/oracle.ts`)
 * hashes to merge duplicate states and collapse the action-ordering explosion. Two states with an
 * *equal* key are treated as the same search node.
 *
 * The primary claim the oracle makes — *a returned winning line is a real, replayable win* — does **not**
 * depend on this key at all: every line the search returns is a sequence of actions it actually applied
 * through the real engine to an observed `victory` gameover, so determinism guarantees the replay
 * reproduces it. The key only affects **completeness**: a too-*loose* key could falsely merge two states
 * with different futures and thereby *miss* a win (under-report winnability); a too-*tight* key merges
 * less and only costs speed. So this key is deliberately **conservative** — every zone is kept in **array
 * order** (a full state fingerprint), and the *only* normalization is:
 *
 * - **Instance ids dropped.** The engine never branches on an id's numeric *value* (ids are used only for
 *   equality/targeting, so a consistent relabeling yields an isomorphic run — see the plan's soundness
 *   note); dropping them is the one merge that matters, since `nextInstanceId` makes ids drift constantly.
 * - **Derived / constant / UI fields dropped** (`objective`/`missionId` — invariant across a search;
 *   `events` — always `[]` at a step boundary; `pendingVictory`/`pendingDefeat` — re-derived each flush and
 *   the goal test is evaluated separately; `reshuffleCount` — a pure UI cue no rule reads).
 *
 * Keeping every zone ordered still collapses the one combinatorial explosion that matters — **worker
 * assignment is order-independent** and never touches zone *order*, so those states still merge — while
 * conservatively *not* merging play-ordering variants (which a discard-order-sensitive reshuffle could
 * genuinely distinguish today). A looser multiset key would recover that dedup but only becomes sound once
 * the deferred order-independent-reshuffle / order-independent-zone-processing engine changes land; until
 * then, ordered is the correct trade (see the plan's transposition-key deep-dive).
 */
export function keyOf(G: GameState): string {
  const r = G.resources;
  return [
    G.round,
    r.food,
    r.production,
    r.science,
    r.military,
    r.money,
    G.population,
    G.territory,
    G.culture,
    G.handSize,
    zone(G.deck),
    zone(G.discard),
    zone(G.hand),
    placedZone(G.tableau),
    placedZone(G.workZone),
    zone(G.threats),
    zone(G.removed),
    G.rngState.join(','),
    pendingToken(G.pendingInteraction),
  ].join('|');
}

/** A single instance's content token: what it is plus its per-copy state (`counters`, `stickers`, and
 *  — for a placed card — its `workers`), with its `id` deliberately dropped. Counters and stickers are
 *  sorted so a token is order-stable within an instance. */
function instToken(inst: CardInstance, workers?: number): string {
  const counters = inst.counters
    ? Object.keys(inst.counters)
        .sort()
        .map((k) => `${k}=${inst.counters![k]}`)
        .join(',')
    : '';
  const stickers = inst.stickers && inst.stickers.length ? [...inst.stickers].sort().join(',') : '';
  const w = workers === undefined ? '' : `@${workers}`;
  return `${inst.cardId}#${counters}#${stickers}${w}`;
}

/** An ordered zone of plain instances (deck/discard/hand/threats/removed). Array order is preserved. */
function zone(list: readonly CardInstance[]): string {
  return list.map((c) => instToken(c)).join(';');
}

/** An ordered zone of placed (staffed) instances (tableau/workZone), folding each box's `workers` in. */
function placedZone(list: readonly PlacedCard[]): string {
  return list.map((c) => instToken(c, c.workers)).join(';');
}

/** A parked interaction's token: its card, choice shape, pick count, and revealed options in order
 *  (the answer is an index into `options`, so option order is load-bearing). Empty when none is parked. */
function pendingToken(p: PendingInteraction | null): string {
  if (!p) return '';
  return `${p.cardId}#${p.kind}#${p.pick}#${p.options.map((o) => instToken(o)).join(';')}`;
}
