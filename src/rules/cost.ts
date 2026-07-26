import { canAfford, subtractResources, type Resources } from './resources';
import { cultureLevel } from './culture';
import { effectiveCard, effectiveCost } from './stickers';
import type { CardDef } from '../content/cards';
import type { CardInstance, GameState } from './state';

/**
 * Structured reason a card cannot currently be played — one variant per gate `playCard` enforces,
 * checked in the same priority order. `null` means the card is playable. Kept as data (not a
 * formatted string) so the shell can render its own wording/icons while `playCard` and the UI's
 * dimming/rejection messaging share one source of truth.
 */
export type UnplayableReason =
  | { kind: 'cost'; missing: Partial<Resources> }
  | { kind: 'cultureLevel'; required: number }
  | { kind: 'territory' }
  | { kind: 'emptyDrawPile' }
  | { kind: 'discardEmpty' };

/** What a cost closure may read: the live state and the exact copy being priced. Mirrors
 *  `effects.ts`'s `EffectContext`. */
export interface CostContext {
  G: GameState;
  self: CardInstance;
}

/**
 * Everything it takes to play a card, as one descriptor — the cost counterpart of `CardEffect`:
 * declarative fields for the common case plus a closure escape hatch that composes with them.
 *
 * The declarative fields are a **closed vocabulary of payable things**, deliberately. A cost has to
 * be introspectable, not merely executable: `costReason` reports *what is missing*, `CardFace`
 * renders it, and `sim/enablers.ts` derives a card's whole value from `cost` → `produces`. A cost
 * only a closure understood could not be shown, dimmed, or planned — so a genuinely new *kind* of
 * payment earns a field here, once, and every card gets it. New *amounts* need no schema change:
 * that is what `resolve` is for.
 */
export interface CardCost {
  /** Pools spent. Any of the eight — a culture or population price is a value here, not a new field. */
  resources?: Partial<Resources>;
  /** Other cards discarded from hand to play this. Scales down rather than blocking: playing with
   *  fewer cards to spare than this costs no discard at all (`payCost`). */
  discard?: number;
  /** Culture level required — a prerequisite, not a price; culture is never consumed. */
  cultureLevelReq?: number;
  /**
   * This copy's *actual* cost when it isn't the declarative one — a price that scales with its own
   * play count, with the board, with anything. Returns a whole `CardCost`, which the engine then
   * checks and pays generically, so the result stays as introspectable as a static cost.
   *
   * `base` is the declarative fields above, handed in so a scaling closure derives from them instead
   * of restating the number (edit the base and the curve follows). They are also the display fallback
   * for contexts with no run (Collection, the deck editor) — the same relationship
   * `display.description` has with `display.dynamicText`.
   *
   * Pure read: the projection clone re-prices every render.
   */
  resolve?: (ctx: CostContext, base: CardCost) => CardCost;
  /** Bespoke precondition the declarative fields can't express (e.g. a peek card needs a non-empty
   *  draw pile). Pure read; returns the reason it blocks, or null. */
  check?: (ctx: CostContext) => UnplayableReason | null;
}

/**
 * This copy's cost right now: the card's own `resolve` (else its declarative base), then the sticker
 * fold over whatever that produced.
 *
 * The order is load-bearing — a sticker discounts the price you *actually* pay. Folded the other way
 * round, an Efficient −1🔨 would be scaled along with the base by the card's own `resolve`, a far
 * bigger swing than the sticker advertises.
 */
export function currentCost(card: CardDef, ctx: CostContext): CardCost {
  const resolved = card.cost.resolve ? card.cost.resolve(ctx, card.cost) : card.cost;
  if (!resolved.resources) return resolved;
  const resources = effectiveCost(resolved.resources, ctx.self);
  return resources === resolved.resources ? resolved : { ...resolved, resources };
}

/** A card as this copy reads *inside a run*: `effectiveCard`'s sticker fold plus a dynamic cost priced
 *  against the live state. The display counterpart of `currentCost`, so a face can't show a price the
 *  gate wouldn't charge. Static surfaces (Collection, the deck editor) have no run and call
 *  `effectiveCard` alone, showing the declarative base. Prices off the *original* card, never off the
 *  sticker-folded one, so the fold lands once. */
export function runCard(card: CardDef, ctx: CostContext): CardDef {
  return { ...effectiveCard(card, ctx.self), cost: currentCost(card, ctx) };
}

/** Why this copy's cost can't be met right now, or null. Checked in `UnplayableReason`'s priority
 *  order; `discard` is absent because it scales to what you have rather than blocking. */
export function costReason(card: CardDef, ctx: CostContext): UnplayableReason | null {
  const cost = currentCost(card, ctx);
  if (cost.resources && !canAfford(ctx.G.resources, cost.resources)) {
    const missing: Partial<Resources> = {};
    for (const [k, v] of Object.entries(cost.resources) as [keyof Resources, number][]) {
      if (v > 0 && ctx.G.resources[k] < v) missing[k] = v - ctx.G.resources[k];
    }
    return { kind: 'cost', missing };
  }
  if (cost.cultureLevelReq && cultureLevel(ctx.G.resources.culture) < cost.cultureLevelReq)
    return { kind: 'cultureLevel', required: cost.cultureLevelReq };
  return cost.check?.(ctx) ?? null;
}

/** How many cards this play actually sacrifices: `discard`, unless the hand has fewer other cards to
 *  spare — playing with an otherwise-empty hand costs no discard, a reward for sequencing the turn so
 *  this card comes last. The count `playCard` validates its `discardHandIdxs` against. */
export function discardCount(card: CardDef, ctx: CostContext): number {
  const want = currentCost(card, ctx).discard ?? 0;
  return ctx.G.hand.length - 1 >= want ? want : 0;
}

/** Spend this copy's price. Only the resource half — which cards leave the hand is `discardCount`,
 *  and moving them is the caller's, since a sacrifice must not reach `G.discard` until the played
 *  card's own effect has resolved (`playCard`). */
export function payCost(card: CardDef, ctx: CostContext): void {
  subtractResources(ctx.G.resources, currentCost(card, ctx).resources ?? {});
}
