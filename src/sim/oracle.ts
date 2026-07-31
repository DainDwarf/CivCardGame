import type { RunConfig } from '../contract';
import { createRun, endTurn, type RunState } from '../run/engine';
import { createPlannerPolicy, DEEP_PLANNER_OPTIONS } from './plannerPolicy';
import { hashOf } from './oracleKey';
import { type Policy, type SimAction, type SimOptions } from './simulate';
import { expandTurn, reconstruct, type Budget, type Heuristic, type SearchNode } from './turnSearch';
import { scoreState } from './value';
import { deriveEnablers, enablerPotential, enablerTermsOf, type EnablerTerms } from './enablers';

/**
 * A **seeded perfect-information oracle** over the headless sim: a bounded, heuristic-guided,
 * deterministic graph search for a line of play that *wins* a mission on a given seed. It brackets the
 * skill ladder from *above* — where the random/heuristic/greedy policies estimate how a run *tends* to
 * go, the oracle answers "is this mission **winnable** on this seed *at all*, and how?" — the ceiling the
 * plan (`docs/…/seeded-oracle-plan.md`) set out to deliver.
 *
 * **Why an oracle is cheap here (the enabling finding).** `G.deck` is a fully materialized ordered array
 * and `G.rngState` lives *inside* `G`, so `cloneState(G)` (what `applyAction`/`endTurn` already do)
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
 * Reuses the existing seams verbatim — `enumerateActions` / `applyAction` / `endTurn` for transitions and,
 * as the search heuristic, `sim/value.ts`'s `scoreState` folded with the enabler potential
 * (`sim/enablers.ts`) — the same leaf value the planner ranks by, so the beam keeps the multi-turn growth
 * lines a bare `scoreState` would prune (population is invisible to it). So the oracle stays
 * **mission-agnostic** and adds *no* hook to any card/mission/rule file (per [[sim-logic-stays-in-sim]]). It
 * lives strictly in `sim/`.
 */
export interface OracleOptions {
  /** States kept per round-depth in the main beam. Larger ⇒ more complete, more expensive. The primary
   *  completeness/cost knob. */
  beamWidth?: number;
  /** Max distinct pre-`endTurn` configurations explored *within a single turn* per node — bounds the
   *  within-turn sub-search (worker-staffing / play permutations). */
  turnConfigLimit?: number;
  /** Hard round-depth cap. A finite deadline that guarantees the search terminates even on a mission
   *  with no in-game deadline (e.g. a threshold `'standard'` mission). Wants to match the *drive loop's*
   *  round cutoff ({@link SimOptions.maxRounds}) — see {@link searchBoundsFor}, which derives it. */
  maxRounds?: number;
  /** Total-engine-step backstop across the whole search — aborts (reporting no line) if exceeded, so a
   *  pathological branching factor can't run unbounded. */
  nodeBudget?: number;
  /** Fold the enabler potential (`sim/enablers.ts`) into the search heuristic so the beam keeps the growth
   *  lines a bare `scoreState` prunes. Defaults to the **full all-on model** — deliberately *not* the
   *  planner's `DEFAULT_ENABLER_TERMS`: the oracle's job is proving winnability, and the full model
   *  measured strictly more wins found (the lean set drops seeds to stalls). Off recovers the
   *  pure-`scoreState` oracle; an `EnablerTerms` object ablates individual mechanisms. */
  enablers?: boolean | EnablerTerms;
}

/**
 * Which bound stopped a search that found no line. Kept apart because each indicts a *different* knob, and
 * a bare "no line" cannot tell you which to turn:
 *
 * - **`budget`** — {@link OracleOptions.nodeBudget} ran out mid-level. The search was still finding states
 *   to expand; it simply could not afford them. Widening the beam spends the same cap on fewer rounds.
 * - **`depth`** — the beam survived {@link OracleOptions.maxRounds} rounds without a win. The line, if any,
 *   is longer than the search was allowed to look.
 * - **`deadEnd`** — a whole level produced no successors, well inside budget: every kept branch either
 *   *died* or transposed onto an already-seen state. The beam's **ranking** picked states with no future,
 *   which indicts {@link OracleOptions.beamWidth} (too narrow to keep a survivor) or the heuristic itself
 *   (it ranked losing states above living ones).
 */
export type SearchExhaustion = 'budget' | 'depth' | 'deadEnd';

/** A found line, or which bound ended the search. */
export type SearchResult = { found: true; line: SimAction[] } | { found: false; exhausted: SearchExhaustion };

const DEFAULTS: Required<OracleOptions> = {
  beamWidth: 64,
  turnConfigLimit: 32,
  maxRounds: 200,
  nodeBudget: 3_000_000,
  enablers: true,
};

