# Roads — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ✅
**Branch:** Bronze — the first node of the expansion/territory branch (Roads → Wheel).
**Placement:** `prereqs: ['writing']`, bronze col 9 row -1.
**Reward influence:** 12 (matches the standard Bronze nodes).

## Design ✅ (converged)

- **Goal:** pave all 6 **Roadwork** events (8🔨 each; paving one sends it to `removed`, which the goal
  counts — the Copper/Writing seeded-completion pattern).
- **Pressure:** no threat card — the segments *are* the pressure. Each unpaved copy held in hand bleeds
  a **flat −2🌾** at end of round (an unfinished road starves a cut-off settlement), then files to
  discard and recurs. The drain is a *different* currency than the build cost (🔨) on purpose —
  otherwise "pave now or pay 🔨 later" is a weak decision; the food bleed makes it a real
  🔨-to-pave vs. 🌾-to-survive squeeze. (Sibling signatures: Copper 🔨-threat, Writing 🔬-escalating,
  Roads 🌾-flat.)
- **Reward:** unlocks the **Road** (work card, 1 worker, 3🪙+3🔨 → +1 territory, **single-use** — a
  box that produces spends itself, an unstaffed one recycles; Conquest's economic twin, at a flat price
  paid once per copy where Conquest's doubles), the tool the Wheel mission's territory goal is built
  around.

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

- **The Road's own price settled at Wheel**, the first cell that stocks it (it is this mission's
  *reward*, so absent from the fixture that would price it — the same shape as the Forge at
  `finding_copper`). A flat 3🪙+3🔨 against Conquest's 2⚔️ *doubling per copy-use* overtook Conquest
  from the third expansion on, so the Road went **single-use**: each copy pays its +1 once per run.
  Measured in [`wheel.md`](wheel.md).

## Polish ✅

New lore, and nothing else — the Roadwork face, the hints and the objective readout all read correctly
as authored. The old text was the road as *relief* (mud, lost hauls, bind the holdings together); the
new one is the road as what makes six villages into one country — a chief being only as real as the days
it takes him to arrive, with the far fields, the levy and a bad upland harvest as the three things the
stone changes.
