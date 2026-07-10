/**
 * Balance tool — sweep the headless simulator over many seeds and print an aggregated report.
 *
 * The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine under a move
 * policy; a single run answers little, but running one scenario over many seeds gives statistical
 * balance answers no human can grind: is a mission winnable (win rate), is the food economy too tight
 * (turns distribution + defeat-cause histogram), is a card ever played (per-card play counts + the
 * unplayed-cards list). This re-implements **no** game logic — it composes `runBatch` → `summarize` →
 * `formatReport`, all from `src/sim`.
 *
 * Usage:
 *   npm run sim              # default 200 seeds per scenario
 *   npm run sim -- 500       # override the seed count
 *
 * To change what's swept, edit `SCENARIOS` below — each entry is one deck / board / mission cell,
 * built from plain cardIds (no meta collection needed). As the age arcs add content, add scenarios.
 */
import { runBatch, summarize, formatReport, type Scenario } from '../src/sim';
import { DEFAULT_DECKS } from '../src/content/decks';

const SCENARIOS: Scenario[] = [
  { label: 'founding/tribe/sandbox', deckCardIds: DEFAULT_DECKS[0].cards, board: 'tribe', missionId: 'sandbox' },
];

const seeds = Number(process.argv[2] ?? 200);
if (!Number.isInteger(seeds) || seeds <= 0) {
  throw new Error(`Seed count must be a positive integer, got '${process.argv[2]}'.`);
}

const results = runBatch(SCENARIOS, { seeds });
const summaries = results.map(summarize);

console.log(`# Simulator batch report — ${seeds} seed(s) per scenario\n`);
console.log(formatReport(summaries));
