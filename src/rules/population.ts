import { CARDS } from '../content/cards';
import type { CardInstance, GameState, PlacedCard } from './state';
import { placedCards } from './territory';

/** Marginal food the `n`-th person eats — the whole shape of `foodUpkeep`, exposed on its own so the
 *  UI can show what the *next* population point will cost without re-deriving the curve. */
export function foodPerNextPop(n: number): number {
  return Math.floor(n / 2);
}

/**
 * A staffable board entity — a building in the tableau or a Work card in the workZone. Both are
 * placed cards carrying an `id`, a `cardId`, and `workers`, and share the worker-assignment
 * machinery (the four moves, `freePopulation`, `isOperating`) and one worker-requirement lookup.
 */
export type Staffable = PlacedCard;

/** Worker *capacity* of a staffable card, by id — the most workers it can hold. `workers: 0` =
 *  self-sufficient (holds no workers, always operating). A staffable card MUST declare `workers`; a
 *  missing field throws rather than silently defaulting, so a forgotten field fails fast at the first
 *  staffing read instead of a phantom capacity-1 box appearing (`cards.test.ts` pins every real
 *  staffable declares it, catching it earlier still). */
export function cardWorkerCap(cardId: string): number {
  const cap = CARDS[cardId].workers;
  if (cap === undefined) throw new Error(`staffable card '${cardId}' declares no workers`);
  return cap;
}

/** Worker *capacity* of any staffable instance — the assignment cap and the pip count; the
 *  operate-threshold and the output multiplier are derived from it below. */
export function workerCapOf(s: Staffable): number {
  return cardWorkerCap(s.cardId);
}

/** Is this staffable operating (producing / defending)? Every staffable operates with at least one
 *  worker; a self-sufficient one (capacity 0) always operates. Output then scales per worker —
 *  see `producingUnits`. */
export function isOperating(s: Staffable): boolean {
  return workerCapOf(s) === 0 || s.workers >= 1;
}

/** The linear output multiplier for an operating staffable: the number of staffed workers, or 1 for
 *  a self-sufficient one (capacity 0) so it yields its flat output once rather than ×0. Production
 *  scales by this (`effects.ts`'s `resolveProduction`); the on-board box shows `unit × producingUnits`. */
export function producingUnits(s: Staffable): number {
  const cap = workerCapOf(s);
  return cap === 0 ? 1 : s.workers;
}

/** Total population currently assigned across a set of staffables (tableau or workZone). */
export function assignedWorkers(instances: Staffable[]): number {
  return instances.reduce((sum, s) => sum + s.workers, 0);
}

/** Population not currently assigned to any building or Work card. */
export function freePopulation(G: GameState): number {
  return G.resources.population - assignedWorkers(G.tableau) - assignedWorkers(G.workZone);
}

/** Food the whole population eats each round (working or idle) — superlinear, so growth has to be
 *  paid for rather than compounding for free. `floor(pop²/4)` is the running sum of
 *  `foodPerNextPop`, i.e. every second person raises what each further person eats. */
export function foodUpkeep(G: GameState): number {
  const pop = G.resources.population;
  return Math.floor((pop * pop) / 4);
}

/**
 * Idle workers to auto-assign to a freshly placed staffable: fill toward its capacity from the idle
 * pool, partial-filling when there aren't enough free (a staffable operates at ≥1 worker and scales
 * per worker, so a partly-staffed box still produces). 0 for a self-sufficient card (capacity 0).
 */
export function autoStaffCount(G: GameState, cardId: string): number {
  return Math.min(freePopulation(G), cardWorkerCap(cardId));
}

/** The next stable instance id: one past the highest currently in *any* zone — everything standing on
 *  the board (`territory.ts`'s `placedCards`), the card piles (hand, deck, discard, removed), the
 *  mission's threats and objective, *and* any options parked off-zone in a pending interaction — all
 *  of which share one instance-id space. Deterministic (no RNG). Scanning every zone is what keeps ids
 *  unique run-wide, so a card minted mid-run (`deck.ts`'s `spawnIntoDeck`, a mission's seeded threats)
 *  never collides with one already in a zone. Playing a card mints nothing — it carries its own id
 *  onto the board. `pendingInteraction.options` are cards lifted out of the deck (or discard)
 *  awaiting a choice; no move mints while an interaction is pending today, but scanning them keeps the
 *  invariant robust if a future interactive card ever does. Ids of a card that has left every zone may
 *  be reused, which is harmless since nothing references them. */
export function nextInstanceId(G: GameState): number {
  let max = 0;
  for (const p of placedCards(G)) max = Math.max(max, p.id);
  for (const c of G.hand) max = Math.max(max, c.id);
  for (const c of G.deck) max = Math.max(max, c.id);
  for (const c of G.discard) max = Math.max(max, c.id);
  for (const c of G.removed) max = Math.max(max, c.id);
  for (const c of G.pendingInteraction?.options ?? []) max = Math.max(max, c.id);
  for (const t of G.threats) max = Math.max(max, t.id);
  if (G.objective) max = Math.max(max, G.objective.id);
  return max + 1;
}

/** Erect a building card in the tableau, auto-staffing it from the idle pool (partial-filling toward
 *  its capacity — see `autoStaffCount`).
 *
 *  Takes the **played instance itself** and adds staffing to it, rather than minting a fresh id from
 *  the cardId: a copy keeps one identity for the whole run wherever it stands, so its `stickers` (a
 *  Reinforced building must still read its bonus through `resolveProduction`'s `effectiveGain`) and
 *  its `counters` (a self-scaling card's per-copy state) travel with the physical card instead of
 *  being re-derived — or lost — at every zone crossing. */
export function addBuilding(G: GameState, inst: CardInstance): PlacedCard {
  const placed = { ...inst, workers: autoStaffCount(G, inst.cardId) };
  G.tableau.push(placed);
  return placed;
}

/** Play a Work card onto the board, auto-staffing it from the idle pool (partial-filling toward its
 *  capacity — see `autoStaffCount`). Carries the played instance across, same reasoning as
 *  `addBuilding` above; `upkeep.ts`'s `discardWorkZone` strips only the staffing on the way out. */
export function addWork(G: GameState, inst: CardInstance): void {
  G.workZone.push({ ...inst, workers: autoStaffCount(G, inst.cardId) });
}

/** Find a staffable (building or Work card) by its instance id, searching both zones. */
export function findStaffable(G: GameState, id: number): Staffable | undefined {
  return G.tableau.find((b) => b.id === id) ?? G.workZone.find((w) => w.id === id);
}
