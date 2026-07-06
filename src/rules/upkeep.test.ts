import { describe, it, expect } from 'vitest';
import { resolveHandEvents, projectedDelta, applyUpkeep } from './upkeep';
import { blankState, instancesFromCardIds } from './state';

describe('resolveHandEvents', () => {
  it('applies an event left in hand and destroys it to the removed pile', () => {
    const G = blankState('barbarian_tide');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['farm', 'barbarian', 'workshop']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(6); // barbarian drained 4
    expect(G.removed.map((c) => c.cardId)).toEqual(['barbarian']);
    expect(G.hand.map((c) => c.cardId)).toEqual(['farm', 'workshop']); // non-events stay for the discard sweep
    expect(G.discard).toEqual([]); // barbarian's effect.remove sends it to removed, not discard
  });

  it('resolves every event in the hand in one sweep', () => {
    const G = blankState('barbarian_tide');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['barbarian', 'barbarian']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(2);
    expect(G.removed.map((c) => c.cardId)).toEqual(['barbarian', 'barbarian']);
    expect(G.hand).toEqual([]);
  });

  it('is a no-op when the hand holds no events', () => {
    const G = blankState('enlightenment');
    G.hand = instancesFromCardIds(['farm', 'workshop']);
    resolveHandEvents(G);
    expect(G.hand.map((c) => c.cardId)).toEqual(['farm', 'workshop']);
    expect(G.removed).toEqual([]);
  });
});

describe('applyUpkeep with a threat', () => {
  it('ticks a seeded threat as part of the normal upkeep pass', () => {
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'barbarian', level: 1 }];
    applyUpkeep(G);
    expect(G.resources.military).toBe(6); // barbarian's base loss (4) * level (1)
    expect(G.threats[0].level).toBe(2);
  });
});

describe('projectedDelta with events', () => {
  it("folds a barbarian sitting in hand into the projected military delta", () => {
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['barbarian']);
    expect(projectedDelta(G).resources.military).toBe(-4);
  });
});
