import { describe, it, expect } from 'vitest';
import { CARDS, compareCards } from './cards';

/** The one stable card comparator shared by every listing (deck banner/fans, pile viewers, the
 *  Collection/DeckEditor pickers): group by kind, then alphabetical by name within a kind. */
describe('compareCards', () => {
  const sign = (n: number) => Math.sign(n);

  it('orders by kind: building < work < action < event', () => {
    // farm=building, corvee=work, settlers=action, barbarian=event
    expect(sign(compareCards(CARDS.farm, CARDS.corvee))).toBe(-1);
    expect(sign(compareCards(CARDS.corvee, CARDS.settlers))).toBe(-1);
    expect(sign(compareCards(CARDS.settlers, CARDS.barbarian))).toBe(-1);
  });

  it('sorts alphabetically by name within a kind', () => {
    expect(sign(compareCards(CARDS.farm, CARDS.library))).toBe(-1);
    expect(sign(compareCards(CARDS.library, CARDS.farm))).toBe(1);
  });

  it("ignores a leading 'The ' so 'The Great Library' sorts under G, not T", () => {
    // Without normalization "The Great Library" would trail Library (T > L); with it, G < L.
    expect(sign(compareCards(CARDS.great_library, CARDS.library))).toBe(-1);
  });

  it("only strips the whole word 'The ' — 'Theater' still sorts under T", () => {
    // Guards the regex's `\s+`: a naive /^the/i would strip Theater → "ater" and sort it before Farm.
    expect(sign(compareCards(CARDS.theater, CARDS.farm))).toBe(1);
  });

  it('is a total order (0 only for equal name+kind)', () => {
    expect(compareCards(CARDS.farm, CARDS.farm)).toBe(0);
  });
});
