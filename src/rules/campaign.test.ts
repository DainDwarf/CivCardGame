import { describe, it, expect } from 'vitest';
import {
  isCompleted,
  isAvailable,
  availableMissions,
  standardMissionProgress,
  prereqClosure,
  foldOrder,
  cumulativeInfluenceInto,
} from './campaign';
import { MISSIONS, type MissionDef } from '../content/missions';

function mission(id: string, prereqs: string[], influence = 0): MissionDef {
  return {
    id,
    name: id,
    lore: '',
    prereqs,
    objectiveCardId: 'long_winter_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    reward: { influence, unlockCardIds: ['farm'] },
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

describe('campaign DAG walk', () => {
  // A small diamond: two branches (a, b) from root, joined at join.
  const root = mission('root', [], 5);
  const a = mission('a', ['root'], 3);
  const b = mission('b', ['root'], 4);
  const join = mission('join', ['a', 'b'], 10);
  const registry = { root, a, b, join };

  it('prereqClosure collects a target plus all its transitive prereqs', () => {
    expect([...prereqClosure(registry, ['join'])].sort()).toEqual(['a', 'b', 'join', 'root']);
    expect([...prereqClosure(registry, ['a'])].sort()).toEqual(['a', 'root']);
  });

  it('prereqClosure throws on a prereq that does not exist', () => {
    expect(() => prereqClosure({ orphan: mission('orphan', ['ghost']) }, ['orphan'])).toThrow(/doesn't exist/);
  });

  it('foldOrder topologically sorts a closure so every prereq precedes its dependant', () => {
    const order = foldOrder(registry, prereqClosure(registry, ['join'])).map((m) => m.id);
    expect(order.indexOf('root')).toBeLessThan(order.indexOf('a'));
    expect(order.indexOf('root')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('join'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('join'));
  });

  it('cumulativeInfluenceInto sums prereq rewards but excludes the mission itself', () => {
    // Into join: root(5) + a(3) + b(4) = 12; join's own 10 is not yet in the wallet.
    expect(cumulativeInfluenceInto(registry, 'join')).toBe(12);
    expect(cumulativeInfluenceInto(registry, 'a')).toBe(5); // just root
    expect(cumulativeInfluenceInto(registry, 'root')).toBe(0); // a DAG root has no income yet
  });

  it('cumulativeInfluenceInto ignores infinite-mission prereqs (they have no fixed reward)', () => {
    const scored = { ...mission('scored', ['root']), kind: 'infinite' as const, reward: undefined };
    expect(cumulativeInfluenceInto({ root, scored }, 'scored')).toBe(5); // root only; scored pays per attempt
  });

  it('pins the real campaign: Influence arriving at Masonry', () => {
    // The guaranteed faucet into masonry — the anchor the economy ledger reports.
    expect(cumulativeInfluenceInto(MISSIONS, 'masonry')).toBe(52);
  });
});
