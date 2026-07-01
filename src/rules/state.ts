import { emptyResources, type Resources } from './resources';

/** A building erected in the tableau, tracking the workers assigned to it. `buildingId` (a key
 *  into the BUILDINGS catalogue) says *what* it is — several different cards can build the same
 *  one — while `id` is its stable per-instance identity, unique for the run, so moves and the UI
 *  can target this exact building (staffing, demolish, its slot) even among identical siblings. */
export interface BuildingInstance {
  /** Stable identity, unique within the run — assigned once, at construction. */
  id: number;
  buildingId: string;
  /** Population currently assigned to this building. */
  workers: number;
}

/**
 * GameState is boardgame.io's `G` — the entire serializable run state. It must stay
 * JSON-serializable (save/load, undo, and headless simulation depend on it). It lives
 * in `rules/` (the framework-free core) because both the run shell and the mission
 * evaluators reason over it.
 */
export interface GameState {
  round: number;
  resources: Resources;
  /** Total population — a pool of workers. Everyone eats food each round. */
  population: number;
  /** Population reserved by action cards played this turn — cannot be assigned to buildings. Resets at beginTurn. */
  reservedPop: number;
  /** Card IDs whose pop-reserve cost was paid this turn — drives the reserved-action boxes on the canvas. Resets at beginTurn. */
  reservedActions: string[];
  /** Resource gains queued by pop-reserve cards this turn — applied during upkeep so they show in projectedDelta. Resets at beginTurn. */
  reservedGains: Resources;
  /** Cards in hand. */
  hand: string[];
  /** Draw pile. */
  deck: string[];
  /** Discard pile — recurring cards return here and reshuffle when the deck empties. */
  discard: string[];
  /**
   * Exile pile — cards permanently removed from the deck for the rest of the run (never
   * drawn again, never reshuffled). This is *not* the tableau: a building in play is an
   * active entity, whereas a removed card is gone from the deck. They diverge especially
   * for future cards that stay in the deck cycle yet spawn a permanent building as an
   * effect (the building enters `tableau`; the card goes to `discard` or here).
   */
  removed: string[];
  /** Committed permanents, each tracking its assigned workers. */
  tableau: BuildingInstance[];
  /**
   * Territory available — the tableau may hold at most this many buildings. Each building
   * fills one slot; building cards become unplayable when it is full. Expanded by territory
   * cards (Conquest, Develop).
   */
  territory: number;
  /**
   * Culture accumulated so far — a civilization-wide gauge, not a spendable currency.
   * Grows each round from operating cultural buildings (e.g. Theater) and from card
   * effects (e.g. Cultural Festival). Some cards require a minimum culture level to play.
   */
  culture: number;
  /** How many cards to draw up to at the start of each round. */
  handSize: number;
  /** Which mission this run is playing (looked up in the MISSIONS registry). */
  missionId: string;
  /** Mission-specific counters (e.g. `threat`). Keeps `GameState` generic. */
  vars: Record<string, number>;
}

/** A zeroed baseline state — used by setup, tests, and (later) the simulator. */
export function blankState(missionId: string): GameState {
  return {
    round: 0,
    resources: emptyResources(),
    population: 0,
    reservedPop: 0,
    reservedActions: [],
    reservedGains: emptyResources(),
    hand: [],
    deck: [],
    discard: [],
    removed: [],
    tableau: [],
    territory: 6,
    culture: 0,
    handSize: 5,
    missionId,
    vars: {},
  };
}
