import { contentKey, discardCount, freePopulation, placedCards, workerCapOf, unplayableReason, type GameState } from '../rules';
import { CARDS, isStaffable, type CardDef } from '../content/cards';
import type { SimAction } from './simulate';

/**
 * Every legal action from the current state, in a **deterministic** order — the one legality enumeration
 * all policies share (`randomPolicy` / `greedyPolicy` / `heuristicPolicy`), so no
 * policy re-derives "what is playable" and they can never disagree with the engine. Legality reuses the
 * *production* gate `unplayableReason` (`rules/playability.ts`) for plays, and the same staffing bounds
 * the moves enforce (`freePopulation` / `workerCapOf`), never a re-derived copy.
 *
 * When a `pendingInteraction` is parked it is **exclusive**: `endTurn` no-ops and every play is blocked
 * (`run/engine.ts`), so the only legal actions are answering it — and we return *only* those. That
 * structurally prevents any consumer from deadlocking (a policy that fell through to a no-op `endTurn`
 * would loop until `simulateRun`'s action cap throws), centralizing the guard here instead of trusting
 * each policy to remember it.
 *
 * A discard-cost play enumerates **one action per distinct sacrifice** (`enumeratePlays`), so *which*
 * card is given up is a decision the consumer makes — dodging an unplayed event's drain by ditching it
 * is a line a fixed pick would hide from every search, including the oracle's winnability proof.
 */
export function enumerateActions(G: GameState): SimAction[] {
  if (G.pendingInteraction) {
    // A look-only `'reveal'` has no choice — any answer just dismisses it — so enumerate a single
    // dismiss; a `'chooseCard'` enumerates one action per revealed option.
    const n =
      G.pendingInteraction.kind === 'reveal' ? 1 : Math.max(1, G.pendingInteraction.options.length);
    const out: SimAction[] = [];
    for (let i = 0; i < n; i++) out.push({ kind: 'resolveInteraction', answer: i });
    return out;
  }

  const actions: SimAction[] = [{ kind: 'endTurn' }];

  for (let i = 0; i < G.hand.length; i++) {
    const inst = G.hand[i];
    const card = CARDS[inst.cardId];
    if (!card || unplayableReason(G, card, inst) !== null) continue;
    actions.push(...enumeratePlays(G, i, card));
  }

  const idle = freePopulation(G);
  // Every box in the play area that can hold workers. A trade route stands on the board like the rest
  // but takes none, so it is filtered out here rather than left out by naming only the other two zones
  // — `findStaffable`, which the moves resolve through, would reject it anyway.
  const staffables = placedCards(G).filter((p) => isStaffable(CARDS[p.cardId]));
  for (const s of staffables) {
    const cap = workerCapOf(s);
    if (s.workers > 0) actions.push({ kind: 'unassignWorker', id: s.id });
    if (s.workers < cap && idle > 0) actions.push({ kind: 'assignWorker', id: s.id });
    // `toggleStaffing`: empties a staffed box, or fills an empty one (to min(idle, cap)) whenever any
    // idle worker is free (mirrors the move's own reject).
    if (cap > 0 && (s.workers > 0 || idle > 0)) actions.push({ kind: 'toggleStaffing', id: s.id });
  }
  // `transferWorker`: move one worker from a staffed box to one with spare capacity. Meaningful for
  // multi-worker staffables (e.g. the Göbekli Tepe wonder) and enumerated so the move surface is
  // covered by the fuzzer and available to a re-optimizing greedy — see [[multi-worker-buildings-roadmap]].
  for (const from of staffables) {
    if (from.workers <= 0) continue;
    for (const to of staffables) {
      if (to.id === from.id) continue;
      if (to.workers < workerCapOf(to)) actions.push({ kind: 'transferWorker', fromId: from.id, toId: to.id });
    }
  }

  return actions;
}

/** The single `playCard` a consumer takes when it doesn't want to weigh the sacrifice itself (the
 *  `heuristicPolicy` ladder): `enumeratePlays`'s head, so the ladder's pick is an enumerated action by
 *  construction. */
export function canonicalPlay(G: GameState, playHandIdx: number, card: CardDef): SimAction {
  return enumeratePlays(G, playHandIdx, card)[0];
}

/**
 * Every distinct way to play an already-vetted-playable hand index — one action per **sacrifice
 * content**, not per hand position: four identical copies are one choice, while two copies of one
 * cardId carrying different counters are two. Keyed by `contentKey` (`rules/state.ts`), the same
 * id-independent identity the reshuffle and the transposition key use, so two actions differ here
 * exactly when they reach states the search treats as different.
 *
 * ⚠️ Generation is `C(other hand cards, required)` before that dedupe, and deliberately **unbounded** —
 * fine while the only discard cost in the catalogue is 1, but a multi-card sacrifice would multiply the
 * branching factor at every node of the beam searches, so cap it there rather than discover it as a
 * runtime cliff.
 */
export function enumeratePlays(G: GameState, playHandIdx: number, card: CardDef): SimAction[] {
  const required = discardCount(card, { G, self: G.hand[playHandIdx] });
  if (required === 0) return [{ kind: 'playCard', playHandIdx }];

  const others: number[] = [];
  for (let i = 0; i < G.hand.length; i++) if (i !== playHandIdx) others.push(i);

  const seen = new Set<string>();
  const plays: SimAction[] = [];
  const combo: number[] = [];
  // Ascending walk, so each content's surviving representative is its lowest-index one.
  const walk = (from: number): void => {
    if (combo.length === required) {
      const key = combo.map((i) => contentKey(G.hand[i])).sort().join(';');
      if (seen.has(key)) return;
      seen.add(key);
      plays.push({ kind: 'playCard', playHandIdx, discardHandIdxs: [...combo] });
      return;
    }
    for (let i = from; i < others.length; i++) {
      combo.push(others[i]);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return plays;
}
