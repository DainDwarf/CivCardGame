import { describe, it, expect } from 'vitest';
import { createRun, endTurn, applyMove, type RunState } from './engine';
import { instancesFromCardIds } from '../rules';
import { playCard } from './moves';
import type { RunConfig } from '../contract';

/** A run with an empty draw pile, so the hand can be set explicitly and stays stable across turns. */
function run(missionId: string): RunState {
  const config: RunConfig = { deck: [], board: 'tribe', boardStickers: [], missionId, deckId: 'd', seed: 's' };
  return createRun(config);
}

describe('event bus through the turn loop', () => {
  it('an on-draw building (Scriptorium) ignores the round-start refill', () => {
    let state = run('enlightenment');
    state.G.resources.food = 50; // keep famine out of it
    state.G.tableau = [{ id: 99, cardId: 'scriptorium', workers: 1 }]; // operating
    // Reset the piles: an empty hand + a known draw pile so the next turn start draws a known count
    // (createRun already drew the config deck into the opening hand).
    state.G.hand = [];
    state.G.deck = instancesFromCardIds(['farm', 'farm', 'farm'], 200);
    state.G.discard = [];
    state.G.resources.money = 0;
    state = endTurn(state); // upkeep → next beginTurn refills the hand (turnStart draws, not effect)
    expect(state.gameover).toBeUndefined();
    expect(state.G.hand.length).toBe(3);
    expect(state.G.resources.money).toBe(0); // round-start refill does NOT pay Scriptorium
    expect(state.G.events).toEqual([]); // queue drained — committed-state invariant
  });

  it('an on-draw building (Scriptorium) pays out when a card effect (Inspiration) draws', () => {
    let state = run('enlightenment');
    state.G.resources.food = 50; // keep famine out of it
    state.G.tableau = [{ id: 99, cardId: 'scriptorium', workers: 1 }]; // operating
    state.G.hand = instancesFromCardIds(['inspiration'], 300); // Inspiration: cost 1💰, draws 2
    state.G.deck = instancesFromCardIds(['farm', 'farm'], 200);
    state.G.discard = [];
    state.G.resources.money = 5;
    state = applyMove(state, playCard, 0); // play Inspiration from hand index 0
    expect(state.gameover).toBeUndefined();
    // 5 start − 1 cost + 2 (Scriptorium firing on each of Inspiration's two effect draws) = 6.
    expect(state.G.resources.money).toBe(6);
    expect(state.G.events).toEqual([]);
  });

  it('a card-declared defeat (G.pendingDefeat) is read by checkEndIf with its own reason', () => {
    let state = run('enlightenment');
    state.G.resources.food = 20;
    state.G.pendingDefeat = { reason: 'the doom clock struck' };
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'the doom clock struck' });
  });
});

describe('enlightenment deadline: win (objective) and lose (threat) reconciled by checkEndIf order', () => {
  // The Stagnation threat (seeded by the mission) owns the lose condition — a pure round-12 deadline,
  // reading no Science; the objective card owns the win (30 Science). `checkEndIf` reads the bus-written
  // win flag (`G.pendingVictory`) *before* the threat's `pendingDefeat`, so these two cards need no
  // knowledge of each other.
  it('round 12 ending short of the goal is a stagnation defeat, owned by the threat', () => {
    let state = run('enlightenment');
    state.G.resources.food = 50; // keep famine out of it
    state.G.resources.science = 20; // short of the 30 goal
    state.G.round = 12;
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'stagnation' });
  });

  it('reaching 30 science on the round-12 deadline still wins — the win flag is read first', () => {
    let state = run('enlightenment');
    state.G.resources.food = 50;
    state.G.resources.science = 30; // goal met exactly as the deadline lands
    state.G.round = 12;
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'enlightenment' });
  });
});

describe('endTurn event resolution', () => {
  it('auto-resolves an event left in hand and destroys it (removed, not discarded)', () => {
    let state = run('enlightenment');
    state.G.resources.military = 10;
    state.G.resources.food = 20; // keep famine out of the picture
    state.G.hand = instancesFromCardIds(['barbarian']);
    state = endTurn(state);
    expect(state.gameover).toBeUndefined();
    expect(state.G.resources.military).toBe(6); // barbarian drained 4
    expect(state.G.removed.map((c) => c.cardId)).toContain('barbarian');
    expect(state.G.discard.map((c) => c.cardId)).not.toContain('barbarian');
    expect(state.G.hand).toEqual([]); // empty deck, nothing redrawn
  });

  it('barbarian_tide: beating the fourth barbarian with military intact wins', () => {
    let state = run('barbarian_tide');
    state.G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian']);
    state.G.resources.military = 10;
    state.G.resources.food = 20;
    state.G.hand = instancesFromCardIds(['barbarian'], 100);
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'barbarian_tide' });
  });

  it('barbarian_tide: a fourth barbarian that drives military below zero is a defeat', () => {
    let state = run('barbarian_tide');
    state.G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian']);
    state.G.resources.military = 2; // 2 - 4 = -2
    state.G.resources.food = 20;
    state.G.hand = instancesFromCardIds(['barbarian'], 100);
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'revolt' });
  });
});

describe('objective win timing through the real turn loop', () => {
  // The subtlest case: a round-based win (long_winter, `round > 15`). Round increments in `beginTurn`,
  // so the win must register there — off the `flushEvents` that follows the refill draw, even though
  // beginTurn queues no other event. This is exactly what `flushEvents`-tail (not `dispatchEvent`-tail)
  // guarantees, so it gets an end-to-end assertion, not just the direct `objectiveMet` unit test.
  it('long_winter: the round-16 rollover wins at beginTurn', () => {
    let state = run('long_winter');
    state.G.resources.food = 500; // Harsh Winter drains 2/round — keep famine out of it
    state.G.population = 0; // and no population food upkeep
    // Drive the real loop; round starts at 1 and advances one per endTurn via beginTurn.
    for (let i = 0; i < 20 && !state.gameover; i++) state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'long_winter' });
    expect(state.G.round).toBe(16); // won the instant round crossed 15, not a round later
  });
});
