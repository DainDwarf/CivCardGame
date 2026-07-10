import { freePopulation, requiredWorkersOf, randInt, seededRng, unplayableReason, type GameState } from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import type { Policy, SimAction } from './simulate';

/** A live seeded generator — typed off `seededRng` so `pure-rand` stays confined to `rules/rng.ts`. */
type Rng = ReturnType<typeof seededRng>;

/**
 * A random-legal-move policy: at each step it enumerates the currently legal actions, then picks one
 * uniformly at random from its own seeded stream (distinct from the run's shuffle seed, so play-order
 * and draw-order vary independently). Doubles as a crash / illegal-state fuzzer — walking arbitrary
 * legal sequences drives the run into corners a scripted test wouldn't, which `simulateRun`'s
 * post-step invariant checks then police.
 *
 * Legality reuses the *production* gate `unplayableReason` (`rules/playability.ts`) — never a
 * re-derived copy — so the fuzzer and the real UI agree on what is playable.
 */
export function createRandomPolicy(policySeed: string): Policy {
  const rng = seededRng(policySeed);
  const policy: Policy = (state) => {
    const G = state.G;

    // A parked interaction is exclusive: the ONLY legal action is answering it. `endTurn` no-ops while
    // `pendingInteraction` is set (see `run/engine.ts`), so offering it here would deadlock the loop.
    // The Founding deck's Storytelling can park one (once its science cost is affordable), so a run
    // may reach this branch — without this guard those runs would hang.
    if (G.pendingInteraction) {
      const n = G.pendingInteraction.options.length;
      return { kind: 'resolveInteraction', answer: n > 0 ? randInt(rng, 0, n - 1) : 0 };
    }

    const candidates: SimAction[] = [{ kind: 'endTurn' }];

    for (let i = 0; i < G.hand.length; i++) {
      const inst = G.hand[i];
      const card = CARDS[inst.cardId];
      if (!card || unplayableReason(G, card, inst) !== null) continue;
      candidates.push(buildPlayAction(G, i, card, rng));
    }

    const idle = freePopulation(G);
    for (const s of [...G.tableau, ...G.workZone]) {
      const req = requiredWorkersOf(s);
      if (s.workers > 0) candidates.push({ kind: 'unassignWorker', id: s.id });
      if (s.workers < req && idle > 0) candidates.push({ kind: 'assignWorker', id: s.id });
      // `toggleStaffing` is all-or-nothing: it can empty a staffed box, or fill an empty one only if
      // the whole requirement can be met from the idle pool (mirrors the move's own reject).
      if (req > 0 && (s.workers > 0 || idle >= req)) candidates.push({ kind: 'toggleStaffing', id: s.id });
    }

    return candidates[randInt(rng, 0, candidates.length - 1)];
  };
  policy.seed = policySeed;
  return policy;
}

/** Build a legal `playCard` action for an already-vetted-playable hand index, supplying valid extra
 *  args: the discard-cost sacrifices (computed exactly as `moves.playCard` does) and, for a Destroy
 *  card, a random tableau target. */
function buildPlayAction(G: GameState, playHandIdx: number, card: CardDef, rng: Rng): SimAction {
  const want = card.discardCost ?? 0;
  // Played with too few spare cards, the discard cost is waived entirely (see `moves.playCard`).
  const required = G.hand.length - 1 >= want ? want : 0;

  let discardHandIdxs: number[] | undefined;
  if (required > 0) {
    const others: number[] = [];
    for (let i = 0; i < G.hand.length; i++) if (i !== playHandIdx) others.push(i);
    discardHandIdxs = pickDistinct(others, required, rng);
  }

  let destroyInstanceId: number | undefined;
  if (card.effect?.destroy && G.tableau.length > 0) {
    destroyInstanceId = G.tableau[randInt(rng, 0, G.tableau.length - 1)].id;
  }

  return { kind: 'playCard', playHandIdx, discardHandIdxs, destroyInstanceId };
}

/** Pick `k` distinct entries from `pool` via a partial Fisher–Yates shuffle over a copy. */
function pickDistinct(pool: number[], k: number, rng: Rng): number[] {
  const a = [...pool];
  for (let i = 0; i < k; i++) {
    const j = randInt(rng, i, a.length - 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
