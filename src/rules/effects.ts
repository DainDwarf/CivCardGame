import { addResources, scaleResources, type Resources } from './resources';
import { drawCard } from './deck';
import { CARDS, isStaffable } from '../content/cards';
import type { CardDef } from '../content/cards';
import type { CardInstance, GameEvent, GameState, PendingInteraction } from './state';
import { emitEvent } from './events';
import { effectiveGain } from './stickers';
import { findStaffable, producingUnits } from './population';

/**
 * A card's effect: a sign- and timing-neutral bundle of state changes. It describes *what* changes, not *when* — the resolver that runs it decides the timing (on play, at end of turn for an unplayed event, each round for a declarative threat drain, or on a triggered `on.*` handler). The one timing it is *never* used for is a staffable's per-round production: that is the separate `produces` field, read only by `defaultProduce`, so ongoing output and one-shot effect can never be the same field. Nothing in it is inherently good or bad: a negative resource entry drains, a positive one grants — including the strategic pools.
 */
export interface CardEffect {
  /** Signed resource delta applied immediately. */
  resources?: Partial<Resources>;
  /** Cards drawn immediately. */
  draw?: number;
  /** Demolish a player-chosen tableau building, freeing its slot and returning its workers; the
   *  demolished card files to `removed`. The target is chosen by the UI and threaded as
   *  `EffectContext.target` (validated up front by `playCard`, applied inside the resolver). */
  destroy?: true;
}

/** Applies the non-resource fields — currently only `draw`. The `resources` delta is deliberately
 *  excluded: it reaches `G` only through `gainResources`, the one path a sticker's `effectiveGain`
 *  folds over it. */
export function applyEffect(G: GameState, effect?: CardEffect): void {
  if (!effect?.draw) return;
  for (let i = 0; i < effect.draw; i++) drawCard(G);
}

/**
 * The context a card's resolver runs against — the seam that makes effects aware of *who* is
 * resolving and *what* they target, which the bare `applyEffect(G, effect)` cannot express.
 * Deliberately plain data + `G`: nothing here is stored in `GameState`, so the serializable-state
 * discipline (structuredClone undo, the projection HUD) is untouched.
 */
export interface EffectContext {
  G: GameState;
  /** The exact card instance doing the resolving (`{ id, cardId, counters? }`). A resolver reads
   *  `self.cardId` for its identity and reads/writes `self.counters` (via `getCounter`/`bumpCounter`)
   *  for per-copy state that rides with this physical card — e.g. a self-scaling card's growing gain. On a
   *  resume pass (`resolveInteraction`) this is reconstructed from the parked `PendingInteraction`. */
  self: CardInstance;
  /** A pre-selected target instance id chosen by the UI before the move fired (e.g. the building a
   *  Destroy card demolishes), threaded here instead of as a bespoke move parameter. */
  target?: number;
  /**
   * The player's answer to a suspended interaction, `undefined` on the *first* pass (when the
   * resolver reveals options and parks a `PendingInteraction`) and the chosen option index on
   * *resume* (via `resolveInteraction`). Branch on `answer === undefined`, never `!answer` — index
   * `0` is a valid answer.
   */
  answer?: number;
  /**
   * The event this resolution is reacting to, set only when the bus (`rules/events.ts`) is running a
   * card's `on` handler — a handler reads it for the trigger's detail (which card was discarded and
   * why, the before-snapshot for a threshold). Absent on a normal play/production resolution.
   */
  event?: GameEvent;
}

/** A card's play-time behavior: mutate `ctx.G` given the resolving card and its target. Lives on the
 *  static catalogue (`CardDef.resolve`), never in `GameState` — see `EffectContext`. */
export type Resolver = (ctx: EffectContext) => void;

/** The ONE path a card's output reaches G: fold this copy's output stickers over `base`, then add.
 *  Every gain — declarative (`specToResolver`), production (`defaultProduce`), and bespoke
 *  `resolve`/`produce` — routes through here, so no output can reach G unstickered. No-op on an
 *  absent/empty bag. A bespoke resolver must add output through this, never `addResources` directly. */
export function gainResources(ctx: EffectContext, base: Partial<Resources> | undefined): void {
  const g = effectiveGain(base, ctx.self);
  if (g) addResources(ctx.G.resources, g);
}

/**
 * Suspend the resolving card into a player choice — the one place a resolver opens a
 * `pendingInteraction` (the interaction seam of the resolver spine's "two-way street"). Builds it from
 * `ctx.self` (the suspended card's id/cardId, so `moves.ts`'s `resolveInteraction` can reconstruct
 * `self` and re-enter this resolver) plus the passed choice shape. The resolver returns right after;
 * it re-runs with `ctx.answer` set to the chosen index. See `PendingInteraction` — non-cancelable, so
 * a resolver must only call this once the reveal has committed (e.g. after `peekTop` lifted the cards).
 */
export function suspendChoice(
  ctx: EffectContext,
  choice: Omit<PendingInteraction, 'cardId' | 'instanceId'>,
): void {
  ctx.G.pendingInteraction = { cardId: ctx.self.cardId, instanceId: ctx.self.id, ...choice };
}

/** Demolish a tableau building by instance id, filing its card to `removed` (frees the slot and its
 *  workers). No-op if the id is absent or not in the tableau. */
