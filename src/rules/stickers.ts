import { STICKERS, type StickerDef } from '../content/stickers';
import { CARDS, type CardDef } from '../content/cards';
import { findInstance, isStickerFull, type OwnedCards } from './collection';
import type { Resources } from './resources';

/** The minimal shape `effectiveGain`/`effectiveCost`/`effectiveCard` need — any holder carrying a
 *  `stickers` array (a run `CardInstance`, a meta `MetaCardInstance`, or a deck-editor display
 *  group), so run and meta screens read the same effective stats through the same functions. */
export interface StickeredInstance {
  stickers?: string[];
}

/** Result of a sticker purchase — the updated Influence + collection. Mirrors `rules/shop.ts`'s
 *  `buyTier`; `meta/Shop.tsx` is the UI consumer, `App.tsx`'s `attachSticker` the write path. */
export interface StickerPurchase {
  influence: number;
  collection: OwnedCards;
}

/** Whether `sticker` may attach to `card` — the one eligibility dispatcher every site routes
 *  through (shop listing/offer, `buySticker`'s reject). A sticker owns its own condition via its
 *  `appliesTo` predicate (`content/stickers.ts`); absent = attaches to anything. Beyond that per-sticker
 *  check there is one blanket card-side rule: a `wonder` never takes a sticker (wonders are unique and
 *  unmodifiable), enforced here so every site — the tray offer, `buySticker`'s reject, and the
 *  `upgrades.ts` hint — agrees from one seam. No caller inspects a card's `kind`/`produces` or branches
 *  on a sticker id, so a new restricted sticker is authored on its def alone. */
export function stickerAppliesTo(sticker: StickerDef, card: CardDef): boolean {
  if (card.kind === 'wonder') return false;
  return sticker.appliesTo?.(card) ?? true;
}

/** The stickers a player has *unlocked* (via mission rewards — `PlayerStore.unlockedStickers`).
 *  The single filter seam: every place that *enumerates* the catalogue to offer stickers (the
 *  Collection tray, the `cardUpgradeAvailable` hint) reads through here, so a locked sticker is
 *  hidden entirely — hidden-until-unlocked, like an un-owned card. Keyed `STICKERS[id]` reads of an
 *  *already-attached* sticker never route through this (it was necessarily unlocked when bought). */
export function unlockedStickerDefs(unlockedStickers: Record<string, true>): StickerDef[] {
  return Object.values(STICKERS).filter((s) => unlockedStickers[s.id]);
}

/** Attempt to attach `stickerId` to `instanceId`. Returns `null` (mirroring `shop.ts`'s `buyTier`)
 *  when the sticker or instance doesn't exist, the sticker isn't unlocked (`unlockedStickers`, the
 *  reward gate the tray only mirrors), the sticker doesn't apply (`stickerAppliesTo`, the
 *  authoritative guard the shop UI only mirrors), the instance is already full, or the player can't
 *  afford it. The *same* sticker id can be attached twice by design — two Reinforced stacks to +2
 *  (the folds below apply once per attached copy). Appends (never replaces); immutable. */
export function buySticker(
  collection: OwnedCards,
  influence: number,
  instanceId: string,
  stickerId: string,
  unlockedStickers: Record<string, true>,
): StickerPurchase | null {
  const sticker = STICKERS[stickerId];
  const inst = findInstance(collection, instanceId);
  if (!sticker || !unlockedStickers[stickerId] || !inst || isStickerFull(inst) || influence < sticker.cost) return null;
  if (!stickerAppliesTo(sticker, CARDS[inst.cardId])) return null;
  const instances = collection.instances.map((i) =>
    i.id === instanceId ? { ...i, stickers: [...(i.stickers ?? []), stickerId] } : i,
  );
  return { influence: influence - sticker.cost, collection: { ...collection, instances } };
}

/**
 * Card stickers in the run loop: the two functions below are the *only* place a sticker's actual
 * effect is applied — `rules/effects.ts`'s declarative default resolvers and the two cost sites
 * (`unplayableReason`, `playCard`) all call through here rather than reimplementing the bump, so
 * resolution and the `effectiveCard` display below never diverge. Each dispatches to the sticker's
 * own `applyGain`/`applyCost` hook (`content/stickers.ts`) — no sticker-specific knowledge here.
 *
 * Both are a plain fold over `self.stickers`, applying each attached copy's hook in turn — so
 * stacking (two Reinforced → +2) and composing (Reinforced + Efficient) fall out for free, and a
 * sticker whose def lacks the relevant hook is skipped via `?? out`.
 *
 * `effectiveGain` is also the fold a card's own bespoke `resolve`/`produce` goes
 * through — `effects.ts`'s `gainResources` is the single write path for any card's resource output
 * and calls `effectiveGain` itself, so a bespoke resolver's gain is sticker-adjusted exactly like
 * the declarative default (see `state.ts`'s `CardInstance.stickers`).
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
 *  `cost`/`produces`/`effect.resources` swapped for their effective values, so any render site doing
 *  `card={CARDS[cardId]}` can pass `effectiveCard(CARDS[cardId], self)` instead and show the true
 *  number with no change to `CardFace`/`describeCost`/`describeBuilding`. Returns `card` unchanged
 *  when the instance carries no sticker. */
export function effectiveCard(card: CardDef, self: StickeredInstance): CardDef {
  if (!self.stickers?.length) return card;
  const produces = card.produces && effectiveGain(card.produces, self);
  const resources = card.effect?.resources && effectiveGain(card.effect.resources, self);
  return {
    ...card,
    cost: effectiveCost(card.cost, self),
    ...(produces ? { produces } : {}),
    ...(card.effect ? { effect: { ...card.effect, ...(resources ? { resources } : {}) } } : {}),
  };
}
