import { describe, it, expect } from 'vitest';
import { runPolicies, summarize, type Scenario, type ScenarioSummary } from './index';
import type { Resources } from '../rules';
import { DEFAULT_DECKS } from '../content/decks';

const SCENARIO: Scenario = {
  label: 'founding/tribe/sandbox',
  deckCardIds: DEFAULT_DECKS[0].cards,
  board: 'tribe',
  missionId: 'sandbox',
};

function totalResources(r: Resources): number {
  return r.food + r.production + r.science + r.military + r.money;
}

describe('greedy & heuristic policies — competence over the random floor', () => {
  // The sandbox never *wins* (`sandbox_goal.objective: () => false`), so the competence signal isn't
  // win rate — it's how long a policy survives before famine/deadline and how much it banks. A random
  // walk starves almost immediately; a policy that plays to a value function should survive far longer
  // and accumulate real resources. Seeds are held identical across policies by `runPolicies`, so this
  // is a paired comparison (same deck shuffles — the only variable is how each policy plays).
  //
  // `runPolicies` runs every step through `simulateRun` with invariant checks on by default, so a
  // green run also means no greedy/heuristic action ever drove the engine into an illegal state.
  const runs = runPolicies([SCENARIO], ['random', 'greedy', 'heuristic'], { seeds: 25 });
  const byName = (name: string): ScenarioSummary => {
    const found = runs.find((r) => r.policyName === name);
    if (!found) throw new Error(`no runs for policy ${name}`);
    return summarize(found);
  };
  const random = byName('random');
  const greedy = byName('greedy');
  const heuristic = byName('heuristic');

  it('ran all three policies over the full seed set', () => {
    expect(random.runs).toBe(25);
    expect(greedy.runs).toBe(25);
    expect(heuristic.runs).toBe(25);
    // Sanity: the sandbox is unwinnable, so no policy should ever record a victory.
    expect(random.wins + greedy.wins + heuristic.wins).toBe(0);
  });

  it('greedy and heuristic both survive far longer than the random fuzzer', () => {
    // Observed: random ≈ 3 turns, greedy ≈ 35, heuristic ≈ 34. Thresholds are deliberately slack to
    // absorb seed variance while still catching a policy that regresses toward random flailing.
    expect(greedy.turns.mean).toBeGreaterThan(15);
    expect(heuristic.turns.mean).toBeGreaterThan(15);
    expect(greedy.turns.mean).toBeGreaterThan(random.turns.mean * 2);
    expect(heuristic.turns.mean).toBeGreaterThan(random.turns.mean * 2);
    // A competent run should reach deep into the mission at least once (greedy tops out near the
    // round-51 deadline); random peters out early.
    expect(greedy.turns.max).toBeGreaterThan(20);
  });

  it('greedy banks far more end resources than the starving random policy', () => {
    // Random ends around 0 total (it dies of famine before accumulating anything); greedy ends with
    // tens of banked resources. A wide, variance-proof margin.
    expect(totalResources(greedy.meanResources)).toBeGreaterThan(20);
    expect(totalResources(greedy.meanResources)).toBeGreaterThan(totalResources(random.meanResources) + 10);
  });
});

describe('goal-directed steering — a threshold mission the policies must actually pursue', () => {
  // "The First Settlement" wins at 10🔨 + 10⚔️ *at once* with the buildingless Founding deck. Unlike the
  // sandbox it has a real win, and reaching it needs a policy that *stockpiles toward the goal* rather
  // than drifting at a survival equilibrium — the whole point of the objective-progress gradient
  // (`sim/objective.ts`) feeding the greedy's `scoreState` and the heuristic's objective rung. A
  // survival-only policy would never accumulate to it (and, with no deadline, never terminate).
  //
  // This block also implicitly asserts **termination**: `simulateRun` throws if a run never reaches
  // gameover, so a green run means every goal-directed run finished (won, or starved trying) well under
  // the action cap — the property that lets a no-deadline mission be swept at all.
  const FS: Scenario = {
    label: 'founding/tribe/first-settlement',
    deckCardIds: DEFAULT_DECKS[0].cards,
    board: 'tribe',
    missionId: 'first_settlement',
  };
  const runs = runPolicies([FS], ['random', 'greedy', 'heuristic'], { seeds: 25 });
  const rate = (name: string): number => {
    const found = runs.find((r) => r.policyName === name);
    if (!found) throw new Error(`no runs for policy ${name}`);
    return summarize(found).winRate;
  };

  it('greedy and heuristic win most of the time; the random floor almost never does', () => {
    // Observed ≈ 0.95 for both competent policies; the threshold is slack for seed variance but well
    // clear of the random floor (a random walk stumbles into 10/10 essentially never).
    expect(rate('greedy')).toBeGreaterThan(0.6);
    expect(rate('heuristic')).toBeGreaterThan(0.6);
    expect(rate('greedy')).toBeGreaterThan(rate('random'));
    expect(rate('heuristic')).toBeGreaterThan(rate('random'));
    expect(rate('random')).toBeLessThan(0.2);
  });
});
