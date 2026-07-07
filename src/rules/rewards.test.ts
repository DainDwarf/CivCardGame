import { describe, it, expect } from 'vitest';
import { computeRewards } from './rewards';
import { MISSIONS } from '../content/missions';
import { CARDS } from '../content/cards';
import { copiesOwned, emptyCollection, collectionFromCounts } from './collection';
import type { MissionDef } from '../content/missions';

function mission(reward: MissionDef['reward']): MissionDef {
  return {
    id: 'm',
    name: 'm',
    lore: '',
    description: '',
    prereqs: [],
    objective: () => false,
    failure: () => false,
    progress: () => '',
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
    description: '',
    prereqs: [],
    objective: () => false,
    failure: () => false,
    progress: () => '',
    victoryHint: '',
    failureHint: null,
    kind: 'infinite',
  };
}

describe('computeRewards', () => {
  it('grants Influence and the unlock on a first clear', () => {
    const m = mission({ influence: 2, unlockCardId: 'granary' });
    const result = computeRewards(m, false, emptyCollection());
    expect(result.influence).toBe(2);
    expect(copiesOwned(result.collection, 'granary')).toBe(1);
  });

  it('grants nothing on a replay of an already-completed mission', () => {
    const m = mission({ influence: 2, unlockCardId: 'granary' });
    const result = computeRewards(m, true, emptyCollection());
    expect(result.influence).toBe(0);
    expect(result.collection.instances).toEqual([]);
  });

  it('clearing the same mission twice only grants once (first-clear semantics)', () => {
    const m = mission({ influence: 1, unlockCardId: 'granary' });
    const first = computeRewards(m, false, emptyCollection());
    const second = computeRewards(m, true, first.collection);
    expect(first.influence).toBe(1);
    expect(second.influence).toBe(0);
    expect(second.collection).toEqual(first.collection);
  });

  it('does not grant a second copy if the unlock card is already owned', () => {
    const m = mission({ influence: 1, unlockCardId: 'granary' });
    const result = computeRewards(m, false, collectionFromCounts({ granary: 2 }));
    expect(copiesOwned(result.collection, 'granary')).toBe(2);
  });

  it('every standard mission reward names a real card id', () => {
    for (const m of Object.values(MISSIONS)) {
      if (m.kind !== 'standard') continue;
      expect(CARDS[m.reward!.unlockCardId]).toBeDefined();
    }
  });
});

describe('computeRewards — infinite missions', () => {
  it('pays Influence equal to rounds survived, with no unlock', () => {
    const m = infiniteMission();
    const result = computeRewards(m, false, emptyCollection(), 10);
    expect(result.influence).toBe(10);
    expect(result.collection.instances).toEqual([]);
  });

  it('pays out on every attempt — "already completed" is meaningless for an infinite mission', () => {
    const m = infiniteMission();
    const result = computeRewards(m, true, emptyCollection(), 7);
    expect(result.influence).toBe(7);
  });
});
