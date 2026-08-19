# Setting Sail — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the opening node of the **naval / trade** branch (Setting Sail →
[Sea Lanes](sea-lanes.md)). Prereq **writing**; the branch converges into **Bronze**.
**Placement:** bronze col 9 row +1 — parallel to [Roads](roads.md) (col 9 row −1) and
[Horse taming](horse-taming.md) (col 9 row 0).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Branch identity (agreed)

**The sea is land you don't have to conquer.** A trade route takes no territory and no workers — it is
bounded only by its rent — so Naval is the answer to the same squeeze the Wheel branch answers by
expanding: grow without a slot. Two consequences the branch is built to cash in:

- **The trade zone becomes a system.** `bartering` is the only `kind: 'trade'` card in the game; the
  zone's rules (standing rent, no worker, no land, *nothing closes a route*) are almost unexercised.
- **🪙 is spent as the win act, not hoarded.** No mission in the age has a money *win cost* — Copper and
  Writing charge 🔨+🔬, Roads 🔨, Horse taming and Raiding ⚔️, and Accounting asks you to *hold* 🪙
  without ever spending it. [`DESIGN.md`](../DESIGN.md) makes money the currency of standing access;
  this branch is where a mission finally charges in it.

This node is the **ships**: outfitting and launching the voyages that open the coast.

## Goal ✅

**Seeded completion, priced in 🪙.** N seeded `voyage` `event` cards; launching one means *playing* it,
paying its **🪙 + 🔨** outfitting cost (a hull and a season's provisions) → exiled to `removed`, which
the goal counts — the Copper / Writing / Roads seeded-completion pattern. Money can't be hoarded into
the win; it has to be converted.

A voyage left **unlaunched bleeds nothing** — it files to discard and recurs, harmlessly. Deliberate:
[Roads](roads.md) and [Writing](writing.md) put the pressure *on the seeded events*, and all of this
mission's lives in the two rules below, so it isn't a third events-that-bleed mission.

## Pressure ✅

Two rules, neither of them a drain. **The clock sets a pace; the crew cost makes that pace harder to
keep every time you meet it.**

### The crews won't wait — a pace clock, running from round 1

An `impatient_crews` threat: each round that ends with no voyage launched bumps an idle counter, a
launch resets it to **0**, and its `defeat` hook fires at **K consecutive idle rounds** — *the crews
took berths in another port*.

It is not a deadline on the mission, it is a deadline on **stalling**. A patient build is fine at any
length so long as it is punctuated; what the mission forbids is going quiet. Distinct from the one
other `defeat` hook in the age ([Pyramid](pyramid.md)'s, which is absolute, round-counted and on a
leaf) because this one is relative and resets.

**Mechanism** — no engine verb, and no coupling from the voyage card to the threat. The threat reads
the board itself through a shared `voyagesLaunched(G)` (voyages in `G.removed`), the `tamedHorses`
precedent from [Horse taming](horse-taming.md): one helper behind the win threshold, its readout *and*
the clock, so the fleet the clock counts can't drift from the fleet the goal counts. Two per-instance
counters (launches seen at last tick, consecutive idle rounds) bumped on its own tick; `defeat` stays a
pure read. `applyUpkeep` runs the `endTurn` broadcast *after* the player's plays, so a voyage launched
this round is already in `removed` when the clock looks at it.

**Launching on the round the clock would run out is safe**, and by the reset rather than by a race:
`applyUpkeep` ticks the threat in its `endTurn` dispatch and only then calls `flushEvents`, which is
where `evaluateDefeat` re-derives the flag — so the counter is back to 0 before anything reads it.
[Sea Lanes](sea-lanes.md) answers the same question the other way (its ⚔️ is a core-pool collapse, and
`checkEndIf` checks victory first); here the predicate never becomes true at all.

### The crew sails with it — the win act costs people

Launching takes one **free** citizen, permanently: `effect: { resources: { population: -1 } }`, gated by
a `CardCost.check` for `freePopulation(G) >= 1`.

- **Idle hands only** — a ship can't be crewed by pulling a worker off a farm. The gate is
  load-bearing rather than flavour: `freePopulation < 0` is an asserted run invariant.
- The first **strategic-pool cost** in the game, so it collides with no drain in the neighbourhood.
- `foodUpkeep` is `floor(pop²/4)`, so the mission hands back provisions as it takes labour — and that
  same superlinear curve is what makes carrying N spare citizens ruinous rather than routine.
- **Uniform 1🧍 per voyage.** The cost must not escalate: a shrinking economy escalates its *effect*
  for free, and printing a rising number on top would charge twice for one idea.
- Population is answerable on every prereq chain reaching here — **Hut** is the first mission's own
  reward and **House** comes from Masonry, which Accounting requires.

### Why the two compose

Each launch removes a citizen, so income falls, so the interval you can *afford* between launches
lengthens — while the clock goes on demanding the same one. The difficulty curve accelerates with no
escalating number authored anywhere, and the **last** voyage is the hard one, which is where the
seeded-completion pattern otherwise goes slack.

### The pressure is answered by digging, not by earning

With the clock running you need the *next* voyage in hand now, and unlaunched voyages recur through the
discard — so the deck, not the treasury, is where the answer is. Calendar's peek-and-take, the 🔬
faucet, and above all **Writing** (return a chosen card from discard to hand) become the mission's real
tools, and Writing is the *prereq node's own reward*: the tool is handed over exactly one node
upstream. This is the first mission in the game whose pressure is met by card manipulation, and the
first plausible job for Calendar, which [Writing](writing.md) records as near-dead in every sweep —
confirmed at Balance: Calendar's first live cell, though the Writing card itself stayed a
prover-only tool (see *Balance*).

### Why not a drain

Every drain shape in this neighbourhood of the DAG is spoken for, and a fourth mission bleeding the
same pool the same way reads as a re-skin. ⚔️ is the one core pool left, and [Sea Lanes](sea-lanes.md)
claims it per-route — the branch's own two nodes least of all should share a shape.

| shape | already used by |
|---|---|
| 🌾 drain growing as you win | [Horse taming](horse-taming.md) (tamed horses eat) |
| 🌾 flat per unfinished target | [Roads](roads.md) |
| 🔨 drain per staffed worker | [Copper](copper.md) |
| 🪙 drain shrinking as you win | [Raiding](raiding.md) |
| 🔬 escalating per unfinished target | [Writing](writing.md) |
| ⚔️ per open route | [Sea Lanes](sea-lanes.md) |

## Reward (agreed)

- **The Port board** — a **new** government (`unlockBoardIds`, the Chiefdom precedent), not an upgrade,
  so it opens a third board line rather than forking the settled or martial one.
- **Coastal Route** (`trade`) — the zone's second card. Load-bearing for the branch, not flavour:
  [Sea Lanes](sea-lanes.md)'s multi-route goal is unreachable with Bartering alone. **Bartering at
  Bronze scale**, the same buy-standing-yield-with-standing-rent shape landing on 🔨 rather than 🌾:
  3🪙 to open · +3🔨 each round · −2🪙 rent (provisional). Deliberately **not** a 🌾→🪙 route: money is a
  one-way hub in [`DESIGN.md`](../DESIGN.md), and a route paying *into* it would break that. Its net
  1.5🔨 per 🪙 is the Material Caravan's rate made permanent — the caravan pays out at once and is gone,
  the lane pays every round and the rent never stops.

### The Port board ✅

Economic identity carried by a **prebuilt Wharf** (the way Chiefdom carries the Raider Camp — a
standing rule as a visible card) paying **+1🎭 per open trade route**, on a board with a **single
citizen**: few hands, but the sea needs none. It is the one board whose output scales with the routes it
can open rather than with the workers it can feed.

🎭 rather than 🪙 so the Wharf can't duplicate the **Merchant Ship** ([Sea Lanes](sea-lanes.md)'s
reward), which is the per-route *money* payer — the two differ in currency, and the board stays off the
faucet the Ship already is.

