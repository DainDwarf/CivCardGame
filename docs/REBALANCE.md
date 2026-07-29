# CivCardGame — Resource-economy rebalance pass

> The working thread of the **`trade-redesign` branch**. Was [`BACKLOG.md`](BACKLOG.md)'s *Step 10*,
> scheduled between the Bronze and Iron arcs; **pulled forward** once the trade-route zone shipped on
> this branch, so the rates follow here instead of waiting for Iron. BACKLOG keeps a one-line status
> pointer at Step 10; the live state is all here.
>
> ## ⚠️ The cap model changed mid-thread — re-measured for rows 1–10
>
> This thread was worked while buildings, Work boxes **and** trade routes shared one territory cap.
> That cap has since been reverted: **territory caps the tableau alone**, work and trade cost none,
> Conquest and Road are `work` cards again, and board territory went back to Tribe 0 / Settlement 2 /
> Chiefdom 0 / City 2.
>
> **`baselines/results/` has been re-cut** for the eleven fixtures behind rows 1–10 (greedy+planner
> @100, oracle @10). Headline: the oracle still clears every cell (90–100%), so nothing became
> unwinnable, and most cells moved by ≤3 points. Three did move — Masonry greedy **0 → 77** and
> Chiefdom **0 → 57** (the stalls are gone), and Growing Numbers planner **100 → 78**; each is written
> up in its own dossier.
>
> Rows 11–16 were never balanced, so their stale rows were **removed** rather than left reading as
> fact. `npm run sim -- --baseline scripts/sim/baselines --policies greedy,planner --seeds 100`
> regenerates the full set when those missions reach their pass.
>
> Still to re-derive by hand: the **prose** that reasons about slots — the Chiefdom identity, the
> Hunting board-slot cost, the first-trades slot economics — has lost its premise even where the
> numbers now agree. The **rates** are mostly untouched by the change and carry over.
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
| 8 | `first_temple` | ✅ | ✅ | ✅ | ✅ | [first-temple](missions/first-temple.md) |
| 9 | `finding_copper` | ✅ | ✅ | ✅ | ✅ | [copper](missions/copper.md) |
| 10 | `masonry` | ✅ | ✅ | ✅ | ✅ | [masonry](missions/masonry.md) |
| 11 | `pyramid` | ⬜ | ⬜ | ⬜ | ⬜ | [pyramid](missions/pyramid.md) |
| 12 | `accounting` | ⬜ | ⬜ | ⬜ | ⬜ | [accounting](missions/accounting.md) |
| 13 | `writing` | ⬜ | ⬜ | ⬜ | ⬜ | [writing](missions/writing.md) |
| 14 | `horse_taming` | ⬜ | ⬜ | ⬜ | ⬜ | [horse-taming](missions/horse-taming.md) |
| 15 | `roads` | ⬜ | ⬜ | ⬜ | ⬜ | [roads](missions/roads.md) |
| 16 | `wheel` | ⬜ | ⬜ | ⬜ | ⬜ | [wheel](missions/wheel.md) |
| — | `ice_age` · `sandbox` | ⬜ | ⬜ | ⬜ | ⬜ | — |

Per-row notes, where the ⬜ isn't the whole story:

- **1–10 were re-measured** under the split cap (see the banner above) — and 1–7 before that, after Dogs
  became Hunting. `baselines/results/` carries the current greedy/planner/oracle rows and the ✅s stand
  on them. Only the Masonry and Growing Numbers dossiers have been brought in step with those rows;
  **every other dossier's tables still quote the pre-change numbers**.
- **3 · `raiders_at_border`** moved no rate of its own — the mission proved sound as authored, and what
  changed is the deck a player *arrives* with. **6 · `reading_seasons`** moved none either, and is the
  only cell where nothing about the mission changed at all.
- **8 · `first_temple`** kept its four-term conjunction's 🧍 and 🎭 terms and **dropped both spendable
  ones** (30🔨, 30🪙) — see *Re-point the money objectives*. It is the age's **long** mission by design:
  an oracle median of ~40 turns against the 11–16 band before it, accepted rather than tuned away.
- **9 · `finding_copper`** moved no threshold — the mission proved sound as authored and what changed is
  the deck. Its Forge price cut is a **rate move no committed cell measures**: the Forge is this
  mission's own reward, so it is absent from the very fixture that would have caught it, and the five
  cells that do stock it (11–13, 15–16) are all still ⬜.
- **12 · `accounting`** is a second hoard goal.
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
| 7+ | Dogs → **Hunting**: the 1🌾→1⚔️ `action` becomes a free `work` box at **1⚔️**/worker (card id still `dogs`). ⚔️ stops being bought with 🌾 and starts costing a worker for the turn (the board slot it also cost when this was measured is no longer charged). Post-dates mission 7's pass rather than coming out of it — a trial, measured across all seven swept cells at once |
| 9 | **Forge** 4🔨 → **3🔨**, output unchanged at 2🔨/worker — so it now undercuts the Archives it was priced level with. **Unmeasured**: it is `finding_copper`'s own reward and so absent from that cell's deck, and every cell that stocks it is still ⬜ |

