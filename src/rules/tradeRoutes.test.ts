import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { blankState, instancesFromCardIds } from './state';
import { closeTradeRoute, openTradeRoute } from './tradeRoutes';
import { applyUpkeep } from './upkeep';
import { addBuilding } from './population';
import { mint, installFixtures, uninstallFixtures } from './testFixtures';

/** `test_trade` (`testFixtures.ts`): cost 2🪙, yields +1🌾 and pays −1🪙 every round. */
describe('trade routes', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  it('stands a played route in its own zone, outside the staffed zones', () => {
    const G = blankState('m');
    openTradeRoute(G, mint(G, 'test_trade'));
    expect(G.tradeRoutes).toHaveLength(1);
    expect(G.tradeRoutes[0].cardId).toBe('test_trade');
    expect(G.tableau).toHaveLength(0);
    expect(G.workZone).toHaveLength(0);
  });

  it('mints instance ids that never collide with a card already in a pile', () => {
    const G = blankState('m');
    G.deck = instancesFromCardIds(['test_action', 'test_action'], 1);
    openTradeRoute(G, mint(G, 'test_trade'));
    openTradeRoute(G, mint(G, 'test_trade'));
    addBuilding(G, mint(G, 'test_food'));
    const ids = [...G.deck, ...G.tradeRoutes, ...G.tableau].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries the played copy stickers across onto the standing route', () => {
    const G = blankState('m');
    openTradeRoute(G, mint(G, 'test_trade', ['test_addgain']));
    expect(G.tradeRoutes[0].stickers).toEqual(['test_addgain']);
  });

  it('yields and charges rent every upkeep, unstaffed and unscaled', () => {
    const G = blankState('m');
    G.resources.money = 10;
    G.resources.food = 10;
    openTradeRoute(G, mint(G, 'test_trade'));
    openTradeRoute(G, mint(G, 'test_trade'));

    applyUpkeep(G);
    // Two routes: +2🌾 yield, −2🪙 rent. No population, so nothing eats.
    expect(G.resources.food).toBe(12);
    expect(G.resources.money).toBe(8);

    applyUpkeep(G);
    expect(G.resources.food).toBe(14);
    expect(G.resources.money).toBe(6);
  });

  it('leaves the rent running until the treasury cannot pay it', () => {
    const G = blankState('m');
    G.resources.money = 1;
    openTradeRoute(G, mint(G, 'test_trade'));
    applyUpkeep(G);
    expect(G.resources.money).toBe(0);
    // No upkeep path takes a route off the board, so the next round runs the treasury negative —
    // collapse territory.
    applyUpkeep(G);
    expect(G.resources.money).toBe(-1);
    expect(G.tradeRoutes).toHaveLength(1);
  });

  describe('closeTradeRoute', () => {
    it('lifts the named route off the board and files it to the discard', () => {
      const G = blankState('m');
      openTradeRoute(G, mint(G, 'test_trade'));
      const doomed = G.tradeRoutes[0];
      openTradeRoute(G, mint(G, 'test_trade'));
      const spared = G.tradeRoutes[1];

      closeTradeRoute(G, doomed.id);
      expect(G.tradeRoutes.map((r) => r.id)).toEqual([spared.id]);
      expect(G.discard.map((c) => c.id)).toEqual([doomed.id]);
    });

    it('stops charging rent the round after it is cut', () => {
      const G = blankState('m');
      G.resources.money = 10;
      G.resources.food = 10;
      openTradeRoute(G, mint(G, 'test_trade'));
      closeTradeRoute(G, G.tradeRoutes[0].id);
      applyUpkeep(G);
      expect(G.resources.money).toBe(10);
      expect(G.resources.food).toBe(10);
    });

    it('files the card with its stickers and counters, minus the staffing field', () => {
      const G = blankState('m');
      openTradeRoute(G, mint(G, 'test_trade', ['test_addgain']));
      G.tradeRoutes[0].counters = { plays: 2 };

      closeTradeRoute(G, G.tradeRoutes[0].id);
      expect(G.discard[0].stickers).toEqual(['test_addgain']);
      expect(G.discard[0].counters).toEqual({ plays: 2 });
      expect('workers' in G.discard[0]).toBe(false);
    });

    it('announces the cut as a discard for the next flush to dispatch', () => {
      const G = blankState('m');
      openTradeRoute(G, mint(G, 'test_trade'));
      const id = G.tradeRoutes[0].id;

      closeTradeRoute(G, id);
      expect(G.events).toEqual([{ type: 'discard', instanceId: id, cardId: 'test_trade', reason: 'routeClosed' }]);
    });

    it('does nothing for an id the zone does not hold', () => {
      const G = blankState('m');
      openTradeRoute(G, mint(G, 'test_trade'));
      closeTradeRoute(G, 9999);
      expect(G.tradeRoutes).toHaveLength(1);
      expect(G.discard).toHaveLength(0);
      expect(G.events).toHaveLength(0);
    });
  });
});
