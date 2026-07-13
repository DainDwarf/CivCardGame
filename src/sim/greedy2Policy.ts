import { randInt, seededRng } from '../rules';
import { CARDS, isStaffable } from '../content/cards';
import type { RunState } from '../run/engine';
import { enumerateActions } from './actions';
import { applyAction, type Policy, type SimAction } from './simulate';
import { scoreState } from './value';

/** The staffing moves a play's second-ply lookahead may follow up with — assigning idle pop or
 *  relocating a worker into a freshly-placed box. `endTurn` and further plays are deliberately
 *  excluded: the lookahead only asks "is this new workplace worth staffing right now?", nothing more. */
const STAFFING_KINDS = new Set<SimAction['kind']>([
  'assignWorker',
  'unassignWorker',
  'transferWorker',
  'toggleStaffing',
]);

/**
 * A **greedy with a bounded 2-ply staffing lookahead** — kept alongside plain `createGreedyPolicy` as a
 * deliberate diagnostic *pair*: the win-rate gap between the two on a scenario measures how much
 * **worker reassignment** (relocating a worker into a freshly-placed box) is a skill lever there — most
 * decisive on a mission whose win hinges on staffing a work box while population is saturated, a signal
 * neither policy shows alone.
 *
 * Identical to `createGreedyPolicy` except in how it *values* a play of a `work`/`building` card: instead
 * of scoring only the immediate post-play state, it scores the best state reachable by *one* follow-up
 * staffing move (assign / transfer a worker into the new box). Everywhere else it collapses to plain greedy.
 *
 * This closes the one-ply blind spot in a saturated-population state: playing an unstaffed Foraging box is
 * score-neutral on its own (no operating change, no resource yet), so plain greedy rejects it and never
 * reaches the state where transferring a worker in would pay off. Crediting the play with its best
 * staffing follow-up lets the policy see the two-step (play → transfer) combo. It only *values* the play
 * that way and still returns the single play action — the greedy within-turn loop then takes the transfer
 * on the next step (from the post-play state the transfer strictly improves on its own).
 *
 * Ranking is lexicographic `(lookahead, immediate)`: among plays whose lookahead ties, the one with the
 * higher *immediate* score wins, so a genuinely-improving move (e.g. the transfer, once a box exists)
 * always beats a merely-lookahead-improving one (e.g. a redundant second work card that adds nothing until
 * staffed). Ties on both keys fall to the same seeded coin flip greedy uses, so the *only* behavioural
 * variable vs. greedy is the lookahead itself.
 */
export function createGreedy2Policy(policySeed: string): Policy {
  const rng = seededRng(policySeed);
  const policy: Policy = (state) => {
    const G = state.G;

    // A parked interaction is exclusive — answer it (mirrors greedy).
    if (G.pendingInteraction) {
      const n = G.pendingInteraction.options.length;
      return { kind: 'resolveInteraction', answer: n > 0 ? randInt(rng, 0, n - 1) : 0 };
    }

    const baseline = scoreState(G);
    let best: SimAction | null = null;
    let bestLook = baseline; // s2 — score incl. best staffing follow-up (the acceptance key)
    let bestImmediate = baseline; // s1 of the chosen action — the tie-break key
    for (const action of enumerateActions(G)) {
      if (action.kind === 'endTurn') continue;
      const next = applyAction(state, action);
      if (next === state) continue; // rejected (shouldn't happen for an enumerated action) — skip
      const s1 = scoreState(next.G);
      const s2 = lookaheadScore(state, next, action, s1);
      // Accept on strict lookahead improvement; rank by (s2, s1); coin-flip a full tie (as greedy does).
      if (
        s2 > bestLook ||
        (best !== null && s2 === bestLook && s1 > bestImmediate) ||
        (best !== null && s2 === bestLook && s1 === bestImmediate && randInt(rng, 0, 1) === 0)
      ) {
        best = action;
        bestLook = s2;
        bestImmediate = s1;
      }
    }
    return best ?? { kind: 'endTurn' };
  };
  policy.seed = policySeed;
  return policy;
}

/** The lookahead value of an action: for a staffable play (work/building/wonder), the best score
 *  reachable by one staffing follow-up from the post-play state (else the freshly-placed box would look
 *  worthless until a later turn staffs it). For every other action it is just the immediate score `s1` —
 *  so the policy is plain greedy outside the one case this experiment targets. */
function lookaheadScore(state: RunState, next: RunState, action: SimAction, s1: number): number {
  if (action.kind !== 'playCard') return s1;
  const played = state.G.hand[action.playHandIdx];
  const card = played && CARDS[played.cardId];
  if (!card || !isStaffable(card)) return s1;

  let best = s1;
  for (const follow of enumerateActions(next.G)) {
    if (!STAFFING_KINDS.has(follow.kind)) continue;
    const after = applyAction(next, follow);
    if (after === next) continue;
    const sc = scoreState(after.G);
    if (sc > best) best = sc;
  }
  return best;
}
