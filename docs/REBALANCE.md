# CivCardGame — Resource-economy rebalance pass

> The working thread of the **`trade-redesign` branch**. Was [`BACKLOG.md`](BACKLOG.md)'s *Step 10*,
> scheduled between the Bronze and Iron arcs; **pulled forward** once the trade-route zone and the
> unified territory cap — its two prerequisites — shipped on this branch, so the rates follow here
> instead of waiting for Iron. BACKLOG keeps a one-line status pointer at Step 10; the live state is
> all here.
>
> **Scope:** the *rates* — what a worker-round is worth per resource, what converts into what, and
> what each mission is therefore asking for. Not new content: a mission's flavour, goal shape and
> pressure design stay in its dossier (`docs/missions/<name>.md`).
>
> **Lifecycle:** transient, like [`TODO.md`](TODO.md) and [`BACKLOG.md`](BACKLOG.md). Decided design
> graduates to [`DESIGN.md`](DESIGN.md); the finished pass graduates to a
> [`CHANGELOG.md`](../CHANGELOG.md) entry drawn from this file, and then this file is deleted.
> Nothing durable should cite it.

## How the pass is worked

**Mission by mission, from the first.** A rate is only judgeable against something that has to be
achieved with it, so each mission is re-read under the new numbers in campaign order, and the rates
move where that mission proves they must. The alternative — set every rate globally, then check —
was tried on paper and gives no signal about which number was wrong.

Each mission is done when: its content is realigned · its baseline fixture is re-fixtured to a deck
a player can actually own at that point · the fixture is swept and its records in
`scripts/sim/baselines/results/` are updated · anything it strands is resolved or logged below.

**Every fixture and result not yet reached is stale** — they name cards that are on trial and they
predate the rates. Re-measure per mission, never per change; a mid-pass whole-set sweep measures
nothing but noise.

## Status board

| # | Mission | State |
|---|---|---|
| 1 | `first_settlement` | ✅ **done** — realigned, re-fixtured, measured |
| 2 | `growing_numbers` | ✅ **done** — realigned, re-fixtured, measured |
| 3 | `raiders_at_border` · *Harsh Winter* | ⬜ — the **pressure** pair, now first in each branch |
| 4 | *The First Trades* · `reading_seasons` | ⬜ — the **resource** pair; see the restructure below |
| 5 | `first_temple` | ⬜ — 30🪙 hoard goal, see *Re-point the money objectives* |
| 6 | `finding_copper` · `masonry` | ⬜ — **masonry is blocked** on the food ceiling below |
| 7 | `pyramid` · `accounting` | ⬜ — both hoard goals; pyramid blocked on the food ceiling |
| 8 | `writing` | ⬜ |
| 9 | `horse_taming` · `roads` | ⬜ |
| 10 | `wheel` | ⬜ |
| — | `ice_age` · `sandbox` | ⬜ — infinite; no win to measure, read collapse round instead |

## Landed

### Mission 1 — The First Settlement ✅

**Rates.** Foraging 3🌾 → **1🌾**/worker · Toolmaking 2🔨 → **1🔨**/worker · Dogs 1🌾→2⚔️ →
**1🌾→1⚔️** (the last flat ×2 converter in the opening deck).

**Food upkeep is superlinear**: `floor(pop²/4)`, replacing flat `population × FOOD_PER_POP`. The
marginal — what the *next* population point costs — is `foodPerNextPop(n) = floor(n/2)`, exported so
the HUD can price growth without re-deriving the curve. `FOOD_PER_POP` is gone.

Quadratic was chosen over a gentler pair-band curve deliberately, to see how it feels before
softening it. It is *cheaper* than the old flat rate at pop 2–3 and harsher from 5 up.

**Opening.** Tribe → **10🌾 / 2🗺️** — territory equal to population, so the very first turn has to
choose which two things two people do. `MIN_DECK_SIZE` 20 → **10**, and the Founding deck narrowed to
**4 Foraging / 4 Toolmaking / 2 Bow / 2 Dogs**.

