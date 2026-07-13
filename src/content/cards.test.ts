import { describe, it, expect } from 'vitest';
import { CARDS, isDeckable, RAIDER_WAVES } from './cards';
import { STARTING_COLLECTION } from './collection';
import { DEFAULT_DECKS } from './decks';
import { blankState } from '../rules';

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

  // The `effect`/`upkeep` timing split, pinned both ways so the WHEN separation stays airtight:
  //  - `effect` is the on-play slot; `event`/`threat` are never played resolved (playing an event
  //    banishes it unresolved, a threat is never played), so an `effect` on either would silently never
  //    fire — their recurring behaviour belongs in `upkeep`.
  //  - `upkeep` is the hazard-only counterpart to `produces`; on any other kind `resolveEndTurn` never
  //    reads it (a staffable routes to `resolveProduction`), so it would be silently ignored at runtime
  //    yet still rendered on the face — a trap the reverse check forecloses.
  it('effect and upkeep stay on their own kinds (event/threat use upkeep, never effect)', () => {
    for (const card of Object.values(CARDS)) {
      const isHazard = card.kind === 'event' || card.kind === 'threat';
      if (isHazard) {
        expect(card.effect, `${card.id} (${card.kind}) must use upkeep, not effect`).toBeUndefined();
      } else {
        expect(card.upkeep, `${card.id} (${card.kind}) must not use upkeep`).toBeUndefined();
      }
    }
  });

  // The "Raiders at the Border" (6.4) win: playing a raider event banishes it to `removed` (the only
  // path a raider reaches that pile), so the objective is met exactly once RAIDER_WAVES of them sit
  // there — verified at the predicate, the one check that pins the win end-to-end without a playthrough.
  it('raiders_at_border_goal is met at RAIDER_WAVES raiders in removed, not one short', () => {
    const obj = CARDS.raiders_at_border_goal.objective!;
    const self = { id: 99, cardId: 'raiders_at_border_goal' };
    const withRaiders = (n: number) => {
      const G = blankState('raiders_at_border');
      G.removed = Array.from({ length: n }, (_, i) => ({ id: i + 1, cardId: 'raider' }));
      return obj(G, self);
    };
    expect(withRaiders(RAIDER_WAVES - 1)).toBe(false);
    expect(withRaiders(RAIDER_WAVES)).toBe(true);
    expect(withRaiders(RAIDER_WAVES + 1)).toBe(true);
  });
});
