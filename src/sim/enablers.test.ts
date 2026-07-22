import { describe, it, expect } from 'vitest';
import { createRun } from '../run/engine';
import { simConfig } from './simulate';
import { deriveEnablers, enablerPotential, goalValuedCardCosts } from './enablers';
import { OBJECTIVE_WEIGHT } from './value';
import { objectiveProgress } from './objective';
import { CARDS } from '../content/cards';
import { addBuilding, cultureForLevel, emptyResources, type GameState } from '../rules';

// The two conversion costs the Masonry deck rides on, read from content so a rebalance re-targets these
// expectations instead of silently breaking on a stale literal — the assertions pin the *relationship* (a
// resource's cap is its converter's cost), not the number.
const HUT_PRODUCTION_COST = CARDS.hut.cost.production!;
const CONQUEST_MILITARY_COST = CARDS.conquest.cost.military!;

// A real Masonry run root (Settlement board). Masonry wins on population: production is a production→
// population *consumable* enabler (a Hut's cost), and territory is a *capacity* enabler (the slot the Hut
// needs). Territory is not goal-valued here (the sim override that once blended it in is gone), so it rides
// the capacity probe — the exact case the generalization exists to cover.
function masonryRoot(): GameState {
  const config = simConfig({
    deckCardIds: ['hut', 'hut', 'conquest', 'conquest', 'toolmaking', 'toolmaking', 'dogs', 'dogs', 'farm', 'farm'],
    board: 'settlement',
    missionId: 'masonry',
    seed: 'enablers-test',
  });
  return createRun(config).G;
}

/** The score credit `scoreState`'s objective band grants for one unit of `resource`, off a zeroed baseline
 *  (so the objective's caps don't hide the step). */
function objectiveStep(resource: keyof GameState['resources']): number {
  const G = masonryRoot();
  G.resources = emptyResources();
  const before = objectiveProgress(G);
  G.resources[resource] += 1;
  return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
}

describe('consumable enabler (planner leaf accelerator)', () => {
  it('derives the deck\'s production→population conversion toward the Masonry objective', () => {
    const m = deriveEnablers(masonryRoot());
    // Masonry wins on population, grown by Huts — production (a Hut's cost) is a production→population enabler.
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(HUT_PRODUCTION_COST);
  });

  it('chains a core cost through an enabler-valued resource (military→Conquest→territory)', () => {
    // Territory isn't goal-valued on Masonry, so it's only *enabler*-valued (a capacity weight). Conquest
    // turns military into territory, and the consumable loop treats that capacity weight as a conversion
    // target — so banking the military that buys a Conquest is credited, capped at the Conquest's cost.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(CONQUEST_MILITARY_COST);
  });

  it('credits only the enabler resources, not survival pools or the goal itself', () => {
    const m = deriveEnablers(masonryRoot());
    // food/science/money feed no valued conversion here; population is the goal, scored directly, not
    // shadowed as its own enabler.
    for (const k of ['food', 'science', 'money', 'population'] as const) {
      expect(m.weight[k] ?? 0, k).toBe(0);
    }
  });

  it('rises with a banked consumable up to its conversion cost, then saturates', () => {
    const m = deriveEnablers(masonryRoot());
    const pot = (resource: 'production' | 'military', amount: number) => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources[resource] = amount;
      return enablerPotential(G, m);
    };
    // production → population, saturating at the Hut cost
    expect(pot('production', 0)).toBe(0);
    expect(pot('production', HUT_PRODUCTION_COST - 2)).toBeGreaterThan(pot('production', 0));
    expect(pot('production', HUT_PRODUCTION_COST + 5)).toBe(pot('production', HUT_PRODUCTION_COST));
    // military → territory (the chained hop), saturating at the Conquest cost
    expect(pot('military', 0)).toBe(0);
    expect(pot('military', CONQUEST_MILITARY_COST - 2)).toBeGreaterThan(pot('military', 0));
    expect(pot('military', CONQUEST_MILITARY_COST + 3)).toBe(pot('military', CONQUEST_MILITARY_COST));
  });

  it('keeps a full consumable bank worth strictly less than the value it converts into (sound shaping)', () => {
    const m = deriveEnablers(masonryRoot());
    const bankOf = (resource: 'production' | 'military') => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources[resource] = m.cap[resource]!;
      return enablerPotential(G, m);
    };
    // A Hut's worth of production must score below the +1 population it converts into (a goal step)...
    expect(bankOf('production')).toBeLessThan(objectiveStep('population'));
    // ...and a Conquest's worth of military below the territory it converts into (that territory's enabler
    // value), so the search plays the Conquest rather than hoarding military toward it.
    const territoryValue = (() => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources.territory = CARDS.conquest.produces!.resources!.territory!;
      return enablerPotential(G, m);
    })();
    expect(bankOf('military')).toBeLessThan(territoryValue);
  });
});

