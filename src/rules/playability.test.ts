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
    G.resources.culture = 0; // level 0
    const card: CardDef = { ...baseCard, gate: { cultureLevelReq: 1 } };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'cultureLevel', required: 1 });
  });

  it('gates a building card on free territory', () => {
    const G = blankState('test');
    G.resources.territory = 1;
    G.resources.population = 1;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }]; // territory full
    const card: CardDef = { ...baseCard, kind: 'building', id: 'test_food' };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'territory' });
  });

  it("returns a card's bespoke gate.check reason (e.g. a recover card needs a non-empty discard)", () => {
    const G = blankState('test');
    const card: CardDef = {
      ...baseCard,
      gate: { check: (G) => (G.discard.length === 0 ? { kind: 'discardEmpty' } : null) },
    };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'discardEmpty' });
  });

  it('composes gate.check with the declarative gates, running check after them', () => {
    // A card declaring both a cultureLevelReq and a check: the declarative gate is checked first, and
    // the check only runs (and can block) once every declarative gate has passed.
    const card: CardDef = {
      ...baseCard,
      gate: {
        cultureLevelReq: 1,
        check: (G) => (G.discard.length === 0 ? { kind: 'discardEmpty' } : null),
      },
    };
    const belowCulture = blankState('test'); // culture 0 → declarative gate blocks, check not reached
    expect(unplayableReason(belowCulture, card, self)).toEqual({ kind: 'cultureLevel', required: 1 });

    const cultureMet = blankState('test');
    cultureMet.resources.culture = 10; // level 1 → declarative passes, so the empty-discard check runs
    expect(unplayableReason(cultureMet, card, self)).toEqual({ kind: 'discardEmpty' });

    cultureMet.discard = [{ id: 1, cardId: 'test' }]; // now both gates pass
    expect(unplayableReason(cultureMet, card, self)).toBeNull();
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
    const card: CardDef = { ...baseCard, cost: { food: 5 }, gate: { cultureLevelReq: 1 } };
    expect(unplayableReason(G, card, self)).toEqual({ kind: 'cost', missing: { food: 5 } });
  });

  it("a cost-cutting sticker discounts this copy's cost by 1 per resource, floored at 0", () => {
    const G = blankState('test');
    G.resources.food = 2;
    const card: CardDef = { ...baseCard, cost: { food: 2, production: 1 } };
    const stickered: CardInstance = { id: 2, cardId: 'test', stickers: ['test_costcut'] };
    // Raw cost would need 1 production too; test_costcut knocks both down by 1 (production floors at 0).
    expect(unplayableReason(G, card, stickered)).toBeNull();
  });
});
