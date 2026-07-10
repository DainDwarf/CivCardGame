import { describe, it, expect } from 'vitest';
import { AGES, ageColSpans } from './ages';
import type { MissionDef } from './missions';

// A minimal standard mission placed at a column in an age — the fields `ageColSpans` reads
// (`kind`/`map`/`age`) are what matter; the rest are filled to satisfy the type.
function mk(id: string, age: string, col: number): MissionDef {
  return {
    id,
    name: id,
    lore: '',
    prereqs: [],
    objectiveCardId: 'x',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    map: { col, row: 0 },
    age,
  };
}

describe('ageColSpans', () => {
  it('returns [] when no standard mission is placed (the dormant state today)', () => {
    expect(ageColSpans([])).toEqual([]);
    // Infinite missions never contribute a slice even though they exist.
    const infinite: MissionDef = {
      id: 'sandbox',
      name: 'sandbox',
      lore: '',
      prereqs: [],
      objectiveCardId: 'x',
      victoryHint: '',
      failureHint: null,
      kind: 'infinite',
    };
    expect(ageColSpans([infinite])).toEqual([]);
  });

  it('ignores standard missions missing a map or an age', () => {
    const noMap = { ...mk('a', 'neolithic', 0), map: undefined };
    const noAge = { ...mk('b', 'neolithic', 1), age: undefined };
    expect(ageColSpans([noMap, noAge])).toEqual([]);
  });

  it('gives a single age one slice spanning from column 0 past its furthest mission', () => {
    // minCol is 2, but the sole (first) age fills from the timeline start.
    const spans = ageColSpans([mk('a', 'neolithic', 2), mk('b', 'neolithic', 4)]);
    expect(spans).toEqual([{ age: AGES[0], startCol: 0, endCol: 5 }]);
  });

  it('tiles present ages contiguously in AGES order, absorbing gaps between them', () => {
    // Deliberately out of input order; neolithic 0-1, bronze 3-4 (gap at col 2), iron 6.
    const spans = ageColSpans([
      mk('iron1', 'iron', 6),
      mk('neo0', 'neolithic', 0),
      mk('bronze4', 'bronze', 4),
      mk('neo1', 'neolithic', 1),
      mk('bronze3', 'bronze', 3),
    ]);
    expect(spans.map((s) => s.age.id)).toEqual(['neolithic', 'bronze', 'iron']);
    expect(spans).toEqual([
      { age: AGES[0], startCol: 0, endCol: 3 }, // neolithic → up to bronze's first column
      { age: AGES[1], startCol: 3, endCol: 6 }, // bronze → up to iron's first column
      { age: AGES[2], startCol: 6, endCol: 7 }, // iron → one past the furthest mission
    ]);
  });

  it('produces gap-free, non-overlapping, monotonic slices', () => {
    const spans = ageColSpans([
      mk('a', 'neolithic', 0),
      mk('b', 'bronze', 2),
      mk('c', 'iron', 5),
    ]);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].startCol).toBe(spans[i - 1].endCol); // contiguous, no gap/overlap
      expect(spans[i].startCol).toBeLessThan(spans[i].endCol); // non-empty
    }
    expect(spans[0].startCol).toBe(0);
  });
});
