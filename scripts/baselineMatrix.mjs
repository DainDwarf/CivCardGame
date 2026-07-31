// Derive the CI baseline fan-out from the standing set itself: one matrix entry per *measured* fixture,
// each naming the sweeps that reproduce exactly what it recorded. Reading the protocol off `results`
// rather than naming policies here is what keeps CI honest as the set grows — a freshly-shipped mission's
// unmeasured fixture drops out for free instead of being swept and recorded into a false failure, and a
// cell measured under a different policy set re-verifies under that set.
//
// Prints JSON to stdout: [{ id, path, sweeps }], where `sweeps` is a space-separated list of
// `policies:seeds:maxRounds` groups (policies sharing a seed count sweep in one invocation).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'sim', 'baselines');

const entries = [];
for (const name of readdirSync(dir).sort()) {
  if (!name.endsWith('.json')) continue;
  const path = `${join('scripts', 'sim', 'baselines', name).split('\\').join('/')}`;
  const file = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const groups = new Map();
  for (const [policy, result] of Object.entries(file.results ?? {})) {
    const key = `${result.rows.length}:${result.maxRounds}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(policy);
  }
  if (groups.size === 0) continue;
  const sweeps = [...groups].map(([key, policies]) => `${policies.sort().join(',')}:${key}`).join(' ');
  entries.push({ id: file.id, path, sweeps });
}

console.log(JSON.stringify(entries));
