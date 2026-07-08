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
  // The event-bus example cards (on-draw / on-discard / on-threshold), likewise seeded for testing.
  scriptorium: 2,
  salvage: 2,
  treasury: 2,
  // One copy of every *other* deckable card that isn't already above and isn't a mission reward
  // unlock (university/granary/conquest — granted on first clear, per `rules/rewards.ts`), so the
  // whole buildable catalogue is reachable for testing. Mission-only kinds (event/threat/objective)
  // are never owned, so they're excluded by nature. A later pass may turn some of these back into
  // surprise unlocks.
  walls: 1,
  barracks: 1,
  market: 1,
  trading_post: 1,
  pyramids: 1,
  great_library: 1,
  colossus: 1,
  eureka: 1,
  inspiration: 1,
  develop: 1,
  cultural_festival: 1,
  philosopher: 1,
};
