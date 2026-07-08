import { emptyResources, type Resources } from './resources';
import { seededRng } from './rng';

/**
 * A card with a stable per-run identity. Every card in a zone (`hand`/`deck`/`discard`/`removed`)
 * or on the board (`tableau`/`workZone`) is one of these: `cardId` is *what* it is, `id` is *which
 * physical copy* — unique within the run, so a resolver, the UI, or a mission can target this exact
 * copy among identical siblings, and per-copy state rides with it as it cycles hand→discard→deck.
 */
export interface CardInstance {
  /** Stable identity, unique within the run — assigned once, at mint (setup or play). */
  id: number;
  /** Key into the CARDS catalogue. */
  cardId: string;
  /**
   * Per-instance run counters (e.g. Cornucopia's play count), keyed however the card's resolver
   * chooses — a generic map, not bespoke fields, per the *cards own their own numbers* convention.
   * Absent until a resolver first writes one; read/written via `getCounter`/`bumpCounter`.
   *
   * NOTE: three transitions deliberately drop `counters` when re-minting a plain instance, harmless
   * today because no work/building/interactive card uses one — but the exact spots a *future* such
   * card would lose its state: `upkeep.ts`'s `discardWorkZone` (work box → discard), `effects.ts`'s
   * `demolish` (tableau building → removed), and `moves.ts`'s `resolveInteraction` (rebuilding
   * `self` for a resume pass).
   */
  counters?: Record<string, number>;
  /**
   * Permanent sticker ids, copied once from the owning `MetaCardInstance` at run setup and never
   * written during a run. `rules/stickers.ts`'s `effectiveGain`/`effectiveCost`/`effectiveCard` are
   * the only readers, and they compose every output path — the declarative default *and* a card's
   * own bespoke `resolve`/`produce` (e.g. Cornucopia) — since all gain routes through `effects.ts`'s
   * `gainResources` fold.
   */
  stickers?: string[];
}

/** A `CardInstance` placed on the board as a staffable — a building in the `tableau` or a Work card
 *  in the `workZone` — plus the population assigned to staff it. */
export interface PlacedCard extends CardInstance {
  /** Population currently assigned to this instance. */
  workers: number;
}

/** A building erected in the tableau: stays in play until demolished, producing its card's
 *  `produces`/`cultureOutput` each round while staffed. */
export type BuildingInstance = PlacedCard;

/** A Work card played onto the board this turn. Transient: produces its card's `effect.gain` only
 *  while staffed, then files to `discard` at end of turn (see `endTurn`). */
export type WorkInstance = PlacedCard;

/** A persistent board hazard, mission-seeded and never in a pile or player-playable, but otherwise a
 *  plain `CardInstance`: its escalation lives in its own `counters`, and each upkeep tick resolves it
 *  through the shared resolver spine (`rules/threats.ts`'s `tickThreats` just calls `resolveCard`, so
 *  the threat card computes its own drain). Shares the run-wide instance-id space. */
