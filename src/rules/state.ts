import { emptyResources, type Resources } from './resources';
import { seededRng } from './rng';

/**
 * A card with a stable per-run identity. Every card living in a zone (`hand`/`deck`/`discard`/
 * `removed`) or on the board (`tableau`/`workZone`) is one of these: `cardId` (a key into the CARDS
 * catalogue) is *what* it is, `id` is *which physical copy* — unique within the run, so a resolver,
 * the UI, or a mission can target this exact copy even among identical siblings, and per-copy state
 * (below) rides with it as it cycles hand→discard→deck→hand.
 */
export interface CardInstance {
  /** Stable identity, unique within the run — assigned once, at mint (setup or play). */
  id: number;
  /** Key into the CARDS catalogue. */
  cardId: string;
  /**
   * Per-instance run counters, effect-layer-owned — a card whose behavior depends on how *its own
   * copy* has been used (e.g. Cornucopia's play count) keeps its number here, keyed however its
   * resolver chooses. Deliberately a generic map, not bespoke named fields: cards own their own
   * numbers, so neither this shared type nor `GameState` accretes card-specific variables. Absent
   * until a resolver first writes one. Plain data, carried by structuredClone/undo for free. Read/
   * written via `getCounter`/`bumpCounter`.
   *
   * NOTE: three transitions deliberately drop `counters` when re-minting a plain instance, harmless
   * today because no work/building/interactive card uses one — but the exact spots a *future* such
   * card would lose its state: `upkeep.ts`'s `discardWorkZone` (work box → discard), `effects.ts`'s
   * `demolish` (tableau building → removed), and `moves.ts`'s `resolveInteraction` (rebuilding
   * `self` for a resume pass).
   */
  counters?: Record<string, number>;
}

/** A card placed on the board as a staffable instance — a building in the `tableau` or a Work card
 *  in the `workZone`. A `CardInstance` plus the population assigned to staff it. The card *is* the
 *  building/work box (there's no separate entity), and `id` targets this exact one (staffing,
 *  demolish, its slot) even among identical siblings. */
export interface PlacedCard extends CardInstance {
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
  /** Cards in hand — each a `CardInstance` (identity-bearing, so an individual copy can carry its
   *  own per-instance state as it's played and recycled). */
  hand: CardInstance[];
  /** Draw pile. */
  deck: CardInstance[];
  /** Discard pile — where a card lands by default once it's played and resolved (or, for a
   *  Work card, once its turn on the board ends, or an `event` card once it auto-resolves —
   *  see `rules/upkeep.ts`'s `resolveHandEvents`). Going to `removed` instead is always the
   *  exception, driven by a specific effect rather than a card's `kind`: a `building` card
   *  goes there only if some other card's `effect.destroy` targets it (demolishing it out of
   *  the tableau), and an `event` card goes there only if its own `effect.remove` is set
   *  (currently just Barbarian). Reshuffled into the deck when it runs dry. */
  discard: CardInstance[];
  /**
   * Exile pile — cards permanently removed from the deck for the rest of the run (never
   * drawn again, never reshuffled). This is *not* the tableau: a building in play is an
   * active entity on the board, whereas a removed card is gone from play. A `building` card
   * moves here when demolished (via another card's `effect.destroy`), and an auto-resolved
   * `event` card moves here if its own effect sets `remove: true` (currently just Barbarian)
   * — see `discard`'s doc comment above for why neither is an inherent rule of its `kind`.
   */
  removed: CardInstance[];
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
  /**
   * A card effect suspended awaiting a player choice, or `null` when none is pending. While set,
   * the run is "paused" on that choice: `endTurn` no-ops and undo is blocked until it resolves (see
   * `PendingInteraction`). Plain data, carried by undo/structuredClone for free.
   */
  pendingInteraction: PendingInteraction | null;
}

/**
 * A card effect suspended mid-resolution, waiting on a player choice (`rules/effects.ts`'s
 * resolver `EffectContext.answer`). Plain data on `GameState` so it survives structuredClone/undo
 * and stays in the framework-free core: the resolver reveals options, parks them here, and returns;
 * the UI renders a prompt from this; `run/moves.ts`'s `resolveInteraction` re-enters the same card's
 * resolver with the chosen index, which completes the effect and clears this back to `null`.
 * A pending interaction is **non-cancelable** — the reveal has already committed (e.g. Foresight
 * lifts cards off the deck, clearing the undo stack), so the only exit is answering it.
 */
export interface PendingInteraction {
  /** The card whose resolver is suspended — `resolveInteraction` re-enters *this* card's resolver. */
  cardId: string;
  /** The suspended card's own instance id, so the resume pass can reconstruct its `self` (the copy
   *  that was played). Carried for completeness; today's one interactive card (Foresight) reads only
   *  its parked `options`, not its own counters. */
  instanceId: number;
  /** Which choice shape this is (drives the UI prompt). Only `'chooseCard'` exists so far. */
  kind: 'chooseCard';
  /** Prompt text for the modal header — authored by the card, so the shell needs no per-card copy. */
  prompt: string;
  /** The revealed card instances the player picks from — full instances (not bare ids) so the chosen
   *  copy keeps its identity when it moves into the hand. */
  options: CardInstance[];
  /** How many to pick (1 today). */
  pick: number;
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
    pendingInteraction: null,
  };
}

/** Read a per-instance counter off a card, defaulting a never-touched key to 0. */
export function getCounter(inst: CardInstance, key: string): number {
  return inst.counters?.[key] ?? 0;
}

/** Add `by` (default 1) to a per-instance counter and return the new value, lazily creating the
 *  `counters` map so instances that never use one stay bare. */
export function bumpCounter(inst: CardInstance, key: string, by = 1): number {
  const next = getCounter(inst, key) + by;
  (inst.counters ??= {})[key] = next;
  return next;
}

/** Mint fresh card instances from an ordered list of card ids, assigning sequential ids from
 *  `startId`. The one path that turns a plain `string[]` (a `RunConfig.deck`, a mission's injected
 *  cards, a test fixture) into identity-bearing zone contents — shared by `run/setup.ts` and tests
 *  so no one re-implements id assignment. Ids must stay unique within the run: `startId` defaults to
 *  1 for a fresh deck; a later bulk mint (e.g. a mission seeding extra cards) passes
 *  `nextInstanceId(G)` so it continues past whatever ids already exist. */
export function instancesFromCardIds(cardIds: readonly string[], startId = 1): CardInstance[] {
  return cardIds.map((cardId, i) => ({ id: startId + i, cardId }));
}
