# CivCardGame — Ideas (unpolished)

> A scratch list of **unpolished ideas** — mission/campaign flavor, and now also
> tooling/simulator directions — caught during design research. *Not* committed
> content: anything here is a candidate, not a promise. Decided, designed work lives
> in [`DESIGN.md`](DESIGN.md); mechanics-level idea jots live in [`TODO.md`](TODO.md).
> This file collects the *narrative/age framing* we might build missions around, plus
> longer-horizon tooling bets, before any of it is real.

## Random Ideas

 - Decreasing effectiveness of old cards? (If card comes from 2 ages ago, output -1, -2, etc?)
 - **Parameterized objective/threat cards** — today an "N-of-something" mission
   (`raiders_at_border`) needs an exported tuning const in `content/cards.ts`
   (`RAIDER_WAVES`) shared between the mission's seed and the card's
   predicate. Objective cards stay **bespoke 1:1** with missions, so one const per such
   mission is fine and this is deliberately *not* done. **If that floating-const growth ever
   gets annoying** (or you want one reusable "defeat N waves" / "survive N rounds" card across
   many missions), the structural fix is to make the *mission* own the number: `MissionDef`
   carries it, and setup threads it onto the seeded objective/threat instance's `counters`, so
   the card reads it via `getCounter(self, …)` and no shared const exists. Plumbing checked:
   `rules/objective.ts`'s `seedObjective` would just grow a `counters` arg (it already mints
   the instance), and `sim/objective.ts` would read the counter off the objective instance
   instead of importing the const. Note the dependency direction rules out the naive move —
   `cards.ts` is upstream of `missions.ts`, so a card can't import a const *from* the mission;
   the counter thread is the only cycle-free way to give the mission ownership.

## Stone Age

The opening age. Strong through-line is **surplus**: domestication → storage → the
population and specialists that surplus allows → the culture/monuments specialists
produce. Sequencing missions along that chain lets the age *teach* the economy.

- **Granary** — storage of surplus through winter. Buffers food against upkeep / Protects against food affecting events
  - *Storage as a deck-limit lever:* storage techs (and their missions) could raise the
    **deck limit**.
  - *Holdover buildings:* buildings that let you **keep cards from being discarded turn
    to turn** (a card held over instead of recycled at end of turn) — the hand-level
    mirror of storing surplus.
- **Domestication** (animals) — herds as a less labor-intensive food/materials source
  that costs territory. Livestock only here (goats/sheep/cattle — they came *with*
  farming). 
- **Pottery** — surplus storage and cooking; a low-cost early building.
- **Walls** — earliest monumental fortification (Jericho); defensive mission flavor.
- **Burial site** — ancestor/burial cult; culture output tied to the dead.
- **Calendar** — the age's **science/foresight** entry. Agricultural astronomy (Warren
  Field ~8,000 BCE, Nabta Playa): knowing *when* to plant/harvest. Flavor as a
  prediction/timing mechanic — peek the deck, foresee an event, buff the next harvest.
  Keep distinct from Burial site: culture (the dead) vs. science (the seasons).


> Keep copper/metallurgy and the wheel **out** of this age — both are really
> Chalcolithic/Bronze. Good "graduated the Stone Age" unlocks to bridge to the next age.

## Bronze Age

Centralized, elite-controlled, trade-dependent palace civilizations.

For the trade: Wheel for the first trade works? Get a few money producing work, and bronzeworking building that use money to produce prod.
Issue: Current jewelry card is already strong at making money

Military also important: Defend your trade routes (event that sucks out money?)

Empire board? Should not be too op, what's the drawback?

Ziggurat
Hammurabi code

Unlock the "Fall of the bronze age" endless mission near the end? (increasing money/military/production pressure)

## Iron Age

More decentralized, broader-based societies with cheaper metal, wider literacy
(alphabet), citizen armies, and new political forms — often emerging *after* a collapse.

## Post-classical/medieval/Paper Age? Steel Age? (*crucible* steel, is rare, but was around that period. Paper is a more defining tech, this period widespread the use of paper)

## Colonization/Globalization/**Gunpowder Age**

## Steam Age

## Electric Age

## Computer Age

## Space Age?

## Simulator / balance-tooling ideas

User note: Maybe perfect oracle can be useful for testing various decks?

The headless sim (`src/sim/`) brackets skill with four move policies
(random · heuristic · greedy · greedy2) plus the **`oracle`** (below, now built).
Policies are really a *skill ladder* — random pins the floor, the greedies sit at
"reasonable play," the oracle raises the true ceiling, and the useful signal is the
**spread** between brackets. Candidate additions that widen or raise that ladder:

- **MCTS (Monte Carlo Tree Search)** — the standard strong-play policy for this kind
  of game: selectively grow a search tree and spend random rollouts on the promising
  branches (UCB to balance explore/exploit). Would give a near-optimal *"how good can
  this deck/mission actually be played?"* upper bound — a real ceiling above the
  greedies, at the cost of being the heaviest to build and slowest to run. Needs no
  hand-written score function (it plays rollouts to the end and counts wins), though a
  cheaper **flat Monte Carlo** variant (rollouts per action, no tree) is a lighter
  first step toward it.
- **Archetype / persona policies** — scripted *human* play styles rather than optimizers:
  a rusher (race the objective), a turtle (hoard/over-staff), a greedy-economy builder, a
  misplay-prone novice (right idea, frequent small mistakes). These don't try to be good —
  they try to be *representative*, so win-rate numbers reflect real audiences instead of
  only best-case or worst-case play.

> (Discussed but lower-priority: deeper N-ply/expectimax or beam search above greedy2,
> and evolutionary weight-tuning of the existing heuristic — kept out here to keep the
> list to the higher-value bets. Can it also reuse the same state reducing than oracle?)
