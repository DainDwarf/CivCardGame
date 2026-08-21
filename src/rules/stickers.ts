import { STICKERS, type StickerDef } from '../content/stickers';
import { CARDS, type CardDef } from '../content/cards';
import { findInstance, isStickerFull, type OwnedCards } from './collection';
import type { CardCost } from './cost';
import type { CardEffect } from './effects';
import type { Resources } from './resources';
import type { GameState } from './state';

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
 * Detach the sticker at `index` from `instanceId`, destroying it. Returns `null` (the family's reject
 * idiom) when the instance isn't owned, carries no sticker, or `index` is out of range. Immutable; the
 * instance's `stickers` key is *deleted* rather than left as `[]` when its last sticker goes, per
 * `MetaCardInstance`'s absent-means-plain-copy contract (`collection.ts`) — that's what returns the copy
 * to the fungible pool `deckBuilder.ts` draws from.
 *
 * Removal is **positional**, mirroring `rules/boardStickers.ts`'s `removeBoardSticker`: an instance
 * legitimately carries the same sticker id twice (`buySticker` appends, and the `effectiveGain`/
 * `effectiveCost` folds apply it once per copy), so removing by id would destroy both copies of a stack.
 *
 * Returning a bare `OwnedCards` rather than a `StickerPurchase` is the point, not an oversight:
 * **removal refunds nothing**, so there is no Influence for a caller to write back. Attaching a sticker
 * is meant to be a decision with weight; re-applying one costs full price.
 */
export function removeSticker(collection: OwnedCards, instanceId: string, index: number): OwnedCards | null {
  const inst = findInstance(collection, instanceId);
  const current = inst?.stickers;
  if (!inst || !current || index < 0 || index >= current.length) return null;
  const remaining = current.filter((_, i) => i !== index);
  const instances = collection.instances.map((i) => {
    if (i.id !== instanceId) return i;
    const { stickers: _dropped, ...plain } = i;
    return remaining.length ? { ...plain, stickers: remaining } : plain;
  });
  return { ...collection, instances };
}

/**
 * Card stickers in the run loop: the two functions below are the *only* place a sticker's actual
 * effect is applied — `rules/effects.ts`'s declarative default resolvers and `rules/cost.ts`'s
 * `currentCost` (the single seam every price flows through) call through here rather than
 * reimplementing the bump, so resolution and the `effectiveCard` display below never diverge. Each
 * dispatches to the sticker's own `applyGain`/`applyCost` hook (`content/stickers.ts`) — no
 * sticker-specific knowledge here.
 *
 * Both are a plain fold over `self.stickers`, applying each attached copy's hook in turn — so
 * stacking (two Reinforced → +2) and composing (Reinforced + Efficient) fall out for free, and a
 * sticker whose def lacks the relevant hook is skipped via `?? out`.
 *
 * `effectiveGain` is also the fold a card's own bespoke `CardEffect.resolve` closure goes
 * through — `effects.ts`'s `gainResources` is the single write path for any card's resource output
 * and calls `effectiveGain` itself, so a bespoke resolver's gain is sticker-adjusted exactly like
 * the declarative default (see `state.ts`'s `CardInstance.stickers`).
 */

/** Fold each attached sticker's `applyGain` over `base` in order. `undefined` in → `undefined` out —
 *  a slot the card doesn't have, which no resolver hands this. An **empty bag** is not that: it is the
 *  `produces` slot of a card printing no yield, and a hook may materialize an output there (see
 *  `effectiveProduces` below). The `?? out` is load-bearing: it both skips a sticker lacking `applyGain`
 *  (e.g. Efficient) and preserves the running value.
 *
 *  `G` is passed only where a *live* board exists to read — `effects.ts`'s `gainResources`, the run's
 *  one payment path. Every other caller (a card face, a deck tile, a projection of what a copy could
 *  yield) has no board and omits it, which a conditional sticker must read as "show the potential
 *  rate": there is no state in which it is false, only one in which it is unknown. */
export function effectiveGain(
  base: Partial<Resources> | undefined,
  self: StickeredInstance,
  G?: GameState,
): Partial<Resources> | undefined {
  let out = base;
  for (const id of self.stickers ?? []) out = STICKERS[id]?.applyGain?.(out, G) ?? out;
  return out;
}

/** Fold each attached sticker's `applyCost` over the whole `CardCost` in order (each hook is
 *  responsible for its own flooring). Folds over a card with *no* declarative price too — that's what
 *  lets a surcharge sticker land on a free card. `?? out` skips a sticker lacking `applyCost`
 *  (e.g. Reinforced). */
export function effectiveCost(cost: CardCost, self: StickeredInstance): CardCost {
  let out = cost;
  for (const id of self.stickers ?? []) out = STICKERS[id]?.applyCost?.(out) ?? out;
  return out;
}

/** A play `effect` or `upkeep` drain with its declarative bundle swapped for the folded one. Both
 *  rebuild through here, so they stay one rule rather than two transcriptions of it. An absent bundle
 *  stays absent: `runEffect` hands `gainResources` exactly this `effect.resources`, so there is no
 *  fold at these two slots for a card that declares none. */
function effectiveSlot(effect: CardEffect, self: StickeredInstance): CardEffect {
  const resources = effect.resources && effectiveGain(effect.resources, self);
  return resources ? { ...effect, resources } : effect;
}

/** The `produces` slot, which folds over an **absent** bundle as an empty one — mirroring the base
 *  `effects.ts`'s `resolveProduction` hands `gainResources` every round the copy stands
 *  (`produces?.resources ?? {}`), so a sticker materializing a per-round yield on a card that prints
 *  none shows on the face at the rate the round really pays. That divergence is the only one this
 *  module has to prevent: display and resolution differ in nothing else, since both fold through
 *  `effectiveGain`. Returns the card's own slot untouched when the fold materialized nothing. */
function effectiveProduces(card: CardDef, self: StickeredInstance): CardEffect | undefined {
  const resources = effectiveGain(card.produces?.resources ?? {}, self);
  if (!resources || Object.keys(resources).length === 0) return card.produces;
  return { ...card.produces, resources };
}

/** A card instance's *displayed* stats after any attached sticker — a shallow `CardDef` copy with
 *  `cost` and every gain slot swapped for their effective values, so any render site doing
 *  `card={CARDS[cardId]}` can pass `effectiveCard(CARDS[cardId], self)` instead and show the true
 *  number with no change to `CardFace`/`describeCost`/`describeBuilding`. Returns `card` unchanged when
 *  the instance carries no sticker.
 *
 *  The slot list must stay the one `gainResources` folds over — play `effect`, `produces` yield and
 *  `upkeep` drain, all three `CardEffect`s — or a face quotes a rate the run doesn't pay: signs are
 *  neutral in a gain bag, so a sticker charging a standing price lands on the drain exactly as one
 *  raising output lands on the yield (`content/stickers.ts`'s Convoy does both), and a `produces` the
 *  card never printed is a slot the round pays and the face must therefore show. */
export function effectiveCard(card: CardDef, self: StickeredInstance): CardDef {
  if (!self.stickers?.length) return card;
  const produces = effectiveProduces(card, self);
  return {
    ...card,
    cost: effectiveCost(card.cost, self),
    ...(produces ? { produces } : {}),
    ...(card.effect ? { effect: effectiveSlot(card.effect, self) } : {}),
    ...(card.upkeep ? { upkeep: effectiveSlot(card.upkeep, self) } : {}),
  };
}
