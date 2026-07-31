import type { GameState, PlacedCard } from './state';

/** Every card standing on the board: the tableau's buildings and wonders, this turn's Work boxes, and
 *  the standing trade routes. The one read-path for "what is on the board" — the instance-id scan
 *  (`population.ts`'s `nextInstanceId`) and the sim's staffable enumeration (`sim/actions.ts`) fold
 *  over it, so a new board zone reaches them by landing here. Deliberately *not* what the territory
 *  cap measures: work boxes and routes stand on the board without costing land (see `usedTerritory`).
 *  Not `threats`/`objective` either — those are mission pressure standing beside the board, not the
 *  player's own cards. */
export function placedCards(G: GameState): PlacedCard[] {
  return [...G.tableau, ...G.workZone, ...G.tradeRoutes];
}

/** Territory currently occupied — one slot per structure in the tableau, regardless of staffing. The
 *  tableau is the only zone territory sizes: a Work box is a transient bounded by the workers who can
 *  run it, and a trade route is bounded by its rent, so neither spends land. */
export function usedTerritory(G: GameState): number {
  return G.tableau.length;
}

/** Open territory: the cap minus what's built. 0 means no room for another structure. */
export function freeTerritory(G: GameState): number {
  return G.resources.territory - usedTerritory(G);
}
