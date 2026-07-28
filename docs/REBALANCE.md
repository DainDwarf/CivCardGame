# CivCardGame — Resource-economy rebalance pass

> The working thread of the **`trade-redesign` branch**. Was [`BACKLOG.md`](BACKLOG.md)'s *Step 10*,
> scheduled between the Bronze and Iron arcs; **pulled forward** once the trade-route zone and the
> unified territory cap — its two prerequisites — shipped on this branch, so the rates follow here
> instead of waiting for Iron. BACKLOG keeps a one-line status pointer at Step 10; the live state is
> all here.
>
> **Scope:** the *rates* — what a worker-round is worth per resource, what converts into what, and
> what each mission is therefore asking for. A mission's own reasoning, sweep tables and readings live
> in its dossier (`docs/missions/<name>.md`); what stays here is what **reaches forward** past one
> mission.
>
> **Lifecycle:** transient, like [`TODO.md`](TODO.md) and [`BACKLOG.md`](BACKLOG.md). Decided design
> graduates to [`DESIGN.md`](DESIGN.md); the finished pass graduates to a
> [`CHANGELOG.md`](../CHANGELOG.md) entry drawn from this file, and then this file is deleted.
> Nothing durable should cite it.

## Method

**The anchor is a detector, not a target.** Compute what a worker-round is worth per resource to find
the card that's 4× off — then deliberately leave things at 0.7× and 1.6×. Uneven-on-purpose is design;
uneven-and-freely-composable is the bug. **Flattening every card to 1.0× is the failure mode to
avoid** — and mission 1 is already brushing it: with 🌾 and 🔨 both at 1/worker they trade exactly 1:1
there, which is why that mission has one live axis instead of two. Tolerable as an opening; not a
template.

**The yardstick is the worker-turn.** It is the one basis on which a work card and a building are
commensurable: a work box pays its printed number once per play and hands the worker back, while a
building pays it every round it holds one. Equal printed numbers are therefore equal throughput *per
worker*, and the building's edge is reliability (never undrawn) plus deck-thinning, **not rate**. A
card that takes no workers — a trade route, City Walls — sits outside the basis entirely and has to be
amortized against draw frequency instead.

**Mission by mission, from the first.** A rate is only judgeable against something that has to be
achieved with it, so each mission is re-read under the new numbers in campaign order, and the rates
move where that mission proves they must. The alternative — set every rate globally, then check — was
tried on paper and gives no signal about which number was wrong.

What "done" means for one mission is the status board's four columns.

**Every fixture and result not yet reached is stale** — they name cards that are on trial and they
predate the rates. Re-measure per mission, never per change; a mid-pass whole-set sweep measures
nothing but noise.

## Status board

The index; each mission's *detail* lives in its dossier, this table is the glance. `#` is the order the
pass works them in; **3–4, 5–6, 9–10, 11–12 and 14–15** each fork off one clear, so those are read as
pairs rather than one after the other.
Stages: **Rate** (content realigned to the new numbers) · **Fixt** (baseline re-cut to a deck a player
can actually own at that point) · **Swept** (measured, records in `scripts/sim/baselines/results/`
updated) · **Strd** (whatever it strands resolved, or logged under *Open*). Legend: ✅ done ·
🟡 in progress/pending · ⬜ not started.

| # | Mission | Rate | Fixt | Swept | Strd | Dossier |
|---|---|:-:|:-:|:-:|:-:|---|
| 1 | `first_settlement` | ✅ | ✅ | ✅ | ✅ | [first-settlement](missions/first-settlement.md) |
| 2 | `growing_numbers` | ✅ | ✅ | ✅ | ✅ | [growing-numbers](missions/growing-numbers.md) |
| 3 | `raiders_at_border` | ✅ | ✅ | ✅ | ✅ | [raiders](missions/raiders-at-border.md) |
| 4 | `harsh_winter` | ✅ | ✅ | ✅ | ✅ | [harsh-winter](missions/harsh-winter.md) |
| 5 | *The First Trades* | ✅ | ✅ | ✅ | ✅ | [first-trades](missions/first-trades.md) |
| 6 | `reading_seasons` | ✅ | ✅ | ✅ | ✅ | [reading-seasons](missions/reading-seasons.md) |
| 7 | *Rites & Rituals* | ✅ | ✅ | ✅ | ✅ | [rites](missions/rites.md) |
| 8 | `first_temple` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 9 | `finding_copper` | ⬜ | ⬜ | ⬜ | ⬜ | [copper](missions/copper.md) |
| 10 | `masonry` | ⬜ | ⬜ | ⬜ | ⬜ | [masonry](missions/masonry.md) |
| 11 | `pyramid` | ⬜ | ⬜ | ⬜ | ⬜ | [pyramid](missions/pyramid.md) |
| 12 | `accounting` | ⬜ | ⬜ | ⬜ | ⬜ | [accounting](missions/accounting.md) |
| 13 | `writing` | ⬜ | ⬜ | ⬜ | ⬜ | [writing](missions/writing.md) |
| 14 | `horse_taming` | ⬜ | ⬜ | ⬜ | ⬜ | [horse-taming](missions/horse-taming.md) |
| 15 | `roads` | ⬜ | ⬜ | ⬜ | ⬜ | [roads](missions/roads.md) |
| 16 | `wheel` | ⬜ | ⬜ | ⬜ | ⬜ | [wheel](missions/wheel.md) |
| — | `ice_age` · `sandbox` | ⬜ | ⬜ | ⬜ | ⬜ | — |

