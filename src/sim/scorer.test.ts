import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_BOARD_ID, installFixtures, uninstallFixtures } from '../rules/testFixtures';
import { createRun, type RunState } from '../run/engine';
import type { GameState } from '../rules';
import { POLICY_FACTORIES } from './batch';
import { classicScorer, DEFAULT_SCORER, DEFAULT_SCORER_NAME, SCORERS, type Scorer } from './scorer';
import { simConfig } from './simulate';
import { scoreState } from './value';

/** The policies the seam reaches — every one that ranks states by a value function. `random` picks
 *  uniformly and `heuristic` runs a hand-written priority ladder, so neither has a leaf to swap. */
const COMPETENT = ['greedy', 'greedy2', 'planner', 'oracle', 'prover'];

/** Search bounds small enough that the two search policies finish in a test, whichever way they go —
 *  what each does with no line is the next test's subject, not this one's. */
const TINY_SEARCH = { maxRounds: 2, nodeBudget: 200 };

/** A scorer that records every root it was derived from and counts the leaves it valued, delegating so
 *  the policy under it still plays a coherent turn. */
function spyScorer() {
  const roots: GameState[] = [];
  let leaves = 0;
  const scorer: Scorer = (root) => {
    roots.push(root);
    return (G) => {
      leaves += 1;
      return scoreState(G);
    };
  };
  return { scorer, roots, leafCalls: () => leaves };
}

function newRun(): RunState {
  return createRun(
    simConfig({
      deckCardIds: ['test_sci', 'test_sci', 'test_prod', 'test_food'],
      board: TEST_BOARD_ID,
      missionId: 'test_win',
      seed: 'scorer-cfg',
    }),
  );
}

describe('the scorer seam', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  it('defaults to the incumbent, unshaped', () => {
    const { G } = newRun();
    expect(DEFAULT_SCORER).toBe(SCORERS[DEFAULT_SCORER_NAME]);
    expect(classicScorer(G)(G)).toBe(scoreState(G));
  });

  // The regression this whole step risks: a policy keeping a hard-wired `scoreState` call, which would
  // read as a cell that simply didn't move under `--scorer race`.
  it.each(COMPETENT)('%s ranks by the scorer it was handed, derived from the run root', (name) => {
    const spy = spyScorer();
    const root = newRun();
    const policy = POLICY_FACTORIES[name](`${name}-pol`, { scorer: spy.scorer, search: TINY_SEARCH });
    // How the drive loop opens a turn: a policy that can decline is asked first, and the prover's whole
    // search runs there.
    policy.abort?.(root);
    policy(root);

    expect(spy.roots.length).toBeGreaterThan(0);
    for (const derivedFrom of spy.roots) expect(derivedFrom).toBe(root.G);
    expect(spy.leafCalls()).toBeGreaterThan(0);
  });

  // The oracle is two brains — the search and the planner it falls back to — and a ceiling assembled from
  // two different value functions would report neither.
  it('hands the oracle fallback the same scorer as the search', () => {
    const spy = spyScorer();
    const root = newRun();
    // A budget of zero cannot afford one expansion, so the search yields no line and the fallback plays.
    const policy = POLICY_FACTORIES.oracle('oracle-pol', {
      scorer: spy.scorer,
      search: { maxRounds: 1, nodeBudget: 0 },
    });
    policy(root);

    expect(spy.roots).toEqual([root.G, root.G]);
  });
});
