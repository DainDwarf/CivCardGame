import { describe, it, expect } from 'vitest';
import {
  WIN_OUTCOME,
  csvHeaderLine,
  manifestLines,
  parseRecordCsv,
  recordToCsvLine,
  sweepLine,
  toRunRecord,
  type RunRecord,
} from './record';
import type { Scenario } from './batch';
import type { SimOutcome } from './simulate';
import { MISSIONS } from '../content/missions';
import { blankState } from '../rules';
import { emptyResources, type Resources } from '../rules/resources';

const scenario: Scenario = { label: 's', deckCardIds: ['a', 'b'], board: 'tribe', missionId: 'test' };

/** A `SimOutcome` carrying only what `toRunRecord` reads. `finalState` comes from the real `blankState`
 *  rather than a cast, so the board-zone reads are against a genuine `GameState`. */
function outcome(opts: {
  outcome: 'victory' | 'defeat';
  reason?: string;
  turnsTaken?: number;
  cardPlays?: Record<string, number>;
  finalResources?: Partial<Resources>;
}): SimOutcome {
  const finalResources = { ...emptyResources(), ...opts.finalResources };
  return {
    result: { outcome: opts.outcome, missionId: 'test', stats: { turnsTaken: opts.turnsTaken ?? 1, finalResources } },
    gameover: { outcome: opts.outcome, reason: opts.reason, missionId: 'test' },
    finalState: blankState('test'),
    actionsApplied: 7,
    cardPlays: opts.cardPlays ?? {},
  };
}

function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    cell: 's',
    policy: 'greedy',
    seed: 3,
    outcome: WIN_OUTCOME,
    turns: 12,
    actions: 40,
    resources: { food: -2, production: 4, science: 0, military: 3, money: 11, population: 5, culture: 2, territory: 6 },
    structures: 3,
    routes: 1,
    reshuffles: 2,
    cardPlays: { a: 4, b: 0 },
    ...over,
  };
}

/** Round-trip one record through the CSV and back — a file's rows must mean exactly what the sweep
 *  measured, or a re-read analysis silently disagrees with a live one. */
function roundTrip(r: RunRecord): RunRecord {
  const { records } = parseRecordCsv([csvHeaderLine(), recordToCsvLine(r)].join('\n'));
  expect(records).toHaveLength(1);
  return records[0];
}

describe('the CSV round-trip', () => {
  it('preserves a record whole, negative pools included', () => {
    const r = record();
    expect(roundTrip(r)).toEqual(r);
  });

  it('preserves a defeat cause carrying the search bound its colon separates', () => {
    const r = record({ outcome: 'noWinFound:deadEnd' });
    expect(roundTrip(r).outcome).toBe('noWinFound:deadEnd');
  });

  // A defeat cause is authored free text (a threat names its own), so one containing the delimiter must
  // not shift every column after it.
  it('quotes a defeat cause containing a comma rather than splitting the row on it', () => {
    const r = record({ outcome: 'the pharaoh died, and his tomb stood empty' });
    expect(recordToCsvLine(r)).toContain('"the pharaoh died, and his tomb stood empty"');
    expect(roundTrip(r)).toEqual(r);
  });

  it('rejects a file whose columns are not the ones it claims', () => {
    expect(() => parseRecordCsv('cell,policy\nx,greedy')).toThrow(/no CSV header row found/);
  });

  // `npm run sim > sweep.csv` puts npm's own `> package@version script` preamble on stdout ahead of the
  // rows; a sweep file that then fails to load would be a trap rather than a diagnostic.
  it('reads past a preamble ahead of the header row', () => {
    const text = ['> civcardgame@0.0.4 sim', '> node scripts/.bundle/sim.mjs --seeds 1', '', csvHeaderLine(), recordToCsvLine(record())].join('\n');
    expect(parseRecordCsv(text).records).toEqual([record()]);
  });
});