Per-row notes, where the ⬜ isn't the whole story:

- **3 · `raiders_at_border`** moved no rate of its own — the mission proved sound as authored, and what
  changed is the deck a player *arrives* with. **6 · `reading_seasons`** moved none either, and is the
  only cell where nothing about the mission changed at all.
- **8 · `first_temple`** has a 30🪙 hoard goal (see *Re-point the money objectives*), and its committed
  fixture is **STALE** rather than merely unreached: the Burial in it became Sun Stone at a new rate, so
  its numbers describe a deck it no longer holds. It is the one mission past the frontier with no
  dossier.
- **10 · `masonry` and 11 · `pyramid` are blocked**, not merely queued — both need a food faucet that
  doesn't exist yet (*Blocking a mission*). **12 · `accounting`** is a second hoard goal.
- **`ice_age` · `sandbox`** are infinite, so `Swept` can never mean a win rate there: read the collapse
  round instead. They are last because nothing downstream depends on them.

## Landed

### The rate ledger

What every later cell is measured against. Each mission's reasoning and sweep is in its dossier.

| Landed at | Change |
|---|---|
| 1 | Foraging 3🌾 → **1🌾**/worker · Toolmaking 2🔨 → **1🔨**/worker · Dogs 1🌾→2⚔️ → **1🌾→1⚔️** (the last flat ×2 converter in the opening deck) |
| 1 | Food upkeep flat → **`floor(pop²/4)`**; marginal `foodPerNextPop(n) = floor(n/2)`. `FOOD_PER_POP` is gone. Chosen over a gentler pair-band curve deliberately, to see how it feels before softening it: cheaper than the old flat rate at pop 2–3, harsher from 5 up |
| 1 | Tribe → **10🌾 / 2🗺️** · `MIN_DECK_SIZE` 20 → **10** · Founding deck → 4 Foraging / 4 Toolmaking / 2 Bow / 2 Dogs |
| 2 | Settlement 2🔨 → **5🔨** at start, and `boardUpgrade: tribe → settlement` moved to this mission — so missions 3+ are all measured on the new number |
| 2 | Conquest 5⚔️ flat → **2⚔️ doubling per play of that copy** (per-copy via `CardInstance.counters`). Landing it needed the **cost spine** (`rules/cost.ts`), now decided design in CLAUDE.md |
| 3 | Storytelling 2🔬 → **1🔬**/worker · **Fire** is new (1🔬 for one card discarded from hand), the first shipped consumer of `CardCost.discard` |
| 3 | **Bead Workshop** → a `building` (2🔨, then 1🪙 per staffed worker) · **Bartering** → a route opening for 1🪙 at 1🪙 rent → **2🌾**/round. Both moved onto money's *producer* side, which is what keeps the one-way hub intact |
| 4 | `FIRST_TRADES_FOOD` = **25🌾**, set on turn times (13 · 15 · 16 at oracle/planner/heuristic) · **Sun Stone** (the re-rated Burial) and **Calendar** (2🔬 → look at the top 3 and draw one) are `reading_seasons`' grants |
| 5 | The culture pair halved — **Beer** 1🌾 → **1🎭** (work) · **Sun Stone** **3🔨** → **1🎭**/worker (building). The level curve holds at cumulative **10 / 30 / 70** (`CULTURE_STEP = 10`): the producers were the freshly-rated numbers and the curve the oldest, so they moved |
| 5 | **Irrigation** keeps +1🌾 and now also charges **+1🔨 to play**, reaching work cards as well as buildings · **Elegant** is new: **+1🎭, +1 🎭 level to play**, on a culture producer of either kind |

