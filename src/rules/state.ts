import { emptyResources, type Resources } from './resources';
import { seededRng } from './rng';

/** A card placed on the board as a staffable instance — a building in the `tableau` or a Work card
 *  in the `workZone`. `cardId` (a key into the CARDS catalogue) is *what* it is — the card *is* the
 *  building, there's no separate building entity — while `id` is its stable per-instance identity,
 *  unique within the run across both zones, so moves and the UI can target this exact instance
 *  (staffing, demolish, its slot) even among identical siblings. */
export interface PlacedCard {
  /** Stable identity, unique within the run — assigned once, at placement. */
  id: number;
  /** Key into the CARDS catalogue. */
  cardId: string;
  /** Population currently assigned to this instance. */
  workers: number;
}

/** A building erected in the tableau. A `building` card played from hand becomes one of these and
 *  stays in play until demolished (then its card files to the `removed` pile); it produces its
 *  card's `produces`/`cultureOutput` each round while staffed. */
export type BuildingInstance = PlacedCard;

/** A Work card played onto the board this turn. Transient: it produces its card's `effect.gain`
 *  only while staffed, then the card files to `discard` at end of turn (see `endTurn`) and the
 *  instance is cleared. */
export type WorkInstance = PlacedCard;

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
  /** Discard pile — where a card lands by default once it's played and resolved (or, for a
   *  Work card, once its turn on the board ends, or an `event` card once it auto-resolves —
   *  see `rules/upkeep.ts`'s `resolveHandEvents`). Going to `removed` instead is always the
   *  exception, driven by a specific effect rather than a card's `kind`: a `building` card
   *  goes there only if some other card's `effect.destroy` targets it (demolishing it out of
   *  the tableau), and an `event` card goes there only if its own `effect.remove` is set
   *  (currently just Barbarian). Reshuffled into the deck when it runs dry. */
  discard: string[];
  /**
   * Exile pile — cards permanently removed from the deck for the rest of the run (never
   * drawn again, never reshuffled). This is *not* the tableau: a building in play is an
   * active entity on the board, whereas a removed card is gone from play. A `building` card
   * moves here when demolished (via another card's `effect.destroy`), and an auto-resolved
   * `event` card moves here if its own effect sets `remove: true` (currently just Barbarian)
   * — see `discard`'s doc comment above for why neither is an inherent rule of its `kind`.
   */
  removed: string[];
  /** Buildings in play (each a placed `building` card), tracking their assigned workers. */
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
    rngState: seededRng('blank').getState(),
  };
}
