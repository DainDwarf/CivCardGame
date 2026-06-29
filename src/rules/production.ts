import { BUILDINGS } from '../content/buildings';
import { isOperating } from './population';
import { addResources, emptyResources, type Resources } from './resources';
import type { BuildingInstance } from './state';

/** Per-round output of all OPERATING (staffed) buildings. */
export function tableauProduction(tableau: BuildingInstance[]): Resources {
  return tableau.reduce(
    (acc, b) => (isOperating(b) ? addResources(acc, BUILDINGS[b.buildingId].produces ?? {}) : acc),
    emptyResources(),
  );
}

/** Per-round culture output of all OPERATING (staffed) buildings. */
export function tableauCultureOutput(tableau: BuildingInstance[]): number {
  return tableau.reduce(
    (sum, b) => (isOperating(b) ? sum + (BUILDINGS[b.buildingId].cultureOutput ?? 0) : sum),
    0,
  );
}
