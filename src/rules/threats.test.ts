import { describe, it, expect } from 'vitest';
import { addThreat } from './threats';
import { dispatchEvent } from './events';
import { nextInstanceId } from './population';
import { blankState } from './state';

describe('addThreat', () => {
  it('seeds a threat bare, no counters yet', () => {
    const G = blankState('enlightenment');
    addThreat(G, 'barbarian');
    expect(G.threats).toEqual([{ id: 1, cardId: 'barbarian' }]);
  });

  it('shares the run-wide instance-id space', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    addThreat(G, 'barbarian');
    expect(G.threats[0].id).toBe(2);
    expect(nextInstanceId(G)).toBe(3);
  });
});

// Threats tick through the `endTurn` broadcast: dispatchEvent → resolveEndTurn runs each threat's
// own `resolveCard` drain (escalation included), the same resolver spine every card uses. With an
// empty tableau/workZone an `endTurn` dispatch resolves exactly the board's threats.
describe('threat drains on the endTurn broadcast', () => {
  it('resolves each threat through its own resolver spine', () => {
    // barbarian has no bespoke resolve, so its declarative default (a flat -4 military) applies
    // unscaled on every tick — the drain has no opinion on escalation, only the card does.
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'barbarian' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(6);
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(2);
  });

  it('is a no-op when there are no threats (or anything else in play)', () => {
    const G = blankState('enlightenment');
    G.resources.military = 5;
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.military).toBe(5);
    expect(G.threats).toEqual([]);
  });

  it('resolves Harsh Winter — a flat, non-escalating Food drain', () => {
    const G = blankState('long_winter');
    G.resources.food = 5;
    G.threats = [{ id: 1, cardId: 'harsh_winter' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3);
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(1); // unscaled — no counter
  });

  it('resolves Creeping Decay as an escalating Production drain via its own counter', () => {
    const G = blankState('the_long_decline');
    G.resources.production = 10;
    G.threats = [{ id: 1, cardId: 'creeping_decay' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(9); // -1, scaleResources({production:1}, 0+1)
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(7); // -2 more, scaleResources({production:1}, 1+1)
    expect(G.threats[0].counters).toEqual({ level: 2 });
  });
});
