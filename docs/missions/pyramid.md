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

## Balance 🟡 (reopened)

**Reopened by the 2026-08-24 stream session** — on the mission being board-dependent to the point of
being two different missions, and on the wonder it hands back (see *Open*).

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
`scripts/sim/baselines/pyramid.json` and `pyramid_chiefdom.json`, carrying the *same* 22-card deck. That
they diverge as far as they do on one deck is the reopen.

## Open

- **"The Pyramid just sucks rn" `[?]`** — *(2026-08-24 stream session)*, unelaborated. Two candidate
  readings, both live: the **mission** is now wildly board-dependent — the committed fixtures fold to
  City `prover` 4/10 (six `noWinFound:deadEnd`) · `greedy` 1/100 against Chiefdom `prover` 10/10 ·
  `greedy` 73/100 on the *same* deck, so the board Masonry's own upgrade hands you is the losing one;
  and the **wonder** is dominated by Göbekli Tepe, which this deck already owns (8🔨/L1/3 workers/no
  upkeep, +1🔨+1🪙+1🎭 each, vs 10🔨+6🪙/L2/4 workers/−2🌾, +2🎭+1🪙 each — dearer on every axis to
  trade 1🔨 per worker for 1🎭). Ask which before reworking either.

## Polish ⬜ (not started)

- **Pyramid wonder card text overflows** — the effect text is too long; the bottom text overflows and
  the card extends past its fixed size. `[?]`
- Card display/text, art, lore.
