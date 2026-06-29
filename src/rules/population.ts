import { CARDS } from '../content/cards';
import type { BuildingInstance, GameState } from './state';

/** Food eaten per unit of population each round. */
export const FOOD_PER_POP = 1;

/** Workers needed for a building to operate. 0 = self-sufficient (e.g. City Walls). */
export function requiredWorkers(cardId: string): number {
  return CARDS[cardId].workers ?? 1;
}

/** Is this building staffed enough to operate (produce / defend)? */
export function isOperating(b: BuildingInstance): boolean {
  return b.workers >= requiredWorkers(b.cardId);
}

/** Total population currently assigned to buildings. */
export function assignedWorkers(tableau: BuildingInstance[]): number {
  return tableau.reduce((sum, b) => sum + b.workers, 0);
}

/** Population not currently assigned to any building. */
export function freePopulation(G: GameState): number {
  return G.population - assignedWorkers(G.tableau);
}

/** Food the whole population eats each round (working or idle). */
export function foodUpkeep(G: GameState): number {
  return G.population * FOOD_PER_POP;
}
