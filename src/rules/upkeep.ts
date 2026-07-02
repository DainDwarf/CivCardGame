import { addResources, type Resources } from './resources';
import { tableauProduction, tableauCultureOutput } from './production';
import { foodUpkeep } from './population';
import { applyEffect } from './effects';
import { CARDS } from '../content/cards';
import type { GameState } from './state';

export type MissionUpkeep = (G: GameState) => void;

/**
 * Resolve any `event` cards still in hand at end of turn: each applies its effect and is
 * destroyed to the `removed` pile (never recycled to discard). Non-event cards are left in
 * hand for the caller's normal discard sweep. Partition first, then resolve, so an event's
 * own effect (e.g. a draw) can't reorder the sweep. Shared by `endTurn` and `projectedDelta`.
 */
export function resolveHandEvents(G: GameState): void {
  const events: string[] = [];
  const kept: string[] = [];
  for (const id of G.hand) {
    if (CARDS[id]?.kind === 'event') events.push(id);
    else kept.push(id);
  }
  G.hand = kept;
  for (const id of events) {
    applyEffect(G, CARDS[id].effect);
    G.removed.push(id);
  }
}

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
export interface ProjectedDelta {
  resources: Resources;
  culture: number;
}

export function projectedDelta(G: GameState, missionUpkeep?: MissionUpkeep): ProjectedDelta {
  const clone = structuredClone(G);
  applyUpkeep(clone, missionUpkeep);
  // Events in hand auto-resolve at end of turn too, so fold their impact into the delta the
  // player sees (e.g. a Barbarian's Military drain + its collapse warning).
  resolveHandEvents(clone);
  return {
    resources: {
      food: clone.resources.food - G.resources.food,
      production: clone.resources.production - G.resources.production,
      science: clone.resources.science - G.resources.science,
      military: clone.resources.military - G.resources.military,
      money: clone.resources.money - G.resources.money,
    },
    culture: clone.culture - G.culture,
  };
}
