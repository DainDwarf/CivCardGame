import { STICKERS } from '../content/stickers';
import { findInstance, hasSticker, type OwnedCards } from './collection';

/**
 * The meta sticker shop (Phase 3 Step 7.5): spend Influence to attach a permanent sticker to
 * one chosen owned `MetaCardInstance`, mutating it in place. Mirrors `rules/shop.ts`'s
 * `buyTier` — the one pure place this logic lives; `meta/Shop.tsx` is its UI consumer and
 * `App.tsx`'s `attachSticker` its write path. Inert this step: nothing reads `stickers` yet
 * (Step 7.6 wires the effect into a run).
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
