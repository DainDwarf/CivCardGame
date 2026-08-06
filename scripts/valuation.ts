/**
 * `npm run sim:valuation` — print the **goal valuation** the balance policies steer by, for one cell or the
 * whole standing baseline set.
 *
 * The competent policies (`planner`, `oracle`, `prover`) never read the objective directly. They rank a
 * state by whichever scorer the sweep selected, and neither one prints itself: both were computed in
 * memory only, so "is this mission hard, or is the policy mis-valuing it?" could only be settled by
 * hand-deriving arithmetic out of source. This prints the whole derivation instead.
 *
 * `--scorer` picks which, mirroring `npm run sim`'s flag of the same name. **`classic`** (the default, as
 * there) renders `sim/value.ts`'s five bands plus `sim/enablers.ts`'s enabler model: every probe, every
 * intermediate, and the card that won each credit. **`race`** renders `sim/race.ts`'s plans and its
 * `T̂loss − T̂win` margin: what each pool costs in worker-rounds, every card the plan scan weighed with the
 * root clock of each route it offered and the cause the dropped ones were dropped for, each goal's clock
 * over the routes it kept with the payment/delivery split inside each, and which clocks the folds
 * **absorbed** — the reading no `RaceBreakdown` carries.
 *
 * **No simulation.** Both models are derived once from the run root and are seed-independent (every zone is
 * read as an unordered multiset, so shuffle order cannot reach either), which is why this is its own verb
 * rather than a flag on `npm run sim`: no seed, no policy, no round cap means anything here, and `sim`'s
 * stdout is a CSV stream `sim:report`/`sim:record` parse. Runs in milliseconds, like `npm run economy`.
 *
 * Usage:
 *   npm run sim:valuation                                        whole standing set, planner vs full
 *   npm run sim:valuation -- scripts/sim/baselines/masonry.json  one fixture (positional or --baseline)
 *   npm run sim:valuation -- --terms full,no-floor,none          any ablation, side by side
 *   npm run sim:valuation -- --scorer race                       the rounds model instead of the bands
 *   npm run sim:valuation -- --scenario masonry --deck d.json --board settlement
 *   npm run sim:valuation -- --format csv > valuation.csv        long/tidy, for duckdb
 *
 * `--terms` grammar: `planner` (the shipped `DEFAULT_ENABLER_TERMS`), `full` (every term on, what the
 * oracle and prover use), `none` (no shaping at all), `no-<term>[-<term>…]`, `only-<term>[-<term>…]`. It
 * names an ablation of the classic model's terms, so it is classic-only.
 *
 * Redirect through `npm run --silent`: npm's own preamble goes to stdout, and JSON has no comment syntax
 * to hide it.
 */
import { parseArgs } from 'node:util';
import {
  DEFAULT_ENABLER_TERMS,
  DEFAULT_MAX_ROUNDS,
  ENABLER_CONSTANTS,
  RACE,
  SCORE_WEIGHTS,
  enablerPotential,
  explainEnablers,
  explainRaceModel,
  explainRaceValue,
  formatRaceValuation,
  formatValuation,
  objectiveProgress,
  permanentDelta,
  raceCsvHeaderLine,
  raceCsvLines,
  scoreBreakdown,
  simConfig,
  valuationCsvHeaderLine,
  valuationCsvLines,
  type EnablerTerms,
  type RaceValuationCell,
  type ValuationCell,
  type ValuationModel,
} from '../src/sim';
import { simFileTools, type Cell } from './simFiles';
import { createRun } from '../src/run/engine';
import { projectNextTurn, type GameState } from '../src/rules';
import { MISSIONS } from '../src/content/missions';

/** The committed standing set — the default input, so the bare verb dumps every measured cell. */
const DEFAULT_BASELINE_DIR = 'scripts/sim/baselines';

/** Any fixed string: the derivation reads the deck as an unordered set, so the shuffle this seeds cannot
 *  reach the model. Named rather than passed as a flag, which would imply it mattered. */
