import { CARDS } from '../content/cards';
import { isOperating } from './population';
import type { BuildingInstance } from './state';

/** Count built cards carrying a tag (staffing-agnostic — a wonder is built regardless). */
export function countTag(tableau: BuildingInstance[], tag: string): number {
  return tableau.filter((b) => CARDS[b.cardId].tags?.includes(tag)).length;
}

/** Total defense from OPERATING buildings (an unstaffed barracks defends nothing). */
export function totalDefense(tableau: BuildingInstance[]): number {
  return tableau.reduce(
    (sum, b) => (isOperating(b) ? sum + (CARDS[b.cardId].defense ?? 0) : sum),
    0,
  );
}