*Why narrow rather than teach breadth:* a fresh profile owns exactly `MIN_DECK_SIZE` cards and no
Influence, so the opening deck is **forced** — the player cannot cut a card. A card the first mission
can't use is not a chaff-cutting lesson, it's a dead draw, and under the territory cap it can't even
be plopped for incidental value.

**Measured** (re-fixtured `first_settlement.json`, records updated in `baselines/results/`):

| policy | result | turns (min · median · max) | end 🌾 |
|---|---|---|---|
| heuristic @30 | 30/30 | 12 · 14.5 · 17 | 5.8 |
| greedy @100 | 95/100 | 10 · 12 · 201 | 2.6 |
| planner @100 | 100/100 | 11 · 16 · 21 | 0.4 |
| oracle @10 | 10/10 | 10 · 11 · 12 | 2.6 |

- **Winnable at every skill level**, which is what the game's first mission should be. Greedy's
  losses are all 201-turn `stall`s — the one-ply plateau, not the content.
- **No dead cards**: `unplayedCards` empty under every policy.
- **The run is worker-round-bound, not food-bound.** The oracle spends ~21 worker-rounds (14
  Toolmaking + ~7 Foraging) against 2 workers, which *is* its ~11-turn line. Food constrains but
  doesn't bind.
- **Tribe's 10🌾 is sized right**: heuristic ends on 5.8🌾, planner on 0.4🌾 — styles land either
  side of it.
- **One live axis only.** Bow plays 2/2 and Dogs 4/4 in *every* run under *every* policy: the ⚔️ half
  is a fixed script, because they are the only military sources and the goal wants exactly 10. The
  whole decision is the Foraging/Toolmaking split, and skill does show there (426 Foraging plays under
  heuristic vs 222 under oracle). Acceptable for mission 1; worth not repeating at mission 2.

### Mission 2 — Growing Numbers ✅

**Goal.** Build 🛖 + 🌱 **and hold 4 🗺️** — an *absolute* pool, not a gain over the board's start, so the
board choice is felt at the win line rather than normalized away.

**The board upgrade moved here from mission 1.** `boardUpgrade: tribe → settlement` is now *this*
mission's reward, which is what makes the absolute 4 🗺️ goal work: the opening arc's first **two**
missions are played on Tribe, and the 4 🗺️ is fought up from Tribe's 2. On Settlement's 4 the goal would
have been satisfied at setup and Conquest would be decorative. It also reads better — raising the roof is
what settles you, not finding the spot. **Settlement** gains the slack in exchange: 2🔨 → **5🔨** at start.

**Conquest** 5⚔️ flat → **2⚔️ doubling per play of that copy** (2 · 4 · 8 …). The escalation is per-copy
(`CardInstance.counters`), so a bought second copy climbs on its own schedule — a live interaction with
the copy-tier shop to watch.

Landing this needed the **cost spine** (`rules/cost.ts`) — one `CardCost` descriptor with declarative
fields plus a `resolve` escape hatch, absorbing the old `CardGate`. See CLAUDE.md; the shape is the
decided design and graduates to `DESIGN.md`.

