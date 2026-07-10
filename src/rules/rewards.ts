import { grantCopies, isOwned, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

/** What a completed run actually pays out: Influence plus (each, if not already owned) the
 *  mission's card unlock(s). */
export interface RewardOutcome {
  influence: number;
  collection: OwnedCards;
}

/**
 * A `'standard'` mission's reward is a one-time first-clear bonus (docs/DESIGN.md, "Economy
 * & progression") — replaying an already-completed mission pays nothing. `alreadyCompleted`
 * must reflect `mapProgress` *before* this run's result is folded in, or every clear would
 * look like a first clear. A mission may unlock several cards at once (`unlockCardIds`); each is
 * granted independently, and one already owned (e.g. a later mission reusing the same card) is a
 * no-op rather than double-granting a copy.
 *
 * An `'infinite'` mission (Step 6) has no fixed win state and never touches `mapProgress`
 * (see `App.tsx`'s `recordResult`), so its payout is unconditional instead: Influence equal
 * to `turnsTaken` (rounds survived), paid on *every* attempt regardless of `alreadyCompleted`
 * or whether the run's outcome reads as victory or defeat — there is no unlock card to grant.
 */
export function computeRewards(
  mission: MissionDef,
  alreadyCompleted: boolean,
  collection: OwnedCards,
  turnsTaken?: number,
): RewardOutcome {
  if (mission.kind === 'infinite') return { influence: turnsTaken ?? 0, collection };
  if (alreadyCompleted || !mission.reward) return { influence: 0, collection };
  const { influence, unlockCardIds } = mission.reward;
  // Grant every not-yet-owned unlock (a mission may open several cards at once). Already-owned
  // ones are skipped rather than double-granted, exactly as the single-unlock path did.
  const nextCollection = unlockCardIds.reduce(
    (coll, cardId) => (isOwned(coll, cardId) ? coll : grantCopies(coll, cardId, 1)),
    collection,
  );
  return { influence, collection: nextCollection };
}
