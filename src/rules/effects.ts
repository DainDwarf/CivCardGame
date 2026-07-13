import { addResources, scaleResources, type Resources } from './resources';
import { CARDS, isStaffable } from '../content/cards';
import type { CardInstance, GameEvent, GameState, PendingInteraction } from './state';
import { emitEvent } from './events';
import { effectiveGain } from './stickers';
import { findStaffable, producingUnits } from './population';

/**
 * A card's effect: the one "what happens" descriptor a card carries, in three timing slots on
 * `CardDef` — `effect` (on play, or end of turn for an unplayed event / a declarative threat drain),
 * `produces` (each round while a staffable is staffed), and each `on.*` handler (a triggered event
 * reaction). Every slot is the *same* shape: the declarative fields for the common case, and a
 * `resolve` closure escape hatch for behaviour the fields can't express. `resolve` *replaces* the
 * declarative fields when present (it doesn't compose). Nothing here is inherently good or bad: a
 * negative resource entry drains, a positive one grants — including the strategic pools.
 */
export interface CardEffect {
  /** Signed resource delta. On play/on-handler it applies once; in `produces` it scales per staffed
   *  worker (`resolveProduction`). Reaches `G` only through `gainResources`, so a sticker folds over it. */
  resources?: Partial<Resources>;
  /** Demolish a player-chosen tableau building, freeing its slot and returning its workers; the
   *  demolished card files to `removed`. The target is chosen by the UI and threaded as
   *  `EffectContext.target` (validated up front by `playCard`, applied inside the resolver).
   *  Play/on-handler only — `resolveProduction` never reads it. */
  destroy?: true;
  /** The "this is too specific" escape hatch: a bespoke closure for behaviour the declarative fields
   *  can't express (self-reference, per-copy state, targeting, interaction). When present it *replaces*
   *  the declarative fields — it must add its own output through `gainResources` (so stickers still
   *  fold) and may mutate `ctx.G`. Lives on the static catalogue, never in `GameState` — see
   *  `EffectContext`. In `produces` a bespoke resolver owns its own per-worker scaling. */
  resolve?: Resolver;
}

/**
 * The context a card's resolver runs against — the seam that makes effects aware of *who* is
 * resolving and *what* they target, which a bare `(G, effect)` signature cannot express.
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

/** A bespoke effect closure: mutate `ctx.G` given the resolving card and its target. Lives on a
 *  `CardEffect.resolve` (the escape hatch), never in `GameState` — see `EffectContext`. */
export type Resolver = (ctx: EffectContext) => void;

/** The ONE path a card's output reaches G: fold this copy's output stickers over `base`, then add.
 *  Every gain — declarative (`runEffect`), production (`resolveProduction`), and a bespoke
 *  `resolve` closure — routes through here, so no output can reach G unstickered. No-op on an
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
 * Run a `CardEffect` against `ctx` — the single declarative-or-bespoke runner shared by play and the
 * `on.*` handlers. A `resolve` closure, if present, *replaces* the declarative fields (it doesn't
 * compose — a bespoke effect owns its whole behaviour); otherwise the signed `resources` delta routes
 * through `gainResources` (the shared sticker fold) and `destroy` demolishes `ctx.target`. Where the
 * *played* card files afterwards is a separate caller-owned lifecycle decision (see
 * `resolveHandEvents`), not a mutation handled here. Production is the one slot that does NOT run
 * through this — it scales per worker, see `resolveProduction`.
 */
export function runEffect(ctx: EffectContext, effect?: CardEffect): void {
  if (effect?.resolve) return effect.resolve(ctx);
  gainResources(ctx, effect?.resources);
  if (effect?.destroy) demolish(ctx.G, ctx.target);
}

/**
 * Resolve a card's play-time effect through the single runner: the one place "the card's effect"
 * runs — shared by `playCard` and `resolveHandEvents`.
 */
export function resolveCard(ctx: EffectContext): void {
  runEffect(ctx, CARDS[ctx.self.cardId].effect);
}

/**
 * Resolve one operating (staffed) instance's per-round production from its `produces` CardEffect.
 * Production's counterpart to `resolveCard` — and deliberately a *separate* path from `runEffect`,
 * because it scales per worker where play does not. It reads `produces` alone (never `effect`), so a
 * card's per-round output and its one-shot play effect can never be the same field. A bespoke
 * `produces.resolve` wins and owns its own scaling; otherwise the declarative `produces.resources`
 * values are *per-worker unit* amounts, multiplied by the operating instance's `producingUnits` (its
 * staffed count, or 1 for a self-sufficient card). `resources` may touch any of the 8 pools (core or
 * strategic — e.g. a culture-producing wonder). `destroy` is play/on-only and is ignored here.
 * `ctx.self` is a bare `CardInstance` carrying no `workers`, so the live instance is resolved from its
 * zone. A capacity-1 producer yields `×1` — identical to a flat output. The whole scaled bundle rides
 * the one `gainResources` fold, so a sticker applies.
 */
export function resolveProduction(ctx: EffectContext): void {
  const produces = CARDS[ctx.self.cardId].produces;
  if (produces?.resolve) return produces.resolve(ctx);
  const s = findStaffable(ctx.G, ctx.self.id);
  const units = s ? producingUnits(s) : 1;
  gainResources(ctx, scaleResources(produces?.resources ?? {}, units));
}

/**
 * Run one card's reaction to an event: the `CardEffect` at `CARDS[self.cardId].on?.[event.type]`,
 * through the shared `runEffect`. The event-bus counterpart to `resolveCard`/`resolveProduction` — an
 * `on` handler is just a `CardEffect` (declarative for the common case, a `resolve` closure — which
 * gets `ctx.event` — for the rest), so its gains still fold through stickers. No-op if the card has no
 * handler for this event type (the dispatcher pre-filters to subscribers, but this stays safe on its
 * own). `ctx.event` is guaranteed set by the caller (`rules/events.ts`'s `dispatchEvent`).
 */
export function runEventHandler(ctx: EffectContext): void {
  if (!ctx.event) return;
  runEffect(ctx, CARDS[ctx.self.cardId]?.on?.[ctx.event.type]);
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
 * ignore it. Harmless *only* while no bespoke `produces.resolve`/`effect.resolve` reads `ctx.event`; a
 * future one must not start branching on it (it fires on play/production too, where the field is absent).
 */
export function resolveEndTurn(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  if (card.on?.endTurn) return void runEffect(ctx, card.on.endTurn);
  if (isStaffable(card)) resolveProduction(ctx);
  else resolveCard(ctx);
}
