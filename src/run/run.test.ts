import { describe, it, expect } from 'vitest';
import { applyMove, createRun, endTurn, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker } from './moves';

function start(missionId: string) {
  let state: RunState = createRun(missionId);
  return {
    getState: () => ({ G: state.G, ctx: { gameover: state.gameover } }),
    moves: {
      playCard: (idx: number, discards: number[] = []) => { state = applyMove(state, playCard, idx, discards); },
      assignWorker: (buildingId: string) => { state = applyMove(state, assignWorker, buildingId); },
      unassignWorker: (buildingId: string) => { state = applyMove(state, unassignWorker, buildingId); },
    },
    events: { endTurn: () => { state = endTurn(state); } },
    stop: () => {},
  };
}

/** Play a card by name, resolving hand indices at call time. */
function playByName(client: ReturnType<typeof start>, cardId: string, discardIds: string[] = []) {
  const hand = client.getState().G.hand;
  const idx = hand.indexOf(cardId);
  if (idx === -1) throw new Error(`playByName: '${cardId}' not in hand`);
  client.moves.playCard(idx, discardIds.map((d) => {
    const i = hand.indexOf(d);
    if (i === -1) throw new Error(`playByName: discard '${d}' not in hand`);
    return i;
  }));
}

describe('run loop (headless integration)', () => {
  it('opens round 1 with a full hand and starting population, before any upkeep', () => {
    const client = start('enlightenment');
    const { G } = client.getState();
    expect(G.round).toBe(1);
    expect(G.population).toBe(2);
    expect(G.hand).toEqual(['farm', 'workshop', 'corvee', 'library', 'harvest']);
    expect(G.resources.production).toBe(5);
    client.stop();
  });

  it('building a permanent erects a building, auto-staffs it, and removes the card from the deck', () => {
    const client = start('enlightenment'); // population 2, all idle
    playByName(client, 'farm'); // farm card builds a farm building -> auto-staffed on play
    const after = client.getState().G;
    expect(after.tableau).toEqual([{ buildingId: 'farm', workers: 1 }]);
    expect(after.removed).toEqual(['farm']); // the card itself is gone from the deck
    expect(after.discard).toEqual([]); // permanents don't recycle
    // staffing is still hand-adjustable: return the worker, then reassign it
    client.moves.unassignWorker('farm');
    expect(client.getState().G.tableau[0].workers).toBe(0);
    client.moves.assignWorker('farm');
    expect(client.getState().G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('auto-staffing stops once the idle pool is exhausted', () => {
    const client = start('enlightenment'); // population 2 idle, production 5
    playByName(client, 'corvee'); // reserve 1 pop -> free pop = 1; gain deferred to upkeep
    playByName(client, 'workshop'); // costs 2 prod -> 3; auto-staffs 1 -> free pop = 0
    playByName(client, 'farm'); // costs 1 prod -> 2; no idle left -> unstaffed
    const G = client.getState().G;
    expect(G.tableau.find((b) => b.buildingId === 'workshop')!.workers).toBe(1);
    expect(G.tableau.find((b) => b.buildingId === 'farm')!.workers).toBe(0);
    client.stop();
  });

  it('a pop-reserve action reserves idle population and defers its gain to upkeep', () => {
    const client = start('enlightenment'); // hand: farm, workshop, corvee, library, harvest; pop 2
    playByName(client, 'corvee'); // reserve 1 pop; +3 production deferred
    const { G } = client.getState();
    expect(G.resources.production).toBe(5); // gain not yet applied
    expect(G.reservedGains.production).toBe(3); // queued for upkeep
    expect(G.reservedPop).toBe(1);
    expect(G.hand).toEqual(['farm', 'workshop', 'library', 'harvest']);
    expect(G.discard).toEqual(['corvee']);
    client.events.endTurn();
    expect(client.getState().G.reservedGains.production).toBe(0); // cleared after upkeep
    client.stop();
  });

  it('a pop-reserve action is rejected when no idle population is available', () => {
    const client = start('enlightenment'); // pop 2
    playByName(client, 'farm'); // costs 1 prod -> auto-staffs 1 pop
    playByName(client, 'workshop'); // costs 2 prod -> auto-staffs 1 pop; 0 idle
    const { G: before } = client.getState();
    playByName(client, 'corvee'); // no idle pop -> rejected
    const { G } = client.getState();
    expect(G.resources.production).toBe(before.resources.production);
    expect(G.hand).toContain('corvee');
    client.stop();
  });

  it('reserved population is released at the start of the next turn', () => {
    const client = start('enlightenment'); // pop 2
    playByName(client, 'corvee'); // reserve 1 -> free pop = 1
    playByName(client, 'farm'); // auto-staffs 1 -> free pop = 0
    playByName(client, 'workshop'); // builds unstaffed (free pop = 0)
    expect(client.getState().G.tableau.find((b) => b.buildingId === 'workshop')!.workers).toBe(0);
    client.moves.assignWorker('workshop'); // blocked — no free pop
    expect(client.getState().G.tableau.find((b) => b.buildingId === 'workshop')!.workers).toBe(0);
    client.events.endTurn(); // beginTurn resets reservedPop to 0
    expect(client.getState().G.reservedPop).toBe(0);
    client.moves.assignWorker('workshop'); // now free pop = 1 -> succeeds
    expect(client.getState().G.tableau.find((b) => b.buildingId === 'workshop')!.workers).toBe(1);
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('enlightenment');
    playByName(client, 'workshop'); // cost 2 -> production 3; auto-staffed from idle pop
    client.events.endTurn();
    const { G } = client.getState();
    expect(G.resources.production).toBe(3 + 2); // staffed workshop produced 2
    expect(G.resources.food).toBe(5 - 2); // population (2) ate, no farm to feed them
    client.stop();
  });

  it('famine is a universal defeat (population with no food starves)', () => {
    const client = start('enlightenment');
    client.events.endTurn(); // food 3
    client.events.endTurn(); // food 1
    client.events.endTurn(); // food -1 -> famine
    const { ctx } = client.getState();
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'famine', missionId: 'enlightenment' });
    client.stop();
  });

  it('revolt is a universal defeat when military goes negative (barbarian_tide)', () => {
    // military 4, threat grows by 2/round: upkeep R1 → military 2, upkeep R2 → military -2
    // food 5, pop eats 2/round: after 2 rounds food is still 1 (positive), so revolt wins the check
    const client = start('barbarian_tide');
    client.events.endTurn();
    client.events.endTurn();
    const { ctx } = client.getState();
    expect(ctx.gameover).toMatchObject({ outcome: 'defeat', reason: 'revolt' });
    client.stop();
  });
});