describe('territory capacity enabler', () => {
  it('credits territory when it is not goal-valued, scanning a structure\'s effect (not only produces)', () => {
    // The slot a Hut needs unlocks the Hut's one-shot `effect` grant of the goal population — so the probe
    // must read `effect`, which a produces-only scan would miss.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.territory ?? 0).toBeGreaterThan(0);
  });

  it('is a durable multi-round credit, worth more than one round of the building\'s throughput', () => {
    const m = deriveEnablers(masonryRoot());
    // One Hut grants +1 population; the credit is worth several rounds of it (a slot keeps hosting a
    // producer), not a single one-shot hop.
    const oneRound = CARDS.hut.effect!.resources!.population! * objectiveStep('population');
    expect(m.weight.territory!).toBeGreaterThan(oneRound);
  });

  it('rises with banked territory then saturates at the cap', () => {
    const m = deriveEnablers(masonryRoot());
    const pot = (territory: number) => {
      const G = masonryRoot();
      G.resources = emptyResources();
      G.resources.territory = territory;
      return enablerPotential(G, m);
    };
    expect(pot(0)).toBe(0);
    expect(pot(5)).toBeGreaterThan(pot(0));
    expect(pot(100)).toBe(pot(50)); // saturates at the capacity cap — hoarding territory past it earns nothing
  });
});

// Pyramid wins on *resource thresholds* (money/prod/culture), so population isn't goal-valued here — it's a
// pure enabler: staffing a per-worker producer (Toolmaking → production, a goal resource) converts a unit of
// population into goal output every round. A real Pyramid run root, so the model derives through the same
// path production uses.
function pyramidRoot(deckCardIds: string[]): GameState {
  const config = simConfig({ deckCardIds, board: 'city', missionId: 'pyramid', seed: 'enablers-pop-test' });
  return createRun(config).G;
}

