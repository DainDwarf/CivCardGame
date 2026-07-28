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
| 3 | `raiders_at_border` · `harsh_winter` | ✅ **done** — the **pressure** pair, now first in each branch; both realigned, re-fixtured and measured |
| 4 | *The First Trades* · `reading_seasons` | ✅ **done** — the **resource** pair; both realigned, re-fixtured, measured. `reading_seasons` needed no rate change (100% at heuristic/greedy/planner/oracle, 0% random) and now grants **Sun Stone** (the branch's culture card, whose rate is settled at the convergence node) **+ Calendar** (see *Science gets its sink*) |
| 5 | *Rites & Rituals* | 🟡 — **written and placed**, unmeasured: the 🎭 convergence node, 🎭 level 1 ([dossier](missions/rites.md)). The culture-level curve is settled in its sweep |
| 6 | `first_temple` | ⬜ — 30🪙 hoard goal, see *Re-point the money objectives* |
| 7 | `finding_copper` · `masonry` | ⬜ — **masonry is blocked** on the food ceiling below |
| 8 | `pyramid` · `accounting` | ⬜ — both hoard goals; pyramid blocked on the food ceiling |
| 9 | `writing` | ⬜ |
| 10 | `horse_taming` · `roads` | ⬜ |
| 11 | `wheel` | ⬜ |
| — | `ice_age` · `sandbox` | ⬜ — infinite; no win to measure, read collapse round instead |

## Landed

### Chiefdom — pop 3 / terr **2** ✅ (unmeasured)

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
(see *Consequences owed*). Pop 4 on two slots is a spiral, not a push.

**Owed at the sweep:** food. 6🌾 is the lowest start of the four, against 2🌾/round upkeep at pop 3 —
three rounds of slack before a food source has to land. Unmeasured, and the first thing to read.

**Still open — do boards get behaviour, not just numbers?** Deliberately deferred until this is played:
numbers-only may be a complete answer now that the persistent axis is used on purpose. If it still reads
bland, the ranked options are (1) a board starting with a card already **in play** — flavour as loud as
a rule with every rule still printed on a readable card face, and on Chiefdom it would occupy one of the
two slots, sharpening the squeeze rather than paying it off; (2) a board rule keyed to a **concept**,
e.g. *territory gained is doubled* — survives Road and anything after, unlike naming Conquest. Ruled
out either way: a board rule that changes a **card's printed numbers**, which makes the card face lie
on one board. Watch that any such rule doesn't make Chiefdom the *answer* to the territory-hungry
missions (Masonry, Wheel) instead of a *choice*.

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

### Mission 3 — Raiders at the Border ✅

**No content edit.** Three waves at 3⚔️ each, no threat, food the only other pressure — the mission
proved sound at the new rates as authored. What moved is what a player *arrives* with: the DAG swap
puts Raiders directly after Growing Numbers, so its deck is now that mission's deck **exactly**, on
Settlement (Growing Numbers' clear having retired Tribe), with the 6⭐ arriving unspent and Irrigation
unbought. `raiders_at_border.json` is re-cut to that, and its rows in `baselines/results/` updated —
that cell only.

**Measured** (15 cards, no purchases, Settlement's 10🌾/5🔨/4🗺️/2🧍):

| policy | result | turns (min · median · max) | end 🌾 | Conquest plays/run |
|---|---|---|---|---|
| random @200 | 7/200 | 4 · 7 · 17 | −1.4 | 0.34 |
| heuristic @200 | 0/200 | 7 · 27 · 128 | −1.2 | 0.46 |
| greedy @100 | 100/100 | 6 · 11 · 41 | 5.8 | 0 |
| planner @100 | 100/100 | 6 · 9 · 16 | 4.1 | 0 |
| oracle @10 | 10/10 | 6 · 7 · 8 | 5.8 | 0 |

- **The competent floor is 100%.** Not one defeat across greedy, planner and oracle at 100 seeds; a
  wider greedy sweep @200 turned up a single famine. Against mission 2's greedy 26/100 on identical
  construction, **the arc's difficulty steps down here** — the pressure mission is easier than the
  resource mission that precedes it, which is the opposite of the restructure's intent and the first
  thing to weigh when Harsh Winter is written to sit opposite it.
- **The territory axis is dead.** Conquest is unplayed by *every* competent policy, Hut lands 2–3
  times per 100 runs, and all three end at pop 2 / 🗺️ 4 — Settlement's start, untouched. Mission 2
  made 🗺️→🧍 the live decision and this mission switches it off: Settlement already grants more slots
  than the run needs, so ⚔️ has exactly one buyer (the waves) and never competes with expansion.
- **Every competent policy converges on the same minimal ⚔️ budget** — Bow twice (2 × 3⚔️) and Dogs
  three times (3 × 1⚔️) = **9⚔️ against three waves at 3⚔️**, ending on ~0⚔️, identical across greedy,
  planner and oracle. Not a hard ceiling — Dogs is repeatable and food is spare, so ⚔️ is buyable at
  1🌾 indefinitely — but there is no *reason* to buy a tenth, so the plan is the same every run and
  skill can't express itself in it.
- **Skill shows in tempo, not survival**: oracle 7 turns · planner 9 · greedy 11. Everyone wins; the
  gradient is how fast.
- **Heuristic's 0/200 is a `sim/value.ts` blind spot, not content** — it leaves Dogs unplayed (the same
  gap recorded at mission 2), so it holds only Bow's 6⚔️, cracks two waves, and starves on the third's
  upkeep at a 27-turn median. It is not a difficulty signal: the resource it needs is on the table.
- **Not measured here: the money pair.** Bead Workshop and Bartering are this mission's *reward*, so
  no run in this cell owns either. Their first measurement is The First Trades' cell.

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
| **lower** (row +1) | **Harsh Winter** ✅ — ⚔️ toll + famine ramp, a rewrite of `restless_people` ([dossier](missions/harsh-winter.md)) | `reading_seasons` — 10🔬 kept, **moved**, and loses its reward |

Each col-2 mission's **reward is the col-3 mission's toolkit**: `raiders_at_border` grants the money
pair (Bead Workshop, Bartering), Harsh Winter grants the science pair (Storytelling, Fire).

And each col-3 **tip grants a culture card**, so whichever branch a player took, the Rites-as-convergence
node those tips would feed (see [`IDEAS.md`](IDEAS.md)) arrives with something to play. The First Trades
grants **Beer** ✅; `reading_seasons`' culture card is undecided, and is the new-reward it owes.

**The concrete `missions.ts` edits** — no mission in either branch is untouched, so a session picking
up one of the dossiers needs this list rather than the table's shorthand:

| Mission | Edit |
|---|---|
| `raiders_at_border` | ✅ `prereqs` → `['growing_numbers']`, `map` col **2** · ✅ reward gains Bead Workshop + Bartering (keeps Chiefdom) |
| `rites_rituals` | ✅ **deleted**, along with `rites_rituals_goal` — stranded **Burial**, since re-homed as **Sun Stone** on `reading_seasons` |
| `restless_people` | ✅ **rewritten** as `harsh_winter` at col 2 off Growing Numbers — new id, threat (`deep_cold`), goal and reward; `unrest` and `restless_people_goal` deleted with it ([dossier](missions/harsh-winter.md)) |
| `reading_seasons` | ✅ `prereqs` → `['harsh_winter']` · ✅ `map` col 2 → **3** · ✅ **reward is now Influence-only** — owes a new one, and it should be this branch's **culture card** |
| *The First Trades* | ✅ new: `prereqs: ['raiders_at_border']`, stone col 3 row -1 |
| `first_temple` | ✅ `prereqs` → `['first_trades', 'reading_seasons']` — both tips are final, and the lower one never moves again: the swap put `reading_seasons` at the tip, so the Harsh Winter rename doesn't reach this line |

**Landed — both branches.** `raiders_at_border` moved to col 2 off Growing Numbers and grants the
reworked money pair; **The First Trades** now holds col 3 and `rites_rituals` is deleted. On the lower
branch the two missions traded slots and the col-2 one was then rewritten: **Harsh Winter** sits at col 2
off Growing Numbers and grants the science pair, `reading_seasons` at col 3, and `first_temple` points at
both new tips. The restructure's shape is complete; what is left is measuring it.

**Mission 3 (lower) — Harsh Winter ✅.** Full detail in its [dossier](missions/harsh-winter.md); the
rate-level points for this pass:

- Its threat `deep_cold` is **one clause**: nothing until `HARSH_WINTER_ONSET` (5), then −1🌾 deepening
  each round until the winter **breaks** at `HARSH_WINTER_BREAK` (10), which is also the win. Bounded by
  a *lift*, not a ceiling: at 1🌾/worker against a pop cap of 4, a plateau survivable at all pins every
  worker to farming forever.
- **Deliberately one-dimensional**, at the accepted cost of no 🔨 and no ⚔️ sink — Toolmaking, Bow, Dogs
  and Conquest are played but their output is inert. A ⚔️ toll clause was built to fix exactly that and
  **cut after measurement**: with it the mission was unwinnable (0/10 at the oracle), without it 9/10 on
  the same constants. A tutorial mission is better one-dimensional than correct-but-layered.
- **Storytelling 2🔬 → 1🔬**/worker, granted here. This closes one of the three work-card/building pairs
  the *Diagnosis* below still owed: Archives (4🔨, 2🔬/worker) now **doubles** it, the shape Forge has
  against Toolmaking. Cave Art/Burial has since been resolved at `reading_seasons` (Sun Stone replaced
  Burial, Cave Art is cut); War Horse/City Walls has since left the list entirely (see *Diagnosis*).
- **Fire** is new and granted here: an action paying 1🔬 for one card discarded from hand — Storytelling's
  alternative rather than its better, the same 1🔬 bought with a card instead of a worker-round. It
  replaces **Calendar**, which is benched onto *Cards on trial*: the pair feeds a mission that asks the
  player to *stockpile* 🔬, and a card priced in science works against the goal it was granted for. The
  1🔬 is unmeasured — Harsh Winter's cell names no 🔬, so `reading_seasons`' sweep judges it.
- **Measured** on `scripts/sim/baselines/harsh_winter.json` (Growing Numbers' deck on Settlement, the
  same arrival state `raiders_at_border.json` uses), records in `baselines/results/`: greedy 3/100 ·
  planner 25/100 · **oracle 9/10** · random 0/10.
- ⚠️ **Only the oracle's number is a difficulty reading here**, and this is the first mission where that
  is true. A goal measured in *rounds* names no resource, so `objectiveProgress` is flat in `G.round` and
  `deriveEnablers` — which probes that function — comes out empty; the competent policies are given no
  reason to bank 🌾 or build a Farm. Measured, not assumed: a temporary synthetic "stockpile 20🌾"
  gradient term moved greedy 3 → 37% and planner 25 → 73% on this cell with no content change. Logged as
  transversal work in [`TODO.md`](TODO.md) — it belongs to the objective *shape*, so every later
  rounds-survived mission inherits it.

**The First Trades' goal: open a 🤝 trade route and hold `FIRST_TRADES_FOOD` 🌾** (25 provisional), no
threat and no events — the route's standing rent is the whole pressure, and it is one the player opts
into. The mission's own [dossier](missions/first-trades.md) carries the reasoning, the reward's two open
questions, and the balance watch list; the rate-level point for this pass is that the food target is the
knob deciding whether the mission is a decision or a script.

**Measured** at 25🌾. `scripts/sim/baselines/first_trades.json` is cut on **Settlement** (Growing
Numbers' deck + the money pair, 17 cards, no purchases) and its rows are in `baselines/results/`:
heuristic, greedy, planner and oracle all **100%**, medians 16 · 33 · 15 · 13 turns, every one of them
opening the route in every run and ending within 1🌾 of the target. **Chiefdom**, swept ad-hoc on the
same deck and seeds, is far harder — planner 92/100, heuristic 13/100, greedy 0/100, failing to famine
rather than bankruptcy.

**25🌾 stands**, chosen on the turn times: 13 · 15 · 16 at the oracle, planner and heuristic, in line
with missions 1–2. And **territory came back to life**, which `raiders_at_border` had switched off —
Conquest is played by heuristic, planner and oracle here. The dossier holds the per-board tables and
what each policy left unplayed.

What the mission could *not* answer is whether the workshop+route pair **scales** past one — its deck
holds a single copy of each card. That is a rate question about the trade zone rather than about this
mission, and is logged under *money's topology* below.

One sim-side change rode along: `sim/enablers.ts`'s card-cost probe injected candidate cards only into
`removed` and `tableau`, so a goal counting `G.tradeRoutes` read as unbankable and the planner had no
reason to pay a route's entry cost. It now probes the trade zone too — provably inert on every other
shipped mission, since nothing else counts that zone.

The two cards shipped **reworked past the dossier's spec** — Bead Workshop is a `building` (2🔨, 1🪙 per
staffed worker), not the work box the dossier drafted, and Bartering opens for 1🪙 and rents 1🪙/round
for **2🌾**/round. The faucet had to become permanent: a route's rent is charged every round while a work
card only pays on the turns it's *drawn*, and no copy count closes that gap (one copy in a ~23-card
deck reaches a 4-card hand ~17% of the time, four copies ~53%, against a 100% obligation) — so a
work-card faucet funding a permanent rent is not weak but unpayable. Permanence answered reliability
but not *throughput* — the pair was then a strict loss to a plain Farm — so the route's **return**
took the second lever to 2🌾, and it lands at 2 slots + 1 worker → 2🌾 against Farm's 1 slot + 1
worker → 1🌾: double output for double the slots and the same one worker. That is the trade Settlement's
pop 2 / terr 4 wants, and it is the first card in the arc priced on the *slots-for-workers* axis
rather than on rate. Unmeasured — see the dossier's Balance section for what to watch.

`raiders_at_border.json` is re-cut and measured (see *Mission 3* above). `rites_rituals.json` is deleted
along with its mission, and its rows are stripped from both files in `baselines/results/`.

Separately, and predating this branch: several fixtures stock **Cave Art**, which is in neither
`STARTING_COLLECTION` nor any mission's `unlockCardIds` — the *Cards on trial* list, being measured in decks
no player can build. Every such fixture is re-cut at its own mission's turn, and the trial list is what
resolves the underlying strandedness. (Storytelling has left that list — `harsh_winter` grants it.) Cave Art
is now **cut but not yet deleted**: six fixtures still reference it — `first_temple`, `finding_copper`,
`masonry`, `accounting`, `roads`, `pyramid` — and deleting the card would fail their load, so it goes with
the last of them to be re-cut. `first_temple.json` is additionally marked STALE now: Burial in it became
Sun Stone at a new rate, so its committed numbers describe a deck it no longer holds.

A *missing* prereq id used to fail nothing — `campaign.ts`'s `isAvailable` just never satisfies it, so
the mission dropped out of the campaign silently. `content/missions.test.ts` now pins prereq id
existence and acyclicity, which is what caught `first_temple` at the moment `rites_rituals` was deleted.
⚠️ It cannot catch a real-but-*wrong* id: pointing `first_temple` at `growing_numbers` instead of the
new branch tips passes both cases and quietly flattens the DAG. Naming the right missions is still on
whoever makes the edit.

Also fixed incidentally: `restless_people` demanded 🎭 level 2 while its only prereq chain was the
*science* branch, so it was reachable having never played the culture mission.

**Money enters at Stone, not Bronze.** This reverses *money's topology* below, which put money in the
Bronze substrate. Taken deliberately, in exchange for `first_temple`'s 30🪙 becoming reachable
without re-pointing. The topology **rule** survives intact — the reworked Bead Workshop produces 🪙 from a
worker instead of converting 🔨, and the route rents rather than exchanges, so there is still no
edge converting non-money back into money. What lapses is only the *age* the resource belongs to,
and with it the "each age promotes one resource into the substrate" framing: Stone now carries food,
production **and money**, leaving Bronze to promote something else.

**Trader's home is now open.** It was `accounting`'s reward as "the money faucet that opens the money
spine", but the spine opens five missions earlier. Either Trader moves up, or `accounting` keeps it
as a *better* faucet than Bead Workshop and its pitch is rewritten. Decide when the pass reaches Accounting.

### Culture leaves the Stone Age

**…and comes back at the convergence. ✅ Decided and shipped — culture stays in the Stone Age.**
`rites_rituals` is reinserted as a **culture-goal mission on the reconvergence of both branches**,
between {`first_trades`, `reading_seasons`} and `first_temple`: 🎭 **level 1**, no threat and no events,
reward 10⭐ with no unlock. Placed and unmeasured — the sweep is what settles the curve. See its
[dossier](missions/rites.md) for the level-1-not-2 reasoning, the open reward, and the balance watch list.

That closes the question and settles the consequences below:

- **Both wonders stay playable.** Göbekli Tepe carries `cultureLevelReq: 1` and Pyramid
  `cultureLevelReq: 2` — a hard play-gate, not a goal — and the node sits upstream of both.
- ✅ **The 🎭 *producers* are settled, one per branch.** Beer (1🌾 → 2🎭 work card) is granted by The First
  Trades on the upper branch; **Sun Stone** (4🔨 → 2🎭/worker building, the re-rated Burial) by
  `reading_seasons` on the lower one. Since the node ANDs both tips, a player always arrives holding
  both — and they are different *kinds* of producer, which is the point: a work card played from hand
  against a permanent building eating a territory slot. Cave Art is cut rather than rehabilitated; it
  made Beer's 2🎭 for no 🌾, so it obsoleted a shipped card.
- **The two orphaned culture goals keep their culture term**: `first_temple` (🎭 level 2) and `pyramid`
  (🎭 level 2) are both downstream of the node.
- **Hand size stays pinned at 4 until the convergence**, culture being its only lever.
- ⬜ **The culture-level curve is un-re-read.** Levels sit at cumulative **10 / 30 / 70** (`CULTURE_STEP
  = 10`, each band double the last, `rules/culture.ts`) — set when every converter ran ×2. Beer is the
  first culture producer priced at the new rates (1🌾 → 2🎭), and nothing in the pass has yet *asked*
  for a culture level. The convergence node now asks for one, so the curve finally has a mission to be
  judged against — settle it in **status-board row 5's sweep**, and expect it to move Beer's rate rather
  than the other way round. Level 1 is 10🎭, which looks trivially reachable off either producer; the
  dossier holds the ordered list of knobs.
- ✅ **`sim/enablers.test.ts`'s culture cases are off the shipped catalogue entirely.** They needed a
  mission whose *goal* is a culture level; that used to be `rites_rituals` and would next have been
  `restless_people`, which this same pass retires. They now install a synthetic `test_culture_win`
  (`rules/testFixtures.ts`) instead, so the culture question can be settled without a test re-point.
  ✅ `rules/objective.test.ts` and `sim/objective.test.ts` have followed at Harsh Winter's turn: their
  culture-threshold and gradient cases read `test_culture_objective`, since there is no longer a shipped
  culture goal to anchor on. The 🎭 shape is now pinned entirely off the catalogue — which is what lets
  culture re-enter the age wherever it lands without dragging a test re-point behind it.

**Ruled out: a culture mission early in Bronze** — the other candidate, which the
age-promotes-a-resource framing wanted once money vacated that slot. Culture stays in Stone, so what
Bronze promotes is open again.

✅ **The DAG edit it owed is done:** `first_temple` re-points onto the node, which takes the col-4 slot,
and the capstone plus every Bronze mission behind it shifted one column right (stone now spans cols 0–5,
bronze 6–10). The age's DAG is final.

### Science gets its sink ✅

**The diagnosis.** `harsh_winter` grants Storytelling (1🔬/worker) and Fire (discard a card → 1🔬);
`reading_seasons` then asks you to bank 10🔬. Both cards *make* science and **nothing owned spends it** —
the first sink of any kind was `finding_copper`'s Copper Veins (5🔬 each), two missions downstream, and the
first *card* sink was Writing (2🔬), four missions downstream. So the mission teaching you to stockpile a
resource handed it to you with nothing to do.

**The fix.** Calendar is rehabilitated as `reading_seasons`' **second** reward card, and reworked from
`1🔬 → look at the top 3` to **`2🔬 → look at the top 3 and draw one`**. It does not replace Sun Stone:
the one-culture-producer-per-branch-tip rule is what the convergence node's design rests on.

**Granting it *here* is what makes it legal.** The reason it was benched off `harsh_winter` was that it
*spends* the resource the mission it fed asks you to stockpile — but a reward is granted **on clear**, so
as `reading_seasons`' own reward it arrives after that run rather than during it. The objection lapses
entirely; it does not merely weaken.

**Why the pick, and why 2🔬.** The old peek was look-only, and a card that buys pure information was
thin enough that "not worth a card at all" was half its charge. Drawing one of the three makes it card
*advantage*, which is a thing worth 2🔬 — and the two cards passed over keep their places on top of the
pile rather than shuffling back, so the information survives the draw and the play does two things.
Priced against Writing (2🔬, return a chosen card from the discard), the pair splits cleanly: Writing has
far wider selection, Calendar has the residual knowledge and no non-empty-discard precondition, so
neither is strictly worse and the later unlock is the stronger one.

⚠️ **The look-only `reveal` interaction now has no shipping consumer.** Calendar was its only one. The
kind, `Board.tsx`'s branch and `sim/actions.ts`'s single-answer enumeration all stay — a peek card is a
plausible thing to want again, and the machinery is tested — but nothing in the catalogue exercises it.

## Cards on trial

Cut from the starting collection and **not unlocked by anything, so currently unobtainable in-game**.
Deliberate: each is re-slotted onto a mission reward or cut outright when the pass reaches the mission
that would justify it. **Nothing merges to `main` with a card stranded** — this list must be empty.
Only Cave Art is left, and it is a decided cut waiting on the fixtures that still stock it.

| Card | Charge | Resolution |
|---|---|---|
| ~~Storytelling~~ | — | ✅ **left the list** — reworked to 1🔬/worker and granted by `harsh_winter` |
| Cave Art (2🎭 work) | makes the same 2🎭 as Beer for no 🌾, so it obsoletes a shipped card, and no reward slot is left to grant it from | ✅ **decided: cut.** Not yet deleted — six baselines still stock it (`first_temple`, `finding_copper`, `masonry`, `accounting`, `roads`, `pyramid`) and would fail to load; it goes with the last of them to be re-cut |
| ~~Burial~~ | — | ✅ **left the list** — renamed **Sun Stone**, re-rated to 4🔨 → 2🎭/worker, and granted by `reading_seasons` |
| ~~Calendar~~ | — | ✅ **left the list** — reworked to **2🔬 → look at the top 3 and draw one**, and granted by `reading_seasons` alongside Sun Stone. See *Science gets its sink* |

Bead Workshop and Bartering have **left this list** — both are reworked and granted by `raiders_at_border`;
see *Landed early* above.

## Consequences owed

- **Population is hard-capped at 4.** The best food rate in the game is now 1🌾/worker (Foraging *and*
  Farm), so all-hands-farming income (`pop`) crosses upkeep (`floor(pop²/4)`) at pop 4 — 4 vs 4,
  break-even; pop 5 is 5 vs 6, already negative with every worker farming and nothing else running.
  **Masonry's 6🧍 goal and the multi-worker wonders (Göbekli 3, Pyramid 4) are unreachable** until a
  stronger food source ships. Whichever mission unlocks that faucet is a *hard prerequisite* for them,
  not a balance nudge — decide it before reaching Masonry.
- **`plannerPolicy.integration.test.ts`'s Masonry win-rate case is `it.skip`ped** until this pass reaches
  Masonry. Two reasons at once, which is why it's parked rather than retuned:
  - Its hardcoded deck fields **bartering · bead_workshop · cave_art** — the first two at pre-rework rates,
    the third still homeless — so the fixture is stale whatever the numbers say.
  - Conquest's 2⚔️-doubling price pushed it from 4/6 to **3/6** against a `>= 4` threshold. Expected
    direction (Masonry converts ⚔️→🗺️→🧍 repeatedly, so a doubling territory card bites hardest exactly
    there), but it's a **one-seed** move on a 6-sample proxy, so it doesn't measure *how much* — that
    needs a wider planner sweep at Masonry's turn.

  The assertion is the **planner's capability claim** (the greedies win Masonry 0%), not a Masonry balance
  check — so it must come back rather than be relaxed. Masonry likely wants a territory route that doesn't
  escalate: Road, a wider board, or a cap on the curve. **Un-skip before merging to `main`.**
- ~~**`restless_people` is unwinnable as it stands**~~ — ✅ **closed**: the Harsh Winter rewrite retired the
  mission and deleted `unrest` outright. The rule the case established survives the card: a threat may
  only drain a resource the player is guaranteed to *produce* on every prereq chain reaching it, and a
  branch-local faucet doesn't count.
- **The Influence faucet ledger has moved.** The First Trades was given `rites_rituals`' 8⭐ deliberately,
  so the *swap* left `cumulativeInfluenceInto` unchanged downstream — but reinserting the node as a new
  mission adds its 10⭐ on top: arrival at `first_temple` is 40 → **50⭐** and at Masonry 52 → **62⭐**
  (`npm run economy`; `campaign.test.ts` pins the Masonry number). Shop tiers and sticker prices are
  tuned against those. Both that 10⭐ and Harsh Winter's payout are still open shifts.
- **`MIN_DECK_SIZE` may not need to exist.** At 10 it is starting to look like a rule with no job; see
  [`IDEAS.md`](IDEAS.md). Not this pass's call.

## Diagnosis (the original analysis)

Three separate-looking complaints (base work cards too strong · Dogs/Bow flattening later military ·
Bead Workshop too strong) are one root cause: **every converter doubles, and they compose.**

| Card | In | Out | Ratio |
|---|---|---|---|
| ~~Bead Workshop~~ | ~~1🔨~~ | ~~2🪙~~ | **converted to a building** (2🔨 once, then 1🪙 per staffed worker) |
| ~~Bartering~~ | ~~1🪙~~ | ~~2🌾~~ | **converted to a trade route** (1🪙 to open, then −1🪙/+1🌾 per round) |
| ~~Dogs~~ | 1🌾 | ~~2⚔️~~ **1⚔️** | **cut to ×1** |
| Raiding | 3⚔️ | 6🪙 | ×2 |
| Bow | 2🔨 | 3⚔️ | ×1.5, self-exiling |

Chained, Toolmaking → Bead Workshop → Bartering → Dogs turned **1🔨 into 8⚔️** (16⚔️ per worker-play
against War Horse's 4 — both a work box's single payout), and Bartering → Dogs → Raiding **closed a
cycle**: 1🪙 → 2🌾 → 4⚔️ → ~8🪙, ×8 per lap,
with `raiding` live today (granted by Horse Taming). The only brake is card plays — hand size 4, +1 per
culture level, no per-turn cap — so the engine *strengthens* as culture rises. Net effect: the five core
resources are one resource with five sprites, which is what erases deck identity.

**Bartering's conversion breaks both chains** — a route rents access instead of converting, so 🪙 no
longer has a one-shot exit into 🌾 at all, and Bead Workshop's rework removes 🔨's exit into 🪙. **Raiding
is the last converting edge left to cut.**

Second, **buildings never out-rate the free work card** of their resource, while also costing 🔨, a
territory slot, and a draw. So production's only sink is a card category nobody needs. The comparison is
**per worker-turn** — the one basis on which the two are commensurable, since a work box pays its printed
number once per play and hands the worker back, while a building pays it every round it holds one. Equal
printed numbers are therefore equal throughput *per worker*, and the building's edge is reliability
(never undrawn) plus deck-thinning, not rate. Cutting the base work rates to 1 has fixed three
pairs as a side effect (Farm now *matches* Foraging, Forge *doubles* Toolmaking, and Archives doubles
Storytelling once it drops to 1🔬 at Harsh Winter). The culture pair went the other way, by **replacing
the building rather than raising it**: Burial became **Sun Stone** at 4🔨 → 2🎭/worker — the Forge/Archives
shape, permanent output at the work card's rate — and Cave Art is cut, leaving Beer as culture's work
card.

⚠️ **War Horse / City Walls is off the list; its "owed raise" is withdrawn.** The old read — *War Horse
4⚔️ vs City Walls 1⚔️* — set 4⚔️ **per play** against 1⚔️ **per round forever**, and City Walls takes
**no workers**, so the per-worker-turn basis above doesn't apply to it at all. Amortized instead: one War
Horse in a ~23-card deck at hand 4 is drawn about every 6th turn ≈ **0.7⚔️/turn**, rising to ~0.9 as
buildings thin the deck — against City Walls' flat **1⚔️/turn**. The building already out-rates it. What
the pair actually owes is a **price** check, not a rate raise: over a 20-turn run City Walls buys ⚔️ at
~1.2🔨 each (4🔨 up front + 1🔨/round maintenance), where Bow buys it at 0.67🔨 — capped at 3⚔️ per copy,
since Bow self-exiles. The maintenance is the suspect number, and it needs a measurement before any move.

## Decided — money's topology: a one-way hub

Money's out-edges reach the other four; its in-edges are **producers only** (Trader, wonders,
buildings), never conversion. It's spent through **trade routes** — money rents standing access rather
than converting into stuff, which is a sink with no exchange rate to arbitrage. The **tin route carries
no bonus at all**: it purely gates bronze, so its cost is pure route-capacity opportunity cost.

