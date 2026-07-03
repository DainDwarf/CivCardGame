import { describe, it, expect } from 'vitest';
import { unplayableReason } from './playability';
import { blankState } from './state';
import type { CardDef } from '../content/cards';

const baseCard: CardDef = { id: 'test', name: 'Test', kind: 'recurring', cost: {} };

describe('unplayableReason', () => {
  it('is playable when every gate passes', () => {
    const G = blankState('enlightenment');
    expect(unplayableReason(G, baseCard)).toBeNull();
  });

  it('reports the resources still missing when unaffordable', () => {
    const G = blankState('enlightenment');
    G.resources.food = 1;
    const card: CardDef = { ...baseCard, cost: { food: 3, production: 2 } };
    expect(unplayableReason(G, card)).toEqual({
      kind: 'cost',
      missing: { food: 2, production: 2 },
    });
  });

  it('gates on culture level requirement', () => {
    const G = blankState('enlightenment');
    G.culture = 0; // level 0
    const card: CardDef = { ...baseCard, cultureLevelReq: 1 };
    expect(unplayableReason(G, card)).toEqual({ kind: 'cultureLevel', required: 1 });
  });

  it('gates a building card on free territory', () => {
    const G = blankState('enlightenment');
    G.territory = 1;
    G.population = 1;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }]; // territory full
    const card: CardDef = { ...baseCard, kind: 'building', id: 'granary' };
    expect(unplayableReason(G, card)).toEqual({ kind: 'territory' });
  });

  it('gates a destroy card on there being a building to demolish', () => {
    const G = blankState('enlightenment');
    const card: CardDef = { ...baseCard, effect: { destroy: true } };
    expect(unplayableReason(G, card)).toEqual({ kind: 'noBuildingsToDestroy' });
  });

  it('never lets an event card be played — it auto-resolves at end of turn instead', () => {
    const G = blankState('barbarian_tide');
    // Affordable and otherwise unconstrained, but the event gate takes precedence.
    const card: CardDef = { ...baseCard, kind: 'event' };
    expect(unplayableReason(G, card)).toEqual({ kind: 'event' });
  });

  it('checks gates in priority order (cost before culture level)', () => {
    const G = blankState('enlightenment');
    const card: CardDef = { ...baseCard, cost: { food: 5 }, cultureLevelReq: 1 };
    expect(unplayableReason(G, card)).toEqual({ kind: 'cost', missing: { food: 5 } });
  });
});
