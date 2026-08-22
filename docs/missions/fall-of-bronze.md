# Fall of the Bronze Age — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the age's **scored survival infinite** (its Ice Age), opened by clearing
[The Sea Peoples](sea-peoples.md); the campaign's last unlock.
**Placement:** `prereqs: ['sea_peoples']`, `kind: 'infinite'` — no map node, campaign-banner only.
**Reward:** none (infinite) — pays its score as Influence every attempt.

## Design ✅ (converged — numbers are Implement's)

**Identity — the storm that never ends.** The capstone repelled one season of sails and won; this is
the counterfactual it telegraphed: the sea peoples keep coming, and the only question is how much of
the world-system you keep alive, for how long, at what price. Everything is the capstone's shipped
machinery with the cap taken off — no new mechanics, one new threat card.

- **Never-winning objective** (Ice Age shape: one bespoke always-false goal); the run ends only in
  collapse.
- **Score = waves repelled, not rounds survived** — the first mission to use the objective-card
  `score` seam (built for it). Rounds-survived pays a player for hiding; waves-repelled pays for
  holding the lanes and fighting, which is the skill the capstone taught. It also closes the
  skip-turns Influence grind the Ice Age's rounds payout permits (that mission's re-score is a
  separate, later item).
- **The Catastrophe** (threat): a steady clock adding a fresh `sea_raid` to the deck every
  `RAID_SPAWN_PERIOD` rounds (via `spawnIntoDeck`, the Thieves' mechanism). The growing circulating
  census — each unanswered wave cutting/stripping/burning per round — **is** the deepening drain; no
  separate resource ramp. Meanwhile the repel ladder (8⚔️ + 4 per wave repelled, already unbounded)
  guarantees repelling eventually outprices any income: census up, answer down, collapse certain.
- **Play arc:** early, repels are cheap and permanently thin the census — spend ⚔️ to keep the sea
  clear while the economy compounds. Mid, every repel is dearer and triage begins. Late, repelling is
  unaffordable, the lanes fall, the board goes dark, and the tally stands. Skilled play is census
  management for as long as the tin holds.
- **Seeded start:** opens with 3 waves already in the deck (two short of the capstone's five, chosen
  off the capstone's measured pressure) — pressure from the first reshuffle, with the spawner
  supplying the rest forever.
- **The tin gate carries over unsoftened:** lose the last tin route past reopening and no wave is
  ever answered again — the intended endgame timer, blessed as in the capstone.
- **Turtle watch (the one feel-play question):** a max-score line of "never repel, tank the burn on a
  fat food engine" *should* be dead — the census grows without bound and each circulating wave burns
  every round — but this is the thing a feel pass verifies. The knob if it isn't: scale the burn with
  the census (the capstone's reserve drain, still in the pocket).

## Implement ✅ (shipped)

The `fall_of_bronze` mission (`kind: 'infinite'`, prereqs `sea_peoples`, `scoreUnit: 'waves'`) seeds
**3** `sea_raid` events over the `fall_of_bronze_goal` objective and the **`catastrophe`** threat.

**The score seam** (generic, built here, mission-agnostic): `CardDef.score` — an objective card's
optional score measure, read once at run end by `rules/objective.ts`'s `runScore` (default: rounds
survived) into the new **`RunResult.stats.score`**, which is now what a scored infinite pays as
Influence (`computeRewards`) and records as its best (`applyRunResult`'s `bestInfinite`). The
end-of-run overlay's payout preview reads the same `runScore`, so the preview can't diverge.
`MissionDef.scoreUnit` is the display-only label the Stats best-scores board renders (default
`'rounds'`). Ice Age and the sandbox are untouched: no `score` on their objectives means the rounds
default, byte-for-byte the old behaviour.

**`fall_of_bronze_goal`** carries `score: wavesRepelled` — the same `removed`-zone tally the capstone's
win threshold and the repel ladder read, so the three can never disagree on what "repelled" means.

**`catastrophe`** ticks a `clock` counter in its `upkeep` and every `RAID_SPAWN_PERIOD` (4) rounds
spawns one `sea_raid` via `spawnIntoDeck` — fresh instance ids, deterministic shuffle-in, the face
counting down to the next sails. The waves themselves are the capstone's card, verbatim: the ladder,
the tin-gated repel, the cut/strip/burn upkeep all just keep working at census > 5.

## Balance ⬜

**No baseline fixture, by construction** — the simulator cannot drive a never-winning objective (no
gradient), the same standing exemption as `ice_age`/`sandbox`. Smoke-swept `random`/`heuristic`
(no crashes, no invariant violations; the spawner fired through a reshuffle with the enlarged deck).
The pass here is **feel-play**: the spawn period and seed count against a real deck, and the turtle
watch above.

## Polish ⬜

Not started — card text, art, lore review.
