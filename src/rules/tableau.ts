import type { BuildingInstance, GameState } from './state';

/** Territory currently occupied — one slot per building in the tableau. */
export function usedTerritory(tableau: BuildingInstance[]): number {
  return tableau.length;
}

/** Open territory: the cap minus what's already built. 0 means no room to build. */
export function freeTerritory(G: GameState): number {
  return G.resources.territory - usedTerritory(G.tableau);
}
