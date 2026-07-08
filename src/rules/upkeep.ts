import { type Resources } from './resources';
import { foodUpkeep } from './population';
import { resolveCard } from './effects';
import { dispatchEvent, emitEvent, flushEvents, snapshot } from './events';
import { CARDS } from '../content/cards';
import type { CardInstance, GameState } from './state';

export type MissionUpkeep = (G: GameState) => void;

/**
 * File every Work card played this turn to the discard pile and clear the workZone. Called by
 * `endTurn` *after* `applyUpkeep` has collected staffed-Work production — the whole point of the
 * `work` kind is that the card sticks around (staffable) through the turn and only recycles at
 * end of turn. Not part of `applyUpkeep` itself, since the projection clone runs upkeep too.
 */
export function discardWorkZone(G: GameState): void {
  // File each work card to discard as a plain card instance (its workZone id is free to reuse once
  // the zone is cleared), dropping the staffing-only `workers`/`counters` a work box carried.
  for (const w of G.workZone) {
    G.discard.push({ id: w.id, cardId: w.cardId });
    emitEvent(G, { type: 'discard', instanceId: w.id, cardId: w.cardId, reason: 'workFiled' });
  }
  G.workZone = [];
}

/**
 * Resolve any `event` cards still in hand at end of turn: each applies its effect, then files
 * to `removed` if its effect says `remove: true`, or `discard` otherwise (the same default any
 * other card gets) — see `CardEffect.remove`'s doc comment. Non-event cards are left in hand for
 * the caller's normal discard sweep. Partition first, then resolve, so an event's own effect
 * (e.g. a draw) can't reorder the sweep. Shared by `endTurn` and `projectedDelta`.
 */
export function resolveHandEvents(G: GameState): void {
  const events: CardInstance[] = [];
  const kept: CardInstance[] = [];
  for (const c of G.hand) {
    if (CARDS[c.cardId]?.kind === 'event') events.push(c);
    else kept.push(c);
  }
  G.hand = kept;
  for (const c of events) {
    const card = CARDS[c.cardId];
    // Events auto-resolve at end of turn with no player present, so their resolvers must be
    // non-interactive (must not set `G.pendingInteraction` — there'd be no UI to answer it). Only
    // `action` cards may currently open an interaction; keep any future `event` resolver deterministic.
    resolveCard({ G, self: c });
    // `remove` is a filing decision (exile vs. discard), owned here, not by the resolver.
    (card.effect?.remove ? G.removed : G.discard).push(c);
    emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'event' });
  }
}

/**
 * Resolve the resource side of end-of-round upkeep: the `endTurn` broadcast fires per-round behaviour
 * on every operating (staffed) building and Work card (production) and every threat (its drain,
 * escalation included) through the bus's observer walk (`dispatchEvent` → `resolveEndTurn`), the
 * mission ticks, then the population eats food. Single source of truth shared by the run loop's `onEnd`
 * and the UI projection below, so they never drift.
 *
 * `endTurn` is dispatched *directly* here (not queued) so production runs at exactly the slot it
 * always has — before `flushEvents` synthesizes the round's net `resourceChange` — leaving the flush /
 * resourceChange / projection machinery byte-for-byte unchanged (a threshold like Treasury's still
 * sees the round's production). The draws/discards those handlers emit queue on `G.events` and drain
 * in the `flushEvents` below, reachable from `projectedDelta`'s clone so they show in the HUD preview.
 */
export function applyUpkeep(G: GameState, missionUpkeep?: MissionUpkeep): void {
  const before = snapshot(G);
  dispatchEvent(G, { type: 'endTurn' });
  missionUpkeep?.(G);
  G.resources.food -= foodUpkeep(G);
  flushEvents(G, before);
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
  const beforeEvents = snapshot(clone);
  resolveHandEvents(clone);
  // Mirror `endTurn`: flush what the hand events emitted (their discards, any resourceChange) so the
  // preview matches the real turn end, not a pre-dispatch snapshot of it.
  flushEvents(clone, beforeEvents);
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
