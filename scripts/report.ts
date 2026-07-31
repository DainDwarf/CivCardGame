/**
 * Analysis tool — fold measured runs into the aggregated balance report.
 *
 * The other half of the measure/analyse split: `npm run sim` measures and writes one row per run, this
 * reads those rows back and aggregates. Nothing here touches the engine, so a sweep is paid for once and
 * re-read as often as the questions require — and because `summarize` folds a `RunRecord[]` whatever its
 * provenance, a live sweep, a re-read sweep file and a committed baseline fixture give the same numbers by
 * construction.
 *
 * Reads either form. A **sweep file** is the CSV `npm run sim` writes. A **baseline fixture** (or a
 * directory of them) holds its own recorded rows, so the standing set's numbers are readable with no sweep
 * at all — which is where a dossier's table comes from.
 *
 * `--against <paths|dir>` compares instead of folding: the input is read as the *new* measurement and the
 * flag names the recorded one, giving one block per cell that moved — win rate, turns, the end pools that
 * shifted, the defeat causes that traded, and **which seeds crossed the win/defeat line**. That last is a
 * paired reading, valid only because seed *i* shuffles the same deck on both sides, so a cell whose
 * fixture no longer describes what was swept keeps its aggregate comparison and loses its per-seed one.
 * Cells that did not move at all collapse to a trailing count.
 *
 * Usage:
 *   npm run sim:report -- sweep.csv
 *   npm run sim:report -- scripts/sim/baselines/writing.json
 *   npm run sim:report -- scripts/sim/baselines --format json
 *   npm run sim:report -- variant.csv --against scripts/sim/baselines
 *   npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies greedy | npm run sim:report
 */
import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  diffRecords,
  formatDiffReport,
  formatReport,
  groupRecords,
  parseRecordCsv,
  recordedRuns,
  summarize,
  unpairDiff,
  type RunRecord,
} from '../src/sim';
import {
  cellConfigOfFixture,
  cellConfigOfManifest,
  configDrift,
  simFileTools,
  type CellConfig,
} from './simFiles';

function fail(msg: string): never {
  console.error(`sim:report: ${msg}`);
  process.exit(1);
}

const { readJson, expandBaselinePaths } = simFileTools(fail);

let values: { format?: string; against?: string };
let positionals: string[];
try {
  ({ values, positionals } = parseArgs({
    options: { format: { type: 'string' }, against: { type: 'string' } },
    allowPositionals: true,
  }));
} catch (e) {
  fail((e as Error).message);
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'json') fail(`--format must be 'text' or 'json', got '${format}'.`);
if (positionals.length > 1) fail(`expected at most one input, got ${positionals.length}.`);

/** Runs plus what each cell was measured *on* — the second half is what lets a comparison say whether the
 *  two sides are about the same content at all. */
interface Measurement {
  records: RunRecord[];
  configs: Map<string, CellConfig>;
}

/** Fold every fixture under `arg` (a fixture path or a directory of them) into its recorded runs. An
 *  unmeasured fixture is a normal member of the standing set — a freshly-shipped mission has one until its
 *  balance pass cuts it — so folding a directory skips it and says so on stderr rather than failing the
 *  whole read. Naming one explicitly still fails: there is nothing else the caller could have meant. */
function readFixtures(arg: string): Measurement {
  const paths = expandBaselinePaths([arg]);
  const out: Measurement = { records: [], configs: new Map() };
  const unmeasured: string[] = [];
  for (const path of paths) {
    const file = readJson(path);
    if (!file || typeof file.id !== 'string') fail(`baseline file '${path}' must be an object with an 'id'.`);
    let runs: RunRecord[];
    try {
      runs = recordedRuns(file);
    } catch (e) {
      return fail((e as Error).message);
    }
    if (runs.length === 0) unmeasured.push(file.id);
    else {
      out.records.push(...runs);
      out.configs.set(file.id, cellConfigOfFixture(file));
    }
  }
  if (out.records.length === 0) {
    fail(
      paths.length === 1
        ? `baseline '${unmeasured[0]}' has no recorded results — sweep it, then npm run sim:record.`
        : `no fixture under '${arg}' has recorded results yet.`,
    );
  }
  if (unmeasured.length) console.error(`sim:report: skipped ${unmeasured.length} unmeasured: ${unmeasured.join(', ')}`);
  return out;
}

function readSweep(path: string | undefined): Measurement {
  // No path → stdin, so a sweep can be piped straight through without a temp file.
  let text: string;
  try {
    text = readFileSync(path ?? 0, 'utf8');
  } catch {
    return fail(`cannot read ${path ? `file '${path}'` : 'stdin'}.`);
  }
  let parsed;
  try {
    parsed = parseRecordCsv(text);
  } catch (e) {
    return fail((e as Error).message);
  }
  if (parsed.records.length === 0) fail('sweep file has a header but no runs.');
  return {
    records: parsed.records,
    configs: new Map(parsed.manifest.map((m) => [m.cell, cellConfigOfManifest(m)])),
  };
}

/** A directory is always fixtures; a file is whichever it parses as. Discriminating by content rather
 *  than by extension keeps a sweep file readable whatever it was named. */
function isFixturePath(arg: string): boolean {
  try {
    if (statSync(arg).isDirectory()) return true;
  } catch {
    return fail(`cannot read '${arg}'.`);
  }
  try {
    return typeof JSON.parse(readFileSync(arg, 'utf8'))?.id === 'string';
  } catch {
    return false;
  }
}

function read(arg: string | undefined): Measurement {
  return arg && isFixturePath(arg) ? readFixtures(arg) : readSweep(arg);
}

const now = read(positionals[0]);

if (values.against === undefined) {
  const summaries = groupRecords(now.records).map(summarize);
  console.log(format === 'json' ? JSON.stringify(summaries, null, 2) : formatReport(summaries));
} else {
  const recorded = read(values.against);
  const diffs = diffRecords(recorded.records, now.records).map((d) => {
    // A cell measured on a different deck still compares in aggregate — that is often the very question —
    // but seed `i` no longer names the same shuffle on both sides, so the per-seed reading goes.
    const [was, is] = [recorded.configs.get(d.label), now.configs.get(d.label)];
    const drift = was && is && configDrift(was, is);
    return drift ? unpairDiff(d, `measured on different content (${drift}) — aggregate only`) : d;
  });
  console.log(format === 'json' ? JSON.stringify(diffs, null, 2) : formatDiffReport(diffs));
}
