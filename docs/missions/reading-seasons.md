# Reading the Seasons — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch
> restructure that moved this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *The Stone Age DAG,
> restructured*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md`
> at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone, lower (row +1) — the **resource** mission, and its branch's tip.
**Placement:** ✅ **moved** by the restructure — `prereqs: ['harsh_winter']`, stone col 2 → **3**. It
used to open this branch; it now closes it.
**Reward:** 9⭐ + **Sun Stone · Calendar** (`unlockCardIds`).

**Goal — stockpile 10🔬.** No threat and no events; food upkeep is the only clock, the same shape
[The First Trades](first-trades.md) has opposite it.

## Design ✅

**Why it moved, and what that fixed.** Authored as the branch *opener*, it demanded a resource the
leaned starting collection makes none of — Storytelling had been cut, so a player arriving here owned
zero 🔬 sources and the mission was unpassable as written. The branch inverted to pressure-first:
[Harsh Winter](harsh-winter.md) now opens it and grants the science pair (Storytelling 1🔬/worker,
Fire 1🔬 for a discarded card), so the toolkit is owned before the mission that asks for it launches.

**The 10🔬 goal is unchanged** — the mission needed no rate move of its own. What changed around it is
the whole reason it works: a resource has to be granted before a mission can demand it.

### The rewards — a culture producer and science's first sink

**Sun Stone** — 3🔨 → **1🎭 per worker**, a building; the re-rated **Burial**. It is this branch's
culture card, and the convergence node downstream ([Rites](rites.md)) rests on there being exactly one
per tip: a player arriving there holds Sun Stone from this branch and **Beer** (a work card) from the
other, so the choice is between two *kinds* of producer rather than two copies of one. Both halves were
halved at that node's sweep — the rate above is post-cut, and the numbers behind it are
[rites](rites.md) → *Balance*.

**Calendar** — **2🔬 → look at the top 3 and draw one**, science's first sink.

The diagnosis it answers: Harsh Winter grants two cards that *make* science, this mission asks you to
bank 10🔬, and **nothing owned spent it**. The first sink of any kind was `finding_copper`'s Copper
Veins (5🔬 each) two missions downstream, and the first *card* sink Writing (2🔬), four downstream. So
the mission teaching you to stockpile a resource handed it over with nothing to do.

**Granting it here is what makes it legal.** Calendar was benched off Harsh Winter precisely because it
*spends* the resource the mission it fed asks you to bank — but a reward is granted **on clear**, so as
this mission's own reward it arrives after the run rather than during it. The objection lapses
entirely; it does not merely weaken. And it does not displace Sun Stone: this tip grants both, because
the one-producer-per-tip rule is about culture, not about the reward count.

**Why the rework, and why 2🔬.** The old Calendar was `1🔬 → look at the top 3`, look-only — a card
buying pure information, thin enough that "not worth a card at all" was half the charge against it.
Drawing one of the three makes it card *advantage*, which is worth 2🔬 — and the two cards passed over
keep their places on top of the pile rather than shuffling back, so the information survives the draw
and the play does two things. Priced against **Writing** (2🔬, return a chosen card from the discard),
the pair splits cleanly: Writing has far wider selection, Calendar has the residual knowledge and no
non-empty-discard precondition. Neither is strictly worse, and the later unlock is the stronger one.

## Balance ✅

**No rate change was needed** — the cell measured clean as authored, which is why this mission's row in
REBALANCE's status board is the only one that moved nothing.

**Measured** on `scripts/sim/baselines/reading_seasons.json` — Harsh Winter's arrival deck plus the one
Storytelling and one Fire that mission grants (17 cards, Settlement, no purchases, per the Stone Age
no-shop convention). Committed rows in `baselines/results/`:

| policy | result | turns (min · median · max) | end 🌾 | end 🗺️ | unplayed |
|---|---|---|---|---|---|
| greedy @100 | 100/100 | 15 · 18 · 23 | 7.3 | 4.0 | Conquest |
| planner @100 | 100/100 | 15 · 19 · 24 | 3.1 | 5.6 | — |
| oracle @10 | 10/10 | 15 · 17 · 19 | 5.5 | 6.0 | — |

Heuristic also cleared 100% and random 0%, swept ad-hoc — those policies aren't in the committed
standing set, so the numbers above are the sourced ones.

- **Not one defeat at any competent policy**, and `defeatCauses` is empty across all three. Food never
  binds: the goal names 🔬, nothing drains 🌾, and every run ends holding a surplus.
- **Every policy ends on exactly 10🔬** — they stop the moment the threshold trips, so the end-resource
  column carries no information about headroom. What the cell measures is *tempo*, not survival.
- **The turn band is 15–19**, the arc's longest so far (First Settlement 11–16, Growing Numbers 9–16,
  The First Trades 13–16). Accepted rather than tuned: the two 🔬 sources are both 1-per-play, so 10🔬
  is a straightforwardly long grind and the mission reads as the branch's patient one against Harsh
  Winter's clock.
- **Territory stays alive** — planner ends at 5.6🗺️ and oracle at 6.0 against Settlement's starting 4,
  both playing Conquest. Greedy is the exception, leaving it unplayed and ending at exactly 4; the same
  one-ply gap recorded at every earlier cell.
- ⚠️ **Fire is played slightly more than Storytelling by both greedies** (planner 530 vs 470 plays per
  100 runs, greedy 519 vs 481) while the **oracle splits them evenly** (50/50 over 10 runs). That is
  the direction [harsh-winter](harsh-winter.md) predicted — `sim/enablers.ts` derives value over
  *resource* costs only, so a card cost has no representation and Fire reads as +1🔬 for free. The gap
  is small, so the mispricing is confirmed but not distorting this cell's numbers.

## Polish ⬜ (not started)

- Lore is written and the mission name is final — unusual for this arc, and the reason is that the
  narrative had to carry the Harsh Winter → Reading the Seasons handoff explicitly.
- ⚠️ **The look-only `reveal` interaction now has no shipping consumer.** Calendar was its only one, and
  the rework made it a draw. The kind, `Board.tsx`'s branch and `sim/actions.ts`'s single-answer
  enumeration all stay — a peek card is a plausible thing to want again and the machinery is tested —
  but nothing in the catalogue exercises it. A codebase fact rather than a mission one; noted here
  because this mission's reward is what caused it.
