import { grantCopies, isOwned, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

/** What a completed run actually pays out: Influence, (each, if not already owned) the mission's
 *  card unlock(s), and the unlocked-sticker sets grown by any card/board-sticker unlocks. The two
 *  sticker sets flow *through* `computeRewards` (in unchanged, out with the mission's unlocks unioned)
 *  the same way `collection` does — the caller folds each back into `PlayerStore`. */
export interface RewardOutcome {
  influence: number;
  collection: OwnedCards;
  unlockedStickers: Record<string, true>;
  unlockedBoardStickers: Record<string, true>;
}

/**
 * A `'standard'` mission's reward is a one-time first-clear bonus (docs/DESIGN.md, "Economy
 * & progression") — replaying an already-completed mission pays nothing. `alreadyCompleted`
 * must reflect `mapProgress` *before* this run's result is folded in, or every clear would
 * look like a first clear. A mission may unlock several cards at once (`unlockCardIds`); each is
 * granted independently, and one already owned (e.g. a later mission reusing the same card) is a
 * no-op rather than double-granting a copy. It may likewise unlock card/board stickers
 * (`unlockStickerIds`/`unlockBoardStickerIds`) — an id set-union, idempotent (membership is the
 * whole state, so re-unlocking is harmless).
 *
 * The two unlocked-sticker sets pass *through*: they enter as the player's current sets and leave
 * with this mission's unlocks unioned in — so the caller folds one returned value back, exactly like
 * `collection`. Every non-granting exit (infinite, already-completed, no reward) returns them
 * unchanged, never dropping them.
 *
 * An `'infinite'` mission (Step 6) has no fixed win state and never touches `mapProgress`
 * (see `App.tsx`'s `recordResult`), so its payout is unconditional instead: Influence equal
 * to `turnsTaken` (rounds survived), paid on *every* attempt regardless of `alreadyCompleted`
 * or whether the run's outcome reads as victory or defeat — there is no unlock to grant.
 */
export function computeRewards(
  mission: MissionDef,
  alreadyCompleted: boolean,
  collection: OwnedCards,
  unlockedStickers: Record<string, true>,
  unlockedBoardStickers: Record<string, true>,
  turnsTaken?: number,
): RewardOutcome {
  const passthrough = { collection, unlockedStickers, unlockedBoardStickers };
  if (mission.kind === 'infinite') return { influence: turnsTaken ?? 0, ...passthrough };
  if (alreadyCompleted || !mission.reward) return { influence: 0, ...passthrough };
  const { influence, unlockCardIds, unlockStickerIds, unlockBoardStickerIds } = mission.reward;
  // Grant every not-yet-owned unlock (a mission may open several cards at once). Already-owned
  // ones are skipped rather than double-granted, exactly as the single-unlock path did.
  const nextCollection = (unlockCardIds ?? []).reduce(
    (coll, cardId) => (isOwned(coll, cardId) ? coll : grantCopies(coll, cardId, 1)),
    collection,
  );
  const unionIds = (set: Record<string, true>, ids: string[] | undefined) =>
    (ids ?? []).reduce((acc, id) => ({ ...acc, [id]: true as const }), set);
  return {
    influence,
    collection: nextCollection,
    unlockedStickers: unionIds(unlockedStickers, unlockStickerIds),
    unlockedBoardStickers: unionIds(unlockedBoardStickers, unlockBoardStickerIds),
  };
}
