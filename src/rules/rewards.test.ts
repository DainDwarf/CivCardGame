import { describe, it, expect } from 'vitest';
import { computeRewards } from './rewards';
import { copiesOwned, emptyCollection, collectionFromCounts } from './collection';
import type { MissionDef } from '../content/missions';

// Fully synthetic: `computeRewards` grants through `grantCopies`/`isOwned` on the collection and
// never validates against `CARDS`, so the card-id literals below are inert labels. The
// mission↔card reward-coherence iterator moved to `content/missions.test.ts` (Step 2.4).

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

// The two unlocked-sticker sets pass *through* computeRewards; most tests start from empty.
const NO_STICKERS: Record<string, true> = {};

describe('computeRewards', () => {
  it('grants Influence and the unlock on a first clear', () => {
    const m = mission({ influence: 2, unlockCardIds: ['granary'] });
    const result = computeRewards(m, false, emptyCollection(), NO_STICKERS, NO_STICKERS);
    expect(result.influence).toBe(2);
    expect(copiesOwned(result.collection, 'granary')).toBe(1);
  });

  it('grants nothing on a replay of an already-completed mission', () => {
    const m = mission({ influence: 2, unlockCardIds: ['granary'] });
    const result = computeRewards(m, true, emptyCollection(), NO_STICKERS, NO_STICKERS);
    expect(result.influence).toBe(0);
    expect(result.collection.instances).toEqual([]);
  });

  it('clearing the same mission twice only grants once (first-clear semantics)', () => {
    const m = mission({ influence: 1, unlockCardIds: ['granary'] });
    const first = computeRewards(m, false, emptyCollection(), NO_STICKERS, NO_STICKERS);
    const second = computeRewards(m, true, first.collection, NO_STICKERS, NO_STICKERS);
    expect(first.influence).toBe(1);
    expect(second.influence).toBe(0);
    expect(second.collection).toEqual(first.collection);
  });

  it('does not grant a second copy if the unlock card is already owned', () => {
    const m = mission({ influence: 1, unlockCardIds: ['granary'] });
    const result = computeRewards(m, false, collectionFromCounts({ granary: 2 }), NO_STICKERS, NO_STICKERS);
    expect(copiesOwned(result.collection, 'granary')).toBe(2);
  });

  it('grants every card of a multi-unlock reward on a first clear', () => {
    const m = mission({ influence: 0, unlockCardIds: ['farm', 'toolmaker', 'hut'] });
    const result = computeRewards(m, false, emptyCollection(), NO_STICKERS, NO_STICKERS);
    expect(result.influence).toBe(0);
    expect(copiesOwned(result.collection, 'farm')).toBe(1);
    expect(copiesOwned(result.collection, 'toolmaker')).toBe(1);
    expect(copiesOwned(result.collection, 'hut')).toBe(1);
  });

  it('grants only the not-yet-owned cards of a multi-unlock reward', () => {
    const m = mission({ influence: 0, unlockCardIds: ['farm', 'toolmaker'] });
    // Already owns `farm` (×2) — that count is untouched; the new `toolmaker` is granted once.
    const result = computeRewards(m, false, collectionFromCounts({ farm: 2 }), NO_STICKERS, NO_STICKERS);
    expect(copiesOwned(result.collection, 'farm')).toBe(2);
    expect(copiesOwned(result.collection, 'toolmaker')).toBe(1);
  });
});

describe('computeRewards — sticker unlocks', () => {
  it('unions a first clear\'s card- and board-sticker unlocks into the sets', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'], unlockBoardStickerIds: ['territory'] });
    const result = computeRewards(m, false, emptyCollection(), NO_STICKERS, NO_STICKERS);
    expect(result.unlockedStickers).toEqual({ irrigation: true });
    expect(result.unlockedBoardStickers).toEqual({ territory: true });
  });

  it('preserves already-unlocked stickers and is idempotent on a re-unlock', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'] });
    const result = computeRewards(m, false, emptyCollection(), { drainage: true }, NO_STICKERS);
    expect(result.unlockedStickers).toEqual({ drainage: true, irrigation: true });
  });

  it('does not unlock stickers on a replay (already-completed passes the sets through unchanged)', () => {
    const m = mission({ influence: 0, unlockStickerIds: ['irrigation'], unlockBoardStickerIds: ['territory'] });
    const result = computeRewards(m, true, emptyCollection(), NO_STICKERS, NO_STICKERS);
    expect(result.unlockedStickers).toEqual({});
    expect(result.unlockedBoardStickers).toEqual({});
  });
});

describe('computeRewards — infinite missions', () => {
  it('pays Influence equal to rounds survived, with no unlock', () => {
    const m = infiniteMission();
    const result = computeRewards(m, false, emptyCollection(), NO_STICKERS, NO_STICKERS, 10);
    expect(result.influence).toBe(10);
    expect(result.collection.instances).toEqual([]);
  });

  it('pays out on every attempt — "already completed" is meaningless for an infinite mission', () => {
    const m = infiniteMission();
    const result = computeRewards(m, true, emptyCollection(), NO_STICKERS, NO_STICKERS, 7);
    expect(result.influence).toBe(7);
  });

  it('passes the unlocked-sticker sets through untouched', () => {
    const m = infiniteMission();
    const result = computeRewards(m, false, emptyCollection(), { irrigation: true }, { territory: true }, 3);
    expect(result.unlockedStickers).toEqual({ irrigation: true });
    expect(result.unlockedBoardStickers).toEqual({ territory: true });
  });
});
