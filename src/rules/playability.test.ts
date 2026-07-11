import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unplayableReason } from './playability';
import { blankState } from './state';
import type { CardInstance } from './state';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures } from './testFixtures';

// Every gate here is exercised against a locally-built `CardDef`/`CardInstance` — `unplayableReason`
// is only ever handed the card object directly, never a CARDS[id] lookup — so the shipped catalogue
// doesn't matter for most of these. The one real catalogue dependency is the sticker test: a sticker
// id is looked up live via `effectiveCost`, so it needs a fixture sticker installed.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

const baseCard: CardDef = { id: 'test', name: 'Test', kind: 'action', cost: {} };
const self: CardInstance = { id: 1, cardId: 'test' };

describe('unplayableReason', () => {
  it('is playable when every gate passes', () => {
    const G = blankState('test');
    expect(unplayableReason(G, baseCard, self)).toBeNull();
  });

  it('reports the resources still missing when unaffordable', () => {
    const G = blankState('test');
    G.resources.food = 1;
    const card: CardDef = { ...baseCard, cost: { food: 3, production: 2 } };
    expect(unplayableReason(G, card, self)).toEqual({
      kind: 'cost',
      missing: { food: 2, production: 2 },
    });
  });

  it('gates on culture level requirement', () => {
    const G = blankState('test');
    G.culture = 0; // level 0
    const card: CardDef = { ...baseCard, cultureLevelReq: 1 };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'cultureLevel', required: 1 });
  });

  it('gates a building card on free territory', () => {
    const G = blankState('test');
    G.territory = 1;
    G.population = 1;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }]; // territory full
    const card: CardDef = { ...baseCard, kind: 'building', id: 'test_food' };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'territory' });
  });

  it('gates a destroy card on there being a building to demolish', () => {
    const G = blankState('test');
    const card: CardDef = { ...baseCard, effect: { destroy: true } };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'noBuildingsToDestroy' });
  });

  it('gates a peek card (revealsFromDeck) when both draw and discard piles are empty', () => {
    const G = blankState('test');
    G.deck = [];
    G.discard = [];
    const card: CardDef = { ...baseCard, revealsFromDeck: 3 };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'emptyDrawPile' });
  });

  it('leaves a peek card playable while any card remains in either pile', () => {
    const G = blankState('test');
    G.deck = [];
    G.discard = [{ id: 1, cardId: 'test_food' }]; // one card left to reshuffle in and reveal
    const card: CardDef = { ...baseCard, revealsFromDeck: 3 };
    expect(unplayableReason(G, card, self)).toBeNull();
  });

  it('lets an affordable event card be played — playing it is how you banish it', () => {
    const G = blankState('test');
    // Events are now player-playable (paying the cost defuses them); an affordable, otherwise
    // unconstrained event has no gate. Unaffordable ones fall to the normal `cost` reason.
    const card: CardDef = { ...baseCard, kind: 'event' };
    expect(unplayableReason(G, card, self)).toBeNull();
  });

  it('checks gates in priority order (cost before culture level)', () => {
    const G = blankState('test');
    const card: CardDef = { ...baseCard, cost: { food: 5 }, cultureLevelReq: 1 };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'cost', missing: { food: 5 } });
  });

  it("a cost-cutting sticker discounts this copy's cost by 1 per resource, floored at 0", () => {
    const G = blankState('test');
    G.resources = { food: 2, production: 0, science: 0, military: 0, money: 0 };
    const card: CardDef = { ...baseCard, cost: { food: 2, production: 1 } };
    const stickered: CardInstance = { id: 2, cardId: 'test', stickers: ['test_costcut'] };
    // Raw cost would need 1 production too; test_costcut knocks both down by 1 (production floors at 0).
    expect(unplayableReason(G, card, stickered)).toBeNull();
  });
});
