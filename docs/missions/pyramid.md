# Pyramid — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ✅
**Branch:** Bronze — the optional challenge leaf off Masonry.
**Placement:** `prereqs: ['masonry']`, bronze col 6 row 1.
**Reward influence:** 12 (challenge → bigger reward; provisional).

## Design ✅ (converged)

- **Goal:** a money-weighted accumulation held at once — 50🪙 · 40🔨 · 🎭 level 2.
- **Pressure:** the **Pharaoh's Reign** deadline threat — the first shipped use of the `defeat` hook
  (lose if the tomb isn't done by round `PHARAOH_DEADLINE` = 40; no drain, just the clock).
- **Reward:** unlocks the **Pyramid** wonder — the draw monument (+1🪙 +1🔨 per card drawn after the
  first `BASE_HAND_SIZE`, no workers, no upkeep, culture-L2 gated). Its rate is the culture ladder's own
  hand-size bonus, so L2 pays 2 a round before any draw card, and every effect draw stacks on top. Its
  box reads out the turn's tally and what it paid.

## Implement ✅ (shipped)

First shipped use of the `defeat` hook (a deadline, not a drain).

## Balance ✅ (closed 2026-08-27)

**The mission is board-dependent, and that is accepted as the leaf's shape.** The committed fixtures
fold to City `prover` 4/10 (six `noWinFound:deadEnd`) · `greedy` 1/100 against Chiefdom `prover` 10/10 ·
`greedy` 73/100 on the *same* deck: the board Masonry's own upgrade hands you is the losing one, and the
martial board fed by taking land is the one the deadline suits. An optional challenge leaf is allowed to
have a right answer.

**The wonder no longer competes with Göbekli Tepe on Göbekli's axis.** The culture producer it replaced
was dominated on every term (dearer, more workers, a food rent, to trade 1🔨 per worker for 1🎭 into an
age nothing reads culture in); the draw monument takes no workers and pays on the hand's width, which no
other card touches. It stands in no fixture (it is this mission's reward), so no row moved.

**The measured numbers live in the fixtures' own `results` keys** — read them with `npm run sim:report`,
which is the authority. The transcribed table that stood here is deleted rather than refreshed: it had
drifted against the files it quoted on every row.

What survives the drift, because it is structural rather than measured:

**Göbekli Tepe is the mission's pivot** — it appears in the proven lines and not in the failures, paying
🔨+🪙+🎭 per worker from one slot, which is the only way three simultaneous thresholds fit inside the
deadline. The five structures want ~5 slots against City's 2, so ~3 Conquests are load-bearing.

**🎭 L2 is not the term to give** if these ever move: the Pyramid wonder this mission unlocks is itself
`cultureLevelReq: 2`, so a level-1 goal would grant a reward the player cannot play.

**Read `prover` here, not `planner`** — the planner gap on this mission is simulator fidelity, with the
remaining causes logged under [`../TODO.md`](../TODO.md) → *Simulator shaping*.

**Fixtures ✅, two — one per board**, since City and Chiefdom reach this mission from opposite ends:
`scripts/sim/baselines/pyramid.json` and `pyramid_chiefdom.json`, carrying the *same* 22-card deck, so
the board is the only variable between them.

## Polish ✅

**The wonder's face is two short lines** — `+1🪙 +1🔨 per card` / `after the first 4` — inside the
card's fixed size in all three `CardFace` consumers, the threshold interpolated from `BASE_HAND_SIZE`
rather than written. **Standing, its box reads the turn** — `Drawn 6 · +2🪙 +2🔨` — and a Pyramid still
in hand shows the rule instead of a zero tally, since that is where the build decision is made.
Feel-play signed off, a Writing recovery bumping the readout live.

Mission text, art (🔺) and lore stand as shipped.