describe('the zero-filled card counts', () => {
  it('carries a deck card that was never played, so unplayed is a per-run fact', () => {
    const r = toRunRecord(scenario, 'greedy', 0, outcome({ outcome: 'victory', cardPlays: { a: 2 } }));
    expect(r.cardPlays).toEqual({ a: 2, b: 0 });
  });

  it('carries a card played but absent from the deck', () => {
    const r = toRunRecord(scenario, 'greedy', 0, outcome({ outcome: 'defeat', reason: 'famine', cardPlays: { minted: 1 } }));
    expect(r.cardPlays).toEqual({ a: 0, b: 0, minted: 1 });
  });

  // `alsoDisplay` names what a run can only *mint* mid-play — no deck or seed list can. Including it is
  // what keeps the key set identical across every row of a cell, so the packed column stays rectangular
  // whether or not a given run ever bred one. Read off the real mission, so a re-pointed catalogue
  // re-targets the assertion instead of breaking it.
  it('carries a mission\'s mid-play injections and its seeded events, even when neither came up', () => {
    const accounting = MISSIONS.accounting;
    const injected = [...(accounting.events ?? []), ...(accounting.alsoDisplay ?? [])];
    expect(injected.length).toBeGreaterThan(0);

    const cell: Scenario = { label: 'acc', deckCardIds: ['a'], board: 'tribe', missionId: accounting.id };
    const r = toRunRecord(cell, 'greedy', 0, outcome({ outcome: 'defeat', reason: 'famine' }));
    for (const id of injected) expect(r.cardPlays[id]).toBe(0);
  });

  // Threats and the objective never route through `playCard`, so a permanently-zero column for each
  // would be noise in every row of every sweep.
  it('leaves out the cards no run can play — the threats and the objective', () => {
    const accounting = MISSIONS.accounting;
    const cell: Scenario = { label: 'acc', deckCardIds: ['a'], board: 'tribe', missionId: accounting.id };
    const r = toRunRecord(cell, 'greedy', 0, outcome({ outcome: 'defeat', reason: 'famine' }));
    for (const id of accounting.threats ?? []) expect(r.cardPlays).not.toHaveProperty(id);
    expect(r.cardPlays).not.toHaveProperty(accounting.objectiveCardId);
  });
});

describe('the manifest header', () => {
  it('regroups the expanded deck back into counted entries, per-copy stickers kept apart', () => {
    const cell: Scenario = {
      label: 'm',
      deckCardIds: ['a', 'a', { cardId: 'a', stickers: ['irrigation'] }, { cardId: 'b' }],
      board: 'city',
      missionId: 'test',
      boardStickers: ['stockpile'],
    };
    const [line] = manifestLines([cell]);
    expect(line.startsWith('#')).toBe(true);
    expect(JSON.parse(line.slice(line.indexOf(' ') + 1))).toEqual({
      cell: 'm',
      mission: 'test',
      board: 'city',
      boardStickers: ['stockpile'],
      deck: [
        { cardId: 'a', count: 2 },
        { cardId: 'a', count: 1, stickers: ['irrigation'] },
        { cardId: 'b', count: 1 },
      ],
    });
  });

  it('rides above the rows and is read back beside them', () => {
    const cell: Scenario = { label: 's', deckCardIds: ['a', 'b'], board: 'tribe', missionId: 'test' };
    const text = [...manifestLines([cell]), csvHeaderLine(), recordToCsvLine(record())].join('\n');
    const { records, manifest } = parseRecordCsv(text);
    expect(manifest).toEqual([{ cell: 's', mission: 'test', board: 'tribe', boardStickers: [], deck: [{ cardId: 'a', count: 1 }, { cardId: 'b', count: 1 }] }]);
    expect(records).toHaveLength(1);
  });

  // Metadata lines the writer may grow must not break a reader that predates them.
  it('skips a comment line it does not recognize', () => {
    const text = ['#future {"x":1}', '# a bare note', csvHeaderLine(), recordToCsvLine(record())].join('\n');
    expect(parseRecordCsv(text).records).toHaveLength(1);
  });
});

describe('the sweep header', () => {
  it('reads back the flags the sweep ran under', () => {
    const header = { seeds: 100, policies: ['greedy', 'planner'], maxRounds: 200, beamWidth: 64 };
    const text = [sweepLine(header), csvHeaderLine(), recordToCsvLine(record())].join('\n');
    expect(parseRecordCsv(text).sweep).toEqual(header);
  });

  // A `--seed <i>` replay is one row on the streams the full sweep would have given it — readable as a
  // sweep, but a filtered one, which is what tells a consumer it measured nothing.
  it('carries the seed filter that narrowed the sweep', () => {
    const header = { seeds: 100, policies: ['planner'], seedIndices: [3], maxRounds: 200, beamWidth: 64 };
    const text = [sweepLine(header), csvHeaderLine(), recordToCsvLine(record())].join('\n');
    expect(parseRecordCsv(text).sweep?.seedIndices).toEqual([3]);
  });

  it('is absent from a file that carries no header line', () => {
    expect(parseRecordCsv([csvHeaderLine(), recordToCsvLine(record())].join('\n')).sweep).toBeUndefined();
  });
});
