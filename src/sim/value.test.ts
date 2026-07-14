import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scoreState } from './value';
import { addThreat, addWork, blankState, seedObjective, type GameState } from '../rules';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures, installCards, uninstallCards } from '../rules/testFixtures';

/**
 * Local fixtures for the objective-pull bands. A *strategic*-resource goal (culture, absent from
 * `CORE_KEYS`) is what isolates band 4 from band 5: a culture producer advances the goal but shows up in
 * none of the core-only bands, so a survival (food) producer even wins band 5 — only band 4's *projected*
 * read can tip the balance toward culture. Both producers are `work` cards on purpose: `permanentDelta`
 * (value.ts) drops the work zone before running upkeep, so band 3 sees only population food drain and
 * stays symmetric between them — no food buffer tuning against the (re-fittable) `bufferFloor`/`bufferTurns`.
 */
const LOCAL_CARDS = {
  // A staffable strategic producer (culture, cost {} so it stays a work box). Serves both the
  // staffing-credit test and the objective-directed Conquest analog.
  test_work_culture: {
    id: 'test_work_culture', name: 'Test Work Culture', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { culture: 2 } },
  },
  // A shallow strategic goal (4🎭) — its declarative goal yields the band-4 gradient `min(culture,4)/4`,
  // so one +2🎭 round is a big band-4 step.
  test_culture_goal: {
    id: 'test_culture_goal', name: 'Test Culture Goal', kind: 'objective', cost: {},
    goals: [{ icon: '🎭', measure: (G) => G.resources.culture, target: 4 }],
    display: { description: 'Reach 4 Culture.' },
  },
} satisfies Record<string, CardDef>;

/** A zeroed sandbox state to tweak per case. `scoreState` reads `projectedDelta`/`applyUpkeep`, which
 *  run a full upkeep on a clone — harmless on a bare state (no threats/objective/hand). */
function state(mut: (G: GameState) => void): GameState {
  const G = blankState('test');
  mut(G);
  return G;
}

