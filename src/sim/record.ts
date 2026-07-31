import { MISSIONS } from '../content/missions';
import { variantKey, type DeckCard } from '../rules/deckBuilder';
import { CORE_KEYS, STRATEGIC_KEYS, emptyResources, type Resources } from '../rules/resources';
import type { Scenario } from './batch';
import type { SimOutcome } from './simulate';

/**
 * One finished run, measured. The simulator's **only** output: a sweep emits one of these per run and
 * folds nothing, so the same measurement answers any number of later questions (which seeds lost, what
 * the outliers held, how the wins differ from the losses) without re-running anything. Aggregation is a
 * separate pass over a set of these (`report.ts`), reachable from a re-read file as well as from a live
 * sweep — that equivalence is the whole point of the split.
 */
export interface RunRecord {
  /** The `Scenario.label` — a cell *is* a (mission, board, deck), so mission and board are not repeated
   *  on the row; the manifest header carries that mapping once. */
  cell: string;
  policy: string;
  /** The batch seed index, i.e. the `--seed <i>` that replays this exact run. */
  seed: number;
  /** `'win'` on a victory, else the authoritative `gameover.reason` verbatim. One column rather than an
   *  outcome/reason pair: wins are `=== 'win'`, defeats `!== 'win'`, one cause an equality — and no
   *  reason can collide, they are `CollapseReason`s, `stall`, `noWinFound:<bound>` or a threat's text.
   *  `'unknown'` is the one value no card authored — a defeat the engine gave no reason for. */
  outcome: string;
  turns: number;
  /** Actions dispatched, including ones the engine rejected (`SimOutcome.actionsApplied`). */
  actions: number;
  /** All eight pools at run end. A collapse legitimately ends on a negative one. */
  resources: Resources;
  structures: number;
  routes: number;
  reshuffles: number;
  /** Plays per cardId, **zero-filled** over every card this cell could have played — the deck, the
   *  mission's `events` (shuffled in at setup) and its `alsoDisplay` (what a run can only mint mid-play,
   *  e.g. Accounting's Thief). Two consequences: "unplayed" becomes a *per-run* fact readable off the row
   *  alone, and the key set is identical across every row of a cell, so the packed column parses into a
   *  rectangular table. Threats and the objective are excluded — they never route through `playCard`. */
  cardPlays: Record<string, number>;
}

/** The CSV column order. `cardsPlayed` is last because it is the one variable-width field. */
export const RECORD_COLUMNS = [
  'cell',
  'policy',
  'seed',
  'outcome',
  'turns',
  'actions',
  ...CORE_KEYS,
  ...STRATEGIC_KEYS,
  'structures',
  'routes',
  'reshuffles',
  'cardsPlayed',
] as const;

/** The `outcome` value marking a victory — every other value is a defeat cause. */
export const WIN_OUTCOME = 'win';

/** Every cardId a run of `scenario` could have played: its deck, plus the mission's seeded `events` and
 *  its `alsoDisplay` mid-play injections. */
function playableCardIds(scenario: Scenario): string[] {
  const mission = MISSIONS[scenario.missionId];
  return [
    ...scenario.deckCardIds.map((c) => (typeof c === 'string' ? c : c.cardId)),
    ...(mission?.events ?? []),
    ...(mission?.alsoDisplay ?? []),
  ];
}

/** Fold one finished run into its {@link RunRecord}. */
export function toRunRecord(scenario: Scenario, policy: string, seed: number, o: SimOutcome): RunRecord {
  const cardPlays: Record<string, number> = {};
  for (const id of playableCardIds(scenario)) cardPlays[id] = 0;
  for (const [id, n] of Object.entries(o.cardPlays)) cardPlays[id] = n;

  return {
    cell: scenario.label,
    policy,
    seed,
    outcome: o.result.outcome === 'victory' ? WIN_OUTCOME : o.gameover.reason ?? 'unknown',
    turns: o.result.stats.turnsTaken,
    actions: o.actionsApplied,
    resources: o.result.stats.finalResources,
    structures: o.finalState.tableau.length,
    routes: o.finalState.tradeRoutes.length,
    reshuffles: o.finalState.reshuffleCount,
    cardPlays,
  };
}

// ---- CSV ---------------------------------------------------------------------------------------------

/** Quote a field only when it needs it. A defeat cause is authored free text (a threat may name its own),
 *  so one containing a comma must not shift every column after it. */
function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Split one CSV line, honouring `esc`'s quoting. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

export function csvHeaderLine(): string {
  return RECORD_COLUMNS.join(',');
}

/** Card counts sorted by cardId, so two sweeps of the same cell diff line-for-line. */
function packCardPlays(cardPlays: Record<string, number>): string {
  return Object.keys(cardPlays).sort().map((id) => `${id}:${cardPlays[id]}`).join(';');
}

function unpackCardPlays(field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of field.split(';')) {
    if (!pair) continue;
    const at = pair.lastIndexOf(':');
    out[pair.slice(0, at)] = Number(pair.slice(at + 1));
  }
  return out;
}