The base-rate cut fixed three work-card/building pairs as a side effect — Farm now *matches* Foraging,
Forge *doubles* Toolmaking, Archives *doubles* Storytelling. The culture pair went the other way, by
**replacing the building rather than raising it**: Burial became Sun Stone at the Farm/Foraging shape
(permanent output at the work card's rate), and Cave Art was cut, leaving Beer as culture's work card.

### Chiefdom — pop 3 / terr **2** / 🌾 **8** ✅

Territory 4 → **2**; everything else unchanged. Chiefdom was the *low-territory / high-population*
government in [`missions/raiding.md`](missions/raiding.md) — which locks Warband as "keeping
Chiefdom's shape" — but carried Settlement's territory 4, so the identity existed only on paper. Now
three workers share two slots and one starts idle.

**Why territory and not the spendable pools.** Five of a board's eight numbers are one-time and wash
out by turn 10; only population and territory are standing capacities, felt every round. They are the
whole persistent-differentiation budget a board has, and no board had used them on purpose. Chiefdom's
6⚔️ was its only identity and it was gone by turn 3.

**6⚔️ was already the right number**, which is why it didn't move: Conquest costs 2⚔️ doubling per
play per copy, so plays one and two are 2 then 4 — the start buys exactly two, taking territory 2 → 4.
The board states its strategy as a shortage the player spends the army to fix, rather than as a bonus.

Not pop 4: upkeep is `floor(pop²/4)`, so pop 4 eats 4🌾/round — break-even with *every* worker farming
(see *Open*). Pop 4 on two slots is a spiral, not a push.

**Food 6 → 8 ✅, measured** on the Rites & Rituals cell (the first mission a player can bring Chiefdom
to with a full Stone Age collection). At 6🌾 and 2🌾/round upkeep the board had **three rounds** of
slack, which is less than any food line in the deck takes to build — so the *ceiling* was runway-bound,
not just the fair-competent tier:

| policy | 6🌾 | **8🌾** | 10🌾 |
|---|---|---|---|
| random @100 | 0% | 0% | 0% |
| heuristic @100 | 4% | 8% | 9% |
| greedy @100 | 0% | 0% | 3% |
| planner @100 | 26% | **40%** | 62% |
| deepPlanner @10 | 50% | **90%** | 90% |
| oracle @10 | 90% | **100%** | 100% |

**8 because the curve splits there.** The two deep policies reach 10🌾's numbers exactly at 8, so the
fourth round is what the ceiling was missing; the default planner gains only a third of the distance,
because what *it* is short on is the depth to commit to a setup dip, not runway (deepPlanner on the
same 8🌾 gets 90%). Paying two more food to move a number that isn't measuring the content is the
wrong trade — and it would cost the trait: at 10🌾 Chiefdom's food would equal Tribe's and
Settlement's, leaving terr 2 / pop 3 / 6⚔️ as its whole identity. At 8 it is still the lowest start
of the four, with **four rounds** of slack against Settlement's ten.

**The board's own lines stay load-bearing at 8🌾**, which is the check that mattered: planner plays
Conquest 1.7×/run ending at terr 3.7, and still opens the Bead Workshop + Bartering route in a fifth of
its runs; the oracle's only unplayed card is Hut. Contrast a **2× Irrigation Farm** (3🌾/worker on one
slot — swept *before* Irrigation gained its 🔨 surcharge, so the modern sticker is weaker than this),
swept on the same cell as the alternative fix: greedy 0 → 76% while ending at territory **2.0**
with Conquest *and* Bartering unplayed. That is the failure mode to watch on this board — a single card
that answers both the slot shortage and the food clock at once switches off every decision the board
exists to pose, where extra food buys the *time* to run those decisions.

⚠️ **The deep rows are 10 seeds**, so 90 vs 100% there is one run either way. The 8-vs-10 call rests on
the planner column and on the trait argument, not on those.

**Still open — do boards get behaviour, not just numbers?** Deliberately deferred until this is played:
numbers-only may be a complete answer now that the persistent axis is used on purpose. If it still reads
bland, the ranked options are (1) a board starting with a card already **in play** — flavour as loud as
a rule with every rule still printed on a readable card face, and on Chiefdom it would occupy one of the
two slots, sharpening the squeeze rather than paying it off; (2) a board rule keyed to a **concept**,
e.g. *territory gained is doubled* — survives Road and anything after, unlike naming Conquest. Ruled
out either way: a board rule that changes a **card's printed numbers**, which makes the card face lie
on one board. Watch that any such rule doesn't make Chiefdom the *answer* to the territory-hungry
missions (Masonry, Wheel) instead of a *choice*.