The base-rate cut fixed three work-card/building pairs as a side effect — Farm now *matches* Foraging,
Forge *doubles* Toolmaking, Archives *doubles* Storytelling. The culture pair went the other way, by
**replacing the building rather than raising it**: Burial became Sun Stone at the Farm/Foraging shape
(permanent output at the work card's rate), and Cave Art was cut, leaving Beer as culture's work card.

### Chiefdom — pop 3 / terr **0** / 🌾 **8** ⚠️ premise changed

Chiefdom is the *low-territory / high-population* government in
[`missions/raiding.md`](missions/raiding.md) — which locks Warband as "keeping Chiefdom's shape". The
shared-cap pass gave it territory 2 to make three workers share two slots; with the cap split it sits
at **0** like Tribe, and the shortage it expresses is now specifically a *building* shortage — its
three workers can all still work, just never in a building until it takes land.

**Why territory and not the spendable pools.** Five of a board's eight numbers are one-time and wash
out by turn 10; only population and territory are standing capacities, felt every round. They are the
whole persistent-differentiation budget a board has. This reasoning survives the cap change intact.

**6⚔️ is still exactly two Conquests** (2⚔️ doubling per play per copy → 2 then 4), which is what
kept the number when the cap moved. What that buys changed: two slots from a standing start rather
than a top-up from 2 to 4 — and, now that Conquest is a `work` card, it also costs two worker-turns.
**Unmeasured under the split cap.**

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
a rule with every rule still printed on a readable card face — though on a landless Chiefdom a starting
*building* has nowhere to stand, so it would have to be a route or a granted slot; (2) a board rule keyed to a **concept**,
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

- **Money enters at Stone, not Bronze**, which reverses the plan that put it in the Bronze substrate.
  The topology **rule** survives intact (see *Open*); what lapses is the age it belongs to. Culture also
  stayed in Stone rather than opening Bronze, so **what Bronze promotes is open**. ⚠️ The move was taken
  partly to make `first_temple`'s 30🪙 reachable without re-pointing, and **that goal is now gone** — so
  money arrives in Stone with no mission demanding it in quantity
  ([first-temple](missions/first-temple.md) → *Open*).
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
  it is not yet *deleted* because three baselines still stock it (`accounting`, `roads`, `pyramid`) and
  would fail to load, so the card goes with the last of them to be re-cut. `finding_copper` and
  `masonry` dropped it at their own re-cuts.
- **`plannerPolicy.integration.test.ts`'s Masonry win-rate case is un-skipped and green, with no margin.**
  It carries the re-cut deck now and passes at exactly its `>= 4` threshold (4/6). Those six seeds are a
  cold slice — the same fixture measures 86/100 over the full sweep — so the thinness is sampling, not the
  planner. Left as-is deliberately; the assertion is the **planner's capability claim** (the greedies win
  Masonry 0%), not a Masonry balance check, so if it ever goes red the move is a wider sample, never a
  lower bar.

### Rates still to settle

- **Raiding (3⚔️ → 6🪙) is the last converting edge.** Money's topology is a **one-way hub**: producers
  only on the in-edges, spending outward, so there is no exchange rate to arbitrage — now graduated to
  [`DESIGN.md`](DESIGN.md) → *Core resources*, including the stronger form (**a route may produce money
  or non-money, but no card may convert that non-money output back into money**). Raiding predates the
  rule and breaks it. Cut it, or charge it in **culture** — never spent and gating hand size, so it
  can't be arbitraged back, and "raiders don't build civilizations" reads well.
- **Does the workshop+route pair scale?** The First Trades measured a *single* pair, its deck holding one
  copy of each card, so no run there could build a second. The route out-rates the building that funds
  it, so pair *N* costs what pair 1 did with no diminishing term. **Sharper since the cap split**: the
  route half now costs no territory at all, so only the workshop is braked by slots and the rent is the
  only thing that curves. Needs
  a deliberately multi-copy deck on a slot-rich board: if two pairs simply double the food, the pair is
  the dominant food line everywhere rather than an alternative to one, and either the rent or the return
  has to curve. Trader (3🪙/worker) and whatever Naval adds arrive in Bronze and change the arithmetic
  again.
- **City Walls' maintenance is cut, unmeasured.** The card is now 3🔨 flat for +1⚔️/round with **no
  upkeep** (was 4🔨 and −1🔨/round). The rate reading that preceded it stands and is what the cut acts
  on: the old "owed raise" against War Horse is **withdrawn** — that read set 4⚔️ *per play* against 1⚔️
  *per round forever*, and City Walls takes no workers, so the worker-turn basis doesn't apply. Amortized
  instead, one War Horse in a ~23-card deck at hand 4 is drawn about every 6th turn ≈ **0.7⚔️/turn**,
  rising to ~0.9 as buildings thin the deck, against City Walls' flat **1⚔️/turn** — the building already
  out-rates it. The *price* check that was still open (⚔️ at ~1.2🔨 each over a 20-turn run, against Bow's
  0.67🔨 capped at 3⚔️ per copy) is what the cut answers; it has not been swept.
- **Science is never demanded in quantity.** Its identity (deck churn) is fine and it now has a sink at
  all, but both card sinks are 2🔬 one-shots (Calendar, Writing). `finding_copper`'s 15🔬 across three
  veins is the only place quantity is asked for, and that's a mission-seeded event rather than a card.
- *(optional, later)* **Narrow production to buildings only** — hold until buildings have a reason to
  exist beyond reliability. A building's pitch is a *different kind of thing* (never drawn, scales per
  worker, eats a slot), so the lever may be draw/deck pressure rather than the Farm's number.

### Placement and economy

- **Re-point the money objectives.** Accounting (40🪙) and Pyramid (50🪙) are *hoard* goals, pushed
  against by `envious_population`. A one-way hub whose point is spending sits awkwardly with them —
  playable, but the wildcard is switched off during the missions built around it. Decide per mission
  rather than discovering it in the sweep.
  - ✅ **Göbekli Tepe's 30🪙 is dropped**, along with its 30🔨, leaving 4🧍 · 🎭 level 2 — the first of
    the three resolved. Reasoning in [first-temple](missions/first-temple.md) → *Design*; the money
    faucet+sink cancelling exactly, with the hoard gone, is logged as a strand in that dossier's *Open*.
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
