import { STICKERS, type StickerDef } from '../content/stickers';
import { CARDS, type CardDef } from '../content/cards';
import { findInstance, isStickerFull, type OwnedCards } from './collection';
import type { Resources } from './resources';

/** The minimal shape `effectiveGain`/`effectiveCost`/`effectiveCard` need — any card holder
 *  that carries a `stickers` array works, whether that's a run `CardInstance` (`state.ts`), a
 *  meta `MetaCardInstance` (`collection.ts`), or a deck-editor display group (`deckBuilder.ts`'s
 *  `DeckGroupEntry`) — the run loop and the meta screens (Step 7.9's "meta screens show
 *  effective values too") read the same effective stats through the same functions. */
export interface StickeredInstance {
  stickers?: string[];
}

/**
 * The meta sticker shop (Phase 3 Step 7.5): spend Influence to attach a permanent sticker to
 * one chosen owned `MetaCardInstance`, mutating it in place. Mirrors `rules/shop.ts`'s
 * `buyTier` — the one pure place this logic lives; `meta/Shop.tsx` is its UI consumer and
 * `App.tsx`'s `attachSticker` its write path.
 */
export interface StickerPurchase {
  influence: number;
  collection: OwnedCards;
}

/** Whether `sticker` may attach to `card` — the one eligibility dispatcher every site routes
 *  through (shop listing/offer, `buySticker`'s reject). A sticker owns its own condition via its
 *  `appliesTo` predicate (`content/stickers.ts`); absent = attaches to anything (Reinforced,
 *  Efficient). No caller inspects a card's `kind`/`produces` or branches on a sticker id itself
 *  (Step 7.8), so a new restricted sticker is authored on its def alone. */
export function stickerAppliesTo(sticker: StickerDef, card: CardDef): boolean {
  return sticker.appliesTo?.(card) ?? true;
}

/** Attempt to attach `stickerId` to `instanceId`. Returns `null` (a no-op signal, mirroring
 *  `shop.ts`'s `buyTier`) when the sticker or instance doesn't exist, the sticker doesn't apply
 *  to that card (`stickerAppliesTo` — this is the *authoritative* eligibility guard; the shop UI
 *  only mirrors it), the instance is already full (`MAX_STICKERS`, Step 7.7), or the player can't
 *  afford it. The *same* sticker id can be attached twice — a design choice, not an oversight:
 *  two Reinforced on one copy stacks to +2 (`effectiveGain`/`effectiveCost` below fold once per
 *  attached copy). Appends rather than replaces, so a once-stickered instance keeps its first
 *  sticker when a second is attached. Immutable — the input `collection` is untouched. */
export function buySticker(
  collection: OwnedCards,
  influence: number,
  instanceId: string,
  stickerId: string,
): StickerPurchase | null {
  const sticker = STICKERS[stickerId];
  const inst = findInstance(collection, instanceId);
  if (!sticker || !inst || isStickerFull(inst) || influence < sticker.cost) return null;
  if (!stickerAppliesTo(sticker, CARDS[inst.cardId])) return null;
  const instances = collection.instances.map((i) =>
    i.id === instanceId ? { ...i, stickers: [...(i.stickers ?? []), stickerId] } : i,
  );
  return { influence: influence - sticker.cost, collection: { ...collection, instances } };
}

/**
 * Card stickers in the run loop (Phase 3 Step 7.6, made self-contained in Step 7.8): the two
 * functions below are the *only* place a sticker's actual effect is applied — `rules/effects.ts`'s
 * declarative default resolvers (`defaultProduce`/`specToResolver`) and the two cost sites
 * (`unplayableReason`, `playCard`) all call through here rather than reading `self.stickers` and
 * reimplementing the bump themselves, so resolution and the `effectiveCard` display below never
 * diverge. Each *dispatches to the sticker's own `applyGain`/`applyCost` hook* (`content/stickers.ts`)
 * — it holds no sticker-specific knowledge itself, so a new sticker's effect is authored on its def.
 *
 * Both are a plain fold over `self.stickers`, applying each attached copy's hook in turn — so
 * stacking (two Reinforced → +2) and composing (Reinforced + Efficient) fall out for free, and
 * a sticker whose def lacks the relevant hook (Efficient in the gain fold) is skipped via `?? out`.
 *
 * Neither is consulted by a card's own bespoke `resolve`/`produce` (e.g. Cornucopia) — a sticker
 * only augments the *declarative* default, so a sticker on a bespoke-resolver card is a known
 * v1 gap (its `dynamicText` display doesn't reflect it either, so display and resolution still
 * agree — see `state.ts`'s `CardInstance.stickers`).
 */

/** Fold each attached sticker's `applyGain` over `base` in order. `undefined` in → `undefined`
 *  out (a card with no gain has nothing to reinforce). The `?? out` is load-bearing: it both
 *  skips a sticker lacking `applyGain` (e.g. Efficient) and preserves the running value. */
export function effectiveGain(base: Partial<Resources> | undefined, self: StickeredInstance): Partial<Resources> | undefined {
  let out = base;
  for (const id of self.stickers ?? []) out = STICKERS[id]?.applyGain?.(out) ?? out;
  return out;
}

/** Fold each attached sticker's `applyCost` over `cost` in order (each hook is responsible for
 *  its own flooring). `?? out` skips a sticker lacking `applyCost` (e.g. Reinforced). */
export function effectiveCost(cost: Partial<Resources>, self: StickeredInstance): Partial<Resources> {
  let out = cost;
  for (const id of self.stickers ?? []) out = STICKERS[id]?.applyCost?.(out) ?? out;
  return out;
}

/** A card instance's *displayed* stats after any attached sticker — a shallow `CardDef` copy with
 *  `cost`/`produces`/`effect.gain` swapped for their `effectiveCost`/`effectiveGain` values, so
 *  every render site that already does `card={CARDS[cardId]}` can instead pass `effectiveCard(CARDS[cardId],
 *  self)` and show the true number with zero changes to `CardFace`/`describeCost`/`describeBuilding`
 *  themselves. Returns `card` unchanged (no new object) when the instance carries no sticker. */
export function effectiveCard(card: CardDef, self: StickeredInstance): CardDef {
  if (!self.stickers?.length) return card;
  const produces = card.produces && effectiveGain(card.produces, self);
  const gain = card.effect?.gain && effectiveGain(card.effect.gain, self);
  return {
    ...card,
    cost: effectiveCost(card.cost, self),
    ...(produces ? { produces } : {}),
    ...(card.effect ? { effect: { ...card.effect, ...(gain ? { gain } : {}) } } : {}),
  };
}
