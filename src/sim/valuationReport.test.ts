import { describe, it, expect } from 'vitest';
import { emptyResources } from '../rules';
import { formatValuation, valuationCsvHeaderLine, valuationCsvLines, type ValuationCell } from './valuationReport';
import type { EnablerExplain } from './enablers';

/** A hand-built explain, so the renderer is tested without an engine: what it must do with a derivation is
 *  independent of which derivation produced one. */
function explain(over: Partial<EnablerExplain> = {}): EnablerExplain {
  return {
    terms: { cardCosts: true, conversions: true, capacity: true, floor: true, handSize: true, producers: true },
    model: { weight: {}, cap: {}, producerCredit: {} },
    goalValued: {},
    cardCosts: {},
    capacity: {
      territory: { throughput: 0, derived: 0, floorApplied: false, goalValued: false, weight: 0 },
      population: { throughput: 0, derived: 0, floorApplied: false, goalValued: false, weight: 0 },
      culture: { throughput: 0, derived: 0, floorApplied: false, goalValued: false, weight: 0 },
    },
    conversions: {},
    valued: {},
    foodPerWorker: { value: 0 },
    canGrowCulture: false,
    runCards: [],
    ...over,
  };
}

function cell(): ValuationCell {
  return {
    label: 'test_cell',
    missionId: 'test_mission',
    missionName: 'Test Mission',
    objectiveCardId: 'test_goal',
    board: 'test_board',
    boardStickers: [],
    deckSize: 4,
    rootProgress: 0.25,
    score: { collapseCliff: 0, buffer: -50, objective: 75, operating: 4, accumulate: 6, victory: 0, total: 35 },
    permanent: emptyResources(),
    resources: emptyResources(),
    projected: emptyResources(),
    models: [
      {
        name: 'lean',
        rootPotential: 12,
        explain: explain({
          model: { weight: { production: 5 }, cap: { production: 4 }, producerCredit: { test_forge: 9 } },
          cardCosts: { production: { marginal: 0.05, costAmt: 4, cardId: 'test_goal_card' } },
        }),
      },
      {
        name: 'rich',
        rootPotential: 30,
        explain: explain({
          model: { weight: { production: 5, population: 3 }, cap: { production: 4, population: 12 }, producerCredit: {} },
          capacity: {
            territory: { throughput: 0, derived: 0, floorApplied: false, goalValued: false, weight: 0 },
            population: { throughput: 0, derived: 0, floorApplied: true, goalValued: false, weight: 3 },
            culture: { throughput: 0, derived: 0, floorApplied: false, goalValued: false, weight: 0 },
          },
        }),
      },
    ],
  };
}

describe('formatValuation', () => {
  it('renders a column per term set, and each credit against the goal-step scale', () => {
    const text = formatValuation([cell()]);
    for (const name of ['lean', 'rich']) expect(text).toContain(name);
    // The scale preamble is what makes a raw score point readable at all.
    expect(text).toContain('OBJECTIVE_WEIGHT 300');
    expect(text).toMatch(/enablerPotential @root.*0\.040 gs.*0\.100 gs/);
    // A weight names the pass that set it, never a bare number.
    expect(text).toContain('cardCost:test_goal_card');
    expect(text).toContain('(floor)');
  });

  it('shows a producer credit total against its cap', () => {
    const c = cell();
    c.models[0].explain.model.producerCredit = { a: 10, b: 12 };
    expect(formatValuation([c])).toContain('22.0 -> capped 15.0');
  });
});

describe('valuationCsvLines', () => {
  it('emits rectangular rows carrying the header\'s columns', () => {
    const width = valuationCsvHeaderLine().split(',').length;
    const rows = valuationCsvLines(cell());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.split(',').length).toBe(width);
  });

  it('marks a term-independent fact so a pivot cannot duplicate it', () => {
    const rows = valuationCsvLines(cell()).map((r) => r.split(','));
    const terms = (section: string) => rows.filter((r) => r[4] === section).map((r) => r[3]);
    // The bands and the probes carry no shaping, so they are recorded once under `-` rather than per column.
    expect(new Set(terms('band'))).toEqual(new Set(['-']));
    expect(new Set(terms('cardCost'))).toEqual(new Set(['-']));
    // A weight is per term set, and both columns appear.
    expect(new Set(terms('weight'))).toEqual(new Set(['lean', 'rich']));
  });
});
