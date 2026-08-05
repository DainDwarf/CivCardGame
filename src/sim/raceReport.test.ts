import { describe, it, expect } from 'vitest';
import { emptyResources } from '../rules';
import { formatRaceValuation, raceCsvHeaderLine, raceCsvLines, type RaceValuationCell } from './raceReport';
import type { PlanClockExplain } from './race';

/** A hand-built explain, so the renderer is tested without an engine: what it must do with a derivation is
 *  independent of which derivation produced one. */
function plan(over: Partial<PlanClockExplain> = {}): PlanClockExplain {
  return {
    cardId: 'test_relic',
    copies: 3,
    workerRounds: 12,
    netted: { production: 4 },
    payment: 40,
    delivery: 2,
    held: 2,
    pool: 12,
    hand: 4,
    perRound: 0.667,
    recycles: false,
    // 38 rounds apart, which is past the ULP of the leader's 1 — the dawdle sub-case, printed as such.
    weights: [Math.exp(-38), 1],
    lands: 2,
    collect: 0,
    t: 2,
    ...over,
  };
}

function cell(): RaceValuationCell {
  return {
    label: 'test_cell',
    missionId: 'test_mission',
    missionName: 'Test Mission',
    objectiveCardId: 'test_goal',
    board: 'test_board',
    boardStickers: [],
    deckSize: 12,
    round: 1,
    resources: emptyResources(),
    model: {
      model: { unitCost: { production: 0.5 }, plans: [{}] },
      unpriceable: ['territory'],
      runCards: ['test_relic', 'test_trinket'],
      goals: [
        {
          icon: '⛏️',
          scanned: 4,
          inert: 2,
          plan: { landing: { cardId: 'test_relic', delta: 1, price: { production: 4 } } },
          candidates: [
            { cardId: 'test_relic', delta: 1, tau: 0, price: { production: 4 }, workerRounds: 2, perUnit: 2, unpriceable: [], landing: true, building: false },
            { cardId: 'test_trinket', delta: 1, tau: 0, price: { production: 6 }, workerRounds: 3, perUnit: 3, unpriceable: [], landing: false, building: false },
            { cardId: 'test_claim', delta: 2, tau: 0, price: {}, workerRounds: Infinity, perUnit: Infinity, unpriceable: ['territory'], landing: false, building: false },
          ],
        },
      ],
    },
    value: {
      breakdown: {
        goals: [{ icon: '⛏️', need: 3, tau: 0, t: 2, route: 'landing', cardId: 'test_relic' }],
        bottleneck: 0,
        tWin: 2,
        tLoss: 10,
        lossCause: 'food',
        margin: 8,
        nearDeath: 0,
        wealth: 0.01,
        victory: 0,
        total: 8.01,
      },
      horizon: 200,
      goals: [
        {
          clock: { icon: '⛏️', need: 3, tau: 0, t: 2, route: 'landing', cardId: 'test_relic' },
          raw: 2,
          clamped: false,
          workforce: 1,
          throughput: Infinity,
          plan: { landing: { cardId: 'test_relic', delta: 1, price: { production: 4 } } },
          landing: plan(),
        },
      ],
      foldWeights: [1],
      pools: [{ key: 'food', level: 10, drain: 1, t: 10 }],
      threats: [{ cardId: 'test_deadline', cap: 10, t: 4 }],
    },
  };
}

describe('formatRaceValuation', () => {
  it('renders the plan scan, the clocks and the split inside one', () => {
    const text = formatRaceValuation([cell()], 200);
    // The runner-up and the card that never got to rank both have to be readable, not just the winner.
    expect(text).toContain('test_trinket');
    expect(text).toContain('skipped: territory');
    // The payment/delivery split, and the census that makes a delivery clock checkable.
    expect(text).toMatch(/payment\s+40\.00 rd/);
    expect(text).toMatch(/2 held × 4\.0 hand \/ 12 pool/);
    expect(text).toContain('T̂loss 10.00 — food');
    expect(text).toContain('threat test_deadline');
  });

  it('names an absorbed clock rather than printing it as a small number', () => {
    // A weight under the ULP of 1 rounds to `0.000` at any sane precision, which reads as a live gradient
    // that happens to be small — the opposite of what it is.
    expect(formatRaceValuation([cell()], 200)).toContain('ABSORBED');
  });

  it('spells an unreachable clock and the pools that have no price', () => {
    const c = cell();
    c.value.goals[0].clock = { icon: '⛏️', need: 3, tau: 0, t: 200, route: 'none' };
    c.value.goals[0].raw = Infinity;
    c.value.goals[0].clamped = true;
    c.value.goals[0].landing = plan({ delivery: Infinity, weights: [], lands: Infinity, t: Infinity });
    const text = formatRaceValuation([c], 200);
    expect(text).toContain('HORIZON CLAMPED');
    expect(text).toContain('route none (copies short)');
    expect(text).toContain('no cost     territory');
    expect(text).toMatch(/delivery\s+∞ rd/);
  });
});

describe('raceCsvLines', () => {
  it('emits rectangular rows carrying the header\'s columns', () => {
    const width = raceCsvHeaderLine().split(',').length;
    const rows = raceCsvLines(cell());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.split(',').length).toBe(width);
  });

  it('marks a cell-level fact so a pivot on goal cannot duplicate it', () => {
    const rows = raceCsvLines(cell()).map((r) => r.split(','));
    const goals = (section: string) => new Set(rows.filter((r) => r[4] === section).map((r) => r[3]));
    expect(goals('unitCost')).toEqual(new Set(['-']));
    expect(goals('value')).toEqual(new Set(['-']));
    expect(goals('candidate')).toEqual(new Set(['0']));
  });

  it('carries absorption as a column, not as a float to compare in SQL', () => {
    const rows = raceCsvLines(cell()).map((r) => r.split(','));
    const row = rows.find((r) => r[4] === 'landing' && r[5] === 'absorbedPayment');
    expect(row?.[7]).toBe('1');
  });
});
