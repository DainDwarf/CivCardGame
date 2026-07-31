/**
 * Analysis tool — fold a sweep file (`npm run sim > sweep.csv`) into the aggregated balance report.
 *
 * The other half of the measure/analyse split: `npm run sim` measures and writes one row per run,
 * this reads those rows back and aggregates. Nothing here touches the engine, so a sweep is paid for
 * once and re-read as often as the questions require — and because `summarize` folds a `RunRecord[]`
 * whatever its provenance, a live sweep and a re-read file give the same numbers by construction.
 *
 * Usage:
 *   npm run sim:report -- sweep.csv
 *   npm run sim:report -- sweep.csv --format json > scripts/sim/baselines/results/greedy-planner.json
 *   npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies greedy | npm run sim:report
 *
 * `--format json` emits the `ScenarioSummary[]` shape committed under `baselines/results/`, so a fresh
 * measurement is recorded by piping a sweep through this rather than by a bespoke exporter.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { formatReport, groupRecords, parseRecordCsv, summarize } from '../src/sim';

function fail(msg: string): never {
  console.error(`sim:report: ${msg}`);
  process.exit(1);
}

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
if (positionals.length > 1) fail(`expected at most one sweep file, got ${positionals.length}.`);

// No path → stdin, so a sweep can be piped straight through without a temp file.
let text: string;
try {
  text = readFileSync(positionals[0] ?? 0, 'utf8');
} catch {
  fail(`cannot read ${positionals[0] ? `file '${positionals[0]}'` : 'stdin'}.`);
}

let records;
try {
  ({ records } = parseRecordCsv(text));
} catch (e) {
  fail((e as Error).message);
}
if (records.length === 0) fail('sweep file has a header but no runs.');

const summaries = groupRecords(records).map(summarize);
console.log(format === 'json' ? JSON.stringify(summaries, null, 2) : formatReport(summaries));
