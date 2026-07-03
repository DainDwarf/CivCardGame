import { describe, it, expect } from 'vitest';
import { assignWorker, playCard, toggleStaffing, transferWorker } from './moves';
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
  it('a building card is placed in the tableau and stays in play (not filed to any pile)', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2; // idle -> the farm auto-staffs
    play(G, 'farm');
    expect(G.tableau).toEqual([{ id: 1, cardId: 'farm', workers: 1 }]);
    expect(G.removed).toEqual([]); // the card *is* the building — not removed on play
    expect(G.discard).toEqual([]);
    expect(G.hand).toEqual([]);
  });

  it('rejects a building when the tableau is at its territory cap', () => {
    const G = blankState('enlightenment');
    G.hand = ['farm'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'workshop', workers: 1 }]; // sole slot already taken
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
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 1 },
    ];
    G.population = 2;
    play(G, 'destroy', [], 1); // demolish the farm instance
    expect(G.tableau).toEqual([{ id: 2, cardId: 'workshop', workers: 1 }]);
    expect(G.removed).toEqual(['farm']); // the demolished building's card leaves play
    expect(G.resources.production).toBe(4); // paid 1 production
    expect(G.discard).toEqual(['destroy']); // recurring → recycles
  });

  it('destroy frees assigned workers back to the idle pool', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.population = 2;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
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
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    play(G, 'destroy'); // no destroyInstanceId
    expect(G.tableau).toHaveLength(1); // nothing removed
    expect(G.resources.production).toBe(5); // nothing paid
  });

  it('destroy is rejected when the target instance is not in the tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy'];
    G.resources.production = 5;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
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
      { id: 1, cardId: 'farm', workers: 1 }, // staffed
      { id: 2, cardId: 'farm', workers: 0 }, // empty
    ];
    play(G, 'destroy', [], 2); // demolish the empty farm, by id
    expect(G.tableau).toEqual([{ id: 1, cardId: 'farm', workers: 1 }]); // targeted instance removed
  });

  it('destroy enables a building card to be played after demolishing a full tableau', () => {
    const G = blankState('enlightenment');
    G.hand = ['destroy', 'granary'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }]; // tableau at cap
    play(G, 'destroy', [], 1);
    expect(G.tableau).toHaveLength(0);
    expect(G.territory).toBe(1); // territory cap unchanged — just freed a slot
    play(G, 'granary'); // now a slot is free
    expect(G.tableau.some((b) => b.cardId === 'granary')).toBe(true);
  });

  it('a territory card opens a slot so the next building can be played', () => {
    const G = blankState('enlightenment');
    G.hand = ['develop', 'farm'];
    G.resources.production = 5;
    G.population = 2;
    G.territory = 1;
    G.tableau = [{ id: 1, cardId: 'workshop', workers: 1 }]; // full at territory 1
    play(G, 'develop'); // +1 territory (cost 3 production) -> room for one more
    expect(G.territory).toBe(2);
    expect(G.discard).toEqual(['develop']); // recurring -> recycles
    play(G, 'farm'); // now fits
    expect(G.tableau).toHaveLength(2);
    expect(G.tableau.some((b) => b.cardId === 'farm')).toBe(true);
  });

  it('a work card sticks onto the board auto-staffed, applies nothing now, and is not yet discarded', () => {
    const G = blankState('enlightenment');
    G.hand = ['corvee'];
    G.population = 1; // one idle -> the work box auto-staffs
    play(G, 'corvee');
    expect(G.workZone).toEqual([{ id: 1, cardId: 'corvee', workers: 1 }]);
    expect(G.resources.production).toBe(0); // production is deferred to upkeep, not applied now
    expect(G.hand).toEqual([]); // card left hand
    expect(G.discard).toEqual([]); // work cards file to discard only at end of turn
  });

  it('a work card is playable with no idle workers — it just sits unstaffed (no pop gate)', () => {
    const G = blankState('enlightenment');
    G.hand = ['corvee', 'harvest'];
    G.population = 1;
    play(G, 'corvee'); // takes the one idle worker
    play(G, 'harvest'); // still allowed, but nothing left to staff it
    expect(G.workZone).toEqual([
      { id: 1, cardId: 'corvee', workers: 1 },
      { id: 2, cardId: 'harvest', workers: 0 },
    ]);
    expect(G.hand).toEqual([]);
  });

  it('a work box can be staffed after the fact via the shared worker moves', () => {
    const G = blankState('enlightenment');
    G.hand = ['harvest'];
    G.population = 1;
    play(G, 'harvest'); // no idle at play time? population 1 is idle, so it auto-staffs
    expect(G.workZone[0].workers).toBe(1);
    toggleStaffing(G, 1); // empty it
    expect(G.workZone[0].workers).toBe(0);
    assignWorker(G, 1); // and re-staff one worker
    expect(G.workZone[0].workers).toBe(1);
  });
});

describe('transferWorker: moving a worker directly between two buildings', () => {
  it('moves one worker from the source building to the target in a single call', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau).toEqual([
      { id: 1, cardId: 'farm', workers: 0 },
      { id: 2, cardId: 'workshop', workers: 1 },
    ]);
  });

  it('rejects when the source building has no worker to give', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 0 },
      { id: 2, cardId: 'workshop', workers: 0 },
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(0);
    expect(G.tableau[1].workers).toBe(0);
  });

  it('rejects when the target building is already at its worker requirement', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 1 }, // workshop needs only 1 worker
    ];
    transferWorker(G, 1, 2);
    expect(G.tableau[0].workers).toBe(1); // untouched
    expect(G.tableau[1].workers).toBe(1);
  });

  it('rejects a transfer to itself', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    transferWorker(G, 1, 1);
    expect(G.tableau[0].workers).toBe(1);
  });

  it('rejects when either instance id does not exist', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    transferWorker(G, 1, 999);
    expect(G.tableau[0].workers).toBe(1);
    transferWorker(G, 999, 1);
    expect(G.tableau[0].workers).toBe(1);
  });
});
