import { CARDS } from '../content/cards';
import type { GameState, PlacedCard } from './state';

/** Food eaten per unit of population each round. */
export const FOOD_PER_POP = 1;

/**
 * A staffable board entity — a building in the tableau or a Work card in the workZone. Both are
 * placed cards carrying an `id`, a `cardId`, and `workers`, and share the worker-assignment
 * machinery (the four moves, `freePopulation`, `isOperating`) and one worker-requirement lookup.
 */
export type Staffable = PlacedCard;

/** Worker requirement of any staffable, read from its card. `workers: 0` = self-sufficient
 *  (always operating, e.g. City Walls); absent defaults to 1. */
export function requiredWorkersOf(s: Staffable): number {
  return CARDS[s.cardId].workers ?? 1;
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

/** Auto-staff count for a card about to be placed on the board. */
export function autoStaffCount(G: GameState, cardId: string): number {
  return autoStaffTo(G, CARDS[cardId].workers ?? 1);
}

/** The next stable instance id: one past the highest currently in *any* zone — the board (tableau,
 *  workZone), the card piles (hand, deck, discard, removed), *and* any options parked off-zone in a
 *  pending interaction — all of which carry instance ids. Deterministic (no RNG). Scanning every
 *  zone is what keeps ids unique run-wide, so a building or Work box minted at play never collides
 *  with a card already sitting in the deck. `pendingInteraction.options` are cards lifted out of the
 *  deck awaiting a choice (e.g. Foresight's peek); no move mints while an interaction is pending
 *  today, but scanning them keeps the invariant robust if a future interactive card ever does. Also
 *  scans `G.threats` (`rules/threats.ts`), which shares this same instance-id space. Ids
 *  of a card that has left every zone may be reused, which is harmless since nothing references them. */
export function nextInstanceId(G: GameState): number {
  let max = 0;
  for (const b of G.tableau) max = Math.max(max, b.id);
  for (const w of G.workZone) max = Math.max(max, w.id);
  for (const c of G.hand) max = Math.max(max, c.id);
  for (const c of G.deck) max = Math.max(max, c.id);
  for (const c of G.discard) max = Math.max(max, c.id);
  for (const c of G.removed) max = Math.max(max, c.id);
  for (const c of G.pendingInteraction?.options ?? []) max = Math.max(max, c.id);
  for (const t of G.threats) max = Math.max(max, t.id);
  return max + 1;
}

/** Erect a building card in the tableau, auto-staffing it from the idle pool (all-or-nothing).
 *  `stickers` (if the played hand instance carried any) rides onto the new tableau instance —
 *  otherwise a Reinforced building would silently lose its bonus the moment it's placed, since
 *  `resolveProduction`'s `effectiveGain` reads stickers off *this* instance, not the played card's
 *  original one (Phase 3 Step 7.6). */
export function addBuilding(G: GameState, cardId: string, stickers?: string[]): void {
  const workers = autoStaffCount(G, cardId);
  G.tableau.push({ id: nextInstanceId(G), cardId, workers, ...(stickers?.length ? { stickers } : {}) });
}

/** Play a Work card onto the board, auto-staffing it from the idle pool (all-or-nothing). Carries
 *  `stickers` onto the new work-zone instance, same reasoning as `addBuilding` above. */
export function addWork(G: GameState, cardId: string, stickers?: string[]): void {
  const workers = autoStaffCount(G, cardId);
  G.workZone.push({ id: nextInstanceId(G), cardId, workers, ...(stickers?.length ? { stickers } : {}) });
}

/** Find a staffable (building or Work card) by its instance id, searching both zones. */
export function findStaffable(G: GameState, id: number): Staffable | undefined {
  return G.tableau.find((b) => b.id === id) ?? G.workZone.find((w) => w.id === id);
}
