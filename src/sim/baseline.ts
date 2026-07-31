import { csvHeaderLine, parseRecordCsv, recordToCsvLine, type RunRecord } from './record';

/**
 * The **results half** of a committed baseline fixture (`scripts/sim/baselines/<id>.json`) — a cell's
 * measurement living in the same file as the config that produced it, so a re-cut fixture can no longer
 * strand rows in a file nobody edits.
 *
 * What is committed is the raw per-run rows, not the folded report: the fold (`report.ts`) is cheap and
 * re-runnable, while the sweep that produced the rows is not, so keeping them means every later question
 * — which seeds flipped, what the losses held — is answerable without re-measuring. Rows are **verbatim**
 * {@link recordToCsvLine} output, `cell`/`policy` columns and all: constant within a file, but that
 * redundancy is what makes {@link recordedRuns}'s cross-checks possible.
 *
 * Only the results half is typed here. A fixture's mission/deck/board are validated against the content
 * catalogues by the scripts that own them, and nothing in this module reads or rewrites them.
 */
export interface RecordedResults {
  /** The effective stall cutoff (`SimOptions.maxRounds`) the rows were swept at — not derivable from
   *  them, and it doubles as the `oracle`/`prover` search depth. */
  maxRounds: number;
  /** The CSV header the rows were written against. Stored per policy rather than per file because the
   *  merge is per policy: one shared header would be refreshed by a partial re-record and then certify a
   *  sibling policy's stale rows, which is the one failure it exists to catch. */
  columns: string;
  rows: string[];
}

/** A baseline fixture as this module sees it. The config half is passed through untouched. */
export interface BaselineResultsFile {
  id: string;
  results?: Record<string, RecordedResults>;
  [key: string]: unknown;
}

/** Every run recorded in `file`, folded back into `RunRecord`s — the same currency a live sweep emits, so
 *  a committed fixture and the sweep it came from summarize identically. Each policy's rows parse against
 *  their *own* stored header, and the two columns that duplicate the file's own identity are checked
 *  rather than trusted: a row naming another cell means the fixture was renamed out from under its
 *  measurement. An absent `results` key is an unmeasured fixture, which reads as no runs, not an error. */
export function recordedRuns(file: BaselineResultsFile): RunRecord[] {
  const out: RunRecord[] = [];
  const header = csvHeaderLine();
  for (const [policy, entry] of Object.entries(file.results ?? {})) {
    const where = `baseline '${file.id}' policy '${policy}'`;
    if (entry.columns !== header) {
      throw new Error(`${where}: rows were recorded against different columns.\n  stored   ${entry.columns}\n  expected ${header}`);
    }
    const { records } = parseRecordCsv([entry.columns, ...entry.rows].join('\n'));
    for (const r of records) {
      if (r.cell !== file.id) throw new Error(`${where}: row names cell '${r.cell}'.`);
      if (r.policy !== policy) throw new Error(`${where}: row names policy '${r.policy}'.`);
    }
    out.push(...records);
  }
  return out;
}

/** Replace one policy's recorded rows, leaving every other key — the other policies, the config —
 *  exactly as it was. Rows are sorted by seed so the committed file is a function of the
 *  measurement alone, not of the order runs happened to land in. */
export function withRecordedPolicy(
  file: BaselineResultsFile,
  policy: string,
  records: readonly RunRecord[],
  opts: { maxRounds: number },
): BaselineResultsFile {
  const rows = [...records].sort((a, b) => a.seed - b.seed).map(recordToCsvLine);
  return {
    ...file,
    results: { ...file.results, [policy]: { maxRounds: opts.maxRounds, columns: csvHeaderLine(), rows } },
  };
}
