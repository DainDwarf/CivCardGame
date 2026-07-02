# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Phase 2 build plan — sequenced `[phase: 2]`

> The agreed task order for closing the loop (contract + meta shell). Numbered = do in
> order; each step is meant to leave something runnable. See *The contract* and
> *Government boards* in [[DESIGN]].

1. ~~**Scaffold meta content**~~ — done, see *Done / shipped* below. `[size: S]`
2. ~~**Mission-select menu**~~ — done, see *Done / shipped* below. `[size: M]`
3. ~~**Define `contract.ts`**~~ — done, see *Done / shipped* below. `[size: M]`
4. ~~**Wire the loop closed**~~ — done, see *Done / shipped* below. `[size: L]`
5. ~~**localStorage persistence**~~ — done, see *Done / shipped* below. `[size: M]`
6. ~~**Extend the meta menu**~~ — done, see *Done / shipped* below. `[size: M]`
7. ~~**Deck construction**~~ — done, see *Done / shipped* below. `[size: L]`

## Meta loop (`src/meta/`)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`
- **In-run menu extras (end run / restart run)** — `GameMenu.tsx`'s popup is currently identical on the meta screen and the run screen; the run screen should eventually get extra items (end run, restart run) alongside save/config/codex `[?]` `[phase: 2]`
- **Populate the codex submenu** — `GameMenu.tsx`'s Codex item currently opens an empty placeholder window; it should surface reference info (cards/buildings/missions glossary, rules reminders — details TBD) `[?]` `[phase: 2]`
- **Populate the config submenu** — `GameMenu.tsx`'s Config item currently opens an empty placeholder window; it should hold player-facing settings (details TBD) `[?]` `[phase: 2]`
- **Collection screen UI rework** — `Collection.tsx` is currently a plain grid of text tiles (shell-only, shipped with Phase 2 step 6); give it a real visual pass once deck construction (step 7) is in the picture `[?]` `[phase: 2]`
- **Stats screen UI rework** — `Stats.tsx` is currently a plain list of run-result rows (shell-only, shipped with Phase 2 step 6); revisit its look once there's more to show (rewards, trends across runs) `[?]` `[phase: 2]`
- **Populate the save submenu** — `GameMenu.tsx`'s Save item currently opens an empty placeholder window; `PlayerStore` (`meta/store.ts`) has no user-facing way to export/import a save file or clear it — worth a settings-style affordance once there's enough in the store to be worth backing up `[?]` `[phase: 2]`
- **Deck editor UI rework** — `DeckEditor.tsx` (shipped with Phase 2 step 7) is a first-pass layout: plain grid card picker, chip list, no search/filter/sort; give it a real visual pass `[?]` `[phase: 2]`

## Cards & content (`src/content/`)

- **Disasters** — a **mission modifier**: some missions inject disaster/event cards (negative effects) into the player's *run* deck at mission start, as pressure. Crucially, this only affects the run deck the mission is launched with — it never mutates the saved meta deck. Military helps prevent/mitigate them (details TBD). Contract-relevant: the `RunConfig`'s run deck = the player's meta deck + the mission's injected cards, so injection likely happens as the `RunConfig` is assembled. `[?]` `[phase: 2]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`

## UI (`src/components/`)

- **Fading transition between meta and run stages** — `App.tsx`'s meta↔run screen switch is an instant cut; a fade would smooth it out `[?]`
- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Game design & balance

- Card that gives a draw when expanding territory `[?]` `[phase: 4]`
- Card effects that trigger on discard / on draw, to enable combos `[?]` `[phase: 4]`



---

## Rejected

> Considered and turned down — kept (not deleted) so we don't re-litigate the same idea
> without new information.

- **Ignore worker assignment in the undo list** — assign/unassign worker moves would skip pushing undo snapshots, so undo only steps through "meaningful" turn actions. Tried it (a `quietMove` action updating `present` without touching `past`), then reverted: having worker reassignment silently bundled into the prior card-play's undo step is confusing to the player, while the alternative — reconciling worker state done in the "present" back onto a restored past snapshot — is deeply error-prone (instance-count and population-total edge cases). For now, worker reassignments stay part of the regular undo list; revisit if a cleaner solution presents itself.

## Done / shipped

> Completed items move here (newest first) so the backlog stays current but nothing
> silently vanishes. Everything through **v0.0.1 (end of Phase 1)** has been moved to
> [`CHANGELOG.md`](../CHANGELOG.md); this section restarts empty for Phase 2 onward.

