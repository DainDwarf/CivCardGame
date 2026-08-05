/**
 * Balance tool — sweep the headless simulator over a mission × deck × board matrix and **measure** it.
 *
 * The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine under a move policy;
 * a single run answers little, but running one cell over many seeds gives statistical balance answers no
 * human can grind. This tool only *measures*: it emits **one CSV row per run** to stdout, flushed as each
 * run lands, and folds nothing. Aggregation is `npm run sim:report` and committing a measurement is
 * `npm run sim:record`, both separate passes over that CSV — so a sweep is paid for once and re-analysed
 * any number of times (filter by outcome, pull the outliers, group by any column) without re-running it,
 * and a long sweep is followable as rows arrive. It re-implements **no** game logic — it composes
 * `runPolicies` from `src/sim`.
 *
 * A sweep names its cells one of two ways. **Ad-hoc**, the three axes are decoupled the way the campaign
 * menu presents them: pick the **mission(s)** by id (looked up live from `content/missions.ts` — no copied
 * deck lists), point `--deck` at a hand-editable JSON file, and name the **board** either by its content id
 * (`--board settlement`, no stickers) or with a board JSON file (needed only to attach board stickers) —
 * sweeping `[missions] × {the deck} × {the board}`. **`--baseline`** instead loads *self-contained* fixtures
 * that each own their own mission, deck and board, so one sweep can span cells that share none of the three
 * (`scripts/sim/baselines/`, the committed standing set). The two are mutually exclusive.
 *
 * Each cell is swept under several policies with *identical* seed streams, so the comparison is paired:
 * `random` is the difficulty floor / crash fuzzer, `greedy` / `heuristic` the competent ceiling, and the gap
 * tells you how much skill a scenario rewards. `greedy2` (greedy + a staffing lookahead), the `planner`,
 * the `oracle` (best achievable — a search for a winning line, falling back to `deepPlanner`) and the
 * `prover` (the same search reporting `noWinFound` instead of falling back, so its win rate is the
 * search-proven winnability rate) are nameable but slow — opt in with a small seed count.
 *
 * Usage:
 *   npm run sim -- --scenario growing_numbers --deck <file> --board settlement > sweep.csv
 *   npm run sim -- --scenario growing_numbers --deck <file> --board scripts/sim/boards/city-stockpiled.json
 *   npm run sim -- --scenario first_settlement,growing_numbers --deck <file> --board <file> --seeds 500
 *   npm run sim -- --scenario first_trades --deck <file> --board <file> --policies greedy,heuristic
 *   npm run sim -- --baseline scripts/sim/baselines --policies greedy,planner --seeds 100 > sweep.csv
 *   npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies planner --seed 3 --verbose
 *
 * Flags: `--scenario` + `--deck` + `--board` (the ad-hoc trio — one or more mission ids, a deck JSON path,
 * and a content board id or board JSON path) **or** `--baseline` (comma-separated fixture paths, or a
 * directory of them); `--seeds` (default 100), `--policies` (default random,heuristic,greedy),
 * `--max-rounds <n>` (stall cutoff — a policy idling past round `n` without winning/collapsing
 * is recorded as a `stall` defeat rather than ground to the action wall; default 200. Also caps how deep
 * `oracle`/`prover` search, so they never prove a line the cutoff would then discard as a stall — raise it
 * to let them find longer wins, at steeply more search cost), `--search-beam <n>` (the `oracle`/`prover`
 * beam width — the diagnostic for a `noWinFound:deadEnd` result, which says the *ranking* kept only
 * positions that die; more wins found under a wider beam means the heuristic was discarding real lines.
 * **Costs superlinearly** — a wider beam keeps more states alive and so searches deeper, not just wider,
 * and rows swept at a non-default width are not comparable to a fixture's recorded ones, so
 * `sim:record` refuses them), `--scorer <name>` (which value
 * function the competent policies rank by — `classic` (default) or `race`; one setting across every policy,
 * so a paired sweep under the same policy names isolates the brain. Like `--search-beam`, a non-default
 * scorer's rows are a diagnostic and `sim:record` refuses them), `--seed <i>` (a
 * **filter** — sweep only that seed index, keeping its seed streams identical to the full sweep's, so a
 * row that lost can be re-run verbatim), and `--verbose` (add a per-turn trace on **stderr**; stdout stays
 * pure CSV, so it composes with a redirect).
 *
 * File schemas — a deck file is `{ "cards": [{ "cardId", "count"?, "stickers"? }, ...] }` (count expands
 * to that many copies; stickers ride on every copy of the entry); a board file is
 * `{ "board": "<id>", "stickers"?: [...] }` (only needed to attach board stickers — a bare `--board <id>`
 * skips it); a baseline file is `{ "id", "mission", "board", "deck", "results"? }`, where `board`
 * takes either form, `deck` takes the deck file's `cards` array directly, and `results` is what
 * `npm run sim:record` writes back — this cell's own measured rows, which the sweep path never reads.
 * Ready-made examples live under `scripts/sim/`.
 */
