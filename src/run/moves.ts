import type { GameState } from '../rules';
import { addBuilding, addWork, emitEvent, findStaffable, freePopulation, workerCapOf, resolveCard, subtractResources, unplayableReason } from '../rules';
import { effectiveCost } from '../rules/stickers';
import { CARDS, isStructure } from '../content/cards';

/**
 * Play a card from hand — the sole entry for putting a card into play. Pays costs (resources plus a
 * discard cost: `discardHandIdxs` gives the hand positions to sacrifice, distinct from the played
 * slot), then routes by `kind` (see the inline routing below). A card with `effect.destroy` requires
 * `destroyInstanceId`, the tableau building to demolish. Moves are the only place `G` may change.
 */
export function playCard(
  G: GameState,
  playHandIdx: number,
  discardHandIdxs: number[] = [],
  destroyInstanceId?: number,
): 'invalid' | void {
  // No card may be played while an interaction is pending — the player must answer it first.
  if (G.pendingInteraction) return 'invalid';
  if (playHandIdx < 0 || playHandIdx >= G.hand.length) return 'invalid';
  const played = G.hand[playHandIdx];
  const cardId = played.cardId;

  const card = CARDS[cardId];
  if (!card || unplayableReason(G, card, played)) return 'invalid';
  // A destroy card needs a valid target instance in the tableau.
  if (card.effect?.destroy) {
    if (destroyInstanceId === undefined) return 'invalid';
    if (!G.tableau.some((b) => b.id === destroyInstanceId)) return 'invalid';
  }

  // Discard-as-cost: sacrifice `discardCost` other cards — but only if you have that many
  // to spare. Played with an otherwise-empty hand it costs no discard (a reward for
  // sequencing the turn so this card comes last). Each index must be in range, distinct,
  // and not the played card itself.
  const want = card.discardCost ?? 0;
  const required = G.hand.length - 1 >= want ? want : 0;
  if (discardHandIdxs.length !== required) return 'invalid';
  const reserved = new Set<number>([playHandIdx]);
  for (const i of discardHandIdxs) {
    if (i < 0 || i >= G.hand.length || reserved.has(i)) return 'invalid';
    reserved.add(i);
  }

  // All validated — pay costs (an Efficient sticker discounts this exact copy's price) and
  // remove all played/sacrificed cards from hand first.
  subtractResources(G.resources, effectiveCost(card.cost, played));
  const sacrifices = discardHandIdxs.map((i) => G.hand[i]);
  for (const i of [playHandIdx, ...discardHandIdxs].sort((a, b) => b - a)) G.hand.splice(i, 1);

  // Resolve effects before routing to discard — a draw that reshuffles G.discard cannot
  // return the not-yet-filed sacrifices back into the deck.
  // A building/wonder card is placed in the tableau; a work card sticks onto the board and produces
  // only while staffed (at upkeep); everything else resolves its effect immediately through the
  // single resolver path (which also performs a Destroy card's demolition, via `target`).
  if (isStructure(card)) {
    // Place the structure (auto-staffing from existing idle pop), then resolve its one-shot
    // *placement* effect on the played instance (e.g. the Hut's +1 population). A no-op for the
    // usual produces-only building; a structure's per-round output is `produces`, never resolved
    // here — see `CardDef.effect`. Population/territory a placement grants are global, so
    // resolving on `played` (not the new tableau instance) is fine.
    addBuilding(G, cardId, played.stickers);
    resolveCard({ G, self: played });
  } else if (card.kind === 'work') {
    addWork(G, cardId, played.stickers);
  } else if (card.kind === 'event') {
    // A *played* event is banished **unresolved** — paying its cost pre-empts the disaster so its
    // effect never fires (the filing below sends it to `removed`). The effect only ever resolves on
    // the involuntary path: an event *left* in hand auto-resolves at end of turn (`upkeep.ts`'s
    // `resolveHandEvents`). So this branch deliberately does not `resolveCard`.
  } else {
    // Resolve on the played *instance* — so a self-scaling card reads/writes its own
    // copy's counters, which then ride along as that same instance files to discard below.
    resolveCard({ G, self: played, target: destroyInstanceId });
  }
  for (const c of sacrifices) {
    G.discard.push(c);
    emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'sacrifice' });
  }
  // File the played card by kind. Building cards (now on the tableau) and work cards (on the board,
  // filed at end of turn) stay put. An `action` recycles to the **discard** — the same instance
  // object, carrying whatever counters its resolver just bumped. A voluntarily *played* `event` is
  // **removed** (banished for good, its effect never firing — see above), versus an unplayed one,
  // which auto-resolves and files to discard at end of turn (`upkeep.ts`'s `resolveHandEvents`).
  // The played-vs-auto split is the event kind's whole point.
  if (card.kind === 'action') G.discard.push(played);
  else if (card.kind === 'event') G.removed.push(played);
}

