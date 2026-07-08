import { describe, it, expect } from 'vitest';
import { resolveHandEvents, projectedDelta, applyUpkeep } from './upkeep';
import { blankState, instancesFromCardIds } from './state';

describe('projectedDelta — event-bus reachability', () => {
  it('reflects an upkeep-triggered handler in the HUD preview (Treasury crossing 10 during production)', () => {
    // Market produces +2💰 during upkeep, pushing money 9 → 11, which crosses Treasury's threshold
    // and pays +5🔬. Because applyUpkeep flushes the bus, projectedDelta (which clones + runs upkeep)
    // must show that +5🔬 — otherwise the preview would lie about what ending the turn does.
    const G = blankState('enlightenment');
    G.resources.money = 9;
    G.tableau = [
      { id: 1, cardId: 'market', workers: 1 },
      { id: 2, cardId: 'treasury', workers: 1 },
    ];
    const delta = projectedDelta(G);
    expect(delta.resources.money).toBe(2); // market's production
    expect(delta.resources.science).toBe(5); // Treasury reacting to the 30-crossing, mid-upkeep
    expect(G.resources.science).toBe(0); // projection is a dry run — real G untouched
    expect(G.events).toEqual([]); // and no events leaked onto the real G
  });
});

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
  it('resolves a seeded threat as part of the normal upkeep pass', () => {
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'barbarian' }];
    applyUpkeep(G);
    expect(G.resources.military).toBe(6); // barbarian's own resolver applied its flat -4 loss
  });
});

describe('applyUpkeep production', () => {
  it('resolves staffed buildings and Work cards through their own production', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'corvee', workers: 1 }];
    applyUpkeep(G);
    expect(G.resources.food).toBe(2); // farm's +2🌾; blankState has 0 population, so none eaten
    expect(G.resources.production).toBe(3); // corvée's +3🔨
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
