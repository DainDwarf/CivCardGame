import {
  freePopulation,
  freeTerritory,
  isOperating,
  projectedDelta,
  requiredWorkersOf,
  unplayableReason,
  type GameState,
  type Resources,
} from '../rules';
import { CARDS, type CardDef } from '../content/cards';
import { canonicalPlay, enumerateActions } from './actions';
import type { Policy, SimAction } from './simulate';

/** Projected next-round food below this ⇒ starvation is near, prioritize food over everything. */
const FOOD_SAFETY = 3;
/** Projected next-round food at/above this ⇒ safe to grow population. Deliberately *high*: growing
 *  population raises food upkeep **permanently**, while most early food income is transient (work cards
 *  file away at end of turn), so a momentary surplus is not a reason to commit to more mouths. */
const FOOD_COMFORT = 12;

/** Rough per-currency worth, for statically ranking a *card* (not a state) — the heuristic's cheap
 *  stand-in for cloning-and-scoring every candidate the way the greedy does. Throwaway first-pass. */
const VW: Resources = { food: 1, production: 1, science: 1, military: 0.8, money: 0.8 };

/**
 * A **heuristic** policy: a hand-written priority ladder encoding a sensible-player strategy, evaluated
 * top-down. Unlike the greedy it never clones per-candidate — it reads *one* `projectedDelta` for the
 * food outlook, then ranks cards by static metadata — so it's the cheap "competent baseline" for large
 * sweeps where the greedy's per-action cloning is the bottleneck. Its ladder: answer a parked
 * interaction → staff idle capacity → if food is tight, play the best net-food card → build on free
 * territory → if food is comfortable, grow population → otherwise play the best-value affordable card →
 * else end the turn. Deliberately no per-`cardId` branches: cards are classified by their declarative
 * `effect`/`produces`/`cost`, per the *cards own their own logic* convention, so new content is ranked
 * without touching this file.
 */
export function createHeuristicPolicy(policySeed?: string): Policy {
  const policy: Policy = (state) => decide(state.G);
  policy.seed = policySeed;
  return policy;
}

function decide(G: GameState): SimAction {
  // A parked interaction is exclusive — answer it (see `enumerateActions`); a fixed pick is fine.
  if (G.pendingInteraction) return enumerateActions(G)[0];

  // 1. Staff idle capacity — free and always good (production online). Prefer a food producer when the
  //    outlook is tight, else the highest static value.
  const idle = freePopulation(G);
  if (idle > 0) {
    const understaffed = [...G.tableau, ...G.workZone].filter((s) => !isOperating(s) && requiredWorkersOf(s) <= idle);
    if (understaffed.length > 0) {
      const projFood = projectedFood(G);
      const pick = bestBy(understaffed, (s) =>
        projFood < FOOD_SAFETY ? foodOutput(CARDS[s.cardId]) : staticValue(CARDS[s.cardId]),
      );
      return { kind: 'toggleStaffing', id: pick.id };
    }
  }

  const playable = playableHand(G);
  const projFood = projectedFood(G);

  // 2. Food is tight — play the card that most improves food, if any actually helps.
  if (projFood < FOOD_SAFETY) {
    const best = bestPlay(G, playable, (c) => staticFoodDelta(c), 0);
    if (best) return best;
  }

  // 3. Build on free territory (economy growth) — cheapest first. (No buildings in current content.)
  if (freeTerritory(G) > 0) {
    const buildings = playable.filter((p) => p.card.kind === 'building');
    const best = bestPlay(G, buildings, (c) => -bundleValue(c.cost), -Infinity);
    if (best) return best;
  }

  // 4. Food is comfortable — grow population.
  if (projFood >= FOOD_COMFORT) {
    const growers = playable.filter((p) => (p.card.effect?.population ?? 0) > 0);
    const best = bestPlay(G, growers, (c) => c.effect?.population ?? 0, 0);
    if (best) return best;
  }

  // 5. Play the best-value affordable card — but skip a net food-spender while food isn't comfortable.
  const safe = projFood >= FOOD_COMFORT ? playable : playable.filter((p) => staticFoodDelta(p.card) >= 0);
  const best = bestPlay(G, safe, (c) => staticValue(c), 0);
  if (best) return best;

  return { kind: 'endTurn' };
}

// — helpers ————————————————————————————————————————————————————————————————————————————————————————

interface PlayableCard {
  idx: number;
  card: CardDef;
}

function playableHand(G: GameState): PlayableCard[] {
  const out: PlayableCard[] = [];
  for (let i = 0; i < G.hand.length; i++) {
    const card = CARDS[G.hand[i].cardId];
    if (card && unplayableReason(G, card, G.hand[i]) === null) out.push({ idx: i, card });
  }
  return out;
}

function projectedFood(G: GameState): number {
  return G.resources.food + projectedDelta(G).resources.food;
}

/** The best `PlayableCard` by `metric` whose metric exceeds `min`, as a canonical `playCard`; else null. */
function bestPlay(
  G: GameState,
  cards: PlayableCard[],
  metric: (c: CardDef) => number,
  min: number,
): SimAction | null {
  let best: PlayableCard | null = null;
  let bestVal = min;
  for (const p of cards) {
    const v = metric(p.card);
    if (v > bestVal) {
      best = p;
      bestVal = v;
    }
  }
  return best ? canonicalPlay(G, best.idx, best.card) : null;
}

/** The element of `xs` maximizing `metric` (first on ties); `xs` must be non-empty. */
function bestBy<T>(xs: T[], metric: (x: T) => number): T {
  let best = xs[0];
  let bestVal = metric(best);
  for (const x of xs.slice(1)) {
    const v = metric(x);
    if (v > bestVal) {
      best = x;
      bestVal = v;
    }
  }
  return best;
}

/** Food a card yields when operating (staffed work/building) or played (action gain). */
function foodOutput(card: CardDef): number {
  return (card.effect?.gain?.food ?? 0) + (card.produces?.food ?? 0);
}

/** A card's rough net food effect: what it yields minus what it costs/loses in food. */
function staticFoodDelta(card: CardDef): number {
  return foodOutput(card) - (card.cost.food ?? 0) - (card.effect?.loss?.food ?? 0);
}

function bundleValue(b?: Partial<Resources>): number {
  if (!b) return 0;
  return (Object.entries(b) as [keyof Resources, number][]).reduce((sum, [k, v]) => sum + v * VW[k], 0);
}

/** A crude static worth for a *card* — gains + production + strategic outputs, minus its cost. */
function staticValue(card: CardDef): number {
  let v = bundleValue(card.effect?.gain) + bundleValue(card.produces);
  v -= bundleValue(card.cost) + bundleValue(card.effect?.loss);
  v += (card.effect?.population ?? 0) * 3;
  v += ((card.effect?.culture ?? 0) + (card.cultureOutput ?? 0)) * 0.6;
  v += (card.effect?.territory ?? 0) * 1.5;
  v += (card.effect?.draw ?? 0) * 1;
  return v;
}