import { parseArgs } from 'node:util';
import {
  runPolicies,
  csvHeaderLine,
  manifestLines,
  recordToCsvLine,
  sweepLine,
  POLICY_FACTORIES,
  SCORERS,
  DEFAULT_MAX_ROUNDS,
  DEFAULT_BEAM_WIDTH,
  DEFAULT_SCORER_NAME,
  type RunRecord,
  type Scenario,
  type SimAction,
} from '../src/sim';
import { simFileTools, type Cell } from './simFiles';
import type { RunState } from '../src/run/engine';
import { MISSIONS } from '../src/content/missions';
import { CARDS } from '../src/content/cards';
import { findStaffable, freePopulation, type GameState } from '../src/rules';

/** The policies a bare `--policies`-less run sweeps. Script-local on purpose: it's the user's requested
 *  default (`random,heuristic,greedy`), *not* the same set as the exported `DEFAULT_POLICY_NAMES` (which
 *  means "every built-in except oracle" and is a separate contract other readers rely on). */
const DEFAULT_POLICIES = ['random', 'heuristic', 'greedy'];

function fail(msg: string): never {
  console.error(`sim: ${msg}`);
  process.exit(1);
}

const { expandBaselinePaths, loadDeck, resolveBoard, loadBaseline } = simFileTools(fail);

