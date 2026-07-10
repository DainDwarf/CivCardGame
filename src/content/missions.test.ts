import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { CARDS } from './cards';

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
  it('every standard mission reward names a real card id', () => {
    for (const m of Object.values(MISSIONS)) {
      if (m.kind !== 'standard') continue;
      expect(CARDS[m.reward!.unlockCardId], `${m.id} → reward → ${m.reward!.unlockCardId}`).toBeDefined();
    }
  });
});
