# Roads — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the first node of the expansion/territory branch (Roads → Wheel).
**Placement:** `prereqs: ['writing']`, bronze col 8 row -1.
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
- **Reward:** unlocks the **Road** (work card, 3🪙+3🔨 → +1 territory, single-use — Conquest's economic
  twin, structurally identical self-removal), the tool the Wheel mission's territory goal is built
  around.

## Implement ✅ (shipped)

Seeded events paving to `removed`; per-copy in-hand food bleed.

## Balance ✅ (settled)

6 segments · 8🔨 each · −2🌾 per unpaved segment. On the standing baseline (26-card City deck) this
lands **oracle 9/10 · planner 85% · greedy 31%** — tight but winnable, the intended squeeze.

- **Still unpinned until Wheel is balanced:** the Road's 3🪙+3🔨 cost (parity with Conquest's 5⚔️ is
  the intent).

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
