import { contentKey, type CardInstance, type GameState, type PendingInteraction, type PlacedCard } from '../rules';

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
 * less and only costs speed.
 *
 * The key mirrors the player's mental model — **one ordered draw pile, everything else an unordered heap**:
 * - `deck` is **ordered**: its order *is* the future draw sequence (same multiset, different order ⇒ a
 *   different next card), the one irreducibly-ordered field.
 * - `hand`/`discard`/`tableau`/`workZone`/`threats`/`removed` are **sorted multisets** (by `contentKey`,
 *   with a placed card's `workers` folded in). Two of the engine's order-independence guarantees make this
 *   *complete-preserving* (no false merge): the discard reshuffle canonicalizes by content, so discard —
 *   and thus the hand/workZone that file into it — no longer influence the future through *order*
 *   (`deck.ts`); and the zone order-independence invariant makes per-round processing (production, threat
 *   drains, hand-event auto-resolve) commutative (`events.ts`/`upkeep.ts`). Enforced by
 *   `sim/zoneOrderInvariance.test.ts`.
 * - `rngState` is included (it determines the *next* reshuffle's permutation).
 * - The only normalization beyond order is dropping **instance ids** (the engine never branches on an id's
 *   numeric value — a consistent relabeling is isomorphic) and **derived/constant/UI fields**
 *   (`objective`/`missionId` — invariant across a search; `events` — always `[]` at a step boundary;
 *   `pendingVictory`/`pendingDefeat` — re-derived each flush and the goal test is evaluated separately;
 *   `reshuffleCount`/`revealCount` — pure UI/undo cues no rule reads).
 *
 * Multiset keying is what actually collapses the explosion: worker assignment is order-independent, and
 * independent plays now commute (their discard/hand-order footprint no longer matters), so all those
 * reorderings merge to one node.
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
    G.resources.population,
    G.resources.territory,
    G.resources.culture,
    G.handSize,
    orderedZone(G.deck), // the future draw sequence — the sole ordered field
    multiset(G.discard),
    multiset(G.hand),
    placedMultiset(G.tableau),
    placedMultiset(G.workZone),
    multiset(G.threats),
    multiset(G.removed),
    G.rngState.join(','),
    pendingToken(G.pendingInteraction),
  ].join('|');
}

/** An ordered zone (the deck): array order preserved, each instance reduced to its `contentKey`. */
function orderedZone(list: readonly CardInstance[]): string {
  return list.map(contentKey).join(';');
}

/** An unordered zone: instances reduced to `contentKey` and **sorted**, so array order is erased. */
function multiset(list: readonly CardInstance[]): string {
  return list.map(contentKey).sort().join(';');
}

/** An unordered zone of placed (staffed) instances (tableau/workZone), folding each box's `workers`
 *  into its token before sorting. */
function placedMultiset(list: readonly PlacedCard[]): string {
  return list
    .map((c) => `${contentKey(c)}@${c.workers}`)
    .sort()
    .join(';');
}

/** A parked interaction's token: its card, choice shape, pick count, and revealed options **in order**
 *  (the answer is an index into `options`, so option order is load-bearing). Empty when none is parked. */
function pendingToken(p: PendingInteraction | null): string {
  if (!p) return '';
  return `${p.cardId}#${p.kind}#${p.pick}#${p.options.map(contentKey).join(';')}`;
}
