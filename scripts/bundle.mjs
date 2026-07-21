// Bundle the Node dev scripts to plain ESM so they run under bare `node` instead of `tsx`.
// tsx loads TypeScript through esbuild with its `keepNames` transform on, whose per-call `__name`
// wrapper measured ~15% of a sim sweep's runtime (profile skill); a default esbuild build omits it.
// Rebuilt on every `npm run`, so the bundle can never go stale against a source edit — the build is
// tens of milliseconds against runs measured in minutes.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ['sim', 'seed-save', 'economy'].map((name) => join(here, `${name}.ts`)),
  outdir: join(here, '.bundle'),
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external', // resolve npm deps at runtime via node; only the local TS is bundled
  logLevel: 'warning',
});