**Measured** on **Tribe** (2🗺️/2🧍/10🌾/0🔨 — the board a player actually arrives on, now that the upgrade
is this mission's own reward) with the starting deck + one Hut/Farm/Conquest, 15 cards, no purchases:

| policy | result | turns (min · median · max) | end 🌾 | Conquest plays/run |
|---|---|---|---|---|
| heuristic @100 | 84/100 | 9 · 15 · 27 | 10.7 | 1.75 |
| greedy @100 | 26/100 | 11 · 21 · 31 | 1.1 | 0.52 |
| planner @100 | 100/100 | 9 · 13 · 24 | 5.0 | 2.0 |
| oracle @10 | 10/10 | 8 · 9.5 · 11 | 4.9 | 2.0 |

- **The 4🗺️ goal makes Conquest load-bearing**: planner and oracle play it exactly **twice** every run
  (2🗺️ → 4🗺️ for 2⚔️ + 4⚔️ = 6⚔️), which is the whole point of the escalation being gentle at two.
- **Every defeat is famine** (heuristic 16, greedy 74) — no stalls. Unlike mission 1 this run *is*
  food-bound, because ⚔️ for Conquest competes with 🌾 through Dogs (1🌾→1⚔️).
- **Two live axes**, the thing mission 1 lacked: the Foraging/Toolmaking split *and* how much food to burn
  on military. Skill separates hard on it — greedy 26% vs planner 100% on identical seeds.
- **Heuristic leaves Dogs unplayed** and funds ⚔️ through Bow alone. A `sim/value.ts` blind spot, not a
  content signal (Bow is a one-shot 2🔨→3⚔️; Dogs is the repeatable 1🌾→1⚔️).

`scripts/sim/baselines/growing_numbers.json` is re-cut to this deck on Tribe, and its rows in
`baselines/results/` are updated (that cell only — no whole-set sweep).

**Reaches forward:** Settlement's 5🔨 start touches every later mission launched on it, so missions 3+ are
measured against the new number when the pass gets to them.

## Decided — Stone Age branches 3–4 restructure

**The forcing problem.** Both branches were authored *resource first, pressure second* —
`rites_rituals` (🎭 level 1) then `raiders_at_border`, `reading_seasons` (10🔬) then
`restless_people`. Leaning the starting collection cut Cave Art and Storytelling, so the player
arrives at each branch's first mission owning **zero** cards that make the resource it asks for.
Both openers are unpassable as authored. A resource has to be *granted* before a mission can demand
it, and a pressure mission demands no resource — so the order inverts.

**The new shape.** Pressure first, resource second, both branches:

| | col 2 — pressure | col 3 — resource |
|---|---|---|
| **upper** (row -1) | `raiders_at_border` — event waves; goal and pressure kept, **moved** | **The First Trades** — 🪙 + trade routes, new ([dossier](missions/first-trades.md)) |
| **lower** (row +1) | **Harsh Winter** — famine threat, a rewrite of `restless_people` ([dossier](missions/harsh-winter.md)) | `reading_seasons` — 10🔬 kept, **moved**, and loses its reward |

Each col-2 mission's **reward is the col-3 mission's toolkit**: `raiders_at_border` grants the money
pair (Jewelry, Bartering), Harsh Winter grants the science pair (Storytelling, Calendar).

**The concrete `missions.ts` edits** — no mission in either branch is untouched, so a session picking
up one of the dossiers needs this list rather than the table's shorthand:

| Mission | Edit |
|---|---|
| `raiders_at_border` | `prereqs` `['rites_rituals']` → `['growing_numbers']` · `map` col 3 → **2** · reward gains Jewelry + Bartering (keeps Chiefdom) |
| `rites_rituals` | **deleted**, along with `rites_rituals_goal` |
| `restless_people` | **rewritten** as Harsh Winter — new id, threat, goal and reward; see its dossier for what that retires |
| `reading_seasons` | `prereqs` `['growing_numbers']` → the Harsh Winter id · `map` col 2 → **3** · **reward is now empty** (Calendar moves upstream) — needs a new one |
| *The First Trades* | new: `prereqs: ['raiders_at_border']`, stone col 3 row -1 |
| `first_temple` | `prereqs` `['raiders_at_border', 'restless_people']` → `['first_trades', <harsh winter id>]` — the tips moved, so the capstone's gate must follow |

A *missing* prereq id used to fail nothing — `campaign.ts`'s `isAvailable` just never satisfies it, so
the mission dropped out of the campaign silently. `content/missions.test.ts` now pins prereq id
existence and acyclicity, so deleting `rites_rituals` while something still names it is a red test.
⚠️ It cannot catch a real-but-*wrong* id: pointing `first_temple` at `growing_numbers` instead of the
new branch tips passes both cases and quietly flattens the DAG. Naming the right missions is still on
whoever makes the edit.

Also fixed incidentally: `restless_people` demanded 🎭 level 2 while its only prereq chain was the
*science* branch, so it was reachable having never played the culture mission.

**Money enters at Stone, not Bronze.** This reverses *money's topology* below, which put money in the
Bronze substrate. Taken deliberately, in exchange for `first_temple`'s 30🪙 becoming reachable
without re-pointing. The topology **rule** survives intact — the reworked Jewelry produces 🪙 from a
worker instead of converting 🔨, and the route rents rather than exchanges, so there is still no
edge converting non-money back into money. What lapses is only the *age* the resource belongs to,
and with it the "each age promotes one resource into the substrate" framing: Stone now carries food,
production **and money**, leaving Bronze to promote something else.

**Trader's home is now open.** It was `accounting`'s reward as "the money faucet that opens the money
spine", but the spine opens five missions earlier. Either Trader moves up, or `accounting` keeps it
as a *better* faucet than Jewelry and its pitch is rewritten. Decide when the pass reaches Accounting.

### Culture leaves the Stone Age

`rites_rituals` is **removed** — The First Trades takes its slot — and the Harsh Winter rewrite drops
the arc's other culture goal. So the tutorial age no longer teaches 🎭 at all, and this is owed work,
not a finished decision:

- **Both wonders become unplayable.** Göbekli Tepe carries `cultureLevelReq: 1` and Pyramid
  `cultureLevelReq: 2` — a hard play-gate, not a goal. With no 🎭 source anywhere in the age, the
  Stone Age *capstone reward* is a card that cannot be played. This is the sharpest consequence of the
  three and the one most likely to force culture back somewhere.
- **Three cards have no home**: Cave Art (2🎭 work), Burial (1🎭 building), Beer (2🌾 → 5🎭 work).
  Burial and Beer are *currently obtainable*; they join the trial list above on the day this ships.
- **Two culture goals are orphaned**: `first_temple` (🎭 level 2) and `pyramid` (🎭 level 2). Each
  must drop its culture term, or culture must find a mission upstream of it.
- **Hand size is pinned at 4 for the whole tutorial age.** Culture is its only lever, so the
  hand-size-grows-with-your-civilization progression no longer happens anywhere in Stone.
- **`sim/enablers.test.ts` builds off a `ritesRoot` fixture** derived from `rites_rituals`, and its
  culture cases read the wonder's gate. Deleting the mission breaks it — re-point the fixture rather
  than dropping the cases; they cover the gate-unlock enabler, not the mission.

The cheapest resolution is probably a culture mission early in **Bronze** — which is also what the
age-promotes-a-resource framing wants, now that money has vacated that slot. Not decided.

## Cards on trial

Cut from the starting collection and **not unlocked by anything, so currently unobtainable in-game**.
Deliberate: each is re-slotted onto a mission reward or cut outright when the pass reaches the mission
that would justify it. **Nothing merges to `main` with a card stranded** — this list must be empty.

| Card | Charge | Resolution |
|---|---|---|
| Storytelling (2🔬 work) | 🔬 has no sink at all in the Stone Age start | ✅ **Harsh Winter** reward, reworked to the 1-per-worker base rate |
| Jewelry (1🔨→2🪙) | **anti-goal at mission 1** — drains the resource the objective counts, for one with no reachable sink | ✅ **`raiders_at_border`** reward, reworked from a 🔨→🪙 converter into a 🪙 *work* box |
| Bartering (2🪙 route) | unaffordable at mission 1, and its rent bankrupts a treasury with no income | ✅ **`raiders_at_border`** reward — the first route, paired with the Jewelry faucet that funds it |
| Cave Art (2🎭 work) | 🎭 level 1 is 10🎭 — a whole tutorial mission's output for +1 hand size | ❌ **no home** — `rites_rituals` was it. See *Culture leaves the Stone Age* |

## Consequences owed

- **Population is hard-capped at 4.** The best food rate in the game is now 1🌾/worker (Foraging *and*
  Farm), so all-hands-farming income (`pop`) crosses upkeep (`floor(pop²/4)`) at pop 4 — 4 vs 4,
  break-even; pop 5 is 5 vs 6, already negative with every worker farming and nothing else running.
  **Masonry's 6🧍 goal and the multi-worker wonders (Göbekli 3, Pyramid 4) are unreachable** until a
  stronger food source ships. Whichever mission unlocks that faucet is a *hard prerequisite* for them,
  not a balance nudge — decide it before reaching Masonry.
- **`plannerPolicy.integration.test.ts`'s Masonry win-rate case is `it.skip`ped** until this pass reaches
  Masonry. Two reasons at once, which is why it's parked rather than retuned:
  - Its hardcoded deck fields **bartering · jewelry · cave_art** — three of the four *Cards on trial*
    below — so the fixture is stale by this pass's own rules whatever the numbers say.
  - Conquest's 2⚔️-doubling price pushed it from 4/6 to **3/6** against a `>= 4` threshold. Expected
    direction (Masonry converts ⚔️→🗺️→🧍 repeatedly, so a doubling territory card bites hardest exactly
    there), but it's a **one-seed** move on a 6-sample proxy, so it doesn't measure *how much* — that
    needs a wider planner sweep at Masonry's turn.

  The assertion is the **planner's capability claim** (the greedies win Masonry 0%), not a Masonry balance
  check — so it must come back rather than be relaxed. Masonry likely wants a territory route that doesn't
  escalate: Road, a wider board, or a cap on the curve. **Un-skip before merging to `main`.**
- **`restless_people` is unwinnable as it stands** — a shipped mission with no line, same merge-blocker
  class as a stranded card. Its `unrest` threat drains −1🪙 per 🧍 on every reshuffle; Tribe, Settlement
  and Chiefdom all start at **0🪙**, Jewelry is cut and Trader is gated behind `accounting`, so the first
  reshuffle bankrupts the run. The Harsh Winter rewrite retires the mission and the threat both, which
  closes this — but if `unrest` is ever reused it must be re-keyed off a resource the player produces.
- **The Influence faucet ledger shifts.** Dropping `rites_rituals` (8⭐) and adding The First Trades
  changes `cumulativeInfluenceInto` for every mission downstream — which is the number shop tiers and
  sticker prices are tuned against. `npm run economy` prints the new ledger once the DAG is edited.
- **`MIN_DECK_SIZE` may not need to exist.** At 10 it is starting to look like a rule with no job; see
  [`IDEAS.md`](IDEAS.md). Not this pass's call.

## Diagnosis (the original analysis)

Three separate-looking complaints (base work cards too strong · Dogs/Bow flattening later military ·
Jewelry too strong) are one root cause: **every converter doubles, and they compose.**

| Card | In | Out | Ratio |
|---|---|---|---|
| Jewelry | 1🔨 | 2🪙 | ×2 |
| ~~Bartering~~ | ~~1🪙~~ | ~~2🌾~~ | **converted to a trade route** (2🪙 to open, then −1🪙/+1🌾 per round) |
| ~~Dogs~~ | 1🌾 | ~~2⚔️~~ **1⚔️** | **cut to ×1** |
| Raiding | 3⚔️ | 6🪙 | ×2 |
| Bow | 2🔨 | 3⚔️ | ×1.5, self-exiling |

Chained, Toolmaking → Jewelry → Bartering → Dogs turned **1🔨 into 8⚔️** (16⚔️ per worker-round against
War Horse's 4), and Bartering → Dogs → Raiding **closed a cycle**: 1🪙 → 2🌾 → 4⚔️ → ~8🪙, ×8 per lap,
with `raiding` live today (granted by Horse Taming). The only brake is card plays — hand size 4, +1 per
culture level, no per-turn cap — so the engine *strengthens* as culture rises. Net effect: the five core
resources are one resource with five sprites, which is what erases deck identity.

**Bartering's conversion breaks both chains** — a route rents access instead of converting, so 🪙 no
longer has a one-shot exit into 🌾 at all. Jewelry and Raiding are the two edges left to cut.

Second, **buildings never out-rate the free work card** of their resource, while also costing 🔨, a
territory slot, and a draw — Storytelling 2🔬 vs Archives 2🔬 · Cave Art 2🎭 vs Burial 1🎭 ·
War Horse 4⚔️ vs City Walls 1⚔️. So production's only sink is a card category nobody needs. Cutting
the base work rates to 1 fixed the first two pairs as a side effect (Farm now *matches* Foraging,
Forge *doubles* Toolmaking); the remaining three still need the building side raised.

## Decided — money's topology: a one-way hub

Money's out-edges reach the other four; its in-edges are **producers only** (Trader, wonders,
buildings), never conversion. It's spent through **trade routes** — money rents standing access rather
than converting into stuff, which is a sink with no exchange rate to arbitrage. The **tin route carries
no bonus at all**: it purely gates bronze, so its cost is pure route-capacity opportunity cost.

- **The rule to hold, not just the card:** *a route may produce money, or non-money — but no card may
  convert that non-money output back into money.* Otherwise route + converter is a pump at any rate.
- **Jewelry** (🔨→🪙) is cut or re-pointed — it is the exact inverse of the planned Bronzeworking
  (🪙→🔨) and would form a two-card loop at the centre of the age. ✅ **Resolved:** re-pointed into a
  🪙 *work* box (a worker makes money; nothing converts 🔨 into it), so the loop never forms.
- **Raiding** (⚔️→🪙) is cut, or charged in **culture** — never spent and gates hand size, so it can't be
  arbitraged back, and "raiders don't build civilizations" reads well. ⚠️ The culture option dies if
  culture leaves the age — cut it, or charge it in something else.
- ~~**Consequence to honour:** money leaves the optional tier for the Bronze Age.~~ **Superseded** by
  the restructure above — money enters at Stone col 3. The generalization survives the reversal and is
  worth keeping — **each age promotes one resource into the substrate** — but Stone now takes food +
  production + money, and what Bronze promotes is open (culture is the candidate).
- **Check before building:** money's Stone-Age faucet is the reworked Jewelry alone, with Trader
  (3🪙/worker) and whatever Naval adds arriving in Bronze. Hand-check 🪙/round for N routes against a
  realistic deck's income; if it doesn't clear, the escalating-cost curve gives.

## Remaining work

1. **Money topology** — the trade-route zone (shipped; Bartering converted as its first route) and
   Jewelry (re-pointed to a work box) are done; **Raiding** is the last edge to cut. Unblocks the rest,
   because whether a military converter is fine depends entirely on whether ⚔️ is a sink or a way station.
2. **Buildings out-rate work cards** — restores production's identity and makes territory (so military)
   worth something. Half-landed as a side effect of the base-rate cut; the remaining three pairs need
   the building side raised. A building's pitch is a *different kind of thing* (never drawn, scales per
   worker, eats a slot), so the lever may be draw/deck pressure rather than the Farm's number.
