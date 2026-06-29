import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { createCivGame } from './index';

function start(missionId: string) {
  const client = Client({ game: createCivGame(missionId), numPlayers: 1 });
  client.start();
  return client;
}

/** Play a card by name, resolving hand indices at call time. */
function playByName(client: ReturnType<typeof start>, cardId: string, discardIds: string[] = []) {
  const hand = client.getState()!.G.hand;
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
    const { G } = client.getState()!;
    expect(G.round).toBe(1);
    expect(G.population).toBe(2);
    expect(G.hand).toEqual(['farm', 'workshop', 'forced_labor', 'library', 'harvest']);
    expect(G.resources.production).toBe(5);
    client.stop();
  });

  it('building a permanent erects a building, auto-staffs it, and removes the card from the deck', () => {
    const client = start('enlightenment'); // population 2, all idle
    playByName(client, 'farm'); // farm card builds a farm building -> auto-staffed on play
    const after = client.getState()!.G;
    expect(after.tableau).toEqual([{ buildingId: 'farm', workers: 1 }]);
    expect(after.removed).toEqual(['farm']); // the card itself is gone from the deck
    expect(after.discard).toEqual([]); // permanents don't recycle
    // staffing is still hand-adjustable: return the worker, then reassign it
    client.moves.unassignWorker('farm');
    expect(client.getState()!.G.tableau[0].workers).toBe(0);
    client.moves.assignWorker('farm');
    expect(client.getState()!.G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('auto-staffing stops once the idle pool is exhausted', () => {
    const client = start('enlightenment'); // population 2 idle, production 5
    playByName(client, 'forced_labor', ['harvest']); // discard harvest -> +3 production -> 8
    playByName(client, 'workshop'); // staffs 1 -> 1 idle
    playByName(client, 'farm'); // staffs 1 -> 0 idle
    playByName(client, 'library'); // no idle left -> committed unstaffed
    const lib = client.getState()!.G.tableau.find((b) => b.buildingId === 'library')!;
    expect(lib.workers).toBe(0);
    client.stop();
  });

  it('a discard-cost action sacrifices a chosen card to resolve', () => {
    const client = start('enlightenment'); // hand: farm, workshop, forced_labor, library, harvest
    playByName(client, 'forced_labor', ['farm']); // discard farm -> gain 3 production
    const { G } = client.getState()!;
    expect(G.resources.production).toBe(8); // 5 + 3
    expect(G.hand).toEqual(['workshop', 'library', 'harvest']); // both played + sacrificed card gone
    expect(G.discard).toEqual(['farm', 'forced_labor']); // sacrifice, then the action itself
    client.stop();
  });

  it('a discard-cost action is rejected when a discard is owed but not paid', () => {
    const client = start('enlightenment'); // full hand -> a discard is owed
    const prodBefore = client.getState()!.G.resources.production;
    const handBefore = [...client.getState()!.G.hand];
    playByName(client, 'forced_labor'); // no discard provided
    const { G } = client.getState()!;
    expect(G.resources.production).toBe(prodBefore);
    expect(G.hand).toEqual(handBefore);
    client.stop();
  });

  it('a discard-cost action plays free when nothing is left to discard', () => {
    const client = start('enlightenment'); // hand: farm, workshop, forced_labor, library, harvest
    playByName(client, 'harvest', ['library']); // -> hand: farm, workshop, forced_labor
    playByName(client, 'farm'); // permanent -> tableau
    playByName(client, 'workshop'); // permanent -> tableau; hand now just forced_labor
    playByName(client, 'forced_labor'); // last card -> discard cost waived, plays free
    const { G } = client.getState()!;
    expect(G.hand).toEqual([]);
    expect(G.discard).toContain('forced_labor');
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('enlightenment');
    playByName(client, 'workshop'); // cost 2 -> production 3; auto-staffed from idle pop
    client.events.endTurn!();
    const { G } = client.getState()!;
    expect(G.resources.production).toBe(3 + 2); // staffed workshop produced 2
    expect(G.resources.food).toBe(5 - 2); // population (2) ate, no farm to feed them
    client.stop();
  });

  it('famine is a universal defeat (population with no food starves)', () => {
    const client = start('enlightenment');
    client.events.endTurn!(); // food 3
    client.events.endTurn!(); // food 1
    client.events.endTurn!(); // food -1 -> famine
    const { ctx } = client.getState()!;
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'famine', missionId: 'enlightenment' });
    client.stop();
  });
});
