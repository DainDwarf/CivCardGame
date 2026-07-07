# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CivCardGame is a **single-player** civilization-building card game that runs in the
browser. The player builds up a civilization solo — there is **no AI or human
opponent**. The run loop uses a lightweight custom engine (`src/run/engine.ts`) for
the turn/phase state machine; state is held in React context (`src/run/GameContext.tsx`).

Stack: TypeScript · Vite · React 18 · Vitest.

It is a **roguelite deckbuilder** with two loops: a **run loop** (play a *locked*
pre-built deck against a mission) and a **meta loop** (persistent deck construction,
shop, mission selection — the *only* place decks are edited). See
[`docs/DESIGN.md`](docs/DESIGN.md) for the full game design and roadmap.

**Progress.** Phases 1–2 are done; Phase 3 (economy & progression) is in progress.

- **Phase 1 — run loop** (`src/run/`): hybrid cards (building vs. action), the turn
  lifecycle, a **population/worker-staffing** layer (buildings must be staffed to
  operate; the population eats food each round), and mission-driven win/lose conditions.
- **Phase 2 — contract + meta shell**: `src/contract.ts` (`RunConfig`/`RunResult`) is
  the spine between the loops; `src/app/App.tsx` switches between the meta menu
  (`src/meta/MetaMenu.tsx`, a left-nav shell over the Mission/Collection/Shop/Decks/Stats
  screens) and a run. Deck construction (`src/meta/DeckEditor.tsx`) and `localStorage`
  persistence (`src/meta/store.ts`'s `PlayerStore`) are built.
- **Phase 3 — economy & progression** (in progress). The systems that now exist:
  - **Ownership + Influence currency** — `rules/collection.ts`'s `OwnedCards` tracks
    ownership as identified per-copy meta instances; `PlayerStore` carries
    `collection`/`influence`/`mapProgress`, seeded from `content/collection.ts`'s
    `STARTING_COLLECTION` and `content/decks.ts`. Not-yet-unlocked cards are hidden
    entirely (an unlock is meant to be a surprise); the deck editor caps each card at
    the copies owned.
  - **Copy-tier shop** — `rules/shop.ts` (`TIER_LADDER` ×1→×2→×4→×8; `buyTier`) +
    `meta/Shop.tsx`: spend Influence to buy extra copies of owned cards.
  - **Campaign-map DAG** — `content/missions.ts` missions form a prereq-gated DAG
    (`rules/campaign.ts`), rendered as a horizontally-scrollable branching tech tree
    (`meta/CampaignMap.tsx`); each `'standard'` mission grants a fixed Influence reward
    plus one card unlock on first clear (`rules/rewards.ts`), previewed on the
    `MissionDetailPanel` and paid out in `App.tsx`'s `recordResult`.
  - **Infinite missions + threats** — `'infinite'`-kind missions never win and pay
    Influence = rounds survived on every attempt. `GameState.threats`
    (`rules/threats.ts`) are persistent, mission-seeded board hazards that escalate and
    drain resources each upkeep (each resolving through the shared resolver spine).
  - **Card stickers** — permanent per-copy buffs bought with Influence
    (`content/stickers.ts`, `rules/stickers.ts`); up to 2 per owned instance, stacking.
    A sticker owns its own logic on its `StickerDef` (`appliesTo`/`applyGain`/`applyCost`
    hooks); `effectiveGain`/`effectiveCost`/`effectiveCard` are the only places a sticker
    touches run *or* display values, so resolution and every render site (run + meta)
    agree. Current stickers: Reinforced, Efficient, Irrigation.

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

**Core (framework-free — no React, no I/O, no game-engine library):**

- `src/rules/` — all real game logic *and* the core state type; one module per concern.
  Unit tests sit alongside. **When adding a rule, put the logic here and test it directly
  — never bury it in a move or a component.**
  - `state.ts` — `GameState` (the serializable run state `G`): the resource pools plus the
    card zones `deck`/`hand`/`discard`/`removed`, each a `CardInstance[]`
    (`{ id, cardId, counters? }`) so every card has a stable per-run **instance id** and
    carries its own per-copy state in its own `counters` map (via `getCounter`/`bumpCounter`)
    — cards own their own numbers, so playing one copy never touches another's. Also the
    tableau (`PlacedCard` = `CardInstance` + `workers`), `workZone` (played `work` awaiting
    staffing), `threats` (persistent hazards, each a `CardInstance`), and
    `pendingInteraction` (a card effect suspended awaiting a player choice; while set,
    `endTurn` no-ops and undo is blocked). `instancesFromCardIds` is the shared mint path;
    `blankState()` builds an empty one. Instance ids are unique across *all* zones.
  - `resources.ts` — the `Resources` bundle and its arithmetic (`add`/`subtract`/`scaleResources`).
  - `deck.ts` — draw + discard-pile reshuffle, both off the seeded RNG stream (`G.rngState`).
  - `effects.ts` — the **resolver spine**: `resolveCard(ctx)` is the single path a card's
    effect runs through (its own `CardDef.resolve`, else the declarative default from the
    `CardEffect` bag). The `EffectContext` (`{ G, self, target?, answer? }`) tells an effect
    which copy is resolving and what it targets (a Destroy demolition is just `ctx.target`).
    `resolveProduction(ctx)` is production's narrower counterpart — recurring per-round, so
    it deliberately omits the one-shot play fields.
    An interactive effect suspends into `pendingInteraction` and re-enters via
    `moves.resolveInteraction` — all plain data, so undo/clone survive.
  - `population.ts` — worker staffing over buildings *and* work cards through one `Staffable`
    layer (`requiredWorkersOf`/`isOperating`/`freePopulation`/`findStaffable`,
    `addBuilding`/`addWork`, the shared `nextInstanceId` allocator, `foodUpkeep`).
  - `threats.ts` — persistent board hazards: `addThreat` seeds one at mission setup;
    `tickThreats` just calls `resolveCard` per threat, so the threat card computes its own
    behaviour — the engine never reads or scales its data.
  - `production.ts` — `resolveProduction` per *operating* (staffed) tableau/workZone
    instance; the engine asks each instance to produce, never reads its `produces` itself.
  - `upkeep.ts` — `applyUpkeep` (production → threats tick → mission tick → food eaten),
    plus `discardWorkZone` (end-of-turn work filing) and `projectedDelta` (the UI preview).
  - `tableau.ts` — derived stats, including the `territory` cap gating tableau size.
  - `deckBuilder.ts` — deck *construction*: a `DeckDef.cards` entry is a meta instance id,
    so `addCard`/`removeCard` resolve through the player's `OwnedCards` (returning
    `'invalid'` on an unresolvable/capped id); `groupCounts`/`resolveDeckCards` translate
    instance ids back to cardIds; `buildSeedDecks` turns content `DeckSeed`s into real
    `DeckDef`s; `MAX_DECKS` is the committed deck-count cap (enforced at `App.saveDeck`).
  - `collection.ts` — `OwnedCards` = `{ instances: MetaCardInstance[], nextId }` (each
    `MetaCardInstance` is `{ id, cardId, stickers? }`). `nextId` is append-only, so
    `grantCopies` never renumbers and a deck's instance-id references never go stale;
    `copiesOwned`/`isOwned` filter instances (an absent cardId = not yet unlocked).
  - `shop.ts` — the copy-tier economy: `TIER_LADDER`, `nextTier`, the immutable `buyTier`.
  - `stickers.ts` — sticker logic: `buySticker` (meta purchase) and
    `effectiveGain`/`effectiveCost`/`effectiveCard`, the only places a sticker touches run
    or display values (each a generic fold over the `StickerDef` hooks; see the convention).
