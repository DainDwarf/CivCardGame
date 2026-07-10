import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  blankState,
  defeatMet,
  dispatchEvent,
  evaluateDefeat,
  evaluateObjective,
  flushEvents,
  objectiveMet,
  seedObjective,
  snapshot,
} from '../rules';
import { seedMissionCards, type MissionDef } from '../content/missions';
import { installFixtures, uninstallFixtures } from './testFixtures';

// Relocated from `content/missions.test.ts` (Step 2.2): the shipped-number blocks (30 science, 2
// food/tick, round-12 deadline) are content and were dropped in 2.1-style; the *spine* they drove is
// re-asserted here on a synthetic mission built inline over the synthetic objective/threat/event
// fixtures. `seedMissionCards` reads no `MISSIONS` catalogue, so this survives an empty catalogue.
// `test_threat` drains −2🌾/tick, `test_deadline` owns a `round > 5` defeat, `test_objective` wins at
// 10🔬, `test_event` is a mission event.
const mission: MissionDef = {
  id: 'test', name: 'Test Mission', lore: '', prereqs: [],
  threats: ['test_threat'],
  events: ['test_event', 'test_event'],
  objectiveCardId: 'test_objective',
  victoryHint: '', failureHint: null, kind: 'standard',
};

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('seedMissionCards', () => {
  it('seeds the mission\'s threats into G.threats', () => {
    const G = blankState('test');
    seedMissionCards(mission, G);
    expect(G.threats).toEqual([{ id: 1, cardId: 'test_threat' }]);
  });

  it('shuffles the mission\'s events into the deck, one per entry', () => {
    const G = blankState('test');
    seedMissionCards(mission, G);
    expect(G.deck.filter((c) => c.cardId === 'test_event').length).toBe(2);
  });

  it('drains a seeded threat each tick via the endTurn broadcast (dispatchEvent → resolveEndTurn)', () => {
    const G = blankState('test');
    seedMissionCards(mission, G);
    G.resources.food = 5;
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3); // test_threat's flat −2🌾
  });
});

describe('objectiveMet — the objective card owns the win', () => {
  it("reads the seeded objective card's own predicate off G", () => {
    const G = blankState('test');
    seedObjective(G, mission.objectiveCardId);
    expect(objectiveMet(G)).toBe(false);
    G.resources.science = 10;
    expect(objectiveMet(G)).toBe(true);
  });
});

describe('defeatMet — a threat owns its driven defeat', () => {
  it('is null with no seeded threats', () => {
    const G = blankState('test');
    expect(defeatMet(G)).toBeNull();
  });

  it("reads the deadline threat's own defeat predicate off the seeded threat", () => {
    const G = blankState('test');
    G.threats = [{ id: 1, cardId: 'test_deadline' }];
    G.round = 5;
    expect(defeatMet(G)).toBeNull(); // round 5 itself is still fully playable
    G.round = 6;
    expect(defeatMet(G)).toEqual({ reason: 'test deadline' });
  });
});

describe('evaluateObjective — win flag is bus-driven (set-or-clear)', () => {
  it('re-derives G.pendingVictory from the objective card at every flush boundary', () => {
    const G = blankState('test');
    seedObjective(G, mission.objectiveCardId);
    G.resources.science = 9;
    flushEvents(G, snapshot(G));
    expect(G.pendingVictory).toBe(false); // short of 10
    G.resources.science = 10;
    flushEvents(G, snapshot(G));
    expect(G.pendingVictory).toBe(true); // threshold crossed → flag set at the flush
  });

  it('set-or-clear (never sticky): the flag reverts true→false when the verdict does', () => {
    const G = blankState('test');
    seedObjective(G, mission.objectiveCardId);
    G.resources.science = 10;
    evaluateObjective(G);
    expect(G.pendingVictory).toBe(true);
    G.resources.science = 5; // verdict reverts (e.g. a later cost spends the science back down)
    evaluateObjective(G);
    expect(G.pendingVictory).toBe(false); // reverted, not left stuck true
  });

  it('leaves pendingVictory false when no objective is seeded', () => {
    const G = blankState('test');
    flushEvents(G, snapshot(G));
    expect(G.pendingVictory).toBe(false);
  });
});

describe('evaluateDefeat — loss flag is bus-driven (set-or-clear)', () => {
  it('writes the derived verdict onto G.pendingDefeat, never sticky', () => {
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
