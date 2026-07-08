import { findStaffable, isOperating } from './population';
import { runEventHandler, resolveEndTurn } from './effects';
import { evaluateObjective } from './objective';
import { CARDS } from '../content/cards';
import type { CardInstance, GameEvent, GameState, ValueSnapshot } from './state';

/**
 * The event bus: the general trigger layer that lets a card react to a game event whose *timing it
 * doesn't own* (a draw, a discard elsewhere, a resource crossing a threshold), via a `CardDef.on`
 * handler run through the same `resolveCard`/`EffectContext` spine as every other effect.
 *
 * Two verbs, deliberately split so the bus never dispatches from inside a mutation:
 *  - **emit** (`emitEvent`) — a cheap append to `G.events`, done at a semantic site *as a step runs*
 *    (even inside a leaf like `drawCard`). Safe mid-mutation because it runs no handler.
 *  - **flush** (`flushEvents`) — at a *step boundary* (after a move, after upkeep, after a draw
 *    batch), drain the queue and run each queued event's handlers.
 *
 * `flushEvents` drains the *leaf-emitted* events (draws, discards, the synthesized `resourceChange`);
 * the per-round `endTurn` broadcast is `dispatchEvent`'d directly at the upkeep boundary by
 * `rules/upkeep.ts` (it's what runs production + threat drains). Both are step boundaries, not leaf
 * mutations, so neither re-enters a mutation site: an `endTurn` handler only *emits* (its draws/
 * discards queue for the following flush), it never re-dispatches.
 *
 * Everything is plain data on `G`; the bus adds no object to `GameState`. See the `G.events`
 * invariant in `state.ts` (always drained to `[]` before a state is committed).
 */

/** Upper bound on how many events one flush will dispatch, counting the cascade (handlers emitting
 *  more events). A guard against a pathological self-emitting loop, not a normal limit — a real flush
 *  drains a handful. If hit, the remainder is dropped so the drained-to-`[]` invariant still holds. */
export const MAX_EVENT_CASCADE = 256;

/** Emit an event — push it onto `G`'s queue for the next boundary flush. Never runs a handler. */
export function emitEvent(G: GameState, event: GameEvent): void {
  G.events.push(event);
}

/** Capture the value fields a `resourceChange` handler may watch, for the flush's before/after diff. */
export function snapshot(G: GameState): ValueSnapshot {
  return {
    resources: { ...G.resources },
    population: G.population,
    territory: G.territory,
    culture: G.culture,
  };
}

/** Did any value field move since `before`? Gates whether a flush synthesizes a `resourceChange`. */
function valueChanged(G: GameState, before: ValueSnapshot): boolean {
  const r = G.resources;
  const b = before.resources;
  return (
    r.food !== b.food ||
    r.production !== b.production ||
    r.science !== b.science ||
    r.military !== b.military ||
    r.money !== b.money ||
    G.population !== before.population ||
    G.territory !== before.territory ||
    G.culture !== before.culture
  );
}

/** The subject instance a discrete event names (`draw`/`discard`), reconstructed bare (`{id, cardId}`)
 *  like `resolveInteraction` does — the card may have moved zones since, so we don't chase its live
 *  copy or its counters (see the review's #2 finding: a bare subject's stickers/counters are still
 *  lost). `undefined` for a value (`resourceChange`) or broadcast (`endTurn`) event, which name no
 *  subject. */
function subjectOf(event: GameEvent): CardInstance | undefined {
  if (event.type === 'resourceChange' || event.type === 'endTurn') return undefined;
  return { id: event.instanceId, cardId: event.cardId };
}

