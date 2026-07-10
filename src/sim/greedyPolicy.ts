import { randInt, seededRng } from '../rules';
import { enumerateActions } from './actions';
import { applyAction, type Policy, type SimAction } from './simulate';
import { scoreState } from './value';

/**
 * A **greedy one-ply** policy: at each step it evaluates every legal action by scoring the state it
 * would *lead to* (`sim/value.ts`'s `scoreState`, applied on a clone via `applyAction`) and takes the
 * best. The competent counterpart to the random fuzzer — it plays to a value function instead of
 * flailing, so its win-rate / turns-survived / end-resources reflect *skilled* play (the balance answer
 * a random walk can't give). It also *exploits* whatever the value function rewards, so it surfaces an
 * overpowered card the way a min-maxing player would.
 *
 * **Two-phase**, and this matters: within a turn it keeps taking the best *non-`endTurn`* action while
 * one **strictly improves** the score, and only ends the turn when nothing does. Scoring `endTurn` as
 * just another action would break on an infinite mission — advancing the round always looks attractive
 * (rounds-survived is the reward), so a naive greedy would end its turn immediately every round and
 * never build an economy. Strict improvement also guarantees termination within a turn: each accepted
 * action raises a bounded score, so the sequence can't cycle.
 *
 * `seed` drives only the tie-break among equally-best actions, keeping the policy deterministic per seed.
 */
export function createGreedyPolicy(policySeed: string): Policy {
  const rng = seededRng(policySeed);
  const policy: Policy = (state) => {
    const G = state.G;

    // A parked interaction is exclusive — answer it. `endTurn` no-ops while one is set, so the
    // `?? endTurn` fallback below would deadlock; handle it up front. Options aren't scored (recovering
    // a card to hand rarely moves `scoreState`), so a random valid pick is fine.
    if (G.pendingInteraction) {
      const n = G.pendingInteraction.options.length;
      return { kind: 'resolveInteraction', answer: n > 0 ? randInt(rng, 0, n - 1) : 0 };
    }

    const baseline = scoreState(G);
    let best: SimAction | null = null;
    let bestScore = baseline;
    for (const action of enumerateActions(G)) {
      if (action.kind === 'endTurn') continue;
      const next = applyAction(state, action);
      if (next === state) continue; // rejected (shouldn't happen for an enumerated action) — skip
      const sc = scoreState(next.G);
      // Strictly improve; among ties (already better than baseline) swap on a coin flip so play isn't
      // biased by enumeration order, while staying deterministic under the seed.
      if (sc > bestScore || (best !== null && sc === bestScore && randInt(rng, 0, 1) === 0)) {
        best = action;
        bestScore = sc;
      }
    }
    return best ?? { kind: 'endTurn' };
  };
  policy.seed = policySeed;
  return policy;
}
