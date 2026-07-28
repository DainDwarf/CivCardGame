# Rites & Rituals *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch restructure
> that created this slot is in [`../REBALANCE.md`](../REBALANCE.md) → *Culture leaves the Stone Age*.
> Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
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
node opens: **Beer** (1🌾 → 2🎭 work card, from `first_trades`) and **Sun Stone** (4🔨 → 2🎭/worker
building, from `reading_seasons`) — two different *kinds* of producer, which is the choice the mission
is about.

## Balance 🟡 — swept once, threshold still open

Swept on the arrival deck: Founding + one copy of every card the six cleared prereqs granted (22 cards,
Farm/Hut/Conquest/Bead Workshop/Bartering/Beer/Storytelling/Fire/Sun Stone/Calendar), no purchases, both
launchable boards. Chiefdom is read at its **new 8🌾** — this cell is what moved that number, so the
6🌾 column lives in REBALANCE → *Chiefdom* rather than here.

| policy | Settlement | Chiefdom (8🌾) |
|---|---|---|
| random @100 | 10% | 0% |
| heuristic @100 | 48% | 8% |
| greedy @100 | 95% | 0% |
| planner @100 | 85% | 40% |
| oracle @10 | 100%, median **6** turns | 100%, median 11.5 |

**Settlement is the easy read and the worrying one.** The oracle wins in 6 turns against 13–16 at the
three missions before it, and its line leaves Farm, Hut, Bead Workshop, Bartering and Calendar unplayed
— it reaches 10🎭 off Beer and Sun Stone alone before the economy is a question. That is the threshold
being cheap, measured, and it is the open item below.

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

**⚠️ The culture-level curve is settled here.** Levels sit at cumulative **10 / 30 / 70**
(`CULTURE_STEP = 10`, each band double the last, `rules/culture.ts`), set back when every converter ran
×2. Nothing in the rebalance had yet *asked* for a culture level, so the curve has had no mission to be
judged against — this is that mission. Expect the sweep to move **Beer's rate** rather than the curve.

⚠️ **10🎭 is trivially cheap — now measured, not suspected.** The oracle clears Settlement in a **6-turn
median** off Beer and Sun Stone alone, against 13–16 at the three missions before it. The predicted
"met incidentally by turn 6" is what the sweep found, so this is a node with no decision in it on the
settled board. Still to decide, in this order of preference — the two producers are freshly rated and
the curve is the oldest number here:

1. **Raise the threshold** to 🎭 level 2 (30🎭). Rejected once already on the grounds that it makes the
   node a strict subset of `first_temple`'s demand — but that argument was about the *goal shape*, and a
   6-turn clear is a stronger objection. Worth re-weighing rather than assumed dead.
2. **Cut the producers' rate** (Beer 2🎭, Sun Stone 2🎭/worker).
3. **Re-read the curve** (`CULTURE_STEP`, cumulative 10/30/70).

Whichever moves, Chiefdom is the constraint on how far: it sits at planner 40% *now*, so a threshold
raise has to be re-swept on both boards, not just the one that is too easy.

No baseline fixture yet — the committed set is one per *measured* mission, and the threshold is what
would date the fixture.

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
  Stone** (4🔨 → 2🎭/worker), granted by `reading_seasons`; Cave Art is cut. This node adopts neither.
- **`rules/objective.test.ts` / `sim/objective.test.ts` / `sim/enablers.test.ts`** needed no re-point:
  they read synthetic culture fixtures (`test_culture_objective`, `test_culture_win`) precisely so
  culture could re-enter the age without dragging tests behind it.

## Polish ⬜ (not started)