- **Game menu** — `src/components/GameMenu.tsx` is the shell's global-action surface
  called for by `docs/DESIGN.md`'s Phase 2 description: a top-right burger button,
  mounted once by `App.tsx` alongside either `MetaMenu` or the run's `Board`, so it
  overlays both loops. Opens a central popup listing the decided items (save, config,
  codex); each opens its own submenu window stacked on top. All submenus are empty
  placeholders — no save/config/codex feature exists yet. The in-run screen gaining
  extra items (end run, restart run) is tracked separately above.
- **Deck construction** (Phase 2 build plan step 7) — `src/meta/DeckEditor.tsx` is the
  new deck editor: name/description fields, a card picker (reuses `Collection.tsx`'s
  `CardTile`), and the in-progress deck as removable chips. `Decks.tsx` is now a single
  editable list (New/Edit/Delete) — the old "premade vs. custom" split is gone
  entirely. `content/decks.ts`'s `DeckId`/`DECKS` (a closed union + registry) became
  `DeckDef`/`DEFAULT_DECKS` (a plain array of seed data): a fresh player's store is
  seeded with these 3 decks via a new `rules/deckBuilder.ts` (`cloneDecks`, so nothing
  shares references with the seed constant), fully editable from that point on — there
  is no separate read-only deck concept anymore. `deckBuilder.ts` also holds
  `addCard`/`removeCard` (returning `string[] | 'invalid'`, mirroring `run/moves.ts`'s
  `'invalid'` signal — `addCard` rejects an unknown cardId as a data-coherence check,
  distinct from the size/copy/rarity constraints still deferred to Phase 4),
  `groupCounts` (promoted out of `Decks.tsx`, now shared + tested), and
  `resolveDeckCards`. `PlayerStore` gained `decks: DeckDef[]`; `App.tsx` now holds one
  `PlayerStore`-shaped state with a single `persist()` writer (previously `saveStore`
  only ever wrote `runHistory` — once decks became a sibling field, that would have
  silently wiped saved decks on every recorded run). `contract.ts`'s `buildRunConfig`
  now takes the player's `decks` as a required third argument instead of reading a
  static registry, and gained `reshuffleRunConfig` (reshuffles `RunConfig.deck`
  directly, no registry lookup) — **this supersedes the restart mechanism described in
  "Restart reshuffles with a fresh seed" below**: `GameContext.tsx`'s `restart` no
  longer calls `buildRunConfig` with a `deckId` lookup (which has no path to the
  player's store), it calls `reshuffleRunConfig` on the live `RunConfig` instead.
- **Extend the meta menu** (Phase 2 build plan step 6) — `src/meta/MetaMenu.tsx` is a
  new shell: a left column of big nav buttons (Mission / Collection / Decks / Stats)
  switches between meta screens, rendered in `src/app/App.tsx` instead of mounting
  `MissionSelect` directly. `MissionSelect.tsx` lost its inline run-history block (now
  its own `Stats.tsx` tab) and otherwise kept its mission/board/deck picker + Start Run
  button unchanged. `Collection.tsx` lists the full `CARDS` catalogue (grouped
  Buildings & Wonders / Actions) and `Decks.tsx` lists `DECKS` with their card
  contents — both read-only, shell-only per the step's scope; deck construction
  (writing to the persisted store) is step 7.

- **localStorage persistence** — `src/meta/store.ts`'s `loadStore`/`saveStore` persist the
  player store to `localStorage` under key `civcardgame:player-store`. Only holds
  `runHistory` today; collection/saved-decks/progress will extend `PlayerStore` as those
  features land. `App.tsx` seeds `runHistory` state from `loadStore()` on mount and calls
  `saveStore` after every recorded run (including restarts). Missing/corrupt data falls
  back to an empty store; `localStorage` failures (quota, private browsing) are swallowed
  so the run continues in-memory-only.
- **Strategic resources on `RunResult`** — `RunResult.stats` gained `strategicResources:
  { population, territory, culture }` alongside the existing `finalResources` (the 5
  core resources). Kept as a separate field rather than folded into `finalResources`
  since population/territory/culture live as top-level `GameState` fields, not inside
  `Resources`. `engine.ts`'s `toRunResult` populates it from `G` at run end.
- **Seeded discard-pile reshuffle** — `drawCard` (`rules/deck.ts`) no longer preserves
  discard order when it recycles into the deck; it now reshuffles via
  `rules/rng.ts`'s new `shuffleFromState`, which resumes a persisted RNG stream instead
  of reseeding from scratch each time. `GameState` gains `rngState` (the generator's
  serializable state, from `pure-rand`'s `getState()`/`xoroshiro128plusFromState`),
  seeded once from `RunConfig.seed` in `setup.ts`'s `createInitialState` and advanced
  each reshuffle — so it rides along for free with `structuredClone`/undo, and a
  restart (which mints a fresh seed) reshuffles both the initial deck and every future
  discard-recycle differently. `blankState` defaults `rngState` from a fixed `'blank'`
  seed for tests that don't care.
- **Disable restart after a won run** — the gameover overlay's Restart button now
  disables itself (with an explanatory tooltip) when `gameover.outcome === 'victory'`;
  restarting a win doesn't make sense — the player should hit End Run to bank the
  result instead. Defeats are unaffected; Restart still works there.
- **Restart reshuffles with a fresh seed** — `GameContext.tsx`'s `restart` was reusing
  the live `RunConfig` unchanged, so it replayed the identical draw order every time.
  `RunConfig` now carries `deckId` alongside the already-shuffled `deck`, so `{ board,
  missionId, deckId, seed }` alone fully determines a run — restarting calls
  `buildRunConfig` again with the same `missionId`/`board`/`deckId` but a fresh
  `crypto.randomUUID()` seed, the same path a menu launch takes. Kept `deckId` on
  `RunConfig` (rather than reshuffling the already-shuffled `deck` array in place) so
  any single run — including a restart — stays reproducible from its own seed alone,
  without needing the seed chain of every restart that came before it.
- **Wire the loop closed** (Phase 2 build plan step 4) — `src/app/App.tsx` is the new
  shell: a meta↔run view switch holding `{ screen: 'menu' } | { screen: 'run'; config }`
  state. `createInitialState`/`createRun` now take a `RunConfig` instead of a bare
  `missionId`; `createInitialState` applies the board's baseline (all 8 starting
  resources) before the mission's `setup` layers its modifiers on top — disaster
  injection stays unimplemented (no mission defines one yet; the seam is the assembled
  `RunConfig.deck`, per `buildRunConfig`). `GameProvider` takes `{ config, onRunEnd }`;
  `restart` now carries `RunConfig` through the reducer action instead of reading
  `missionId` off the live state. The gameover overlay's "End Run" button (previously
  disabled) now calls the new `endRun()` context method, which promotes the finished
  `RunState` into a `RunResult` (`engine.ts`'s `toRunResult`) and hands it to
  `onRunEnd` — `App` stores it and returns to the menu, where `MissionSelect` shows a
  one-line "Last run: …" summary. `main.tsx` now mounts `<App>` instead of
  `<MissionSelect>` directly. `run.test.ts`'s `start()` helper builds a `RunConfig`
  by hand (unshuffled deck) rather than going through `buildRunConfig`, since the
  tests assert on a fixed hand order that a seeded shuffle would disturb; added a
  board-application test (monarchy/republic) since Tribe's values happen to match the
  old hardcoded defaults and wouldn't have caught a broken board wire-up.
- **Define `contract.ts`** (Phase 2 build plan step 3) — `src/contract.ts` formalizes
  `RunConfig` (`deck` / `board` / `missionId` / `seed`) and `RunResult` (`outcome` /
  `missionId` / `stats`; deliberately no `rewards` field — those are looked up from
  the mission or derived from `stats` by the meta loop, not carried on the result),
  plus `buildRunConfig(selection, seed)`, which
  promotes a `RunSelection` into a `RunConfig` by resolving the picked `DeckId` and
  shuffling its cards deterministically from `seed`. New `src/rules/rng.ts` wraps
  `pure-rand` (`xoroshiro128plus` + `uniformInt`) behind `seededRng`/`shuffle` — the
  one seam allowed to produce randomness; `seededRng` is exposed (not just `shuffle`)
  so step 4 can extend the same stream to the discard-pile reshuffle. Not yet wired
  into `createRun`/`setup.ts` — those still take a bare `missionId` and a fixed deck
  until step 4 swaps the pipeline over to consume a `RunConfig`.
- **Mission-select menu** (Phase 2 build plan step 2) — `src/meta/MissionSelect.tsx`,
  the first meta screen, replaces the old direct-to-run mount in `main.tsx`. Picks
  mission (of 3) / board (of 3) / deck (of 3) into a provisional `RunSelection`
  (`{ missionId, boardId, deckId }`) held in local state. "Start Run" is intentionally
  disabled — the Board is unreachable via UI until step 4 wires the loop closed;
  `run.test.ts` still exercises the run loop directly in the meantime.
- **Scaffold meta content** (Phase 2 build plan step 1) — `src/content/boards.ts`
  (`BoardId` + `BOARDS`: Tribe, Monarchy, Republic, each setting all 8 starting
  resources) and `src/content/decks.ts` restructured from a single `DEFAULT_DECK`
  into a `DeckId`/`DECKS` registry (Balanced, Industrious, Scholarly). Not yet wired
  into a run — boards are inert data until step 2 (mission-select menu) and step 4
  (setup assembly) consume them.
