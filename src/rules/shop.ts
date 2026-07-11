import { CARDS } from '../content/cards';
import { copiesOwned, grantCopies, type OwnedCards } from './collection';

/**
 * The meta shop (docs/DESIGN.md, "Economy & progression"). The shop sells *depth* — extra copies of
 * cards the player already owns — never new cards (those come only from mission unlocks). Ownership
 * rises along the copy-tier ladder ×1 → ×2 → ×4 → ×8, each rung bought with Influence. The one pure
 * place this logic lives; `meta/Shop.tsx` is the UI consumer, `App.tsx`'s `buyCardTier` the write
 * path. Follows `rules/rewards.ts`'s immutable `{ influence, collection }` pattern. `wonder` cards are
 * the one exception — they're unique, so `canBuyTier`/`buyTier` reject them regardless of tier.
 */

/** The copy-tier ladder: each rung is the Influence cost to raise ownership to the next tier. The
 *  numbers are balance-tunable; the ×1→×2→×4→×8 ladder itself is a core rule (like `deckBuilder.ts`'s
 *  `MAX_DECKS`), bounded so every owned count stays a finite, instantiable number. ×8 is terminal. */
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

/** Whether the next copy tier for `cardId` is buyable *right now* — owned, still
 *  upgradeable (not terminal ×8), and affordable. Mirrors `buyTier`'s reject exactly (it's
 *  `buyTier(...) !== null` without minting the copies), the leaf the upgrade-hint roll-ups
 *  (`rules/upgrades.ts`) fold over. */
export function canBuyTier(collection: OwnedCards, influence: number, cardId: string): boolean {
  if (CARDS[cardId]?.kind === 'wonder') return false; // wonders are unique — copies can't be bought
  const up = nextTier(copiesOwned(collection, cardId));
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
  const up = nextTier(current);
  if (!up || influence < up.cost) return null;
  return { influence: influence - up.cost, collection: grantCopies(collection, cardId, up.to - current) };
}
