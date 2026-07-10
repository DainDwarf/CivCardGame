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
    G.tableau = [b('test_food', 1), b('test_food', 0), b('test_prod', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual({
      food: 2, // only the one staffed food building
      production: 2, // staffed production building
      science: 0,
      military: 0,
      money: 0,
    });
  });

  it('a self-sufficient building produces without workers', () => {
    const G = blankState('test');
    G.tableau = [b('test_selfstaffed', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 3, money: 0 });
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
});
