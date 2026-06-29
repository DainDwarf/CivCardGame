import { INVALID_MOVE } from 'boardgame.io/core';
import type { Move } from 'boardgame.io';
import type { GameState } from '../rules';
import { applyEffect, canAfford, freePopulation, requiredWorkers, subtractResources } from '../rules';
import { CARDS } from '../content/cards';

/**
 * Play a card from hand. The card's `effect` resolves (which may erect a building in the
 * tableau, auto-staffed from idle pop); then the *card itself* is routed by `kind` —
 * `permanent` cards are removed from the deck (the removed pile), `recurring` cards recycle
 * to the discard. Costs may include resources, population (paid from idle workers), and a
 * discard cost: `discardIds` names the other hand cards to sacrifice (one entry per card,
 * duplicates allowed). Moves are the only place `G` may change.
 */
export const playCard: Move<GameState> = ({ G }, playHandIdx: number, discardHandIdxs: number[] = []) => {
  if (playHandIdx < 0 || playHandIdx >= G.hand.length) return INVALID_MOVE;
  const cardId = G.hand[playHandIdx];

  const card = CARDS[cardId];
  if (!card || !canAfford(G.resources, card.cost)) return INVALID_MOVE;
  // Population cost is paid from idle workers only (never by un-staffing buildings).
  if ((card.popCost ?? 0) > freePopulation(G)) return INVALID_MOVE;

  // Discard-as-cost: sacrifice `discardCost` other cards — but only if you have that many
  // to spare. Played with an otherwise-empty hand it costs no discard (a reward for
  // sequencing the turn so this card comes last). Each index must be in range, distinct,
  // and not the played card itself.
  const want = card.discardCost ?? 0;
  const required = G.hand.length - 1 >= want ? want : 0;
  if (discardHandIdxs.length !== required) return INVALID_MOVE;
  const reserved = new Set<number>([playHandIdx]);
  for (const i of discardHandIdxs) {
    if (i < 0 || i >= G.hand.length || reserved.has(i)) return INVALID_MOVE;
    reserved.add(i);
  }

  // All validated — pay costs and remove cards (highest index first so the rest stay valid).
  subtractResources(G.resources, card.cost);
  if (card.popCost) G.population -= card.popCost;
  for (const i of discardHandIdxs) G.discard.push(G.hand[i]);
  for (const i of [playHandIdx, ...discardHandIdxs].sort((a, b) => b - a)) G.hand.splice(i, 1);

  // Resolve the card's effect (build / gain / draw / grow), then file the card itself.
  applyEffect(G, card.effect);
  if (card.kind === 'permanent') G.removed.push(cardId);
  else G.discard.push(cardId);
};

/**
 * Assign one idle population to the next understaffed building of a type. Buildings
 * of the same type are fungible, so allocation is by buildingId — each worker staffs one
 * more instance (e.g. one of your farms).
 */
export const assignWorker: Move<GameState> = ({ G }, buildingId: string) => {
  if (freePopulation(G) <= 0) return INVALID_MOVE;
  const b = G.tableau.find((x) => x.buildingId === buildingId && x.workers < requiredWorkers(x.buildingId));
  if (!b) return INVALID_MOVE;
  b.workers += 1;
};

/** Return one worker from a staffed building of a type to the idle pool. */
export const unassignWorker: Move<GameState> = ({ G }, buildingId: string) => {
  const b = G.tableau.find((x) => x.buildingId === buildingId && x.workers > 0);
  if (!b) return INVALID_MOVE;
  b.workers -= 1;
};