export type ThreatInstance = CardInstance;

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
  hand: CardInstance[];
  /** Draw pile. */
  deck: CardInstance[];
  /** Discard pile — the default landing spot once a card is played and resolved (or a Work card's
   *  turn ends, or an `event` auto-resolves). Reshuffled into the deck when it runs dry. Going to
   *  `removed` instead is the exception, driven by the *effect* not the kind — see `removed`. */
  discard: CardInstance[];
  /**
   * Exile pile — cards permanently removed from the deck (never drawn or reshuffled again); distinct
   * from the tableau (an active board entity). A card lands here only when a specific effect files it
   * there, never by its `kind`: a `building` when another card's `effect.destroy` demolishes it, an
   * auto-resolved `event` when its own `effect.remove` is set (currently just Barbarian).
   */
  removed: CardInstance[];
  /** Buildings in play (each a placed `building` card), tracking their assigned workers. */
  tableau: BuildingInstance[];
  /** Work cards played this turn, tracking assigned workers. Transient: not territory-capped,
   *  produces only while staffed, cleared at end of turn (each files to `discard`). */
  workZone: WorkInstance[];
  /** Persistent board hazards, ticking every upkeep — see `rules/threats.ts`. Mission-seeded only;
   *  empty on every run that doesn't use one. */
  threats: ThreatInstance[];
  /** The mission's win/lose condition as a card — seeded once at setup from the mission's
   *  `objectiveCardId` (`rules/objective.ts`'s `seedObjective`). Its card owns the win/lose *logic*
   *  (the `objective` hook, polled by `run/engine.ts`'s `checkEndIf`) and its progress readout;
   *  unlike a threat it never mutates `G`. Absent only on a bare `blankState` (tests/simulator) or a
   *  mission without one. */
  objective?: CardInstance;
  /** Territory available — the tableau may hold at most this many buildings (one slot each);
   *  building cards become unplayable when full. Expanded by territory cards (Conquest, Develop). */
  territory: number;
  /** Culture accumulated so far — a civilization-wide gauge, not a spendable currency. Grows from
   *  operating cultural buildings (Theater) and card effects (Cultural Festival); some cards gate on
   *  a minimum level. */
  culture: number;
  /** How many cards to draw up to at the start of each round. */
  handSize: number;
  /** Which mission this run is playing (looked up in the MISSIONS registry). */
  missionId: string;
  /** Persisted state of the run's RNG stream (`rules/rng.ts`), advanced on each reshuffle. Setup
   *  seeds it from `RunConfig.seed`; from there it's just data, carried by undo/structuredClone. */
  rngState: readonly number[];
  /** A card effect suspended awaiting a player choice, or `null` when none is pending. While set,
   *  `endTurn` no-ops and undo is blocked until it resolves (see `PendingInteraction`). */
  pendingInteraction: PendingInteraction | null;
}

/**
 * A card effect suspended mid-resolution, waiting on a player choice. Plain data on `GameState` so
 * it survives structuredClone/undo: the resolver reveals options, parks them here, and returns; the
 * UI renders a prompt from this; `run/moves.ts`'s `resolveInteraction` re-enters the same card's
 * resolver with the chosen index, completing the effect and clearing this back to `null`.
 * **Non-cancelable** — the reveal has already committed (e.g. Foresight lifts cards off the deck,
 * clearing the undo stack), so the only exit is answering it.
 */
export interface PendingInteraction {
  /** The card whose resolver is suspended — `resolveInteraction` re-enters *this* card's resolver. */
  cardId: string;
  /** The suspended card's own instance id, so the resume pass can reconstruct its `self`. */
  instanceId: number;
  /** Which choice shape this is (drives the UI prompt). Only `'chooseCard'` exists so far. */
  kind: 'chooseCard';
  /** Prompt text for the modal header — authored by the card, so the shell needs no per-card copy. */
  prompt: string;
  /** The revealed card instances to pick from — full instances (not bare ids) so the chosen copy
   *  keeps its identity when it moves into the hand. */
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
    threats: [],
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
 *  `startId`. The shared path turning a plain `string[]` (a `RunConfig.deck`, a mission's injected
 *  cards, a test fixture) into identity-bearing zone contents, so no one re-implements id assignment.
 *  Ids must stay unique within the run: `startId` defaults to 1 for a fresh deck; a later bulk mint
 *  passes `nextInstanceId(G)` to continue past existing ids. */
export function instancesFromCardIds(cardIds: readonly string[], startId = 1): CardInstance[] {
  return cardIds.map((cardId, i) => ({ id: startId + i, cardId }));
}

/** Mint fresh instances from a run's resolved deck list (`rules/deckBuilder.ts`'s `DeckCard`),
 *  carrying each entry's permanent stickers. The sticker-aware counterpart to `instancesFromCardIds`,
 *  used only by `run/setup.ts`: a mission's injected cards have no meta instance behind them, so they
 *  mint through the plain cardId path instead. */
export function instancesFromDeckCards(cards: readonly { cardId: string; stickers?: string[] }[], startId = 1): CardInstance[] {
  return cards.map((c, i) => ({
    id: startId + i,
    cardId: c.cardId,
    ...(c.stickers?.length ? { stickers: c.stickers } : {}),
  }));
}
