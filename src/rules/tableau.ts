import { BUILDINGS } from '../content/buildings';
import type { BuildingInstance } from './state';

/** Count built buildings carrying a tag (staffing-agnostic — a wonder is built regardless). */
export function countTag(tableau: BuildingInstance[], tag: string): number {
  return tableau.filter((b) => BUILDINGS[b.buildingId].tags?.includes(tag)).length;
}
