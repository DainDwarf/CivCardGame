import type { RunConfig } from '../contract';
import { createRun, endTurn, type RunState } from '../run/engine';
import { enumerateActions } from './actions';
import { createGreedy2Policy } from './greedy2Policy';
import { keyOf } from './oracleKey';
import { applyAction, type Policy, type SimAction } from './simulate';
import { scoreState } from './value';

/**
 * A **seeded perfect-information oracle** over the headless sim: a bounded, heuristic-guided,
 * deterministic graph search for a line of play that *wins* a mission on a given seed. It brackets the
 * skill ladder from *above* — where the random/heuristic/greedy policies estimate how a run *tends* to
 * go, the oracle answers "is this mission **winnable** on this seed *at all*, and how?" — the ceiling the
 * plan (`docs/…/seeded-oracle-plan.md`) set out to deliver.
 *
 * **Why an oracle is cheap here (the enabling finding).** `G.deck` is a fully materialized ordered array
 * and `G.rngState` lives *inside* `G`, so `structuredClone(G)` (what `applyAction`/`endTurn` already do)
 * hands any rollout the entire future draw order for free. The future is *already revealed* — the oracle
 * gets the omniscient answer by direct search instead of spending thousands of determinized rollouts to
 * approximate it (the reason this is the natural tool over MCTS in this engine).
 *
 * **Soundness rests on determinism, not on the transposition key.** Every line the search returns is a
 * sequence of actions it *actually applied through the real engine* to reach an observed `victory`
 * gameover, so replaying it from the same root reproduces the win exactly. A found line is therefore a
 * *sound proof* of winnability; the key's job (`sim/oracleKey.ts`) is only to dedup, and its looseness can
 * cost *completeness* (miss a win) but never manufacture a false one. Because the beam is bounded, failing
 * to find a line is *evidence* of unwinnability, not a proof.
 *
 * Reuses the existing seams verbatim — `enumerateActions` / `applyAction` / `endTurn` for transitions and
 * `sim/value.ts`'s `scoreState` (which folds in the mission's `objectiveProgress` gradient) as the search
 * heuristic — so the oracle stays **mission-agnostic** and adds *no* hook to any card/mission/rule file
 * (per [[sim-logic-stays-in-sim]]). It lives strictly in `sim/`.
 */
export interface OracleOptions {
  /** States kept per round-depth in the main beam. Larger ⇒ more complete, more expensive. The primary
   *  completeness/cost knob. */
  beamWidth?: number;
  /** Max distinct pre-`endTurn` configurations explored *within a single turn* per node — bounds the
   *  within-turn sub-search (worker-staffing / play permutations). */
  turnConfigLimit?: number;
  /** Hard round-depth cap. A finite deadline that guarantees the search terminates even on a mission
   *  with no in-game deadline (e.g. a threshold `'standard'` mission). */
  maxRounds?: number;
  /** Total-engine-step backstop across the whole search — aborts (reporting no line) if exceeded, so a
   *  pathological branching factor can't run unbounded. */
  nodeBudget?: number;
}

const DEFAULTS: Required<OracleOptions> = {
  beamWidth: 64,
  turnConfigLimit: 32,
  maxRounds: 50,
  nodeBudget: 3_000_000,
};

/** A node in the search graph: a run state plus a back-pointer to how it was reached, so a winning
 *  line is recovered by walking parents (kept alive by the winning node's chain even after the beam
 *  prunes them). `h` caches the heuristic so it isn't recomputed during sorting. */
interface SearchNode {
  state: RunState;
  parent: SearchNode | null;
  /** The action that led from `parent` to this node; `null` only for the root. */
  action: SimAction | null;
  key: string;
  h: number;
}

/** Mutable search budget, threaded through the within-turn expansion so a global step cap is enforced. */
interface Budget {
  steps: number;
  cap: number;
}

/**
 * Search for a winning line from `root` (a fresh `RunState`, e.g. from `createRun`). Returns the action
 * sequence that reaches `victory`, or `null` if none is found within the bounds.
 *
 * The search collapses a turn into a single edge (per the plan's bound 1): from each turn-start node it
 * runs a bounded within-turn sub-search (`expandTurn`) enumerating the distinct reachable *pre-`endTurn`*
 * configurations, then advances each with one `endTurn`. This cuts the main-search depth from hundreds of
 * micro-actions to ~rounds. A **level-synchronized beam** keeps the top-`beamWidth` successors per round
 * by `scoreState`; a global transposition set dedups turn-start states across the whole search. Setting
 * `beamWidth`/`turnConfigLimit` to very large values approaches the plan's *exact* (complete-within-
 * deadline) mode, tractable only on short/small missions.
 */
