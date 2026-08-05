/**
 * `npm run sim:valuation` — print the **goal valuation** the balance policies steer by, for one cell or the
 * whole standing baseline set.
 *
 * The competent policies (`planner`, `oracle`, `prover`) never read the objective directly. They rank a
 * state by `sim/value.ts`'s `scoreState` — five priority bands — plus `sim/enablers.ts`'s enabler
 * potential, a model derived from the objective by probing what moves it. Both were computed in memory and
 * printed nowhere, so "is this mission hard, or is the policy mis-valuing it?" could only be settled by
 * hand-deriving arithmetic out of source. This prints the whole derivation instead: every probe, every
 * intermediate, and the card that won each credit.
 *
 * **No simulation.** The model is derived once from the run root and is seed-independent (`runCardIds`
 * unions every zone, so shuffle order cannot reach it), which is why this is its own verb rather than a
 * flag on `npm run sim`: no seed, no policy, no round cap means anything here, and `sim`'s stdout is a CSV
 * stream `sim:report`/`sim:record` parse. Runs in milliseconds, like `npm run economy`.
 *
 * Usage:
 *   npm run sim:valuation                                        whole standing set, planner vs full
 *   npm run sim:valuation -- scripts/sim/baselines/masonry.json  one fixture (positional or --baseline)
 *   npm run sim:valuation -- --terms full,no-floor,none          any ablation, side by side
 *   npm run sim:valuation -- --scenario masonry --deck d.json --board settlement
 *   npm run sim:valuation -- --format csv > valuation.csv        long/tidy, for duckdb
 *
 * `--terms` grammar: `planner` (the shipped `DEFAULT_ENABLER_TERMS`), `full` (every term on, what the
 * oracle and prover use), `none` (no shaping at all), `no-<term>[-<term>…]`, `only-<term>[-<term>…]`.
 *
 * Redirect through `npm run --silent`: npm's own preamble goes to stdout, and JSON has no comment syntax
 * to hide it.
 */
import { parseArgs } from 'node:util';
import {
  DEFAULT_ENABLER_TERMS,
  ENABLER_CONSTANTS,
  SCORE_WEIGHTS,
  enablerPotential,
  explainEnablers,
  formatValuation,
  objectiveProgress,
  permanentDelta,
  scoreBreakdown,
  simConfig,
  valuationCsvHeaderLine,
  valuationCsvLines,
  type EnablerTerms,
  type ValuationCell,
  type ValuationModel,
} from '../src/sim';
import { simFileTools, type Cell } from './simFiles';
import { createRun } from '../src/run/engine';
import { projectNextTurn } from '../src/rules';
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

let values: { baseline?: string; scenario?: string; deck?: string; board?: string; terms?: string; format?: string };
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

const termSpecs = values.terms !== undefined ? csv(values.terms) : ['planner', 'full'];
if (termSpecs.length === 0) fail('--terms needs at least one spec.');
const termSets = termSpecs.map((name) => ({ name, terms: parseTerms(name) }));

const report: ValuationCell[] = cells.map((cell) => {
  const { G } = createRun(
    simConfig({
      deckCardIds: cell.deck,
      board: cell.board.board,
      missionId: cell.missionId,
      boardStickers: cell.board.stickers,
      seed: ROOT_SEED,
    }),
  );
  const mission = MISSIONS[cell.missionId];
  const models: ValuationModel[] = termSets.map(({ name, terms }) => {
    const explain = explainEnablers(G, terms);
    return { name, explain, rootPotential: enablerPotential(G, explain.model) };
  });
  return {
    label: cell.label,
    ...(cell.source !== undefined ? { source: cell.source } : {}),
    missionId: cell.missionId,
    missionName: mission.name,
    objectiveCardId: mission.objectiveCardId,
    board: cell.board.board,
    boardStickers: cell.board.stickers,
    deckSize: cell.deck.length,
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
