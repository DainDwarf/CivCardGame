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

/**
 * The DAG's tips: every `'standard'` mission no *other* standard mission names as a prereq. Infinite
 * missions are excluded from the dependents on purpose — one hangs off the Bronze capstone, so
 * counting them would leave the arc with no tip at all.
 *
 * A list, because the DAG genuinely ends in several branch tips at once: an optional challenge leaf
 * dangles off the trunk with nothing after it, exactly like the trunk's own capstone. Which of them
 * is the *campaign's* end is a separate question — `lastStandardMission`.
 */
export function terminalStandardMissions(missions: Record<string, MissionDef>): MissionDef[] {
  const standard = Object.values(missions).filter((mission) => mission.kind === 'standard');
  const depended = new Set(standard.flatMap((mission) => mission.prereqs));
  return standard.filter((mission) => !depended.has(mission.id));
}

/**
 * Where the campaign ends: the tip sitting furthest along `map.col`, the authored chronology slot.
 * The DAG alone can't answer this — a side leaf is as dependency-free as the trunk's capstone — so
 * the tie-break is the same field `content/ages.ts` derives its age bands from: further right is
 * later in history, and the rightmost tip is the end of the arc.
 *
 * `undefined` only for a catalogue with no standard missions at all.
 */
export function lastStandardMission(missions: Record<string, MissionDef>): MissionDef | undefined {
  return terminalStandardMissions(missions).reduce<MissionDef | undefined>(
    (last, mission) => (!last || (mission.map?.col ?? 0) > (last.map?.col ?? 0) ? mission : last),
    undefined,
  );
}

/**
 * Every mission that must be cleared to reach `targetIds` — their transitive prereqs *plus
 * themselves*, walked backward through the DAG. Throws if a named prereq doesn't exist (the caller
 * decides how to surface that; `scripts/seed-save.ts` and `scripts/economy.ts` turn it into a clean
 * one-line CLI error).
 */
export function prereqClosure(
  missions: Record<string, MissionDef>,
  targetIds: string[],
): Set<string> {
  const closure = new Set<string>();
  const visit = (id: string) => {
    if (closure.has(id)) return;
    closure.add(id);
    const mission = missions[id];
    if (!mission) throw new Error(`mission '${id}' is named as a prereq but doesn't exist — check content/missions.ts.`);
    mission.prereqs.forEach(visit);
  };
  targetIds.forEach(visit);
  return closure;
}

/**
 * The missions in `closure` ordered so every mission's prereqs come before it (a topological sort of
 * the DAG). Ties between two ready branches resolve in catalogue order, so the order is deterministic.
 * Throws on an unsatisfiable prereq set (a cycle). Load-bearing for any consumer that folds rewards
 * forward — `rules/rewards.ts` doesn't validate prereqs, so folding out of order would pay a
 * first-clear reward for a mission the player couldn't have reached yet.
 */
export function foldOrder(
  missions: Record<string, MissionDef>,
  closure: Set<string>,
): MissionDef[] {
  const pending = Object.values(missions).filter((mission) => closure.has(mission.id));
  const cleared: Record<string, true> = {};
  const order: MissionDef[] = [];
  while (pending.length > 0) {
    const i = pending.findIndex((mission) => isAvailable(mission, cleared));
    if (i === -1) throw new Error(`prereqs among [${pending.map((m) => m.id).join(', ')}] can never be satisfied — check content/missions.ts for a cycle.`);
    const [next] = pending.splice(i, 1);
    cleared[next.id] = true;
    order.push(next);
  }
  return order;
}

/**
 * The guaranteed one-time Influence a player has accumulated *arriving at* `missionId` — the sum of
 * `reward.influence` over its transitive prereqs, **excluding the mission itself** (it hasn't been
 * cleared yet, so its own reward isn't in the wallet). Only `'standard'` missions grant a fixed
 * reward; `'infinite'` missions pay per attempt — a separate, variable faucet that contributes
 * nothing to this fixed floor.
 */
export function cumulativeInfluenceInto(
  missions: Record<string, MissionDef>,
  missionId: string,
): number {
  const closure = prereqClosure(missions, [missionId]);
  closure.delete(missionId);
  let total = 0;
  for (const id of closure) {
    const mission = missions[id];
    if (mission.kind === 'standard') total += mission.reward?.influence ?? 0;
  }
  return total;
}
