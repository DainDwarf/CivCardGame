# Sea Lanes — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
**Branch:** Bronze — the closing node of the **naval / trade** branch
([Setting Sail](setting-sail.md) → Sea Lanes). Prereq **setting_sail**; the branch converges into
**Bronze**.
**Placement:** bronze col 10 row +1 — parallel to [Wheel](wheel.md) (col 10 row −1) and
[Raiding](raiding.md) (col 10 row 0).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Identity (agreed)

The **payoff** of the branch: you hold the ships and the Coastal Route that
[Setting Sail](setting-sail.md) granted, and now run enough of them **at once** to reach the tin
islands. Where the opening node was one voyage after another, this one is the standing network — and
the branch identity ([Setting Sail](setting-sail.md) → *Branch identity*) lands hardest here, because
the goal is made entirely of the zone that takes no land and no workers.

## Goal ✅

**Hold 4 trade routes open at once** — `first_trades`' single-route term at Bronze scale, and the first
goal in the game measured in routes rather than pools. **X = 4, which is three *sustained* routes**:
victory is re-derived at the flush the fourth route lands in and `checkEndIf` reads it before anything
else can tick, so the patrol bill the run actually carries at steady state is three routes' worth — the
fourth route is the winning act, never a standing state.

**Nothing closes a route**, so every step toward the goal is irreversible: the win condition *is* a
commitment, and the rent it takes on is permanent. Reachable only because the branch's first node
granted the zone's second card.

## Pressure ✅

**The navy, not the pirates.** A threat draining **−1⚔️ per open trade route** each round: the sea lanes
have to be patrolled for as long as they run. The rate is settled at −1 *with* the Port-board question
answered rather than dodged: the board's single citizen is a starting condition, not a ceiling — its
answer to the patrol bill is **growing** (Hut is the first mission's reward, House comes with Masonry),
so the rate is not discounted to fit the population the board opens with.

- **Progress and pressure are the same act.** Each route is a goal tick *and* a standing military bill,
  so the last route is the one that can break you — the grows-as-you-win curve, in a currency neither
  sibling branch's closing node uses ([Raiding](raiding.md) drains 🪙 *shrinking* as you win;
  [Wheel](wheel.md) drains 🔨 per territory past a grace).
- **Routes take no workers; defending them does.** The sea is free and the navy is not — which is what
  makes a zone with no worker cost cost workers anyway, and is the whole reason the pressure is ⚔️
  rather than more 🪙 on top of the rent.
- **Deliberately not Accounting's shape.** [Accounting](accounting.md) already breeds `thief` events
  that are paid off in ⚔️; a second breed-and-catch mission inside one age would be a re-skin. A flat
  per-route drain needs no event cards at all.
- **Sequencing rule checked, not assumed.** [`../BACKLOG.md`](../BACKLOG.md) forbids draining a resource
  the player isn't guaranteed to *produce* on every prereq chain. ⚔️ clears it by **ownership** rather
  than by unlock: **Hunting** (work, 1⚔️ per worker per round) and **Bow** (single-use, 2🔨 → 3⚔️) are
  both in `STARTING_COLLECTION`. War Horse is the *military* branch's grant and cannot be assumed here,
  so the drain has to be priced against Hunting's rate.
- **No `defeat` hook.** ⚔️ going negative is the universal core collapse, and `checkEndIf` checks
  victory before collapse — so opening the last route on the collapsing turn still wins.

## Reward (agreed)

Three grants — the branch's deliverable to the Bronze convergence, its engine card, and its sticker.

### Tin Route (`trade`) — standing access, no yield

Costs 🪙 to open, pays a 🪙 **rent** every round, and **produces nothing**. What it buys is the right to
play the Bronze cards downstream: they gate on a standing tin route.

- **Mechanism:** `rules/cost.ts`'s `CardCost.check` — the existing bespoke-precondition seam (a peek
  card needing a non-empty pile) — on the *gated* cards. No engine verb, and `costReason` reports the
  missing route the same way it reports a missing resource.
