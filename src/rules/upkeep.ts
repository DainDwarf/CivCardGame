import { subtractResources, type Resources } from './resources';
import { foodUpkeep } from './population';
import { willReshuffleOnRefill } from './deck';
import { resolveUpkeep } from './effects';
import { dispatchEvent, emitEvent, flushEvents, snapshot } from './events';
import { CARDS } from '../content/cards';
import type { CardInstance, GameState } from './state';

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
 * Resolve any `event` cards *left unplayed* in hand at upkeep: each fires its `upkeep` effect,
 * then files to the **discard** (so it reshuffles back and can recur — an unplayed event is a recurring
 * hazard). This is the involuntary path where the `upkeep` effect *actually fires*; the voluntary one is
 * `moves.playCard`, which pays the event's cost to banish it to `removed` **unresolved** (its `upkeep`
 * never fires — playing an event is preventive). Non-event cards are left in hand
 * for the end-of-turn discard sweep. Partition first, then resolve, so an event's own effect
 * (e.g. a draw) can't reorder the sweep. Called by `applyUpkeep`.
 *
 * Per the **zone order-independence invariant** (see DESIGN.md / the CLAUDE.md convention), the
 * *committed outcome* of this batch must not depend on the hand's order — the fixed iteration is for
 * replay determinism only. (The order hand cards then file into `discard` below is likewise
 * immaterial: the discard is unordered — its reshuffle canonicalizes by content, see `deck.ts`.)
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
    // Events auto-resolve at upkeep with no player present, so their `upkeep` resolvers must be
    // non-interactive (must not set `G.pendingInteraction` — there'd be no UI to answer it). Being
    // player-playable does not lift this: an event may still fire unplayed at upkeep, so every
    // event resolver must stay deterministic.
    resolveUpkeep({ G, self: c });
    G.discard.push(c);
    emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'event' });
  }
}

/**
 * Resolve the resource side of end-of-round upkeep: the `endTurn` broadcast fires per-round behaviour
 * on every operating (staffed) building and Work card (production) and every threat (its drain,
 * escalation included) through the bus's observer walk (`dispatchEvent` → `resolveEndTurn`); then any
 * `event` left unplayed in hand fires its `upkeep` disaster (`resolveHandEvents`) — mission pressure of
 * the same kind as a threat drain, so it ticks in this same pass; then the population eats food. Single
 * source of truth shared by the run loop's `endTurn` and the UI projection below, so they never drift.
 *
 * `endTurn` is dispatched *directly* here (not queued) so production runs at exactly the slot it
 * always has — before `flushEvents` synthesizes the round's net `resourceChange` — leaving the flush /
 * resourceChange / projection machinery byte-for-byte unchanged (a threshold like Treasury's still
 * sees the round's production). The draws/discards those handlers emit queue on `G.events` and drain
 * in the `flushEvents` below, reachable from `projectedDelta`'s clone so they show in the HUD preview.
 */
export function applyUpkeep(G: GameState): void {
  const before = snapshot(G);
  dispatchEvent(G, { type: 'endTurn' });
  resolveHandEvents(G);
  G.resources.food -= foodUpkeep(G);
  flushEvents(G, before);
}

/**
 * Settle the end-of-turn sequence after `applyUpkeep`: recycle the hand to discard (emitting an
 * `endOfTurn` discard per card — unplayed events already fired their `upkeep` and left the hand back
 * in `applyUpkeep`), file the work zone, then flush everything those emitted. The single choke point
 * for this sequence, shared by the run loop's `endTurn` and the HUD's `projectedDelta` below, so they
 * can't drift.
 */
export function settleEndOfTurn(G: GameState): void {
  const before = snapshot(G);
  // The recycled hand files as end-of-turn discards — a distinct reason from a sacrifice, so an
  // `on.discard` handler can ignore the routine recycle.
  for (const c of G.hand) emitEvent(G, { type: 'discard', instanceId: c.id, cardId: c.cardId, reason: 'endOfTurn' });
  G.discard.push(...G.hand);
  G.hand = [];
  // Work cards played this turn have now had their staffed production collected by upkeep; file
  // them to the discard and clear the board's work zone for the next turn.
  discardWorkZone(G);
  flushEvents(G, before);
}

/** The net change the player would see if they ended the round right now — the full 8-resource delta
 *  (core + strategic). All 8 so a consumer can read any pool's projected movement (the sim values
 *  projected territory; the HUD reads the core deltas + culture), not only the core. */
export interface ProjectedDelta {
  resources: Resources;
}

/**
 * The full state the run would be in at the *start of next turn* if the player ended the round now (a
 * clone — `G` is untouched). The single source of the next-turn projection: `projectedDelta` subtracts
 * from it, and the simulator's value function reads any pool / the objective off it (delayed production
 * toward a goal — Conquest's territory, Beer's culture — lands at upkeep, so it's only visible here).
 */
export function projectNextTurn(G: GameState): GameState {
  const clone = structuredClone(G);
  applyUpkeep(clone);
  // Recycle the hand and file the work zone too, so any `on.discard` reaction to the end-of-turn
  // sweep folds into the projection — the same sequence `endTurn` runs for real. (Unplayed events
  // already drained inside `applyUpkeep` above, so their impact is already in the clone.)
  settleEndOfTurn(clone);
  // The next turn's refill draw fires a `reshuffle` when it empties the deck (see `deck.ts`), and a
  // reshuffle-reacting threat (Unrest's per-🧍 🪙 drain) bleeds a resource the player is about to pay.
  // Surface that *structural* cost by firing the `reshuffle` broadcast synthetically here — without
  // running the draw itself, so the draw-contingent `on.draw` effects (which hinge on the hidden
  // identity of the card drawn) never leak into the projection. Whether the reshuffle is imminent is
  // publicly derivable (deck/discard/hand counts), so showing it reveals nothing the deck order hides.
  if (willReshuffleOnRefill(clone)) {
    const before = snapshot(clone);
    emitEvent(clone, { type: 'reshuffle' });
    flushEvents(clone, before);
  }
  return clone;
}

export function projectedDelta(G: GameState): ProjectedDelta {
  return { resources: subtractResources(projectNextTurn(G).resources, G.resources) };
}
