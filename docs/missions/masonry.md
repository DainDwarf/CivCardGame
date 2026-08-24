# Masonry — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
**Branch:** Bronze — the age's second mission, a *megalopolis* goal.
**Placement:** `prereqs: ['first_temple']`, bronze col 5 row 1 — a symmetric fork off gobekli
opposite Copper (Copper moved to row -1).
**Reward influence:** provisional.

## Design ✅ (converged)

- **Goal:** reach 6 🧍 population (provisional target).
- **Pressure:** none — no threats/events.
- **Reward:** unlocks the **House** (building, 6🔨, +2🧍 one-shot — a bigger Hut), the **City Walls**
  (building, 3🔨, self-sufficient: +1⚔️/round, no upkeep — the first standing military producer), and
  upgrades **Settlement → City** board (12🌾 10🔨 2🪙 2🧍 5🏞️; the age's government — the City drawback
  per IDEAS is still deferred/to-author).

## Implement ✅ (shipped)

House/City Walls cards + the Settlement → City board upgrade shipped.

## Balance 🟡 (reopened)

**Reopened by the 2026-08-23 beta playtest — on price, not on difficulty.** The goal is comfortably
reachable; what is unbalanced is what reaching it *charges*. Masonry is the campaign's first mission
that requires buying copies, and the copies it forces are retired by its own reward (see *Open*).

**6🧍 holds as printed** as a target. The structural fact behind the cost is that House and City are
*this mission's own rewards*, so the only in-mission population source is the **Hut** (+1, one-shot,
one territory slot). Conquest chains (military → territory) are what open the slots, competing with
Farms for the same space against 6🧍 eating 6🌾/round.

**Two fixtures, one per board**, since Settlement (2🧍/4🏞️) and Chiefdom (3🧍/2🏞️) meet the same goal
from opposite ends: `scripts/sim/baselines/masonry.json` and `masonry_chiefdom.json`. The measured
numbers live in those fixtures' own `results` keys — read them with `npm run sim:report`, which is the
authority. No transcription here: the previous one drifted out of date against the files it quoted.

## Open

- **The forced Hut purchase is retired by this mission's own reward `[?]`** — raised by the
  2026-08-23 beta playtest. The Balance section above already names the structural fact (Hut is the only
  in-mission population source, since House and City are the reward); what the playtest adds is the
  **shop** half. A player arrives owning Hut ×1 — an unlock grants one copy — against a 6🧍 goal on a
  2🧍 board, so clearing Masonry means buying ×2→×4 at 2⭐ each. Then the clear hands them the House,
  which is the *same* 3🔨-per-🧍 rate (6🔨/+2🧍 vs 3🔨/+1🧍) in **half the territory and half the deck
  slots** — so the 6⭐ buys compactness that the reward immediately supersedes. Reads as a tax rather
  than a choice, and the fixtures agree: hut plays are exactly `6 − startingPop` every run under every
  policy (settlement 4/4, chiefdom 3 of 4) — zero variance, where genuine decisions like Bartering swing
  100 → 86 → 65 across greedy/planner/prover. Note this is *not* the ordinary cross-age progression case
  where a better successor is fine; the problem is the **forced** purchase sitting immediately before
  the supersession, with no other use for those copies afterward. This is also the content half of the
  *Stone → Bronze cliff* ([`../BACKLOG.md`](../BACKLOG.md)) — Masonry is the campaign's **first mission
  that requires buying anything**, and those three Hut copies are the whole of that bill.
  - **Candidate: make the House a card *upgrade*, not an unlock** — *(2026-08-24 stream session)*
    `reward.cardUpgrade: { from: 'hut', to: 'house' }`, the card mirror of the `boardUpgrade` this same
    mission already carries, so the copies the player was forced to buy *become* the reward instead of
    being superseded by it, and the whole reward reads as one improvement rather than an unlock beside a
    bill. Three things it has to answer: (a) `cardAge` derives from `reward.unlockCardIds`
    (`content/cardAge.ts`), so a House granted only by an upgrade would return `undefined` and
    `shop.ts` would read it as unsellable forever — either the new field feeds `cardAge` or House stays
    listed and the upgrade only converts held copies; (b) the boardUpgrade mirror breaks in one place —
    no `DeckDef` names a board, but `DeckDef.cards` holds meta *instance* ids, so retiring Hut instances
    means rewriting deck references, which `applyBoardUpgrade` never has to do; (c) `writing.json` and
    `writing_chiefdom.json` are both downstream of Masonry and name `hut`, so both need re-cutting.
    Note it resolves the supersession half of this finding only — Masonry being the first mission that
    forces buying, with nothing having taught buying, is untouched by it.
- **Both rewards were re-cut after the sweep and are unmeasured** — City Walls 4🔨/−1🔨 upkeep → **3🔨
  flat, no upkeep**; the City board 6🔨 → **10🔨** start. They are this mission's own rewards, so no
  fixture here can reach them; the six City-board fixtures downstream (accounting, horse_taming,
  pyramid, roads, wheel, writing) all predate the board change. City Walls' cut was accepted unmeasured
  on the amortized reading — the card takes no workers, so it is priced against draw frequency rather
  than the worker-turn, and its flat 1⚔️/round already out-rates a War Horse drawn about every sixth turn.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore. (City drawback still to author.)
