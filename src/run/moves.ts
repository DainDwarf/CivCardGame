import type { GameState } from '../rules';
import { applyEffect, canAfford, freePopulation, freeTerritory, requiredWorkers, subtractResources } from '../rules';
import { CARDS } from '../content/cards';

/**
 * Play a card from hand. The card's `effect` resolves (which may erect a building in the
 * tableau, auto-staffed from idle pop); then the *card itself* is routed by `kind` —
 * `permanent` cards are removed from the deck (the removed pile), `recurring` cards recycle
 * to the discard. Costs may include resources, population (paid from idle workers), and a
 * discard cost: `discardHandIdxs` gives the hand positions of cards to sacrifice (distinct
 * indices, not the played card's slot). Cards with `effect.destroy` require a
 * `destroyBuildingId` — the building to demolish (frees its territory slot and workers).
 * Moves are the only place `G` may change.
 */
export function playCard(
  G: GameState,
  playHandIdx: number,
  discardHandIdxs: number[] = [],
  destroyBuildingId?: string,
): 'invalid' | void {
  if (playHandIdx < 0 || playHandIdx >= G.hand.length) return 'invalid';
  const cardId = G.hand[playHandIdx];

  const card = CARDS[cardId];
  if (!card || !canAfford(G.resources, card.cost)) return 'invalid';
  // Population cost is paid from idle workers only (never by un-staffing buildings).
  if ((card.popCost ?? 0) > freePopulation(G)) return 'invalid';
  // A building needs an open slot — reject the play if the tableau is at its territory cap.
  if (card.effect?.build && freeTerritory(G) <= 0) return 'invalid';
  // A destroy card needs a valid target in the tableau.
  if (card.effect?.destroy) {
    if (!destroyBuildingId) return 'invalid';
    if (!G.tableau.some((b) => b.buildingId === destroyBuildingId)) return 'invalid';
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
  if (card.popCost) G.population -= card.popCost;
  const sacrificeIds = discardHandIdxs.map((i) => G.hand[i]);
  for (const i of [playHandIdx, ...discardHandIdxs].sort((a, b) => b - a)) G.hand.splice(i, 1);

  // Resolve effects before routing to discard — a draw that reshuffles G.discard cannot
  // return the not-yet-filed sacrifices back into the deck.
  applyEffect(G, card.effect);
  if (card.effect?.destroy && destroyBuildingId) {
    const emptyIdx = G.tableau.findIndex((b) => b.buildingId === destroyBuildingId && b.workers === 0);
    const idx = emptyIdx !== -1 ? emptyIdx : G.tableau.findIndex((b) => b.buildingId === destroyBuildingId);
    if (idx !== -1) G.tableau.splice(idx, 1);
  }
  for (const id of sacrificeIds) G.discard.push(id);
  if (card.kind === 'permanent') G.removed.push(cardId);
  else G.discard.push(cardId);
}

/**
 * Assign one idle population to the next understaffed building of a type. Buildings
 * of the same type are fungible, so allocation is by buildingId — each worker staffs one
 * more instance (e.g. one of your farms).
 */
export function assignWorker(G: GameState, buildingId: string): 'invalid' | void {
  if (freePopulation(G) <= 0) return 'invalid';
  const b = G.tableau.find((x) => x.buildingId === buildingId && x.workers < requiredWorkers(x.buildingId));
  if (!b) return 'invalid';
  b.workers += 1;
}

/** Return one worker from a staffed building of a type to the idle pool. */
export function unassignWorker(G: GameState, buildingId: string): 'invalid' | void {
  const b = G.tableau.find((x) => x.buildingId === buildingId && x.workers > 0);
  if (!b) return 'invalid';
  b.workers -= 1;
}