- **The rule to hold, not just the card:** *a route may produce money, or non-money — but no card may
  convert that non-money output back into money.* Otherwise route + converter is a pump at any rate.
- **Bead Workshop** (was 🔨→🪙 as Jewelry) is cut or re-pointed — it was the exact inverse of the
  planned Bronzeworking (🪙→🔨) and would form a two-card loop at the centre of the age. ✅
  **Resolved:** re-pointed into a **building** (a worker makes money; the 2🔨 is a one-time build
  price, not a per-unit exchange), so the loop never forms.
- **Raiding** (⚔️→🪙) is cut, or charged in **culture** — never spent and gates hand size, so it can't be
  arbitraged back, and "raiders don't build civilizations" reads well. ⚠️ The culture option dies if
  culture leaves the age — cut it, or charge it in something else.
- ~~**Consequence to honour:** money leaves the optional tier for the Bronze Age.~~ **Superseded** by
  the restructure above — money enters at Stone col 3. The generalization survives the reversal and is
  worth keeping — **each age promotes one resource into the substrate** — but Stone now takes food +
  production + money, and what Bronze promotes is open (culture is the candidate).
- **Does the workshop+route pair scale?** ⬜ The open rate question, and **not any one mission's** — The
  First Trades measured a single pair (100% at every competent policy, 13–16 turn medians) but its deck
  holds one copy of each card, so no run there could build a second. The route out-rates the building
  that funds it, so pair *N* costs what pair 1 did with **territory the only brake** and no diminishing
  term. Needs a deliberately multi-copy deck on a slot-rich board: if two pairs simply double the food,
  the pair is the dominant food line everywhere rather than an alternative to one, and either the rent
  or the return has to curve. Money's Stone-Age faucet is the reworked Bead Workshop alone; Trader
  (3🪙/worker) and whatever Naval adds arrive in Bronze and change the arithmetic again.

