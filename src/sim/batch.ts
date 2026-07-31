import type { BoardId } from '../content/boards';
import type { DeckCard } from '../rules/deckBuilder';
import { simConfig, simulateRun, type Policy, type SimOptions } from './simulate';
import { toRunRecord, type RunRecord } from './record';
import { createRandomPolicy } from './randomPolicy';
import { createGreedyPolicy } from './greedyPolicy';
import { createGreedy2Policy } from './greedy2Policy';
import { createHeuristicPolicy } from './heuristicPolicy';
import { createOraclePolicy, createProverPolicy, searchBoundsFor, type OracleOptions } from './oracle';
import { createPlannerPolicy, DEEP_PLANNER_OPTIONS } from './plannerPolicy';

/** Builds one run's policy from its seed. The sweep's {@link BatchOptions.sim} comes along so a policy
 *  whose own search is bounded in *rounds* can align with the drive loop's cutoff rather than guess; every
 *  other policy ignores it. */
export type PolicyFactory = (policySeed: string, sim?: SimOptions, search?: OracleOptions) => Policy;

/** The built-in move policies a sweep can run under, by name — the random fuzzer (floor), the greedy
 *  optimizer, the cheap heuristic baseline (ceiling), `greedy2` (greedy + a bounded staffing lookahead),
 *  the `planner` (a fair, determinized multi-turn lookahead that clears missions the one-ply greedies
 *  plateau on — see `plannerPolicy`), and the `oracle` (a bounded seeded-perfect-information search for a
 *  *winning* line — the true ceiling). The CLI sweeps a scenario under several to bracket its difficulty;
 *  the `greedy`↔`greedy2` gap is a standing readout of how much worker reassignment matters in a scenario
 *  (see `greedy2Policy`). `greedy2` grinds long survival games, the `planner` re-plans a search each turn,
 *  and the `oracle`/`prover` run a whole graph search per seed — the last three are slow and excluded from
 *  the default sweep (`DEFAULT_POLICY_NAMES`), named explicitly to include. */
export const POLICY_FACTORIES: Record<string, PolicyFactory> = {
  random: createRandomPolicy,
  greedy: createGreedyPolicy,
  greedy2: createGreedy2Policy,
  heuristic: createHeuristicPolicy,
  // Wrapped, not passed by reference: its second parameter is `PlannerOptions`, and the factory contract
  // hands a second argument to everything.
  planner: (s) => createPlannerPolicy(s),
  // The deep-analysis tier of the planner — the shipped `planner`'s lean enabler brain run with the
  // calibrated knobs. Also the `oracle`'s fallback, so both read the one `DEEP_PLANNER_OPTIONS`.
  deepPlanner: (s) => createPlannerPolicy(s, DEEP_PLANNER_OPTIONS),
  // The two search policies are the only factories that read `sim` — their round-depth cap tracks the
  // sweep's own cutoff (`searchBoundsFor`) instead of searching to a depth the drive loop would discard.
  oracle: (s, sim, search) => createOraclePolicy(s, { ...searchBoundsFor(sim), ...search }),
  // The oracle's search with its fallback removed: wins are search-proven, and every other seed reports
  // `noWinFound` rather than a stand-in policy's collapse cause. The honest winnability read.
  prover: (s, sim, search) => createProverPolicy(s, { ...searchBoundsFor(sim), ...search }),
};

/** The policies a bare `npm run sim` sweeps when none is named — the fast built-ins. The `planner`
 *  (a search per turn) and the `oracle`/`prover` (a full search per seed) are excluded so a default sweep
 *  stays quick; name one explicitly to include it. */
export const DEFAULT_POLICY_NAMES = ['random', 'greedy', 'greedy2', 'heuristic'];

/**
 * One cell of a batch sweep: a deck / board / mission (plus optional board stickers) to run many
 * seeded times. Deliberately a flat list rather than a cartesian DSL — there is one deck/board/mission
 * of real content today, so the value now is aggregation *over seeds*; more `Scenario`s drop in as the
 * age arcs (BACKLOG.md Steps 5–8) add content. Built from plain cardIds so a sweep needs no meta
 * collection (the sim counterpart to a player's resolved deck; see `simConfig`).
 */
export interface Scenario {
  /** Human name for the report row, also folded into each run's seed keys so two scenarios never
   *  collide on the same seed stream. */
  label: string;
  /** The deck to play, as a draw-order list. Each entry is a bare cardId **or** a `DeckCard`
   *  (`{ cardId, stickers? }`) — the latter carries per-copy card stickers straight into the run
   *  (the `sim` CLI's deck files use it); `simConfig` normalizes the two. */
  deckCardIds: readonly (string | DeckCard)[];
  board: BoardId;
  missionId: string;
  boardStickers?: string[];
}

