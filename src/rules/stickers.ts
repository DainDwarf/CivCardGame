import { STICKERS } from '../content/stickers';
import { findInstance, hasSticker, type OwnedCards } from './collection';
import type { CardInstance } from './state';
import type { Resources } from './resources';
import type { CardDef } from '../content/cards';

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

/** Attempt to attach `stickerId` to `instanceId`. Returns `null` (a no-op signal, mirroring
 *  `shop.ts`'s `buyTier`) when the sticker or instance doesn't exist, the instance already
 *  carries one (Step 7.5 caps one sticker per instance), or the player can't afford it.
 *  Immutable — the input `collection` is untouched. */
export function buySticker(
  collection: OwnedCards,
  influence: number,
  instanceId: string,
  stickerId: string,
): StickerPurchase | null {
  const sticker = STICKERS[stickerId];
  const inst = findInstance(collection, instanceId);
  if (!sticker || !inst || hasSticker(inst) || influence < sticker.cost) return null;
  const instances = collection.instances.map((i) => (i.id === instanceId ? { ...i, stickers: [stickerId] } : i));
  return { influence: influence - sticker.cost, collection: { ...collection, instances } };
}

/**
 * Card stickers in the run loop (Phase 3 Step 7.6): the two functions below are the *only*
 * place a sticker's actual effect is interpreted — `rules/effects.ts`'s declarative default
 * resolvers (`defaultProduce`/`specToResolver`) and the two cost sites (`unplayableReason`,
 * `playCard`) all call through here rather than reading `self.stickers` and reimplementing the
 * bump themselves, so resolution and the `effectiveCard` display below never diverge. Hardcoded
 * by sticker id, same "just a few, hand-matched" style as Cornucopia/Creeping Decay's bespoke
 * resolvers — real variety is Phase 4.
 *
 * Neither is consulted by a card's own bespoke `resolve`/`produce` (e.g. Cornucopia) — a sticker
 * only augments the *declarative* default, so Reinforced on a bespoke-resolver card is a known
 * v1 gap (its `dynamicText` display doesn't reflect it either, so display and resolution still
 * agree — see `state.ts`'s `CardInstance.stickers`).
 */
function instanceHasSticker(self: CardInstance, stickerId: string): boolean {
  return !!self.stickers?.includes(stickerId);
}

/** Reinforced: "+1 to this copy's output" — bumps every resource key `base` actually produces
 *  by 1. `undefined` in, `undefined` out (a card with no gain has nothing to reinforce). */
export function effectiveGain(base: Partial<Resources> | undefined, self: CardInstance): Partial<Resources> | undefined {
  if (!base || !instanceHasSticker(self, 'reinforced')) return base;
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(base) as [keyof Resources, number][]) out[k] = v + 1;
  return out;
}

/** Efficient: "Costs 1 less to play" — knocks 1 off every resource key `cost` charges, floored
 *  at 0 per resource (never pays you to play a card). */
export function effectiveCost(cost: Partial<Resources>, self: CardInstance): Partial<Resources> {
  if (!instanceHasSticker(self, 'efficient')) return cost;
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(cost) as [keyof Resources, number][]) out[k] = Math.max(0, v - 1);
  return out;
}

/** A card instance's *displayed* stats after any attached sticker — a shallow `CardDef` copy with
 *  `cost`/`produces`/`effect.gain` swapped for their `effectiveCost`/`effectiveGain` values, so
 *  every render site that already does `card={CARDS[cardId]}` can instead pass `effectiveCard(CARDS[cardId],
 *  self)` and show the true number with zero changes to `CardFace`/`describeCost`/`describeBuilding`
 *  themselves. Returns `card` unchanged (no new object) when the instance carries no sticker. */
export function effectiveCard(card: CardDef, self: CardInstance): CardDef {
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