- Nothing removes a route, so the gate is **opened once and taxed forever**: an unpayable rent collapses
  the treasury into bankruptcy. This is [`DESIGN.md`](../DESIGN.md)'s "money buys standing access, not
  raw materials" in its purest form — the first card in the game whose entire output is permission.
- **Numbers provisional: 2🪙 to open · −1🪙 rent.** Its real rating waits for the Bronze cards that gate
  on it — until they exist it is only a cheap route body — so these are implement numbers, not a verdict.

### Merchant Ship (`work`) ✅

Must not be **Trader** repainted (free to play, 1 worker, +3🪙) — a strictly-equal card is dead on
arrival. The differentiating axis: it pays **+1🪙 per open trade route**, so it is worthless in an
empty zone and the deck's best card in a full one, and the branch's goal is its own engine. Free to
play · 1 worker (provisional): it meets Trader only at three open routes — behind before, ahead after.

The split against the **Port** board's prebuilt is settled with it: the **Wharf keeps 🎭**, the Ship
takes the money side — same trigger, different currency, so neither duplicates the other.

### Convoy — the trade sticker ✅

**+1⚔️ each round · +2🔨 to open** (🛡️, provisional 5 Influence), applying to **yield-bearing** `trade`
cards. The route patrols itself: standing military bought with an outfitting surcharge — Irrigation's
gain-plus-surcharge shape, landing on the branch's own pressure currency. As this mission's *reward* it
can't trivialize the mission that grants it; it pays off downstream, where Sword & chariot and the Sea
Peoples want standing ⚔️. Yield-bearing only for the `producerOf` reason — `applyGain` raises an output
the card has, never conjures one on a card without a `produces` — so the no-yield Tin Route is outside
its reach by discipline, not by name.

## Seam to Bronze

This node is what the convergence's lore turns on — the tin routes exist because the trade branches
built them. [`../BACKLOG.md`](../BACKLOG.md) still proposes Bronzeworking as a building converting
🪙 → 🔨, which was written when the tin route was expected to *pay* the metal. It doesn't: it pays
nothing and gates instead, so the conversion is Bronzeworking's whole job and the two no longer
overlap — worth re-reading that proposal when Bronze is authored rather than inheriting it.

## Implement ✅ (shipped)

The `sea_lanes` mission (bronze col 10 row +1, prereq `setting_sail`, 12 Influence) seeding one
`unguarded_lanes` threat and the `sea_lanes_goal` objective; the `tin_route` and `merchant_ship` cards
and the `convoy` sticker as its reward. **Zero new engine primitives** — every piece rides an existing
spine.

- **No gating mechanism was built.** The Tin Route opens and taxes; the `CardCost.check` gate the
  *Reward* section describes lands on the Bronze cards that read it, which don't exist yet.
- **The goal is a plain threshold**, not a bespoke `met`: `first_trades_goal` already measures
  `G.tradeRoutes.length` declaratively, so `SEA_LANE_ROUTES = 4` is a `goals` target and the generic
  `goalsReadout` renders `🚢 n/4` with no `dynamicText`. No shared count helper either — a zone's
  `length` can't drift the way a filter over `removed` can, so the Wharf's inline read is the precedent
  followed, not Horse Taming's `tamedHorses`.
- **The threat is a state-scaled `upkeep.resolve`** (`−G.tradeRoutes.length` ⚔️), the `tamed_horses`
  shape on a different pool. **No `defeat` hook**, and the victory-first ordering it relies on is
  checked rather than assumed: `run/engine.ts`'s `checkEndIf` reads `pendingVictory` before
  `coreCollapse` on *both* the `applyMove` and `endTurn` paths, so the fourth route opening on the round
  the escorts run out still wins.
