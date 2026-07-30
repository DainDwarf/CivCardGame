# Roads — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the first node of the expansion/territory branch (Roads → Wheel).
**Placement:** `prereqs: ['writing']`, bronze col 9 row -1.
**Reward influence:** 12 (matches the standard Bronze nodes).

## Design ✅ (converged)

- **Goal:** pave all 6 **Roadwork** events (8🔨 each; paving one exiles it to `removed`, which the goal
  counts — the Copper/Writing seeded-completion pattern).
- **Pressure:** no threat card — the segments *are* the pressure. Each unpaved copy held in hand bleeds
  a **flat −2🌾** at end of round (an unfinished road starves a cut-off settlement), then files to
  discard and recurs. The drain is a *different* currency than the build cost (🔨) on purpose —
  otherwise "pave now or pay 🔨 later" is a weak decision; the food bleed makes it a real
  🔨-to-pave vs. 🌾-to-survive squeeze. (Sibling signatures: Copper 🔨-threat, Writing 🔬-escalating,
  Roads 🌾-flat.)
- **Reward:** unlocks the **Road** (work card, 1 worker, 3🪙+3🔨 → +1 territory, repeatable —
  Conquest's economic twin, structurally identical), the tool the Wheel mission's territory goal is
  built around.

## Implement ✅ (shipped)

Seeded events paving to `removed`; per-copy in-hand food bleed.

## Balance ✅ (settled on City)

6 segments · 8🔨 each · −2🌾 per unpaved segment. **No number moved** — the mission proved sound as
authored under the split cap. What changed is the fixture, now the player's own winning deck (26 cards,
22⭐ of the 110 guaranteed to have arrived).

| policy | @ | win rate | turns |
|---|---|---|---|
| greedy | 100 | 17% | median 27.5 |
| planner | 100 | 60% | median 27 |
| oracle | 10 | 100% | 27–32 |

Famine is the whole failure mode (36 of the planner's 40 losses; the other 4 are stalls), which is the
pressure landing where it was aimed.

**Two cards in the fixture earn nothing.** Writing is never played by greedy or planner (twice across
10 oracle runs), and House once in 100 greedy runs. Both are kept — the fixture's job is to be the deck
the player actually won with, not a tuned one. Every other card is played by at least one policy, and
the oracle plays all 13.

**Population never moves and territory barely does.** Every City cell ends at pop 2.0 (House is the
deck's only population card), and the 60% planner cell ends at territory **2.0** — exactly the board's
start, so it wins with zero expansion, on the two slots City hands it, playing Conquest 0.05×/run. The
oracle gains +0.5. Worth carrying into Wheel, whose goal *is* territory gained.

**Beer is the widest policy split in the deck** — 6.3 plays/run under the oracle against 0.01 under the
planner, ending on 6.3🎭 (below the level-1 threshold of 10). Noted, not diagnosed.

**Only City is fixtured.** Chiefdom also reaches this node — and by here it is City's only alternative,
Settlement having been upgraded away at Masonry — but it has no committed cell and no recorded numbers.

## Strands

- **The Road's own 3🪙+3🔨 cost is unmeasurable from this cell.** It is this mission's *reward*, so it
  is absent from the fixture that would price it — the same shape as the Forge at `finding_copper`.
  Parity with Conquest is not a flat comparison: Conquest is 2⚔️ *doubling per copy-use* against the
  Road's flat price, so the Road overtakes it from the third expansion on. Settles at Wheel, the first
  cell that stocks it.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
