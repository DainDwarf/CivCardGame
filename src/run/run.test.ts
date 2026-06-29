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

  it('building a permanent creates an unstaffed instance you then staff', () => {
    const client = start('enlightenment');
    client.moves.playCard('farm');
    expect(client.getState()!.G.tableau).toEqual([{ cardId: 'farm', workers: 0 }]);
    client.moves.assignWorker('farm');
    expect(client.getState()!.G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('enlightenment');
    client.moves.playCard('workshop'); // cost 2 -> production 3
    client.moves.assignWorker('workshop'); // staff it
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
