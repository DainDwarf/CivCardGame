import type { GameState } from '../rules';
import { addBuilding, addWork, emitEvent, findStaffable, freePopulation, requiredWorkersOf, resolveCard, subtractResources, unplayableReason } from '../rules';
import { effectiveCost } from '../rules/stickers';
import { CARDS } from '../content/cards';

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
  // A building card is placed in the tableau; a work card sticks onto the board and produces only
  // while staffed (at upkeep); everything else resolves its effect immediately through the single
  // resolver path (which also performs a Destroy card's demolition, via `target`).
  if (card.kind === 'building') {
    addBuilding(G, cardId, played.stickers);
  } else if (card.kind === 'work') {
    addWork(G, cardId, played.stickers);
  } else {
    // Resolve on the played *instance* — so a self-scaling card (Cornucopia) reads/writes its own
    // copy's counters, which then ride along as that same instance files to discard below.
    resolveCard({ G, self: played, target: destroyInstanceId });
  }
  for (const c of sacrifices) {
    G.discard.push(c);
    emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'sacrifice' });
  }
  // File the played card by kind. Building cards (now on the tableau) and work cards (on the board,
  // filed at end of turn) stay put; only action cards recycle to the discard here — the same
  // instance object, carrying whatever counters its resolver just bumped.
  if (card.kind === 'action') G.discard.push(played);
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
 *  unless it's already at its worker requirement. */
export function assignWorker(G: GameState, id: number): 'invalid' | void {
  if (freePopulation(G) <= 0) return 'invalid';
  const s = findStaffable(G, id);
  if (!s || s.workers >= requiredWorkersOf(s)) return 'invalid';
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
 *  target are the same instance, or the target is already at its worker requirement. */
export function transferWorker(G: GameState, fromId: number, toId: number): 'invalid' | void {
  if (fromId === toId) return 'invalid';
  const from = findStaffable(G, fromId);
  const to = findStaffable(G, toId);
  if (!from || from.workers <= 0) return 'invalid';
  if (!to || to.workers >= requiredWorkersOf(to)) return 'invalid';
  from.workers -= 1;
  to.workers += 1;
}

/** Toggle a staffable (building or Work card, identified by `id`) between empty and fully staffed
 *  in one move: staffed ones empty out entirely; empty ones fill to their full worker requirement,
 *  but only all-or-nothing (mirrors `addBuilding`'s auto-staff) — if there aren't enough idle
 *  workers to fill it completely, the toggle is rejected rather than partially staffing it. No-op
 *  target for self-sufficient requirements (0). */
export function toggleStaffing(G: GameState, id: number): 'invalid' | void {
  const s = findStaffable(G, id);
  if (!s) return 'invalid';
  const req = requiredWorkersOf(s);
  if (req === 0) return 'invalid';
  if (s.workers > 0) {
    s.workers = 0;
    return;
  }
  if (freePopulation(G) < req) return 'invalid';
  s.workers = req;
}
