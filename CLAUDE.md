# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player** civilization-building card game that runs in the
browser. The player builds up a civilization solo — there is **no AI or human
opponent**. The run loop uses a lightweight custom engine (`src/run/engine.ts`) for
the turn/phase state machine; state is held in React context (`src/run/GameContext.tsx`).

Stack: TypeScript · Vite · React 18 · Vitest.

It is a **roguelite deckbuilder** with two loops: a **run loop** (the boardgame.io
card game — play a *locked* pre-built deck against a mission) and a **meta loop**
(persistent deck construction, shop, mission selection — the *only* place decks are
edited). See [`docs/DESIGN.md`](docs/DESIGN.md) for the full game design and roadmap.
**Phase 1** (the run loop, under `src/run/`) is done: hybrid cards (building vs.
action), the turn lifecycle, a **population/worker-staffing** layer (buildings must
be staffed to operate; the population eats food each round), and mission-driven
win/lose conditions. **Phase 2** (contract + meta shell) is done: `src/contract.ts`
defines `RunConfig`/`RunResult`; `src/app/App.tsx` switches between the meta menu
(`src/meta/MetaMenu.tsx` — a left-nav shell over the Mission/Collection/Decks/Stats
screens) and a run. `src/meta/store.ts` persists run history and the player's decks to
`localStorage`. Deck construction is built: `src/meta/DeckEditor.tsx` lets the player
build/edit any deck (`Decks.tsx`). **Phase 3** (economy & progression) is in progress:
`rules/collection.ts` (`OwnedCards`) tracks per-card ownership and `PlayerStore` now
carries `collection`/`influence`/`mapProgress` alongside `runHistory`/`decks`, seeded
from a deliberately narrow `content/collection.ts`'s `STARTING_COLLECTION` and a single
starting deck (`content/decks.ts`); `Collection.tsx` and `DeckEditor.tsx`'s picker now read
`collection` and omit any not-yet-unlocked card entirely (Phase 3 Step 2's visibility half —
an unlock is meant to be a surprise, so nothing hints at what's still out there, including a
total count). Step 2's other half, the deck-editor copy cap, is also done: `rules/deckBuilder.ts`'s
`addCard` rejects an add past the copies owned (`'unlimited'` never caps), and `DeckEditor.tsx`'s
picker dims/disables a tile once every owned copy is already in the deck rather than letting
the click/drag silently no-op. Its count badge shows *remaining* copies (owned minus however
many are already in this deck), not total owned — `CardFace`'s `alwaysShowBadge` prop lets
that badge surface even at ×1/×0, unlike every other `countBadge` use (deck banner, pile
viewer, `Collection.tsx`), which stay hidden at 1 since those show a stack count, not a
remaining-to-add count. A card owned only once never gets a picker badge at all. **Phase 3
Step 3** (mission model + campaign-map data) is also done: `content/missions.ts`'s
`MissionDef` gained `prereqs` (mission ids that must be completed first — empty = a DAG
root) and `kind: 'standard' | 'infinite'` (all three current missions are `'standard'`;
`'infinite'` is Step 6's). `rules/campaign.ts` (`isCompleted`/`isAvailable`/
`availableMissions`) is the prereq-gating logic, pure and unit-tested: a mission is
available once every one of its `prereqs` is in `mapProgress`, and — a deliberate choice,
pinned by a test — stays available once completed (replayable, not hidden again). The test
DAG reuses the existing three missions: The Long Winter is the root (`prereqs: []`); The
Enlightenment and Barbarian Tide both gate on it (`prereqs: ['long_winter']`).
The campaign map (`CampaignMap.tsx`, **Step 5.1** below) is the UI consumer of this gating.
`App.tsx`'s
`recordResult` marks `mapProgress[missionId] = true` on a victory outcome (both the normal
end-run path and restarting an already-finished run) — just the completion flag, so the
unlock chain is real and playable now. **Phase 3 Step 4** (reward computation) is also done:
each `MissionDef` carries a required `reward: { influence, unlockCardId }` (a mission always
grants exactly one unlock, per the design doc); `rules/rewards.ts`'s `computeRewards` is the
one pure function that turns a mission + "was it already completed" + the current collection
into an Influence/collection delta — a no-op on a replay (checked against `mapProgress` as it
stood *before* this run's result, never the post-update value, or every clear would look like
a first clear) and a no-op unlock if the card is somehow already owned. `App.tsx`'s
`recordResult` applies that delta to `store.influence`/`store.collection` right alongside the
`mapProgress` write; `Board.tsx`'s gameover overlay previews the identical payout off the same
function and the pre-run `mapProgress`/`collection` App hands down (a preview, not a second
source of truth), showing "+N ⭐ Influence · Unlocked X" on a first clear or "Already cleared —
no reward for a replay." otherwise. **Phase 3 Step 5.1** (campaign map screen) is
also done: `CampaignMap.tsx` replaces the old flat `MissionSelect` list with humanity's history
as a horizontally-scrollable branching tech tree (docs/DESIGN.md). Each `MissionDef` now carries
an authored `map: { col, row }` grid position (`content/missions.ts`); nodes are placed from it,
edges drawn from `prereqs`, and per-node state comes from `rules/campaign.ts` — `isCompleted` →
cleared (✓, replayable), `isAvailable` → available (▶), else locked. Locked nodes render as
**silhouettes** — position + lock glyph shown so the player can orient in history, but
name/objective/reward hidden and the node inert — a deliberate divergence from the "unlock is a
surprise" *hide-everything* precedent (the node's existence is shown, its identity isn't).
Ages (`content/ages.ts`) label the timeline as right-arrow bands across the top; only a single
"Testing" placeholder ships now (no age→column-range mapping yet). Clicking a cleared/available
node opens a launch popup (board picker left, deck picker right, nothing pre-selected, "Start
Mission" disabled until both chosen) that assembles the `RunConfig` and calls `onLaunch`; the
reward preview shows the Influence amount and that *a* card unlocks but not which (the specific
unlock is still revealed only on the gameover overlay). The deck picker reuses the Decks screen's
tile-fan + list-view display via `components/DeckDisplay.tsx` (`DeckTile`/`DeckListOverlay`,
extracted from `Decks.tsx` so both render identically) minus the edit/copy/delete buttons — in
the popup, clicking an unselected deck selects it, clicking the selected one opens its list-view.
**Phase 3 Step 5.2** (shop) is also done: `rules/shop.ts` is the one pure place the copy-tier
economy lives — a `TIER_LADDER` (×1→×2→×4→unlimited at 1/2/5 Influence; the numbers are
balance-tunable, the ladder a core rule like `MAX_DECKS`), `nextTier` (the next rung + cost, or
null for a maxed/not-owned/off-ladder count — one predicate that means "owned *and* still
upgradeable"), and `buyTier` (the immutable `{ influence, collection }` purchase, returning null
for an unaffordable/maxed/not-owned card, mirroring `computeRewards`). `Shop.tsx` (the new
`🛒 Shop` nav tab) lists only upgradeable owned cards (the `nextTier !== null` filter hides both
the ∞ basics and anything not unlocked), grouped like `Collection.tsx`, each tile a `CardFace`
(current tier badge) over a one-click buy button (`⭐cost → ×N`, disabled when unaffordable — no
confirm step, since a purchase only ever *adds* copies). The `⭐ <count>` balance itself lives
on the `Shop` nav button (`MetaMenu.tsx`) rather than as a separate standalone pill, since Shop
is the only place Influence is spent. `App.tsx`'s `buyCardTier` is the write
path: it runs `buyTier` and `persist`s the reduced Influence + bumped collection, so that badge
and the shop list update live (a card bought to unlimited drops out). **Phase 3 Step 5.3**
(mission detail panel) is also done: `MissionDef` gained a `lore` field — narrative flavour
text, kept distinct from the existing `description` (which states the mechanical objective) —
authored for all three missions. Clicking a cleared/available map node now opens
`MissionDetailPanel` first, a same-size modal inserted before the existing board/deck picker:
a left column of lore + description + victory/failure hints, and a right column with the
reward — an Influence line (struck through once already cleared) under a subtitle reading
"1 new card" or, post-clear, "Cards already unlocked" — showing either `CardFace`'s grey
face-down `faceDown` mode (pre-clear, since which card a mission unlocks stays a surprise
until it's actually cleared) or the real unlocked card via `CardFace` (post-clear) beneath it. Its
"Continue" hands off to `LaunchPopup` (the board/deck picker, unchanged apart from dropping
the lore/reward text its header used to carry, now that Step 5.3 owns that). **Phase 3 Step 6.2**
(infinite-mission plumbing) is also done: `MissionDef`'s `reward` and `map` are now optional
(`'infinite'` missions have neither — no dedicated `RunResult.score` field turned out to be
needed; `rules/rewards.ts`'s `computeRewards` scores an infinite attempt straight off
`RunResult.stats.turnsTaken`, Influence = rounds survived, paid on *every* attempt regardless of
outcome, no unlock). The store-fold that used to live inline in `App.tsx`'s `recordResult` is now
`meta/store.ts`'s `applyRunResult(store, result, mission)` — a pure, unit-tested function: a
`'standard'` mission still marks `mapProgress` and pays its reward only on a victory outcome;
an `'infinite'` mission never touches `mapProgress` and pays win or lose.
`CampaignMap.tsx` splits missions by `kind`: `'infinite'` ones are filtered out of the DAG/
timeline entirely and into a new always-visible bottom banner (never `position: fixed`, matching
the map's existing viewport-fixed workaround) instead of a node, since they have no map position
and are never locked/cleared. `Board.tsx`'s gameover overlay and `MissionDetailPanel` both guard
the now-optional `mission.reward` and show an infinite-specific reward line ("Influence = rounds
survived") instead of a card face. **Phase 3 Step 6.3a** (threat zone, pure core) is also done:
`GameState` gained `threats: ThreatInstance[]` — `ThreatInstance` is just a `CardInstance`
(mission-seeded only via `rules/threats.ts`'s `addThreat`, bare `{ id, cardId }`; empty on every
run that doesn't use one). Its escalation is **the card's own responsibility, not the engine's**:
`tickThreats` doesn't read or scale any card data itself — it only calls `resolveCard({ G, self:
t })` per threat each upkeep, the exact same resolver spine every other card resolves through. A
threat card computes and applies its own drain and bumps its own counter inside its `resolve`
closure, mirroring Cornucopia's per-play growth (Step 6.1), just tick-triggered instead of
play-triggered — so a future Creeping Decay never touches the declarative `effect` bag at all,
same as Cornucopia doesn't. `tickThreats` is called unconditionally from `upkeep.ts`'s
`applyUpkeep` (a no-op when `threats` is empty), so it flows into `projectedDelta`'s UI preview
for free — no UI of its own, and no real threat-seeding mission exists yet. **Phase 3 Step 6.3b**
(threat UI + Long Winter's food drain as a real threat card) is also done: `G.threats` now renders
on the board as real `CardFace`s down `Board.tsx`'s `ThreatZone` — a real, in-flow **left column**
of `.gamearea` (`.threatColumn`), not a floating overlay: an earlier pass tried stacking it under
the fixed-position `MissionWidget` in the top-left corner, but a floating widget doesn't reserve
layout space, so once it grew past one card tall it crept in front of (rather than beside) the
slot grid's first row. `.gamearea` is now a row — `.threatColumn` (fixed-width, its own
`overflow-y: auto`) beside a new `.gameContent` wrapping the slot grid + work strip (a plain
`flex: 1`) — so the tableau reflows beside the threat column instead of ever sitting under it;
`MissionWidget` reverts to its own standalone `position: fixed` corner widget, untouched by any of
this. `ThreatZone` reads only `GameState` (`G.threats`, `CARDS`) and never the mission — so it
renders identically no matter which mission seeded them, same discipline as `MissionWidget` reading
`G`. Each threat reuses the run's existing
dynamic-card machinery rather than any bespoke "threat badge": `card.dynamicText?.(G, self)` — the
same hook Cornucopia's growing gain already threads through every render site — supplies a growing
threat's live current drain, falling back to the card's static `description` for a flat one; clicking
opens the same shared `CardZoomOverlay`. A threat card is a new `CardKind`, `'threat'` — not a reuse
of `'event'` — because `CardFace`'s `describeConditions` hard-codes event-only text ("resolves at end
of round") that would be wrong for a persistent, tick-every-upkeep hazard; `'threat'` reuses `'event'`'s
already-CVD-vetted red identity for its border/bands (`kindClass`), distinguished only by its own
banner label ("Threat" vs "Event"), and is excluded everywhere `'event'` already is (`Collection.tsx`/
`DeckEditor.tsx`/`Shop.tsx`'s picker filters, `deckBuilder.addCard`'s reject-on-add) since it's equally
never player-owned or player-editable. The Long Winter mission's `onUpkeep` hand-drain of 2 Food is
now gone entirely, replaced by a real card, **Harsh Winter** (`content/cards.ts`) — a flat,
non-escalating `effect.loss: { food: 2 }` needing no bespoke `resolve` — seeded once via `addThreat`
in the mission's (now-added) `setup`. **Phase 3 Step 6.3c** (Creeping Decay infinite mission) is
also done — the first *escalating* threat and the first *real* infinite mission: **Creeping Decay**
(`content/cards.ts`, `kind: 'threat'`) owns its drain via a bespoke `resolve` — reads its own
`getCounter(self, 'level')`, scales a base −1🔨 by `level + 1` via `scaleResources`, applies it with
`subtractResources`, then bumps its own counter — mirroring Cornucopia's per-play growth resolver
(Step 6.1), just tick-triggered instead of play-triggered. **The Long Decline** (`content/missions.ts`,
`kind: 'infinite'`) seeds it once via `addThreat` in `setup`; its `objective`/`failure` are both
`() => false` (an `'infinite'` mission never wins or fails on its own), so the escalating drain
forcing Production negative and tripping the universal `coreCollapse` → `'ruin'` (`run/engine.ts`)
is its only ending — at which point `computeRewards`'s existing infinite branch pays Influence =
rounds survived. No gameover-overlay, campaign-map, or reward-plumbing changes were needed: the
generic `'infinite'`-kind handling already built in Step 6.2 rendered and scored a real infinite
mission with zero further changes. **Phase 3 Step 7.1** (bounded copy tiers) is also done — the
first substep of the Step 7 card-stickers rework: `rules/collection.ts`'s `OwnedCards` is now a
plain `Record<string, number>` — the `'unlimited'` tier is gone, so every owned count is bounded
(instantiable), the precondition Step 7.2's uniform meta card instances needs. `rules/shop.ts`'s
`TIER_LADDER` now ends at ×8 (dropping the terminal `'unlimited'` rung) and `nextTier`/`buyTier`
lost their `'unlimited'` special-casing; `rules/deckBuilder.ts`'s `addCard` lost its
`'unlimited'`-never-caps branch, since the owned count is now always a plain number to compare
against. `CardFace`'s `countBadge` prop dropped its `'unlimited'`/"∞" arm (`Shop.tsx`'s
tier-upgrade label too — just `×N` now). `content/collection.ts`'s `STARTING_COLLECTION` reseeded
the three basics that were `'unlimited'` (settlers/corvee/harvest) to `2` each, matching every
other starting card's "just enough for the starting deck" count. **Phase 3 Step 7.2**
(uniform meta card instances) is also done — the identity substrate the rest of Step 7 rests
on: `rules/collection.ts`'s `OwnedCards` is now `{ instances: MetaCardInstance[], nextId }`
(`MetaCardInstance` just `{ id, cardId }` — no sticker field yet, that's Step 7.5) instead of a
per-cardId count, with `nextId` a persistent, append-only allocator (`grantCopies`'s writer) —
distinct from the run's `population.ts`'s `nextInstanceId`, which scans run zones instead of
counting up; granting copies only ever appends, never renumbers, so a `DeckDef`'s instance-id
references never go stale. `copiesOwned`/`isOwned` are now derived by filtering instances.
`DeckDef.cards` (`content/decks.ts`) changed meaning from cardIds to meta instance ids — the
point being that two decks referencing the same instance see a future sticker on it for free
(single source of truth), rather than each deck holding an independent copy of "farm."
`rules/deckBuilder.ts`'s `addCard`/`removeCard` pick *any* owned/in-deck instance of a cardId
(copies are still fungible; Step 7.4 will pick a stable order once stickers make an instance
worth distinguishing from another), and `groupCounts`/`resolveDeckCards` now take the
collection to resolve instance ids back to cardIds — for the ×N display and for translating a
launched deck into the run's cardId deck, respectively. Content authoring stays in cardIds,
since instance identity doesn't exist until a collection is actually seeded:
`content/decks.ts`'s `DEFAULT_DECKS` is now `DeckSeed[]` (plain cardId lists) and
`content/collection.ts`'s `STARTING_COLLECTION` is a plain `Record<cardId, count>`;
`deckBuilder.ts`'s new `buildSeedDecks` resolves a `DeckSeed[]` into real `DeckDef[]` against a
freshly-granted collection — the one function `meta/store.ts`'s `emptyStore` (and its
`parsePlayerStore` decks-fallback) goes through, replacing the old `cloneDecks` (now gone —
`buildSeedDecks` already returns fresh objects, so nothing needed a separate deep-copy step).
`contract.ts`'s `buildRunConfig` gained a required `collection` param to do that same
instance→cardId translation; every meta screen that displays or launches a deck
(`App.tsx`/`MetaMenu.tsx`/`CampaignMap.tsx`/`Decks.tsx`/`DeckDisplay.tsx`) threads `collection`
down to it. `parsePlayerStore` also gained a shape check on `collection.instances`/`nextId`
(not just "is an object") so a pre-Step-7.2 save resets to a fresh store instead of crashing
deep inside `copiesOwned`. **Phase 3 Step 7.3** (Collection per-instance view) is also done —
the anti-surprise mechanism a future sticker (Step 7.5) needs: clicking an owned card tile in
`Collection.tsx` now opens `meta/CardInstancePanel.tsx` instead of jumping straight to the card
zoom — a row per owned instance ("Farm 1/2", "Farm 2/2"), each naming the deck(s) it currently
sits in or "unused", via the new `rules/deckBuilder.ts`'s `decksContaining(instanceId, decks)`
(filters decks whose `cards` includes that instance id). Clicking a row still opens the shared
`CardZoomOverlay` — every instance renders identically today, since there's no sticker field
yet. `Collection.tsx` gained a `decks` prop (threaded from `MetaMenu.tsx`, which already held
it) purely to resolve that usage text. **Phase 3 Step 7.4** (ordered deck assignment) is also
done: `rules/deckBuilder.ts`'s `addCard`/`removeCard` now assign still-fungible copies by a
deterministic, low-churn order — `addCard` already picked the lowest-index free instance (via
`instancesOf`'s granted-order iteration, unchanged); `removeCard` now mirrors it, popping the
*highest*-index in-deck instance rather than whichever occurrence `deck.findIndex` hit first by
array position. So a deck's copies of an identical card stay a stable, low-index-first prefix of
the owned instances as the deck is edited — add, remove, add again returns the same instance
rather than drifting to a different one — which is what keeps Step 7.3's per-instance picker
("Farm 1/2") meaningful across edits, and what Step 7.5's sticker pick will need once a
distinguished instance has to be placed *by identity* instead of by this default order.
**Phase 3 Step 7.5** (card stickers in the meta, not yet in the run) is also done —
this step's payoff for the whole uniform-instance rework: `content/stickers.ts`'s `STICKERS`
is a small, deliberately inert catalogue (`Reinforced`, `Efficient` — name/description/cost;
nothing reads them yet, Step 7.6 wires an effect in — and Step 7.8 later adds `appliesTo`/
`applyGain`/`applyCost` behavior hooks, see below). `rules/collection.ts`'s
`MetaCardInstance` gained an optional `stickers?: string[]`, capped at one sticker per
instance (a v1 choice, easily relaxed later) — `hasSticker`/`unstickeredInstancesOf` are the
two predicates everything else is built from. `rules/stickers.ts`'s `buySticker` is the one
pure purchase (mirrors `shop.ts`'s `buyTier`): spends Influence, mutates one chosen instance
in place, immutable otherwise; `App.tsx`'s `attachSticker` is its write path. A stickered
instance stops being fungible, so `rules/deckBuilder.ts`'s `addCard`/`removeCard` (the default
LIFO order) now draw only from `unstickeredInstancesOf` — a stickered instance is never
auto-picked — and two new functions, `addInstance`/`removeInstance`, add/remove one *by
identity* instead. `groupCounts` reflects the same split: a stickered instance breaks out of
its cardId's ×N stack into its own `{ cardId, count: 1, instanceId, stickers }` entry (appended
after the fungible groups) rather than being folded in — `DeckEditor.tsx`'s picker mirrors this
at the source, rendering a card's normal fungible tile (only if at least one unstickered copy
remains) *plus* one addressable tile per owned, not-yet-in-deck stickered instance, each
draggable/clickable into the deck banner by its own identity via `addInstance`/`removeInstance`
rather than the fungible `addCard`/`removeCard` path. `CardFace` gained a `stickerBadge`
prop — a bare 🏷️ glyph in the opposite corner from the existing ×N badge, no new color token
— so a stickered tile is visually distinguishable everywhere `groupCounts` output is rendered
(`DeckEditor`, `components/DeckDisplay.tsx`'s deck tile/list-view). The purchase flow reuses
Step 7.3's `CardInstancePanel` rather than inventing a second per-instance picker: a new
optional `attach` prop switches it from plain browse-and-zoom into a picker mode where every
row shows the sticker's name/effect already attached (if any) and an "Attach ⭐cost" button
(disabled once-stickered or unaffordable) instead of opening the zoom — `Shop.tsx` opens it
when the player clicks one of a card's small "🏷️ ⭐cost → StickerName" buttons, alongside its
existing copy-tier upgrade button; a card now stays listed in the shop if it has *either* a
tier left to buy or an unstickered instance a sticker could still land on. **Phase 3 Step 7.6**
(card stickers in the run loop) is also done: `rules/state.ts`'s `CardInstance` gained an
optional `stickers?: string[]`, copied once at mint from the owning meta instance and never
written to during a run. `rules/deckBuilder.ts`'s `resolveDeckCards` now returns `DeckCard[]`
(`{ cardId, stickers? }`, each `stickers` array copied rather than aliased out of the
collection) instead of a bare cardId `string[]`; `contract.ts`'s `RunConfig.deck` is `DeckCard[]`
accordingly, and `run/setup.ts`'s `instancesFromDeckCards` (`state.ts`, mirroring the existing
`instancesFromCardIds`) mints each entry's stickers onto its run instance. `rules/stickers.ts` is
now also the run-side home for *applying* a sticker's effect — `effectiveGain` (Reinforced's
"+1 to this copy's output": bumps every resource key a gain/produce bundle already has by 1) and
`effectiveCost` (Efficient's "-1 to play," floored at 0 per resource) are the *only* places a
sticker's effect touches run values, so resolution and display never diverge. (Step 7.8 later
moved the *interpretation* itself — what each sticker actually does — onto per-sticker
`applyGain`/`applyCost` hooks on the `StickerDef`; these two functions became a generic fold that
dispatches to them. See Step 7.8 below.)
`rules/effects.ts`'s declarative default resolvers (`defaultProduce`/`specToResolver`) compose
`effectiveGain` in; the two cost sites — `rules/playability.ts`'s `unplayableReason` (which now
takes a `self: CardInstance` param instead of just the static `CardDef`) and `run/moves.ts`'s
`playCard` — compose `effectiveCost` in. A card's own bespoke `resolve`/`produce` (Cornucopia,
a threat) is *not* composed through either function — a deliberate v1 gap, kept consistent since
such a card's `dynamicText` display doesn't reflect a sticker either, so resolution and display
still agree. `rules/population.ts`'s `addBuilding`/`addWork` gained an optional `stickers` param:
without it, a stickered building/work card would silently lose its bonus the instant it left
hand for the tableau/workZone, since a fresh instance used to be minted from just `cardId`.
`rules/stickers.ts`'s `effectiveCard(card, self)` is the display-side counterpart: a shallow
`CardDef` copy with `cost`/`produces`/`effect.gain` swapped for their effective values, so every
`Board.tsx` render site that already did `card={CARDS[cardId]}` swaps in
`effectiveCard(CARDS[cardId], self)` instead, with zero `CardFace` changes — hand, the tableau's
`BuildingBox`/`WorkBox`, the drag clone, play/discard ghosts, the pile viewer, the zoom overlay
(`CardZoomOverlay` gained an `overrideCard` prop for this), and Foresight's interaction options.
`groupCards` (the run's own pile-viewer grouping, distinct from `deckBuilder.ts`'s `groupCounts`)
now also singles out a stickered instance rather than folding it into a ×N stack, mirroring its
existing `dynamicText` exception (a stickered copy's numbers, like a dynamic card's, can diverge
from its siblings). **Phase 3 Step 7.7** (raise the sticker cap to 2 per instance) is also done:
`rules/collection.ts` splits what a cap of 1 let stay conflated into two separate predicates —
`hasSticker` (unchanged, `>= 1`) still drives fungible-pool exclusion and display grouping
(`deckBuilder.ts`'s `addCard`/`removeCard`/`groupCounts`, `DeckEditor.tsx`'s picker split into a
generic fungible tile plus one addressable tile per stickered instance) — a once-stickered
instance is still non-fungible and still gets its own tile/badge exactly as before Step 7.7 — while
the new `isStickerFull`/`MAX_STICKERS` (`= 2`) asks the narrower "can this instance take *another*
sticker" question, used only by the attach flow. `rules/stickers.ts`'s `buySticker` now appends to
`stickers` rather than replacing, rejecting only once already full. Attaching the *same* sticker
id twice is allowed **on purpose**: two Reinforced on one copy stacks to +2, not a no-op —
`effectiveGain`/`effectiveCost` moved from a presence check (`Array.includes`) to counting
*occurrences* so a duplicate compounds instead of doing nothing while still spending the Influence
(Step 7.8 later generalized this to a fold over `self.stickers`, so occurrence-counting fell out
for free). `CardInstancePanel`'s attach button/title only guards the full case now (no
duplicate-reject). `Shop.tsx`'s "does this card still have a sticker slot" check moved to a new
`stickerableInstancesOf` (room for another — not full) rather than the stricter
`unstickeredInstancesOf` (no sticker at all), which would have hidden a card's second-sticker slot
the moment every owned copy already had one. No run-loop changes were needed: `effectiveGain`/
`effectiveCost` already iterate by sticker id and now by count, so both stacking (same sticker
twice) and composing (two different stickers) fall out of the same code path (tested). **Phase 3
Step 7.8** (Irrigation, and a self-contained sticker model) is also done — the first sticker whose
eligibility depends on the *card*, not just the copy: **Irrigation** attaches only to a
food-producing building (`c.kind === 'building' && (c.produces?.food ?? 0) > 0`) and bumps only
that food output. Rather than hard-code that check at the shop's selection site — which would
scatter sticker rules the way over-specific card logic scattered before the resolver rewrite — a
sticker now **owns its own logic** on its `StickerDef` (`content/stickers.ts`): an optional
`appliesTo(card)` predicate (absent = any card, like Reinforced/Efficient) plus `applyGain`/
`applyCost` effect hooks, each applied once per attached copy. `rules/stickers.ts` became a generic
dispatcher holding *no* sticker-specific knowledge: `stickerAppliesTo(sticker, card)` routes every
eligibility question (`Shop.tsx`'s listing/offer filters, and `buySticker`'s *authoritative*
reject — the shop UI only mirrors it), and `effectiveGain`/`effectiveCost` are now a plain fold
over `self.stickers` applying each attached copy's own hook (`?? out` skips a sticker lacking that
hook and preserves the running value), so stacking/composing still fall out for free and their
`(base, self)` signatures — hence the entire run-loop wiring (`effects.ts`/`playability.ts`/
`moves.ts`/`effectiveCard`/`Board.tsx`) — stayed untouched. Reinforced/Efficient migrated onto the
hooks with no behavior change; `stickerCount` is gone, subsumed by the fold. `Shop.tsx` lists and
offers only the stickers whose `appliesTo` matches a card (Irrigation hidden on non-food buildings
and non-buildings). The two hooks cover per-copy output + play-cost only — a future sticker
touching `workers`/`cultureOutput`/`draw` needs a new hook here plus one compose site in
`effectiveCard`, the named extensibility seam. The v1 gap is unchanged: a sticker augments only the
*declarative* producer, never a card's bespoke `produce()` (all current food buildings are
declarative, so Irrigation works today). **Phase 3 Step 7.9's first item** (distinct sticker
icons) is also done: `StickerDef` gained an `icon` glyph (💪 Reinforced, ⚡ Efficient, 💧
Irrigation); `CardFace`'s `stickerBadge` prop changed from a bare boolean to the attached sticker
id(s) themselves, rendering each one's own icon via a `STICKERS` lookup instead of one hardcoded
🏷️ regardless of which sticker is actually attached — a duplicate id (a stacked sticker, Step 7.7)
renders its icon twice rather than deduplicating, so the badge itself hints at the stack; the
badge's CSS moved from a fixed `width` to `min-width` + padding so it widens for a second icon
instead of clipping. Every render site already had (or was one hop from) the real id(s) —
`deckBuilder.ts`'s `groupCounts` already carried `stickers` per entry, so `DeckDisplay.tsx`/
`DeckEditor.tsx`'s banner and picker tiles pass it straight through; `DeckEditor.tsx`'s drag clone
needed a new `stickers` field on its `DragState`, captured at pointer-down alongside `instanceId`.
`Shop.tsx`'s per-sticker "Attach" button also swapped its generic 🏷️ for `s.icon`, the same bug in
miniature (one glyph standing in for every sticker's offer button). **Step 7.9's second item**
(bottom-left badge placement) is also done: the sticker marker moved from a single top-left pill
(concatenated icons in one badge) to a bottom-left row (`CardFace.module.css`'s `stickerRow`/
`sticker`) of individual circles, one per attached sticker id — straddling the bottom edge the way
`countBadge` straddles its own corner, card-toned (`--card-face-top` + a thin border) rather than
the accent `--badge-bg`, so it reads as "part of the card" rather than a count/notification marker;
a stacked sticker (a duplicate id) now renders as two circles side by side instead of a doubled
glyph crowded into one badge, and each circle carries its sticker's name as a hover title.
**Step 7.9's third item** (meta screens show effective values too) is also done: every meta-side
`CardFace` for a stickered instance now shows *both* pieces of information together, not one
replacing the other — the bottom-left badge (which sticker) alongside the card's own displayed
cost/output text now reflecting what that sticker actually does (via `rules/stickers.ts`'s
`effectiveCard`, the same function the run loop already used), rather than the plain catalogue
numbers a badge alone would leave ambiguous next to. `effectiveGain`/`effectiveCost`/
`effectiveCard`'s `self` parameter was narrowed from the run's `CardInstance` to a new minimal
`StickeredInstance` (`{ stickers?: string[] }`) so the same three functions serve a meta
`MetaCardInstance` and a deck-editor `DeckGroupEntry` too, not just a run instance — all three
already only ever read `self.stickers`. `DeckEditor.tsx`'s picker/banner/drag-clone tiles and
`DeckDisplay.tsx`'s deck-tile fan/list-view tiles (Step 7.9's second item wired their
`stickerBadge` but left their `card` prop as the raw catalogue entry) now pass
`effectiveCard(...)` through as well; `CardZoomOverlay` gained the same `stickerBadge` pass-through
prop `overrideCard` already had, and `CardInstancePanel`'s zoom (`Collection`'s and `Shop`'s
shared per-copy drill-down) now tracks *which* instance was clicked (not just an open/closed
boolean) so its zoom can resolve that instance's `effectiveCard`/stickers too. **Step 7.9's fourth
item** (loop cards stay visibly stickered) is also done, completing Step 7.9: `Board.tsx`'s every
`CardFace` render site (hand, the play/ghost clone, the drag clone, the pile viewer, an
interactive-effect's revealed options, the threat column, and the zoom overlay) now passes
`stickerBadge` through alongside the `effectiveCard` numbers Step 7.6 already wired, mirroring the
meta screens' Step 7.9 (item 3) treatment. `BuildingBox`/`WorkBox` (the tableau/work-strip boxes)
don't render a `CardFace` at all — they're bespoke markup — so they needed their own badge: a new
`StickerRow` component (`CardFace.tsx`) is the one place the bottom-left badge row is drawn;
`CardFace` itself renders it for its own `stickerBadge` prop, and `BuildingBox`/`WorkBox` import
the component directly rather than reaching into `CardFace.module.css`'s classes from `Board.tsx`,
keeping the row's visual definition in one place. `.buildingBox` gained `position: relative` so the
badge (which straddles the box's bottom-left corner, same as a `CardFace`) has something to anchor
to. Still to come: tutorial missions (Step 9), and `Stats` surfacing a per-run reward (deferred
since `RunResult` deliberately excludes rewards, and there's no per-run record of whether that run
was a first clear).

## Commands

- `npm run dev` — Vite dev server.
- `npm run build` — type-check (`tsc --noEmit`) then produce a production bundle.
- `npm run typecheck` — type-check only (no emit).
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — Vitest in watch mode.
- Single test file: `npx vitest run src/rules/scoring.test.ts`
- Tests matching a name: `npx vitest run -t "victory points"`

## Architecture

The codebase is split into a **pure core** and a thin **React shell**. The one rule
that matters: the shell depends on the core; **the core never imports the shell.**
Keeping that boundary is what keeps game logic unit-testable without spinning up a client.

**Core (framework-free — no boardgame.io, no React, no I/O):**

- `src/rules/` — all real game logic *and* the core state type. `state.ts` defines
  `GameState` (boardgame.io's `G` — the serializable run state, including `population`,
  each tableau building's assigned `workers`, the `territory` cap on tableau size, the
  transient `workZone` of played `work` cards awaiting staffing, `threats` (persistent
  board hazards — `ThreatInstance[]`, each just a `CardInstance`; mission-seeded only, see
  `threats.ts` below), the
  card zones `deck`/`hand`/`discard`/`removed` — each a `CardInstance[]` (`{ id, cardId, counters? }`),
  so every card in a pile has a stable per-run **instance id** and can carry its own per-copy state as
  it cycles hand→discard→deck→hand (`PlacedCard` extends `CardInstance` with `workers`; `id`s are
  unique across *all* zones via `population.ts`'s `nextInstanceId`, which now scans every zone). A
  card's per-instance run counters live in that instance's own `counters` map (e.g. Cornucopia's play
  count), effect-layer-owned via `getCounter`/`bumpCounter` — *not* a bespoke field and *not* a central
  `GameState` bag; cards own their own numbers, so playing one copy never touches another's. Bulk
  minting a `string[]` into instances (setup, a mission's injected cards, tests) goes through
  `instancesFromCardIds`. Plus `pendingInteraction` (a `PendingInteraction | null`: a card effect
  suspended awaiting a player choice, e.g. Foresight's peek; while set, `endTurn` no-ops and undo is
  blocked until it's answered) — plus `blankState()`; it lives here, not in the shell, because the
  mission evaluators reason over it. Also `resources.ts` (`Resources` + arithmetic), `deck.ts`
  (draw/reshuffle), `effects.ts` (card effects — the declarative `CardEffect` bag
  gain/loss/draw/population/`territory`/`culture`/`destroy`, applied by `applyEffect`; plus the
  **resolver spine** `resolveCard(ctx)` — the single path "the card's effect" runs through, shared
  by `moves.ts`'s `playCard` and `upkeep.ts`'s `resolveHandEvents` — which picks a card's own
  `CardDef.resolve` if it has one, else the declarative default from `specToResolver(effect)`. The
  resolver receives an `EffectContext` (`{ G, self: CardInstance, target?, answer? }`) so an effect
  can know *which exact copy* is resolving (reading/writing `self.counters`) and *what* it targets; a
  Destroy card's demolition is now a resolver behavior via `ctx.target`, not a special branch in
  `playCard`. A **second, narrower spine**, `resolveProduction(ctx)`, is production's counterpart —
  picks `CardDef.produce` if a card defines one, else a declarative default built from `produces`/
  `cultureOutput`/`effect.gain`. It's deliberately not `resolveCard` reused: that default also applies
  one-shot play fields (`draw`/`population`/`territory`/`destroy`), which must never fire on a
  recurring per-round tick, so production gets its own default resolver rather than overloading the
  play one. An **interactive**
  effect (Foresight) suspends mid-resolution: its resolver reveals options, parks them in
  `G.pendingInteraction`, and returns (`ctx.answer === undefined`); `moves.ts`'s `resolveInteraction`
  re-enters the same resolver with the chosen index (`ctx.answer`) to finish it — a two-branch
  re-entrant resolver, all plain data so undo/clone survive),
  `population.ts` (worker staffing over both buildings and work cards via the `Staffable`
  layer — `requiredWorkersOf` / `isOperating` / `freePopulation` /
  `findStaffable`, `addBuilding`/`addWork` with a shared `nextInstanceId` allocator (also
  scanning `G.threats`, which shares this same instance-id space) — plus
  `foodUpkeep`), `threats.ts` (persistent board hazards, mission-`setup`-only —
  `addThreat` seeds one bare, no counters yet; `tickThreats` does **not** read or scale any
  card data itself, deliberately: it just calls `resolveCard({ G, self: t })` per threat, the
  same resolver spine every other card resolves through, so a threat card computes and applies
  its own drain and bumps its own escalation counter inside its `resolve` — the engine only asks
  it to resolve, it never resolves on the card's behalf), `upkeep.ts` (`applyUpkeep`: staffed
  buildings and work resolve their own production → threats tick (each resolving itself) → mission
  ticks → population eats food; plus `discardWorkZone` (end-of-turn work filing) and
  `projectedDelta` for the UI), `production.ts` (`applyTableauProduction`/`applyWorkZoneProduction` —
  each calls `resolveProduction` per *operating* (staffed) instance in the tableau/workZone, same
  as `tickThreats` does for threats; `applyUpkeep` never reads a building's `produces`/`cultureOutput`
  or a work card's `effect.gain` itself, it only asks each instance to produce), `tableau.ts`
  (derived stats — including `usedTerritory` / `freeTerritory`,
  the territory cap that gates how many buildings can occupy the tableau), and
  `deckBuilder.ts` (deck *construction* — a `DeckDef.cards` entry is a meta instance id
  (Phase 3 Step 7.2), not a cardId, so `addCard`/`removeCard` resolve through the player's
  `OwnedCards` to pick/match an instance, returning `'invalid'` on an unresolvable cardId or a
  capped/absent one, mirroring `moves.ts`'s `'invalid'` signal; `groupCounts`/`resolveDeckCards`
  likewise take the collection to translate instance ids back to cardIds (for the ×N display
  and for the run boundary, respectively); `buildSeedDecks` turns content-authored `DeckSeed`s
  (cardIds) into real `DeckDef`s (instance ids) against a freshly-granted collection — the one
  path `meta/store.ts` seeds a fresh store's decks through; and `MAX_DECKS` — the committed
  cap on how many decks a player may own (the number is balance-tunable, the limit itself is
  a core rule), enforced at the deck writer in `App.tsx`'s `saveDeck` with `Decks.tsx`'s
  disabled "+ New Deck" button as its UI reflection — distinct from `deck.ts`,
  which owns the *in-run* draw pile, not deck editing), `collection.ts` (`OwnedCards` —
  `{ instances: MetaCardInstance[], nextId }`, Phase 3 Step 7.2's uniform meta card instances;
  each `MetaCardInstance` is just `{ id, cardId }` (no sticker field yet — Step 7.5), and
  `nextId` is a persistent, append-only allocator distinct from the run's `population.ts`'s
  `nextInstanceId` — granting copies only ever appends via `grantCopies`, never renumbers, so a
  `DeckDef`'s instance-id references never go stale. `copiesOwned`/`isOwned` are derived by
  filtering instances (an absent cardId meaning not yet unlocked); `rules/rewards.ts` (mission
  unlock) and `rules/shop.ts` (shop purchase) are `grantCopies`'s callers), and `shop.ts` (the
  copy-tier economy — `TIER_LADDER`, `nextTier`, and the immutable `buyTier` purchase, which
  grants the newly-bought copies as fresh instances; see Phase 3 Step 5.2 above).
  Unit tests sit alongside. **When adding
  a rule, put the logic here and test it directly — never bury it in a move or a
  component.**
- `src/content/` — typed game data, separate from logic. **A building card *is* the building**
  (there's no separate building catalogue): `cards.ts` (`CARDS`, each `building`, `action`,
  `work`, or `event`) is the single card catalogue, and a `building` card carries its own
  building stats (`produces`/`cultureOutput`/`workers`/`tags`) right on the `CardDef`. Playing a
  `building` card places it in the `tableau` (one territory slot, auto-staffed) as a
  `BuildingInstance` that references the card by `cardId`; the card is **not** filed to a pile —
  it lives on as that tableau instance, filed nowhere, for as long as it stays in play.
  `discard` is where a card lands by default once it's done being useful; a demolished
  building's card going to `removed` instead (`moves.ts`'s `playCard` destroy branch) isn't
  an inherent trait of the `building` kind — it's a property of whatever effect took it out
  of the tableau, and today the only such effect is the Destroy action card's
  `effect.destroy`. A future card could just as well reclaim territory by *discarding* a
  building instead of destroying it, filing that card to `discard` like anything else.
  An `event` resolving to `removed` (rather than `discard`) is the same story as building
  demolition — a property of its own `effect.remove` flag (see `rules/effects.ts`'s
  `CardEffect`), not an inherent trait of the `event` kind either. An `action` card resolves
  its `effect` and files to `discard`.
  A `work` card is **labour**: playing it costs no idle population and sticks it onto the board
  as a *staffable* `WorkInstance` in `GameState.workZone` (`rules/population.ts`'s `addWork`,
  auto-staffed like a building) — it produces its `effect.gain` only while staffed, at upkeep,
  and files to `discard` only at *end of turn* (`rules/upkeep.ts`'s `discardWorkZone`), not on
  play. Its worker spaces (`CardDef.workers`, default 1, `0` = always operating) share the
  staffing machinery with buildings (see the shared `Staffable` layer in `population.ts`).
  Corvée and Harvest are the current work cards. A fourth kind, `event`, is a **disaster** card (docs/TODO.md): mission-injected only —
  never shown in the collection or deck editor and never player-playable (`unplayableReason`
  rejects it, so `playCard` does too). An event left in hand at end of turn auto-resolves
  its `effect`, then files to `discard` like any other resolved card *unless* that effect sets
  `remove: true`, in which case it's destroyed to `removed` instead (see `rules/upkeep.ts`'s
  `resolveHandEvents`). Barbarian, the one event so far, sets `remove: true` (`effect.loss`
  removes resources — the mirror of `gain`).
  Also `decks.ts` (`DeckDef` — a real player deck, `cards` a `string[]` of meta instance ids
  (Phase 3 Step 7.2) — plus `DeckSeed` and `DEFAULT_DECKS`: content-authoring shape/data for
  a fresh player's deck list, written in plain cardIds since instance identity doesn't exist
  until a collection is seeded; `rules/deckBuilder.ts`'s `buildSeedDecks` resolves a
  `DeckSeed[]` into real `DeckDef[]`. A fresh player starts with exactly one deck, `'starter'`,
  deliberately narrow enough to be built from `collection.ts`'s `STARTING_COLLECTION` alone;
  every deck (seed-derived or player-made) is equally player-editable, there's no separate
  read-only "built-in" registry — see `meta/store.ts`), `collection.ts` (`STARTING_COLLECTION`,
  a plain `Record<cardId, count>` — not an `OwnedCards` itself, same reasoning as `DeckSeed`;
  `rules/collection.ts`'s `collectionFromCounts` turns it into a real, instance-bearing
  `OwnedCards` at seed time), `boards.ts` (`BOARDS` — government boards; each sets all 8
  starting resources: the 5 core plus population/territory/culture), and `missions.ts`
  (`MISSIONS` — each mission supplies its `objective` and `failure` as pure predicates
  over `GameState`, plus an optional `onUpkeep`).

**Shell — the run loop (`src/run/`) + React:**

- `src/run/setup.ts` — `createInitialState(config: RunConfig)`: the starting state for
  a run. The board (`config.board`) sets the baseline for all 8 starting resources;
  the mission's `setup` then layers its own modifiers on top. **Never use `Math.random`
  in game logic** — `config.deck` is already shuffled deterministically from
  `config.seed` (see `src/contract.ts`/`src/rules/rng.ts`); the discard-pile reshuffle
  also draws from the seeded RNG (`GameState.rngState`, advanced by `src/rules/deck.ts`'s
  `drawCard` via `rng.ts`'s `shuffleFromState`), not preserved deck order.
- `src/run/engine.ts` — the turn state machine. `RunState = { G, gameover }`.
  `createRun(config: RunConfig)` builds the initial state and runs the first
  `beginTurn`. `endTurn(state)` runs `applyUpkeep`, checks win/loss, resolves any `event`
  cards still in hand (`resolveHandEvents` — apply effect, exile to `removed`), recycles the
  hand and files the turn's played `work` cards to `discard` (`discardWorkZone`), re-checks
  win/loss, then starts the next turn. `applyMove(state, moveFn, ...args)` clones `G` with `structuredClone`,
  runs the move, and checks win/loss. All three return a new `RunState` — the caller
  (React context) owns the mutable reference. `toRunResult(G, gameover)` promotes a
  finished run into the `RunResult` handed back to the meta loop.
- `src/run/moves.ts` — the moves (`playCard`, `assignWorker`, `unassignWorker`,
  `toggleStaffing`) — the **only** place `G` may change: validate, mutate the
  plain-object `G` draft, delegate computation to `src/rules/`, return `'invalid'` to
  reject. `playCard` pays costs (resources, discard cost), then routes by `kind`: a `building`
  card is placed in the `tableau` via `addBuilding` (staying in play, *not* filed to a pile) and a
  `work` card sticks onto the board via `addWork` (resolving *no* effect on play, filing to
  `discard` only at end of turn); every other card resolves its `effect` and, if `action`,
  files to `discard`. A card with `effect.destroy` demolishes a chosen tableau building and sends
  *that* building's card to `removed`.
  `assignWorker`/`unassignWorker`/`transferWorker`/`toggleStaffing` all target a `Staffable`
  by its instance `id` via `findStaffable`, so they operate on a building *or* a work box
  interchangeably. `toggleStaffing` (the UI's box control) is all-or-nothing — one move either
  fills a box to its full worker requirement or empties it completely, rejected if
  there aren't enough idle workers to fill it. (Building workers are allocated by instance id,
  drawn from the same `nextInstanceId` space as work boxes so the two never collide.)
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`
  (`board` is the `RunConfig.board` this run was launched with, along for presentation —
  e.g. `Board.tsx`'s board-tinted ground backdrop — not gameplay logic, which never
  branches on the board id past `setup.ts`). `GameProvider` takes a `RunConfig`
  (`config` prop) and an `onRunEnd(result: RunResult)` callback, called when the player
  clicks "End Run" on a finished run.
- `src/components/Board.tsx` — the React board. Calls `useGame()` for state and
  actions; calls `moves.playCard` / `moves.toggleStaffing` / `endTurn()`. Display only —
  read derived values from `src/rules/` (e.g. `projectedDelta`, `freePopulation`), never
  recompute game logic. The card visual itself — `CardFace` (name/cost/kind banner/art/
  worker icons/effect text, plus the outer box and its kind coloring, all in one CSS
  module so the kind-coloring rules always resolve against their own ancestor) — lives
  in `src/components/CardFace.tsx`, shared with the deck editor's picker/banner tiles
  and the Collection screen's picker grid; Board layers hand-specific extras (overlap,
  hover-lift, drag/deal/shake states) on top via a `className` prop rather than owning
  any card styling itself. Clicking a hand or pile-viewer card opens
  `src/components/CardZoomOverlay.tsx` — a full-screen dismissable enlargement of a
  single `CardFace` (click anywhere to close) — which the Collection screen also
  reuses for its own click-to-zoom. The full-viewport `.groundBackdrop` behind the
  board is tinted per the run's government board — Board.tsx stamps a `data-board`
  attribute that `Board.module.css` matches against one `--board-<id>-ground` token per
  board (see the theming convention below), so adding a board's own tint is a
  CSS-only edit, no component change.
- `src/meta/` — the meta menu. `MetaMenu.tsx` is the shell: a left column of big nav
  buttons switches between five screens — `CampaignMap.tsx` (the Mission tab — the DAG
  of missions as a horizontally-scrollable tech tree, each node opening `MissionDetailPanel`
  (lore/explanation/reward preview, Phase 3 Step 5.3 above) whose "Continue" hands off to a
  board/deck launch popup that assembles a `RunConfig` via `buildRunConfig` and calls
  `onLaunch`; see Phase 3 Step 5.1 above), `Collection.tsx` (read-only catalogue of the cards the
  player owns, reading `collection` to omit not-yet-unlocked cards), `Shop.tsx` (the
  copy-tier shop — spend Influence to deepen owned cards, Phase 3 Step 5.2 above; lists
  only upgradeable cards, each tile a `CardFace` over a one-click buy button calling
  `onBuyTier` → `App.tsx`'s `buyCardTier`), `Decks.tsx` (every deck
  in the player's store as a grid of tiles, each a hover-revealed shingled fan of the
  deck's cards grouped ×N via `groupCounts` — the ×N badge itself only shows on hovering
  that card, via `CardFace`'s `badgeClassName`. The tile and its list-view overlay are the
  shared `DeckTile`/`DeckListOverlay` from `components/DeckDisplay.tsx` (also used by
  `CampaignMap.tsx`'s launch popup); Decks passes its Edit/Copy/Delete buttons through their
  `actions` slots. Clicking a tile opens a list-view overlay
  of the deck mirroring the run loop's pile viewer, click-to-zoom via the shared
  `CardZoomOverlay`; its header (name/count/Edit) is `position: sticky` so it stays
  pinned and opaque over the cards while scrolling, and centers a click-to-zoom/
  click-outside-to-close hint over that same row. Edit lives on both the tile and the
  overlay in the accent color; Delete (tile-only) is a two-click confirm in
  `--danger-strong`, flipping to "Confirm?" and reverting on mouse-out/navigating away.
  "New Deck" is the grid's own next slot — a hollow dashed tile after the last deck,
  rather than a button above the grid — and stays put (rather than disappearing) once
  `MAX_DECKS` is hit (a core rule, see `deckBuilder.ts` below): it disables itself and its
  label swaps to the limit-reached message, so the cap is explained right where the
  next deck would have gone. And `Stats.tsx` (the run history list).
  `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) edits a single `DeckDef` in
  place — a main picker area (grouped by kind, same groups as `Collection.tsx`) of
  `CardFace` tiles above a bottom banner representing the deck itself (name, card count,
  Save/Cancel, and its cards grouped into ×N stacks like the run loop's pile viewer).
  Cards move between the two by click (the fast path) or drag, via the same hand-rolled
  pointer-drag convention `Board.tsx` uses elsewhere (no drag-and-drop library in this
  project); add/remove go through `rules/deckBuilder.ts`. `store.ts`'s
  `loadStore`/`saveStore` persist
  `PlayerStore` (`runHistory` + `decks`, the latter seeded from `content/decks.ts`'s
  `DEFAULT_DECKS`; plus `influence`/`collection`/`mapProgress`, seeded from
  `content/collection.ts`'s `STARTING_COLLECTION` on a fresh profile) to `localStorage`.
  `parsePlayerStore`'s lenient decks-fallback (a store predating the deck editor gets
  reseeded rather than rejected) doesn't extend to these three newer fields — pre-alpha,
  there's no save worth migrating, so a store missing any of them is just unrecognized.
- `src/components/GameMenu.tsx` — the global-action surface (docs/DESIGN.md's Phase 2
  "game menu (save, config, codex)"): a top-right burger button. Opens a central popup
  listing the items; each opens its own submenu window stacked on top. The Save
  submenu opens with a callout that progress autosaves and this submenu is only for
  backups, then export downloads the `PlayerStore` as a base64 `.civsave` file (`meta/store.ts`'s
  `exportSave`); Load reads one back (`importSave`) and Clear resets to `emptyStore()`.
  Both Load and Clear replace `runHistory`/`decks` wholesale via `App.tsx`'s `persist`,
  so both stage as a `PendingAction` behind an explicit confirm/cancel step before
  applying — export needs no such gate, since it doesn't touch the live store. The
  Config submenu holds device-local preferences (`meta/settings.ts`'s `Settings`,
  persisted under their own `localStorage` key — kept out of `PlayerStore` since
  they're not game progress, so Save's Load/Clear never touches them): a segmented
  **theme picker** (`settings.theme`, built from `meta/settings.ts`'s `THEMES` list —
  System/Light/Dark, System being the default for a fresh profile — resolved to the
  concrete palette actually applied as `data-theme` on documentElement via
  `resolveTheme`/`applyTheme`, since `'system'` isn't itself a valid `data-theme` value;
  `applyTheme` also attaches a live `matchMedia` `change` listener when the choice is
  `'system'`, so an OS light/dark flip is reflected without a reload — see the
  color-palette convention below), a "confirm before ending a round" toggle that folds into `Board.tsx`'s existing
  end-round warning dialog, and a UI-size slider (`settings.uiScale`) that `App.tsx` applies by wrapping the whole
  app in a `transform: scale()` container (`App.module.css`) — chosen over CSS `zoom`,
  which was tried and reverted, because a transformed ancestor becomes the containing block
  for its `position: fixed` descendants, so the run loop's fixed layout and drag clones
  scale together and stay anchored (see docs/TODO.md). Because that wrapper makes `fixed`
  children scroll with content on a body-scrolling screen, the meta shell scrolls inside
  `.content` instead of the body (`MetaMenu.module.css`), and `Board.tsx`/`DeckEditor.tsx`
  divide their drag-clone pointer coordinates by the scale (visual→local). The Codex
  submenu renders `Codex.tsx` — a pure,
  static in-menu rules reference (resources, card kinds, population/staffing, turn
  structure, keyword glossary; list-shaped data in `content/codex.ts`, narrative pages
  authored in the component) that reads no run state, so it's identical on both screens.
  On the run screen only, an optional `runControls` prop adds Restart Run / End Run items. While
  the run is still live these are `PendingAction`-gated like Save's Load/Clear: Restart
  discards the run and starts a fresh one (`GameContext.tsx`'s `restart`, which already
  no-ops the recording half since the run was never finished); End Run abandons it and
  returns to the meta menu without recording a `RunResult`, mirroring
  `handleImportStore`'s silent-discard precedent. Once the run is over, both act
  immediately with no confirm step (the result is already fixed either way — Restart
  records it via `restart`, End Run via `endRun`, same as the gameover overlay's own
  buttons), and Restart is disabled on a won run, mirroring the overlay's own rule.
- `src/app/App.tsx` — the shell that switches between `<MetaMenu>` (which calls
  `onLaunch` with an assembled `RunConfig`) and `<GameProvider>` + `<Board>`. On the
  meta screen it mounts `<GameMenu>` directly; on the run screen a small `RunGameMenu`
  wrapper renders inside `<GameProvider>` so it can pull `runControls` off `useGame()`.
  On `onRunEnd`, it stores the `RunResult` and switches back to the menu.
- `src/main.tsx` — mounts `<App>`. Also imports `src/index.css`, the one bit of global CSS
  in an otherwise all-CSS-Modules codebase; and, before the first render, sets
  `document.documentElement.dataset.theme` from `resolveTheme(loadSettings().theme)` so the
  saved color theme is applied with no light-then-dark flash on load — a plain resolve, not
  `applyTheme`, since a live `'system'` listener needs an owner to tear it down and `App.tsx`
  (not yet mounted at this point) is that owner. `index.css` holds the color-theme palette
  (see the theming convention below) plus two `body` resets: `margin: 0`, since the
  browser's default 8px body margin would otherwise inset every full-bleed/fixed-position
  element (the run loop's hand bar, the deck editor's banner) from the true viewport edges;
  and `background: var(--surface-sunken)`, a themed fallback for any stray gap in the UI
  that would otherwise show through to browser-default white — see the *Dark-mode contrast
  bugs* fix in docs/TODO.md's Done/shipped, where an unthemed `body` was exactly such a
  gap (revealed through the run loop's hand bar's transparent top edge).

See `src/contract.ts` for the `RunConfig`/`RunResult` types, `buildRunConfig` (takes the
player's `decks` and `collection` as required arguments — there's no static deck registry
to fall back on, and a deck's cards are meta instance ids (Phase 3 Step 7.2) that need the
collection to resolve to cardIds), and `reshuffleRunConfig` (re-shuffles an existing
`RunConfig.deck` directly, used by `GameContext.tsx`'s restart) — the spine between the two loops
(docs/DESIGN.md, "The contract").

## Conventions

- **React 18 is pinned** — check compatibility before bumping.
- All state changes flow through `applyMove` / `endTurn` in `engine.ts` — moves
  receive a `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- Tests import `{ describe, it, expect }` from `vitest` explicitly (globals are
  not enabled).
- **The UI is mouse-only by design** — no keyboard-activation affordances (e.g.
  `role="button"` + Enter/Space handlers on custom interactive `div`s). Don't add
  keyboard handlers to non-native interactive elements.
- **The whole app renders inside a `transform: scale()` wrapper** (`App.tsx` /
  `App.module.css`, the UI-size setting) — this constrains all UI work, so three rules
  hold everywhere:
  1. **Never rely on document/body scroll.** A transformed ancestor makes its
     `position: fixed` descendants scroll with body content instead of pinning, so a
     new full-screen surface must scroll *inside its own bounded container*
     (`height` + `overflow`), the way the meta shell scrolls in `.content`
     (`MetaMenu.module.css`) — never `min-height: 100vh` growing the body. `index.css`
     keeps the body itself un-scrollable.
  2. **Convert visual→local px for any new pointer-drag/ghost clone.** `clientX/Y` and
     `getBoundingClientRect()` report *visual* (post-scale) px; writing them into an
     inline `left/top/width/height` on a clone inside the wrapper double-scales them, so
     divide by the scale (`px(v) = v / uiScale`, threaded as a prop — see `Board.tsx` /
     `DeckEditor.tsx`). But **do not** convert `offsetHeight`/`offsetWidth`-derived
     values (they're already in layout space — e.g. `Board.tsx`'s gamearea/pill insets),
     and leave hit-testing alone (it compares `clientX` to `getBoundingClientRect()`,
     visual-to-visual, already consistent).
  3. **Divide viewport units that must track the real screen by `var(--ui-scale)`.**
     A raw `vh`/`vw` measures the true viewport and then gets re-scaled; new full-bleed
     sizes or popup caps should use `calc(… / var(--ui-scale, 1))` (the var inherits from
     the wrapper to every descendant) — see the pile panel / Codex caps.
- **All color goes through the theme palette — never write a raw color in a module.**
  Every color is a semantic CSS custom property defined in `src/index.css`: `:root` holds
  the default **Light** palette (each token's value is the exact hex the module used before
  the theme retrofit, so Light is pixel-identical to the pre-theme look), and
  `:root[data-theme='dark']` overrides the same tokens for **Dark**. `data-theme` lives on
  `document.documentElement` (set pre-mount in `main.tsx`, kept in sync by an `App.tsx`
  effect from `settings.theme`). CSS Modules only ever reference `var(--token)`. Rules:
  same hex + same role → one token; same hex + different roles → separate tokens sharing the
  Light value (`--accent` vs `--card-building-banner`, `--badge-bg` vs `--text-strong`), so
  a theme can move one without the other. Colors used at several alphas are stored as
  space-separated channel tokens (`--accent-rgb: 59 125 216`) composed with
  `rgb(var(--accent-rgb) / 12%)`. The only literals left in modules are pure-black
  drop-shadows (`rgba(0,0,0,…)`) and white scrims (`rgba(255,255,255,…)`) — not
  color-identity, they read fine in either theme. **Adding a theme (e.g. a color-blind
  palette) is one `THEMES` entry in `meta/settings.ts` plus one `:root[data-theme='…']`
  block in `index.css` — zero module edits.**
