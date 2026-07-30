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

## Balance 🟡 (target holds; planner not yet a difficulty measurement)

**Target (50🪙 · 40🔨 · 🎭 L2) and `PHARAOH_DEADLINE` (40) hold as authored.** Hand-won first try on City,
and **search-proven on 50/50 seeds** — every line wins in 26–38 turns against the 40-round clock, ending at
🎭 30.5 with no overshoot. The ~10 turns of slack at optimum is the room a first-try human win with late
mistakes needs.

Measured on a 22-card City deck: 1 each Bead Workshop · Farm+2 Irrigation · Forge · House · Göbekli Tepe,
plus 4 Conquest · 2 Beer · 2 Hunting · 2 Toolmaking · 4 Trader · 2 Bow · Bartering.

| policy | result |
|---|---|
| `prover` @50 | **50/50** |
| `oracle` @10 | 10/10 · 28–33 turns |
| `planner` @100 | 18/100 |
| `greedy` @100 | 0/100 |

**Göbekli Tepe is the mission's pivot** — it appears in all 50 proven lines and none of the failures, paying
🔨+🪙+🎭 per worker from one slot, which is the only way three simultaneous thresholds fit inside the
deadline. The five structures want ~5 slots against City's 2, so ~3 Conquests are load-bearing.

**The 82-point planner gap is simulator fidelity, not difficulty** — two shaping fixes this session took it
0 → 18 and the remaining causes are logged under [`../TODO.md`](../TODO.md) → *Simulator shaping*. Read
`prover` here until that closes; the planner row is not yet a human-difficulty estimate.

**🎭 L2 is not the term to give** if these ever move: the Pyramid wonder this mission unlocks is itself
`cultureLevelReq: 2`, so a level-1 goal would grant a reward the player cannot play.

**Fixt ✅** — `scripts/sim/baselines/pyramid.json` carries the deck above. Only City has a fixture: Chiefdom also
reaches this mission but measures 0/100 on this deck and is **food-bound, not land-bound** (8🌾 start, one
Farm, famine 54/100), so like Accounting it would need its own deck before a row there said anything.

The earlier growth-window read (~34–38 turns) is untested; nothing measured was deadline-bound, and the
oracle finishes in 28–33 of the 40 rounds.

## Polish ⬜ (not started)

- **Pyramid wonder card text overflows** — the effect text is too long; the bottom text overflows and
  the card extends past its fixed size. `[?]`
- Card display/text, art, lore.
