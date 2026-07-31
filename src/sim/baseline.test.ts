import { describe, it, expect } from 'vitest';
import { recordedRuns, withRecordedPolicy, type BaselineResultsFile } from './baseline';
import { WIN_OUTCOME, csvHeaderLine, recordToCsvLine, type RunRecord } from './record';

function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    cell: 'cell',
    policy: 'greedy',
    seed: 0,
    outcome: WIN_OUTCOME,
    turns: 12,
    actions: 40,
    resources: { food: 1, production: 2, science: 3, military: 4, money: 5, population: 6, culture: 7, territory: 8 },
    structures: 3,
    routes: 1,
    reshuffles: 2,
    cardPlays: { a: 4, b: 0 },
    ...over,
  };
}

/** A fixture whose config half is deliberately opaque to this module — the assertions below check it
 *  survives a merge byte-for-byte, so the shape only has to be *something* a fixture would carry. */
function fixture(over: Partial<BaselineResultsFile> = {}): BaselineResultsFile {
  return {
    id: 'cell',
    mission: 'test',
    board: 'tribe',
    deck: [{ cardId: 'a', count: 2 }],
    ...over,
  };
}

describe('recording a policy', () => {
  it('round-trips its runs back out unchanged', () => {
    const runs = [record({ seed: 0 }), record({ seed: 1, outcome: 'famine' })];
    const file = withRecordedPolicy(fixture(), 'greedy', runs, { maxRounds: 200 });
    expect(recordedRuns(file)).toEqual(runs);
  });

  // The committed file must be a function of the measurement alone, not of the order runs landed in.
  it('sorts rows by seed whatever order they arrived in', () => {
    const file = withRecordedPolicy(fixture(), 'greedy', [record({ seed: 2 }), record({ seed: 0 })], { maxRounds: 200 });
    expect(recordedRuns(file).map((r) => r.seed)).toEqual([0, 2]);
  });

  it('leaves the config half and the other policies untouched', () => {
    const base = withRecordedPolicy(fixture(), 'oracle', [record({ policy: 'oracle' })], { maxRounds: 200 });
    const merged = withRecordedPolicy(base, 'greedy', [record()], { maxRounds: 40 });
    expect(merged.mission).toBe(base.mission);
    expect(merged.board).toBe(base.board);
    expect(merged.deck).toEqual(base.deck);
    expect(merged.results!.oracle).toEqual(base.results!.oracle);
    expect(merged.results!.greedy.maxRounds).toBe(40);
  });
});

describe('reading a recorded fixture', () => {
  it('reads an unmeasured fixture as no runs rather than an error', () => {
    expect(recordedRuns(fixture())).toEqual([]);
  });

  it('rejects rows recorded against a different column set', () => {
    const file = withRecordedPolicy(fixture(), 'greedy', [record()], { maxRounds: 200 });
    file.results!.greedy.columns = 'cell,policy,seed';
    expect(() => recordedRuns(file)).toThrow(/different columns/);
  });

  // The column set is stored per policy precisely so a partial re-record cannot certify its sibling's
  // stale rows: one policy re-measured against a new header must not vouch for the one left behind.
  it('rejects only the stale policy when a sibling was re-recorded', () => {
    const stale = fixture({ results: { greedy: { maxRounds: 200, columns: 'cell,policy,seed', rows: ['cell,greedy,0'] } } });
    const merged = withRecordedPolicy(stale, 'planner', [record({ policy: 'planner' })], { maxRounds: 200 });
    expect(() => recordedRuns(merged)).toThrow(/policy 'greedy'/);
    expect(recordedRuns({ ...merged, results: { planner: merged.results!.planner } })).toHaveLength(1);
  });

  // The one bug this whole format exists to kill: a fixture re-cut under a new id leaves its old rows
  // parked in the file, and nothing but this check notices.
  it('rejects a row naming another cell', () => {
    const file = withRecordedPolicy(fixture(), 'greedy', [record({ cell: 'renamed' })], { maxRounds: 200 });
    expect(() => recordedRuns(file)).toThrow(/names cell 'renamed'/);
  });

  it('rejects a row filed under the wrong policy', () => {
    const file = fixture({ results: { planner: { maxRounds: 200, columns: csvHeaderLine(), rows: [recordToCsvLine(record())] } } });
    expect(() => recordedRuns(file)).toThrow(/names policy 'greedy'/);
  });
});
