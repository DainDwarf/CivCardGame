import { describe, it, expect } from 'vitest';
import { compareCards, type CardDef } from '../content/cards';

// `compareCards` takes `CardDef`s directly — it never looks up `CARDS` — so it's tested on throwaway
// inline defs, not the shared fixtures: the two subtle assertions (the leading-`'The '` strip and the
// `'Theater'` guard) need specific names the fixtures don't carry.
const card = (name: string, kind: CardDef['kind']): CardDef => ({ id: name, name, kind, cost: {} });

describe('compareCards', () => {
  const sign = (n: number) => Math.sign(n);

  it('orders by kind: building < work < action < event', () => {
    expect(sign(compareCards(card('Alpha', 'building'), card('Alpha', 'work')))).toBe(-1);
    expect(sign(compareCards(card('Alpha', 'work'), card('Alpha', 'action')))).toBe(-1);
    expect(sign(compareCards(card('Alpha', 'action'), card('Alpha', 'event')))).toBe(-1);
  });

  it('sorts alphabetically by name within a kind', () => {
    expect(sign(compareCards(card('Apple', 'building'), card('Banana', 'building')))).toBe(-1);
    expect(sign(compareCards(card('Banana', 'building'), card('Apple', 'building')))).toBe(1);
  });

  it("ignores a leading 'The ' so 'The Great Thing' sorts under G, not T", () => {
    // Without normalization "The Great Thing" would trail "Library" (T > L); with it, G < L.
    expect(sign(compareCards(card('The Great Thing', 'building'), card('Library', 'building')))).toBe(-1);
  });

  it("only strips the whole word 'The ' — 'Theater' still sorts under T", () => {
    // Guards the regex's `\s+`: a naive /^the/i would strip Theater → "ater" and sort it before Farm.
    expect(sign(compareCards(card('Theater', 'building'), card('Farm', 'building')))).toBe(1);
  });

  it('is a total order (0 only for equal name+kind)', () => {
    expect(compareCards(card('Farm', 'building'), card('Farm', 'building'))).toBe(0);
  });
});
