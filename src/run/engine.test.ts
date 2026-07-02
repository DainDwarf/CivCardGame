import { describe, it, expect } from 'vitest';
import { createRun, endTurn, type RunState } from './engine';
import type { RunConfig } from '../contract';

/** A run with an empty draw pile, so the hand can be set explicitly and stays stable across turns. */
function run(missionId: string): RunState {
  const config: RunConfig = { deck: [], board: 'tribe', missionId, deckId: 'd', seed: 's' };
  return createRun(config);
}

describe('endTurn event resolution', () => {
  it('auto-resolves an event left in hand and destroys it (removed, not discarded)', () => {
    let state = run('enlightenment');
    state.G.resources.military = 10;
    state.G.resources.food = 20; // keep famine out of the picture
    state.G.hand = ['barbarian'];
    state = endTurn(state);
    expect(state.gameover).toBeUndefined();
    expect(state.G.resources.military).toBe(6); // barbarian drained 4
    expect(state.G.removed).toContain('barbarian');
    expect(state.G.discard).not.toContain('barbarian');
    expect(state.G.hand).toEqual([]); // empty deck, nothing redrawn
  });

  it('barbarian_tide: beating the fourth barbarian with military intact wins', () => {
    let state = run('barbarian_tide');
    state.G.removed = ['barbarian', 'barbarian', 'barbarian'];
    state.G.resources.military = 10;
    state.G.resources.food = 20;
    state.G.hand = ['barbarian'];
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'barbarian_tide' });
  });

  it('barbarian_tide: a fourth barbarian that drives military below zero is a defeat', () => {
    let state = run('barbarian_tide');
    state.G.removed = ['barbarian', 'barbarian', 'barbarian'];
    state.G.resources.military = 2; // 2 - 4 = -2
    state.G.resources.food = 20;
    state.G.hand = ['barbarian'];
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'revolt' });
  });
});
