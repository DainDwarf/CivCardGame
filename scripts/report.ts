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
 * Usage:
 *   npm run sim:report -- sweep.csv
 *   npm run sim:report -- scripts/sim/baselines/writing.json
 *   npm run sim:report -- scripts/sim/baselines --format json
 *   npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies greedy | npm run sim:report
 */
import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { formatReport, groupRecords, parseRecordCsv, recordedRuns, summarize, type RunRecord } from '../src/sim';
import { simFileTools } from './simFiles';

function fail(msg: string): never {
  console.error(`sim:report: ${msg}`);
  process.exit(1);
}

const { readJson, expandBaselinePaths } = simFileTools(fail);

let values: { format?: string };
let positionals: string[];
try {
  ({ values, positionals } = parseArgs({
    options: { format: { type: 'string' } },
    allowPositionals: true,
  }));
} catch (e) {
  fail((e as Error).message);
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'json') fail(`--format must be 'text' or 'json', got '${format}'.`);
if (positionals.length > 1) fail(`expected at most one input, got ${positionals.length}.`);

/** Fold every fixture under `arg` (a fixture path or a directory of them) into its recorded runs. An
 *  unmeasured fixture is a normal member of the standing set — a freshly-shipped mission has one until its
 *  balance pass cuts it — so folding a directory skips it and says so on stderr rather than failing the
 *  whole read. Naming one explicitly still fails: there is nothing else the caller could have meant. */
function fixtureRecords(arg: string): RunRecord[] {
  const paths = expandBaselinePaths([arg]);
  const out: RunRecord[] = [];
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
    else out.push(...runs);
  }
  if (out.length === 0) {
    fail(
      paths.length === 1
        ? `baseline '${unmeasured[0]}' has no recorded results — sweep it, then npm run sim:record.`
        : `no fixture under '${arg}' has recorded results yet.`,
    );
  }
  if (unmeasured.length) console.error(`sim:report: skipped ${unmeasured.length} unmeasured: ${unmeasured.join(', ')}`);
  return out;
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

let records: RunRecord[];
if (positionals[0] && isFixturePath(positionals[0])) {
  records = fixtureRecords(positionals[0]);
} else {
  // No path → stdin, so a sweep can be piped straight through without a temp file.
  let text: string;
  try {
    text = readFileSync(positionals[0] ?? 0, 'utf8');
  } catch {
    fail(`cannot read ${positionals[0] ? `file '${positionals[0]}'` : 'stdin'}.`);
  }
  try {
    ({ records } = parseRecordCsv(text));
  } catch (e) {
    fail((e as Error).message);
  }
  if (records.length === 0) fail('sweep file has a header but no runs.');
}

const summaries = groupRecords(records).map(summarize);
console.log(format === 'json' ? JSON.stringify(summaries, null, 2) : formatReport(summaries));
