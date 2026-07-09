import type { MissionDef } from '../content/missions';

/**
 * Prereq gating over the campaign map's DAG (docs/DESIGN.md, "Campaign map"). A mission
 * stays available once unlocked — completing it doesn't hide it again, so the player can
 * replay it (e.g. for a better run, or because an `'infinite'` mission has no fixed end).
 */

/** Whether `missionId` has been cleared at least once. */
export function isCompleted(mapProgress: Record<string, true>, missionId: string): boolean {
  return mapProgress[missionId] === true;
}

/** Whether every one of `mission`'s prereqs has been completed (a root with no prereqs always is). */
export function isAvailable(mission: MissionDef, mapProgress: Record<string, true>): boolean {
  return mission.prereqs.every((id) => isCompleted(mapProgress, id));
}

/** All missions in `missions` whose prereqs are satisfied, completed or not. */
export function availableMissions(
  missions: Record<string, MissionDef>,
  mapProgress: Record<string, true>,
): MissionDef[] {
  return Object.values(missions).filter((mission) => isAvailable(mission, mapProgress));
}

/**
 * The campaign-progress fraction the Stats screen shows: how many `'standard'` missions have been
 * cleared, out of how many exist. Only standard missions have a fixed clear state — an `'infinite'`
 * mission never touches `mapProgress` (`rules/rewards.ts`) — so both counts are over the standard set.
 */
export function standardMissionProgress(
  missions: Record<string, MissionDef>,
  mapProgress: Record<string, true>,
): { cleared: number; total: number } {
  const standard = Object.values(missions).filter((mission) => mission.kind === 'standard');
  return {
    cleared: standard.filter((mission) => isCompleted(mapProgress, mission.id)).length,
    total: standard.length,
  };
}
