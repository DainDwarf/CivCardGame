import { BUILDINGS } from '../content/buildings';
import { CARDS } from '../content/cards';
import type { BuildingInstance, GameState, WorkInstance } from './state';

/** Food eaten per unit of population each round. */
export const FOOD_PER_POP = 1;

/**
 * A staffable board entity — a building in the tableau or a Work card in the workZone. Both
 * carry an `id` and `workers` and share the worker-assignment machinery (the four moves,
 * `freePopulation`, `isOperating`); they differ only in which catalogue defines their worker
 * requirement. Discriminated by the presence of `buildingId`.
 */
export type Staffable = BuildingInstance | WorkInstance;

/** Workers needed for a building to operate. 0 = self-sufficient (e.g. City Walls). */
export function requiredWorkers(buildingId: string): number {
  return BUILDINGS[buildingId].workers ?? 1;
}

/** Worker requirement of any staffable, read from whichever catalogue defines it. Work cards
 *  default to 1 worker space (`workers: 0` = always operating). */
export function requiredWorkersOf(s: Staffable): number {
  return 'buildingId' in s ? requiredWorkers(s.buildingId) : CARDS[s.cardId].workers ?? 1;
}

/** Is this staffable staffed enough to operate (produce / defend)? */
export function isOperating(s: Staffable): boolean {
  return s.workers >= requiredWorkersOf(s);
}

/** Total population currently assigned across a set of staffables (tableau or workZone). */
export function assignedWorkers(instances: Staffable[]): number {
  return instances.reduce((sum, s) => sum + s.workers, 0);
}

/** Population not currently assigned to any building or Work card. */
export function freePopulation(G: GameState): number {
  return G.population - assignedWorkers(G.tableau) - assignedWorkers(G.workZone);
}

/** Food the whole population eats each round (working or idle). */
export function foodUpkeep(G: GameState): number {
  return G.population * FOOD_PER_POP;
}

/**
 * Idle workers to auto-assign to a freshly placed staffable. All-or-nothing: staff it to its
 * full requirement only if that many are free, otherwise leave it unstaffed (no workers parked
 * on something that can't operate yet). 0 for self-sufficient requirements too.
 */
function autoStaffTo(G: GameState, req: number): number {
  return freePopulation(G) >= req ? req : 0;
}

/** Auto-staff count for a building about to be erected. */
export function autoStaffCount(G: GameState, buildingId: string): number {
  return autoStaffTo(G, requiredWorkers(buildingId));
}

/** The next stable instance id: one past the highest currently in play across *both* the tableau
 *  and the workZone. Deterministic (no RNG). A shared allocator across both zones is what lets the
 *  worker moves look up an instance by `id` without a building and a Work card ever colliding.
 *  Ids of removed instances may be reused, which is harmless since nothing references them. */
export function nextInstanceId(G: GameState): number {
  let max = 0;
  for (const b of G.tableau) max = Math.max(max, b.id);
  for (const w of G.workZone) max = Math.max(max, w.id);
  return max + 1;
}

/** Erect a building in the tableau, auto-staffing it from the idle pool (all-or-nothing). */
export function addBuilding(G: GameState, buildingId: string): void {
  const workers = autoStaffCount(G, buildingId);
  G.tableau.push({ id: nextInstanceId(G), buildingId, workers });
}

/** Play a Work card onto the board, auto-staffing it from the idle pool (all-or-nothing). */
export function addWork(G: GameState, cardId: string): void {
  const workers = autoStaffTo(G, CARDS[cardId].workers ?? 1);
  G.workZone.push({ id: nextInstanceId(G), cardId, workers });
}

/** Find a staffable (building or Work card) by its instance id, searching both zones. */
export function findStaffable(G: GameState, id: number): Staffable | undefined {
  return G.tableau.find((b) => b.id === id) ?? G.workZone.find((w) => w.id === id);
}
