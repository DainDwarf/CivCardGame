# Pyramid — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
**Branch:** Bronze — the optional challenge leaf off Masonry.
**Placement:** `prereqs: ['masonry']`, bronze col 6 row 1.
**Reward influence:** 25 (challenge → bigger reward; provisional).

## Design ✅ (converged)

- **Goal:** a money-weighted accumulation held at once — 50🪙 · 40🔨 · 🎭 level 2.
- **Pressure:** the **Pharaoh's Reign** deadline threat — the first shipped use of the `defeat` hook
  (lose if the tomb isn't done by round `PHARAOH_DEADLINE` = 40; no drain, just the clock).
- **Reward:** unlocks the **Pyramid** wonder — the culture powerhouse (+2🎭 +1🪙 per worker, 4 workers,
  culture-L2 gated, −2🌾 upkeep while staffed).

## Implement ✅ (shipped)

First shipped use of the `defeat` hook (a deadline, not a drain).

## Balance 🟡 (open)

All numbers provisional pending a sim sweep — target (50🪙 · 40🔨 · 🎭 L2), `PHARAOH_DEADLINE` (40).
The pop-2 Pyramid needs a growth window; a ~34–38 turn deadline is the sweet spot (scaffolding stashed).

## Polish ⬜ (not started)

- **Pyramid wonder card text overflows** — the effect text is too long; the bottom text overflows and
  the card extends past its fixed size. `[?]`
- Card display/text, art, lore.
