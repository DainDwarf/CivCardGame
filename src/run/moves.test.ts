import { describe, it, expect } from 'vitest';
import { playCard, transferWorker } from './moves';
import { blankState, type GameState } from '../rules';

/** Invoke the move directly with a minimal context (it only reads `G`). */
function play(G: GameState, cardId: string, discardCardIds: string[] = [], destroyInstanceId?: number) {
  const idx = G.hand.indexOf(cardId);
  if (idx === -1) throw new Error(`play: '${cardId}' not in hand`);
  const discardIdxs = discardCardIds.map((d) => {
    const i = G.hand.indexOf(d);
    if (i === -1) throw new Error(`play: discard '${d}' not in hand`);
    return i;
  });
  playCard(G, idx, discardIdxs, destroyInstanceId);
}

describe('playCard: cards vs. buildings', () => {
  it('a permanent card erects a building and is removed from the deck (not discarded)', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2; // idle -> the farm auto-staffs
    play(G, 'farm');
    expect(G.tableau).toEqual([{ id: 1, buildingId: 'farm', workers: 1 }]);
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
    expect(G.tableau).toEqual([{ id: 1, buildingId: 'farm', workers: 1 }]); // built + staffed from the remaining idle
    expect(G.discard).toEqual(['village_settlement']); // recurring -> recycles, NOT removed
    expect(G.removed).toEqual([]);
  });

  it('rejects a building when the tableau is at its territory cap', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, buildingId: 'workshop', workers: 1 }]; // sole slot already taken
    play(G, 'farm');
    expect(G.tableau).toHaveLength(1); // farm not built
    expect(G.hand).toEqual(['farm']); // card stays in hand, nothing paid
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes the targeted building from the tableau and frees its territory slot', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [
      { id: 1, buildingId: 'farm', workers: 1 },
      { id: 2, buildingId: 'workshop', workers: 1 },
    ];
    G.population = 2;
    play(G, 'destroy', [], 1); // demolish the farm instance
    expect(G.tableau).toEqual([{ id: 2, buildingId: 'workshop', workers: 1 }]);
    expect(G.resources.production).toBe(4); // paid 1 production
    expect(G.discard).toEqual(['destroy']); // recurring → recycles
  });

  it('destroy frees assigned workers back to the idle pool', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.population = 2;
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }];
    play(G, 'destroy', [], 1);
    expect(G.tableau).toEqual([]);
    // The removed worker is now idle (freePopulation = population - assignedWorkers)
    // Population is still 2, no workers assigned => 2 idle.
    expect(G.population).toBe(2);
  });

  it('destroy is rejected without a target instance id', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }];
    play(G, 'destroy'); // no destroyInstanceId
    expect(G.tableau).toHaveLength(1); // nothing removed
    expect(G.resources.production).toBe(5); // nothing paid
  });

  it('destroy is rejected when the target instance is not in the tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }];
    play(G, 'destroy', [], 999); // no instance with id 999
    expect(G.tableau).toHaveLength(1);
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes exactly the targeted instance among identical siblings', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.population = 1;
    G.tableau = [
      { id: 1, buildingId: 'farm', workers: 1 }, // staffed
      { id: 2, buildingId: 'farm', workers: 0 }, // empty
    ];
    play(G, 'destroy', [], 2); // demolish the empty farm, by id
    expect(G.tableau).toEqual([{ id: 1, buildingId: 'farm', workers: 1 }]); // targeted instance removed
  });

  it('destroy enables a building card to be played after demolishing a full tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy', 'granary'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }]; // tableau at cap
    play(G, 'destroy', [], 1);
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
    G.tableau = [{ id: 1, buildingId: 'workshop', workers: 1 }]; // full at territory 1
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

  it('a pop-reserve card increments reservedPop, defers its gain, and is blocked when idle pool is too small', () => {
    const G = blankState('enlightenment');
    G.hand = ['corvee', 'harvest'];
    G.population = 2;
    play(G, 'corvee'); // reserve 1 -> reservedPop = 1, free pop = 1; gain deferred
    expect(G.reservedPop).toBe(1);
    expect(G.resources.production).toBe(0); // not yet applied
    expect(G.reservedGains.production).toBe(3); // queued for upkeep
    play(G, 'harvest'); // reserve another 1 -> reservedPop = 2, free pop = 0; gain deferred
    expect(G.reservedPop).toBe(2);
    expect(G.resources.food).toBe(0); // not yet applied
    expect(G.reservedGains.food).toBe(3); // queued for upkeep
    // Both reserved, free pop = 0 — playing a third pop-reserve card is blocked
    G.hand = ['corvee'];
    play(G, 'corvee'); // rejected: no idle pop
    expect(G.reservedPop).toBe(2); // unchanged
    expect(G.reservedGains.production).toBe(3); // unchanged
    expect(G.hand).toEqual(['corvee']); // card stays
  });
});

describe('transferWorker: moving a worker directly between two buildings', () => {
  it('moves one worker from the source building to the target in a single call', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, buildingId: 'farm', workers: 1 },
      { id: 2, buildingId: 'workshop', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau).toEqual([
      { id: 1, buildingId: 'farm', workers: 0 },
      { id: 2, buildingId: 'workshop', workers: 1 },
    ]);
  });

  it('rejects when the source building has no worker to give', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, buildingId: 'farm', workers: 0 },
      { id: 2, buildingId: 'workshop', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(0);
    expect(G.tableau[1].workers).toBe(0);
  });

  it('rejects when the target building is already at its worker requirement', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, buildingId: 'farm', workers: 1 },
      { id: 2, buildingId: 'workshop', workers: 1 }, // workshop needs only 1 worker
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(1); // untouched
    expect(G.tableau[1].workers).toBe(1);
  });

  it('rejects a transfer to itself', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }];
    transferWorker(G, 1, 1);
    expect(G.tableau[0].workers).toBe(1);
  });

  it('rejects when either instance id does not exist', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, buildingId: 'farm', workers: 1 }];
    transferWorker(G, 1, 999);
    expect(G.tableau[0].workers).toBe(1);
    transferWorker(G, 999, 1);
    expect(G.tableau[0].workers).toBe(1);
  });
});
