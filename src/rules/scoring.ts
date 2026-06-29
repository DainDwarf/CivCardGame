import { CARDS } from '../content/cards';
import type { BuildingInstance } from './state';

/** Victory points from all built cards (staffing-agnostic). */
export function score(tableau: BuildingInstance[]): number {
  return tableau.reduce((sum, b) => sum + (CARDS[b.cardId].vp ?? 0), 0);
}
