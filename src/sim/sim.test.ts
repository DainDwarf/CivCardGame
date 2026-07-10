import { describe, it, expect } from 'vitest';
import { simulateRun, createRandomPolicy, simConfig } from './index';
import { DEFAULT_DECKS } from '../content/decks';
import { SANDBOX_DEADLINE } from '../content/cards';

// Step 4's first deliverable: a bounded-termination smoke test that also exercises the fuzzer teeth
// (invariant checks are on by default). It runs the *real* Founding deck on the Tribe board against
// the sandbox mission across many policy seeds — the sandbox's ~50-round deadline guarantees every
// random run terminates, and its non-winnable objective guarantees every outcome is a defeat.
const FOUNDING = DEFAULT_DECKS[0].cards;

describe('headless simulator — sandbox smoke', () => {
  it('every random-policy run terminates in defeat within the sandbox deadline', () => {
    for (let s = 0; s < 50; s++) {
      const config = simConfig({
        deckCardIds: FOUNDING,
        board: 'tribe',
        missionId: 'sandbox',
        seed: `cfg-${s}`,
      });
      // No throw here means: the run reached gameover under the action cap AND every post-step
      // invariant held (bus drained, unique ids, staffing/population bounds).
      const outcome = simulateRun(config, createRandomPolicy(`pol-${s}`));

      // The sandbox objective is `() => false`, so a win is impossible — every run is a defeat.
      expect(outcome.result.outcome).toBe('defeat');
      // Bounded by the `sands_of_time` deadline (fires at `round > SANDBOX_DEADLINE`, i.e. the round
      // after it elapses); most random runs die of famine far earlier, so this is only an upper bound.
      expect(outcome.result.stats.turnsTaken).toBeLessThanOrEqual(SANDBOX_DEADLINE + 1);
      expect(outcome.result.stats.turnsTaken).toBeGreaterThan(0);
    }
  });
});
