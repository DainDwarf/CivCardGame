import { describe, it, expect } from 'vitest';
import { CARDS, COPPER_VEINS, isDeckable, isStaffable, RAIDER_WAVES } from './cards';
import { STARTING_COLLECTION } from './collection';
import { DEFAULT_DECKS } from './decks';
import { blankState, dispatchEvent, objectiveMet, seedObjective } from '../rules';

// Internal coherence of the CARDS catalogue (mirrors `boards.test.ts`'s id-check), plus the
// cross-catalogue invariant that everything a player can *own* or *deck* is actually a deckable
// card (no mission-only event/threat/objective sneaking into the collection or a seed deck).

describe('CARDS', () => {
  it("each entry's id matches its registry key", () => {
    for (const [key, card] of Object.entries(CARDS)) {
      expect(card.id, key).toBe(key);
    }
  });

  it('every card the starting collection owns is deckable', () => {
    for (const cardId of Object.keys(STARTING_COLLECTION)) {
      const card = CARDS[cardId];
      expect(card, `STARTING_COLLECTION → ${cardId}`).toBeDefined();
      expect(isDeckable(card), `${cardId} is not deckable`).toBe(true);
    }
  });

  // Every deckable card must carry its own face glyph — the colocation the `art` field buys is only
  // real if a new deckable card can't ship without one and silently fall back to the generic default.
  // Mission-only kinds (event/threat/objective) may lean on the per-kind fallback, so they're exempt.
  it('every deckable card sets its own art glyph', () => {
    for (const card of Object.values(CARDS)) {
      if (isDeckable(card)) expect(card.display?.art, `${card.id} has no art`).toBeTruthy();
    }
  });

  it('every card in every default deck is deckable', () => {
    for (const deck of DEFAULT_DECKS) {
      for (const cardId of deck.cards) {
        expect(isDeckable(CARDS[cardId]), `${deck.id} → ${cardId} is not deckable`).toBe(true);
      }
    }
  });

  // No default for `workers`: a staffable card (building/wonder/work) missing it would throw at the
  // first staffing read (`population.ts`'s `cardWorkerCap`), so pin the whole catalogue at test time
  // rather than discover a forgotten field mid-run.
  it('every staffable card declares its workers capacity', () => {
    for (const card of Object.values(CARDS)) {
      if (isStaffable(card)) expect(card.workers, `${card.id} has no workers`).not.toBeUndefined();
    }
  });

  // The "Raiders at the Border" win: playing a raider event banishes it to `removed` (the only
  // path a raider reaches that pile), so the objective is met exactly once RAIDER_WAVES of them sit
  // there — verified through the goal-derived `objectiveMet`, the one check that pins the win
  // end-to-end without a playthrough.
  it('raiders_at_border_goal is met at RAIDER_WAVES raiders in removed, not one short', () => {
    const withRaiders = (n: number) => {
      const G = blankState('raiders_at_border');
      seedObjective(G, 'raiders_at_border_goal');
      G.removed = Array.from({ length: n }, (_, i) => ({ id: i + 1, cardId: 'raider' }));
      return objectiveMet(G);
    };
    expect(withRaiders(RAIDER_WAVES - 1)).toBe(false);
    expect(withRaiders(RAIDER_WAVES)).toBe(true);
    expect(withRaiders(RAIDER_WAVES + 1)).toBe(true);
  });

  // The "Finding Copper" win, same shape as the raiders one above: mining a vein is playing it, which
  // banishes it to `removed` (the only path a vein reaches that pile).
  it('finding_copper_goal is met at COPPER_VEINS veins in removed, not one short', () => {
    const withVeins = (n: number) => {
      const G = blankState('finding_copper');
      seedObjective(G, 'finding_copper_goal');
      G.removed = Array.from({ length: n }, (_, i) => ({ id: i + 1, cardId: 'copper_vein' }));
      return objectiveMet(G);
    };
    expect(withVeins(COPPER_VEINS - 1)).toBe(false);
    expect(withVeins(COPPER_VEINS)).toBe(true);
    expect(withVeins(COPPER_VEINS + 1)).toBe(true);
  });
});

// Failing Stone Tools drains 🔨 per worker staffed *in a building* — the buildings-only rule is the
// whole identity of the threat, so it's pinned here against the real catalogue rather than a fixture.
// Each case ticks the threat via the `endTurn` broadcast, the same path a real round uses. The staffed
// cards are chosen to produce anything *but* production (Farm → 🌾, Burial → 🎭, Foraging → 🌾), so the
// asserted 🔨 delta is the drain alone and not a producer's output netted against it.
describe('failing_stone_tools', () => {
  const tick = (G: ReturnType<typeof blankState>) => {
    G.resources.production = 10;
    G.threats = [{ id: 99, cardId: 'failing_stone_tools' }];
    dispatchEvent(G, { type: 'endTurn' });
    return G.resources.production;
  };

  it('drains 1 🔨 per worker staffed in a building', () => {
    const G = blankState('finding_copper');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'burial', workers: 1 },
    ];
    expect(tick(G)).toBe(8);
  });

  it('exempts work cards — a works-only board pays nothing', () => {
    const G = blankState('finding_copper');
    G.workZone = [
      { id: 1, cardId: 'foraging', workers: 1 },
      { id: 2, cardId: 'foraging', workers: 1 },
    ];
    expect(tick(G)).toBe(10);
  });

  it('ignores a self-sufficient building — Hut staffs nobody, so it wears nothing', () => {
    const G = blankState('finding_copper');
    G.tableau = [{ id: 1, cardId: 'hut', workers: 0 }];
    expect(tick(G)).toBe(10);
  });

  it('drains nothing with an empty board', () => {
    expect(tick(blankState('finding_copper'))).toBe(10);
  });
});
