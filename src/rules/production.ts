import { BUILDINGS } from '../content/buildings';
import { CARDS } from '../content/cards';
import { isOperating } from './population';
import { addResources, emptyResources, type Resources } from './resources';
import type { BuildingInstance, WorkInstance } from './state';

/** Per-round output of all OPERATING (staffed) buildings. */
export function tableauProduction(tableau: BuildingInstance[]): Resources {
  return tableau.reduce(
    (acc, b) => (isOperating(b) ? addResources(acc, BUILDINGS[b.buildingId].produces ?? {}) : acc),
    emptyResources(),
  );
}

/** Per-round output of all OPERATING (staffed) Work cards — their card's `effect.gain`. Unstaffed
 *  work produces nothing. */
export function workZoneProduction(workZone: WorkInstance[]): Resources {
  return workZone.reduce(
    (acc, w) => (isOperating(w) ? addResources(acc, CARDS[w.cardId].effect?.gain ?? {}) : acc),
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