/**
 * Search for a winning line from `root` (a fresh `RunState`, e.g. from `createRun`). Returns the action
 * sequence that reaches `victory`, or *which bound stopped it* if none is found.
 *
 * The search collapses a turn into a single edge (per the plan's bound 1): from each turn-start node it
 * runs a bounded within-turn sub-search (`expandTurn`) enumerating the distinct reachable *pre-`endTurn`*
 * configurations, then advances each with one `endTurn`. This cuts the main-search depth from hundreds of
 * micro-actions to ~rounds. A **level-synchronized beam** keeps the top-`beamWidth` successors per round
 * by the heuristic (`scoreState` + enabler potential); a global transposition set dedups turn-start states
 * across the whole search. Setting
 * `beamWidth`/`turnConfigLimit` to very large values approaches the plan's *exact* (complete-within-
 * deadline) mode, tractable only on short/small missions.
 */
export function searchWinningLine(root: RunState, options: OracleOptions = {}): SearchResult {
  const opts = { ...DEFAULTS, ...options };
  if (root.gameover) {
    return root.gameover.outcome === 'victory' ? { found: true, line: [] } : { found: false, exhausted: 'deadEnd' };
  }

  // Same leaf value the planner ranks by: fold in the enabler potential so the beam doesn't prune the
  // multi-turn growth lines `scoreState` alone undervalues. Derived once from the root; pure over `G`.
  const terms = enablerTermsOf(opts.enablers);
  const model = terms ? deriveEnablers(root.G, terms) : null;
  const h: Heuristic = model ? (G) => scoreState(G) + enablerPotential(G, model) : scoreState;

  const budget: Budget = { steps: 0, cap: opts.nodeBudget };
  const rootNode: SearchNode = { state: root, parent: null, action: null, key: hashOf(root.G), h: h(root.G) };
  let beam: SearchNode[] = [rootNode];
  const seen = new Set<number>([rootNode.key]);

  for (let depth = 0; depth < opts.maxRounds; depth++) {
    const successors: SearchNode[] = [];
    for (const node of beam) {
      const { win, configs } = expandTurn(node, opts.turnConfigLimit, budget, h);
      if (win) return { found: true, line: reconstruct(win) };
      for (const cfg of configs) {
        const advanced = endTurn(cfg.state);
        // A config with a parked interaction can't end its turn (`endTurn` no-ops) — its resolved
        // descendants were already collected as other configs, so skip the no-op here.
        if (advanced === cfg.state) continue;
        const child: SearchNode = {
          state: advanced,
          parent: cfg,
          action: { kind: 'endTurn' },
          key: 0, // filled below only for the states we actually keep
          h: 0,
        };
        if (advanced.gameover) {
          if (advanced.gameover.outcome === 'victory') return { found: true, line: reconstruct(child) };
          continue; // defeat this round — a dead branch
        }
        const k = hashOf(advanced.G);
        if (seen.has(k)) continue;
        seen.add(k);
        child.key = k;
        child.h = h(advanced.G);
        successors.push(child);
      }
      if (budget.steps >= budget.cap) return { found: false, exhausted: 'budget' };
    }
    if (successors.length === 0) return { found: false, exhausted: 'deadEnd' };
    // Level beam: keep the top-W successors by heuristic (higher `scoreState` = closer to a win).
    successors.sort((a, b) => b.h - a.h);
    beam = successors.length > opts.beamWidth ? successors.slice(0, opts.beamWidth) : successors;
  }
  return { found: false, exhausted: 'depth' };
}

/** An oracle move-policy, plus a `foundLine` flag the caller can read *after* the run to tell a
 *  search-proven win from a fallback win (the report layer sees only the outcome). */
export interface OraclePolicy extends Policy {
  /** Set on the policy's first invocation: whether the offline search found a winning line for this run.
   *  `false` until the run starts, and stays `false` when the run then wins only via the fallback. */
  foundLine: boolean;
}

/** Prefix of the `gameover.reason` {@link createProverPolicy} records when its search finds no line.
 *  Distinct from every real collapse cause *and* from the drive loop's `stall`, so a report reads "the
 *  search could not prove this seed" apart from "a policy played and lost". It means **not proven within
 *  the search bounds**, so a prover win rate is a lower bound on winnability, never a proof of the
 *  negative. */
export const NO_WIN_REASON = 'noWinFound';

/** The reason string for one {@link SearchExhaustion}, e.g. `noWinFound:deadEnd`. Suffixed rather than
 *  separate constants so `defeatCauses` splits into one bucket per bound — naming which knob to turn —
 *  while every unproven seed still greps as `noWinFound`. */
export const noWinReason = (exhausted: SearchExhaustion): string => `${NO_WIN_REASON}:${exhausted}`;

