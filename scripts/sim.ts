/**
 * Balance tool — sweep the headless simulator over a mission × deck × board matrix and **measure** it.
 *
 * The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine under a move policy;
 * a single run answers little, but running one cell over many seeds gives statistical balance answers no
 * human can grind. This tool only *measures*: it emits **one CSV row per run** to stdout, flushed as each
 * run lands, and folds nothing. Aggregation is `npm run sim:report`, a separate pass over that CSV — so a
 * sweep is paid for once and re-analysed any number of times (filter by outcome, pull the outliers, group
 * by any column) without re-running it, and a long sweep is followable as rows arrive. It re-implements
 * **no** game logic — it composes `runPolicies` from `src/sim`.
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
 * and rows swept at a non-default width are not comparable to `baselines/results/`), `--seed <i>` (a
 * **filter** — sweep only that seed index, keeping its seed streams identical to the full sweep's, so a
 * row that lost can be re-run verbatim), and `--verbose` (add a per-turn trace on **stderr**; stdout stays
 * pure CSV, so it composes with a redirect).
 *
 * File schemas — a deck file is `{ "cards": [{ "cardId", "count"?, "stickers"? }, ...] }` (count expands
 * to that many copies; stickers ride on every copy of the entry); a board file is
 * `{ "board": "<id>", "stickers"?: [...] }` (only needed to attach board stickers — a bare `--board <id>`
 * skips it); a baseline file is `{ "id", "mission", "note"?, "board", "deck" }`, where `board` takes either
 * form and `deck` takes the deck file's `cards` array directly. Ready-made examples live under `scripts/sim/`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import {
  runPolicies,
  csvHeaderLine,
  manifestLines,
  recordToCsvLine,
  POLICY_FACTORIES,
  type RunRecord,
  type Scenario,
  type SimAction,
} from '../src/sim';
import type { RunState } from '../src/run/engine';
import { MISSIONS } from '../src/content/missions';
import { CARDS } from '../src/content/cards';
import { BOARDS } from '../src/content/boards';
import { STICKERS } from '../src/content/stickers';
import { BOARD_STICKERS } from '../src/content/boardStickers';
import { findStaffable, freePopulation, type DeckCard, type GameState } from '../src/rules';

/** The policies a bare `--policies`-less run sweeps. Script-local on purpose: it's the user's requested
 *  default (`random,heuristic,greedy`), *not* the same set as the exported `DEFAULT_POLICY_NAMES` (which
 *  means "every built-in except oracle" and is a separate contract other readers rely on). */
const DEFAULT_POLICIES = ['random', 'heuristic', 'greedy'];

/** Print a clean one-line error and exit — a bad flag/file is a user mistake, not a stack-trace-worthy
 *  crash. */
function fail(msg: string): never {
  console.error(`sim: ${msg}`);
  process.exit(1);
}

function csv(s: string | undefined): string[] {
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

// Returns parsed JSON as `any` — the loaders below validate every field they read against the real
// content catalogues, so the untyped shape is checked at use, not by the type system.
function readJson(path: string): any {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return fail(`cannot read file '${path}'.`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`file '${path}' is not valid JSON: ${(e as Error).message}`);
  }
}

/** Validate a card-entry array into a run-ready `DeckCard[]`, expanding each `{ cardId, count, stickers }`
 *  entry into `count` copies. Every cardId/sticker id is checked against the real catalogues — an unknown
 *  id fails fast (a data-coherence check, like the deck editor's own rejects). Takes the array rather than
 *  a path so a deck file's `cards` and a baseline fixture's `deck` are validated by the same code. */
function readCards(path: string, entries: unknown[]): DeckCard[] {
  const deck: DeckCard[] = [];
  for (const entry of entries as any[]) {
    const cardId = entry?.cardId;
    const count = entry?.count ?? 1;
    const stickers: string[] | undefined = entry?.stickers;
    if (typeof cardId !== 'string' || !CARDS[cardId]) fail(`file '${path}': unknown cardId '${cardId}'.`);
    if (!Number.isInteger(count) || count < 1) fail(`file '${path}': card '${cardId}' has invalid count ${count}.`);
    if (stickers !== undefined && !Array.isArray(stickers)) fail(`file '${path}': 'stickers' on '${cardId}' must be an array.`);
    for (const s of stickers ?? []) if (!STICKERS[s]) fail(`file '${path}': unknown sticker '${s}' on '${cardId}'.`);
    for (let i = 0; i < count; i++) deck.push({ cardId, ...(stickers?.length ? { stickers: [...stickers] } : {}) });
  }
  if (deck.length === 0) fail(`file '${path}' has no cards.`);
  return deck;
}

/** Load + validate a deck file into a run-ready `DeckCard[]`. */
function loadDeck(path: string): DeckCard[] {
  const raw = readJson(path);
  if (!raw || !Array.isArray(raw.cards)) fail(`deck file '${path}' must be an object with a 'cards' array.`);
  return readCards(path, raw.cards);
}

/** Resolve `--board` into a board id + its board-sticker ids. A bare content board id (a key of
 *  `BOARDS`) resolves directly with no stickers — a fixture file is only needed to attach some; anything
 *  that isn't a known board id is treated as a path to a board JSON file (the stickered case). */
