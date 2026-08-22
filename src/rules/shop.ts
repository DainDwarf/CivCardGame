import { CARDS } from '../content/cards';
import { cardAge } from '../content/cardAge';
import { copiesOwned, grantCopies, type OwnedCards } from './collection';

/**
 * The meta shop (docs/DESIGN.md, "Economy & progression"). The shop sells *depth* — extra copies of
 * cards the player already owns — never new cards (those come only from mission unlocks). Ownership
 * rises along the copy-tier ladder ×1 → ×2 → ×3 → ×4, one copy per rung bought with Influence. The one
 * pure place this logic lives; `meta/CardInstancePanel.tsx` is the UI consumer, `App.tsx`'s `buyCardTier` the write
 * path. Follows `rules/rewards.ts`'s immutable `{ influence, collection }` pattern. `wonder` cards are
 * the one exception — they're unique, so `canBuyTier`/`buyTier` reject them regardless of tier.
 */

/** The copy-tier ladder: the ownership counts the shop sells, each rung one further copy. A core rule
 *  (like `deckBuilder.ts`'s `MAX_DECKS`), bounded so every owned count stays a finite, instantiable
 *  number. ×4 is terminal. The *price* isn't here — it rides the card's age, not the rung. */
export const TIER_LADDER: { from: number; to: number }[] = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

/** What one more copy costs, by the card's age (`content/cardAge.ts`). Flat across the ladder: depth
 *  in a card is worth the same whether it's the second copy or the fourth, and a later age's cards are
 *  dearer because the campaign reaching them pays more. An age with no entry prices nothing, which
 *  `content/cards.test.ts` reads as a content gap — so shipping an age's first card unlocks is what
 *  forces its price to be decided. */
export const COPY_PRICE_BY_AGE: Record<string, number> = {
  stone: 2,
  bronze: 4,
};

/** The Influence one more copy of `cardId` costs, or `undefined` where the card has no age or its age
 *  no price — both content gaps, and `content/cards.test.ts` pins that neither reaches a buyable card.
 *  An unpriced card is simply not for sale: `nextTier` returns `null` and the whole shop path — hint
 *  roll-up, buy button, `buyTier` — declines together rather than any one of them guessing a number. */
export function copyPrice(cardId: string): number | undefined {
  const age = cardAge(cardId);
  return age === undefined ? undefined : COPY_PRICE_BY_AGE[age];
}

export interface TierUpgrade {
  to: number;
  cost: number;
}

/** The next tier `cardId` can be upgraded to at `current` copies, or `null` if there's nowhere to go:
 *  terminal (×4), not owned (`0`), an off-ladder copy count, or a card carrying no price. A single
 *  predicate for "owned *and* still upgradeable", the one the buy button and the hint roll-ups share. */
export function nextTier(cardId: string, current: number): TierUpgrade | null {
  const rung = TIER_LADDER.find((r) => r.from === current);
  const cost = copyPrice(cardId);
  return rung && cost !== undefined ? { to: rung.to, cost } : null;
}

/** Whether the next copy tier for `cardId` is buyable *right now* — owned, still
 *  upgradeable (not terminal ×4), and affordable. Mirrors `buyTier`'s reject exactly (it's
 *  `buyTier(...) !== null` without minting the copies), the leaf the upgrade-hint roll-ups
 *  (`rules/upgrades.ts`) fold over. */
export function canBuyTier(collection: OwnedCards, influence: number, cardId: string): boolean {
  if (CARDS[cardId]?.kind === 'wonder') return false; // wonders are unique — copies can't be bought
  const up = nextTier(cardId, copiesOwned(collection, cardId));
  return up !== null && influence >= up.cost;
}

export interface PurchaseResult {
  influence: number;
  collection: OwnedCards;
}

/** Attempt to buy the next copy tier for `cardId`. Returns `null` (a no-op signal, mirroring
 *  `moves.ts`'s `'invalid'`) when the card isn't owned, is already at its cap, or the player
 *  can't afford it. On success, returns the reduced Influence and a new collection granted
 *  the newly-bought copies as fresh instances (`rules/collection.ts`'s `grantCopies`) —
 *  immutable, the input `collection` is untouched. */
export function buyTier(collection: OwnedCards, influence: number, cardId: string): PurchaseResult | null {
  if (CARDS[cardId]?.kind === 'wonder') return null; // wonders are unique — copies can't be bought
  const current = copiesOwned(collection, cardId);
  const up = nextTier(cardId, current);
  if (!up || influence < up.cost) return null;
  return { influence: influence - up.cost, collection: grantCopies(collection, cardId, up.to - current) };
}
