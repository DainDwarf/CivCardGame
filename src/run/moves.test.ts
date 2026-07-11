import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assignWorker, playCard, toggleStaffing, transferWorker } from './moves';
import { blankState, drawCard, instancesFromCardIds, type GameState } from '../rules';
import { installCards, installFixtures, uninstallCards, uninstallFixtures } from '../rules/testFixtures';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

// A building carrying a one-shot *placement* effect (the shared fixtures are all produces-only, so
// this local one exercises the placement-resolve path — the Hut's mechanism). No `produces`, no
// worker: on placement it grants +1 population, and nothing recurs per round.
const PLACEMENT_BUILDING = {
  hut_fixture: {
    id: 'hut_fixture', name: 'Hut Fixture', kind: 'building' as const,
    cost: { production: 4 }, workers: 0, effect: { population: 1 },
  },
};

/** Invoke the move directly with a minimal context (it only reads `G`). Hand cards are now
 *  identity-bearing instances, so look a card up by its `cardId` (first match, like the old
 *  `indexOf`). */
function play(G: GameState, cardId: string, discardCardIds: string[] = [], destroyInstanceId?: number) {
  const idx = G.hand.findIndex((c) => c.cardId === cardId);
  if (idx === -1) throw new Error(`play: '${cardId}' not in hand`);
  const discardIdxs = discardCardIds.map((d) => {
    const i = G.hand.findIndex((c) => c.cardId === d);
    if (i === -1) throw new Error(`play: discard '${d}' not in hand`);
    return i;
  });
  playCard(G, idx, discardIdxs, destroyInstanceId);
}