export interface BatchOptions {
  /** Runs per scenario — seed indices `0 … seeds-1`. Each is a fresh, independently-seeded run. */
  seeds: number;
  /** Run exactly these seed indices instead of `0 … seeds-1`, leaving each one's seed streams (and so
   *  its outcome) identical to what the full sweep would have produced. What makes replaying a single
   *  run a *filter* over the sweep rather than a second code path. */
  seedIndices?: readonly number[];
  /** How to build the move policy for a run from its policy seed. Defaults to the random-legal-move
   *  policy / fuzzer (`createRandomPolicy`); the greedy / heuristic policies slot in here (or pick one
   *  by name from `POLICY_FACTORIES`). */
  policyFactory?: PolicyFactory;
  /** Reporting label for the policy in use (e.g. `'greedy'`) — carried onto every `RunRecord` so the
   *  fold can group by which policy produced which runs. Defaults to `'random'`, matching the default
   *  factory. */
  policyName?: string;
  /** Pass-through to each `simulateRun` (invariant checks, action cap). */
  sim?: SimOptions;
  /** Search knobs for the policies that run one (`oracle`/`prover`); every other policy ignores them.
   *  Merged *over* the depth derived from `sim` (`searchBoundsFor`), so an explicit `maxRounds` here wins. */
  search?: OracleOptions;
  /** Fired with each run's measurement the moment it finishes — the streaming seam. A caller writes the
   *  record out (and renders progress) as the sweep goes, so a multi-hour run is followable and its
   *  measurement survives the process. The library never writes I/O itself — the CLI supplies the sink.
   *  Carries no run counter: `runPolicies` sweeps one `runBatch` per policy, so only the caller knows how
   *  many runs the whole sweep is. */
  onRun?: (record: RunRecord) => void;
}

/**
 * Play every `scenario` once per seed index and **measure** each run — one {@link RunRecord} per run,
 * emitted through `onRun` as it lands and returned as a flat list. It aggregates nothing: folding a set
 * of records into statistics is `report.ts`'s separate pass, which reads a re-read sweep file exactly as
 * it reads a live one. Re-implements no game logic and no drive loop: it composes `simConfig` →
 * `simulateRun` → `toRunRecord`.
 *
 * Each run draws two independent, deterministic seed streams (like `sim.test.ts`): `${label}-cfg-${i}`
 * feeds the deck shuffle, `${label}-pol-${i}` feeds move choice. That `(configSeed, policySeed)` pair
 * is exactly the invariant-violation reproduction key (`sim/invariants.ts`), so a whole batch is
 * reproducible and its records diffable across code changes.
 */
export function runBatch(scenarios: Scenario[], opts: BatchOptions): RunRecord[] {
  const policyFactory = opts.policyFactory ?? createRandomPolicy;
  const policyName = opts.policyName ?? 'random';
  const indices = opts.seedIndices ?? Array.from({ length: opts.seeds }, (_, i) => i);
  const records: RunRecord[] = [];
  for (const scenario of scenarios) {
    for (const i of indices) {
      const config = simConfig({
        deckCardIds: scenario.deckCardIds,
        board: scenario.board,
        missionId: scenario.missionId,
        boardStickers: scenario.boardStickers,
        seed: `${scenario.label}-cfg-${i}`,
      });
      const outcome = simulateRun(config, policyFactory(`${scenario.label}-pol-${i}`, opts.sim, opts.search), opts.sim);
      const record = toRunRecord(scenario, policyName, i, outcome);
      records.push(record);
      opts.onRun?.(record);
    }
  }
  return records;
}

/**
 * Sweep every scenario under several named policies, holding the seed streams identical across policies
 * so the comparison is *paired* (same deck shuffles → the only variable is how the policy plays). One
 * flat record list across every (scenario × policy × seed). The whole point of the greedy/heuristic
 * policies: bracket a scenario's difficulty between the random floor and a competent ceiling. Unknown
 * policy names throw (fail fast on a CLI typo).
 */
export function runPolicies(scenarios: Scenario[], policyNames: string[], opts: BatchOptions): RunRecord[] {
  return policyNames.flatMap((name) => {
    const factory = POLICY_FACTORIES[name];
    if (!factory) throw new Error(`Unknown policy '${name}'. Known: ${Object.keys(POLICY_FACTORIES).join(', ')}.`);
    return runBatch(scenarios, { ...opts, policyFactory: factory, policyName: name });
  });
}
