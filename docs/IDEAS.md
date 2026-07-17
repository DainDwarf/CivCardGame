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

## Bronze Age

Centralized, elite-controlled, trade-dependent palace civilizations.

No coins, those are iron age
For the trade: Wheel for the first trade works? Get a few money producing work, and bronzeworking building that use money to produce prod.
Issue: Current jewelry card is already strong at making money
Writing
Sailing
Tin trade
Swords
Chariot (military)
Masonry (walls, houses)
Military also important: Defend your trade routes (event that sucks out money?)

City board? Should not be too op, what's the drawback?

Ziggurat
Hammurabi code

Unlock the "Fall of the bronze age" endless mission near the end? (increasing money/military/production pressure)

## Iron Age

More decentralized, broader-based societies with cheaper metal, wider literacy
(alphabet), citizen armies, and new political forms — often emerging *after* a collapse.
coins
hoplites
legions

## Post-classical/medieval/Paper Age? Steel Age? (*crucible* steel, is rare, but was around that period. Paper is a more defining tech, this period widespread the use of paper)

## Colonization/Globalization/**Gunpowder Age**

## Steam Age

## Electric Age

## Computer Age

## Space Age?

## Simulator / balance-tooling ideas

User note: Maybe perfect oracle can be useful for testing various decks?

The headless sim (`src/sim/`) brackets skill with five move policies
(random · heuristic · greedy · greedy2 · **`planner`**, below, now built) plus the
**`oracle`**. Policies are really a *skill ladder* — random pins the floor, the greedies
sit at "reasonable play," the planner is competent-but-fair play, the oracle raises the
true ceiling, and the useful signal is the **spread** between brackets. Candidate
additions that widen or raise that ladder:

- **`planner` (bounded determinized expectimax + beam)** — *built* (`sim/plannerPolicy.ts`).
  The honest middle between the one-ply greedies (which plateau on a mission whose win
  needs a multi-turn conversion chain, e.g. Masonry) and the oracle (which cheats by
  reading the real shuffle). It samples fair worlds (`sim/determinize.ts` — the deck as
  an unordered multiset, never the real order), searches a few turns ahead in each, and
  averages (Perfect-Information Monte Carlo). This **answered the "reuse the same state
  reducing as the oracle?" question below — yes**: it reuses the oracle's within-turn
  search skeleton (extracted to `sim/turnSearch.ts`) and multiset key (`sim/oracleKey.ts`).
  What lets its horizon stay shallow (and cheap) is the **enabler potential**
  (`sim/enablers.ts`): a leaf-value term, derived mechanically from card data, that
  credits a banked resource for the objective progress it converts into — so the setup
  turns the greedies see as worthless become a climbable slope.
- **MCTS (Monte Carlo Tree Search)** — the standard strong-play policy for this kind
  of game: selectively grow a search tree and spend random rollouts on the promising
  branches (UCB to balance explore/exploit). Would give a near-optimal *"how good can
  this deck/mission actually be played?"* upper bound — a real ceiling above the
  greedies, at the cost of being the heaviest to build and slowest to run. Needs no
  hand-written score function (it plays rollouts to the end and counts wins), though a
  cheaper **flat Monte Carlo** variant (rollouts per action, no tree) is a lighter
  first step toward it. (Weaker fit than the `planner` here: the win is a precise
  multi-play chain, so random rollouts almost never hit it and back up no signal.)
- **Archetype / persona policies** — scripted *human* play styles rather than optimizers:
  a rusher (race the objective), a turtle (hoard/over-staff), a greedy-economy builder, a
  misplay-prone novice (right idea, frequent small mistakes). These don't try to be good —
  they try to be *representative*, so win-rate numbers reflect real audiences instead of
  only best-case or worst-case play.

> (The deeper N-ply/expectimax + beam idea is now the built `planner` above — and yes, it
> reuses the oracle's state-reducing skeleton (`sim/turnSearch.ts`) and multiset key.
> Still open: evolutionary weight-tuning of the existing heuristic.)