/**
 * Derive a search's round-depth cap from the sweep's own round cutoff, so the two agree.
 *
 * They measure the same thing from opposite ends and disagreeing is always a bug: a line *longer* than the
 * drive cutoff gets recorded as a `stall` even when the search finds it (wasted search), and a cap
 * *shorter* than it reports `noWinFound` on seeds winnable inside the very runs the sweep asked for (a
 * false negative). With no cutoff named the two already agree — {@link DEFAULTS} carries the drive loop's
 * own default depth — so this only has to carry an *explicit* one across. `Infinity` is dropped: it
 * disables the drive cutoff, but an unbounded search would not terminate.
 */
export function searchBoundsFor(sim?: SimOptions): OracleOptions {
  const cap = sim?.maxRounds;
  return cap !== undefined && Number.isFinite(cap) ? { maxRounds: cap } : {};
}

/** Search once at the root, then dispense the line one action per call — the drive shared by the oracle
 *  and the prover, which differ only in what they do when no line exists. */
function createLineDispenser(options: OracleOptions) {
  let result: SearchResult | null = null;
  let cursor = 0;
  return {
    /** Idempotent: `simulateRun` hands the policy the root state first, so the first call searches from
     *  exactly `createRun(config)` however the caller reaches it. */
    search(state: RunState): SearchResult {
      if (!result) result = searchWinningLine(state, options);
      return result;
    },
    next(): SimAction | null {
      return result?.found && cursor < result.line.length ? result.line[cursor++] : null;
    },
  };
}

/**
 * Wrap the oracle as a `Policy` for the batch/report machinery. On its **first** call it searches offline
 * from the received root state (which is exactly `createRun(config)` — `simulateRun` hands the policy the
 * root first), then **dispenses the found line one action per call**; determinism guarantees each dispensed
 * action lands on the same state the search saw, so the drive loop reproduces the win.
 *
 * When the search finds no line, it **falls back to `deepPlanner`** for the whole run — the strongest
 * policy available, so `oracle`-wins ⊇ that tier's wins on every seed, preserving the "a ceiling must
 * dominate" invariant (the plan's acceptance test). So a sweep's oracle win rate means "winnable by search
 * **or** by the best policy we have" — an upper bound on *achievable* play, not a winnability measurement.
 * For that, use {@link createProverPolicy} (as a sweepable policy) or {@link proveWinnable} (offline).
 */
export function createOraclePolicy(policySeed: string, options: OracleOptions = {}): OraclePolicy {
  const fallback = createPlannerPolicy(policySeed, DEEP_PLANNER_OPTIONS);
  const dispenser = createLineDispenser(options);

  const policy: OraclePolicy = ((state: RunState) => {
    policy.foundLine = dispenser.search(state).found;
    // No line found, or the line is spent (it ends in a victory that has already ended the run, so this
    // arm is normally only reached on the no-line path) — play on so the run still terminates.
    return dispenser.next() ?? fallback(state);
  }) as OraclePolicy;
  policy.seed = policySeed;
  policy.foundLine = false;
  return policy;
}

/**
 * The **prover**: the same search as {@link createOraclePolicy}, but with no fallback — a seed whose search
 * finds no line ends immediately as a {@link noWinReason} defeat instead of being played out by another
 * policy. So its win rate is the *search-proven* winnability rate, and its losses split by which bound
 * stopped the search rather than wearing another policy's collapse causes under the oracle's name.
 *
 * The counterpart to {@link proveWinnable} for a sweep: same answer, but driven through the real engine so
 * a proven seed still reports turns / end resources / card plays like any other cell.
 */
export function createProverPolicy(policySeed: string, options: OracleOptions = {}): OraclePolicy {
  const dispenser = createLineDispenser(options);

  const policy: OraclePolicy = ((_state: RunState) => {
    // `abort` has already run the search and ended the run if it came back empty, so a line exists here.
    // The `endTurn` arm is unreachable padding: the line ends in the victory that stops the drive loop.
    return dispenser.next() ?? { kind: 'endTurn' };
  }) as OraclePolicy;
  policy.seed = policySeed;
  policy.foundLine = false;
  policy.abort = (state: RunState) => {
    const result = dispenser.search(state);
    policy.foundLine = result.found;
    return result.found ? null : noWinReason(result.exhausted);
  };
  return policy;
}

/**
 * The honest **winnability prover**: search a fresh run of `config` and report whether a winning line
 * exists (with the line, for replay/inspection). This is the *pure* search-proven answer — no fallback
 * muddying it — so it's the API to use for "on what % of seeds is mission M winnable?" and the one the
 * end-to-end tests assert against. A negative carries the {@link SearchExhaustion} that produced it, since
 * "not proven" is only actionable once you know which bound to raise.
 */
export function proveWinnable(
  config: RunConfig,
  options: OracleOptions = {},
): { winnable: boolean; line: SimAction[] | null; exhausted: SearchExhaustion | null } {
  const result = searchWinningLine(createRun(config), options);
  return result.found
    ? { winnable: true, line: result.line, exhausted: null }
    : { winnable: false, line: null, exhausted: result.exhausted };
}
