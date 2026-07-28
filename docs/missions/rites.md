# Rites & Rituals *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch restructure
> that created this slot is in [`../REBALANCE.md`](../REBALANCE.md) → *Culture leaves the Stone Age*.
> Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
**Branch:** Stone — the **reconvergence** of both branches, on the centre axis.
**Placement:** ✅ `prereqs: ['first_trades', 'reading_seasons']`, stone **col 4 row 0**; `first_temple`
re-points onto this node at col 5, and every Bronze mission shifts one column right behind it.
**Reward:** ✅ **10⭐, no unlock** — provisional on both halves (see *Open*).

**Decided ✅ — culture stays in the Stone Age**, on this node. The arc had lost its 🎭 twice over (the
original `rites_rituals` deleted for The First Trades, `restless_people`'s culture goal retired by the
Harsh Winter rewrite); this is where it comes back.

## Design ✅

Teaches **culture**, the age's last unexercised resource.

**Goal — 🎭 level 1** (`cultureForLevel(1)` = 10🎭), no threat and no events; food upkeep is the only
other pressure, the same shape `reading_seasons` has. Level 1 rather than 2 because **culture resets
every run**: at level 2 this node would demand exactly what `first_temple` demands, making it a strict
subset of the capstone instead of the step below it. The ladder is rites 1 → temple 2 → pyramid 2.

**Both 🎭 producers are in hand on arrival.** `prereqs` is an AND, so both tips are cleared before this
node opens: **Beer** (1🌾 → 1🎭 work card, from `first_trades`) and **Sun Stone** (3🔨 → 1🎭/worker
building, from `reading_seasons`) — two different *kinds* of producer, which is the choice the mission
is about.

## Balance 🟡 — Settlement settled, Chiefdom open

Swept on the arrival deck: Founding + one copy of every card the six cleared prereqs granted (22 cards,
Farm/Hut/Conquest/Bead Workshop/Bartering/Beer/Storytelling/Fire/Sun Stone/Calendar), no purchases, both
launchable boards. Chiefdom is read at its **new 8🌾** — this cell is what moved that number, so the
6🌾 column lives in REBALANCE → *Chiefdom* rather than here.

The producers were **halved at this cell** (Beer 2🎭 → **1🎭**; Sun Stone 4🔨 → **3🔨** and 2🎭 →
**1🎭**/worker), so both columns are given before and after:

| policy | Settlement, 2🎭 | **Settlement, 1🎭** | Chiefdom, 2🎭 | **Chiefdom, 1🎭** |
|---|---|---|---|---|
| random @100 | 10% | 1% | 0% | 0% |
| heuristic @100 | 48% | 60% | 8% | 32% |
| greedy @100 | 95% | 94% | 0% | 0% |
| planner @100 | 85% | **98%** | 40% | 40% |
| deepPlanner @10 | — | — | 90% | 90% |
| oracle @10 | 100%, median **6** | 100%, median **11** | 100%, median 11.5 | 90%, median **17.5** |

**The rate cut was a tempo fix, and it worked as one.** The oracle's Settlement median goes 6 → **11
turns**, in line with the 13–16 of the three missions before it, and Chiefdom's 11.5 → 17.5. The goal
stopped being met incidentally; the ceiling now has to build for it.

**Cutting the rate did not lower the win rates** — planner *rose* 85 → 98% on Settlement and heuristic
48 → 60%. The mission got longer, not harder, and the extra turns are turns the economy is also using.
Sun Stone's cheaper build price is most of that: heuristic plays it 66×/100 runs where the 4🔨 version
saw 5 on Chiefdom.

**3🔨, not 2🔨.** Both were swept. At 2🔨 the deepPlanner dipped to 60% on Chiefdom and the planner
preferred Sun Stone over Beer on that board (97 plays to 75); at 3🔨 deepPlanner is back to 90% and Beer
leads again (128 to 84). The third 🔨 is what keeps the *work card* worth owning next to the building.

**Chiefdom is a genuinely different mission**, not the same one harder: worker-rich and slot-poor, so
the food line has to be the highest-rate-per-*slot* rather than per worker, and the deck's only such
card is the Bartering route (2🌾/slot, no workers) against Farm's 1🌾. The oracle opens one in most of
its wins; on Settlement it never touches Bead Workshop or Bartering at all.

**Greedy's 0% on Chiefdom is a policy reading, not a content one.** Opening a route means spending a
slot and a worker on Bead Workshop while food's band-3 buffer target still sits at 9🌾 — the payoff
(that target collapsing 9 → 3 once the route runs) is two turns past a one-ply horizon. deepPlanner
clears it at 90% on the same cell.

**Calendar is played by every policy that plans** (planner 8–16 per 100 runs, oracle 2 per 10) and by
none that doesn't. Expected: `sim/value.ts` doesn't score hand contents, so a draw-a-card payoff is
invisible to a greedy argmax.

✅ **The culture-level curve holds, and the producers moved instead.** Levels stay at cumulative
**10 / 30 / 70** (`CULTURE_STEP = 10`, `rules/culture.ts`) — set back when every converter ran ×2, and
never judged against a mission until this one. Of the three knobs the too-cheap 6-turn clear opened —
raise the threshold to 🎭 level 2 · cut the producers · re-read the curve — the **producers** were the
right one, exactly as predicted: they were the freshly-rated numbers and the curve is the oldest here.
The threshold raise stays rejected on its original ground (at level 2 this node demands precisely what
`first_temple` does, and culture resets each run).

⬜ **Chiefdom is what is still open at 40% planner.** That is below every other measured Stone Age cell,
and the rate cut did not move it — Chiefdom's binding constraint is its slot/food economy, not the
culture rate, which is the same reading the food sweep gave. Whether 40% is acceptable for the *second*
board on an optional-choice node, or wants another lever, is the remaining call.

✅ **Fixture cut and recorded** — `scripts/sim/baselines/rites_rituals.json` (the deck above, on
Settlement), with its greedy/planner and oracle rows in `baselines/results/`. Settlement only: the
standing set is one cell per mission, and Chiefdom is measured in this dossier rather than committed,
the same way The First Trades records its Chiefdom sweep.

## Open

- **The reward's card half.** 10⭐ and no unlock today. Calendar was weighed for this slot and went to
  `reading_seasons` instead — the science hole it fills is that mission's, not this one's (REBALANCE →
  *Science gets its sink*). So the slot is open with no candidate: the node may simply stay
  Influence-only, which is a legal reward and one the sweep can judge.
- **The 10⭐ itself grows the faucet ledger**, unlike the branch restructure: the original mission's 8⭐
  was inherited by The First Trades precisely so downstream totals stayed put, and this node is a *new*
  faucet. Arrival at `first_temple` goes 40 → 50⭐ and at Masonry 52 → 62⭐ (`npm run economy`), which is
  what shop tiers and sticker prices are tuned against.

## Settled elsewhere

- **Nothing owed for Cave Art and Burial** — both were resolved upstream instead. Burial is now **Sun
  Stone** (3🔨 → 1🎭/worker), granted by `reading_seasons`; Cave Art is cut. This node adopts neither.
- **`rules/objective.test.ts` / `sim/objective.test.ts` / `sim/enablers.test.ts`** needed no re-point:
  they read synthetic culture fixtures (`test_culture_objective`, `test_culture_win`) precisely so
  culture could re-enter the age without dragging tests behind it.

## Polish ⬜ (not started)
