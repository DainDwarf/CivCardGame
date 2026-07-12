import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dispatchEvent } from './events';
import { blankState } from './state';
import type { BuildingInstance } from './state';
import { installFixtures, uninstallFixtures } from './testFixtures';

// Production now runs through the `endTurn` broadcast (dispatchEvent → resolveEndTurn →
// resolveProduction per operating instance), not a standalone helper — so these drive the bus
// directly. With empty threats/workZone, an `endTurn` dispatch resolves exactly the tableau's
// staffed production. `test_food` produces +2🌾 (w1), `test_prod` +2🔨 (w1), `test_selfstaffed`
// +3⚔️ (w0); `test_addgain` is a +1-per-key output sticker, `test_restricted` a food-only +1🌾 one.
let nextId = 1;
const b = (cardId: string, workers: number): BuildingInstance => ({ id: nextId++, cardId, workers });

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('tableau production on the endTurn broadcast', () => {
  it('counts only staffed buildings', () => {
    const G = blankState('test');
    const expected = { ...G.resources, food: 2, production: 2 }; // one staffed food + one staffed prod
    G.tableau = [b('test_food', 1), b('test_food', 0), b('test_prod', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual(expected);
  });

  it('a self-sufficient building produces without workers', () => {
    const G = blankState('test');
    const expected = { ...G.resources, military: 3 };
    G.tableau = [b('test_selfstaffed', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual(expected);
  });

  it("a building's placement effect does NOT re-fire per round (Hut population is one-shot)", () => {
    // Hut is `workers: 0` (always operating) with `effect: { resources: { population: 1 } }` and no
    // `produces`. Production reads `produces` alone — `defaultProduce` never consults `effect` — so
    // the population grant stays a one-time placement effect and never ticks each round. This is the
    // produces/effect separation the fallback removal made safe by construction (no `effect` leak).
    const G = blankState('test');
    const before = structuredClone(G.resources);
    G.tableau = [b('hut', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual(before);
  });

  it('an additive-gain building produces its base output +1, its plain sibling unaffected', () => {
    const G = blankState('test');
    const boosted: BuildingInstance = { id: nextId++, cardId: 'test_food', workers: 1, stickers: ['test_addgain'] };
    G.tableau = [boosted, b('test_food', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(5); // boosted food building's 3 + plain one's 2
  });

  it('a restricted (food-only) sticker produces +1 food through upkeep', () => {
    const G = blankState('test');
    const irrigated: BuildingInstance = { id: nextId++, cardId: 'test_food', workers: 1, stickers: ['test_restricted'] };
    G.tableau = [irrigated];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3); // base 2 + restricted sticker's +1, via the same fold as additive-gain
  });

  it('a staffed wonder produces its cultureOutput exactly like a building; an unstaffed one does not', () => {
    const G = blankState('test');
    G.tableau = [b('test_wonder', 1), b('test_wonder', 0)]; // test_wonder → +2🎭 while staffed
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.culture).toBe(2); // only the staffed wonder produced
  });
});

describe('per-worker production scaling', () => {
  // `test_multiworker` is a 3-capacity building; its produces {production:1, money:1} + cultureOutput:1
  // are per-worker unit values scaled by the staffed count.
  it('scales its unit output by the number of staffed workers', () => {
    for (const [workers, expected] of [[1, 1], [2, 2], [3, 3]] as const) {
      const G = blankState('test');
      G.tableau = [b('test_multiworker', workers)];
      dispatchEvent(G, { type: 'endTurn' });
      expect(G.resources.production).toBe(expected);
      expect(G.resources.money).toBe(expected);
      expect(G.resources.culture).toBe(expected);
    }
  });

  it('produces nothing while unstaffed', () => {
    const G = blankState('test');
    G.tableau = [b('test_multiworker', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(0);
    expect(G.resources.money).toBe(0);
    expect(G.resources.culture).toBe(0);
  });

  it('a single-worker producer still yields its flat unit output (×1 regression)', () => {
    const G = blankState('test');
    G.tableau = [b('test_food', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(2); // test_food produces {food: 2}, unscaled at capacity 1
  });
});
