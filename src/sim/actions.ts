import { freePopulation, workerCapOf, unplayableReason, type GameState } from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import type { SimAction } from './simulate';

/**
 * Every legal action from the current state, with **canonical (deterministic) extra args** — the one
 * legality enumeration all policies share (`randomPolicy` / `greedyPolicy` / `heuristicPolicy`), so no
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
 * The extras are *canonical*: a discard-cost play sacrifices the first eligible other-hand cards and a
 * Destroy targets the first tableau building. A policy wanting *randomized* extras (the fuzzer) rebuilds
 * them from this skeleton (see `randomPolicy`), sharing only the sacrifice *count* via `discardCostToPay`.
 */
export function enumerateActions(G: GameState): SimAction[] {
  if (G.pendingInteraction) {
    const n = Math.max(1, G.pendingInteraction.options.length);
    const out: SimAction[] = [];
    for (let i = 0; i < n; i++) out.push({ kind: 'resolveInteraction', answer: i });
    return out;
  }

  const actions: SimAction[] = [{ kind: 'endTurn' }];

  for (let i = 0; i < G.hand.length; i++) {
    const inst = G.hand[i];
    const card = CARDS[inst.cardId];
    if (!card || unplayableReason(G, card, inst) !== null) continue;
    actions.push(canonicalPlay(G, i, card));
  }

  const idle = freePopulation(G);
  const staffables = [...G.tableau, ...G.workZone];
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

/**
 * How many cards a play must sacrifice to its `discardCost` given the current hand — waived entirely
 * when too few spare cards exist, exactly as `moves.playCard` computes. The single source both the
 * canonical enumeration and the fuzzer's randomized sacrifice draw from, so they can never propose a
 * discard set the move would reject.
 */
export function discardCostToPay(G: GameState, card: CardDef): number {
  const want = card.gate?.discardCost ?? 0;
  return G.hand.length - 1 >= want ? want : 0;
}

/** A canonical (deterministic) `playCard` for an already-vetted-playable hand index: the discard-cost
 *  sacrifices are the first eligible other-hand cards and a Destroy targets the first tableau building. */
export function canonicalPlay(G: GameState, playHandIdx: number, card: CardDef): SimAction {
  const required = discardCostToPay(G, card);
  let discardHandIdxs: number[] | undefined;
  if (required > 0) {
    const idxs: number[] = [];
    for (let i = 0; i < G.hand.length && idxs.length < required; i++) if (i !== playHandIdx) idxs.push(i);
    discardHandIdxs = idxs;
  }
  const destroyInstanceId = card.effect?.destroy && G.tableau.length > 0 ? G.tableau[0].id : undefined;
  return { kind: 'playCard', playHandIdx, discardHandIdxs, destroyInstanceId };
}
