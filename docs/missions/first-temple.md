# The First Temple — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the rate ledger every
> number here is measured against is in [`../REBALANCE.md`](../REBALANCE.md). Final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone — the **capstone**, on the centre axis after the culture reconvergence.
**Placement:** ✅ `prereqs: ['rites_rituals']`, stone **col 5 row 0**. Both Bronze roots
(`finding_copper`, `masonry`) and both infinite missions hang off it.
**Reward:** ✅ **12⭐ + the `gobekli_tepe` wonder** — the ⭐ amount provisional.

## Design 🟡

**Goal — 3 🧍 population and 🎭 culture level 2 at once** (`cultureForLevel(2)` = 30🎭). No threat and
no events; food upkeep is the only other pressure.

✅ **Decided at two terms.** The third was weighed and declined — see *Open*.

**4🧍 was tried first and dropped** — it is unreachable on the no-purchase arrival kit (below), which
made the capstone either Chiefdom-only or shop-gated. 3🧍 is exactly what the arrival deck reaches:
Settlement's pop 2 plus the age's single Hut.

### What the previous goal was, and why it went

It was a four-term conjunction — 3🧍 · 🎭 level 2 · **30🔨** · **30🪙** — and the two spendable terms
were the problem, in two separate ways.

**The 🪙 term fought the toolkit the arc had just handed the player.** Money's only faucet in the age is
Bead Workshop (1🪙/worker at `workers: 1`, so it scales by *copies* and slots, not by stacking); its only
sink is a Bartering route at 1🪙/round rent. The natural play — the one the two preceding missions teach
— is workshop + route, which nets **exactly 0🪙/round**. Hoarding 30 means running a *second* workshop
purely to out-pace the rent. Worse, it is a hoard goal on a one-way hub: DESIGN.md's *Core resources*
makes money a spend-outward resource, and this mission switched that off for its whole duration.

**The 🔨 term was a stockpile in the resource that builds everything.** At 1🔨/worker with no Forge until
mission 9, and ~10🔨 already owed to the Hut, Sun Stone, Workshop and Farm the other terms need, banking
30 on top means many rounds of not building. Shrinking it to 20 wouldn't have changed the mission — it
was still asking the player to stop spending.

Both are now gone as *terms* and stay load-bearing as *means*: 🔨 buys the Huts and the Sun Stone, 🪙 pays
the route's rent. Neither of the two remaining terms is a spendable pool, so nothing in the goal asks the
player to hold still.

### Why 3🧍 and not 4

Hut (+1🧍) is the age's only population source and an unlock grants one copy, so the no-purchase
arrival deck reaches **pop 3 on Settlement**. 4 would have meant either a shop purchase or the Chiefdom
board; 3 is what the arrival kit reaches on the board the campaign upgrades you onto.

### The constraint this goal binds — territory, and it is measured ✅

**Territory, not food.** Slots, not the food economy, are what the goal costs: a Sun Stone, a Hut, and
whatever food line pays upkeep all compete for the same four Settlement slots. The age's sole territory
source is **Conquest** (2⚔️ doubling per copy — 2, 4, 8 for the first three plays), fed by Hunting at
1⚔️/worker or Bow's one-shot 3⚔️.

**Confirmed by the sweep.** Every winning policy buys board: planner ends at **terr 6.3** and the oracle
at **5.9**, both from Settlement's starting 4, with Conquest played 232×/100 planner runs. This is the
first mission since `first_settlement` that gives Conquest a job.

## Balance 🟡

### Settlement, no purchases — the committed cell

Arrival deck (22 cards) on Settlement (10🌾 5🔨 · pop 2 · terr 4) — the fixture at
`scripts/sim/baselines/first_temple.json`.

| policy | win rate | turns (median) | defeat causes | mean end pop / terr / 🎭 |
|---|---|---|---|---|
| heuristic @100 | 28% | 201 | stall 57 · famine 15 | 2.5 / 5.1 / 59.7 |
| greedy @100 | 18% | 28 | famine 57 · stall 25 | 2.9 / 4.0 / 25.7 |
| planner @100 | **98%** | 46 | famine 2 | 3.0 / 6.3 / 29.4 |
| oracle @10 | **90%** | 40.5 (min 22) | famine 1 | 3.0 / 5.9 / 27.7 |

**Planner 98% matches `rites_rituals`' Settlement figure exactly**, and both deep rows agree the cell is
comfortably winnable. Planner and oracle each play **every card in the deck** (`unplayed: none`) — the
first Stone Age cell where that is true, Calendar included.

⚠️ **The number to weigh is the length, not the win rate: oracle median 40.5 turns**, against 11 at
`rites_rituals` and the 13–16 band the three missions before it sit in. That is ~3× the age's longest
measured mission. Expected direction for a capstone; the magnitude is the open call (*Open*).

