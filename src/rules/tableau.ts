import { CARDS } from '../content/cards';
import type { BuildingInstance, GameState } from './state';

/** Count built buildings carrying a tag (staffing-agnostic — a wonder is built regardless). */
export function countTag(tableau: BuildingInstance[], tag: string): number {
  return tableau.filter((b) => CARDS[b.cardId].tags?.includes(tag)).length;
}

/** Territory currently occupied — one slot per building in the tableau. */
export function usedTerritory(tableau: BuildingInstance[]): number {
  return tableau.length;
}

/** Open territory: the cap minus what's already built. 0 means no room to build. */
export function freeTerritory(G: GameState): number {
  return G.territory - usedTerritory(G.tableau);
}