function demolish(G: GameState, instanceId?: number): void {
  if (instanceId === undefined) return;
  const idx = G.tableau.findIndex((b) => b.id === instanceId);
  if (idx === -1) return;
  const [building] = G.tableau.splice(idx, 1);
  // File the demolished card to removed as a plain card instance (its staffing-only `workers` is
  // dropped); keep its id so the removed pile stays identity-consistent with every other zone.
  G.removed.push({ id: building.id, cardId: building.cardId });
  emitEvent(G, { type: 'discard', instanceId: building.id, cardId: building.cardId, reason: 'demolish' });
}

/**
 * Build a resolver from a declarative `CardEffect` — the default for the ~90% of cards fully
 * described by the data bag. Routes the signed `resources` delta through `gainResources` (the shared
 * sticker fold), everything else through `applyEffect`, plus the `destroy` mutation (folded in so all
 * effect behavior resolves through one path). `remove` is *not* handled here: it decides where the
 * played card files afterwards (a caller-owned lifecycle decision, see `resolveHandEvents`), not a
 * mutation of `G`.
 */
export function specToResolver(effect?: CardEffect): Resolver {
  return (ctx) => {
    gainResources(ctx, effect?.resources);
    applyEffect(ctx.G, effect);
    if (effect?.destroy) demolish(ctx.G, ctx.target);
  };
}

/**
 * Resolve a card's effect through the single resolver path: its own `resolve` if it owns one,
 * otherwise the declarative default from its `effect`. The one place "the card's effect" runs —
 * shared by `playCard` and `resolveHandEvents`.
 */
export function resolveCard(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  const resolver = card.resolve ?? specToResolver(card.effect);
  resolver(ctx);
}

/**
 * Build a production resolver from a card's declarative per-round fields — `produces` (+ the explicit
 * `cultureOutput`), and *only* those. Production reads `produces` alone: `effect` is the on-play (and
 * end-of-turn event) timing and is never consulted here, so the two slots stay strictly separate —
 * a card's per-round output and its one-shot effect can never be the same field. `produces` is
 * `Partial<CoreResources>` by type, so a strategic per-round gain (territory/population as a `work`
 * card) isn't expressible yet; that awaits the production-path refactor.
 *
 * Output scales per staffed worker: the declarative `produces`/`cultureOutput` are *per-worker unit*
 * values, multiplied by the operating instance's `producingUnits` (its staffed count, or 1 for a
 * self-sufficient card). `ctx.self` is a bare `CardInstance` carrying no `workers`, so the live
 * instance is resolved from its zone. A capacity-1 producer yields `×1` — identical to a flat output.
 * Culture output rides the same `gainResources` fold as the core part (a culture sticker would apply).
 */
function defaultProduce(card: CardDef): Resolver {
  return (ctx) => {
    const s = findStaffable(ctx.G, ctx.self.id);
    const units = s ? producingUnits(s) : 1;
    const produced = scaleResources(card.produces ?? {}, units);
    if (card.cultureOutput) produced.culture = card.cultureOutput * units;
    gainResources(ctx, produced);
  };
}

/**
 * Resolve one operating (staffed) instance's per-round production: `card.produce` if it owns one,
 * otherwise the declarative default above. Production's counterpart to `resolveCard` — the caller
 * only asks the card to produce, never reading `produces`/`cultureOutput` itself.
 */
export function resolveProduction(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  const resolver = card.produce ?? defaultProduce(card);
  resolver(ctx);
}

/**
 * Run one card's reaction to an event: dispatch `CARDS[self.cardId].on?.[event.type]` on `ctx`. The
 * event-bus counterpart to `resolveCard`/`resolveProduction` — the single place an `on` handler runs,
 * so a handler is authored like any bespoke resolver (mutate `ctx.G`, add output through
 * `gainResources` so stickers still fold). No-op if the card has no handler for this event type (the
 * dispatcher pre-filters to subscribers, but this stays safe on its own). `ctx.event` is guaranteed
 * set by the caller (`rules/events.ts`'s `dispatchEvent`).
 */
export function runEventHandler(ctx: EffectContext): void {
  if (!ctx.event) return;
  CARDS[ctx.self.cardId]?.on?.[ctx.event.type]?.(ctx);
}

/**
 * Resolve one subscriber's reaction to the per-round `endTurn` broadcast — the *default* per-round
 * behaviour a card runs at the upkeep boundary: an explicit `on.endTurn` handler wins; otherwise a
 * producer (a staffable card — building/wonder/work, from the tableau/workZone) produces via
 * `resolveProduction`, and anything else the dispatcher hands us — a threats-zone entry — ticks its own drain via
 * `resolveCard`. The **zone the dispatcher walked**, not the card's kind, decides which spine runs
 * (exactly as the retired `tickThreats` ran `resolveCard` over `G.threats` kind-agnostically). The
 * dispatcher (`rules/events.ts`) already gates which subscribers reach here (operating tableau/work,
 * all threats), so this never re-checks staffing. Mirrors the codebase's existing dual spine —
 * `resolveCard` (play) vs `resolveProduction` (production).
 *
 * NOTE: this forwards the `endTurn` `ctx.event` into `resolveProduction`/`resolveCard`, which today
 * ignore it. Harmless *only* while no bespoke `produce`/`resolve` reads `ctx.event`; a future one
 * must not start branching on it (it fires on play/production too, where the field is absent).
 */
export function resolveEndTurn(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  if (card.on?.endTurn) return void card.on.endTurn(ctx);
  if (isStaffable(card)) resolveProduction(ctx);
  else resolveCard(ctx);
}
