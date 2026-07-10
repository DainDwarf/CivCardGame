import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveHandEvents, projectedDelta, applyUpkeep } from './upkeep';
import { blankState, instancesFromCardIds } from './state';
import { installFixtures, uninstallFixtures } from './testFixtures';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('projectedDelta — event-bus reachability', () => {
  it('reflects an upkeep-triggered handler in the HUD preview (Treasury crossing 10 during production)', () => {
    // test_money produces +2💰 during upkeep, pushing money 9 → 11, which crosses test_threshold's
    // threshold and pays +5🔬. Because applyUpkeep flushes the bus, projectedDelta (which clones + runs
    // upkeep) must show that +5🔬 — otherwise the preview would lie about what ending the turn does.
    const G = blankState('test');
    G.resources.money = 9;
    G.tableau = [
      { id: 1, cardId: 'test_money', workers: 1 },
      { id: 2, cardId: 'test_threshold', workers: 1 },
    ];
    const delta = projectedDelta(G);
    expect(delta.resources.money).toBe(2); // test_money's production
    expect(delta.resources.science).toBe(5); // test_threshold reacting to the 10-crossing, mid-upkeep
    expect(G.resources.science).toBe(0); // projection is a dry run — real G untouched
    expect(G.events).toEqual([]); // and no events leaked onto the real G
  });
});

describe('resolveHandEvents', () => {
  it('applies an event left in hand and destroys it to the removed pile', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_food', 'test_event', 'test_prod']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(8); // test_event drained 2
    expect(G.removed.map((c) => c.cardId)).toEqual(['test_event']);
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod']); // non-events stay for the discard sweep
    expect(G.discard).toEqual([]); // test_event's effect.remove sends it to removed, not discard
  });

  it('resolves every event in the hand in one sweep', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_event', 'test_event']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(6); // 10 - 2 - 2
    expect(G.removed.map((c) => c.cardId)).toEqual(['test_event', 'test_event']);
    expect(G.hand).toEqual([]);
  });

  it('is a no-op when the hand holds no events', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food', 'test_prod']);
    resolveHandEvents(G);
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod']);
    expect(G.removed).toEqual([]);
  });
});

describe('applyUpkeep with a threat', () => {
  it('resolves a seeded threat as part of the normal upkeep pass', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'test_event' }];
    applyUpkeep(G);
    expect(G.resources.military).toBe(8); // test_event's own resolver applied its flat -2 loss
  });
});

describe('applyUpkeep production', () => {
  it('resolves staffed buildings and Work cards through their own production', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'test_work', workers: 1 }];
    applyUpkeep(G);
    expect(G.resources.food).toBe(2); // test_food's +2🌾; blankState has 0 population, so none eaten
    expect(G.resources.production).toBe(3); // test_work's +3🔨
  });
});

describe('projectedDelta with events', () => {
  it("folds an event card sitting in hand into the projected military delta", () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_event']);
    expect(projectedDelta(G).resources.military).toBe(-2);
  });
});
