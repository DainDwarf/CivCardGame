import type { GameState } from '../rules';
import { addResources, applyEffect, freePopulation, requiredWorkers, subtractResources, unplayableReason } from '../rules';
import { CARDS } from '../content/cards';

/**
 * Play a card from hand. The card's `effect` resolves (which may erect a building in the
 * tableau, auto-staffed from idle pop); then the *card itself* is routed by `kind` —
 * `permanent` cards are removed from the deck (the removed pile), `recurring` cards recycle
 * to the discard. Costs may include resources and a discard cost: `discardHandIdxs` gives the
 * hand positions of cards to sacrifice (distinct indices, not the played card's slot). Cards
 * with `effect.destroy` require a
 * `destroyInstanceId` — the exact building instance to demolish (frees its territory slot and
 * workers). Moves are the only place `G` may change.
 */
export function playCard(
  G: GameState,
  playHandIdx: number,
  discardHandIdxs: number[] = [],
  destroyInstanceId?: number,
): 'invalid' | void {
  if (playHandIdx < 0 || playHandIdx >= G.hand.length) return 'invalid';
  const cardId = G.hand[playHandIdx];

  const card = CARDS[cardId];
  if (!card || unplayableReason(G, card)) return 'invalid';
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

  // All validated — pay costs and remove all played/sacrificed cards from hand first.
  subtractResources(G.resources, card.cost);
  if (card.popReserve) {
    G.reservedPop += card.popReserve;
    G.reservedActions.push(cardId);
  }
  const sacrificeIds = discardHandIdxs.map((i) => G.hand[i]);
  for (const i of [playHandIdx, ...discardHandIdxs].sort((a, b) => b - a)) G.hand.splice(i, 1);

  // Resolve effects before routing to discard — a draw that reshuffles G.discard cannot
  // return the not-yet-filed sacrifices back into the deck.
  // Pop-reserve cards defer their resource gain to upkeep; everything else applies immediately.
  if (card.popReserve && card.effect?.gain) {
    addResources(G.reservedGains, card.effect.gain);
    applyEffect(G, { ...card.effect, gain: undefined });
  } else {
    applyEffect(G, card.effect);
  }
  if (card.effect?.destroy && destroyInstanceId !== undefined) {
    const idx = G.tableau.findIndex((b) => b.id === destroyInstanceId);
    if (idx !== -1) G.tableau.splice(idx, 1);
  }
  for (const id of sacrificeIds) G.discard.push(id);
  if (card.kind === 'permanent') G.removed.push(cardId);
  else G.discard.push(cardId);
}

/** Assign one idle population to a specific building instance (identified by `id`), unless it's
 *  already at its worker requirement. */
export function assignWorker(G: GameState, id: number): 'invalid' | void {
  if (freePopulation(G) <= 0) return 'invalid';
  const b = G.tableau.find((x) => x.id === id);
  if (!b || b.workers >= requiredWorkers(b.buildingId)) return 'invalid';
  b.workers += 1;
}

/** Return one worker from a specific building instance (identified by `id`) to the idle pool. */
export function unassignWorker(G: GameState, id: number): 'invalid' | void {
  const b = G.tableau.find((x) => x.id === id);
  if (!b || b.workers <= 0) return 'invalid';
  b.workers -= 1;
}

/** Move one worker directly from one building instance to another (both identified by `id`),
 *  as a single atomic move. This is what a building-to-building drag uses instead of an
 *  unassign+assign pair — two separate moves would push two entries onto the undo stack,
 *  so one "undo" click would only unwind half the transfer. Invalid if the source has no
 *  worker to give, source and target are the same instance, or the target is already at
 *  its worker requirement. */
export function transferWorker(G: GameState, fromId: number, toId: number): 'invalid' | void {
  if (fromId === toId) return 'invalid';
  const from = G.tableau.find((x) => x.id === fromId);
  const to = G.tableau.find((x) => x.id === toId);
  if (!from || from.workers <= 0) return 'invalid';
  if (!to || to.workers >= requiredWorkers(to.buildingId)) return 'invalid';
  from.workers -= 1;
  to.workers += 1;
}

/** Toggle a building instance (identified by `id`) between empty and fully staffed in one
 *  move: staffed buildings empty out entirely; empty ones fill to their full worker
 *  requirement, but only all-or-nothing (mirrors `addBuilding`'s auto-staff) — if there
 *  aren't enough idle workers to fill it completely, the toggle is rejected rather than
 *  partially staffing it. No-op target for self-sufficient buildings (requirement 0). */
export function toggleStaffing(G: GameState, id: number): 'invalid' | void {
  const b = G.tableau.find((x) => x.id === id);
  if (!b) return 'invalid';
  const req = requiredWorkers(b.buildingId);
  if (req === 0) return 'invalid';
  if (b.workers > 0) {
    b.workers = 0;
    return;
  }
  if (freePopulation(G) < req) return 'invalid';
  b.workers = req;
}
