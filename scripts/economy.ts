/**
 * Dev tool — the campaign's Influence economy at a glance, as pure computation over content (no
 * simulation, so it runs instantly). Two halves:
 *
 *  - The **faucet ledger**: the guaranteed one-time Influence the campaign grants, per standard
 *    mission, and the cumulative amount a player has *arriving at* each mission (a DAG walk over the
 *    mission rewards — the same walk `seed-save` folds through `applyRunResult`).
 *  - The **price list**: what everything in the shop costs — copy tiers (`rules/shop.ts`), card
 *    stickers (`content/stickers.ts`), board stickers (`content/boardStickers.ts`) — priced through
 *    the *real* cost data, so a change to the pricing formula is reflected here for free.
 *
 * Both are shown in **raw Influence**. Normalizing against a yardstick (how many grindable
 * infinite-mission runs a reward is worth) is deliberately *not* done here: an infinite run pays
 * `turnsTaken`, which rises with progression (breadth + shop depth) — a sim-measured, progression-
 * dependent quantity, not a content constant. That grind yardstick belongs to the sim half.
 *
 * This is the *income* half of a planned meta-progression economy explorer. The *demand* half — what
 * a mission actually forces you to buy to clear it — needs the simulator and would be a later phase.
 *
 * Usage:
 *   npm run economy                  # text report
 *   npm run economy -- --format json # machine-readable
 */
import { parseArgs } from 'node:util';
import { MISSIONS, type MissionDef } from '../src/content/missions';
import { cumulativeInfluenceInto, foldOrder, prereqClosure } from '../src/rules/campaign';
import { COPY_PRICE_BY_AGE, TIER_LADDER } from '../src/rules/shop';
import { STICKERS } from '../src/content/stickers';
import { BOARD_STICKERS } from '../src/content/boardStickers';

/** Print a clean one-line error and exit — a bad flag is a user mistake, not a stack-trace. */
function fail(msg: string): never {
  console.error(`economy: ${msg}`);
  process.exit(1);
}

let values: { format?: string };
try {
  ({ values } = parseArgs({ options: { format: { type: 'string' } }, allowPositionals: false }));
} catch (e) {
  fail((e as Error).message);
}
const format = values.format ?? 'text';
if (format !== 'text' && format !== 'json') fail(`--format must be 'text' or 'json', got '${format}'.`);

const rewardOf = (m: MissionDef) => m.reward?.influence ?? 0;

// Every mission in dependency order; the ledger reports the standard ones (only they grant a fixed reward).
let ordered: MissionDef[];
try {
  ordered = foldOrder(MISSIONS, prereqClosure(MISSIONS, Object.keys(MISSIONS)));
} catch (e) {
  fail((e as Error).message);
}
const standard = ordered.filter((m) => m.kind === 'standard');

const ledger = standard.map((m) => ({
  id: m.id,
  name: m.name,
  reward: rewardOf(m),
  cumulativeInto: cumulativeInfluenceInto(MISSIONS, m.id),
}));

// A copy costs the same at every rung and differs only by the card's age, so the ladder is one row per
// age: the flat per-copy price, and the cumulative Influence to reach each tier from a single copy.
const copyTiers = Object.entries(COPY_PRICE_BY_AGE).map(([age, perCopy]) => ({
  age,
  perCopy,
  tiers: TIER_LADDER.map((rung, i) => ({ tier: rung.to, cumulative: perCopy * (i + 1) })),
}));

const cardStickers = Object.values(STICKERS).map((s) => ({ id: s.id, name: s.name, cost: s.cost }));
const boardStickers = Object.values(BOARD_STICKERS).map((s) => ({ id: s.id, name: s.name, cost: s.cost }));

if (format === 'json') {
  console.log(JSON.stringify({ ledger, copyTiers, cardStickers, boardStickers }, null, 2));
  process.exit(0);
}

// --- text render ---
const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w: number) => String(n).padStart(w);

const out: string[] = [];
out.push('CivCardGame — Influence economy (raw Influence)');
out.push('');
out.push('Faucet ledger — guaranteed Influence granted along the campaign DAG');
out.push(`  ${pad('mission', 24)}reward   total`);
for (const row of ledger) {
  out.push(`  ${pad(row.name, 24)}${num(row.reward, 6)}${num(row.cumulativeInto, 8)}`);
}
out.push('');
out.push('Price list — shop costs (Influence)');
out.push('  Card copies (flat per copy, by the card\'s age; cumulative from ×1)');
for (const band of copyTiers) {
  const ladder = band.tiers.map((t) => `→ ×${t.tier} ${t.cumulative}`).join('   ');
  out.push(`    ${pad(band.age, 10)}${num(band.perCopy, 4)}/copy   ${ladder}`);
}
out.push('  Card stickers');
if (cardStickers.length === 0) out.push('    (none unlocked in content yet)');
for (const s of cardStickers) out.push(`    ${pad(s.name, 16)}${num(s.cost, 4)}`);
out.push('  Board stickers');
if (boardStickers.length === 0) out.push('    (none unlocked in content yet)');
for (const s of boardStickers) out.push(`    ${pad(s.name, 16)}${num(s.cost, 4)}`);

console.log(out.join('\n'));