export function recordToCsvLine(r: RunRecord): string {
  return [
    esc(r.cell),
    esc(r.policy),
    r.seed,
    esc(r.outcome),
    r.turns,
    r.actions,
    ...CORE_KEYS.map((k) => r.resources[k]),
    ...STRATEGIC_KEYS.map((k) => r.resources[k]),
    r.structures,
    r.routes,
    r.reshuffles,
    esc(packCardPlays(r.cardPlays)),
  ].join(',');
}

// ---- Manifest ----------------------------------------------------------------------------------------

/** What a cell's label stands for. Carried as `#`-comment lines above the CSV (which standard parsers
 *  skip) so a sweep file is a complete record of itself: the row data holds no constant-per-cell field,
 *  and the deck's *composition* — copy counts and per-copy stickers — is expressible nowhere else. */
export interface CellManifest {
  cell: string;
  mission: string;
  board: string;
  boardStickers: string[];
  deck: { cardId: string; count: number; stickers?: string[] }[];
}

const MANIFEST_TAG = '#cell ';

/** How a sweep was taken — the flags that decide whether its rows are comparable to anything else.
 *  `maxRounds`/`beamWidth` are the **effective** values, never the raw flags, so a file that names no
 *  flag still says what it ran at. `seedIndices` marks a `--seed <i>` replay: a filtered sweep is a
 *  diagnostic, not a measurement. */
export interface SweepHeader {
  seeds: number;
  policies: string[];
  seedIndices?: number[];
  maxRounds: number;
  beamWidth: number;
}

const SWEEP_TAG = '#sweep ';

/** Regroup a scenario's expanded draw-order deck back into `{ cardId, count, stickers }` entries — the
 *  shape the deck/baseline files are authored in. Grouped by `variantKey`, so two copies differing only
 *  in sticker *order* count as one entry, matching how the deck editor pools them. */
function groupDeck(deckCardIds: Scenario['deckCardIds']): CellManifest['deck'] {
  const byVariant = new Map<string, { cardId: string; count: number; stickers?: string[] }>();
  for (const entry of deckCardIds) {
    const card: DeckCard = typeof entry === 'string' ? { cardId: entry } : entry;
    const key = variantKey(card);
    const found = byVariant.get(key);
    if (found) found.count += 1;
    else byVariant.set(key, { cardId: card.cardId, count: 1, ...(card.stickers?.length ? { stickers: [...card.stickers] } : {}) });
  }
  return [...byVariant.values()];
}

export function manifestOf(scenario: Scenario): CellManifest {
  return {
    cell: scenario.label,
    mission: scenario.missionId,
    board: scenario.board,
    boardStickers: [...(scenario.boardStickers ?? [])],
    deck: groupDeck(scenario.deckCardIds),
  };
}

export function manifestLines(scenarios: readonly Scenario[]): string[] {
  return scenarios.map((s) => `${MANIFEST_TAG}${JSON.stringify(manifestOf(s))}`);
}

export function sweepLine(header: SweepHeader): string {
  return `${SWEEP_TAG}${JSON.stringify(header)}`;
}

// ---- Reading a sweep file ----------------------------------------------------------------------------

/** Parse a sweep file back into its records, manifest and sweep header — the seam that lets an analysis
 *  pass run off a re-read file exactly as it would off a live sweep. Unknown `#` lines are skipped, so
 *  metadata can be added above the header without breaking older files, and so is anything before the
 *  header row: a redirected `npm run sim > sweep.csv` prepends npm's own `> package@version script`
 *  preamble to stdout, and a sweep file that fails to load over that is a trap, not a diagnostic. */
export function parseRecordCsv(text: string): {
  records: RunRecord[];
  manifest: CellManifest[];
  sweep?: SweepHeader;
} {
  const records: RunRecord[] = [];
  const manifest: CellManifest[] = [];
  const header = csvHeaderLine();
  let sweep: SweepHeader | undefined;
  let columns: string[] | null = null;
  let firstSkipped: string | undefined;

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      if (line.startsWith(MANIFEST_TAG)) manifest.push(JSON.parse(line.slice(MANIFEST_TAG.length)));
      else if (line.startsWith(SWEEP_TAG)) sweep = JSON.parse(line.slice(SWEEP_TAG.length));
      continue;
    }
    if (!columns) {
      if (line !== header) {
        firstSkipped ??= line;
        continue;
      }
      columns = splitCsv(line);
      continue;
    }
    const fields = splitCsv(line);
    const at = (name: string) => fields[columns!.indexOf(name)];
    const resources = emptyResources();
    for (const k of [...CORE_KEYS, ...STRATEGIC_KEYS]) resources[k] = Number(at(k));
    records.push({
      cell: at('cell'),
      policy: at('policy'),
      seed: Number(at('seed')),
      outcome: at('outcome'),
      turns: Number(at('turns')),
      actions: Number(at('actions')),
      resources,
      structures: Number(at('structures')),
      routes: Number(at('routes')),
      reshuffles: Number(at('reshuffles')),
      cardPlays: unpackCardPlays(at('cardsPlayed')),
    });
  }
  if (!columns) {
    throw new Error(
      `no CSV header row found — is this a sweep file?` +
        (firstSkipped ? `\n  first data line ${firstSkipped}\n  expected header ${header}` : ''),
    );
  }
  return { records, manifest, ...(sweep ? { sweep } : {}) };
}