- `src/content/` — the typed game catalogues (cards, decks, boards, missions, stickers).
  A card or sticker def carries its own behaviour (a card's `resolve` closure, a sticker's
  hooks — see the *own their own logic* convention), so these are data *and* the per-entry
  logic that rides on it, not pure data tables. **A building card *is* the building** —
  there's no separate building catalogue. One file per catalogue:
  - `cards.ts` — `CARDS`, the single card catalogue (`CardKind` =
    building/action/work/event/threat; see DESIGN.md → *Card kinds* for what each kind does
    and how it leaves play). A `building` carries its own stats
    (`produces`/`cultureOutput`/`workers`/`tags`) right on the `CardDef`. Whether a card
    files to `discard` vs `removed` is a property of the *effect* that files it, never the
    kind (e.g. Destroy's `effect.destroy`, an event's `effect.remove`).
  - `decks.ts` — `DeckDef` (a player deck; `cards` is meta instance ids) plus `DeckSeed`/
    `DEFAULT_DECKS` (content authored in plain cardIds, resolved by `buildSeedDecks`). A
    fresh player starts with one editable deck; there's no read-only "built-in" tier.
  - `collection.ts` — `STARTING_COLLECTION` (a plain `Record<cardId, count>`, turned into a
    real instance-bearing `OwnedCards` by `collectionFromCounts` at seed time).
  - `stickers.ts` — `STICKERS`; each `StickerDef` carries its own
    `appliesTo`/`applyGain`/`applyCost` logic and an `icon`.
  - `boards.ts` — `BOARDS` (government boards; each sets all 8 starting resources: the 5
    core plus population/territory/culture).
  - `missions.ts` — `MISSIONS`; each supplies `objective`/`failure` as pure predicates over
    `GameState`, plus optional `setup`/`onUpkeep`/`kind`/`prereqs`/`map`/`reward`/`lore`.

