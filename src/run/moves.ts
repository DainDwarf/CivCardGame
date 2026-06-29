import { INVALID_MOVE } from 'boardgame.io/core';
import type { Move } from 'boardgame.io';
import type { GameState } from '../rules';
import {
  applyEffect,
  autoStaffCount,
  canAfford,
  freePopulation,
  requiredWorkers,
  subtractResources,
} from '../rules';
import { CARDS } from '../content/cards';

/**
 * Play a card from hand. Permanents commit to the tableau (auto-staffed from idle pop);
 * recurring cards resolve their effect and go to the discard. Some cards also charge a
 * discard cost: `discardIds` names the other hand cards to sacrifice (one entry per card,
 * duplicates allowed). Moves are the only place `G` may change.
 */
export const playCard: Move<GameState> = ({ G }, cardId: string, discardIds: string[] = []) => {
  const playIdx = G.hand.indexOf(cardId);
  if (playIdx === -1) return INVALID_MOVE;

  const card = CARDS[cardId];
  if (!card || !canAfford(G.resources, card.cost)) return INVALID_MOVE;

  // Discard-as-cost: sacrifice `discardCost` other cards — but only if you have that many
  // to spare. Played with an otherwise-empty hand it costs no discard (a reward for
  // sequencing the turn so this card comes last). Resolve each to a distinct hand instance.
  const want = card.discardCost ?? 0;
  const required = G.hand.length - 1 >= want ? want : 0;
  if (discardIds.length !== required) return INVALID_MOVE;
  const reserved = new Set<number>([playIdx]);
  const discardIdxs: number[] = [];
  for (const did of discardIds) {
    const i = G.hand.findIndex((c, j) => c === did && !reserved.has(j));
    if (i === -1) return INVALID_MOVE;
    reserved.add(i);
    discardIdxs.push(i);
  }

  // All validated — pay costs and remove cards (highest index first so the rest stay valid).
  subtractResources(G.resources, card.cost);
  for (const i of discardIdxs) G.discard.push(G.hand[i]);
  for (const i of [playIdx, ...discardIdxs].sort((a, b) => b - a)) G.hand.splice(i, 1);

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