The board and this mission read as one thought — the port that learned to work few hands is won by the
civilization that spent its people on the sea.

**Numbers (provisional):** 10🌾 · 5🔨 · 6🪙 · 1🧍 · 3🗺️, the Wharf standing in one of the three slots.

**Its balance pass belongs to [Sea Lanes](sea-lanes.md)**, the first mission it can be played on: no
fixture here can reach it (it *is* this mission's reward), and its short workforce meets that mission's
⚔️-per-route drain, so the two are one measurement. Names (Port / Wharf) are Polish's to confirm.

## Implement ✅ (shipped)

Seeded `voyage` events launching to `removed`; an `impatient_crews` threat whose tick maintains the idle
streak its `defeat` reads; the `coastal_route` trade card and the `port` board with its prebuilt `wharf`.

- **One new engine primitive: `setCounter`** (`rules/state.ts`, beside `bumpCounter`). Every counter
  shipped so far (`level`, `walls`, `plays`) is monotone; the idle streak is the first that **resets**,
  which `bumpCounter` alone can only spell as a bump by its own negated value. Everything else rides
  existing spines.
- **The clock owns two counters** — `seen` (launches at the last tick) and `idle` (consecutive quiet
  rounds) — bumped on its own `upkeep.resolve`, with `defeat` a pure read of `idle >= CREW_PATIENCE`.
  **Two launches in one round buy one reset, not two rounds of slack**: it counts quiet rounds, not
  unspent voyages, so the `N × K` ceiling isn't shortenable by banking.
- **The Voyage is the first card in the game to spend population.** It leaves through `effect`, not
  `cost.resources` — that field is core-pools-only by construction, paid blind past the staffing that
  gates the pool — with a `CardCost.check` (`freePopulation >= 1`) standing in for the gate the field
  would have carried. It needed a new `UnplayableReason` variant, `noIdlePopulation`.
- **Nothing else in the game lowers population** (checked across `content/`: only Hut +1 and House +2
  touch the pool, and no sticker or board sticker does), so that gate is the only guard the
  `freePopulation >= 0` run invariant needs.
- **Population can legally reach 0, and that ends the run** — the gate passes at one *free* citizen, so
  a pop-1 civilization may launch its last one, and **0🧍 is the universal `extinction` collapse**
  (`rules/collapse.ts`, checked in `checkEndIf` beside the core pools). `checkEndIf` reads victory
  first, so launching the last citizen on the voyage that *completes* the goal still wins; short of it,
  the run ends on that play rather than freezing until the crews leave.
- The **Wharf** pays through `produces.resolve` rather than a declarative bundle: the amount comes off
  `G.tradeRoutes.length`, which `resolveProduction`'s per-worker scaling can't express, and the box holds
  no workers to scale by.
- **Tests:** one synthetic pair for `setCounter` (a new engine primitive earns them);
  none for the content, which composes already-covered mechanisms — seeded completion, the
  played/unplayed event split, a threat reading a filtered count of `removed`
  (`sim/zoneOrderInvariance.test.ts` already carries that shape from Horse Taming), and a `defeat` hook.

Names provisional: **Voyage** (`event`), **Impatient Crews** (`threat`).

## Balance ✅

**Shipped numbers: N=3 · K=12 · 5🪙+5🔨 + 1 idle 🧍 per voyage**, from N=4 · K=6 · 4/4. The stockpile
the win asks for is near-unchanged (16🪙+16🔨 → 15🪙+15🔨); what moved is the pace clock, which at K=6
ended the median run on the *first* deadline before a single voyage launched.

Fixtures: `setting_sail_city` / `setting_sail_chiefdom` — one 26-card Bronze deck (bought copies and a
double-Irrigated Farm, fair from Finding Copper on) on both boards, since the campaign reaches this node
from either. Recorded at the standing protocol, with **`prover` in place of `oracle`**: the open question
here was winnability, and a `prover` rate is a lower bound on it where an `oracle` rate is a ceiling on
play.

| | greedy @100 | planner @100 | prover @10 |
|---|---|---|---|
| City | 4% | 15% | 6/10 proven |
| Chiefdom | 1% | 20% | 8/10 proven |

Defeats are the crews in the large majority (City 92/81 at the two tiers, Chiefdom 72/70); Chiefdom
adds a famine tail the City cell doesn't and leaks the more bankruptcy (20 of the greedy tier's 99
losses). Median winning run 20 turns (City) / 24 (Chiefdom) at the planner tier, against the 20–32 the
sibling Bronze nodes measure.