export function searchWinningLine(root: RunState, options: OracleOptions = {}): SimAction[] | null {
  const opts = { ...DEFAULTS, ...options };
  if (root.gameover) return root.gameover.outcome === 'victory' ? [] : null;

  const budget: Budget = { steps: 0, cap: opts.nodeBudget };
  const rootNode: SearchNode = { state: root, parent: null, action: null, key: keyOf(root.G), h: scoreState(root.G) };
  let beam: SearchNode[] = [rootNode];
  const seen = new Set<string>([rootNode.key]);

  for (let depth = 0; depth < opts.maxRounds; depth++) {
    const successors: SearchNode[] = [];
    for (const node of beam) {
      const { win, configs } = expandTurn(node, opts, budget);
      if (win) return reconstruct(win);
      for (const cfg of configs) {
        const advanced = endTurn(cfg.state);
        // A config with a parked interaction can't end its turn (`endTurn` no-ops) — its resolved
        // descendants were already collected as other configs, so skip the no-op here.
        if (advanced === cfg.state) continue;
        const child: SearchNode = {
          state: advanced,
          parent: cfg,
          action: { kind: 'endTurn' },
          key: '', // filled below only for the states we actually keep
          h: 0,
        };
        if (advanced.gameover) {
          if (advanced.gameover.outcome === 'victory') return reconstruct(child);
          continue; // defeat this round — a dead branch
        }
        const k = keyOf(advanced.G);
        if (seen.has(k)) continue;
        seen.add(k);
        child.key = k;
        child.h = scoreState(advanced.G);
        successors.push(child);
      }
      if (budget.steps >= budget.cap) return null;
    }
    if (successors.length === 0) return null;
    // Level beam: keep the top-W successors by heuristic (higher `scoreState` = closer to a win).
    successors.sort((a, b) => b.h - a.h);
    beam = successors.length > opts.beamWidth ? successors.slice(0, opts.beamWidth) : successors;
  }
  return null;
}

/**
 * The within-turn sub-search from a turn-start `node`: a bounded best-first exploration over the
 * non-`endTurn` actions, collecting the distinct reachable pre-`endTurn` configurations (including the
 * node itself — "play nothing this turn", which many wins need: wait N rounds for production to cross a
 * threshold). Returns early with `win` if any action reaches `victory` mid-turn (a play that crosses the
 * objective threshold). Dedups locally by transposition key; capped by `turnConfigLimit` and the shared
 * step budget. Explored best-first by `scoreState` so the promising branches are kept when the cap bites.
 */
function expandTurn(
  node: SearchNode,
  opts: Required<OracleOptions>,
  budget: Budget,
): { win: SearchNode | null; configs: SearchNode[] } {
  const localSeen = new Set<string>([node.key]);
  const configs: SearchNode[] = [node];
  const frontier: SearchNode[] = [node];

  while (frontier.length > 0 && configs.length < opts.turnConfigLimit) {
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
      child.h = scoreState(next.G);
      configs.push(child);
      frontier.push(child);
    }
  }
  return { win: null, configs };
}

/** Remove and return the highest-`h` node from `frontier` (a linear scan — `frontier` is bounded by
 *  `turnConfigLimit`, so a heap would be over-engineering). */
function popBest(frontier: SearchNode[]): SearchNode {
  let bestIdx = 0;
  for (let i = 1; i < frontier.length; i++) if (frontier[i].h > frontier[bestIdx].h) bestIdx = i;
  const [best] = frontier.splice(bestIdx, 1);
  return best;
}

/** Recover the action sequence from the root to `node` by walking parent back-pointers. */
function reconstruct(node: SearchNode): SimAction[] {
  const out: SimAction[] = [];
  let n: SearchNode | null = node;
  while (n && n.action) {
    out.push(n.action);
    n = n.parent;
  }
  return out.reverse();
}

/** An oracle move-policy, plus a `foundLine` flag the caller can read *after* the run to tell a
 *  search-proven win from a fallback win (the report layer sees only the outcome). */
export interface OraclePolicy extends Policy {
  /** Set on the policy's first invocation: whether the offline search found a winning line for this run.
   *  `false` until the run starts, and stays `false` when the run then wins only via the greedy2 fallback. */
  foundLine: boolean;
}

/**
 * Wrap the oracle as a `Policy` for the batch/report machinery. On its **first** call it searches offline
 * from the received root state (which is exactly `createRun(config)` — `simulateRun` hands the policy the
 * root first), then **dispenses the found line one action per call**; determinism guarantees each dispensed
 * action lands on the same state the search saw, so the drive loop reproduces the win.
 *
 * When the search finds no line, it **falls back to `greedy2`** for the whole run — deliberately, not
 * `greedy`: `greedy2` is the strongest ceiling policy, so `oracle`-wins ⊇ `greedy2`-wins on every seed,
 * preserving the "a ceiling must dominate" invariant (the plan's acceptance test). The pure *search-proven*
 * win rate is available separately via {@link proveWinnable} / `foundLine`; a sweep's oracle win rate means
 * "winnable by search **or** greedy2".
 */
export function createOraclePolicy(policySeed: string, options: OracleOptions = {}): OraclePolicy {
  const fallback = createGreedy2Policy(policySeed);
  let line: SimAction[] | null = null;
  let cursor = 0;
  let searched = false;

  const policy: OraclePolicy = ((state: RunState) => {
    if (!searched) {
      searched = true;
      line = searchWinningLine(state, options);
      policy.foundLine = line !== null;
    }
    if (line && cursor < line.length) return line[cursor++];
    // No line found, or the line is spent (it ends in a victory that has already ended the run, so this
    // arm is normally only reached on the no-line path) — play out greedily so the run still terminates.
    return fallback(state);
  }) as OraclePolicy;
  policy.seed = policySeed;
  policy.foundLine = false;
  return policy;
}

/**
 * The honest **winnability prover**: search a fresh run of `config` and report whether a winning line
 * exists (with the line, for replay/inspection). This is the *pure* search-proven answer — no greedy2
 * fallback muddying it — so it's the API to use for "on what % of seeds is mission M winnable?" and the
 * one the end-to-end tests assert against.
 */
export function proveWinnable(
  config: RunConfig,
  options: OracleOptions = {},
): { winnable: boolean; line: SimAction[] | null } {
  const line = searchWinningLine(createRun(config), options);
  return { winnable: line !== null, line };
}