**Heuristic's row is a policy artifact, not a difficulty reading** — its median 201 turns *is* the
`--max-rounds` cutoff, 57 of its 100 runs are recorded as `stall`, and it ends on a mean 59.7🎭 against
a threshold of 30. It idles past the win rather than failing to reach it.

### Chiefdom — the other launchable board

Same arrival deck on Chiefdom (8🌾 2🔨 6⚔️ · pop 3 · terr 2), ad-hoc rather than committed since the
standing set is one cell per mission. **Chiefdom starts at pop 3, so the 🧍 term is met at setup** — the
goal here is a pure culture race, and the oracle never plays Hut at all.

| policy | win rate | turns (median) | defeat causes | mean end pop / terr / 🎭 |
|---|---|---|---|---|
| heuristic @100 | 37% | 32 | famine 63 | 3.4 / 3.9 / 12.5 |
| greedy @100 | 0% | 10 | famine 99 · stall 1 | 3.0 / 2.0 / 0.0 |
| planner @100 | 62% | 49 | famine 38 | 3.1 / 4.5 / 19.3 |
| oracle @10 | **90%** | 44 | famine 1 | 3.0 / 4.5 / 27.0 |

**Dropping 4🧍 → 3🧍 removed the famines and the stalls.** Against the same cell measured at 4🧍:
heuristic 2% → **37%** (famine 69 → 63, stall 29 → **0**), planner 9% → **62%** (famine 79 → 38, stall
12 → **0**), oracle 0/10 → **9/10**. Greedy is unmoved at 0% either way — it dies at median turn 10 with
`hut · conquest · beer · calendar` unplayed, the same row as before.

**The two boards converge at the ceiling**: oracle 90% at median 44 turns here against 90% at 40.5 on
Settlement. They diverge at the fair-competent tier — planner 62% vs 98% — which is the same
Settlement-easier ordering every other Stone Age cell shows.

### Fixture ✅ re-cut

`scripts/sim/baselines/first_temple.json` is now the **arrival deck**: Founding + one copy of every card
the seven cleared prereqs grant (Farm · Hut · Conquest · Bead Workshop · Bartering · Beer · Storytelling
· Fire · Sun Stone · Calendar), no purchases, on Settlement — the same shape [rites](rites.md) uses, and
identical to its pool since `rites_rituals` grants a sticker rather than a card. The previous fixture
stocked **Cave Art** and a **Burial**-turned-Sun-Stone and was missing **Fire**; re-cutting it leaves
**five** baselines blocking Cave Art's deletion.

✅ **Results committed** — the `first_temple` rows in `baselines/results/` are re-measured on this
fixture: `greedy-planner.json` (greedy 18% · planner 98% @100) and `oracle.json` (90% @10). The rows
they replaced were void, having been taken on both the old deck and the old goal.

## Open

- ✅ **~40 turns is the accepted length for the capstone.** Planner 98% / oracle 90% put difficulty
  beyond question, so the only live issue was **duration** — an oracle median of 40.5 turns (44 on
  Chiefdom) against `rites_rituals`' 11 and the age's 13–16 band, ~3× the longest mission a player has
  met by here. Accepted as the capstone's identity rather than tuned away; culture level 2 (30🎭 at
  ~1🎭/worker/round) is what sets it and stays.
- ✅ **Two terms, no third.** The 3🧍 term is reached incidentally by every winning line (planner and
  oracle both end at exactly 3.0), so the goal is in practice a culture race with a Hut attached. The
  reserve third term — **one standing trade route**, costing rent rather than a worker or a slot (so it
  no longer presses on territory, the dimension the sweep proved binding) — was weighed and **declined**: it repeats The
  First Trades' own term, and the cell measures healthily without it. It stays on the shelf if the money
  strand below forces a re-open.
- ⚠️ **Money is stranded in the Stone Age.** With 30🪙 gone, the age's only 🪙 demand is a route's
  own rent — a faucet and a sink that exactly cancel, with nothing else to spend on until Pyramid's 6🪙
  build cost in Bronze. That is coherent with the one-way hub (money buys food throughput, and that is
  its job) but it means **no mission in the age asks for money in quantity**, which was the previous
  goal's one virtue. **Carried forward unresolved** — it is an age-level question, not this mission's to
  answer alone; the natural place to settle it is whichever Bronze mission re-points onto money
  (REBALANCE → *Trader's home is open*).
- **12⭐ is provisional**, and arrival at this node moved 40 → **50⭐** when the culture mission was
  inserted (REBALANCE → *Open*). Both numbers want a look together, not separately.
- ✅ **Göbekli Tepe stands as printed** — 8🔨 / `cultureLevelReq: 1` / 3 workers for +1🔨 +1🪙 +1🎭 per
  worker. Read as stronger than a regular building without being oppressive, and left alone. It is the
  *reward*, so its first real outing is `finding_copper` or `masonry`; its 3-worker capacity is also the
  first card that wants population past this goal's 3, which is the Bronze arc's problem to feed.

## Polish ⬜ (not started)
