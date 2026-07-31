/**
 * The file-reading bits the balance tools share — `sim` sweeps baseline fixtures, `sim:record` merges
 * rows back into them and `sim:report` folds them, so all three resolve the same paths and must reject a
 * bad one identically. Each tool passes its own `fail`, which is what puts its name on the message; it
 * stays a plain function declaration in the caller so TypeScript keeps narrowing on its `never` return.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
