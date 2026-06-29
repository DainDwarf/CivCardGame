import { BUILDINGS } from '../content/buildings';
import { isOperating } from './population';
import type { BuildingInstance } from './state';

/** Count built buildings carrying a tag (staffing-agnostic — a wonder is built regardless). */
export function countTag(tableau: BuildingInstance[], tag: string): number {
  return tableau.filter((b) => BUILDINGS[b.buildingId].tags?.includes(tag)).length;
}

/** Total defense from OPERATING buildings (an unstaffed barracks defends nothing). */
export function totalDefense(tableau: BuildingInstance[]): number {
  return tableau.reduce(
    (sum, b) => (isOperating(b) ? sum + (BUILDINGS[b.buildingId].defense ?? 0) : sum),
    0,
  );
}
