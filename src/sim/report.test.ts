import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { summarize } from './report';
import { runBatch, type Scenario, type ScenarioRuns } from './batch';
import { simConfig, simulateRun, createRandomPolicy, type SimOutcome } from './index';
import { blankState } from '../rules';
import { emptyResources, type Resources } from '../rules/resources';
import { installFixtures, uninstallFixtures, TEST_BOARD_ID } from '../rules/testFixtures';

// A synthetic deck of freely-playable fixture cards — several zero-cost actions/work so a random policy
// reliably plays *some* card over a short run, and the whole run stays independent of the shipped catalogue.
const FIXTURE_DECK = ['test_work', 'test_bespoke', 'test_dynamic', 'test_growing', 'test_action', 'test_settlers'];

/** Build a minimal `SimOutcome` for aggregation tests. `summarize` reads only `result`/`gameover`/
 *  `actionsApplied`/`cardPlays`, so `finalState` is a throwaway `blankState()` (built via the real
 *  helper, not a cast). */
function outcome(opts: {
  outcome: 'victory' | 'defeat';
  turnsTaken: number;
  reason?: string;
  cardPlays?: Record<string, number>;
  actionsApplied?: number;
  finalResources?: Partial<Resources>;
}): SimOutcome {
  const finalResources = { ...emptyResources(), ...opts.finalResources };
  return {
    result: { outcome: opts.outcome, missionId: 'test', stats: { turnsTaken: opts.turnsTaken, finalResources } },
    gameover: { outcome: opts.outcome, reason: opts.reason, missionId: 'test' },
    finalState: blankState('test'),
    actionsApplied: opts.actionsApplied ?? 0,
    cardPlays: opts.cardPlays ?? {},
  };
}

const scenario: Scenario = { label: 's', deckCardIds: ['a', 'b', 'c'], board: 'tribe', missionId: 'test' };

describe('summarize', () => {
  it('computes win rate, turns stats, and mean actions', () => {
    const runs: ScenarioRuns = {
      scenario,
      policyName: 'test',
      outcomes: [
        outcome({ outcome: 'victory', turnsTaken: 4, actionsApplied: 10 }),
        outcome({ outcome: 'defeat', turnsTaken: 2, reason: 'famine', actionsApplied: 6 }),
        outcome({ outcome: 'defeat', turnsTaken: 8, reason: 'famine', actionsApplied: 20 }),
        outcome({ outcome: 'defeat', turnsTaken: 6, reason: 'ruin', actionsApplied: 12 }),
      ],
    };
    const s = summarize(runs);
    expect(s.runs).toBe(4);
    expect(s.wins).toBe(1);
    expect(s.winRate).toBe(0.25);
    expect(s.turns).toEqual({ min: 2, mean: 5, median: 5, max: 8 });
    expect(s.meanActions).toBe(12);
  });

  it('groups defeat causes off gameover.reason, keeping a deadline defeat separate from a famine', () => {
    const runs: ScenarioRuns = {
      scenario,
      policyName: 'test',
      outcomes: [
        outcome({ outcome: 'defeat', turnsTaken: 3, reason: 'famine' }),
        outcome({ outcome: 'defeat', turnsTaken: 3, reason: 'famine' }),
        // A deadline defeat leaves NO negative pool — only `gameover.reason` distinguishes it.
        outcome({ outcome: 'defeat', turnsTaken: 51, reason: 'the sands of time' }),
        // A victory contributes no defeat cause.
        outcome({ outcome: 'victory', turnsTaken: 5 }),
      ],
    };
    const s = summarize(runs);
    expect(s.defeatCauses).toEqual({ famine: 2, 'the sands of time': 1 });
  });

  it('sums card plays across runs and derives unplayed cards from the scenario deck', () => {
    const runs: ScenarioRuns = {
      scenario, // deck is ['a', 'b', 'c']
      policyName: 'test',
      outcomes: [
        outcome({ outcome: 'defeat', turnsTaken: 2, cardPlays: { a: 2, b: 1 } }),
        outcome({ outcome: 'defeat', turnsTaken: 2, cardPlays: { a: 3 } }),
      ],
    };
    const s = summarize(runs);
    expect(s.cardPlays).toEqual({ a: 5, b: 1 });
    // 'c' was never played → flagged dead; 'a'/'b' were played.
    expect(s.unplayedCards).toEqual(['c']);
  });

  it('averages final resources — core and strategic alike, in one bundle', () => {
    const runs: ScenarioRuns = {
      scenario,
      policyName: 'test',
      outcomes: [
        outcome({ outcome: 'defeat', turnsTaken: 1, finalResources: { food: 2, production: 4, money: 6, population: 2, territory: 1, culture: 0 } }),
        outcome({ outcome: 'defeat', turnsTaken: 1, finalResources: { food: 4, population: 4, territory: 3, culture: 2 } }),
      ],
    };
    const s = summarize(runs);
    expect(s.meanResources).toEqual({ food: 3, production: 2, science: 0, military: 0, money: 3, population: 3, territory: 2, culture: 1 });
  });
});

describe('runBatch', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  it('is reproducible — the same scenarios and seed count yield identical outcomes', () => {
    const scenarios: Scenario[] = [
      { label: 'fixture/unwinnable', deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable' },
    ];
    const a = runBatch(scenarios, { seeds: 3 });
    const b = runBatch(scenarios, { seeds: 3 });
    const results = (rs: typeof a) => rs[0].outcomes.map((o) => o.result);
    expect(results(a)).toEqual(results(b));
    // A defeat-only mission (`test_never` objective is `() => false`) — sanity that the sweep actually ran.
    expect(a[0].outcomes).toHaveLength(3);
    expect(a[0].outcomes.every((o) => o.result.outcome === 'defeat')).toBe(true);
  });
});

describe('simulateRun cardPlays instrumentation', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  // Pins the reference-inequality accepted-play detection against the *real* engine (the one core
  // change), without brittly tying to specific RNG draws — a drive-loop refactor that broke counting
  // would fail here even though the synthetic `summarize` tests inject `cardPlays` directly.
  it('counts only accepted plays of real deck cards, bounded by actions taken', () => {
    const config = simConfig({ deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: 'cfg-0' });
    const o = simulateRun(config, createRandomPolicy('pol-0'));

    const deck = new Set(FIXTURE_DECK);
    const total = Object.values(o.cardPlays).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0); // the policy plays cards during a run
    expect(total).toBeLessThanOrEqual(o.actionsApplied); // never more plays than actions dispatched
    for (const id of Object.keys(o.cardPlays)) expect(deck.has(id)).toBe(true); // only cards from the deck
  });
});