describe('population capacity enabler', () => {
  it('credits population as a durable, multi-round enabler when it is not itself goal-valued', () => {
    const deck = ['toolmaking', 'toolmaking', 'foraging', 'foraging', 'farm', 'farm', 'jewelry', 'jewelry'];
    const m = deriveEnablers(pyramidRoot(deck));

    // One round of the deck's best goal producer (Toolmaking: 2🔨/worker) credited through the objective —
    // read from content, so a Toolmaking/objective rebalance re-targets the relationship, not a stale number.
    const stepPerProduction = (() => {
      const G = pyramidRoot(deck);
      G.resources = emptyResources();
      const before = objectiveProgress(G);
      G.resources.production += 1;
      return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
    })();
    const oneRoundThroughput = CARDS.toolmaking.produces!.resources!.production! * stepPerProduction;

    expect(m.weight.population ?? 0).toBeGreaterThan(0);
    // Durable-capacity semantics: worth *more* than a single round's throughput (a consumable one-hop credit
    // would be worth at most one round), since a staffed worker produces every round it's staffed.
    expect(m.weight.population!).toBeGreaterThan(oneRoundThroughput);
  });

  it('scales the credit with the deck\'s best goal producer', () => {
    // Beer (5🎭/worker) is a stronger culture producer than Cave Art (2🎭/worker); the population credit
    // tracks the best staffable, so a deck holding Beer earns more per population than one without it.
    const withBeer = deriveEnablers(pyramidRoot(['cave_art', 'beer', 'foraging', 'foraging']));
    const caveArtOnly = deriveEnablers(pyramidRoot(['cave_art', 'foraging', 'foraging']));
    expect(withBeer.weight.population!).toBeGreaterThan(caveArtOnly.weight.population!);
  });

  it('rises with banked population then saturates at the cap', () => {
    const m = deriveEnablers(pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']));
    const pot = (population: number) => {
      const G = pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']);
      G.resources = emptyResources();
      G.resources.population = population;
      return enablerPotential(G, m);
    };
    expect(pot(0)).toBe(0);
    expect(pot(5)).toBeGreaterThan(pot(0));
    expect(pot(100)).toBe(pot(50)); // saturates at the cap — hoarding population past it earns nothing
  });

  it('does not double-credit population when it is itself the objective (Masonry)', () => {
    // Masonry's win *is* population, so it's scored directly, not as an enabler — the same skip the
    // spend-a-resource enablers apply to a goal-valued cost resource.
    const m = deriveEnablers(masonryRoot());
    expect(m.weight.population ?? 0).toBe(0);
  });
});

describe('intrinsic strategic floor', () => {
  // Sandbox never wins (`met: () => false`, measure pinned at 0), so neither probe registers and every
  // objective-derived credit is zero — the case the floor exists for. (A card-count goal no longer
  // qualifies: the card probe derives real credits there.)
  function floorOnlyRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['hut', 'hut', 'farm', 'farm', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'sandbox',
      seed: 'enablers-intrinsic',
    });
    return createRun(config).G;
  }

  it('credits all three strategic pools on an objective that values nothing', () => {
    const m = deriveEnablers(floorOnlyRoot());
    for (const k of ['territory', 'population', 'culture'] as const) {
      expect(m.weight[k] ?? 0, k).toBeGreaterThan(0);
      expect(m.cap[k], k).toBeDefined();
    }
  });

  it('rises with a held strategic pool where the derived model alone would be flat', () => {
    const m = deriveEnablers(floorOnlyRoot());
    const pot = (population: number) => {
      const G = floorOnlyRoot();
      G.resources = emptyResources();
      G.resources.population = population;
      return enablerPotential(G, m);
    };
    expect(pot(3)).toBeGreaterThan(pot(0));
  });

  it('does not downgrade a pool the objective genuinely runs through', () => {
    // Masonry's territory carries a real derived throughput credit (the slot a Hut needs); composing the
    // floor as a `max` must leave that strictly above the bare floor.
    const derived = deriveEnablers(masonryRoot()).weight.territory!;
    expect(derived).toBeGreaterThan(deriveEnablers(floorOnlyRoot()).weight.territory!);
  });

  it('stays below a goal step, so engine never outbids the objective it serves', () => {
    // The floor is a growth nudge, not a competing goal: a fully saturated strategic pool must score under a
    // single unit of objective progress.
    const m = deriveEnablers(floorOnlyRoot());
    const saturated = m.weight.population! * m.cap.population!;
    expect(saturated).toBeLessThan(OBJECTIVE_WEIGHT);
  });
});