const ROOT_SEED = 'valuation';

const TERM_KEYS = ['cardCosts', 'conversions', 'capacity', 'floor', 'handSize', 'producers'] as const;
type TermKey = (typeof TERM_KEYS)[number];

function fail(msg: string): never {
  console.error(`sim:valuation: ${msg}`);
  process.exit(1);
}

const { expandBaselinePaths, loadDeck, resolveBoard, loadBaseline } = simFileTools(fail);

function csv(s: string | undefined): string[] {
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

function termKey(raw: string): TermKey {
  const found = TERM_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (!found) fail(`unknown enabler term '${raw}'. Known: ${TERM_KEYS.join(', ')}.`);
  return found;
}

function allTerms(on: boolean): EnablerTerms {
  return Object.fromEntries(TERM_KEYS.map((k) => [k, on])) as EnablerTerms;
}

/** A term-set spec into real `EnablerTerms`. `planner`/`full` name the two sets that actually ship, so the
 *  standing comparison needs no term list spelled out. */
function parseTerms(spec: string): EnablerTerms {
  if (spec === 'planner') return DEFAULT_ENABLER_TERMS;
  if (spec === 'full') return {};
  // Every term off derives the same empty model the policies' `enablers: false` builds, so this really is
  // the unshaped leaf rather than an approximation of it.
  if (spec === 'none') return allTerms(false);
  if (spec.startsWith('no-')) {
    return Object.fromEntries(spec.slice(3).split('-').filter(Boolean).map((t) => [termKey(t), false])) as EnablerTerms;
  }
  if (spec.startsWith('only-')) {
    const on = new Set(spec.slice(5).split('-').filter(Boolean).map(termKey));
    return Object.fromEntries(TERM_KEYS.map((k) => [k, on.has(k)])) as EnablerTerms;
  }
  return fail(`unknown --terms spec '${spec}'. Use planner, full, none, no-<term>… or only-<term>…`);
}

let values: {
  baseline?: string; scenario?: string; deck?: string; board?: string; terms?: string; format?: string; scorer?: string;
};
let positionals: string[];
try {
  ({ values, positionals } = parseArgs({
    options: {
      baseline: { type: 'string' },
      scenario: { type: 'string' },
      deck: { type: 'string' },
      board: { type: 'string' },
      terms: { type: 'string' },
      format: { type: 'string' },
      scorer: { type: 'string' },
    },
    allowPositionals: true,
  }));
} catch (e) {
  fail((e as Error).message);
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'json' && format !== 'csv') {
  fail(`--format must be 'text', 'json' or 'csv', got '${format}'.`);
}

const scorer = values.scorer ?? 'classic';
if (scorer !== 'classic' && scorer !== 'race') fail(`--scorer must be 'classic' or 'race', got '${scorer}'.`);
// `--terms` ablates the classic model's own terms, so pairing it with the race model would mean silently
// ignoring it — the same reason `--baseline` and the ad-hoc trio are exclusive.
if (scorer === 'race' && values.terms !== undefined) {
  fail('--terms is a classic-scorer ablation — the race model has no term set to name.');
}

// Same mutual exclusion as the sweep's: a baseline already owns its mission, deck and board, so pairing it
// with any of the ad-hoc trio would mean silently ignoring one of them.
const adHocFlags = (['scenario', 'deck', 'board'] as const).filter((f) => values[f] !== undefined);
const baselineArgs = [...csv(values.baseline), ...positionals];
if (adHocFlags.length) {
  if (baselineArgs.length) {
    fail(`--baseline cannot be combined with ${adHocFlags.map((f) => `--${f}`).join('/')} — a baseline already carries its own mission, deck and board.`);
  }
  if (!values.scenario) fail('--scenario is required (one or more mission ids, comma-separated), or use --baseline.');
  if (!values.deck) fail('--deck is required (path to a deck JSON file).');
  if (!values.board) fail('--board is required (a content board id, or a path to a board JSON file).');
  for (const id of csv(values.scenario)) {
    if (!MISSIONS[id]) fail(`unknown --scenario mission '${id}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
  }
}

const cells: (Cell & { source?: string })[] = adHocFlags.length
  ? (() => {
      const deck = loadDeck(values.deck!);
      const board = resolveBoard(values.board!);
      return csv(values.scenario!).map((missionId) => ({ label: missionId, missionId, deck, board }));
    })()
  : expandBaselinePaths(baselineArgs.length ? baselineArgs : [DEFAULT_BASELINE_DIR]).map((path) => ({
      ...loadBaseline(path),
      source: path,
    }));

/** One cell's run root — the state both models derive from, and the only thing either reads. */
function rootOf(cell: Cell): GameState {
  return createRun(
    simConfig({
      deckCardIds: cell.deck,
      board: cell.board.board,
      missionId: cell.missionId,
      boardStickers: cell.board.stickers,
      seed: ROOT_SEED,
    }),
  ).G;
}

/** The config half every cell block heads with, whichever model fills the rest. */
function heading(cell: Cell & { source?: string }) {
  const mission = MISSIONS[cell.missionId];
  return {
    label: cell.label,
    ...(cell.source !== undefined ? { source: cell.source } : {}),
    missionId: cell.missionId,
    missionName: mission.name,
    objectiveCardId: mission.objectiveCardId,
    board: cell.board.board,
    boardStickers: cell.board.stickers,
    deckSize: cell.deck.length,
  };
}

if (scorer === 'race') {
  const report: RaceValuationCell[] = cells.map((cell) => {
    const G = rootOf(cell);
    // The plans the scorer would be built with (`raceScorer`), handed to the value: without them every
    // goal the standing economy doesn't already carry reads `'none'`, and the report is an artifact of
    // its own call rather than of the model.
    const model = explainRaceModel(G);
    return {
      ...heading(cell),
      round: G.round,
      resources: G.resources,
      model,
      value: explainRaceValue(G, { model: model.model }),
    };
  });

  if (format === 'json') {
    // `Infinity` is what an unreachable clock *is* here, and `JSON.stringify` writes it as `null` — which
    // reads as a missing measurement rather than an unbounded one.
    const nonFinite = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
    console.log(JSON.stringify({ constants: RACE, maxRounds: DEFAULT_MAX_ROUNDS, cells: report }, nonFinite, 2));
  } else if (format === 'csv') {
    console.log([raceCsvHeaderLine(), ...report.flatMap(raceCsvLines)].join('\n'));
  } else {
    console.log(formatRaceValuation(report, DEFAULT_MAX_ROUNDS));
  }
  process.exit(0);
}

const termSpecs = values.terms !== undefined ? csv(values.terms) : ['planner', 'full'];
if (termSpecs.length === 0) fail('--terms needs at least one spec.');
const termSets = termSpecs.map((name) => ({ name, terms: parseTerms(name) }));

const report: ValuationCell[] = cells.map((cell) => {
  const G = rootOf(cell);
  const models: ValuationModel[] = termSets.map(({ name, terms }) => {
    const explain = explainEnablers(G, terms);
    return { name, explain, rootPotential: enablerPotential(G, explain.model) };
  });
  return {
    ...heading(cell),
    rootProgress: objectiveProgress(G),
    score: scoreBreakdown(G),
    permanent: permanentDelta(G),
    resources: G.resources,
    projected: projectNextTurn(G).resources,
    models,
  };
});

if (format === 'json') {
  console.log(JSON.stringify({ constants: ENABLER_CONSTANTS, weights: SCORE_WEIGHTS, cells: report }, null, 2));
  process.exit(0);
}

if (format === 'csv') {
  console.log([valuationCsvHeaderLine(), ...report.flatMap(valuationCsvLines)].join('\n'));
  process.exit(0);
}

console.log(formatValuation(report));