### The Stone Age DAG, restructured ✅

Both middle branches were authored *resource first, pressure second*, and leaning the starting
collection left the player arriving at each branch's first mission owning **zero** cards that make the
resource it asks for. A resource has to be *granted* before a mission can demand it, and a pressure
mission demands no resource — so the order inverted:

| | col 2 — pressure | col 3 — resource | col 4 |
|---|---|---|---|
| **upper** (row -1) | `raiders_at_border` — moved | *The First Trades* — 🪙 + trade routes, new | *Rites & Rituals* — 🎭 level 1, on the **reconvergence** of both branches |
| **lower** (row +1) | *Harsh Winter* — a rewrite of `restless_people` | `reading_seasons` — moved | |

Each col-2 mission's **reward is the col-3 mission's toolkit** (the money pair, then the science pair),
and each col-3 tip grants a **culture producer** — Beer from the upper, Sun Stone from the lower — so
the convergence node is reached holding both, and holding two different *kinds* of producer. `first_temple`
re-points onto that node at col 5; the capstone and every Bronze mission shifted one column right behind
it (stone spans cols 0–5, bronze 6–10). **The age's DAG is final**, and every mission in it is measured.

Consequences that outlived the restructure:

- **Money enters at Stone, not Bronze**, which reverses the plan that put it in the Bronze substrate —
  taken in exchange for `first_temple`'s 30🪙 becoming reachable without re-pointing. The topology
  **rule** survives intact (see *Open*); what lapses is the age it belongs to. Culture also stayed in
  Stone rather than opening Bronze, so **what Bronze promotes is open**.
- **Both wonders stay playable** — Göbekli Tepe's `cultureLevelReq: 1` and Pyramid's `2` are play-gates,
  and the culture node sits upstream of both. `first_temple` and `pyramid` keep their 🎭 level 2 goals.
- **Hand size stays pinned at 4 until the convergence**, culture being its only lever.
- ⚠️ `content/missions.test.ts` now pins prereq id **existence and acyclicity** — it caught `first_temple`
  the moment `rites_rituals` was deleted. It **cannot** catch a real-but-*wrong* id: pointing a mission at
  `growing_numbers` instead of the branch tips passes both checks and quietly flattens the DAG.

## Open

### Before merging to `main`