function resolveBoard(arg: string): { board: string; stickers: string[] } {
  if (BOARDS[arg]) return { board: arg, stickers: [] };
  return loadBoardFile(arg);
}

/** One swept cell: a mission + the exact deck and board it is played with. The ad-hoc trio expands into
 *  one per `--scenario` mission (all sharing the one deck/board); `--baseline` yields one per fixture, each
 *  carrying its *own* deck and board. Everything downstream reads only this, so neither input style is a
 *  special case. */
interface Cell {
  label: string;
  missionId: string;
  deck: DeckCard[];
  board: { board: string; stickers: string[] };
}

/** Load + validate a self-contained baseline fixture. `deck` and `board` reuse the deck/board loaders
 *  wholesale, so a fixture's card list is validated exactly like a deck file's. */
function loadBaseline(path: string): Cell {
  const raw = readJson(path);
  if (!raw || typeof raw.id !== 'string') fail(`baseline file '${path}' must be an object with an 'id'.`);
  if (typeof raw.mission !== 'string' || !MISSIONS[raw.mission]) {
    fail(`baseline file '${path}': unknown mission '${raw.mission}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
  }
  if (!Array.isArray(raw.deck)) fail(`baseline file '${path}' must have a 'deck' array.`);
  if (raw.board === undefined) fail(`baseline file '${path}' must have a 'board'.`);
  const board = typeof raw.board === 'string' ? resolveBoardId(path, raw.board) : readBoard(path, raw.board);
  return { label: raw.id, missionId: raw.mission, deck: readCards(path, raw.deck), board };
}

/** Expand each `--baseline` argument: a directory yields every `.json` directly inside it (so the
 *  committed set sweeps by naming its folder), a file yields itself. Sorted, so a batch's cell order —
 *  and therefore its report — is stable across machines. */
function expandBaselinePaths(args: string[]): string[] {
  const paths = args.flatMap((arg) => {
    let isDir: boolean;
    try {
      isDir = statSync(arg).isDirectory();
    } catch {
      return fail(`cannot read baseline path '${arg}'.`);
    }
    if (!isDir) return [arg];
    const found = readdirSync(arg).filter((f) => f.endsWith('.json')).sort().map((f) => join(arg, f));
    if (found.length === 0) fail(`baseline directory '${arg}' contains no .json fixtures.`);
    return found;
  });
  if (paths.length === 0) fail('--baseline needs at least one fixture path.');
  return paths;
}

/** Resolve a bare board id against the real catalogue, reporting against the file that named it. */
function resolveBoardId(path: string, id: string): { board: string; stickers: string[] } {
  if (!BOARDS[id]) fail(`file '${path}': unknown board '${id}'. Known: ${Object.keys(BOARDS).join(', ')}.`);
  return { board: id, stickers: [] };
}

/** Validate a `{ board, stickers? }` object. Takes the object rather than a path so a board file and a
 *  baseline fixture's inline board are validated by the same code. */
function readBoard(path: string, raw: any): { board: string; stickers: string[] } {
  if (!raw || typeof raw.board !== 'string') fail(`file '${path}': board must be an object with a 'board' id.`);
  if (!BOARDS[raw.board]) fail(`file '${path}': unknown board '${raw.board}'. Known: ${Object.keys(BOARDS).join(', ')}.`);
  const stickers = raw.stickers ?? [];
  if (!Array.isArray(stickers)) fail(`file '${path}': 'stickers' must be an array.`);
  for (const s of stickers) if (!BOARD_STICKERS[s]) fail(`file '${path}': unknown board sticker '${s}'.`);
  return { board: raw.board, stickers };
}

/** Load + validate a board file into a board id + its board-sticker ids. */
function loadBoardFile(path: string): { board: string; stickers: string[] } {
  return readBoard(path, readJson(path));
}

// Wrap `parseArgs` so an unknown flag or stray positional (strict mode throws a raw `TypeError`) surfaces
// as the same clean `sim: …` one-liner as every other user mistake, not a stack trace.
let values: { scenario?: string; deck?: string; board?: string; baseline?: string; seeds?: string; policies?: string; seed?: string; verbose?: boolean; 'max-rounds'?: string; 'search-beam'?: string };
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

/** Render one accepted action readably. Names resolve against `G` = the state *before* the action
 *  (a played hand index only means anything pre-move). */
function formatAction(action: SimAction, G: GameState): string {
  switch (action.kind) {
    case 'playCard': {
      const card = G.hand[action.playHandIdx];
      const name = card ? CARDS[card.cardId]?.name ?? card.cardId : `#${action.playHandIdx}`;
      let s = `play ${name}`;
      if (action.discardHandIdxs?.length) s += ` (discard ${action.discardHandIdxs.length})`;
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
  let turnActions: string[] = [];
  let sawFirst = false;

  const flushTurn = (round: number) => {
    lines.push(`Turn ${round}  ${turnStart}`);
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
        sawFirst = true;
      }
      if (accepted && action.kind !== 'endTurn') turnActions.push(formatAction(action, prev.G));
      if (action.kind === 'endTurn' && accepted) {
        flushTurn(prev.G.round);
        turnStart = snapshot(next.G);
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
const out: string[] = [
  `#sweep ${JSON.stringify({ seeds, policies, ...(seedIndices ? { seedIndices } : {}), ...simOpts, ...searchOpts })}`,
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
