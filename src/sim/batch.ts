import type { BoardId } from '../content/boards';
import { simConfig, simulateRun, type Policy, type SimOptions, type SimOutcome } from './simulate';
import { createRandomPolicy } from './randomPolicy';

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
   *  policy / fuzzer (`createRandomPolicy`); a heuristic policy (TODO.md Step 4) slots in here. */
  policyFactory?: (policySeed: string) => Policy;
  /** Pass-through to each `simulateRun` (invariant checks, action cap). */
  sim?: SimOptions;
}

/** Every run of one scenario, outcomes kept whole so the report layer can reach `gameover.reason`
 *  and `cardPlays` — the fields `RunResult` alone doesn't carry. */
export interface ScenarioRuns {
  scenario: Scenario;
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
    return { scenario, outcomes };
  });
}