describe('scoreState', () => {
  // The threat fixtures (`test_threat`, `test_escalating`) and the local culture producer/goal must be in
  // the live catalogue for `addThreat`/`addWork`/`seedObjective` to resolve; the culture goal's band-4
  // gradient derives from its own declarative `goals`, so no separate registry splice is needed.
  beforeAll(() => {
    installFixtures();
    installCards(LOCAL_CARDS);
  });
  afterAll(() => {
    uninstallCards(LOCAL_CARDS);
    uninstallFixtures();
  });

  it('punishes a projected food deficit far below a healthy buffer (band 2)', () => {
    // 5 mouths, no food income ⇒ next round eats 5 into the red. Zero mouths with a stocked pantry is
    // safe. The starving state must score well below the fed one despite its extra population.
    const starving = state((G) => {
      G.resources.food = 0;
      G.resources.population = 5;
    });
    const fed = state((G) => {
      G.resources.food = 10;
      G.resources.population = 0;
    });
    expect(scoreState(starving)).toBeLessThan(scoreState(fed));
    // And the penalty is real (negative), not merely smaller.
    expect(scoreState(starving)).toBeLessThan(0);
  });

  it('punishes a projected deficit in ANY core pool, not just food (band 2)', () => {
    // `test_escalating` drains 1🔨/round; with no production banked, next round goes red — a `ruin`
    // collapse, which band 2 must react to exactly as it does to famine (the food-only band was
    // under-modeling: `coreCollapse` loses the run on any negative core pool).
    const ruinBound = state((G) => {
      G.resources.food = 5;
      addThreat(G, 'test_escalating');
    });
    const safe = state((G) => {
      G.resources.food = 5;
    });
    expect(scoreState(ruinBound)).toBeLessThan(scoreState(safe));
    // Collapse-scale (band 2), not a mere band-3 buffer nudge — the drop is far beyond a shortfall term.
    expect(scoreState(safe) - scoreState(ruinBound)).toBeGreaterThan(400);
  });

  it('demands a larger mid-term reserve when a permanent drain exists (band 3)', () => {
    // Same 5🌾 banked either way, and both are safe *next* round (band 2 quiet: 5 − 2 ≥ 0). But the
    // permanent −2🌾/round drain means 5 no longer covers ~3 turns, so band 3 penalises the reserve —
    // the whole point of scoring against `permanentDelta` rather than the transient projection.
    const withDrain = state((G) => {
      G.resources.food = 5;
      addThreat(G, 'test_threat');
    });
    const noDrain = state((G) => {
      G.resources.food = 5;
    });
    expect(scoreState(withDrain)).toBeLessThan(scoreState(noDrain));
  });

  it('is monotonic in banked core resources, all else equal (bands 3 & 5)', () => {
    const base = state((G) => {
      G.resources.food = 5;
    });
    const richer = state((G) => {
      G.resources.food = 5;
      G.resources.science = 10;
    });
    expect(scoreState(richer)).toBeGreaterThan(scoreState(base));
  });

  it('does not reward a strategic pool intrinsically — its value flows through the objective only', () => {
    // The old sandbox value function rewarded raw culture level directly; the reshaped one does not.
    // With no culture objective seeded, banking culture is worth exactly nothing on its own — culture,
    // territory, and population matter only through band 4 (or, for population, its food cost in band 3).
    const none = state((G) => {
      G.resources.food = 5;
    });
    const cultured = state((G) => {
      G.resources.food = 5;
      G.resources.culture = 30;
    });
    expect(scoreState(cultured)).toBe(scoreState(none));
  });

  it('rewards staffing a strategic-resource producer, which no band can see (staffing credit)', () => {
    // A staffed culture producer yields a *strategic* pool, absent from `CORE_KEYS`, so it lands in none
    // of the core-only bands (2, 3, 5) until upkeep, and band 4 is flat here (no objective seeded). The
    // flat per-operating-box credit is therefore the ONLY term that makes the one-ply greedy staff it.
    // Same population either way (identical food drain), so the sole difference is whether the box operates.
    const staffed = state((G) => {
      G.resources.food = 5;
      G.resources.population = 1;
      addWork(G, 'test_work_culture'); // auto-staffs the one idle worker
    });
    const unstaffed = state((G) => {
      G.resources.food = 5;
      G.resources.population = 1;
      addWork(G, 'test_work_culture');
      G.workZone[0].workers = 0; // same box + population, but idle ⇒ not operating
    });
    expect(scoreState(staffed)).toBeGreaterThan(scoreState(unstaffed));
  });

  it('rewards staffing a producer of what the OBJECTIVE needs over an equal-count survival producer (band 4, projected)', () => {
    // The goal wants culture (grown by a staffed culture box, whose culture lands only at upkeep). With one
    // worker, staffing the culture box vs. a food box leaves the *operating count identical* — so the flat
    // staffing credit can't distinguish them, and the food box even wins band 5 (projected food). Both are
    // work cards, so band 3 (which drops the work zone) is symmetric too. Only band 4 read on the
    // *projected* state (the culture box's next-upkeep culture advancing the goal) tips it toward culture.
    // Fails if band 4 reads the *current* state — the exact regression that hung the greedy on a
    // deadline-free mission, invisible to every other test.
    const culture = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 5;
      G.resources.population = 1;
      G.resources.culture = 0; // below the 4🎭 goal, so growing culture is real progress
      addWork(G, 'test_work_culture'); // auto-staffs the one idle worker → +culture next upkeep
    });
    const food = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 5;
      G.resources.population = 1;
      G.resources.culture = 0;
      addWork(G, 'test_work_food'); // same operating count, but its output (food) doesn't advance the goal
    });
    expect(scoreState(culture)).toBeGreaterThan(scoreState(food));
  });

  it('rewards a state closer to the mission objective, all else equal (band 4)', () => {
    // Two states with identical resources except one is *nearer* the seeded objective (4🎭 culture). The
    // nearer one must score higher — the goal-directed pull that makes the greedy stockpile toward the win
    // rather than drift at a survival equilibrium. Culture is strategic, so bands 2/3/5 are neutral and the
    // gap is band 4 alone.
    const near = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 5;
      G.resources.culture = 3;
    });
    const far = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 5;
      G.resources.culture = 1;
    });
    expect(scoreState(near)).toBeGreaterThan(scoreState(far));
  });

  it('the objective pull never overrides survival — a near-win but starving state scores below a fed one', () => {
    // Progress is capability-tier, not victory-tier: a state one step from the objective but about to
    // starve must still score below a safely-fed state that is further from the goal. (Contrast the
    // `pendingVictory` case below, where an *already-won* run dominates outright.)
    const starvingNearWin = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 0;
      G.resources.population = 5; // eats 5 into the red next round
      G.resources.culture = 3; // near the 4🎭 goal
    });
    const fedFarFromGoal = state((G) => {
      seedObjective(G, 'test_culture_goal');
      G.resources.food = 10;
      G.resources.population = 0;
      G.resources.culture = 0;
    });
    expect(scoreState(starvingNearWin)).toBeLessThan(scoreState(fedFarFromGoal));
  });

  it('lets a met objective dominate any non-winning state (band 1)', () => {
    // A winning state that is otherwise dire (about to starve) must still outrank a lavish, unwon one.
    const won = state((G) => {
      G.resources.food = 0;
      G.resources.population = 9;
      G.pendingVictory = true;
    });
    const richLoss = state((G) => {
      G.resources.food = 50;
      G.resources.science = 50;
      G.resources.production = 50;
      G.resources.military = 50;
      G.resources.money = 50;
    });
    expect(scoreState(won)).toBeGreaterThan(scoreState(richLoss));
  });
});
