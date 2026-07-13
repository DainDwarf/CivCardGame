import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { addThreat, defeatMet, evaluateDefeat } from './threats';
import { dispatchEvent } from './events';
import { nextInstanceId } from './population';
import { blankState } from './state';
import { installCards, installFixtures, uninstallCards, uninstallFixtures } from './testFixtures';
import type { CardDef } from '../content/cards';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('addThreat', () => {
  it('seeds a threat bare, no counters yet', () => {
    const G = blankState('test');
    addThreat(G, 'test_event');
    expect(G.threats).toEqual([{ id: 1, cardId: 'test_event' }]);
  });

  it('shares the run-wide instance-id space', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    addThreat(G, 'test_event');
    expect(G.threats[0].id).toBe(2);
    expect(nextInstanceId(G)).toBe(3);
  });

  // A threat's seed is its one "on entry" moment: `addThreat` resolves the threat's `effect` once (the
  // counterpart to an action resolving on play). Its recurring drain stays on `upkeep`, untouched here.
  it("resolves the threat's one-time entry `effect` once at seed", () => {
    const ENTRY_THREAT: Record<string, CardDef> = {
      test_entry_threat: {
        id: 'test_entry_threat', name: 'Entry Threat', kind: 'threat', cost: {},
        effect: { resources: { money: -3 } }, upkeep: { resources: { food: -1 } },
      },
    };
    installCards(ENTRY_THREAT);
    try {
      const G = blankState('test');
      G.resources.money = 10;
      const foodBefore = G.resources.food;
      addThreat(G, 'test_entry_threat');
      expect(G.resources.money).toBe(7); // the entry effect fired exactly once at seed
      expect(G.resources.food).toBe(foodBefore); // recurring upkeep is a separate slot, not fired at seed
    } finally {
      uninstallCards(ENTRY_THREAT);
    }
  });
});

// Threats tick through the `endTurn` broadcast: dispatchEvent → resolveEndTurn runs each threat's
// own `resolveCard` drain (escalation included), the same resolver spine every card uses. With an
// empty tableau/workZone an `endTurn` dispatch resolves exactly the board's threats.
describe('threat drains on the endTurn broadcast', () => {
  it('resolves each threat through its own resolver spine', () => {
    // test_event has no bespoke resolve, so its declarative default (a flat -2 military) applies
    // unscaled on every tick — the drain has no opinion on escalation, only the card does.
    const G = blankState('test');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'test_event' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(8);
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(6);
  });

  it('is a no-op when there are no threats (or anything else in play)', () => {
    const G = blankState('test');
    G.resources.military = 5;
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(5);
    expect(G.threats).toEqual([]);
  });

  it('resolves Test Threat — a flat, non-escalating Food drain', () => {
    const G = blankState('test');
    G.resources.food = 5;
    G.threats = [{ id: 1, cardId: 'test_threat' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3);
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(1); // unscaled — no counter
  });

  it('resolves Test Escalating as an escalating Production drain via its own counter', () => {
    const G = blankState('test');
    G.resources.production = 10;
    G.threats = [{ id: 1, cardId: 'test_escalating' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(9); // -1, scaleResources({production:1}, 0+1)
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(7); // -2 more, scaleResources({production:1}, 1+1)
    expect(G.threats[0].counters).toEqual({ level: 2 });
  });
});

// A threat's driven defeat (Test Deadline's round-5 deadline) is a pure `defeat` predicate, read by
// `defeatMet`/`evaluateDefeat` — the loss counterpart to `objective.ts`'s `objectiveMet`/
// `evaluateObjective`. See also `content/missions.test.ts` (a deadline threat's own predicate) and
// `rules/events.test.ts` (`flushEvents` re-deriving it, including the set-OR-CLEAR regression).
describe('defeatMet / evaluateDefeat', () => {
  it('is null with no seeded threats', () => {
    const G = blankState('test');
    expect(defeatMet(G)).toBeNull();
  });

  it('reads Test Deadline\'s own defeat predicate off the seeded threat', () => {
    const G = blankState('test');
    G.threats = [{ id: 1, cardId: 'test_deadline' }];
    G.round = 5;
    expect(defeatMet(G)).toBeNull(); // round 5 itself is still fully playable
    G.round = 6;
    expect(defeatMet(G)).toEqual({ reason: 'test deadline' });
  });

  it('evaluateDefeat writes the derived verdict onto G.pendingDefeat, set-or-clear', () => {
    const G = blankState('test');
    G.threats = [{ id: 1, cardId: 'test_deadline' }];
    G.round = 6;
    evaluateDefeat(G);
    expect(G.pendingDefeat).toEqual({ reason: 'test deadline' });
    G.round = 5; // not reachable via real play (round only advances), but proves it isn't sticky
    evaluateDefeat(G);
    expect(G.pendingDefeat).toBeNull();
  });
});
