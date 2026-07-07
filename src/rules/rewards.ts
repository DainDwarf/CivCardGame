import { grantCopies, isOwned, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

/** What a completed run actually pays out: Influence plus (if not already owned) the
 *  mission's card unlock. */
export interface RewardOutcome {
  influence: number;
  collection: OwnedCards;
}

/**
 * A `'standard'` mission's reward is a one-time first-clear bonus (docs/DESIGN.md, "Economy
 * & progression") — replaying an already-completed mission pays nothing. `alreadyCompleted`
 * must reflect `mapProgress` *before* this run's result is folded in, or every clear would
 * look like a first clear. Owning the unlock card already (e.g. a future mission reusing
 * the same card) is a no-op rather than double-granting a copy.
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
  const { influence, unlockCardId } = mission.reward;
  const nextCollection = isOwned(collection, unlockCardId) ? collection : grantCopies(collection, unlockCardId, 1);
  return { influence, collection: nextCollection };
}
