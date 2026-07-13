/**
 * Balance tool — sweep the headless simulator over a mission × deck × board matrix and print a report.
 *
 * The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine under a move policy;
 * a single run answers little, but running one cell over many seeds gives statistical balance answers no
 * human can grind: is a mission winnable (win rate), is the food economy too tight (turn distribution +
 * defeat-cause histogram), is a card ever played (per-card play counts + the unplayed-cards list). This
 * re-implements **no** game logic — it composes `runPolicies` → `summarize` → `formatReport` from `src/sim`.
 *
 * The three axes are decoupled the way the campaign menu presents them: pick the **mission(s)** by id
 * (looked up live from `content/missions.ts` — no copied deck lists), point `--deck`/`--board` at
 * hand-editable JSON files. One invocation sweeps `[missions] × {the deck} × {the board}`; to compare two
 * decks or boards, edit a file or invoke twice. Each cell is swept under several policies with *identical*
 * seed streams, so the comparison is paired: `random` is the difficulty floor / crash fuzzer, `greedy` /
 * `heuristic` the competent ceiling, and the gap tells you how much skill a scenario rewards. `greedy2`
 * (greedy + a staffing lookahead) and the `oracle` (a winnability prover) are nameable but slow — opt in
 * with a small seed count.
 *
 * Usage:
 *   npm run sim -- --scenario growing_numbers --deck scripts/sim/decks/growing-numbers.json --board scripts/sim/boards/tribe.json
 *   npm run sim -- --scenario first_settlement,growing_numbers --deck <file> --board <file> --seeds 500
 *   npm run sim -- --scenario rites_rituals --deck <file> --board <file> --policies greedy,heuristic
 *   npm run sim -- --scenario growing_numbers --deck <file> --board <file> --format json
 *   npm run sim -- --scenario growing_numbers --deck <file> --board <file> --policies greedy --seed 3   # replay one run
 *
 * Flags: `--scenario` (required, one or more mission ids), `--deck`/`--board` (required, JSON file paths),
 * `--seeds` (default 100), `--policies` (default random,heuristic,greedy), `--format` (text|json), and
 * `--seed <i>` which switches to **replay mode** — re-run the single (mission, policy, index) cell the
 * batch would have run and print a per-turn trace (needs exactly one scenario and one policy).
 *
 * File schemas — a deck file is `{ "cards": [{ "cardId", "count"?, "stickers"? }, ...] }` (count expands
 * to that many copies; stickers ride on every copy of the entry); a board file is
 * `{ "board": "<id>", "stickers"?: [...] }`. Ready-made examples live under `scripts/sim/`.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import {
  runPolicies,
  summarize,
  formatReport,
  simConfig,
  simulateRun,
  POLICY_FACTORIES,
  type Scenario,
  type SimAction,
} from '../src/sim';
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

/** Load + validate a deck file into a run-ready `DeckCard[]`, expanding each `{ cardId, count, stickers }`
 *  entry into `count` copies. Every cardId/sticker id is checked against the real catalogues — an unknown
 *  id fails fast (a data-coherence check, like the deck editor's own rejects). */
function loadDeck(path: string): DeckCard[] {
  const raw = readJson(path);
  if (!raw || !Array.isArray(raw.cards)) fail(`deck file '${path}' must be an object with a 'cards' array.`);
  const deck: DeckCard[] = [];
  for (const entry of raw.cards) {
    const cardId = entry?.cardId;
    const count = entry?.count ?? 1;
    const stickers: string[] | undefined = entry?.stickers;
    if (typeof cardId !== 'string' || !CARDS[cardId]) fail(`deck file '${path}': unknown cardId '${cardId}'.`);
    if (!Number.isInteger(count) || count < 1) fail(`deck file '${path}': card '${cardId}' has invalid count ${count}.`);
    if (stickers !== undefined && !Array.isArray(stickers)) fail(`deck file '${path}': 'stickers' on '${cardId}' must be an array.`);
    for (const s of stickers ?? []) if (!STICKERS[s]) fail(`deck file '${path}': unknown sticker '${s}' on '${cardId}'.`);
    for (let i = 0; i < count; i++) deck.push({ cardId, ...(stickers?.length ? { stickers: [...stickers] } : {}) });
  }
  if (deck.length === 0) fail(`deck file '${path}' has no cards.`);
  return deck;
}

/** Load + validate a board file into a board id + its board-sticker ids. */
function loadBoard(path: string): { board: string; stickers: string[] } {
  const raw = readJson(path);
  if (!raw || typeof raw.board !== 'string') fail(`board file '${path}' must be an object with a 'board' id.`);
  if (!BOARDS[raw.board]) fail(`board file '${path}': unknown board '${raw.board}'. Known: ${Object.keys(BOARDS).join(', ')}.`);
  const stickers = raw.stickers ?? [];
  if (!Array.isArray(stickers)) fail(`board file '${path}': 'stickers' must be an array.`);
  for (const s of stickers) if (!BOARD_STICKERS[s]) fail(`board file '${path}': unknown board sticker '${s}'.`);
  return { board: raw.board, stickers };
}

