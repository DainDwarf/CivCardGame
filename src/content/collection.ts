import type { OwnedCards } from '../rules/collection';

/**
 * A fresh player's starting ownership (`meta/store.ts`'s `emptyStore`) — deliberately
 * narrow (docs/TODO.md, Phase 3 Step 1): just enough to build `content/decks.ts`'s
 * starting deck. Everything else is unlocked through missions.
 */
export const STARTING_COLLECTION: OwnedCards = {
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