function csv(s: string | undefined): string[] {
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

// Wrap `parseArgs` so an unknown flag or stray positional (strict mode throws a raw `TypeError`) surfaces
// as the same clean `sim: …` one-liner as every other user mistake, not a stack trace.
let values: { scenario?: string; deck?: string; board?: string; baseline?: string; seeds?: string; policies?: string; seed?: string; verbose?: boolean; 'max-rounds'?: string; 'search-beam'?: string; scorer?: string };
try {
  ({ values } = parseArgs({
    options: {
      scenario: { type: 'string' },
      deck: { type: 'string' },
      board: { type: 'string' },
      baseline: { type: 'string' },
      seeds: { type: 'string' },
      policies: { type: 'string' },
      seed: { type: 'string' },
      verbose: { type: 'boolean' },
      'max-rounds': { type: 'string' },
      'search-beam': { type: 'string' },
      scorer: { type: 'string' },
    },
    allowPositionals: false,
  }));
} catch (e) {
  fail((e as Error).message);
}

// The two ways to name cells are mutually exclusive: a baseline fixture already owns the mission, deck
// and board, so pairing it with any of the ad-hoc trio would mean silently ignoring one of them.
const adHocFlags = (['scenario', 'deck', 'board'] as const).filter((f) => values[f] !== undefined);
if (values.baseline !== undefined) {
  if (adHocFlags.length) fail(`--baseline cannot be combined with ${adHocFlags.map((f) => `--${f}`).join('/')} — a baseline already carries its own mission, deck and board.`);
} else {
  if (!values.scenario) fail('--scenario is required (one or more mission ids, comma-separated), or use --baseline.');
  if (!values.deck) fail('--deck is required (path to a deck JSON file).');
  if (!values.board) fail('--board is required (a content board id, or a path to a board JSON file).');
  for (const id of csv(values.scenario)) {
    if (!MISSIONS[id]) fail(`unknown --scenario mission '${id}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
  }
}

const seeds = values.seeds !== undefined ? Number(values.seeds) : 100;
if (!Number.isInteger(seeds) || seeds <= 0) fail(`--seeds must be a positive integer, got '${values.seeds}'.`);

const policies = values.policies !== undefined ? csv(values.policies) : DEFAULT_POLICIES;
for (const p of policies) {
  if (!POLICY_FACTORIES[p]) fail(`unknown policy '${p}'. Known: ${Object.keys(POLICY_FACTORIES).join(', ')}.`);
}

// A filter, not a mode: sweep only this seed index. The index keys the same `(cfg, pol)` streams the
// full sweep would have used, so the row is identical to the one it reproduces.
const seedIndices = (() => {
  if (values.seed === undefined) return undefined;
  const idx = Number(values.seed);
  if (!Number.isInteger(idx) || idx < 0) fail(`--seed must be a non-negative integer index, got '${values.seed}'.`);
  return [idx];
})();

// Stall cutoff: a policy that idles a run's rounds upward forever (a one-ply greedy stuck on a multi-turn
// chain) is recorded as a `stall` defeat past this round rather than ground to the action wall. Omitted →
// `simulateRun`'s default (200), well above any real game's length.
const maxRounds = values['max-rounds'] !== undefined ? Number(values['max-rounds']) : undefined;
if (maxRounds !== undefined && (!Number.isInteger(maxRounds) || maxRounds <= 0)) {
  fail(`--max-rounds must be a positive integer, got '${values['max-rounds']}'.`);
}
const simOpts = maxRounds !== undefined ? { maxRounds } : undefined;

// Beam width for the search policies (`oracle`/`prover`) — how many states survive each round's cut. The
// knob a `noWinFound:deadEnd` result indicts: a whole level dying means the *ranking* kept only losing
// positions, and a wider beam is what keeps a lower-ranked survivor alive. Omitted → `oracle.ts`'s default.
const searchBeam = values['search-beam'] !== undefined ? Number(values['search-beam']) : undefined;
if (searchBeam !== undefined && (!Number.isInteger(searchBeam) || searchBeam <= 0)) {
  fail(`--search-beam must be a positive integer, got '${values['search-beam']}'.`);
}
const searchOpts = searchBeam !== undefined ? { beamWidth: searchBeam } : undefined;

// Which value function every competent policy ranks by. One flag across all of them, so a sweep under the
// same policy names differs in exactly this — which is what makes `sim:report --against` read as a
// measurement of the brain rather than of two differently-configured tools.
const scorerName = values.scorer ?? DEFAULT_SCORER_NAME;
if (!SCORERS[scorerName]) fail(`unknown scorer '${scorerName}'. Known: ${Object.keys(SCORERS).join(', ')}.`);

// The one place the two input styles converge. Ad-hoc: one deck/board shared across every named mission.
// Baselines: one self-contained fixture per cell.
const cells: Cell[] =
  values.baseline !== undefined
    ? expandBaselinePaths(csv(values.baseline)).map(loadBaseline)
    : (() => {
        const deck = loadDeck(values.deck!);
        const board = resolveBoard(values.board!);
        return csv(values.scenario!).map((missionId) => ({ label: missionId, missionId, deck, board }));
      })();

// ---- `--verbose`: a per-turn trace alongside the measurement -----------------------------------------

/** A one-line economy readout for a turn: the 5 core resources plus population (assigned/total),
 *  territory, and culture. */
function snapshot(G: GameState): string {
  const r = G.resources;
  const assigned = r.population - freePopulation(G);
  return (
    `food ${r.food} · prod ${r.production} · sci ${r.science} · mil ${r.military} · money ${r.money}` +
    ` | pop ${assigned}/${r.population} · terr ${r.territory} · cult ${r.culture}`
  );
}

/** Name a staffable (building / work box) by its card name, resolved against the pre-move state. */
function staffName(G: GameState, id: number): string {
  const s = findStaffable(G, id);
  return s ? CARDS[s.cardId]?.name ?? s.cardId : `#${id}`;
}

function handName(G: GameState, idx: number): string {
  const card = G.hand[idx];
  return card ? CARDS[card.cardId]?.name ?? card.cardId : `#${idx}`;
}

/** The hand a turn opens on, as counted names — the choice set every play that turn was drawn from,
 *  and the only place a card the policy *passed over* is visible. Sorted, since hand order is not a
 *  game fact. */
function handList(G: GameState): string {
  const counts = new Map<string, number>();
  for (const card of G.hand) {
    const name = CARDS[card.cardId]?.name ?? card.cardId;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(', ');
}

/** Render one accepted action readably. Names resolve against `G` = the state *before* the action
 *  (a played hand index only means anything pre-move). */
function formatAction(action: SimAction, G: GameState): string {
  switch (action.kind) {
    case 'playCard': {
      let s = `play ${handName(G, action.playHandIdx)}`;
      // Name the sacrifice, not just how many: `enumeratePlays` offers one action per distinct
      //   sacrifice, so *which* card was given up is the decision the policy made here.
      if (action.discardHandIdxs?.length) {
        s += ` (discard ${action.discardHandIdxs.map((i) => handName(G, i)).join(', ')})`;
      }
      return s;
    }
    case 'assignWorker':
      return `assign ${staffName(G, action.id)}`;
    case 'unassignWorker':
      return `unassign ${staffName(G, action.id)}`;
    case 'transferWorker':
      return `transfer ${staffName(G, action.fromId)}→${staffName(G, action.toId)}`;
    case 'toggleStaffing':
      return `toggle ${staffName(G, action.id)}`;
    case 'resolveInteraction':
      return `answer ${action.answer}`;
    case 'endTurn':
      return 'endTurn';
  }
}

/**
 * Buffers one run's per-turn trace and prints it to **stderr** when the run finishes. Runs are swept
 * sequentially, so one buffer is enough; `onRun` is what closes a run out, and it carries the record —
 * which is where the cell/policy/seed labelling comes from, rather than inferring a run boundary from
 * the step stream.
 */
function createTracer() {
  let lines: string[] = [];
  let turnStart = '';
  let turnHand = '';
  let turnActions: string[] = [];
  let sawFirst = false;

  const flushTurn = (round: number) => {
    lines.push(`Turn ${round}  ${turnStart}`);
    lines.push(`  hand: ${turnHand || '(empty)'}`);
    lines.push(`  ${turnActions.length ? turnActions.join(' · ') : '(no moves)'}`);
    turnActions = [];
  };

  /** Print whatever is buffered, however the run ended. `label` may be partial on an aborted run. */
  const flush = (label: string, footer: string, lastRound: number) => {
    // A run that ends mid-turn (a play triggers win/loss before any endTurn) leaves a partial turn.
    if (turnActions.length) flushTurn(lastRound);
    process.stderr.write(`\n${label}\n${lines.join('\n')}\n${footer}\n`);
    lines = [];
    turnActions = [];
    turnStart = '';
    sawFirst = false;
  };

  return {
    onStep: ({ action, prev, next, accepted }: { action: SimAction; prev: RunState; next: RunState; accepted: boolean }) => {
      // Turn 1's starting economy is the very first call's `prev` (the post-setup state); every later
      // turn's start is the state right after the endTurn that closed the previous one.
      if (!sawFirst) {
        turnStart = snapshot(prev.G);
        turnHand = handList(prev.G);
        sawFirst = true;
      }
      if (accepted && action.kind !== 'endTurn') turnActions.push(formatAction(action, prev.G));
      if (action.kind === 'endTurn' && accepted) {
        flushTurn(prev.G.round);
        turnStart = snapshot(next.G);
        turnHand = handList(next.G);
      }
    },
    finishRun: (record: RunRecord) => {
      const mission = MISSIONS[cellsByLabel.get(record.cell)!.missionId].name;
      flush(
        `# trace — ${mission} · ${record.cell} · ${record.policy} · seed ${record.seed}`,
        `→ ${record.outcome} · round ${record.turns} · ${record.actions} actions`,
        record.turns,
      );
    },
    // A run that throws (an invariant violation, a non-terminating turn) never reaches `onRun`, and its
    // trace is exactly the diagnostic showing what the policy was doing — so print it before re-raising.
    abandonRun: (err: Error) => flush('# trace — aborted run', `✗ ${err.message}`, NaN),
  };
}

const scenarios: Scenario[] = cells.map((cell) => ({
  label: cell.label,
  deckCardIds: cell.deck,
  board: cell.board.board,
  missionId: cell.missionId,
  boardStickers: cell.board.stickers,
}));
const cellsByLabel = new Map(cells.map((cell) => [cell.label, cell]));

const tracer = values.verbose ? createTracer() : undefined;

// The manifest: what each cell label stands for, so the CSV is a complete record of its own sweep. The
// data rows carry no constant-per-cell field, and a deck's *composition* (copy counts, per-copy stickers)
// is expressible nowhere else.
// The `#sweep` line records the **effective** cutoff and beam, not the flags that set them: an omitted
// flag still ran at a value, and `sim:record` has to know which one to decide whether the rows are a
// baseline or a diagnostic.
const out: string[] = [
  sweepLine({
    seeds,
    policies,
    ...(seedIndices ? { seedIndices } : {}),
    maxRounds: maxRounds ?? DEFAULT_MAX_ROUNDS,
    beamWidth: searchBeam ?? DEFAULT_BEAM_WIDTH,
    scorer: scorerName,
  }),
  ...manifestLines(scenarios),
  csvHeaderLine(),
];
for (const line of out) process.stdout.write(`${line}\n`);

// Progress on stderr (stdout stays pure CSV). Suppressed under `--verbose`, which is already writing
// traces there — the `\r`-rewritten line would shred them.
const runsTotal = policies.length * scenarios.length * (seedIndices?.length ?? seeds);
let runsDone = 0;

try {
  runPolicies(scenarios, policies, {
    seeds,
    seedIndices,
    sim: { ...simOpts, ...(tracer ? { onStep: tracer.onStep } : {}) },
    search: searchOpts,
    scorer: SCORERS[scorerName],
    onRun: (record) => {
      // Written per run rather than at the end: the measurement is the output, so it must survive a
      // sweep that is interrupted — and a multi-hour run becomes followable.
      process.stdout.write(`${recordToCsvLine(record)}\n`);
      tracer?.finishRun(record);
      runsDone += 1;
      if (tracer) return;
      const pct = ((100 * runsDone) / runsTotal).toFixed(0);
      process.stderr.write(`\r[sim] ${String(runsDone).padStart(String(runsTotal).length)}/${runsTotal} (${pct}%) · ${record.policy} · ${record.cell}`.padEnd(72));
      if (runsDone === runsTotal) process.stderr.write('\n');
    },
  });
} catch (err) {
  tracer?.abandonRun(err as Error);
  throw err;
}
