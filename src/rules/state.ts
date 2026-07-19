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
   * Per-instance run counters (e.g. a self-scaling card's play count), keyed however the card's resolver
   * chooses — a generic map, not bespoke fields, per the *cards own their own numbers* convention.
   * Absent until a resolver first writes one; read/written via `getCounter`/`bumpCounter`.
   *
   * NOTE: two transitions deliberately drop `counters` when re-minting a plain instance, harmless
   * today because no work/building/interactive card uses one — but the exact spots a *future* such
   * card would lose its state: `upkeep.ts`'s `discardWorkZone` (work box → discard) and `moves.ts`'s
   * `resolveInteraction` (rebuilding `self` for a resume pass).
   */
  counters?: Record<string, number>;
  /**
   * Permanent sticker ids, copied once from the owning `MetaCardInstance` at run setup and never
   * written during a run. `rules/stickers.ts`'s `effectiveGain`/`effectiveCost`/`effectiveCard` are
   * the only readers, and they compose every output path — the declarative default *and* a card's
   * own bespoke `CardEffect.resolve` closure — since all gain routes through `effects.ts`'s
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

/** A building erected in the tableau: stays in play for the rest of the run, producing its card's
 *  `produces` each round while staffed. */
export type BuildingInstance = PlacedCard;

/** A Work card played onto the board this turn. Transient: produces its card's `effect.resources` only
 *  while staffed, then files to `discard` at end of turn (see `endTurn`). */
export type WorkInstance = PlacedCard;

/** A persistent board hazard, mission-seeded and never in a pile or player-playable, but otherwise a
 *  plain `CardInstance`: its escalation lives in its own `counters`, and each upkeep the `endTurn`
 *  broadcast resolves it through the shared resolver spine (`rules/events.ts`'s `dispatchEvent` →
 *  `resolveEndTurn` → `resolveCard`, so the threat card computes its own drain). Shares the run-wide
 *  instance-id space. */
export type ThreatInstance = CardInstance;

/** Why a card was filed to a pile — rides on a `discard` event so a card's `on.discard` handler can
 *  tell a *sacrifice* (a discard-cost cost, which should trigger) from an *end-of-turn recycle* (which
 *  usually shouldn't). Every discard site emits with its reason; the handler decides what to do. */
export type DiscardReason = 'sacrifice' | 'endOfTurn' | 'workFiled' | 'event';

/** Where a `draw` came from — rides on the `draw` event so an `on.draw` handler can tell the routine
 *  round-start refill (`'turnStart'`, `drawUpTo`) from a draw an action/effect *caused* (`'effect'`,
 *  the default: a card-effect draw, a peek card's draw, etc.). An on-draw observer might react only to `'effect'` draws. */
export type DrawSource = 'turnStart' | 'effect';

/** A snapshot of every *value* field a threshold/`resourceChange` handler might watch, taken by the
 *  event-flush boundary *before* a step ran. A handler compares `before` against the live `G` (e.g.
 *  `before.resources.money < 30 && G.resources.money >= 30`) to fire on the exact crossing. */
export interface ValueSnapshot {
  resources: Resources;
}

/**
 * A game event dispatched to card `on` handlers (`rules/events.ts`). Plain data so it rides on `G`
 * and survives cloning/undo. Three flavours ride the same union: **discrete** events name a
 * subject instance (`draw`/`discard`) and are *emitted* at their semantic site as a step runs;
 * **value** events (`resourceChange`) carry a before-snapshot and are *synthesized* by the flush
 * boundary via diff (resource writes have no single choke point); and **broadcast** events name no
 * subject and reach every operating in-play subscriber. Two broadcasts exist: `endTurn` is dispatched
 * *directly* once per round at the upkeep boundary (it's what drives production and threat drains —
 * see `rules/effects.ts`'s `resolveEndTurn` and `rules/upkeep.ts`), while `reshuffle` is *emitted* at
 * the discard→deck fold (`rules/deck.ts`'s `reshuffleIntoDeck`) and drained at the next flush like any
 * leaf-emitted event, letting a card react to the draw pile recycling (there is no default reshuffle
 * behaviour — only cards declaring `on.reshuffle` react). See `rules/events.ts` for how each is
 * dispatched to subscribers.
 */
export type GameEvent =
  | { type: 'draw'; instanceId: number; cardId: string; source: DrawSource }
  | { type: 'discard'; instanceId: number; cardId: string; reason: DiscardReason }
  | { type: 'resourceChange'; before: ValueSnapshot }
  | { type: 'reshuffle' }
  | { type: 'endTurn' };

/** The discriminant keys of `GameEvent` — the set of triggers a `CardDef.on` map may key on. */
export type GameEventType = GameEvent['type'];

/**
 * GameState is the entire serializable run state (the engine's `G`). It must stay
 * JSON-serializable (save/load, undo, and headless simulation depend on it). It lives
 * in `rules/` (the framework-free core) because both the run shell and the mission
 * evaluators reason over it.
 */
export interface GameState {
  round: number;
  /** All eight resource pools in one bundle: the five core (food/production/science/military/money,
   *  spent and produced each round) plus the three strategic — `population` (a pool of workers who
   *  each eat food every round), `territory` (caps the tableau size), and `culture` (a civilization
   *  gauge some cards gate on). Reached as `resources.population` etc. */
  resources: Resources;
  /** Cards in hand. */
  hand: CardInstance[];
  /** Draw pile. */
  deck: CardInstance[];
  /** Discard pile — the default landing spot once a card is played and resolved (or a Work card's
   *  turn ends, or an unplayed `event` auto-resolves at upkeep). Reshuffled into the deck when it
   *  runs dry. Going to `removed` instead is the exception — see `removed`. */
  discard: CardInstance[];
  /**
   * Exile pile — cards permanently removed from the deck (never drawn or reshuffled again); distinct
   * from the tableau (an active board entity). A card lands here only by a **voluntarily played**
   * `event` (paying its cost banishes it *unresolved* — its `upkeep` never fires — versus an unplayed
   * event, whose `upkeep` resolves to `discard` and recurs; see `rules/upkeep.ts`), never by a static
   * kind rule.
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
   *  `objectiveCardId` (`rules/objective.ts`'s `seedObjective`). Its card owns the win *logic*
   *  (the pure-read `objective` predicate); the bus re-derives it into `G.pendingVictory` at every
   *  `flushEvents` boundary (`rules/objective.ts`'s `evaluateObjective`), which `run/engine.ts`'s
   *  `checkEndIf` then reads — so unlike a threat the card never mutates `G`. Absent only on a bare
   *  `blankState` (tests/simulator) or a mission without one. */
  objective?: CardInstance;
  /** How many cards to draw up to at the start of each round. */
  handSize: number;
  /** Which mission this run is playing (looked up in the MISSIONS registry). */
  missionId: string;
  /** Persisted state of the run's RNG stream (`rules/rng.ts`), advanced on each reshuffle. Setup
   *  seeds it from `RunConfig.seed`; from there it's just data, carried by undo/cloning. */
  rngState: readonly number[];
  /** A card effect suspended awaiting a player choice, or `null` when none is pending. While set,
   *  `endTurn` no-ops and undo is blocked until it resolves (see `PendingInteraction`). */
  pendingInteraction: PendingInteraction | null;
  /**
   * The event bus's transient queue (`rules/events.ts`). Sites *emit* by pushing here as a step runs
   * (a cheap append, safe mid-mutation — never dispatch from a mutation site); the step boundary then
   * *flushes* it, draining every event to its `on` handlers. **Invariant: empty (`[]`) in every
   * committed / undo-visible state** — every `flushEvents` leaves it drained, so clone/undo
   * only ever snapshot `[]`. It lives on `G` (not a side channel) so it's plain serializable data
   * like `pendingInteraction`, but nothing lasting is ever stored in it. */
  events: GameEvent[];
  /**
   * A threat-declared defeat, or `null`/absent when none. Re-derived from every seeded threat's own
   * `defeat` predicate at every `flushEvents` boundary (`rules/threats.ts`'s `evaluateDefeat`), the
   * loss counterpart to `pendingVictory` below — `run/engine.ts`'s `checkEndIf` only *reads* it, never
   * writes it. Set-or-clear (never sticky), same as `pendingVictory`: a threat's condition can dip and
   * recover within one broadcast, so the flag must not survive that. The counterpart to a threat that
   * can only drain a resource into core collapse instead. */
  pendingDefeat?: { reason: string } | null;
  /**
   * The bus-written win flag — the victory counterpart to `pendingDefeat`. Re-derived from the
   * objective card's own `objective` predicate at every `flushEvents` boundary
   * (`rules/objective.ts`'s `evaluateObjective`), so it's fresh before every `checkEndIf`; the engine
   * only *reads* it (`run/engine.ts`), never writes it. Set-or-clear (never sticky) — a verdict can
   * flip back to false within one flush. `false`/absent when the objective is unmet or unseeded. */
  pendingVictory?: boolean;
  /**
   * How many times the discard pile has folded back into an empty draw pile this run — bumped once
   * per reshuffle by `rules/deck.ts`'s shared `reshuffleIntoDeck` (used by `drawCard`). Pure UI cue:
   * no rule reads it. `run/GameContext.tsx`'s Board diffs it against its last-seen value to fire the
   * deck's shuffle animation, since a length-diff can't tell a reshuffle apart from a card effect
   * that only grows/shrinks the deck (e.g. `returnToDeck`).
   */
  reshuffleCount: number;
  /**
   * How many times a move has revealed hidden draw-pile information *without changing the deck* this
   * run — bumped by `rules/deck.ts`'s `peekTop`. A pure signal no rule reads: `run/GameContext.tsx`'s
   * undo reducer diffs it to treat a peek move as a boundary (deck-diff alone can't see a pure read),
   * so the stack clears and the revealed knowledge can't be undone away for a cost refund.
   */
  revealCount: number;
}

/**
 * A card effect suspended mid-resolution, waiting on a player choice. Plain data on `GameState` so
 * it survives cloning/undo: the resolver reveals options, parks them here, and returns; the
 * UI renders a prompt from this; `run/moves.ts`'s `resolveInteraction` re-enters the same card's
 * resolver with the chosen index, completing the effect and clearing this back to `null`.
 * **Non-cancelable** — the reveal has already committed (a peek bumps `revealCount`, clearing the undo
 * stack), so the only exit is resolving it.
 */
export interface PendingInteraction {
  /** The card whose resolver is suspended — `resolveInteraction` re-enters *this* card's resolver. */
  cardId: string;
  /** The suspended card's own instance id, so the resume pass can reconstruct its `self`. */
  instanceId: number;
  /** Which choice shape this is (drives the UI prompt): `'chooseCard'` picks one of the `options`;
   *  `'reveal'` is a look-only acknowledgement (a peek — the player reads the options and dismisses,
   *  choosing nothing). */
  kind: 'chooseCard' | 'reveal';
  /** Prompt text for the modal header — authored by the card, so the shell needs no per-card copy. */
  prompt: string;
  /** The revealed card instances to pick from (or, for `'reveal'`, simply to read) — full instances
   *  (not bare ids) so the chosen copy keeps its identity when it moves into the hand. */
  options: CardInstance[];
  /** How many to pick: 1 for `'chooseCard'`, 0 for a look-only `'reveal'`. */
  pick: number;
}

/** A zeroed baseline state — used by setup, tests, and (later) the simulator. */
export function blankState(missionId: string): GameState {
  return {
    round: 0,
    resources: { ...emptyResources(), territory: 6 },
    hand: [],
    deck: [],
    discard: [],
    removed: [],
    tableau: [],
    workZone: [],
    threats: [],
    handSize: 4,
    missionId,
    rngState: seededRng('blank').getState(),
    pendingInteraction: null,
    events: [],
    pendingDefeat: null,
    pendingVictory: false,
    reshuffleCount: 0,
    revealCount: 0,
  };
}

/**
 * A deep copy of a run state — the snapshot primitive every move, undo entry, and projection is built
 * on (`run/engine.ts`, `rules/upkeep.ts`'s `projectNextTurn`).
 *
 * `GameState` is plain serializable data by construction — nested objects, arrays, and primitives, with
 * no Maps/Sets/Dates/cycles and no functions (a card's behaviour lives on its `CardDef`, never on an
 * instance). So this recursive walk is exhaustive, and it is ~12× faster than `structuredClone`, whose
 * generality none of the state uses. `state.test.ts` pins the no-shared-references guarantee.
 */
export function cloneState(G: GameState): GameState {
  return deepClone(G);
}

function deepClone<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = deepClone(v[i]);
    return out as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const k in v) out[k] = deepClone((v as Record<string, unknown>)[k]);
  return out as T;
}

/**
 * A card instance's **content key** — its game-relevant identity *minus its instance id*: the cardId
 * plus its per-copy state (`counters`, `stickers`), both normalized to a stable order. Two instances
 * with an equal content key are interchangeable in every rule (the engine never branches on an id's
 * numeric value). It's the id-independent identity behind two order-independence guarantees:
 * `deck.ts`'s reshuffle canonicalizes the discard by this key so a reshuffle is a pure function of the
 * discard *multiset* (not its order), and the simulator's transposition key (`sim/oracleKey.ts`) hashes
 * zones by it. Kept here in the core because it's about a `CardInstance`'s identity, not a sim concern.
 */
export function contentKey(inst: CardInstance): string {
  const counters = inst.counters
    ? Object.keys(inst.counters)
        .sort()
        .map((k) => `${k}=${inst.counters![k]}`)
        .join(',')
    : '';
  const stickers = inst.stickers?.length ? [...inst.stickers].sort().join(',') : '';
  return `${inst.cardId}#${counters}#${stickers}`;
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
