import { INVALID_MOVE } from 'boardgame.io/core';
import type { Move } from 'boardgame.io';
import type { GameState } from '../rules';
import { applyEffect, autoStaffCount, canAfford, freePopulation, requiredWorkers } from '../rules';
import { CARDS } from '../content/cards';

/**
 * Play a card from hand. Permanents commit to the tableau (unstaffed); recurring
 * cards resolve their effect and go to the discard. Moves are the only place `G` may
 * change.
 */
export const playCard: Move<GameState> = ({ G }, cardId: string) => {
  const idx = G.hand.indexOf(cardId);
  if (idx === -1) return INVALID_MOVE;

  const card = CARDS[cardId];
  if (!card || !canAfford(G.resources, card.cost)) return INVALID_MOVE;

  G.resources.production -= card.cost;
  G.hand.splice(idx, 1);

  if (card.kind === 'permanent') {
    // Auto-staff the new building from the idle pool, up to what it needs.
    G.tableau.push({ cardId, workers: autoStaffCount(G, cardId) });
  } else {
    applyEffect(G, card.effect);
    G.discard.push(cardId);
  }
};

/**
 * Assign one idle population to the next understaffed building of a type. Buildings
 * of the same type are fungible, so allocation is by cardId — each worker staffs one
 * more instance (e.g. one of your farms).
 */
export const assignWorker: Move<GameState> = ({ G }, cardId: string) => {
  if (freePopulation(G) <= 0) return INVALID_MOVE;
  const b = G.tableau.find((x) => x.cardId === cardId && x.workers < requiredWorkers(x.cardId));
  if (!b) return INVALID_MOVE;
  b.workers += 1;
};

/** Return one worker from a staffed building of a type to the idle pool. */
export const unassignWorker: Move<GameState> = ({ G }, cardId: string) => {
  const b = G.tableau.find((x) => x.cardId === cardId && x.workers > 0);
  if (!b) return INVALID_MOVE;
  b.workers -= 1;
};