- **Merchant Ship pays through `produces.resolve`**, the Wharf precedent: `G.tradeRoutes.length` is not
  something `resolveProduction`'s per-worker scaling can express. Its one staffed worker makes the scale
  factor 1 anyway, so the box pays a flat +1🪙 × routes, once per play.
- **Convoy needed a positivity guard on `applyGain`.** `gainResources` folds a copy's stickers over
  *every* slot it gains through, `upkeep` included — so an unguarded +1⚔️ landed on the route's yield
  *and* on its rent bag, paying +2⚔️ a round against a face that says +1. Worse, `effectiveCard`
  rebuilds `cost`/`produces`/`effect` but **not** `upkeep`, so the face could not have quoted it. The
  fix is content-level (the `raider_camp` shape one zone up: fire only on a bag carrying a positive
  entry), and it rides on the fact that every route's `upkeep` is pure rent and none has an entry
  `effect`. **Whether `applyGain` should instead become slot-aware in the engine is an open question for
  the sticker layer, not settled here.**
- **Convoy and Wheel would not commute** if they ever met — a `+2🔨` surcharge against Wheel's floored
  `max(0, 🔨−1)`. No trade card costs 🔨 today so `stickerAppliesTo` never lets both land, and
  `content/stickers.test.ts`'s catalogue-wide commutation pin fails the day one does.
- **Tests:** none added. Every piece composes an already-covered mechanism (a state-scaled threat drain,
  a threshold goal over a zone, a `produces.resolve` payer, gain+surcharge sticker hooks), and the
  catalogue-wide pins in `content/cards.test.ts` / `content/stickers.test.ts` cover the new entries as
  they stand. `sim/zoneOrderInvariance.test.ts` needs no fixture entry: a zone `length` is
  order-independent. Full suite and typecheck green.

Names provisional: **Unguarded Lanes** (`threat`) above all — it names the absence rather than the navy
the pressure is actually about. **Tin Route**, **Merchant Ship** and **Convoy** are the design's own.

## Balance 🟡

**Fixtures cut and recorded; the rating is still open.** `sea_lanes_city` / `sea_lanes_chiefdom` /
`sea_lanes_port` — one 36-card deck on all three boards (hand-piloted to a Port win before any sweep),
at the standing protocol with `prover` for the winnability bound. One deck caveat the pass inherits:
`road` rides the *sibling* Wheel+roads branch, attainable by detour but not guaranteed at this node
(0 plays on City/Port in the first sweep).

Recording this mission is what exposed the race scorer's zone-length blindness — the game's first
routes-counted goal read flat, every cell measured ~1%, and the prover declined seeds at the root —
fixed at the scorer ([`../TODO.md`](../TODO.md) → *Done / shipped*: `landingReach`), and the cells
re-recorded under the fix:

| | greedy @100 | planner @100 | prover @10 |
|---|---|---|---|
| City | 0% | 18% | 3/10 proven |
| Chiefdom | 0% | 2% | 2/10 proven |
| Port | 0% | 17% | 3/10 proven |

Early readings, not verdicts: greedy's 0% is the one-ply plateau on a four-route commitment chain, and
Chiefdom dies to revolt/famine ahead of the goal. **The Port board's own balance pass lands here** (it
is this mission's prereq's reward, so no earlier fixture can hold it) and its first measurement reads
viable — the fastest board on its winning lines, its stalls never resource-starved — at
10🌾 · 5🔨 · 6🪙 · **1🧍** · 3🗺️ with the prebuilt Wharf. Left to judge: whether the planner/prover
rates are the mission or the deck, and the Port numbers settling with that judgement. `house` took 0
plays in 600 runs across every board — one to watch, not yet a verdict.

## Polish ⬜

Not started — card text, art, lore.

- **Name:** *Sea Lanes* is provisional (*The Tin Islands* is the alternative). Deliberately **not**
  named for its reward card: [Raiding](raiding.md) already carries a mission and a card sharing a name,
  and that readability smell is one to fix, not to repeat.
