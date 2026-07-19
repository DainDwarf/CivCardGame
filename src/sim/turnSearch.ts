import type { GameState } from '../rules';
import type { RunState } from '../run/engine';
import { enumerateActions } from './actions';
import { keyOf } from './oracleKey';
import { applyAction, type SimAction } from './simulate';

/**
 * The **within-turn search skeleton** shared by the oracle (`sim/oracle.ts`) and the planner
 * (`sim/plannerPolicy.ts`): from a turn-start state, enumerate the distinct reachable *pre-`endTurn`*
 * configurations. Both searches collapse a turn into a single edge and differ only in their *beam-level*
 * loop (the oracle drives to a `victory`; the planner does a shallow, determinized expectimax) and in the
 * **heuristic** they rank by — so that heuristic is a parameter here, keeping this piece mission- and
 * policy-agnostic. Reuses the engine seams verbatim (`enumerateActions`/`applyAction`/`keyOf`).
 */

/** A node in a search: a run state, a back-pointer to how it was reached (so an action line is recovered
 *  by walking parents), the transposition key, and the cached heuristic. */
export interface SearchNode {
  state: RunState;
  parent: SearchNode | null;
  /** The action that led from `parent` to this node; `null` only for a root. */
  action: SimAction | null;
  key: string;
  h: number;
}

/** Mutable search budget threaded through the expansion so a global engine-step cap is enforced. */
export interface Budget {
  steps: number;
  cap: number;
}

/** A leaf/ranking heuristic — higher is better (`scoreState` for the oracle, a shaped value for the
 *  planner). `key` is the caller's already-computed transposition key for `G`, passed only where the
 *  search has one to hand: a pure memo hint an implementation may cache on or ignore, never an input to
 *  the value. */
export type Heuristic = (G: GameState, key?: string) => number;

/** Recover the action sequence from the root to `node` by walking parent back-pointers. */
export function reconstruct(node: SearchNode): SimAction[] {
  const out: SimAction[] = [];
  let n: SearchNode | null = node;
  while (n && n.action) {
    out.push(n.action);
    n = n.parent;
  }
  return out.reverse();
}

/** Remove and return the highest-`h` node from `frontier` (a linear scan — `frontier` is bounded by
 *  `turnConfigLimit`, so a heap would be over-engineering). */
function popBest(frontier: SearchNode[]): SearchNode {
  let bestIdx = 0;
  for (let i = 1; i < frontier.length; i++) if (frontier[i].h > frontier[bestIdx].h) bestIdx = i;
  const [best] = frontier.splice(bestIdx, 1);
  return best;
}

/**
 * Bounded best-first exploration over the non-`endTurn` actions from turn-start `node`, collecting the
 * distinct reachable pre-`endTurn` configurations (including `node` itself — "play nothing this turn",
 * which many lines need: wait a round for production to cross a threshold). Returns early with `win` if
 * any action reaches `victory` mid-turn. Dedups locally by transposition key; capped by `turnConfigLimit`
 * and the shared step `budget`; explored best-first by `heuristic` so promising branches survive the cap.
 */
export function expandTurn(
  node: SearchNode,
  turnConfigLimit: number,
  budget: Budget,
  heuristic: Heuristic,
): { win: SearchNode | null; configs: SearchNode[] } {
  const localSeen = new Set<string>([node.key]);
  // A parked-interaction *root* is not a legal pre-`endTurn` config — `endTurn` no-ops while one is set,
  // so "commit nothing and end the turn" here is a no-op the planner would emit forever (it re-plans on
  // the real parked state after a peek). Exclude it from `configs` while still *expanding* it (frontier
  // below) to reach its resolutions. A parked *child* stays a config on purpose: it's the legit "commit up
  // to the reveal" point the planner re-plans after, and the oracle skips it at its own `endTurn`.
  const configs: SearchNode[] = node.state.G.pendingInteraction ? [] : [node];
  const frontier: SearchNode[] = [node];

  while (frontier.length > 0 && configs.length < turnConfigLimit) {
    if (budget.steps >= budget.cap) break;
    const cur = popBest(frontier);
    for (const action of enumerateActions(cur.state.G)) {
      if (action.kind === 'endTurn') continue;
      budget.steps += 1;
      const next = applyAction(cur.state, action);
      if (next === cur.state) continue; // engine rejected it (shouldn't happen for an enumerated action)
      const child: SearchNode = { state: next, parent: cur, action, key: '', h: 0 };
      if (next.gameover) {
        if (next.gameover.outcome === 'victory') return { win: child, configs };
        continue; // a mid-turn defeat (e.g. a sacrifice tipping a resource negative) — dead branch
      }
      const k = keyOf(next.G);
      if (localSeen.has(k)) continue;
      localSeen.add(k);
      child.key = k;
      child.h = heuristic(next.G, k);
      configs.push(child);
      frontier.push(child);
    }
  }
  return { win: null, configs };
}
