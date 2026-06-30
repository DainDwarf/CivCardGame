import { addResources, type Resources } from './resources';
import { tableauProduction, tableauCultureOutput } from './production';
import { foodUpkeep } from './population';
import type { GameState } from './state';

export type MissionUpkeep = (G: GameState) => void;

/**
 * Resolve the resource side of end-of-round upkeep: operating (staffed) buildings
 * produce, the mission ticks, then the population eats food. Single source of truth
 * shared by the run loop's `onEnd` and the UI projection below, so they never drift.
 */
export function applyUpkeep(G: GameState, missionUpkeep?: MissionUpkeep): void {
  addResources(G.resources, tableauProduction(G.tableau));
  addResources(G.resources, G.reservedGains);
  G.culture += tableauCultureOutput(G.tableau);
  missionUpkeep?.(G);
  G.resources.food -= foodUpkeep(G);
}

/** The net change the player would see if they ended the round right now. */
export function projectedDelta(G: GameState, missionUpkeep?: MissionUpkeep): Resources & { culture: number } {
  const clone = structuredClone(G);
  applyUpkeep(clone, missionUpkeep);
  return {
    food: clone.resources.food - G.resources.food,
    production: clone.resources.production - G.resources.production,
    science: clone.resources.science - G.resources.science,
    military: clone.resources.military - G.resources.military,
    money: clone.resources.money - G.resources.money,
    culture: clone.culture - G.culture,
  };
}
