import type { BoardId } from '../content/boards';
import { simConfig, simulateRun, type Policy, type SimOptions, type SimOutcome } from './simulate';
import { createRandomPolicy } from './randomPolicy';
import { createGreedyPolicy } from './greedyPolicy';
import { createGreedy2Policy } from './greedy2Policy';
import { createHeuristicPolicy } from './heuristicPolicy';

/** The built-in move policies a sweep can run under, by name — the random fuzzer (floor), the greedy
 *  optimizer, the cheap heuristic baseline (ceiling), and `greedy2` (greedy + a bounded staffing
 *  lookahead). The CLI sweeps a scenario under several to bracket its difficulty; the `greedy`↔`greedy2`
 *  gap is a standing readout of how much worker reassignment matters in a scenario (see `greedy2Policy`).
 *  `greedy2` grinds long survival games, so it's the slow one in a default (all-policy) sweep. */
export const POLICY_FACTORIES: Record<string, (policySeed: string) => Policy> = {
  random: createRandomPolicy,
  greedy: createGreedyPolicy,
  greedy2: createGreedy2Policy,
  heuristic: createHeuristicPolicy,
};

/**
 * One cell of a batch sweep: a deck / board / mission (plus optional board stickers) to run many
 * seeded times. Deliberately a flat list rather than a cartesian DSL — there is one deck/board/mission
 * of real content today, so the value now is aggregation *over seeds*; more `Scenario`s drop in as the
 * age arcs (TODO.md Steps 5–8) add content. Built from plain cardIds so a sweep needs no meta
 * collection (the sim counterpart to a player's resolved deck; see `simConfig`).
 */
export interface Scenario {
  /** Human name for the report row, also folded into each run's seed keys so two scenarios never
   *  collide on the same seed stream. */
  label: string;
  deckCardIds: readonly string[];
  board: BoardId;
  missionId: string;
  boardStickers?: string[];
}

export interface BatchOptions {
  /** Runs per scenario. Each is a fresh, independently-seeded run. */
  seeds: number;
  /** How to build the move policy for a run from its policy seed. Defaults to the random-legal-move
   *  policy / fuzzer (`createRandomPolicy`); the greedy / heuristic policies slot in here (or pick one
   *  by name from `POLICY_FACTORIES`). */
  policyFactory?: (policySeed: string) => Policy;
  /** Reporting label for the policy in use (e.g. `'greedy'`) — carried onto every `ScenarioRuns` so the
   *  report can show which policy produced which stats. Defaults to `'random'`, matching the default
   *  factory. */
  policyName?: string;
  /** Pass-through to each `simulateRun` (invariant checks, action cap). */
  sim?: SimOptions;
}

/** Every run of one scenario, outcomes kept whole so the report layer can reach `gameover.reason`
 *  and `cardPlays` — the fields `RunResult` alone doesn't carry. */
export interface ScenarioRuns {
  scenario: Scenario;
  /** Which policy played these runs (for the report), from `BatchOptions.policyName`. */
  policyName: string;
  outcomes: SimOutcome[];
}

/**
 * Play every `scenario` `opts.seeds` times and collect the raw outcomes — the sweep the reporting
 * layer (`report.ts`) folds into summaries. Re-implements no game logic and no drive loop: it just
 * composes `simConfig` → `simulateRun`.
 *
 * Each run draws two independent, deterministic seed streams (like `sim.test.ts`): `${label}-cfg-${i}`
 * feeds the deck shuffle, `${label}-pol-${i}` feeds move choice. That `(configSeed, policySeed)` pair
 * is exactly the invariant-violation reproduction key (`sim/invariants.ts`), so a whole batch is
 * reproducible and its report diffable across code changes.
 */
export function runBatch(scenarios: Scenario[], opts: BatchOptions): ScenarioRuns[] {
  const policyFactory = opts.policyFactory ?? createRandomPolicy;
  const policyName = opts.policyName ?? 'random';
  return scenarios.map((scenario) => {
    const outcomes: SimOutcome[] = [];
    for (let i = 0; i < opts.seeds; i++) {
      const config = simConfig({
        deckCardIds: scenario.deckCardIds,
        board: scenario.board,
        missionId: scenario.missionId,
        boardStickers: scenario.boardStickers,
        seed: `${scenario.label}-cfg-${i}`,
      });
      outcomes.push(simulateRun(config, policyFactory(`${scenario.label}-pol-${i}`), opts.sim));
    }
    return { scenario, policyName, outcomes };
  });
}

/**
 * Sweep every scenario under several named policies, holding the seed streams identical across policies
 * so the comparison is *paired* (same deck shuffles → the only variable is how the policy plays). Flat
 * result list, one `ScenarioRuns` per (scenario × policy), ready for `summarize`/`formatReport`. The
 * whole point of the greedy/heuristic policies: bracket a scenario's difficulty between the random floor
 * and a competent ceiling. Unknown policy names throw (fail fast on a CLI typo).
 */
export function runPolicies(scenarios: Scenario[], policyNames: string[], opts: BatchOptions): ScenarioRuns[] {
  return policyNames.flatMap((name) => {
    const factory = POLICY_FACTORIES[name];
    if (!factory) throw new Error(`Unknown policy '${name}'. Known: ${Object.keys(POLICY_FACTORIES).join(', ')}.`);
    return runBatch(scenarios, { ...opts, policyFactory: factory, policyName: name });
  });
}
