# The Sea Peoples — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **capstone**: [Sword & chariot](sword-chariot.md) → **The Sea Peoples**;
clearing it unlocks the *Fall of the Bronze Age* infinite (its own design, not this dossier's).
**Placement:** `prereqs: ['sword_chariot']`, bronze col 13 row 0.
**Reward influence:** provisional — weigh the capstone premium at Balance; the reward's real payload
is the infinite unlock.

## Design ✅ (converged — numbers are Implement's)

**Identity — the systems collapse.** The age built one load-bearing loop — tin buys bronze, bronze
holds the sea, the sea carries the tin — and this mission attacks it at the joint. Everything the arc
granted becomes a hostage: the invasion strangles the tin line, and the player defends it for dear
life. The dramatic irony [sword-chariot](sword-chariot.md) deferred is sprung here: the muster is
finally spent, and the thing it is spent *through* is the thing under attack.

- **Goal: repel all N invasion-wave events** — seeded-completion (all N seeded at setup, paced by the
  deck like the Raiders waves): playing one costs ⚔️ (escalating per wave repelled) and exiles it to
  `removed`, which the goal counts. **Every wave is tin-gated** (`needsTinRoute`): no standing tin
  route, no repelling. A tinless deck is a death trap *by construction* — the Bronze mission's own
  no-safety-net precedent, visible on the wave's face and in the mission flow popup. This is what
  keeps tin the solution rather than the problem: with War Horse/Hunting/City Walls as ungated ⚔️
  faucets, a soft price nudge would leave the spam-vs-bronze line thin; the hard gate removes it.
- **Unplayed wave, end of round** (hand-event upkeep): the raid falls on whatever stands between it
  and the coast.
  - **Routes stand** → the war is at sea: every un-Convoyed route is **cut** (route → `discard`;
    reserve knob: cut X rather than all, if Balance finds cut-all too punishing), and each Convoyed
    route is **stripped of one Convoy** instead — the escort dies holding the lane.
  - **No route stands** → the raid reaches the coast and **burns 🌾/🔨** (pool split is Implement's).
  Routes are therefore shields twice over — they gate the repel *and* keep the burn off the fields —
  which is the pressure that makes a player open and hold them for dear life.
- **Convoy is ablative armor, not a shield.** Its `appliesTo` widens to any `trade` card, so the Tin
  Route (yieldless) can carry one: pure escort wages there, no ⚔️ to ride — an honest price for
  guarding a cargo that pays in access. The strip is **run-local sticker removal** off the run
  `CardInstance` (the meta collection is untouched — the raid costs this run's defenses, never the
  player's purchase), taken positionally so a double-Convoyed route survives two wave-rounds.
  Removal, not a negation marker, so a dead escort also stops billing its wages. Stickers ride the
  instance through the discard, so a cut route **re-stands with its surviving convoys** when replayed.
- **Deliberately no threat.** The wave's own teeth — the tin-gated repel, the cut, the burn, the
  rents and escort wages the lanes already charge — are the whole pressure. A census-priced drain
  (−1🪙 per wave at large, the discard-stall closer) was cut as too much stacked on top; it stays as
  **Balance's reserve knob** if turtling proves free.
- **Every tin gate works the same** — one player-facing rule, *bronze works only while tin flows*:
  continuous wherever a card stands, play-time where a card lives one turn (play-time *is*
  continuous there). Two shipped grants convert to match the Sword:
  - **Marketplace** — keeps its play-time check and gains the production mothball (the Sword's
    double gate: no tin, no market rounds).
  - **Bronze Tools** — gains the Sword's double gate: the play-time check stays (casting the tools
    needs tin) and the +1🔨 applies only while a tin route stands (no tin, no edge).
- **Exploit audit** (the design was attacked before converging; each line priced, closed, or blessed):
  - *Route redundancy* — spare tin routes standing un-Convoyed all fall together; Convoying each
    stacks escort wages. Priced, not free.
  - *Writing / spare copies* — recovering a cut route is the intended **rebuild rhythm between
    waves** (the play, the reopen price, the dark rounds), and Sisyphean during one (it cuts again
    each round). Demoted from exploit to mastery.
  - *Decoy route* — dead: chaff falls with everything else and billed rent while it stood.
  - *Discard stall* — **reopened** by the threat's removal: a wave parked in the discard exerts no
    pressure. Accepted for now; the census drain is the reserve knob if Balance finds stalling free.
  - *Tinless hermit* — unwinnable by construction, and blessed as such: the burn and the gate make
    the trap obvious, not subtle.
  - *One-round burn shield* (replaying a cheap route each round to keep the raid at sea) — cut the
    same round, circulation-limited, billed per play. Self-priced.
- **Timing fact, load-bearing for feel:** hand-event upkeep resolves in `settleEndOfTurn`, *after*
  `applyUpkeep`'s production broadcast — the round the tin falls, standing producers still paid, and
  the board goes dark from the *next* round. The player always sees the last pay-out before the
  mothball; no same-round rug-pull. It also keeps the cut off the production batch, so no
  order-of-siblings question against the gated `produces` reads.
- **Implement seams:**
  - A `closeTradeRoute` primitive in `rules/tradeRoutes.ts` (route → `discard`). Enemy-driven and
    deterministic, so none of the TODO cancellation item's hazards apply (no `pendingInteraction`,
    no reversible play/close pair, no canonical-options ordering) — that item stays open and
    separate. DESIGN.md's "nothing closes a route" line owes an edit to "nothing *the player does*".
  - `applyGain` gains sight of `G` (optional param threaded through `effectiveGain`; meta display
    passes none and shows the potential rate, the sticker description carrying the condition). The
    commutation pin holds — the gate conditions only the sticker's own +1, never the bag.
  - **Generalize the produces gate declaratively** — a gate field `resolveProduction` enforces and
    the sim probes/plan scan can read — rather than converting Marketplace to a resolve-only
    `produces` like the Sword. This clears sword-chariot's recorded blind spot (resolve-only output
    invisible to `race.ts`/`enablers.ts`) exactly when it starts to bite: this mission's decks are
    the first to carry the Sword, and Marketplace joins it.
  - Convoy's static description needs wording that survives the yieldless case.
