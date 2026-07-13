import { addResources, scaleResources, type Resources } from './resources';
import { CARDS } from '../content/cards';
import type { CardInstance, GameEvent, GameState, PendingInteraction } from './state';
import { effectiveGain } from './stickers';
import { findStaffable, producingUnits } from './population';

/**
 * A card's "what happens" descriptor, carried in four timing slots on `CardDef`: `effect` (on play),
 * `produces` (each round while staffed), `upkeep` (each round at the upkeep boundary), and each `on.*`
 * handler. The declarative `resources` and a `resolve` closure *compose* — both apply, resources first.
 * Signs are neutral: a negative resource entry drains, a positive one grants — any of the 8 pools.
 */
export interface CardEffect {
  /** Signed resource delta, applied *before* any `resolve` closure. Applied once on play/on-handler;
   *  scaled per staffed worker in `produces`. Reaches `G` only through `gainResources`, so a sticker
   *  folds over it. */
  resources?: Partial<Resources>;
  /** The "too specific" escape hatch: a bespoke closure for behaviour the declarative fields can't
   *  express (self-reference, per-copy state, targeting, interaction). Runs *after* the declarative
   *  `resources` (composing with it, not replacing); it must add its own output through `gainResources`
   *  (so stickers still fold) and may mutate `ctx.G`. In `produces` it owns its own per-worker scaling. */
  resolve?: Resolver;
}

/**
 * The context a resolver runs against — the seam that makes an effect aware of *who* is resolving and
 * *what* they target, which a bare `(G, effect)` signature can't express. Plain data + `G`: nothing is
 * stored in `GameState`, so structuredClone undo and the projection HUD stay untouched.
 */
export interface EffectContext {
  G: GameState;
  /** The exact card instance resolving. A resolver reads `self.cardId` for identity and reads/writes
   *  `self.counters` (via `getCounter`/`bumpCounter`) for per-copy state riding with this physical card.
   *  On a resume pass (`resolveInteraction`) it's reconstructed from the parked `PendingInteraction`. */
  self: CardInstance;
  /**
   * The player's answer to a suspended interaction: `undefined` on the first pass (the resolver reveals
   * options and parks a `PendingInteraction`), the chosen option index on resume. Branch on
   * `answer === undefined`, never `!answer` — index `0` is a valid answer.
   */
  answer?: number;
  /**
   * The event this resolution reacts to, set only while the bus (`rules/events.ts`) runs an `on`
   * handler — read for the trigger's detail. Absent on a normal play/production resolution.
   */
  event?: GameEvent;
}

/** A bespoke effect closure: mutate `ctx.G` given the resolving card and its target. */
export type Resolver = (ctx: EffectContext) => void;

/** The ONE path a card's output reaches `G`: fold this copy's stickers over `base`, then add. Every
 *  gain routes through here, so nothing reaches `G` unstickered. No-op on an absent/empty bag. */
export function gainResources(ctx: EffectContext, base: Partial<Resources> | undefined): void {
  const g = effectiveGain(base, ctx.self);
  if (g) addResources(ctx.G.resources, g);
}

/**
 * Suspend the resolving card into a player choice — the one place a resolver opens a
 * `pendingInteraction`. Builds it from `ctx.self` so `moves.ts`'s `resolveInteraction` can reconstruct
 * `self` and re-enter this resolver with `ctx.answer` set. Non-cancelable, so only call it once the
 * reveal has committed (e.g. after `peekTop` lifted the cards).
 */
export function suspendChoice(
  ctx: EffectContext,
  choice: Omit<PendingInteraction, 'cardId' | 'instanceId'>,
): void {
  ctx.G.pendingInteraction = { cardId: ctx.self.cardId, instanceId: ctx.self.id, ...choice };
}

/**
 * Run a `CardEffect` against `ctx` — the single declarative-or-bespoke runner shared by play, `upkeep`,
 * and the `on.*` handlers. The declarative `resources` delta applies first (through `gainResources`),
 * then any `resolve` closure runs — the two *compose*, so a closure sees the declarative gain already
 * folded into `G`. Either field alone is the common case; both is a base gain plus bespoke logic.
 * Production is the one slot that does NOT run through this — it scales per worker (`resolveProduction`).
 */
export function runEffect(ctx: EffectContext, effect?: CardEffect): void {
  gainResources(ctx, effect?.resources);
  effect?.resolve?.(ctx);
}

/** Resolve a card's play-time `effect` through the single runner — shared by `playCard` and
 *  `resolveHandEvents`. */
export function resolveCard(ctx: EffectContext): void {
  runEffect(ctx, CARDS[ctx.self.cardId].effect);
}

/**
 * Resolve one operating (staffed) instance's per-round production from its `produces`. Deliberately a
 * *separate* path from `runEffect` because it scales per worker: the declarative `produces.resources`
 * are per-worker amounts multiplied by the instance's `producingUnits` (1 for a self-sufficient card),
 * then any `produces.resolve` runs and *composes* (owning its own scaling), mirroring `runEffect`'s
 * gain-then-closure order. `ctx.self` carries no `workers`, so the live instance is resolved from its
 * zone. The scaled bundle rides `gainResources`, so a sticker applies.
 */
export function resolveProduction(ctx: EffectContext): void {
  const produces = CARDS[ctx.self.cardId].produces;
  const s = findStaffable(ctx.G, ctx.self.id);
  const units = s ? producingUnits(s) : 1;
  gainResources(ctx, scaleResources(produces?.resources ?? {}, units));
  produces?.resolve?.(ctx);
}

/**
 * Resolve a card's recurring `upkeep` through the single runner, run at the upkeep boundary: a threat's
 * drain, an unplayed event's disaster (via `resolveHandEvents`), or an operating staffable's maintenance
 * (via `resolveEndTurn`, composing with its per-worker `produces`). Unlike `resolveProduction` it does
 * *not* scale per worker — upkeep is a flat recurring cost — so it goes straight through `runEffect`.
 */
export function resolveUpkeep(ctx: EffectContext): void {
  runEffect(ctx, CARDS[ctx.self.cardId].upkeep);
}

/**
 * Run one card's reaction to an event: the `CardEffect` at `CARDS[self.cardId].on?.[event.type]`,
 * through `runEffect`. No-op if the card has no handler for this type (the dispatcher pre-filters, but
 * this stays safe alone). `ctx.event` is guaranteed set by the caller (`events.ts`'s `dispatchEvent`).
 */
export function runEventHandler(ctx: EffectContext): void {
  if (!ctx.event) return;
  runEffect(ctx, CARDS[ctx.self.cardId]?.on?.[ctx.event.type]);
}

/**
 * Resolve one subscriber's per-round `endTurn` behaviour. Its `on.endTurn` handler, its production
 * (`resolveProduction`), and its `upkeep` drain (`resolveUpkeep`) all run and *compose* — each a no-op
 * when its slot is empty — so one card may combine any of the three (e.g. a staffed building that also
 * pays maintenance each round). The dispatcher (`events.ts`) gates which subscribers reach here, so this
 * never re-checks staffing.
 *
 * NOTE: every slot is handed the `endTurn` `ctx.event`, which production/upkeep ignore today. A future
 * bespoke `produces.resolve`/`upkeep.resolve` must not start branching on it — it fires on
 * play/production too, where the field is absent.
 */
export function resolveEndTurn(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  if (card.on?.endTurn) runEffect(ctx, card.on.endTurn);
  resolveProduction(ctx);
  resolveUpkeep(ctx);
}