**Read the planner column as a scorer floor, not the mission's difficulty.** The prover proves 6–8 of
10 seeds winnable, and the gap is attributed: the race value prices *refusing* a launch three separate
ways, this mission's own entry in [`../TODO.md`](../TODO.md) → *Simulator · Fidelity* (its one-sided
fix was measured and reverted there). The two boards read within a few points of each other; the wide
City/Chiefdom gap earlier measurements showed was valuation blindness (the citizen a Voyage spends priced at zero — the planner
passed on affordable Houses and stranded itself at 0🧍), closed by the enabler pricing pass and
superseded by the race-scorer cutover the table is recorded under (both in `../TODO.md` → *Done /
shipped*).

**Calendar found its first real job, as designed**: the planner plays it in most runs (56/100 City,
67/100 Chiefdom) against zero in every earlier standard cell. The Writing card did not — ≤3 planner
plays per 100 on either board, alive only in prover lines — so the digging pressure is real but
Calendar answers it alone.

Two constraints that fell out of the design rather than measurement:

- **The run's hard ceiling is N×K rounds** (36), so the pair is chosen against those sibling medians.
- **K is also the deadline for the *first* launch**, which must be affordable out of a board's starting
  pools plus K rounds of income. Anchors for the price: Roadwork's 8🔨 and Trader's 3🪙 per worker-round.

The Port board is this mission's *reward*, so no fixture can reach it until
[Sea Lanes](sea-lanes.md) is authored — the same position Warband was left in by
[Raiding](raiding.md).

## Polish ⬜

Not started — card text, art, lore.
