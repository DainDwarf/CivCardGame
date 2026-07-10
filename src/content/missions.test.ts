import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { CARDS } from './cards';
import { AGES, ageColSpans } from './ages';

// The mission *spine* mechanism (seedMissionCards, objectiveMet/defeatMet, the bus-driven win/loss
// flags) is asserted on synthetic fixtures in `rules/missionSpine.test.ts` (relocated in Step 2.2).
// What's left here are the content↔catalogue **coherence iterators**: every mission must name real
// cards of the right kind. `MISSIONS` was emptied in Step 2.4, so these pass vacuously today and
// re-arm once Step 3 authors the real missions. EARMARKED FOR REWRITE alongside the mission content.

describe('mission catalogue coherence', () => {
  it('every mission names a real objective card that owns its win logic', () => {
    for (const m of Object.values(MISSIONS)) {
      const card = CARDS[m.objectiveCardId];
      expect(card, `${m.id} → ${m.objectiveCardId}`).toBeDefined();
      expect(card.kind).toBe('objective');
      expect(typeof card.objective).toBe('function');
    }
  });

  it('every declared threats/events id names a real threat/event card', () => {
    for (const m of Object.values(MISSIONS)) {
      for (const cardId of m.threats ?? []) {
        const card = CARDS[cardId];
        expect(card, `${m.id} → threats → ${cardId}`).toBeDefined();
        expect(card.kind).toBe('threat');
      }
      for (const cardId of m.events ?? []) {
        const card = CARDS[cardId];
        expect(card, `${m.id} → events → ${cardId}`).toBeDefined();
        expect(card.kind).toBe('event');
      }
    }
  });

  // Relocated from `rewards.test.ts` (Step 2.4): it's a mission↔card coherence check, not a reward
  // mechanism test, so it lives with the other mission coherence iterators.
  it('every standard mission reward names at least one real card id', () => {
    for (const m of Object.values(MISSIONS)) {
      if (m.kind !== 'standard') continue;
      expect(m.reward!.unlockCardIds.length, `${m.id} → reward has no unlock cards`).toBeGreaterThan(0);
      for (const cardId of m.reward!.unlockCardIds) {
        expect(CARDS[cardId], `${m.id} → reward → ${cardId}`).toBeDefined();
      }
    }
  });

  // Each age covers a slice of the DAG (`ages.ts`'s `ageColSpans`), so a standard mission must be
  // placed (`map`) and tagged with a real age; and ages must not interleave across columns — the
  // derived slices must tile the timeline gap-free and non-overlapping. Vacuous today (no standard
  // missions), re-arms with the Step 6 arc.
  it('every standard mission has a map and a valid age', () => {
    const ageIds = new Set(AGES.map((a) => a.id));
    for (const m of Object.values(MISSIONS)) {
      if (m.kind !== 'standard') continue;
      expect(m.map, `${m.id} → map`).toBeDefined();
      expect(m.age, `${m.id} → age`).toBeDefined();
      expect(ageIds.has(m.age!), `${m.id} → age → ${m.age}`).toBe(true);
    }
  });

  it('age slices tile the DAG gap-free and non-overlapping', () => {
    const spans = ageColSpans(Object.values(MISSIONS));
    spans.forEach((s, i) => {
      expect(s.startCol, `${s.age.id} slice must be non-empty`).toBeLessThan(s.endCol);
      if (i > 0) {
        expect(s.startCol, `${s.age.id} slice must start where ${spans[i - 1].age.id}'s ends`).toBe(
          spans[i - 1].endCol,
        );
      }
    });
  });

  // The derivation tiles by construction, so contiguity alone can't catch *interleaving* — an age
  // whose mission sits past the next age's first column. This is the guard that actually pins the
  // "ages don't interleave" invariant: every standard mission's column must fall inside its own
  // age's derived slice (so its node sits under its own band, not a neighbour's).
  it('every standard mission sits inside its own age slice', () => {
    const spans = ageColSpans(Object.values(MISSIONS));
    const byAge = new Map(spans.map((s) => [s.age.id, s]));
    for (const m of Object.values(MISSIONS)) {
      if (m.kind !== 'standard') continue;
      const s = byAge.get(m.age!);
      expect(s, `${m.id} → age ${m.age} has no slice`).toBeDefined();
      expect(m.map!.col, `${m.id} col ${m.map!.col} in ${m.age} slice [${s!.startCol},${s!.endCol})`).toBeGreaterThanOrEqual(s!.startCol);
      expect(m.map!.col, `${m.id} col ${m.map!.col} in ${m.age} slice [${s!.startCol},${s!.endCol})`).toBeLessThan(s!.endCol);
    }
  });
});
