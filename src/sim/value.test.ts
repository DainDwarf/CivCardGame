import { describe, it, expect } from 'vitest';
import { scoreState } from './value';
import { blankState, seedObjective, type GameState } from '../rules';

/** A zeroed sandbox state to tweak per case. `scoreState` reads `projectedDelta`, which runs a full
 *  upkeep on a clone — harmless on a bare state (no threats/objective/hand). */
function state(mut: (G: GameState) => void): GameState {
  const G = blankState('sandbox');
  mut(G);
  return G;
}

describe('scoreState', () => {
  it('punishes a projected food deficit far below a healthy buffer', () => {
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

  it('is monotonic in banked capability resources, all else equal', () => {
    const base = state((G) => {
      G.resources.food = 5;
    });
    const richer = state((G) => {
      G.resources.food = 5;
      G.resources.science = 10;
    });
    expect(scoreState(richer)).toBeGreaterThan(scoreState(base));
  });

  it('rewards a higher culture level', () => {
    const noCulture = state((G) => {
      G.resources.food = 5;
    });
    const cultured = state((G) => {
      G.resources.food = 5;
      G.resources.culture = 30; // level 2 (bands at 10, 30)
    });
    expect(scoreState(cultured)).toBeGreaterThan(scoreState(noCulture));
  });

  it('rewards culture accumulating *within* a band, not only at the discrete level-up', () => {
    // 5 culture is still level 0, but must out-score 0 culture — otherwise a single culture play (+2,
    // never enough to cross a band alone) moves the score by nothing and the greedy never invests in a
    // culture goal. Regression guard for the sub-level fix.
    const none = state((G) => (G.resources.food = 5));
    const some = state((G) => {
      G.resources.food = 5;
      G.resources.culture = 5; // within band 0 — no level-up yet
    });
    expect(scoreState(some)).toBeGreaterThan(scoreState(none));
  });

  it('rewards a state closer to the mission objective, all else equal', () => {
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

  it('lets a met objective dominate any non-winning state', () => {
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