/**
 * Answer the pending interaction: re-enter the suspended card's resolver with the chosen option
 * index, which completes the effect and clears `G.pendingInteraction`. The move counterpart of a
 * resolver that revealed options and returned (see `PendingInteraction`). Rejects when nothing is
 * pending or the index is out of range.
 */
export function resolveInteraction(G: GameState, answer: number): 'invalid' | void {
  const pending = G.pendingInteraction;
  if (!pending) return 'invalid';
  if (answer < 0 || answer >= pending.options.length) return 'invalid';
  // Reconstruct the suspended card's `self` from the parked interaction (its instance already filed
  // to discard on the suspending pass; the resume path reads `options`, not its own counters).
  resolveCard({ G, self: { id: pending.instanceId, cardId: pending.cardId }, answer });
}

/** Assign one idle population to a specific staffable (building or Work card, identified by `id`),
 *  unless it's already at its worker capacity. */
export function assignWorker(G: GameState, id: number): 'invalid' | void {
  if (freePopulation(G) <= 0) return 'invalid';
  const s = findStaffable(G, id);
  if (!s || s.workers >= workerCapOf(s)) return 'invalid';
  s.workers += 1;
}

/** Return one worker from a specific staffable (identified by `id`) to the idle pool. */
export function unassignWorker(G: GameState, id: number): 'invalid' | void {
  const s = findStaffable(G, id);
  if (!s || s.workers <= 0) return 'invalid';
  s.workers -= 1;
}

/** Move one worker directly from one staffable to another (both identified by `id`, either zone),
 *  as a single atomic move. This is what a box-to-box drag uses instead of an unassign+assign
 *  pair — two separate moves would push two entries onto the undo stack, so one "undo" click
 *  would only unwind half the transfer. Invalid if the source has no worker to give, source and
 *  target are the same instance, or the target is already at its worker capacity. */
export function transferWorker(G: GameState, fromId: number, toId: number): 'invalid' | void {
  if (fromId === toId) return 'invalid';
  const from = findStaffable(G, fromId);
  const to = findStaffable(G, toId);
  if (!from || from.workers <= 0) return 'invalid';
  if (!to || to.workers >= workerCapOf(to)) return 'invalid';
  from.workers -= 1;
  to.workers += 1;
}

/** Toggle a staffable (building or Work card, identified by `id`) between empty and staffed in one
 *  move: staffed ones empty out entirely; empty ones fill toward their worker capacity from the idle
 *  pool (mirrors `addBuilding`'s auto-staff), partial-filling when there aren't enough idle to fill
 *  it completely — a staffable operates at ≥1 worker, so a partial fill still produces. No-op target
 *  for self-sufficient capacity (0), or an empty box with no idle workers. */
export function toggleStaffing(G: GameState, id: number): 'invalid' | void {
  const s = findStaffable(G, id);
  if (!s) return 'invalid';
  const cap = workerCapOf(s);
  if (cap === 0) return 'invalid';
  if (s.workers > 0) {
    s.workers = 0;
    return;
  }
  const fill = Math.min(freePopulation(G), cap);
  if (fill <= 0) return 'invalid';
  s.workers = fill;
}
