import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { createCivGame } from './index';

function start(missionId: string) {
  const client = Client({ game: createCivGame(missionId), numPlayers: 1 });
  client.start();
  return client;
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

  it('building a permanent auto-staffs it from the idle population', () => {
    const client = start('enlightenment'); // population 2, all idle
    client.moves.playCard('farm'); // farm needs 1 worker -> auto-staffed on play
    expect(client.getState()!.G.tableau).toEqual([{ cardId: 'farm', workers: 1 }]);
    // staffing is still hand-adjustable: return the worker, then reassign it
    client.moves.unassignWorker('farm');
    expect(client.getState()!.G.tableau[0].workers).toBe(0);
    client.moves.assignWorker('farm');
    expect(client.getState()!.G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('auto-staffing stops once the idle pool is exhausted', () => {
    const client = start('enlightenment'); // population 2 idle, production 5
    client.moves.playCard('forced_labor'); // +3 production -> 8 (recurring, no workers)
    client.moves.playCard('workshop'); // staffs 1 -> 1 idle
    client.moves.playCard('farm'); // staffs 1 -> 0 idle
    client.moves.playCard('library'); // no idle left -> committed unstaffed
    const lib = client.getState()!.G.tableau.find((b) => b.cardId === 'library')!;
    expect(lib.workers).toBe(0);
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('enlightenment');
    client.moves.playCard('workshop'); // cost 2 -> production 3; auto-staffed from idle pop
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
