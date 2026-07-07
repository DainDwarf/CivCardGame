/**
 * A fresh player's starting ownership counts (`meta/store.ts`'s `emptyStore`, via
 * `rules/collection.ts`'s `collectionFromCounts`) — deliberately narrow: just enough to build
 * `content/decks.ts`'s starting deck. Everything else is unlocked through missions. A plain
 * `{ cardId: count }` map, not an `OwnedCards` itself: instance identity doesn't exist until it's
 * actually granted.
 */
export const STARTING_COLLECTION: Record<string, number> = {
  settlers: 2,
  corvee: 2,
  harvest: 2,
  farm: 2,
  workshop: 2,
  library: 1,
  theater: 1,
  // Seeded here (pre-alpha) so the growing-gain Cornucopia, the interactive Foresight, and the
  // targeted Destroy are immediately reachable for testing; a later pass may instead make them
  // mission unlocks, per the "unlocks are surprises" design.
  cornucopia: 2,
  foresight: 2,
  destroy: 2,
};
