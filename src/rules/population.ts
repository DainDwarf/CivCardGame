import { BUILDINGS } from '../content/buildings';
import type { BuildingInstance, GameState } from './state';

/** Food eaten per unit of population each round. */
export const FOOD_PER_POP = 1;

/** Workers needed for a building to operate. 0 = self-sufficient (e.g. City Walls). */
export function requiredWorkers(buildingId: string): number {
  return BUILDINGS[buildingId].workers ?? 1;
}

/** Is this building staffed enough to operate (produce / defend)? */
export function isOperating(b: BuildingInstance): boolean {
  return b.workers >= requiredWorkers(b.buildingId);
}

/** Total population currently assigned to buildings. */
export function assignedWorkers(tableau: BuildingInstance[]): number {
  return tableau.reduce((sum, b) => sum + b.workers, 0);
}

/** Population not currently assigned to any building or reserved by action cards this turn. */
export function freePopulation(G: GameState): number {
  return G.population - assignedWorkers(G.tableau) - G.reservedPop;
}

/** Food the whole population eats each round (working or idle). */
export function foodUpkeep(G: GameState): number {
  return G.population * FOOD_PER_POP;
}

/**
 * Idle workers to auto-assign to a freshly built building. All-or-nothing: staff it
 * to its full requirement only if that many are free, otherwise leave it unstaffed
 * (no workers parked on a building that can't operate yet). 0 for self-sufficient
 * buildings too.
 */
export function autoStaffCount(G: GameState, buildingId: string): number {
  const req = requiredWorkers(buildingId);
  return freePopulation(G) >= req ? req : 0;
}

/** Erect a building in the tableau, auto-staffing it from the idle pool (all-or-nothing). */
export function addBuilding(G: GameState, buildingId: string): void {
  G.tableau.push({ buildingId, workers: autoStaffCount(G, buildingId) });
}
