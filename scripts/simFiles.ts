/**
 * The file-reading bits the balance tools share — `sim` sweeps baseline fixtures, `sim:record` merges
 * rows back into them and `sim:report` folds them, so all three resolve the same paths and must reject a
 * bad one identically. Each tool passes its own `fail`, which is what puts its name on the message; it
 * stays a plain function declaration in the caller so TypeScript keeps narrowing on its `never` return.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { variantKey } from '../src/rules/deckBuilder';
import type { CellManifest } from '../src/sim';

/** Print a clean one-line error and exit — a bad flag/file is a user mistake, not a stack-trace-worthy
 *  crash. */
export type Fail = (msg: string) => never;

export interface SimFileTools {
  /** Returns parsed JSON as `any`: the callers validate every field they read against the real content
   *  catalogues, so the untyped shape is checked at use, not by the type system. */
  readJson: (path: string) => any;
  /** Expand each baseline argument: a directory yields every `.json` directly inside it (so the committed
   *  set is named by its folder), a file yields itself. Sorted, so cell order — and therefore a report —
   *  is stable across machines. */
  expandBaselinePaths: (args: string[]) => string[];
}

export function simFileTools(fail: Fail): SimFileTools {
  const readJson = (path: string): any => {
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
  };

  const expandBaselinePaths = (args: string[]): string[] => {
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
    if (paths.length === 0) fail('needs at least one baseline fixture path.');
    return paths;
  };

  return { readJson, expandBaselinePaths };
}

// ---- Is a measurement still about this cell? ---------------------------------------------------------

/** The three axes a cell *is*, in a form two differently-shaped sources compare through: a fixture on
 *  disk and the `#cell` manifest a sweep carries. */
export interface CellConfig {
  mission: string;
  board: string;
  boardStickers: string[];
  /** Variant key → copies, so the comparison survives presentation: the manifest groups the expanded deck
   *  by variant, while a fixture may author the same variant as several entries, in any order. */
  deck: Record<string, number>;
}

function deckTally(entries: { cardId: string; count?: number; stickers?: string[] }[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const e of entries ?? []) {
    const key = variantKey({ cardId: e.cardId, ...(e.stickers?.length ? { stickers: e.stickers } : {}) });
    tally[key] = (tally[key] ?? 0) + (e.count ?? 1);
  }
  return tally;
}

export function cellConfigOfFixture(file: any): CellConfig {
  const board = typeof file.board === 'string' ? { board: file.board, stickers: [] } : file.board ?? {};
  return {
    mission: file.mission,
    board: board.board,
    boardStickers: board.stickers ?? [],
    deck: deckTally(file.deck ?? []),
  };
}

export function cellConfigOfManifest(cell: CellManifest): CellConfig {
  return { mission: cell.mission, board: cell.board, boardStickers: cell.boardStickers, deck: deckTally(cell.deck) };
}

/** What differs between two readings of the same cell, or `undefined` when nothing does. Two callers,
 *  one question: `sim:record` refuses to file rows against a fixture that no longer describes them, and
 *  `sim:report --against` drops the per-seed pairing, since the same seed index shuffles a different deck
 *  on each side. */
export function configDrift(a: CellConfig, b: CellConfig): string | undefined {
  if (a.mission !== b.mission) return `mission '${a.mission}' vs '${b.mission}'`;
  if (a.board !== b.board) return `board '${a.board}' vs '${b.board}'`;
  if ([...a.boardStickers].sort().join() !== [...b.boardStickers].sort().join()) return 'board stickers';
  // Sorted, because a tally's key order follows whichever entry order the source happened to author.
  const tally = (d: Record<string, number>) => Object.keys(d).sort().map((k) => `${k}x${d[k]}`).join(',');
  if (tally(a.deck) !== tally(b.deck)) return 'deck';
  return undefined;
}

/** One line, spaced the way the fixtures are hand-authored (`{ "cardId": "farm", "count": 1 }`). */
function flat(value: unknown): string {
  if (Array.isArray(value)) return value.length ? `[${value.map(flat).join(', ')}]` : '[]';
  if (value && typeof value === 'object') {
    const fields = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${flat(v)}`);
    return fields.length ? `{ ${fields.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** Pretty-print JSON, keeping anything that fits within `width` on one line. `JSON.stringify`'s indent
 *  mode has no such rule, so it would explode a fixture's one-line deck entries into five lines apiece
 *  and bury a re-record's real diff — while the width rule still gives a long `rows` array a line per
 *  row, which is the whole point of committing them. */
export function stringifyCompact(value: unknown, width = 110, indent = ''): string {
  const oneLine = flat(value);
  if (indent.length + oneLine.length <= width || !value || typeof value !== 'object') return oneLine;
  const inner = `${indent}  `;
  const fields = Array.isArray(value)
    ? value.map((v) => `${inner}${stringifyCompact(v, width, inner)}`)
    : Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringifyCompact(v, width, inner)}`);
  const [open, close] = Array.isArray(value) ? '[]' : '{}';
  return `${open}\n${fields.join(',\n')}\n${indent}${close}`;
}
