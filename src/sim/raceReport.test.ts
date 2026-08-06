import { describe, it, expect } from 'vitest';
import { emptyResources } from '../rules';
import { formatRaceValuation, raceCsvHeaderLine, raceCsvLines, type RaceValuationCell } from './raceReport';
import type { GoalPlan, PlanClockExplain } from './race';

/** A hand-built explain, so the renderer is tested without an engine: what it must do with a derivation is
 *  independent of which derivation produced one. */
function plan(over: Partial<PlanClockExplain> = {}): PlanClockExplain {
  return {
    cardId: 'test_relic',
    copies: 3,
    price: { production: 4 },
    workerRounds: 12,
    netted: { production: 4 },
    realized: 0,
    payment: 40,
    delivery: 2,
    held: 2,
    pool: 12,
    hand: 4,
    perRound: 0.667,
    recycles: false,
    // Under the ULP of the leader's 1, so the renderer has to say so rather than print a small float. The
    // shipped softening floors a real weight far above this; what is pinned is the annotation, not its reach.
    weights: [Math.exp(-38), 1],
    lands: 2,
    collect: 0,
    t: 2,
    ...over,
  };
}

/** The goal's plan set: two routes the leaf chooses between, and the causes the root scan dropped the rest
 *  for — the shape a renderer has to read as a set rather than as a winner. */
const KEPT: GoalPlan = {
  landings: [
    { cardId: 'test_relic', delta: 1 },
    { cardId: 'test_trinket', delta: 1 },
  ],
  buildings: [],
  dropped: ['copies short', 'unpriceable pool'],
};

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
      model: { unitCost: { production: 0.5 }, plans: [KEPT] },
      workforce: 1,
      unpriceable: ['territory'],
      runCards: ['test_relic', 'test_trinket'],
      goals: [
        {
          icon: '⛏️',
          scanned: 4,
          inert: 2,
          plan: KEPT,
          candidates: [
            { cardId: 'test_relic', delta: 1, tau: 0, price: { production: 4 }, workerRounds: 2, perUnit: 2, unpriceable: [], landing: { kept: true, t: 2, payment: 40, delivery: 2, reject: '' } },
            { cardId: 'test_trinket', delta: 1, tau: 0, price: { production: 6 }, workerRounds: 3, perUnit: 3, unpriceable: [], landing: { kept: true, t: 9, payment: 60, delivery: 9, reject: '' } },
            { cardId: 'test_hoard', delta: 1, tau: 0, price: { production: 2 }, workerRounds: 1, perUnit: 1, unpriceable: [], landing: { kept: false, t: Infinity, payment: 20, delivery: Infinity, reject: 'copies short' } },
            { cardId: 'test_claim', delta: 2, tau: 0, price: {}, workerRounds: Infinity, perUnit: Infinity, unpriceable: ['territory'], landing: { kept: false, t: Infinity, reject: 'unpriceable pool' } },
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
          plan: KEPT,
          landings: [
            plan(),
            plan({ cardId: 'test_trinket', price: { production: 6 }, payment: 60, delivery: 9, lands: 9, t: 9 }),
          ],
          buildings: [],
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
    // Every route weighed has to be readable — the ones kept, the one dropped, and the card never priced.
    expect(text).toContain('test_trinket');
    expect(text).toContain('skipped: territory');
    // Every kept route is costed at the leaf, and which of them the clock took has to be sayable.
    expect(text).toContain('kept 2 landing, 0 building');
    expect(text).toContain('landing ✗ copies short');
    // The price is the leaf's own reading, beside the root's in the scan table above it.
    expect(text).toMatch(/landing\s+test_relic × 3\.00 · price production 4\.0\s+← taken/);
    expect(text).toMatch(/landing\s+test_trinket × 3\.00 · price production 6\.0(?!.*taken)/);
    // The payment/delivery split, and the census that makes a delivery clock checkable.
    expect(text).toMatch(/payment\s+40\.00 rd\s+12\.00 wr outstanding at 0\.00 wr\/rd standing income/);
    expect(text).toMatch(/2 held × 4\.0 hand \/ 12 pool/);
    expect(text).toContain('T̂loss 10.00 — food');
    expect(text).toContain('threat test_deadline');
  });

  it('says why a citizenless root shows every route kept at an infinite clock', () => {
    // The one state where `kept` and the clock disagree on purpose: a route is kept on its price and its
    // copies, and the workforce that divides the clock is the leaf's business — so the table would read as
    // keeping the unreachable with nothing to say otherwise.
    const c = cell();
    c.model.workforce = 0;
    expect(formatRaceValuation([c], 200)).toContain('root workforce 0');
    expect(formatRaceValuation([cell()], 200)).not.toContain('root workforce 0');
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
    c.value.goals[0].landings = [plan({ delivery: Infinity, weights: [], lands: Infinity, t: Infinity })];
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
