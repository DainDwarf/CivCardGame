import { MISSIONS } from './missions';
import { STARTING_COLLECTION } from './collection';

/**
 * A card's historical age (`content/ages.ts`'s `AGES`), derived from the campaign instead of annotated
 * on every `CardDef`: a card a mission unlocks (`MissionDef.reward.unlockCardIds`) belongs to that
 * mission's age, and one a fresh player already holds (`STARTING_COLLECTION`) is Stone. One source of
 * truth — move a card to a different unlocking mission and it re-prices itself — and a later age needs
 * no schema change, only its missions.
 *
 * Read by `rules/shop.ts`'s `copyPrice`: what a copy costs is an age band, not a rung.
 */

/** `cardId`'s age, or `undefined` where the campaign never hands the card out — a board's `prebuilt`,
 *  a mission-injected event/threat/objective, an unknown id. `content/cards.test.ts` pins that every
 *  *buyable* card resolves, so an unpriceable one fails there rather than silently losing its shop.
 *
 *  Walks the live `MISSIONS` per call rather than folding a map once at import, the way every other
 *  catalogue read works — `rules/testFixtures.ts` splices synthetic entries into these maps for a
 *  suite's duration, and a snapshot taken at module load would never see them. */
export function cardAge(cardId: string): string | undefined {
  if (STARTING_COLLECTION[cardId] !== undefined) return 'stone';
  for (const mission of Object.values(MISSIONS)) {
    if (mission.age !== undefined && mission.reward?.unlockCardIds?.includes(cardId)) return mission.age;
  }
  return undefined;
}
