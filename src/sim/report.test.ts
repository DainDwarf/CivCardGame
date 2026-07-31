import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { groupRecords, summarize } from './report';
import { runBatch, type Scenario } from './batch';
import { simConfig, simulateRun, createRandomPolicy, STALL_REASON, WIN_OUTCOME, type RunRecord } from './index';
import { emptyResources, type Resources } from '../rules/resources';
import { installFixtures, uninstallFixtures, TEST_BOARD_ID } from '../rules/testFixtures';

// A synthetic deck of freely-playable fixture cards — several zero-cost actions/work so a random policy
// reliably plays *some* card over a short run, and the whole run stays independent of the shipped catalogue.
const FIXTURE_DECK = ['test_work', 'test_bespoke', 'test_dynamic', 'test_growing', 'test_action', 'test_settlers'];

/** Build a `RunRecord` for the aggregation tests. `cardPlays` is written the way `toRunRecord` writes it
 *  — zero-filled over the whole deck — since that is what `summarize` reads unplayed cards off. */
function record(opts: {
  outcome: string;
  turns: number;
  cardPlays?: Record<string, number>;
  actions?: number;
  resources?: Partial<Resources>;
}): RunRecord {
  return {
    cell: 's',
    policy: 'test',
    seed: 0,
    outcome: opts.outcome,
    turns: opts.turns,
    actions: opts.actions ?? 0,
    resources: { ...emptyResources(), ...opts.resources },
    structures: 0,
    routes: 0,
    reshuffles: 0,
    cardPlays: { a: 0, b: 0, c: 0, ...opts.cardPlays },
  };
}

describe('summarize', () => {
  it('computes win rate, turns stats, and mean actions', () => {
    const s = summarize([
      record({ outcome: WIN_OUTCOME, turns: 4, actions: 10 }),
      record({ outcome: 'famine', turns: 2, actions: 6 }),
      record({ outcome: 'famine', turns: 8, actions: 20 }),
      record({ outcome: 'ruin', turns: 6, actions: 12 }),
    ]);
    expect(s.runs).toBe(4);
    expect(s.wins).toBe(1);
    expect(s.winRate).toBe(0.25);
    expect(s.turns).toEqual({ min: 2, mean: 5, median: 5, max: 8 });
    expect(s.meanActions).toBe(12);
  });

  it('groups defeat causes off the outcome, keeping a deadline defeat separate from a famine', () => {
    const s = summarize([
      record({ outcome: 'famine', turns: 3 }),
      record({ outcome: 'famine', turns: 3 }),
      // A deadline defeat leaves NO negative pool — only the recorded cause distinguishes it.
      record({ outcome: 'the deadline', turns: 51 }),
      // A victory contributes no defeat cause.
      record({ outcome: WIN_OUTCOME, turns: 5 }),
    ]);
    expect(s.defeatCauses).toEqual({ famine: 2, 'the deadline': 1 });
  });

  it('sums card plays across runs and reads unplayed cards off the zero-filled counts', () => {
    const s = summarize([
      record({ outcome: 'famine', turns: 2, cardPlays: { a: 2, b: 1 } }),
      record({ outcome: 'famine', turns: 2, cardPlays: { a: 3 } }),
    ]);
    expect(s.cardPlays).toEqual({ a: 5, b: 1 });
    // 'c' stayed at 0 in every run → flagged dead, and dropped from the play counts.
    expect(s.unplayedCards).toEqual(['c']);
  });

  it('averages final resources — core and strategic alike, in one bundle', () => {
    const s = summarize([
      record({ outcome: 'famine', turns: 1, resources: { food: 2, production: 4, money: 6, population: 2, territory: 1, culture: 0 } }),
      record({ outcome: 'famine', turns: 1, resources: { food: 4, population: 4, territory: 3, culture: 2 } }),
    ]);
    expect(s.meanResources).toEqual({ food: 3, production: 2, science: 0, military: 0, money: 3, population: 3, territory: 2, culture: 1 });
  });
});

describe('groupRecords', () => {
  it('splits a flat sweep into one group per cell and policy, in encounter order', () => {
    const at = (cell: string, policy: string): RunRecord => ({ ...record({ outcome: WIN_OUTCOME, turns: 1 }), cell, policy });
    const groups = groupRecords([at('x', 'greedy'), at('y', 'greedy'), at('x', 'planner'), at('x', 'greedy')]);
    expect(groups.map((g) => `${g[0].cell}/${g[0].policy} ×${g.length}`)).toEqual([
      'x/greedy ×2',
      'y/greedy ×1',
      'x/planner ×1',
    ]);
  });
});

describe('runBatch', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  const scenarios: Scenario[] = [
    { label: 'fixture/unwinnable', deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable' },
  ];

  it('is reproducible — the same scenarios and seed count yield identical records', () => {
    expect(runBatch(scenarios, { seeds: 3 })).toEqual(runBatch(scenarios, { seeds: 3 }));
    // A defeat-only mission (`test_never` objective is `() => false`) — sanity that the sweep actually ran.
    const records = runBatch(scenarios, { seeds: 3 });
    expect(records).toHaveLength(3);
    expect(records.every((r) => r.outcome !== WIN_OUTCOME)).toBe(true);
  });

  // What makes `--seed <i>` a filter over the sweep rather than a second code path: the run it selects
  // must be the *same* run, seed streams and all, that the full sweep would have produced at that index.
  it('reproduces a full sweep row exactly when only that seed index is run', () => {
    const full = runBatch(scenarios, { seeds: 3 });
    expect(runBatch(scenarios, { seeds: 3, seedIndices: [2] })).toEqual([full[2]]);
  });

  it('streams each record through onRun as it lands, in the order returned', () => {
    const streamed: RunRecord[] = [];
    const returned = runBatch(scenarios, { seeds: 3, onRun: (r) => streamed.push(r) });
    expect(streamed).toEqual(returned);
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

  // A policy that idles a driven run's rounds upward forever must be recorded as a `stall` defeat, not
  // throw — so one stuck seed costs one loss instead of aborting the whole sweep. `maxRounds: 0` trips the
  // cutoff on entry (the run is already at round 1 post-setup), pinning the mechanism deterministically
  // without depending on when a fixture would otherwise collapse.
  it('records a stall defeat (not a throw) when a run exceeds maxRounds', () => {
    const config = simConfig({ deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: 'cfg-0' });
    const o = simulateRun(config, createRandomPolicy('pol-0'), { maxRounds: 0 });
    expect(o.result.outcome).toBe('defeat');
    expect(o.gameover.reason).toBe(STALL_REASON);
    expect(o.result.stats.turnsTaken).toBe(o.finalState.round); // built through the real toRunResult
  });
});
