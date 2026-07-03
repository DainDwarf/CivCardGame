import { emptyResources, type Resources } from './resources';
import { seededRng } from './rng';

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

/** A Work card played onto the board this turn, tracking the workers assigned to it. `cardId` (a
 *  key into the CARDS catalogue) is *what* it is; `id` is its stable per-instance identity, drawn
 *  from the same allocator as buildings so the shared worker moves can target either. A Work
 *  instance lives for one turn: it produces its card's `effect.gain` only while staffed, then the
 *  card files to `discard` at end of turn (see `endTurn`) and the instance is cleared. */
export interface WorkInstance {
  /** Stable identity, unique within the run across both tableau and workZone. */
  id: number;
  cardId: string;
  /** Population currently assigned to this work. */
  workers: number;
}

/**
 * GameState is the entire serializable run state (the engine's `G`). It must stay
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
   * Work cards played this turn, each tracking its assigned workers. Transient: not
   * territory-capped, produces only while staffed, and cleared at end of turn (each card
   * files to `discard`). Populated by `playCard`, reset in `endTurn`'s `discardWorkZone`.
   */
  workZone: WorkInstance[];
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
  /**
   * Persisted state of the run's RNG stream (`rules/rng.ts`'s `seededRng`/
   * `shuffleFromState`), advanced each time the discard pile reshuffles into a new
   * deck. Setup seeds this from `RunConfig.seed`; from there it's just data, so undo
   * and structuredClone carry it for free.
   */
  rngState: readonly number[];
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
    workZone: [],
    territory: 6,
    culture: 0,
    handSize: 5,
    missionId,
    vars: {},
    rngState: seededRng('blank').getState(),
  };
}
