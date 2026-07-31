// Read the standing set for CI, two ways over one walk.
//
// Default: derive the baseline fan-out from the set itself — one matrix entry per *measured* fixture,
// each naming the sweeps that reproduce exactly what it recorded. Reading the protocol off `results`
// rather than naming policies here is what keeps CI honest as the set grows: a cell measured under a
// different policy set re-verifies under that set, and an unmeasured fixture has nothing to sweep, so it
// cannot be swept and recorded into a failure that is really just a first measurement.
//
// `--verify`: fail if any committed fixture is unmeasured. A fixture is cut *by* a mission's balance pass,
// so one landing without its rows is an accident — and the fan-out above would otherwise pass over it in
// silence, which is the one way the set can quietly stop covering what it claims to.
//
// Prints JSON to stdout: [{ id, path, sweeps }], where `sweeps` is a space-separated list of
// `policies:seeds:maxRounds` groups (policies sharing a seed count sweep in one invocation).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'sim', 'baselines');

const measured = [];
const unmeasured = [];
for (const name of readdirSync(dir).sort()) {
  if (!name.endsWith('.json')) continue;
  const path = join('scripts', 'sim', 'baselines', name).split('\\').join('/');
  const file = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const groups = new Map();
  for (const [policy, result] of Object.entries(file.results ?? {})) {
    const key = `${result.rows.length}:${result.maxRounds}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(policy);
  }
  if (groups.size === 0) {
    unmeasured.push(path);
    continue;
  }
  const sweeps = [...groups].map(([key, policies]) => `${policies.sort().join(',')}:${key}`).join(' ');
  measured.push({ id: file.id, path, sweeps });
}

if (!process.argv.includes('--verify')) {
  console.log(JSON.stringify(measured));
} else if (unmeasured.length) {
  console.log(
    `::error::${unmeasured.length} baseline fixture(s) carry no recorded results: ${unmeasured.join(', ')} — ` +
      `sweep each and npm run sim:record, or drop the fixture.`,
  );
  process.exit(1);
} else {
  console.log(`${measured.length} baseline fixtures, all measured.`);
}
