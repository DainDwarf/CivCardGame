import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gainResources, resolveCard, resolveProduction, runEffect } from './effects';
import { blankState } from './state';
import { FIXTURE_CARDS, installCards, installFixtures, uninstallCards, uninstallFixtures } from './testFixtures';
import { CARDS, type CardDef } from '../content/cards';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('runEffect', () => {
  it('applies the resource delta (core + strategic) through gainResources', () => {
    const G = blankState('test');
    runEffect({ G, self: { id: 1, cardId: 'x' } }, { resources: { science: 2, culture: 1 } });
    expect(G.resources.science).toBe(2);
    expect(G.resources.culture).toBe(1);
  });

  it('composes the declarative fields with a bespoke `resolve` (both apply, resources first)', () => {
    const G = blankState('test');
    runEffect(
      { G, self: { id: 1, cardId: 'x' } },
      { resources: { science: 9 }, resolve: (ctx) => gainResources(ctx, { food: 2 }) },
    );
    expect(G.resources.food).toBe(2); // the closure's gain
    expect(G.resources.science).toBe(9); // the declarative delta applies too
  });

  it('does nothing for an undefined effect', () => {
    const G = blankState('test');
    const before = structuredClone(G.resources);
    runEffect({ G, self: { id: 1, cardId: 'x' } }, undefined);
    expect(G.resources).toEqual(before);
  });
});

// The 2.1 deletions carried the only coverage of resolveCard dispatching through a card's own logic.
// Re-asserted here on synthetic fixtures (values chosen freely): a declarative-default card, a
// declarative card + output sticker, a bespoke `resolve` that must still see the sticker, and a
// `dynamicText` card whose face must agree with what its resolver grants.
describe('resolveCard', () => {
  it('runs the declarative default for a catalogue card (test_festival → +3 culture)', () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_festival' } });
    expect(G.resources.culture).toBe(3);
  });

  it("an additive-gain sticker bumps a declarative card's gain by 1", () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_action', stickers: ['test_addgain'] } });
    expect(G.resources.science).toBe(4); // test_action's base +3, sticker +1
  });

  it("a bespoke resolver sees an output sticker's bonus (the gap a self-scaling resolver closes)", () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_bespoke', stickers: ['test_addgain'] } });
    expect(G.resources.science).toBe(3); // test_bespoke's base +2, sticker +1
  });

  it("a dynamicText card's face shows the sticker-adjusted gain (resolve/display agree)", () => {
    const G = blankState('test');
    const self = { id: 1, cardId: 'test_dynamic', stickers: ['test_addgain'] };
    const text = FIXTURE_CARDS.test_dynamic.display!.dynamicText!(G, self);
    expect(text).toBe('+3🌾'); // base +2, sticker +1 — matches the +3 food resolveCard grants
    resolveCard({ G, self });
    expect(G.resources.food).toBe(3);
  });
});

describe('gainResources', () => {
  it('folds output stickers over the base bag', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x', stickers: ['test_addgain'] } }, { science: 2 });
    expect(G.resources.science).toBe(3); // +2 base, sticker +1
  });

  it('applies an unstickered bag unchanged', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, { food: 2 });
    expect(G.resources.food).toBe(2);
  });

  it('applies a negative delta (a drain), letting a pool go negative', () => {
    const G = blankState('test');
    G.resources.military = 3;
    gainResources({ G, self: { id: 1, cardId: 'x' } }, { military: -4 });
    expect(G.resources.military).toBe(-1);
  });

  it('applies the strategic keys (population/territory/culture) to G.resources too', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, { population: 1, territory: 1, culture: 3 });
    expect(G.resources.population).toBe(1);
    expect(G.resources.territory).toBe(7); // blankState seeds territory at 6
    expect(G.resources.culture).toBe(3);
  });

  it('is a no-op on an undefined bag', () => {
    const G = blankState('test');
    const before = structuredClone(G.resources);
    gainResources({ G, self: { id: 1, cardId: 'x' } }, undefined);
    expect(G.resources).toEqual(before);
  });
});

describe('resolveProduction', () => {
  it("an additive-gain sticker bumps a building's per-round produces by 1 per resource", () => {
    const G = blankState('test');
    resolveProduction({ G, self: { id: 1, cardId: 'test_food', stickers: ['test_addgain'] } });
    expect(G.resources.food).toBe(3); // test_food's base +2, sticker +1
  });

  it('leaves an unstickered building at its base output', () => {
    const G = blankState('test');
    resolveProduction({ G, self: { id: 1, cardId: 'test_food' } });
    expect(G.resources.food).toBe(2);
  });

  // Production reads `produces` alone — never `effect`. `test_action` carries `effect.resources`
  // (+3🔬) and no `produces`; under the old `produces ?? effect.resources` fallback this would have
  // leaked +3 science per round. Now it must produce nothing: the two timing slots are separate.
  it('ignores a card\'s `effect` — production is `produces`-only (no fallback)', () => {
    const G = blankState('test');
    resolveProduction({ G, self: { id: 1, cardId: 'test_action' } });
    expect(G.resources.science).toBe(0);
  });

  // The Hut is a `produces`-less building whose `effect` grants +1🧍 *on placement*. As an operating
  // (self-sufficient) staffable it runs at upkeep, but must never re-grant that population each round.
  it('never re-fires a placement `effect` at upkeep (Hut grants no per-round population)', () => {
    const G = blankState('test');
    const before = G.resources.population;
    resolveProduction({ G, self: { id: 1, cardId: 'hut' } });
    expect(G.resources.population).toBe(before);
  });

  // A `produces` carrying BOTH a declarative bag and a `resolve`: the scaled declarative gain applies
  // *and* the closure runs (composing like `runEffect`), each on its own scaling.
  it('composes a bespoke `produces.resolve` with the per-worker-scaled declarative produces', () => {
    const local: Record<string, CardDef> = {
      test_prod_compose: {
        id: 'test_prod_compose', name: 'Prod Compose', kind: 'building' as const,
        cost: {}, workers: 2,
        produces: { resources: { food: 1 }, resolve: (ctx) => gainResources(ctx, { science: 3 }) },
      },
    };
    installCards(local);
    try {
      const G = blankState('test');
      G.tableau = [{ id: 1, cardId: 'test_prod_compose', workers: 2 }];
      resolveProduction({ G, self: { id: 1, cardId: 'test_prod_compose' } });
      expect(G.resources.food).toBe(2); // declarative +1🌾/worker × 2 workers
      expect(G.resources.science).toBe(3); // the closure's flat gain composes on top
    } finally {
      uninstallCards(local);
    }
  });
});

// Content coherence: the `work` kind's whole output is per-round, so it lives entirely in
// `produces` — a work card must not carry a one-shot `effect` (it would be dead, since
// `playCard` resolves no effect for a work card, and it would blur the produces/effect separation).
describe('work-card content', () => {
  it('no work card carries an `effect`', () => {
    const offenders = Object.values(CARDS)
      .filter((c) => c.kind === 'work' && c.effect)
      .map((c) => c.id);
    expect(offenders).toEqual([]);
  });
});