// Wrap `parseArgs` so an unknown flag or stray positional (strict mode throws a raw `TypeError`) surfaces
// as the same clean `sim: …` one-liner as every other user mistake, not a stack trace.
let values: { scenario?: string; deck?: string; board?: string; seeds?: string; policies?: string; format?: string; seed?: string };
try {
  ({ values } = parseArgs({
    options: {
      scenario: { type: 'string' },
      deck: { type: 'string' },
      board: { type: 'string' },
      seeds: { type: 'string' },
      policies: { type: 'string' },
      format: { type: 'string' },
      seed: { type: 'string' },
    },
    allowPositionals: false,
  }));
} catch (e) {
  fail((e as Error).message);
}

if (!values.scenario) fail('--scenario is required (one or more mission ids, comma-separated).');
if (!values.deck) fail('--deck is required (path to a deck JSON file).');
if (!values.board) fail('--board is required (path to a board JSON file).');

const missionIds = csv(values.scenario);
for (const id of missionIds) {
  if (!MISSIONS[id]) fail(`unknown --scenario mission '${id}'. Known: ${Object.keys(MISSIONS).join(', ')}.`);
}

const seeds = values.seeds !== undefined ? Number(values.seeds) : 100;
if (!Number.isInteger(seeds) || seeds <= 0) fail(`--seeds must be a positive integer, got '${values.seeds}'.`);

const policies = values.policies !== undefined ? csv(values.policies) : DEFAULT_POLICIES;
for (const p of policies) {
  if (!POLICY_FACTORIES[p]) fail(`unknown policy '${p}'. Known: ${Object.keys(POLICY_FACTORIES).join(', ')}.`);
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'json') fail(`--format must be 'text' or 'json', got '${format}'.`);

const deck = loadDeck(values.deck);
const board = loadBoard(values.board);
const boardLabel = `${board.board}${board.stickers.length ? ` +${board.stickers.join(',')}` : ''}`;

// ---- Replay mode: re-run one exact cell with a per-turn trace ----------------------------------------

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

function replay(missionId: string, policyName: string, idx: number): void {
  const config = simConfig({
    deckCardIds: deck,
    board: board.board,
    boardStickers: board.stickers,
    missionId,
    seed: `${missionId}-cfg-${idx}`,
  });
  const policy = POLICY_FACTORIES[policyName](`${missionId}-pol-${idx}`);

  const lines: string[] = [];
  let turnStart = '';
  let turnActions: string[] = [];
  let sawFirst = false;

  const flushTurn = (round: number) => {
    lines.push(`Turn ${round}  ${turnStart}`);
    lines.push(`  ${turnActions.length ? turnActions.join(' · ') : '(no moves)'}`);
    turnActions = [];
  };

  const outcome = simulateRun(config, policy, {
    onStep: ({ action, prev, next, accepted }) => {
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
  });
  // A run that ends mid-turn (a play triggers win/loss before any endTurn) leaves a partial turn buffered.
  if (turnActions.length) flushTurn(outcome.finalState.round);

  const g = outcome.gameover;
  console.log(`# Replay — ${MISSIONS[missionId].name} · ${policyName} · seed ${idx}`);
  console.log(`#   deck: ${basename(values.deck!)} (${deck.length} cards) · board: ${boardLabel}\n`);
  console.log(lines.join('\n'));
  console.log(`\n→ ${g.outcome}${g.reason ? ` (${g.reason})` : ''} · round ${outcome.finalState.round} · ${outcome.actionsApplied} actions`);
}

if (values.seed !== undefined) {
  const idx = Number(values.seed);
  if (!Number.isInteger(idx) || idx < 0) fail(`--seed must be a non-negative integer index, got '${values.seed}'.`);
  if (missionIds.length !== 1) fail(`replay (--seed) needs exactly one --scenario mission, got ${missionIds.length}.`);
  if (policies.length !== 1) fail(`replay (--seed) needs exactly one --policies policy, got ${policies.length}.`);
  replay(missionIds[0], policies[0], idx);
  process.exit(0);
}

// ---- Batch mode ---------------------------------------------------------------------------------------

const scenarios: Scenario[] = missionIds.map((missionId) => ({
  label: missionId,
  deckCardIds: deck,
  board: board.board,
  missionId,
  boardStickers: board.stickers,
}));

const summaries = runPolicies(scenarios, policies, { seeds }).map(summarize);

if (format === 'json') {
  console.log(JSON.stringify(summaries, null, 2));
} else {
  console.log(`# Simulator batch — ${seeds} seed(s) per cell · policies: ${policies.join(', ')}`);
  console.log(`#   deck: ${basename(values.deck)} (${deck.length} cards) · board: ${boardLabel}`);
  console.log(`#   scenarios: ${missionIds.join(', ')}\n`);
  console.log(formatReport(summaries));
}
