import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCards, installFixtures, mint, uninstallCards, uninstallFixtures } from '../rules/testFixtures';
import { addBuilding, addWork, blankState, seedObjective, type GameState } from '../rules';
import type { CardDef } from '../content/cards';
import { raceBreakdown, raceScore } from './race';

/** The factor the scale-invariance pair differs by. Every quantity on `race_goal_scaled` is this many
 *  times `race_goal`'s, and the measure stays *linear* in the pool — a `floor` anywhere inside it would
 *  make the invariance approximate and turn the assertion into a tolerance question. */
const SCALE = 3;

const FIXTURES: Record<string, CardDef> = {
  race_goal: {
    id: 'race_goal', name: 'Race Goal', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 10 }],
  },
  race_goal_scaled: {
    id: 'race_goal_scaled', name: 'Race Goal Scaled', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science * SCALE, target: 10 * SCALE }],
  },
  // Two further targets over the same economy, so a test can dial `T̂win` to a chosen number of rounds.
  race_goal_12: {
    id: 'race_goal_12', name: 'Race Goal 12', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 12 }],
  },
  race_goal_48: {
    id: 'race_goal_48', name: 'Race Goal 48', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 48 }],
  },
  // A work box on the goal's own pool: output in flight this turn, which the permanent projection drops.
  race_work_sci: {
    id: 'race_work_sci', name: 'Race Work Science', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { science: 3 } },
  },
};

beforeAll(() => {
  installFixtures();
  installCards(FIXTURES);
});
afterAll(() => {
  uninstallCards(FIXTURES);
  uninstallFixtures();
});

/**
 * A state whose whole economy is `producers` copies of `test_sci` (2🔬 per staffed worker). Food is
 * deep enough that the population's own upkeep never becomes the binding loss clock, so a case that
 * doesn't set out to test survival reads `T̂loss` as the horizon.
 */
function state(
  objectiveCardId: string,
  { science = 0, food = 10_000, population = 0, producers = 0 } = {},
): GameState {
  const G = blankState('race_test');
  G.round = 1;
  G.resources.science = science;
  G.resources.food = food;
  G.resources.population = Math.max(population, producers);
  seedObjective(G, objectiveCardId);
  for (let i = 0; i < producers; i++) addBuilding(G, mint(G, 'test_sci'));
  return G;
}

describe('scale invariance', () => {
  it('ranks corresponding states identically when a goal and its measure are scaled together', () => {
    // The fault the whole model exists to make unexpressible: the same race, described in units three
    // times as large, must be worth exactly the same.
    for (const { science, producers } of [
      { science: 0, producers: 1 },
      { science: 4, producers: 1 },
      { science: 7, producers: 2 },
      { science: 9, producers: 3 },
      { science: 10, producers: 1 },
    ]) {
      const plain = raceScore(state('race_goal', { science, producers }));
      const scaled = raceScore(state('race_goal_scaled', { science, producers }));
      expect(scaled).toBeCloseTo(plain, 10);
    }
  });
});

describe('T̂win', () => {
  it('prices a banked unit at the fraction of a round it saves', () => {
    // One producer is 2🔬 a round against a 10🔬 goal: 5 rounds. Two banked 🔬 is one of those rounds.
    const empty = raceBreakdown(state('race_goal', { producers: 1 }));
    const banked = raceBreakdown(state('race_goal', { science: 2, producers: 1 }));
    expect(empty.tWin).toBeCloseTo(5);
    expect(banked.tWin).toBeCloseTo(4);
    expect(banked.total).toBeGreaterThan(empty.total);
  });

  it('banks a staffed work box\'s output this turn without counting it as throughput', () => {
    const G = state('race_goal', { population: 2, producers: 1 });
    addWork(G, mint(G, 'race_work_sci'));
    const b = raceBreakdown(G);
    // The box's 3🔬 lands at upkeep, so it shortens the goal — but it produces once, so the per-round
    // rate stays the tableau's alone.
    expect(b.goals[0].tau).toBe(2);
    expect(b.goals[0].need).toBe(7);
    expect(b.tWin).toBeCloseTo(3.5);
  });

  it('reads a goal with no throughput as unwinnable rather than as a NaN', () => {
    const b = raceBreakdown(state('race_goal'), { maxRounds: 40 });
    expect(b.tWin).toBe(40);
    expect(b.tLoss).toBe(40);
    expect(Number.isFinite(b.total)).toBe(true);
  });
});

describe('deadline honesty', () => {
  it('credits a producer nothing when it cannot repay before the run is cut off', () => {
    const idle = state('race_goal');
    const staffed = state('race_goal', { producers: 1 });
    // 10🔬 at 2🔬 a round is 5 rounds; with 3 left, the producer buys nothing the run will ever collect.
    expect(raceScore(staffed, { maxRounds: 3 })).toBeCloseTo(raceScore(idle, { maxRounds: 3 }), 10);
    // The same producer against a horizon it fits inside is worth the rounds it saves.
    expect(raceScore(staffed, { maxRounds: 50 })).toBeGreaterThan(raceScore(idle, { maxRounds: 50 }));
  });
});

describe('T̂loss', () => {
  it('names the pool that runs out first', () => {
    const G = state('race_goal', { food: 7, population: 4 }); // 4🧍 eat 4🌾 a round
    const b = raceBreakdown(G);
    expect(b.lossCause).toBe('food');
    expect(b.tLoss).toBeCloseTo(7 / 4);
  });

  it('steepens the same losing margin as death draws nearer', () => {
    // Both races are 4 rounds short: 6 vs 2, and 24 vs 20. A drain of 2🌾 sets each loss clock.
    const near = state('race_goal_12', { food: 4, producers: 1 });
    const far = state('race_goal_48', { food: 40, producers: 1 });
    for (const G of [near, far]) G.threats.push(mint(G, 'test_threat'));
    const a = raceBreakdown(near);
    const b = raceBreakdown(far);
    expect(a.tLoss).toBeCloseTo(2);
    expect(b.tLoss).toBeCloseTo(20);
    expect(a.margin).toBeCloseTo(b.margin);
    expect(a.nearDeath).toBeLessThan(b.nearDeath);
    expect(a.total).toBeLessThan(b.total);
  });

  it('reads a pending defeat as no rounds left at all', () => {
    const G = state('race_goal', { producers: 1 });
    G.pendingDefeat = { reason: 'test' };
    const b = raceBreakdown(G);
    expect(b.tLoss).toBe(0);
    expect(b.lossCause).toBe('defeat');
  });
});

describe('victory', () => {
  it('dominates any margin the horizon can express', () => {
    const won = state('race_goal', { science: 10, producers: 1 });
    won.pendingVictory = true;
    expect(raceScore(won)).toBeGreaterThan(raceScore(state('race_goal', { producers: 3 })) + 1_000);
  });
});
