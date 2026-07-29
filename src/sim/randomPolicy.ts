import { randInt, seededRng } from '../rules';
import { enumerateActions } from './actions';
import type { Policy } from './simulate';

/**
 * A random-legal-move policy: at each step it takes the shared legal-action enumeration
 * (`sim/actions.ts`'s `enumerateActions` — reusing the prod gate `unplayableReason`, so the fuzzer and
 * the real UI agree on what is playable) and picks one uniformly from its own seeded stream (distinct
 * from the run's shuffle seed, so play-order and draw-order vary independently). Every action arrives
 * fully determined, discard-cost sacrifices included, so a uniform pick varies those too. A parked
 * interaction resolves to a random option — `enumerateActions` already returns only those when one is
 * pending, so no special-case is needed here.
 *
 * Doubles as a crash / illegal-state fuzzer — walking arbitrary legal sequences drives the run into
 * corners a scripted test wouldn't, which `simulateRun`'s post-step invariant checks then police.
 */
export function createRandomPolicy(policySeed: string): Policy {
  const rng = seededRng(policySeed);
  const policy: Policy = (state) => {
    const candidates = enumerateActions(state.G);
    return candidates[randInt(rng, 0, candidates.length - 1)];
  };
  policy.seed = policySeed;
  return policy;
}
