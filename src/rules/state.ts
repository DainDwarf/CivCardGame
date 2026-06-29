import { emptyResources, type Resources } from './resources';

/** A committed permanent card on the table, tracking the workers assigned to it. */
export interface BuildingInstance {
  cardId: string;
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
  /** Committed permanents, each tracking its assigned workers. */
  tableau: BuildingInstance[];
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
    tableau: [],
    handSize: 5,
    missionId,
    vars: {},
  };
}
