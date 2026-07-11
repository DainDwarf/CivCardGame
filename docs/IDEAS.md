# CivCardGame — Ideas (unpolished)

> A scratch list of **unpolished ideas** — mission/campaign flavor, and now also
> tooling/simulator directions — caught during design research. *Not* committed
> content: anything here is a candidate, not a promise. Decided, designed work lives
> in [`DESIGN.md`](DESIGN.md); mechanics-level idea jots live in [`TODO.md`](TODO.md).
> This file collects the *narrative/age framing* we might build missions around, plus
> longer-horizon tooling bets, before any of it is real.

## Random Ideas

 - Decreasing effectiveness of old cards? (If card comes from 2 ages ago, output -1, -2, etc?)

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
- **Stone tools** — for a production / workshop building. Polished ground-stone tools =
  the literal "new stone" of Neolithic; efficiency flavor.
- **Walls** — earliest monumental fortification (Jericho); defensive mission flavor.
- **Burial site** — ancestor/burial cult; culture output tied to the dead.
- **Calendar** — the age's **science/foresight** entry. Agricultural astronomy (Warren
  Field ~8,000 BCE, Nabta Playa): knowing *when* to plant/harvest. Flavor as a
  prediction/timing mechanic — peek the deck, foresee an event, buff the next harvest.
  Keep distinct from Burial site: culture (the dead) vs. science (the seasons).
- **Beer** — fermentation converts food into culture (feasting/ritual; arguably helped
  drive cereal domestication).
- **Göbekli Tepe** - First world wonder?

> Keep copper/metallurgy and the wheel **out** of this age — both are really
> Chalcolithic/Bronze. Good "graduated the Stone Age" unlocks to bridge to the next age.

## Bronze Age

Centralized, elite-controlled, trade-dependent palace civilizations.

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

The headless sim (`src/sim/`) currently brackets skill with four policies
(random · heuristic · greedy · greedy2). Policies are really a *skill ladder* —
random pins the floor, the greedies sit at "reasonable play," and the useful signal
is the **spread** between brackets. Candidate additions that widen or raise that
ladder:

- **MCTS (Monte Carlo Tree Search)** — the standard strong-play policy for this kind
  of game: selectively grow a search tree and spend random rollouts on the promising
  branches (UCB to balance explore/exploit). Would give a near-optimal *"how good can
  this deck/mission actually be played?"* upper bound — a real ceiling above the
  greedies, at the cost of being the heaviest to build and slowest to run. Needs no
  hand-written score function (it plays rollouts to the end and counts wins), though a
  cheaper **flat Monte Carlo** variant (rollouts per action, no tree) is a lighter
  first step toward it.
- **Seeded perfect-information oracle** — runs are seeded and deterministic given the
  seed, so we can fix the seed, *reveal the whole shuffle*, and search for the genuinely
  optimal line of play. An **omniscient upper bound**: the best any player could do if
  they knew the future. Balance uses: if even the oracle can't clear a mission it's
  unwinnable; the oracle↔greedy gap measures how punishing variance is. Our determinism
  makes this unusually cheap for what it delivers.
- **Archetype / persona policies** — scripted *human* play styles rather than optimizers:
  a rusher (race the objective), a turtle (hoard/over-staff), a greedy-economy builder, a
  misplay-prone novice (right idea, frequent small mistakes). These don't try to be good —
  they try to be *representative*, so win-rate numbers reflect real audiences instead of
  only best-case or worst-case play.

> (Discussed but lower-priority: deeper N-ply/expectimax or beam search above greedy2,
> and evolutionary weight-tuning of the existing heuristic — kept out here to keep the
> list to the higher-value bets.)
