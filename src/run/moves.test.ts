import { describe, it, expect } from 'vitest';
import { playCard } from './moves';
import { blankState, type GameState } from '../rules';

/** Invoke the move directly with a minimal context (it only reads `G`). */
function play(G: GameState, cardId: string, discardCardIds: string[] = [], destroyBuildingId?: string) {
  const idx = G.hand.indexOf(cardId);
  if (idx === -1) throw new Error(`play: '${cardId}' not in hand`);
  const discardIdxs = discardCardIds.map((d) => {
    const i = G.hand.indexOf(d);
    if (i === -1) throw new Error(`play: discard '${d}' not in hand`);
    return i;
  });
  playCard(G, idx, discardIdxs, destroyBuildingId);
}

describe('playCard: cards vs. buildings', () => {
  it('a permanent card erects a building and is removed from the deck (not discarded)', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2; // idle -> the farm auto-staffs
    play(G, 'farm');
    expect(G.tableau).toEqual([{ buildingId: 'farm', workers: 1 }]);
    expect(G.removed).toEqual(['farm']); // the card itself leaves the deck for good
    expect(G.discard).toEqual([]);
    expect(G.hand).toEqual([]);
  });

  it('Village Settlement is a recurring card that builds a Farm — the building stays, the card recycles', () => {
    const G = blankState('enlightenment');
    G.hand = ['village_settlement'];
    G.resources.food = 10;
    G.population = 3; // 3 idle: 2 spent on the settlement, 1 left to staff the farm
    play(G, 'village_settlement');
    expect(G.resources.food).toBe(0); // paid 10 food
    expect(G.population).toBe(1); // paid 2 population
    expect(G.tableau).toEqual([{ buildingId: 'farm', workers: 1 }]); // built + staffed from the remaining idle
    expect(G.discard).toEqual(['village_settlement']); // recurring -> recycles, NOT removed
    expect(G.removed).toEqual([]);
  });

  it('rejects a building when the tableau is at its territory cap', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ buildingId: 'workshop', workers: 1 }]; // sole slot already taken
    play(G, 'farm');
    expect(G.tableau).toHaveLength(1); // farm not built
    expect(G.hand).toEqual(['farm']); // card stays in hand, nothing paid
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes a building from the tableau and frees its territory slot', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [
      { buildingId: 'farm', workers: 1 },
      { buildingId: 'workshop', workers: 1 },
    ];
    G.population = 2;
    play(G, 'destroy', [], 'farm');
    expect(G.tableau).toEqual([{ buildingId: 'workshop', workers: 1 }]);
    expect(G.resources.production).toBe(4); // paid 1 production
    expect(G.discard).toEqual(['destroy']); // recurring → recycles
  });

  it('destroy frees assigned workers back to the idle pool', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.population = 2;
    G.tableau = [{ buildingId: 'farm', workers: 1 }];
    play(G, 'destroy', [], 'farm');
    expect(G.tableau).toEqual([]);
    // The removed worker is now idle (freePopulation = population - assignedWorkers)
    // Population is still 2, no workers assigned => 2 idle.
    expect(G.population).toBe(2);
  });

  it('destroy is rejected without a target building id', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [{ buildingId: 'farm', workers: 1 }];
    play(G, 'destroy'); // no destroyBuildingId
    expect(G.tableau).toHaveLength(1); // nothing removed
    expect(G.resources.production).toBe(5); // nothing paid
  });

  it('destroy is rejected when the target building is not in the tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [{ buildingId: 'farm', workers: 1 }];
    play(G, 'destroy', [], 'workshop'); // workshop not in tableau
    expect(G.tableau).toHaveLength(1);
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes an unstaffed instance before a staffed one of the same type', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.population = 1;
    G.tableau = [
      { buildingId: 'farm', workers: 1 }, // staffed
      { buildingId: 'farm', workers: 0 }, // empty
    ];
    play(G, 'destroy', [], 'farm');
    expect(G.tableau).toEqual([{ buildingId: 'farm', workers: 1 }]); // empty instance removed
  });

  it('destroy enables a building card to be played after demolishing a full tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy', 'granary'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ buildingId: 'farm', workers: 1 }]; // tableau at cap
    play(G, 'destroy', [], 'farm');
    expect(G.tableau).toHaveLength(0);
    expect(G.territory).toBe(1); // territory cap unchanged — just freed a slot
    play(G, 'granary'); // now a slot is free
    expect(G.tableau.some((b) => b.buildingId === 'granary')).toBe(true);
  });

  it('a territory card opens a slot so the next building can be played', () => {
    const G = blankState('enlightenment');
    G.hand = ['develop', 'farm'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ buildingId: 'workshop', workers: 1 }]; // full at territory 1
    play(G, 'develop'); // +1 territory (cost 3 production) -> room for one more
    expect(G.territory).toBe(2);
    expect(G.discard).toEqual(['develop']); // recurring -> recycles
    play(G, 'farm'); // now fits
    expect(G.tableau).toHaveLength(2);
    expect(G.tableau.some((b) => b.buildingId === 'farm')).toBe(true);
  });

  it('rejects a population cost the idle pool cannot cover', () => {
    const G = blankState('enlightenment');
    G.hand = ['village_settlement'];
    G.resources.food = 10;
    G.population = 1; // only 1 idle, needs 2
    play(G, 'village_settlement');
    expect(G.tableau).toEqual([]); // nothing happened
    expect(G.resources.food).toBe(10);
    expect(G.population).toBe(1);
    expect(G.hand).toEqual(['village_settlement']);
  });
});
