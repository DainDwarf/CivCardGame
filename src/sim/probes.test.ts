import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installFixtures, mint, uninstallFixtures } from '../rules/testFixtures';
import { blankState, type CardInstance, type GameState } from '../rules';
import { effectiveCost, effectiveGain } from '../rules/stickers';
import { CARDS } from '../content/cards';
import { grantDelta, outputDelta, replacementCost, runCardIds } from './probes';

/** Every figure below is derived through the production fold rather than written out, so a fixture's
 *  numbers can move without re-teaching this suite what a sticker does. */
const printed = (cardId: string, field: 'produces' | 'effect') => CARDS[cardId][field]!.resources!;
const stickered = (cardId: string, field: 'produces' | 'effect', ...stickers: string[]) =>
  effectiveGain(printed(cardId, field), { stickers })!;

/** A run holding exactly the named copies of one card, each with the stickers given. */
function runHolding(cardId: string, ...copies: (string[] | undefined)[]): GameState {
  const G = blankState('probe_test');
  for (const stickers of copies) G.deck.push(mint(G, cardId, stickers));
  return G;
}

const unitCost = (G: GameState) => replacementCost(G, runCardIds(G));

describe('replacementCost over the copies a run holds', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  it('rates a producer at what its stickered copy really yields', () => {
    const bare = unitCost(runHolding('test_food', undefined)).food;
    const irrigated = unitCost(runHolding('test_food', ['test_restricted'])).food;
    expect(bare).toBe(1 / printed('test_food', 'produces').food!);
    expect(irrigated).toBe(1 / stickered('test_food', 'produces', 'test_restricted').food!);
    expect(irrigated).toBeLessThan(bare!);
  });

  it('takes the better of a stickered copy and a bare one', () => {
    const mixed = unitCost(runHolding('test_food', undefined, ['test_restricted'])).food;
    // The two copies are two routes to the same pool, and a unit costs what the cheapest of them charges —
    // the same `min` the scan already takes across cards.
    expect(mixed).toBe(unitCost(runHolding('test_food', ['test_restricted'])).food);
    expect(mixed).toBeLessThan(unitCost(runHolding('test_food', undefined)).food!);
  });

  it('prices a grant through the copy the play would be made with', () => {
    // `test_settlers` is the only thing minting 🧍, so the whole of population's rate is what that copy
    // charges in 🌾 — which a work box gives a rate to convert through.
    const rates = (stickers?: string[]) => {
      const G = runHolding('test_settlers', stickers);
      G.deck.push(mint(G, 'test_work_food'));
      return unitCost(G);
    };
    const bare = rates();
    const cut = rates(['test_costcut']);
    expect(bare.population).toBe(CARDS.test_settlers.cost.resources!.food! * bare.food!);
    expect(cut.population).toBe(
      effectiveCost(CARDS.test_settlers.cost, { stickers: ['test_costcut'] }).resources!.food! * cut.food!,
    );
    expect(cut.population).toBeLessThan(bare.population!);
  });
});

describe('the delta probes over one copy', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  const food = (G: GameState) => G.resources.food;
  const population = (G: GameState) => G.resources.population;
  const copy = (cardId: string, ...stickers: string[]): CardInstance => ({ id: -99, cardId, stickers });

  it('reads a play grant off the copy', () => {
    const G = blankState('probe_test');
    expect(grantDelta(G, CARDS.test_settlers, population)).toBe(printed('test_settlers', 'effect').population);
    expect(grantDelta(G, CARDS.test_settlers, population, copy('test_settlers', 'test_addgain'))).toBe(
      stickered('test_settlers', 'effect', 'test_addgain').population,
    );
  });

  it('reads a round of output off the copy', () => {
    const G = blankState('probe_test');
    expect(outputDelta(G, CARDS.test_food, food)).toBe(printed('test_food', 'produces').food);
    expect(outputDelta(G, CARDS.test_food, food, copy('test_food', 'test_restricted'))).toBe(
      stickered('test_food', 'produces', 'test_restricted').food,
    );
  });
});
