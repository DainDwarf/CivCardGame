import { emptyResources, type Resources } from './resources';

/** A building erected in the tableau, tracking the workers assigned to it. Identified by
 *  its `buildingId` (a key into the BUILDINGS catalogue), *not* by the card that built it —
 *  several different cards can construct the same building. */
export interface BuildingInstance {
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