describe('card-cost goal valuation', () => {
  // Writing wins on a *card count* (clay tablets in `removed`), so no resource moves `objectiveProgress`
  // directly — the card probe is what makes the tablet's cost bankable. The mission itself seeds the
  // tablets into the deck, so the probe finds them through the real injection path.
  function writingRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'toolmaking', 'toolmaking', 'farm', 'bow', 'storytelling', 'storytelling'],
      board: 'city',
      missionId: 'writing',
      seed: 'enablers-card-cost',
    });
    return createRun(config).G;
  }

  /** The score credit one recorded tablet yields — the goal step the banked cost converts into. */
  function tabletStep(): number {
    const G = writingRoot();
    const before = objectiveProgress(G);
    G.removed.push({ id: -1, cardId: 'clay_tablet' });
    return (objectiveProgress(G) - before) * OBJECTIVE_WEIGHT;
  }

  it('banks each of the goal card\'s cost resources, capped at one card\'s worth', () => {
    const m = deriveEnablers(writingRoot());
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(CARDS.clay_tablet.cost.production!);
    expect(m.weight.food ?? 0).toBeGreaterThan(0);
    expect(m.cap.food).toBe(CARDS.clay_tablet.cost.food!);
  });

  it('attributes the goal step proportionally: one shared per-unit marginal across the cost keys', () => {
    const m = deriveEnablers(writingRoot());
    expect(m.weight.production).toBe(m.weight.food);
  });

  it('keeps a full cost bank worth strictly less than the goal step it converts into (sound shaping)', () => {
    const m = deriveEnablers(writingRoot());
    const fullBank = m.weight.production! * m.cap.production! + m.weight.food! * m.cap.food!;
    expect(fullBank).toBeGreaterThan(0);
    expect(fullBank).toBeLessThan(tabletStep());
  });

  it('rises with the banked cost then saturates at the card\'s cost', () => {
    const m = deriveEnablers(writingRoot());
    const pot = (production: number) => {
      const G = writingRoot();
      G.resources = emptyResources();
      G.resources.production = production;
      return enablerPotential(G, m);
    };
    const cost = CARDS.clay_tablet.cost.production!;
    expect(pot(cost - 2)).toBeGreaterThan(pot(0));
    expect(pot(cost + 5)).toBe(pot(cost));
  });

  it('prices the cost\'s producers durably but leaves the capacity passes at the floor (confinement)', () => {
    const m = deriveEnablers(writingRoot());
    // Forge produces production — a banked-toward resource — so the durable credit prices owning one...
    expect(m.producerCredit.forge ?? 0).toBeGreaterThan(0);
    // ...but the strategic pools stay at the same floor a gradient-free objective leaves: the capacity
    // passes price engine at a per-round accrual this stepped gradient never pays, so feeding them the
    // card marginal makes engine sinks out-compete the banking itself.
    const sandboxSame = deriveEnablers(
      createRun(
        simConfig({
          deckCardIds: ['forge', 'forge', 'toolmaking', 'toolmaking', 'farm', 'bow', 'storytelling', 'storytelling'],
          board: 'city',
          missionId: 'sandbox',
          seed: 'enablers-card-cost',
        }),
      ).G,
    );
    expect(m.weight.population).toBe(sandboxSame.weight.population);
    expect(m.weight.territory).toBe(sandboxSame.weight.territory);
  });

  it('probes the tableau for a building-presence goal, keeping the best marginal per resource', () => {
    // Growing Numbers counts hut+farm *present in the tableau* — the tableau injection, not `removed`.
    // Both cost only production and move the goal equally, so the cheaper card carries the higher
    // per-unit marginal and its cost sets the cap.
    const config = simConfig({
      deckCardIds: ['hut', 'hut', 'farm', 'farm', 'foraging', 'foraging', 'toolmaking', 'toolmaking'],
      board: 'settlement',
      missionId: 'growing_numbers',
      seed: 'enablers-card-cost',
    });
    const m = deriveEnablers(createRun(config).G);
    expect(m.weight.production ?? 0).toBeGreaterThan(0);
    expect(m.cap.production).toBe(CARDS.farm.cost.production!);
  });

  it('registers nothing on a resource-threshold objective, so those missions\' models are untouched', () => {
    // The guarantee the acceptance sweep leans on: on every mission whose goals read only `G.resources`,
    // the probe is provably a no-op, so `deriveEnablers` output — and hence every planner/oracle
    // trajectory — is unchanged by this layer. A broad deck widens the candidate pool the probe injects.
    const resourceMissions = [
      'first_settlement', 'rites_rituals', 'restless_people', 'reading_seasons',
      'first_temple', 'masonry', 'accounting', 'pyramid',
    ];
    const deckCardIds = [
      'hut', 'farm', 'forge', 'toolmaking', 'conquest', 'beer',
      'storytelling', 'bow', 'dogs', 'foraging', 'jewelry', 'cave_art',
    ];
    for (const missionId of resourceMissions) {
      const G = createRun(simConfig({ deckCardIds, board: 'settlement', missionId, seed: 'enablers-card-cost' })).G;
      expect(goalValuedCardCosts(G), missionId).toEqual({});
    }
  });

  it('values a mission-seeded event\'s cost through the `removed` count it feeds', () => {
    const config = simConfig({
      deckCardIds: ['bow', 'bow', 'dogs', 'dogs', 'foraging', 'foraging'],
      board: 'settlement',
      missionId: 'raiders_at_border',
      seed: 'enablers-card-cost',
    });
    const m = deriveEnablers(createRun(config).G);
    expect(m.weight.military ?? 0).toBeGreaterThan(0);
    expect(m.cap.military).toBe(CARDS.raider.cost.military!);
  });
});

