import { describe, it, expect } from 'vitest';
import { scoreState } from './value';
import { blankState, type GameState } from '../rules';

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
      G.population = 5;
    });
    const fed = state((G) => {
      G.resources.food = 10;
      G.population = 0;
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
      G.culture = 30; // level 2 (bands at 10, 30)
    });
    expect(scoreState(cultured)).toBeGreaterThan(scoreState(noCulture));
  });

  it('lets a met objective dominate any non-winning state', () => {
    // A winning state that is otherwise dire (about to starve) must still outrank a lavish, unwon one.
    const won = state((G) => {
      G.resources.food = 0;
      G.population = 9;
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
