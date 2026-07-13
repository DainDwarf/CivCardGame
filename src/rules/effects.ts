import { addResources, scaleResources, type Resources } from './resources';
import { CARDS, isStaffable } from '../content/cards';
import type { CardInstance, GameEvent, GameState, PendingInteraction } from './state';
import { emitEvent } from './events';
import { effectiveGain } from './stickers';
import { findStaffable, producingUnits } from './population';

/**
 * A card's "what happens" descriptor, carried in four timing slots on `CardDef`: `effect` (on play),
 * `produces` (each round while staffed), `upkeep` (each round at the upkeep boundary), and each `on.*`
 * handler. A `resolve` closure, when present, *replaces* the declarative fields rather than composing.
 * Signs are neutral: a negative resource entry drains, a positive one grants — any of the 8 pools.
 */
export interface CardEffect {
  /** Signed resource delta. Applied once on play/on-handler; scaled per staffed worker in `produces`.
   *  Reaches `G` only through `gainResources`, so a sticker folds over it. */
  resources?: Partial<Resources>;
  /** Demolish a player-chosen tableau building (its card files to `removed`, freeing slot + workers).
   *  Target threaded as `EffectContext.target`; validated by `playCard`, applied inside the resolver. */
  destroy?: true;
  /** The "too specific" escape hatch: a bespoke closure for behaviour the declarative fields can't
   *  express (self-reference, per-copy state, targeting, interaction). *Replaces* the declarative fields;
   *  it must add its own output through `gainResources` (so stickers still fold) and may mutate `ctx.G`.
   *  In `produces` it owns its own per-worker scaling. */
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
  /** A target instance id the UI pre-selected before the move fired (e.g. the building a Destroy card
   *  demolishes), threaded here rather than as a bespoke move parameter. */
  target?: number;
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

/** Demolish a tableau building by instance id, filing its card to `removed` (frees the slot and its
 *  workers). No-op if the id is absent or not in the tableau. */
function demolish(G: GameState, instanceId?: number): void {
  if (instanceId === undefined) return;
  const idx = G.tableau.findIndex((b) => b.id === instanceId);
  if (idx === -1) return;
  const [building] = G.tableau.splice(idx, 1);
  // Keep its id so the removed pile stays identity-consistent with every other zone (its
  // staffing-only `workers` is dropped).
  G.removed.push({ id: building.id, cardId: building.cardId });
  emitEvent(G, { type: 'discard', instanceId: building.id, cardId: building.cardId, reason: 'demolish' });
}

/**
 * Run a `CardEffect` against `ctx` — the single declarative-or-bespoke runner shared by play, `upkeep`,
 * and the `on.*` handlers. A `resolve` closure replaces the declarative fields; otherwise the signed
 * `resources` delta routes through `gainResources` and `destroy` demolishes `ctx.target`. Production is
 * the one slot that does NOT run through this — it scales per worker (`resolveProduction`).
 */
export function runEffect(ctx: EffectContext, effect?: CardEffect): void {
  if (effect?.resolve) return effect.resolve(ctx);
  gainResources(ctx, effect?.resources);
  if (effect?.destroy) demolish(ctx.G, ctx.target);
}

/** Resolve a card's play-time `effect` through the single runner — shared by `playCard` and
 *  `resolveHandEvents`. */
export function resolveCard(ctx: EffectContext): void {
  runEffect(ctx, CARDS[ctx.self.cardId].effect);
}

/**
 * Resolve one operating (staffed) instance's per-round production from its `produces`. Deliberately a
 * *separate* path from `runEffect` because it scales per worker: a bespoke `produces.resolve` owns its
 * own scaling, otherwise the declarative `produces.resources` are per-worker amounts multiplied by the
 * instance's `producingUnits` (1 for a self-sufficient card). `ctx.self` carries no `workers`, so the
 * live instance is resolved from its zone. The scaled bundle rides `gainResources`, so a sticker applies.
 */
export function resolveProduction(ctx: EffectContext): void {
  const produces = CARDS[ctx.self.cardId].produces;
  if (produces?.resolve) return produces.resolve(ctx);
  const s = findStaffable(ctx.G, ctx.self.id);
  const units = s ? producingUnits(s) : 1;
  gainResources(ctx, scaleResources(produces?.resources ?? {}, units));
}

/**
 * Resolve a card's recurring `upkeep` through the single runner — the `event`/`threat` counterpart to
 * `resolveCard`, run at the upkeep boundary. Unlike `resolveProduction` it does *not* scale per worker
 * (a hazard isn't staffed), so it goes straight through `runEffect`.
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
 * Resolve one subscriber's reaction to the per-round `endTurn` broadcast: an explicit `on.endTurn`
 * handler wins; otherwise a staffable produces (`resolveProduction`) and anything else — a threats-zone
 * entry — drains (`resolveUpkeep`). The dispatcher (`events.ts`) already gates which subscribers reach
 * here, so this never re-checks staffing.
 *
 * NOTE: this forwards the `endTurn` `ctx.event` into `resolveProduction`/`resolveUpkeep`, which ignore
 * it today. A future bespoke `produces.resolve`/`upkeep.resolve` must not start branching on it — it
 * fires on play/production too, where the field is absent.
 */
export function resolveEndTurn(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  if (card.on?.endTurn) return void runEffect(ctx, card.on.endTurn);
  if (isStaffable(card)) resolveProduction(ctx);
  else resolveUpkeep(ctx);
}
