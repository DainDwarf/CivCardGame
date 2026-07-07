import { copiesOwned, type OwnedCards } from './collection';

/**
 * The meta shop (docs/DESIGN.md, "Economy & progression"; Phase 3 Step 5.2). The shop sells
 * *depth* — extra copies of cards the player already owns — never new cards (those come only
 * from mission unlocks). A card's ownership rises along the copy-tier ladder ×1 → ×2 → ×4 →
 * ×8, each rung bought with Influence. This module is the one pure place that logic
 * lives; `meta/Shop.tsx` is its UI consumer and `App.tsx`'s `buyCardTier` its write path.
 * Follows `rules/rewards.ts`'s immutable `{ influence, collection }` pattern.
 */

/** The copy-tier ladder: each rung is the Influence cost to raise ownership to the next tier.
 *  The numbers are balance-tunable; the ×1→×2→×4→×8 ladder itself is a core rule (like
 *  `deckBuilder.ts`'s `MAX_DECKS`) — bounded (Phase 3 Step 7.1 dropped the old terminal
 *  `'unlimited'` rung) so every owned count stays a finite, instantiable number. ×8 is
 *  terminal — no rung leaves it. */
export const TIER_LADDER: { from: number; to: number; cost: number }[] = [
  { from: 1, to: 2, cost: 1 },
  { from: 2, to: 4, cost: 2 },
  { from: 4, to: 8, cost: 5 },
];

export interface TierUpgrade {
  to: number;
  cost: number;
}

/** The next tier `current` can be upgraded to, or `null` if there's nowhere to go: terminal
 *  (×8), not owned (`0`), or an off-ladder copy count. A single predicate for "owned *and*
 *  still upgradeable", reused by `Shop.tsx` to filter its list. */
export function nextTier(current: number): TierUpgrade | null {
  const rung = TIER_LADDER.find((r) => r.from === current);
  return rung ? { to: rung.to, cost: rung.cost } : null;
}

export interface PurchaseResult {
  influence: number;
  collection: OwnedCards;
}

/** Attempt to buy the next copy tier for `cardId`. Returns `null` (a no-op signal, mirroring
 *  `moves.ts`'s `'invalid'`) when the card isn't owned, is already at its cap, or the player
 *  can't afford it. On success, returns the reduced Influence and a new collection with the
 *  card bumped to its next tier (immutable — the input `collection` is untouched). */
export function buyTier(collection: OwnedCards, influence: number, cardId: string): PurchaseResult | null {
  const up = nextTier(copiesOwned(collection, cardId));
  if (!up || influence < up.cost) return null;
  return { influence: influence - up.cost, collection: { ...collection, [cardId]: up.to } };
}
