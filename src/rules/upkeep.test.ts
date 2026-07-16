import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveHandEvents, projectedDelta, applyUpkeep } from './upkeep';
import { blankState, instancesFromCardIds } from './state';
import { gainResources } from './effects';
import { subtractResources } from './resources';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures, installCards, uninstallCards } from './testFixtures';

// Local fixtures for the projected-reshuffle preview (only this suite drives them): a threat that
// reacts to the deck fold (mirrors the shipped Unrest — drains 💰 per 🧍) and an on-draw building
// (gains 🔬 on any draw). The pair proves `projectedDelta` shows the *structural* reshuffle cost while
// *suppressing* the draw-contingent `on.draw` effect it must not leak.
const LOCAL: Record<string, CardDef> = {
  test_unrest: {
    id: 'test_unrest', name: 'Test Unrest', kind: 'threat', cost: {},
    display: { description: '−1💰 per 🧍 on reshuffle' },
    on: { reshuffle: { resolve: ({ G }) => subtractResources(G.resources, { money: G.resources.population }) } },
  },
  test_ondraw: {
    id: 'test_ondraw', name: 'Test On-Draw', kind: 'building', cost: {}, workers: 0,
    on: { draw: { resolve: (ctx) => gainResources(ctx, { science: 5 }) } },
  },
};

beforeAll(() => {
  installFixtures();
  installCards(LOCAL);
});
afterAll(() => {
  uninstallCards(LOCAL);
  uninstallFixtures();
});

describe('projectedDelta — event-bus reachability', () => {
  it('reflects an upkeep-triggered handler in the HUD preview (Treasury crossing 10 during production)', () => {
    // test_money produces +2💰 during upkeep, pushing money 9 → 11, which crosses test_threshold's
    // threshold and pays +5🔬. Because applyUpkeep flushes the bus, projectedDelta (which clones + runs
    // upkeep) must show that +5🔬 — otherwise the preview would lie about what ending the turn does.
    const G = blankState('test');
    G.resources.money = 9;
    G.tableau = [
      { id: 1, cardId: 'test_money', workers: 1 },
      { id: 2, cardId: 'test_threshold', workers: 1 },
    ];
    const delta = projectedDelta(G);
    expect(delta.resources.money).toBe(2); // test_money's production
    expect(delta.resources.science).toBe(5); // test_threshold reacting to the 10-crossing, mid-upkeep
    expect(G.resources.science).toBe(0); // projection is a dry run — real G untouched
    expect(G.events).toEqual([]); // and no events leaked onto the real G
  });
});

describe('resolveHandEvents', () => {
  it('applies an unplayed event left in hand and files it to the discard (so it recurs)', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_food', 'test_event', 'test_prod']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(8); // test_event drained 2
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_event']); // unplayed → discard, not removed
    expect(G.removed).toEqual([]); // only a *played* event is exiled (see moves.playCard)
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod']); // non-events stay for the discard sweep
  });

  it('resolves every event in the hand in one sweep', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_event', 'test_event']);
    resolveHandEvents(G);
    expect(G.resources.military).toBe(6); // 10 - 2 - 2
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_event', 'test_event']);
    expect(G.hand).toEqual([]);
  });

  it('is a no-op when the hand holds no events', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_food', 'test_prod']);
    resolveHandEvents(G);
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod']);
    expect(G.discard).toEqual([]);
  });
});

describe('applyUpkeep with a threat', () => {
  it('resolves a seeded threat as part of the normal upkeep pass', () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'test_event' }];
    applyUpkeep(G);
    expect(G.resources.military).toBe(8); // test_event's own resolver applied its flat -2 loss
  });
});

describe('applyUpkeep with an unplayed event in hand', () => {
  it("fires an unplayed event's upkeep as part of the pass and files it to discard", () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_event']);
    applyUpkeep(G);
    expect(G.resources.military).toBe(8); // the unplayed event's -2 upkeep drain fired during upkeep
    expect(G.discard.map((c) => c.cardId)).toEqual(['test_event']); // filed to discard so it recurs
    expect(G.hand).toEqual([]); // left the hand during the upkeep pass, not the later recycle
  });
});

describe('applyUpkeep production', () => {
  it('resolves staffed buildings and Work cards through their own production', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'test_work', workers: 1 }];
    applyUpkeep(G);
    expect(G.resources.food).toBe(2); // test_food's +2🌾; blankState has 0 population, so none eaten
    expect(G.resources.production).toBe(3); // test_work's +3🔨
  });
});

describe('projectedDelta with events', () => {
  it("folds an event card sitting in hand into the projected military delta", () => {
    const G = blankState('test');
    G.resources.military = 10;
    G.hand = instancesFromCardIds(['test_event']);
    expect(projectedDelta(G).resources.military).toBe(-2);
  });
});

describe('projectedDelta — imminent next-turn reshuffle', () => {
  it('shows a reshuffle-reacting threat drain when the next refill would fold the discard back in', () => {
    // Empty deck + a non-empty discard: the next round-start refill reshuffles immediately, firing the
    // Unrest-style threat. The preview must surface that 💰 drain (the player is about to pay it).
    const G = blankState('test');
    G.resources.population = 3;
    G.deck = [];
    G.discard = instancesFromCardIds(['test_food', 'test_prod']);
    G.threats = [{ id: 1, cardId: 'test_unrest' }];
    expect(projectedDelta(G).resources.money).toBe(-3); // one reshuffle × pop 3
  });

  it('shows no drain when the deck can refill without a reshuffle', () => {
    // Enough deck to refill, empty discard: no reshuffle is imminent, so the threat stays silent.
    const G = blankState('test');
    G.resources.population = 3;
    G.deck = instancesFromCardIds(['test_food', 'test_prod', 'test_sci', 'test_money', 'test_action']);
    G.discard = [];
    G.threats = [{ id: 1, cardId: 'test_unrest' }];
    expect(projectedDelta(G).resources.money).toBe(0);
  });

  it('fires the reshuffle drain but NOT draw-contingent on.draw effects (no hidden-draw leak)', () => {
    // Reshuffle imminent *and* an operating on-draw building: for real, the refill would reshuffle
    // (drain 💰) then draw (gain 🔬). The preview fires only the structural reshuffle — it never draws,
    // so the draw-contingent 🔬 (which would leak the identity of the card about to come up) stays hidden.
    const G = blankState('test');
    G.resources.population = 3;
    G.deck = [];
    G.discard = instancesFromCardIds(['test_food', 'test_prod']);
    G.threats = [{ id: 1, cardId: 'test_unrest' }];
    G.tableau = [{ id: 10, cardId: 'test_ondraw', workers: 0 }];
    const delta = projectedDelta(G);
    expect(delta.resources.money).toBe(-3); // structural reshuffle cost — shown
    expect(delta.resources.science).toBe(0); // draw-contingent on.draw — suppressed
  });
});
