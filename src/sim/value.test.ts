import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scoreState } from './value';
import { addThreat, addWork, blankState, seedObjective, type GameState } from '../rules';
import { installFixtures, uninstallFixtures } from '../rules/testFixtures';

/** A zeroed sandbox state to tweak per case. `scoreState` reads `projectedDelta`/`applyUpkeep`, which
 *  run a full upkeep on a clone — harmless on a bare state (no threats/objective/hand). */
function state(mut: (G: GameState) => void): GameState {
  const G = blankState('sandbox');
  mut(G);
  return G;
}

describe('scoreState', () => {
  // The threat fixtures (`test_threat`, `test_escalating`) must be installed in the live catalogue for
  // `addThreat` → `resolveCard`/`resolveUpkeep` to resolve their drain.
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

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
    // A staffed Beer box produces 🎭 culture — a *strategic* pool, absent from `CORE_KEYS`, so it lands
    // in none of the core-only bands (2, 3, 5) until upkeep, and band 4 reads *current* culture. The flat
    // per-operating-box credit is therefore the ONLY term that makes the one-ply greedy staff it. Same
    // population either way (identical food drain), so the sole difference is whether Beer operates.
    const staffed = state((G) => {
      G.resources.food = 5;
      G.resources.population = 1;
      addWork(G, 'beer'); // auto-staffs the one idle worker
    });
    const unstaffed = state((G) => {
      G.resources.food = 5;
      G.resources.population = 1;
      addWork(G, 'beer');
      G.workZone[0].workers = 0; // same box + population, but idle ⇒ not operating
    });
    expect(scoreState(staffed)).toBeGreaterThan(scoreState(unstaffed));
  });

  it('rewards staffing a producer of what the OBJECTIVE needs over an equal-count survival producer (band 4, projected)', () => {
    // Growing Numbers wants territory (grown by a staffed Conquest, whose territory lands only at upkeep).
    // With one worker, staffing Conquest vs. Foraging (food) leaves the *operating count identical* — so
    // the flat staffing credit can't distinguish them, and Foraging even wins band 5 (projected food). Only
    // band 4 read on the *projected* state (Conquest's next-upkeep territory advancing the goal) tips it
    // toward Conquest. Fails if band 4 reads the *current* state — the exact regression that hung the greedy
    // on this deadline-free mission, invisible to every other test.
    const conquest = state((G) => {
      seedObjective(G, 'growing_numbers_goal');
      G.resources.food = 5;
      G.resources.population = 1;
      G.resources.territory = 0; // below the goal's 2-slot need, so growing territory is real progress
      addWork(G, 'conquest'); // auto-staffs the one idle worker → +territory next upkeep
    });
    const foraging = state((G) => {
      seedObjective(G, 'growing_numbers_goal');
      G.resources.food = 5;
      G.resources.population = 1;
      G.resources.territory = 0;
      addWork(G, 'foraging'); // same operating count, but its output (food) doesn't advance the goal
    });
    expect(scoreState(conquest)).toBeGreaterThan(scoreState(foraging));
  });

  it('rewards a state closer to the mission objective, all else equal (band 4)', () => {
    // Two states with identical resources except one is *nearer* the seeded objective ("The First
    // Settlement" wants 10🔨 + 10⚔️). The nearer one must score higher — the goal-directed pull that
    // makes the greedy stockpile toward the win rather than drift at a survival equilibrium.
    const near = state((G) => {
      seedObjective(G, 'first_settlement_goal');
      G.resources.food = 5;
      G.resources.production = 9;
      G.resources.military = 9;
    });
    const far = state((G) => {
      seedObjective(G, 'first_settlement_goal');
      G.resources.food = 5;
      G.resources.production = 9;
      G.resources.military = 1;
    });
    expect(scoreState(near)).toBeGreaterThan(scoreState(far));
  });

  it('the objective pull never overrides survival — a near-win but starving state scores below a fed one', () => {
    // Progress is capability-tier, not victory-tier: a state one step from the objective but about to
    // starve must still score below a safely-fed state that is further from the goal. (Contrast the
    // `pendingVictory` case below, where an *already-won* run dominates outright.)
    const starvingNearWin = state((G) => {
      seedObjective(G, 'first_settlement_goal');
      G.resources.food = 0;
      G.resources.population = 5; // eats 5 into the red next round
      G.resources.production = 9;
      G.resources.military = 9;
    });
    const fedFarFromGoal = state((G) => {
      seedObjective(G, 'first_settlement_goal');
      G.resources.food = 10;
      G.resources.population = 0;
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
