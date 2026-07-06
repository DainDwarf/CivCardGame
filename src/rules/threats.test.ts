import { describe, it, expect } from 'vitest';
import { addThreat, tickThreats } from './threats';
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

describe('tickThreats', () => {
  it('resolves each threat through the same resolver spine every card uses', () => {
    // barbarian has no bespoke resolve, so its declarative default (a flat -4 military) applies
    // unscaled on every tick — tickThreats itself has no opinion on escalation, only the card does.
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'barbarian' }];
    tickThreats(G);
    expect(G.resources.military).toBe(6);
    tickThreats(G);
    expect(G.resources.military).toBe(2);
  });

  it("a card that scales itself off its own counter (Cornucopia's growth resolver) escalates across ticks", () => {
    // Reuses Cornucopia purely to exercise the generic tick-through-resolveCard wiring against a
    // counter-scaling resolver — not real threat content (that's Step 6.3c's Creeping Decay).
    const G = blankState('enlightenment');
    G.threats = [{ id: 1, cardId: 'cornucopia' }];
    tickThreats(G);
    expect(G.resources.food).toBe(1); // scaleResources({food:1}, 0+1)
    tickThreats(G);
    expect(G.resources.food).toBe(3); // +2, scaleResources({food:1}, 1+1)
    expect(G.threats[0].counters).toEqual({ plays: 2 });
  });

  it('is a no-op when there are no threats', () => {
    const G = blankState('enlightenment');
    G.resources.military = 5;
    tickThreats(G);
    expect(G.resources.military).toBe(5);
    expect(G.threats).toEqual([]);
  });

  it('resolves Harsh Winter — the first real threat card (Step 6.3b) — as a flat, non-escalating Food drain', () => {
    const G = blankState('long_winter');
    G.resources.food = 5;
    G.threats = [{ id: 1, cardId: 'harsh_winter' }];
    tickThreats(G);
    expect(G.resources.food).toBe(3);
    tickThreats(G);
    expect(G.resources.food).toBe(1); // unscaled — no counter, unlike Cornucopia's growth above
  });
});