**Shell — the run loop (`src/run/`) + React:**

- `src/run/setup.ts` — `createInitialState(config: RunConfig)`: **constructs the initial
  `GameState`** — the pre-play snapshot, before any turn or draw (`engine.ts` then drives
  the turns). The board (`config.board`) sets the baseline for all 8 starting resources;
  the mission's `setup` then layers its own modifiers on top. `config.deck` arrives
  already shuffled (deterministically from `config.seed` — see the determinism convention).
- `src/run/engine.ts` — the turn state machine. `RunState = { G, gameover }`.
  `createRun(config: RunConfig)` bootstraps a run by calling `setup.ts`'s
  `createInitialState`, then running the first `beginTurn`. `endTurn(state)` runs `applyUpkeep`, checks win/loss, resolves any `event`
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
  interchangeably. `toggleStaffing` (the UI's box control) is all-or-nothing — it fills a box
  completely or empties it.
- `src/run/GameContext.tsx` — React context that holds `RunState` and exposes
  `{ G, gameover, board, moves, endTurn, undo, canUndo, restart, endRun }` via `useGame()`
  (`board` is the `RunConfig.board` this run was launched with, along for presentation —
  e.g. `Board.tsx`'s board-tinted ground backdrop — not gameplay logic, which never
  branches on the board id past `setup.ts`). `GameProvider` takes a `RunConfig`
  (`config` prop) and an `onRunEnd(result: RunResult)` callback, called when the player
  clicks "End Run" on a finished run.
- `src/components/Board.tsx` — the React board. Calls `useGame()` for state and the moves;
  display only — read derived values from `src/rules/` (`projectedDelta`,
  `freePopulation`), never recompute game logic. Supporting pieces:
  - `CardFace.tsx` — the one card visual (name/cost/kind banner/art/workers/effect text +
    kind coloring, all in one CSS module). Shared by the hand, the deck editor, and
    Collection; Board layers hand-only extras (overlap, hover-lift, drag/deal states) on via
    a `className` prop. A stickered card shows a bottom-left `stickerBadge` (the shared
    `StickerRow`) and its `effectiveCard` (sticker-adjusted) numbers.
  - `CardZoomOverlay.tsx` — a full-screen click-to-close enlargement of one `CardFace`,
    reused by Collection.
  - `ThreatZone` renders `G.threats` as `CardFace`s, reading only `GameState`, never the
    mission. The `.groundBackdrop` is tinted per government board via a `data-board`
    attribute matched in `Board.module.css` — a CSS-only edit per board, no component change.
- `src/meta/` — the meta menu. `MetaMenu.tsx` is the shell: a left nav switches five screens:
  - `CampaignMap.tsx` (Mission tab) — the mission DAG as a horizontally-scrollable tech
    tree (drag-to-pan); a node opens `MissionDetailPanel` (lore + reward preview) whose
    "Continue" hands off to a board/deck launch popup that assembles a `RunConfig` via
    `buildRunConfig`. `'infinite'` missions render in a bottom banner, not as nodes.
  - `Collection.tsx` — read-only catalogue of owned cards (omits not-yet-unlocked ones); a
    tile opens `CardInstancePanel.tsx`, a per-owned-instance drill-down.
  - `Shop.tsx` — the copy-tier + sticker shop; lists only cards with a tier or sticker slot
    left, each buy button calling back into `App.tsx` (`onBuyTier`/`onAttachSticker`).
  - `Decks.tsx` — every deck as a tile (a hover-revealed card fan grouped ×N via
    `groupCounts`); the tile + its list-view overlay are the shared `DeckTile`/
    `DeckListOverlay` (`components/DeckDisplay.tsx`, also used by the launch popup), with
    Edit/Copy/Delete in its `actions` slots. "New Deck" is the grid's own next slot,
    disabled once `MAX_DECKS` is hit.
  - `Stats.tsx` — the run-history list.

  `DeckEditor.tsx` (opened from `Decks.tsx`, not a nav tab) edits one `DeckDef` in place — a
  picker grid (grouped by kind) above a deck banner; cards move by click or the same
  hand-rolled pointer-drag `Board.tsx` uses (no DnD library), through `rules/deckBuilder.ts`.
  A stickered instance breaks out of its fungible ×N stack into its own addressable tile.
  `store.ts` persists `PlayerStore` to `localStorage` (`loadStore`/`saveStore`; seeded from
  `content/`'s `DEFAULT_DECKS`/`STARTING_COLLECTION` on a fresh profile); `applyRunResult`
  is the pure fold that records a finished run. Pre-alpha: an unrecognized store shape resets
  to `emptyStore()`, no migration.
- `src/components/GameMenu.tsx` — the global-action surface: a top-right burger button
  opening stacked submenus.
  - **Save** — export/import/clear the whole `PlayerStore` as a base64 `.civsave` file
    (`meta/store.ts`'s `exportSave`/`importSave`); the destructive ones (Load, Clear) stage
    as a `PendingAction` behind a confirm step. Progress autosaves; this is only for backups.
  - **Config** — device-local `Settings` (`meta/settings.ts`), persisted under their own
    `localStorage` key (kept out of `PlayerStore` since they're not game progress): the
    theme picker, a "confirm before ending a round" toggle, and the UI-size slider (see the
    theming and UI-scaling conventions below for how those two are applied).
  - **Codex** — a static in-menu rules reference (`Codex.tsx`, data in `content/codex.ts`),
    reading no run state so it's identical on both screens.
  - On the run screen only, a `runControls` prop adds **Restart Run / End Run** —
    `PendingAction`-gated while the run is live, immediate once it's over (Restart disabled
    on a won run, mirroring the gameover overlay).
- `src/app/App.tsx` — the shell that switches between `<MetaMenu>` (which calls
  `onLaunch` with an assembled `RunConfig`) and `<GameProvider>` + `<Board>`. On the
  meta screen it mounts `<GameMenu>` directly; on the run screen a small `RunGameMenu`
  wrapper renders inside `<GameProvider>` so it can pull `runControls` off `useGame()`.
  On `onRunEnd`, it stores the `RunResult` and switches back to the menu. It also owns the
  meta write paths — `recordResult` (via `applyRunResult`), `buyCardTier`, `attachSticker`,
  `saveDeck` — each `persist`ing the updated `PlayerStore`.
- `src/main.tsx` — mounts `<App>` in `<StrictMode>` and imports `src/index.css`, the one
  global stylesheet (everything else is CSS Modules). It sets `data-theme` on
  `documentElement` from the saved setting before first paint (no theme flash on load).
  `index.css` holds the color-theme palette (see the theming convention below) plus the few
  `body` resets that can't live in a module. The rationale for each — the pre-paint resolve,
  the `body` margin/background/overflow resets — lives in those files' own comments.

See `src/contract.ts` for the `RunConfig`/`RunResult` types, `buildRunConfig` (takes the
player's `decks` and `collection` as required arguments — there's no static deck registry
to fall back on, and a deck's cards are meta instance ids that need the
collection to resolve to cardIds), and `reshuffleRunConfig` (re-shuffles an existing
`RunConfig.deck` directly, used by `GameContext.tsx`'s restart) — the spine between the two loops
(docs/DESIGN.md, "The contract").

## Conventions

- **React version** — on React 18; nothing external pins it (boardgame.io, the
  original reason, was never actually a dependency), so a bump to 19 is a deliberate
  choice, not a blocker. Whatever the version, keep `setState` updaters **pure** — the
  run loop relies on StrictMode's intentional dev double-invoke to catch impurity.
- **Cards and stickers own their own logic.** A card's effect runs only through
  `resolveCard(ctx)` (its own `CardDef.resolve`, else the declarative default) — never
  read or scale `CardDef.effect` from a move, upkeep, threat tick, or component. A
  sticker likewise carries its behaviour on its `StickerDef`
  (`appliesTo`/`applyGain`/`applyCost`), dispatched generically by `rules/stickers.ts` —
  no sticker-specific branches at call sites. Adding a mechanic means adding a
  closure/hook on the data, not a branch in the engine.
- All state changes flow through `applyMove` / `endTurn` in `engine.ts` — moves
  receive a `structuredClone` of `G` and mutate it directly; never mutate `G` elsewhere.
- **Game logic is deterministic — never `Math.random`.** Runs are seeded so they're
  reproducible (replays + headless simulation, see DESIGN.md); all randomness goes through
  the seeded RNG (`src/rules/rng.ts`), threaded as `GameState.rngState` and advanced by
  `deck.ts`'s draw/reshuffle. `config.deck` reaches the run already shuffled from
  `config.seed` (`contract.ts`).
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