## Remaining work

1. **Money topology** — the trade-route zone (shipped; Bartering converted as its first route) and
   Bead Workshop (re-pointed to a building) are done; **Raiding** is the last edge to cut. Unblocks the rest,
   because whether a military converter is fine depends entirely on whether ⚔️ is a sink or a way station.
2. **Buildings out-rate work cards** — restores production's identity and makes territory (so military)
   worth something. Mostly landed as a side effect of the base-rate cut, and the culture pair since
   resolved at `reading_seasons` (Sun Stone replaced Burial at the Forge/Archives shape, Cave Art cut).
   **War Horse/City Walls has left the list** — re-derived in *Diagnosis*: City Walls already out-rates
   it per turn and takes no workers. What's open there is its 1🔨/round maintenance, a price question
   needing a measurement, not a raise. A building's pitch is a *different kind of thing* (never drawn,
   scales per worker, eats a slot), so the lever may be draw/deck pressure rather than the Farm's number.
3. ~~**Superlinear food upkeep**~~ — ✅ landed as `floor(pop²/4)` at mission 1. What remains is the
   consequence: a stronger food faucet before Masonry (see *Consequences owed*).
4. *(optional, later)* Narrow production to buildings only — hold until (2) lands, or the resource has a
   single sink nobody wants. Give **science an expensive sink**: its identity (deck churn) is fine, but
   the two sinks that exist are both 2🔬 one-shots (Calendar, Writing), so the resource is never demanded
   in *quantity* — `finding_copper`'s 15🔬 across three veins is the only place it is, and that is a
   mission-seeded event rather than a card. Calendar's rehabilitation (see *Science gets its sink*) fixes
   the "no sink at all" hole, not this one.

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
