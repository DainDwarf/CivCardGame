import { describe, it, expect } from 'vitest';
import { isCompleted, isAvailable, availableMissions, standardMissionProgress } from './campaign';
import type { MissionDef } from '../content/missions';

function mission(id: string, prereqs: string[]): MissionDef {
  return {
    id,
    name: id,
    lore: '',
    prereqs,
    objectiveCardId: 'long_winter_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 0, unlockCardIds: ['farm'] },
    map: { col: 0, row: 0 },
  };
}

describe('campaign', () => {
  const root = mission('root', []);
  const child = mission('child', ['root']);
  const grandchild = mission('grandchild', ['root', 'child']);

  it('isCompleted reads mapProgress by mission id', () => {
    expect(isCompleted({}, 'root')).toBe(false);
    expect(isCompleted({ root: true }, 'root')).toBe(true);
  });

  it('a root mission (no prereqs) is available on empty progress', () => {
    expect(isAvailable(root, {})).toBe(true);
  });

  it('a mission with an unmet prereq is blocked', () => {
    expect(isAvailable(child, {})).toBe(false);
    expect(isAvailable(grandchild, { root: true })).toBe(false);
  });

  it('a mission becomes available once all its prereqs are completed', () => {
    expect(isAvailable(child, { root: true })).toBe(true);
    expect(isAvailable(grandchild, { root: true, child: true })).toBe(true);
  });

  it('a completed mission stays available (replayable), not hidden again', () => {
    expect(isAvailable(root, { root: true })).toBe(true);
  });

  it('availableMissions filters a registry down to the unlocked set', () => {
    const registry = { root, child, grandchild };
    expect(availableMissions(registry, {}).map((m) => m.id)).toEqual(['root']);
    expect(availableMissions(registry, { root: true }).map((m) => m.id).sort()).toEqual(['child', 'root']);
    expect(
      availableMissions(registry, { root: true, child: true })
        .map((m) => m.id)
        .sort(),
    ).toEqual(['child', 'grandchild', 'root']);
  });

  it('standardMissionProgress counts cleared standard missions over the standard total, ignoring infinite ones', () => {
    const endless: MissionDef = { ...mission('endless', []), kind: 'infinite', reward: undefined };
    const registry = { root, child, grandchild, endless };
    // 3 standard missions; endless is excluded from both numerator and denominator.
    expect(standardMissionProgress(registry, {})).toEqual({ cleared: 0, total: 3 });
    expect(standardMissionProgress(registry, { root: true, child: true })).toEqual({ cleared: 2, total: 3 });
    // An infinite mission id in mapProgress (shouldn't happen, but be robust) never counts.
    expect(standardMissionProgress(registry, { endless: true } as Record<string, true>)).toEqual({ cleared: 0, total: 3 });
  });
});
