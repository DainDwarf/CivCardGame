import type { CardInstance, GameState } from './state';

/** Every card standing on the board: the tableau's buildings and wonders, this turn's Work boxes, and
 *  the standing trade routes. The one read-path for "what is on the board" — the territory cap, the
 *  instance-id scan (`population.ts`'s `nextInstanceId`) and the UI slot grid all fold over it, so a
 *  new board zone reaches them by landing here. Not `threats`/`objective`: those are mission pressure
 *  standing beside the board, not land the player spends. */
export function placedCards(G: GameState): CardInstance[] {
  return [...G.tableau, ...G.workZone, ...G.tradeRoutes];
}

/** Territory currently occupied — one slot per card standing on the board, regardless of staffing. */
export function usedTerritory(G: GameState): number {
  return placedCards(G).length;
}

/** Open territory: the cap minus what stands on the board. 0 means no room to play anything onto it. */
export function freeTerritory(G: GameState): number {
  return G.resources.territory - usedTerritory(G);
}
