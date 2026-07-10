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
