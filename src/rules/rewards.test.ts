import { describe, it, expect } from 'vitest';
import { computeRewards, type UnlockProgress } from './rewards';
import { copiesOwned, emptyCollection, collectionFromCounts, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

// Fully synthetic: `computeRewards` grants through `grantCopies`/`isOwned` on the collection and
// never validates against `CARDS`, so the card-id literals below are inert labels. The
// mission↔card reward-coherence iterator lives in `content/missions.test.ts`.

function mission(reward: MissionDef['reward']): MissionDef {
  return {
    id: 'm',
    name: 'm',
    lore: '',
    prereqs: [],
    objectiveCardId: 'long_winter_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    reward,
    map: { col: 0, row: 0 },
  };
}

function infiniteMission(): MissionDef {
  return {
    id: 'm-infinite',
    name: 'm-infinite',
    lore: '',
    prereqs: [],
    objectiveCardId: 'the_long_decline_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'infinite',
  };
}

/** The player's unlock state, bundled as `computeRewards` takes it (mirrors the `PlayerStore`
 *  fields). Defaults to empty; a test overrides only the sets it exercises. */
function progress(overrides: Partial<UnlockProgress> = {}): UnlockProgress {
  return {
    collection: emptyCollection(),
    unlockedStickers: {},
    unlockedBoardStickers: {},
    unlockedBoards: {},
    ...overrides,
  };
}

describe('computeRewards', () => {
  it('grants Influence and the unlock on a first clear', () => {
    const m = mission({ influence: 2, unlockCardIds: ['granary'] });
    const result = computeRewards(m, false, progress());
    expect(result.influence).toBe(2);
    expect(copiesOwned(result.progress.collection, 'granary')).toBe(1);
  });

  it('grants nothing on a replay of an already-completed mission', () => {
    const m = mission({ influence: 2, unlockCardIds: ['granary'] });
    const result = computeRewards(m, true, progress());
    expect(result.influence).toBe(0);
    expect(result.progress.collection.instances).toEqual([]);
  });

  it('clearing the same mission twice only grants once (first-clear semantics)', () => {
    const m = mission({ influence: 1, unlockCardIds: ['granary'] });
    const first = computeRewards(m, false, progress());
    const second = computeRewards(m, true, progress({ collection: first.progress.collection }));
    expect(first.influence).toBe(1);
    expect(second.influence).toBe(0);
    expect(second.progress.collection).toEqual(first.progress.collection);
  });

  it('does not grant a second copy if the unlock card is already owned', () => {
    const m = mission({ influence: 1, unlockCardIds: ['granary'] });
    const result = computeRewards(m, false, progress({ collection: collectionFromCounts({ granary: 2 }) }));
    expect(copiesOwned(result.progress.collection, 'granary')).toBe(2);
  });

  it('grants every card of a multi-unlock reward on a first clear', () => {
    const m = mission({ influence: 0, unlockCardIds: ['farm', 'conquest', 'hut'] });
    const result = computeRewards(m, false, progress());
    expect(result.influence).toBe(0);
    expect(copiesOwned(result.progress.collection, 'farm')).toBe(1);
    expect(copiesOwned(result.progress.collection, 'conquest')).toBe(1);
    expect(copiesOwned(result.progress.collection, 'hut')).toBe(1);
  });

  it('grants only the not-yet-owned cards of a multi-unlock reward', () => {
    const m = mission({ influence: 0, unlockCardIds: ['farm', 'conquest'] });
    // Already owns `farm` (×2) — that count is untouched; the new `conquest` is granted once.
    const result = computeRewards(m, false, progress({ collection: collectionFromCounts({ farm: 2 }) }));
    expect(copiesOwned(result.progress.collection, 'farm')).toBe(2);
    expect(copiesOwned(result.progress.collection, 'conquest')).toBe(1);
  });
});

describe('computeRewards — sticker & board unlocks', () => {
  it('unions a first clear\'s card- and board-sticker unlocks into the sets', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'], unlockBoardStickerIds: ['stockpile'] });
    const result = computeRewards(m, false, progress());
    expect(result.progress.unlockedStickers).toEqual({ irrigation: true });
    expect(result.progress.unlockedBoardStickers).toEqual({ stockpile: true });
  });

  it('unions a first clear\'s board unlock into the unlocked-boards set', () => {
    const m = mission({ influence: 0, unlockBoardIds: ['chiefdom'] });
    const result = computeRewards(m, false, progress());
    expect(result.progress.unlockedBoards).toEqual({ chiefdom: true });
  });

  it('preserves already-unlocked stickers and is idempotent on a re-unlock', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'] });
    const result = computeRewards(m, false, progress({ unlockedStickers: { drainage: true } }));
    expect(result.progress.unlockedStickers).toEqual({ drainage: true, irrigation: true });
  });

  it('preserves already-unlocked boards and is idempotent on a re-unlock', () => {
    const m = mission({ influence: 0, unlockBoardIds: ['chiefdom'] });
    const result = computeRewards(m, false, progress({ unlockedBoards: { chiefdom: true, kingdom: true } }));
    expect(result.progress.unlockedBoards).toEqual({ chiefdom: true, kingdom: true });
  });

  it('does not unlock on a replay (already-completed passes every set through unchanged)', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'], unlockBoardStickerIds: ['stockpile'], unlockBoardIds: ['chiefdom'] });
    const result = computeRewards(m, true, progress());
    expect(result.progress.unlockedStickers).toEqual({});
    expect(result.progress.unlockedBoardStickers).toEqual({});
    expect(result.progress.unlockedBoards).toEqual({});
  });
});

describe('computeRewards — infinite missions', () => {
  it('pays Influence equal to rounds survived, with no unlock', () => {
    const m = infiniteMission();
    const result = computeRewards(m, false, progress(), 10);
    expect(result.influence).toBe(10);
    expect(result.progress.collection.instances).toEqual([]);
  });

  it('pays out on every attempt — "already completed" is meaningless for an infinite mission', () => {
    const m = infiniteMission();
    const result = computeRewards(m, true, progress(), 7);
    expect(result.influence).toBe(7);
  });

  it('passes the unlock progress through untouched', () => {
    const m = infiniteMission();
    const before: OwnedCards = collectionFromCounts({ granary: 1 });
    const result = computeRewards(
      m,
      false,
      progress({ collection: before, unlockedStickers: { irrigation: true }, unlockedBoardStickers: { stockpile: true }, unlockedBoards: { chiefdom: true } }),
      3,
    );
    expect(result.progress.collection).toBe(before);
    expect(result.progress.unlockedStickers).toEqual({ irrigation: true });
    expect(result.progress.unlockedBoardStickers).toEqual({ stockpile: true });
    expect(result.progress.unlockedBoards).toEqual({ chiefdom: true });
  });
});