- **Cave Art is stranded.** Cut from the starting collection and unlocked by nothing, so it is
  unobtainable in-game — and **nothing merges to `main` with a card stranded**. The cut is decided (it
  made Beer's 2🎭 for no 🌾, obsoleting a shipped card, and no reward slot was left to grant it from);
  it is not yet *deleted* because six baselines still stock it (`first_temple`, `finding_copper`, `masonry`,
  `accounting`, `roads`, `pyramid`) and would fail to load, so the card goes with the last of them to be
  re-cut.
- **`plannerPolicy.integration.test.ts`'s Masonry win-rate case is `it.skip`ped.** Two reasons at once,
  which is why it's parked rather than retuned:
  - Its hardcoded deck fields **bartering · bead_workshop · cave_art** — the first two at pre-rework
    rates, the third still homeless — so the fixture is stale whatever the numbers say.
  - Conquest's 2⚔️-doubling price pushed it from 4/6 to **3/6** against a `>= 4` threshold. Expected
    direction (Masonry converts ⚔️→🗺️→🧍 repeatedly, so a doubling territory card bites hardest exactly
    there), but it's a **one-seed** move on a 6-sample proxy, so it doesn't measure *how much*.

  The assertion is the **planner's capability claim** (the greedies win Masonry 0%), not a Masonry
  balance check — so it must come back rather than be relaxed. **Un-skip before merging.**

### Blocking a mission

- **Population is hard-capped at 4.** The best food rate in the game is now 1🌾/worker (Foraging *and*
  Farm), so all-hands-farming income (`pop`) crosses upkeep (`floor(pop²/4)`) at pop 4 — 4 vs 4,
  break-even; pop 5 is 5 vs 6, already negative with every worker farming and nothing else running.
  **Masonry's 6🧍 goal and the multi-worker wonders (Göbekli 3, Pyramid 4) are unreachable** until a
  stronger food source ships. Whichever mission unlocks that faucet is a *hard prerequisite* for them,
  not a balance nudge — decide it before reaching Masonry. Masonry likely also wants a territory route
  that doesn't escalate: Road, a wider board, or a cap on Conquest's curve.

### Rates still to settle

- **Raiding (3⚔️ → 6🪙) is the last converting edge.** Money's topology is a **one-way hub**: producers
  only on the in-edges, spending outward, so there is no exchange rate to arbitrage — now graduated to
  [`DESIGN.md`](DESIGN.md) → *Core resources*, including the stronger form (**a route may produce money
  or non-money, but no card may convert that non-money output back into money**). Raiding predates the
  rule and breaks it. Cut it, or charge it in **culture** — never spent and gating hand size, so it
  can't be arbitraged back, and "raiders don't build civilizations" reads well.
- **Does the workshop+route pair scale?** The First Trades measured a *single* pair, its deck holding one
  copy of each card, so no run there could build a second. The route out-rates the building that funds
  it, so pair *N* costs what pair 1 did with **territory the only brake** and no diminishing term. Needs
  a deliberately multi-copy deck on a slot-rich board: if two pairs simply double the food, the pair is
  the dominant food line everywhere rather than an alternative to one, and either the rent or the return
  has to curve. Trader (3🪙/worker) and whatever Naval adds arrive in Bronze and change the arithmetic
  again.
- **City Walls' 1🔨/round maintenance is the suspect number.** Its old "owed raise" against War Horse is
  **withdrawn** — that read set 4⚔️ *per play* against 1⚔️ *per round forever*, and City Walls takes no
  workers, so the worker-turn basis doesn't apply. Amortized instead: one War Horse in a ~23-card deck at
  hand 4 is drawn about every 6th turn ≈ **0.7⚔️/turn**, rising to ~0.9 as buildings thin the deck,
  against City Walls' flat **1⚔️/turn** — the building already out-rates it. What's left is a *price*
  check: over a 20 turn run City Walls buys ⚔️ at ~1.2🔨 each, where Bow buys it at 0.67🔨 (capped at
  3⚔️ per copy, since Bow self-exiles). Needs a measurement before any move.
- **Science is never demanded in quantity.** Its identity (deck churn) is fine and it now has a sink at
  all, but both card sinks are 2🔬 one-shots (Calendar, Writing). `finding_copper`'s 15🔬 across three
  veins is the only place quantity is asked for, and that's a mission-seeded event rather than a card.
- *(optional, later)* **Narrow production to buildings only** — hold until buildings have a reason to
  exist beyond reliability. A building's pitch is a *different kind of thing* (never drawn, scales per
  worker, eats a slot), so the lever may be draw/deck pressure rather than the Farm's number.

### Placement and economy

- **Re-point the money objectives.** Accounting (40🪙), Pyramid (50🪙) and Göbekli Tepe (30🪙) are
  *hoard* goals, pushed against by `envious_population`. A one-way hub whose point is spending sits
  awkwardly with them — playable, but the wildcard is switched off during the missions built around it.
  Decide per mission rather than discovering it in the sweep.
- **Trader's home is open.** It was `accounting`'s reward as "the money faucet that opens the money
  spine", but the spine now opens five missions earlier. Either Trader moves up, or `accounting` keeps it
  as a *better* faucet than Bead Workshop and its pitch is rewritten. Decide when the pass reaches
  Accounting.
- **The Influence faucet ledger has moved.** The First Trades inherited `rites_rituals`' 8⭐ deliberately,
  so the *swap* left `cumulativeInfluenceInto` unchanged downstream — but reinserting the culture node as
  a *new* mission adds its 10⭐ on top: arrival at `first_temple` is 40 → **50⭐** and at Masonry 52 →
  **62⭐** (`npm run economy`; `campaign.test.ts` pins the Masonry number). Shop tiers and sticker prices
  are tuned against those. Both that 10⭐ and Harsh Winter's payout are still open shifts.
- **`MIN_DECK_SIZE` may not need to exist.** At 10 it is starting to look like a rule with no job; see
  [`IDEAS.md`](IDEAS.md). Not this pass's call.

### Loose ends

- ⚠️ **The look-only `reveal` interaction has no shipping consumer.** Calendar was its only one, and the
  rework made it a draw. The kind, `Board.tsx`'s branch and `sim/actions.ts`'s single-answer enumeration
  all stay — a peek card is a plausible thing to want again and the machinery is tested — but nothing in
  the catalogue exercises it.
- ⚠️ **A rounds-survived goal steers no policy.** `objectiveProgress` is flat in `G.round`, so
  `deriveEnablers` comes out empty and only the oracle reads as a difficulty measurement on such a cell
  ([harsh-winter](missions/harsh-winter.md) carries the measurement). Logged as transversal work in
  [`TODO.md`](TODO.md) — it belongs to the objective *shape*, so every later rounds-survived mission
  inherits it.