describe('playCard: cards vs. buildings', () => {
  it('a building card is placed in the tableau and stays in play (not filed to any pile)', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food']);
    G.resources.production = 5;
    G.population = 2; // idle -> the building auto-staffs
    play(G, 'test_food');
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_food', workers: 1 }]);
    expect(G.removed).toEqual([]); // the card *is* the building — not removed on play
    expect(G.discard).toEqual([]);
    expect(G.hand).toEqual([]);
  });

  it('a wonder card is placed in the tableau exactly like a building (staffed, not filed to any pile)', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_wonder']);
    G.resources.production = 5;
    G.population = 2; // idle -> the wonder auto-staffs its 1 worker
    play(G, 'test_wonder');
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_wonder', workers: 1 }]);
    expect(G.removed).toEqual([]);
    expect(G.discard).toEqual([]);
    expect(G.hand).toEqual([]);
  });

  it('a wonder is blocked by the territory cap, just like a building', () => {
    const G = blankState('test');
    G.territory = 1;
    G.tableau = [{ id: 99, cardId: 'test_food', workers: 1 }]; // the one slot is taken
    G.hand = instancesFromCardIds(['test_wonder']);
    G.resources.production = 5;
    G.population = 2;
    expect(playCard(G, 0)).toBe('invalid');
    expect(G.tableau).toHaveLength(1); // nothing placed
  });

  it("resolves a building's one-shot placement effect once when placed (the Hut's +1 population)", () => {
    installCards(PLACEMENT_BUILDING);
    try {
      const G = blankState('test');
      G.hand = instancesFromCardIds(['hut_fixture']);
      G.resources.production = 4;
      G.population = 3;
      play(G, 'hut_fixture');
      // Placed (self-sufficient, 0 workers) AND its placement effect ran exactly once: +1 pop.
      expect(G.tableau).toEqual([{ id: 1, cardId: 'hut_fixture', workers: 0 }]);
      expect(G.population).toBe(4);
    } finally {
      uninstallCards(PLACEMENT_BUILDING);
    }
  });

  it('a produces-only building resolves no placement effect (population/resources untouched)', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food']);
    G.resources.production = 5;
    G.population = 2;
    play(G, 'test_food');
    // The placement-resolve is a no-op for an effect-less building — only the cost was paid.
    expect(G.population).toBe(2);
    expect(G.resources.production).toBe(3);
  });

  it('rejects a building when the tableau is at its territory cap', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food']);
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'test_prod', workers: 1 }]; // sole slot already taken
    play(G, 'test_food');
    expect(G.tableau).toHaveLength(1); // building not built
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food']); // card stays in hand, nothing paid
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes the targeted building from the tableau and frees its territory slot', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy']);
    G.resources.production = 5;
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 },
      { id: 2, cardId: 'test_prod', workers: 1 },
    ];
    G.population = 2;
    play(G, 'test_destroy', [], 1); // demolish the test_food instance
    expect(G.tableau).toEqual([{ id: 2, cardId: 'test_prod', workers: 1 }]);
    expect(G.removed).toEqual([{ id: 1, cardId: 'test_food' }]); // the demolished building's card leaves play
    expect(G.resources.production).toBe(4); // paid 1 production
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_destroy']); // action → recycles
  });

  it('destroy frees assigned workers back to the idle pool', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy']);
    G.resources.production = 5;
    G.population = 2;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    play(G, 'test_destroy', [], 1);
    expect(G.tableau).toEqual([]);
    // The removed worker is now idle (freePopulation = population - assignedWorkers)
    // Population is still 2, no workers assigned => 2 idle.
    expect(G.population).toBe(2);
  });

  it('destroy is rejected without a target instance id', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy']);
    G.resources.production = 5;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    play(G, 'test_destroy'); // no destroyInstanceId
    expect(G.tableau).toHaveLength(1); // nothing removed
    expect(G.resources.production).toBe(5); // nothing paid
  });

  it('destroy is rejected when the target instance is not in the tableau', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy']);
    G.resources.production = 5;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    play(G, 'test_destroy', [], 999); // no instance with id 999
    expect(G.tableau).toHaveLength(1);
    expect(G.resources.production).toBe(5);
  });

  it('destroy removes exactly the targeted instance among identical siblings', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy']);
    G.resources.production = 5;
    G.population = 1;
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 }, // staffed
      { id: 2, cardId: 'test_food', workers: 0 }, // empty
    ];
    play(G, 'test_destroy', [], 2); // demolish the empty copy, by id
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_food', workers: 1 }]); // targeted instance removed
  });

  it('destroy enables a building card to be played after demolishing a full tableau', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_destroy', 'test_food']);
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }]; // tableau at cap
    play(G, 'test_destroy', [], 1);
    expect(G.tableau).toHaveLength(0);
    expect(G.territory).toBe(1); // territory cap unchanged — just freed a slot
    play(G, 'test_food'); // now a slot is free
    expect(G.tableau.some((b) => b.cardId === 'test_food')).toBe(true);
  });

  it('a territory card opens a slot so the next building can be played', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_territory', 'test_food']);
    G.resources.production = 5;
    G.resources.military = 3; // test_territory's cost
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'test_prod', workers: 1 }]; // full at territory 1
    play(G, 'test_territory'); // +1 territory (cost 3 military) -> room for one more
    expect(G.territory).toBe(2);
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_territory']); // action -> recycles
    play(G, 'test_food'); // now fits
    expect(G.tableau).toHaveLength(2);
    expect(G.tableau.some((b) => b.cardId === 'test_food')).toBe(true);
  });

  it('a work card sticks onto the board auto-staffed, applies nothing now, and is not yet discarded', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_work']);
    G.population = 1; // one idle -> the work box auto-staffs
    play(G, 'test_work');
    expect(G.workZone).toEqual([{ id: 1, cardId: 'test_work', workers: 1 }]);
    expect(G.resources.production).toBe(0); // production is deferred to upkeep, not applied now
    expect(G.hand).toEqual([]); // card left hand
    expect(G.discard).toEqual([]); // work cards file to discard only at end of turn
  });

  it('a work card is playable with no idle workers — it just sits unstaffed (no pop gate)', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_work', 'test_work_food']);
    G.population = 1;
    play(G, 'test_work'); // takes the one idle worker
    play(G, 'test_work_food'); // still allowed, but nothing left to staff it
    // Instance ids are now unique across *all* zones: when test_work is played, test_work_food
    // (id 2) is still in hand, so its work box allocates past it (id 3), then test_work_food's box (id 4).
    expect(G.workZone).toEqual([
      { id: 3, cardId: 'test_work', workers: 1 },
      { id: 4, cardId: 'test_work_food', workers: 0 },
    ]);
    expect(G.hand).toEqual([]);
  });

  it('a work box can be staffed after the fact via the shared worker moves', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_work_food']);
    G.population = 1;
    play(G, 'test_work_food'); // population 1 is idle, so it auto-staffs
    expect(G.workZone[0].workers).toBe(1);
    toggleStaffing(G, 1); // empty it
    expect(G.workZone[0].workers).toBe(0);
    assignWorker(G, 1); // and re-staff one worker
    expect(G.workZone[0].workers).toBe(1);
  });
});

