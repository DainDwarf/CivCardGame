import { describe, it, expect } from 'vitest';
import { computeRewards } from './rewards';
import { MISSIONS } from '../content/missions';
import { CARDS } from '../content/cards';
import type { MissionDef } from '../content/missions';

function mission(reward: MissionDef['reward']): MissionDef {
  return {
    id: 'm',
    name: 'm',
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

describe('computeRewards', () => {
  it('grants Influence and the unlock on a first clear', () => {
    const m = mission({ influence: 2, unlockCardId: 'granary' });
    const result = computeRewards(m, false, {});
    expect(result.influence).toBe(2);
    expect(result.collection.granary).toBe(1);
  });

  it('grants nothing on a replay of an already-completed mission', () => {
    const m = mission({ influence: 2, unlockCardId: 'granary' });
    const result = computeRewards(m, true, {});
    expect(result.influence).toBe(0);
    expect(result.collection).toEqual({});
  });

  it('clearing the same mission twice only grants once (first-clear semantics)', () => {
    const m = mission({ influence: 1, unlockCardId: 'granary' });
    const first = computeRewards(m, false, {});
    const second = computeRewards(m, true, first.collection);
    expect(first.influence).toBe(1);
    expect(second.influence).toBe(0);
    expect(second.collection).toEqual(first.collection);
  });

  it('does not grant a second copy if the unlock card is already owned', () => {
    const m = mission({ influence: 1, unlockCardId: 'granary' });
    const result = computeRewards(m, false, { granary: 2 });
    expect(result.collection.granary).toBe(2);
  });

  it('every mission reward names a real card id', () => {
    for (const m of Object.values(MISSIONS)) {
      expect(CARDS[m.reward.unlockCardId]).toBeDefined();
    }
  });
});
