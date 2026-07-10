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
 * Each scenario is swept under several move policies (`POLICY_FACTORIES`) with *identical* seed streams,
 * so the comparison is paired: the random fuzzer is the difficulty *floor*, the greedy / heuristic
 * policies the competent *ceiling*, and the gap tells you how much skill a scenario rewards.
 *
 * Usage:
 *   npm run sim                       # default 200 seeds per scenario, all policies
 *   npm run sim -- 500                # override the seed count
 *   npm run sim -- 500 greedy         # only the named policy/policies (comma- or space-separated)
 *   npm run sim -- 200 random,greedy
 *
 * To change what's swept, edit `SCENARIOS` below — each entry is one deck / board / mission cell,
 * built from plain cardIds (no meta collection needed). As the age arcs add content, add scenarios.
 */
import { runPolicies, summarize, formatReport, POLICY_FACTORIES, type Scenario } from '../src/sim';
import { DEFAULT_DECKS } from '../src/content/decks';

const SCENARIOS: Scenario[] = [
  { label: 'founding/tribe/sandbox', deckCardIds: DEFAULT_DECKS[0].cards, board: 'tribe', missionId: 'sandbox' },
  // A `'standard'` threshold mission (no deadline): terminates because the greedy/heuristic policies are
  // now goal-directed — they steer by the objective's progress gradient (`sim/objective.ts`) and reach
  // the win (or starve trying) in a handful of turns, rather than drifting at a survival equilibrium and
  // blowing `simulateRun`'s action cap the way the old survival-only policies did. The win rate here is
  // the "is this mission winnable, and how hard?" answer; a low one on the buildingless Founding deck is
  // the intended difficulty, not a policy failure.
  { label: 'founding/tribe/first-settlement', deckCardIds: DEFAULT_DECKS[0].cards, board: 'tribe', missionId: 'first_settlement' },
];

const seeds = Number(process.argv[2] ?? 200);
if (!Number.isInteger(seeds) || seeds <= 0) {
  throw new Error(`Seed count must be a positive integer, got '${process.argv[2]}'.`);
}

// Optional policy filter: any args past the seed count, comma- or space-separated. Default: all.
const policyArgs = process.argv
  .slice(3)
  .flatMap((a) => a.split(','))
  .map((a) => a.trim())
  .filter(Boolean);
const policies = policyArgs.length > 0 ? policyArgs : Object.keys(POLICY_FACTORIES);
for (const p of policies) {
  if (!POLICY_FACTORIES[p]) {
    throw new Error(`Unknown policy '${p}'. Known: ${Object.keys(POLICY_FACTORIES).join(', ')}.`);
  }
}

const results = runPolicies(SCENARIOS, policies, { seeds });
const summaries = results.map(summarize);

console.log(`# Simulator batch report — ${seeds} seed(s) per scenario · policies: ${policies.join(', ')}\n`);
console.log(formatReport(summaries));