describe('playCard: per-instance card state (a self-scaling card)', () => {
  it('grows each physical copy independently — playing one never buffs the other', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_growing', 'test_growing']); // two distinct copies (ids 1, 2)
    play(G, 'test_growing'); // copy #1's first play: +1 food
    play(G, 'test_growing'); // copy #2's first play: +1 again (not +2 — its counter is its own)
    expect(G.resources.food).toBe(2); // a shared counter would have given 1 + 2 = 3
    // each copy filed to discard carrying its own play count
    expect(G.discard.map((c) => c.counters?.plays)).toEqual([1, 1]);
  });

  it('a copy remembers its own play count across discard → reshuffle → redraw', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_growing']); // id 1
    G.deck = [];
    play(G, 'test_growing'); // +1 food, this copy's plays -> 1, files to discard
    expect(G.resources.food).toBe(1);
    drawCard(G); // deck empty -> discard reshuffles back and the same copy is drawn again
    expect(G.hand[0].counters?.plays).toBe(1); // its counter rode along with it
    play(G, 'test_growing'); // now +2 (plays was 1) -> total 3
    expect(G.resources.food).toBe(3);
  });
});

describe('playCard: card stickers in the run loop (Phase 3 Step 7.6)', () => {
  it("an Efficient-like sticker discounts this exact copy's cost by 1 per resource, floored at 0", () => {
    const G = blankState('test');
    // test_food costs {production: 2} raw; the sticker floors each cost key at -1, so its
    // discounted cost is 1 — affordable even though the raw cost isn't.
    G.hand = [{ id: 1, cardId: 'test_food', stickers: ['test_costcut'] }];
    G.resources.production = 1; // below the raw cost of 2, but covers the discounted cost of 1
    G.population = 1;
    play(G, 'test_food');
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_food', workers: 1, stickers: ['test_costcut'] }]);
    expect(G.resources.production).toBe(0); // discounted to 1, all of it spent
  });

  it('an unstickered copy of the same card still pays the full raw cost', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food']);
    G.resources.production = 0;
    G.population = 1;
    play(G, 'test_food');
    expect(G.tableau).toEqual([]); // unaffordable — rejected
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food']); // stays in hand
  });

  it("a Reinforced-like sticker bumps a played action card's gain by 1, riding to discard on the same copy", () => {
    const G = blankState('test');
    // test_discard carries a discard cost of 1 — a spare card in hand covers it.
    G.hand = [{ id: 1, cardId: 'test_discard', stickers: ['test_addgain'] }, { id: 2, cardId: 'x' }];
    play(G, 'test_discard', ['x']);
    expect(G.resources.science).toBe(4); // test_discard's base +3, test_addgain +1
    expect(G.discard).toContainEqual({ id: 1, cardId: 'test_discard', stickers: ['test_addgain'] });
  });
});

describe('transferWorker: moving a worker directly between two buildings', () => {
  it('moves one worker from the source building to the target in a single call', () => {
    const G = blankState('test');
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 },
      { id: 2, cardId: 'test_prod', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau).toEqual([
      { id: 1, cardId: 'test_food', workers: 0 },
      { id: 2, cardId: 'test_prod', workers: 1 },
    ]);
  });

  it('rejects when the source building has no worker to give', () => {
    const G = blankState('test');
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 0 },
      { id: 2, cardId: 'test_prod', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(0);
    expect(G.tableau[1].workers).toBe(0);
  });

  it('rejects when the target building is already at its worker requirement', () => {
    const G = blankState('test');
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 },
      { id: 2, cardId: 'test_prod', workers: 1 }, // test_prod needs only 1 worker
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(1); // untouched
    expect(G.tableau[1].workers).toBe(1);
  });

  it('rejects a transfer to itself', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    transferWorker(G, 1, 1);
    expect(G.tableau[0].workers).toBe(1);
  });

  it('rejects when either instance id does not exist', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    transferWorker(G, 1, 999);
    expect(G.tableau[0].workers).toBe(1);
    transferWorker(G, 999, 1);
    expect(G.tableau[0].workers).toBe(1);
  });
});