/**
 * Dispatch one event to every subscribed card, in a fixed, deterministic order so replays match:
 *  1. the event's **subject** (the discarded/drawn card reacting to itself — the *self-triggered*
 *     flavour), then
 *  2. every **operating** (staffed) tableau building, then every operating Work card, then every
 *     threat — the *observer* flavour, reusing the exact `isOperating` gate production applies, so an
 *     idle building/work box never reacts.
 * A card only appears once (dedup by instance id: the subject may also sit on the board). The
 * per-subscriber action depends on the event: for the `endTurn` broadcast every subscriber runs
 * `resolveEndTurn` (production/threat drain by default, or its own `on.endTurn`); for every other
 * event only cards that actually declare `on[event.type]` are run. Handlers mutate `G` directly; they
 * must not open a `pendingInteraction` (the bus can fire at upkeep with no player) and should `filter`,
 * never `splice`, to self-remove — the zone loops here iterate a snapshot (`[...G.tableau]`), so a
 * splice wouldn't corrupt *this* dispatch, but `filter` keeps the array-identity discipline uniform.
 *
 * A `building`/`work` subject is a *staffable* — its handler carries the same "while staffed"
 * contract as the observer walk applies to it, so the subject path must apply the identical
 * `isOperating` gate rather than firing unconditionally (e.g. Scriptorium drawn into hand is not
 * an operating copy and must not pay out on its own draw). That only makes sense once the subject
 * is resolved to its *live* zone instance (a bare `{id, cardId}` has no `workers` to gate on), so a
 * building/work subject is looked up via `findStaffable` instead of dispatched bare; a subject of any
 * other kind (action/event/threat/objective — never staffable) keeps firing unconditionally, since it
 * never had a staffing contract to begin with.
 */
export function dispatchEvent(G: GameState, event: GameEvent): void {
  const seen = new Set<number>();
  const run = (self: CardInstance) => {
    if (seen.has(self.id)) return;
    seen.add(self.id);
    if (event.type === 'endTurn') return void resolveEndTurn({ G, self, event });
    if (!CARDS[self.cardId]?.on?.[event.type]) return;
    runEventHandler({ G, self, event });
  };

  const subject = subjectOf(event);
  if (subject) {
    const kind = CARDS[subject.cardId]?.kind;
    if (kind === 'building' || kind === 'work') {
      const live = findStaffable(G, subject.id);
      if (live && isOperating(live)) run(live);
    } else {
      run(subject);
    }
  }
  // Snapshot the observer zones first: a handler may add/remove from them, but this event's
  // subscriber set is fixed at dispatch time.
  for (const b of [...G.tableau]) if (isOperating(b)) run(b);
  for (const w of [...G.workZone]) if (isOperating(w)) run(w);
  for (const t of [...G.threats]) run(t);
}

/**
 * Flush the event queue at a step boundary: synthesize a `resourceChange` from `before` (only if a
 * value field actually moved — no empty events), then drain `G.events` FIFO, dispatching each. A
 * handler may emit more events (a discard triggering a draw); those drain in the same pass, bounded
 * by `MAX_EVENT_CASCADE`. Always leaves `G.events = []`, upholding the committed-state invariant.
 *
 * `resourceChange` is diffed against `before` *once* and never re-synthesized within the drain, so a
 * handler that changes resources can't re-fire itself — the change is seen at the *next* boundary.
 * Corollary for card authors: a threshold a *handler's own gain* crosses mid-flush (e.g. an on-draw
 * building pushing money past 30 while a Treasury watches) won't fire until the next step — chain a
 * threshold off a *step*'s change (an action, upkeep production), not another handler's output.
 *
 * The objective card is re-evaluated here (`evaluateObjective`) — this is *its* bus hook. Every step
 * boundary flushes unconditionally, so the win flag (`G.pendingVictory`) is always fresh before the
 * `checkEndIf` that follows, even when the flush dispatched no events (e.g. a round-based win at
 * `beginTurn`). It runs after the drain so it sees the fully-settled post-flush state.
 */
export function flushEvents(G: GameState, before: ValueSnapshot): void {
  if (valueChanged(G, before)) emitEvent(G, { type: 'resourceChange', before });
  let dispatched = 0;
  while (G.events.length > 0) {
    const event = G.events.shift()!;
    dispatchEvent(G, event);
    if (++dispatched >= MAX_EVENT_CASCADE) break;
  }
  // Drop any remainder (only reachable if the cascade cap tripped) so the queue is always empty.
  G.events = [];
  evaluateObjective(G);
}
