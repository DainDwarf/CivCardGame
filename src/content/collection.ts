import type { OwnedCards } from '../rules/collection';

/**
 * A fresh player's starting ownership (`meta/store.ts`'s `emptyStore`) — deliberately
 * narrow (docs/TODO.md, Phase 3 Step 1): just enough to build `content/decks.ts`'s
 * starting deck. Everything else is unlocked through missions.
 */
export const STARTING_COLLECTION: OwnedCards = {
  settlers: 'unlimited',
  corvee: 'unlimited',
  harvest: 'unlimited',
  farm: 2,
  workshop: 2,
  library: 1,
  theater: 1,
};
