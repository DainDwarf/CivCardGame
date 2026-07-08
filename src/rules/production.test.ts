import { describe, it, expect } from 'vitest';
import { dispatchEvent } from './events';
import { blankState } from './state';
import type { BuildingInstance } from './state';

// Production now runs through the `endTurn` broadcast (dispatchEvent → resolveEndTurn →
// resolveProduction per operating instance), not a standalone helper — so these drive the bus
// directly. With empty threats/workZone, an `endTurn` dispatch resolves exactly the tableau's
// staffed production.
let nextId = 1;
const b = (cardId: string, workers: number): BuildingInstance => ({ id: nextId++, cardId, workers });

describe('tableau production on the endTurn broadcast', () => {
  it('counts only staffed buildings', () => {
    const G = blankState('enlightenment');
    G.tableau = [b('farm', 1), b('farm', 0), b('workshop', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual({
      food: 2, // only the one staffed farm
      production: 2, // staffed workshop
      science: 0,
      military: 0,
      money: 0,
    });
  });

  it('self-sufficient walls produce military without workers', () => {
    const G = blankState('enlightenment');
    G.tableau = [b('walls', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 3, money: 0 });
  });

  it("a Reinforced building produces its base output +1, its plain sibling unaffected", () => {
    const G = blankState('enlightenment');
    const reinforced: BuildingInstance = { id: nextId++, cardId: 'farm', workers: 1, stickers: ['reinforced'] };
    G.tableau = [reinforced, b('farm', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(5); // reinforced farm's 3 + plain farm's 2
  });

  it('an Irrigation building produces +1 food through upkeep (Step 7.8)', () => {
    const G = blankState('enlightenment');
    const irrigated: BuildingInstance = { id: nextId++, cardId: 'farm', workers: 1, stickers: ['irrigation'] };
    G.tableau = [irrigated];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3); // farm's base 2 + Irrigation's +1, via the same fold as Reinforced
  });
});