3. ~~**Superlinear food upkeep**~~ — ✅ landed as `floor(pop²/4)` at mission 1. What remains is the
   consequence: a stronger food faucet before Masonry (see *Consequences owed*).
4. *(optional, later)* Narrow production to buildings only — hold until (2) lands, or the resource has a
   single sink nobody wants. Give **science an expensive sink**: its identity (deck churn) is fine, but
   Calendar costs 1🔬 and Writing 2🔬 and Reading the Seasons asks you to *stockpile*, so the resource is
   never demanded in quantity.

**Re-point the money objectives.** Accounting (40🪙), Pyramid (50🪙) and Göbekli Tepe (30🪙) are *hoard*
goals, pushed against by `envious_population`. A one-way hub whose point is spending sits awkwardly with
them — playable, but the wildcard is switched off during the missions built around it. Decide per
mission rather than discovering it in the sweep.

## The anchor is a detector, not a target

Compute what a worker-round is worth per resource to find the card that's 4× off — then deliberately
leave things at 0.7× and 1.6×. Uneven-on-purpose is design; uneven-and-freely-composable is the bug.
**Flattening every card to 1.0× is the failure mode to avoid** — and mission 1 is already brushing it:
with 🌾 and 🔨 both at 1/worker, they trade exactly 1:1 there, which is why that mission has one live
axis instead of two. Tolerable as an opening; not a template.