describe('durable producer credit', () => {
  // First Settlement wins on production, so the Forge produces the goal resource directly — the case whose
  // per-unit worth lives in the goal-valued map and never in `weight` (the consumables loop skips a
  // goal-valued cost), and so the one a `weight`-only credit would silently price at zero.
  function producerRoot(): GameState {
    const config = simConfig({
      deckCardIds: ['forge', 'forge', 'archives', 'archives', 'hut', 'hut', 'bow', 'bow'],
      board: 'tribe',
      missionId: 'first_settlement',
      seed: 'enablers-durable',
    });
    return createRun(config).G;
  }

  /** The model's potential with `cardId` owned once, at the given staffing. */
  function withBuilding(cardId: string, workers: number): number {
    const G = producerRoot();
    const m = deriveEnablers(G);
    addBuilding(G, cardId);
    G.tableau[G.tableau.length - 1]!.workers = workers;
    return enablerPotential(G, m);
  }

  it('credits a producer of the goal resource', () => {
    expect(deriveEnablers(producerRoot()).producerCredit.forge ?? 0).toBeGreaterThan(0);
  });

  it('rates a goal-resource producer above one whose output nothing values', () => {
    const m = deriveEnablers(producerRoot());
    expect(m.producerCredit.forge!).toBeGreaterThan(m.producerCredit.archives ?? 0);
  });

  it('credits ownership, not staffing — an unstaffed structure is still a re-staffable option', () => {
    const bare = enablerPotential(producerRoot(), deriveEnablers(producerRoot()));
    expect(withBuilding('forge', 0)).toBeGreaterThan(bare);
    expect(withBuilding('forge', 0)).toBe(withBuilding('forge', 1));
  });

  it('credits nothing for a one-shot placement grant', () => {
    // Hut grants population on `effect`, not `produces` — not durable income, and the strategic weights
    // already credit the population it lands.
    expect(deriveEnablers(producerRoot()).producerCredit.hut).toBeUndefined();
  });

  it('saturates, so a tableau of engine never outbids the objective it serves', () => {
    // Read the *durable* term in isolation — the marginal forge past the cap — so a board rebalance moving
    // the starting pools can't break this for reasons unrelated to the credit.
    const G = producerRoot();
    const m = deriveEnablers(G);
    for (let i = 0; i < 40; i++) addBuilding(G, 'forge');
    const saturated = enablerPotential(G, m);
    addBuilding(G, 'forge');
    expect(enablerPotential(G, m)).toBe(saturated);
    expect(m.producerCredit.forge! * 41).toBeGreaterThan(OBJECTIVE_WEIGHT); // the cap is what bound it
  });
});

describe('culture enabler', () => {
  // First Settlement wins on production/military; culture is *not* goal-valued, so a producer gated behind a
  // culture level makes reaching that level an enabler. Göbekli Tepe is gated at culture level 1 and produces
  // production (a goal resource here).
  function firstSettlementRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'tribe', missionId: 'first_settlement', seed: 'enablers-culture' });
    return createRun(config).G;
  }

  // Rites & Rituals wins *at* a culture level, so culture is goal-valued there — used to pin the gate-unlock
  // skip and, contrastingly, the hand-size credit that survives it.
  function ritesRoot(deckCardIds: string[]): GameState {
    const config = simConfig({ deckCardIds, board: 'settlement', missionId: 'rites_rituals', seed: 'enablers-culture-skip' });
    return createRun(config).G;
  }

  it('credits the culture level that ungates a goal producer, when culture is not goal-valued', () => {
    const m = deriveEnablers(firstSettlementRoot(['gobekli_tepe', 'toolmaking', 'bow', 'bow']));
    expect(m.weight.culture ?? 0).toBeGreaterThan(0);
    expect(m.cap.culture ?? 0).toBeGreaterThan(0);
  });

  it('skips the gate-unlock when culture is itself the objective', () => {
    // Reaching the level *is* the win on Rites, scored directly — so the gated producer isn't a separate enabler.
    const m = deriveEnablers(ritesRoot(['gobekli_tepe', 'burial', 'burial']));
    expect(m.weight.culture ?? 0).toBe(0);
  });

  it('credits hand-size throughput per culture level even when culture is goal-valued', () => {
    // A bigger hand helps every goal, not the one the level might be — so unlike the gate-unlock it rides no
    // skip. Level-based (not linear in raw culture): flat within a level, a step up at each new level.
    const m = deriveEnablers(ritesRoot(['burial', 'burial', 'foraging']));
    expect(m.handsizePerLevel ?? 0).toBeGreaterThan(0);
    const pot = (culture: number) => {
      const G = ritesRoot(['burial', 'burial', 'foraging']);
      G.resources = emptyResources();
      G.resources.culture = culture;
      return enablerPotential(G, m);
    };
    expect(pot(cultureForLevel(1))).toBeGreaterThan(pot(0));
    expect(pot(cultureForLevel(2))).toBeGreaterThan(pot(cultureForLevel(1)));
  });

  it('sets no hand-size credit when the deck cannot grow culture', () => {
    const m = deriveEnablers(pyramidRoot(['toolmaking', 'toolmaking', 'foraging', 'foraging']));
    expect(m.handsizePerLevel).toBeUndefined();
  });
});