- **Sim expectations:** the route-opening blind spot is *worse* here (routes must be re-opened under
  pressure), so expect sword-chariot's shape — hand-piloted reachability verdicts with the policy
  columns as a floor and the `prover` weighed accordingly. The produces-gate seam above is the one
  fidelity investment this pass makes; the `1/handSize` delivery ticket stays deferred.
- **Reward:** unlocks the **Fall of the Bronze Age** infinite, plus Influence. Deliberately no card —
  the age ends here, and the reward is the abyss. (Per [`PUBLISH.md`](../PUBLISH.md): if the
  infinite is cut, the reward simply drops the unlock.)
- **Lore seam:** the capstone springs what the arc telegraphed — the palaces cast the finest bronze
  in the world, and the world it depends on is nine days of open water. The Sea Peoples are not an
  army to defeat but a storm to outlast with your lifelines intact; the win is repelling the raids
  with the tin still flowing, which is more than most of the age's real palaces managed.

## Implement ✅ (shipped)

The `sea_peoples` mission (bronze col 13 row 0, prereqs `sword_chariot`, 12⭐ and no unlock — the
*Fall of the Bronze Age* infinite does not exist yet and will name this mission as its own prereq when
it does) seeding **5** `sea_raid` events over the `sea_peoples_goal` objective — **no threat**, per the
design. `INVASION_WAVES` is the one number behind the seed count, the win threshold and the victory
hint.

**The wave.** `sea_raid` is a plain `event`, so repelling it is the ordinary played-event path — pay,
resolve nothing, exile to `removed` with its upkeep pre-empted — and `removed` is what the goal counts.
Its price is **8⚔️ + 4⚔️ per wave already repelled** (8/12/16/20/24, 80⚔️ over the run), a `cost.resolve`
reading the same `wavesRepelled` tally off `removed` and deriving from the base it is handed, so a
sticker discount compounds with the ladder rather than being applied on top of it. `check:
needsTinRoute` is the hard gate: with no tin route standing the face carries the `missingRoute` reason
and the wave cannot be repelled at all.

**The cut** rides the wave's own `upkeep`, which fires only on the unplayed path (`resolveHandEvents`,
inside `settleEndOfTurn`) — deliberately *not* an `on.endTurn` handler or a threat drain, either of
which would put it inside the production broadcast where the tin-gated `producesWhile` reads are.
The branch is read once from `G.tradeRoutes` as the raid arrives, then each route is judged alone:
`stripSticker(route, 'convoy')` takes one escort layer off, and a route with none is cut through
`closeTradeRoute`. An empty zone burns **−3🌾 −2🔨** through `gainResources` instead. Nothing here reads
across routes, so two waves in one hand commute — pinned in `sim/zoneOrderInvariance.test.ts`, whose
fixture now carries two real `sea_raid`s over one escorted and one bare lane.

**`stripSticker`** (`rules/state.ts`, beside the counter accessors) is the run-local counterpart of
`stickers.ts`'s `removeSticker`: one layer per call, the `stickers` key deleted when the last goes so a
stripped copy reads as the plain card it now is, and the array rebuilt rather than spliced so nothing
sharing it is written through. The meta collection is never in reach of it.

Two content edits fall out: Sea Lanes' `victoryHint` and the `sea_lanes_goal` comment no longer claim
that *nothing* closes a route, since now something does.

## Balance ⬜

Not started.

## Polish ⬜

Not started — card text, art, lore.
