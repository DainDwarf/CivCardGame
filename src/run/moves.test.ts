import { describe, it, expect } from 'vitest';
import { playCard } from './moves';
import { blankState, type GameState } from '../rules';

/** Invoke the move directly with a minimal context (it only reads `G`). */
function play(G: GameState, cardId: string, discards: string[] = []) {
  (playCard as unknown as (ctx: { G: GameState }, id: string, d?: string[]) => unknown)({ G }, cardId, discards);
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
