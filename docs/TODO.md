# CivCardGame — TODO / Idea Backlog

> A scratch list for ideas caught **in passing** so they aren't lost — *not* a
> committed plan. Anything here is a candidate, not a promise. Decided, designed
> work lives in [`DESIGN.md`](DESIGN.md); this is the inbox that feeds it.

**How we use it:** say *"jot: …"* or *"TODO: …"* (or "note that down") mid-task and
the idea lands here as a one-liner without derailing what we're doing. We triage
later — promote items into `DESIGN.md` / real work, or drop them.

> Tags (optional): `[size: S/M/L]` rough effort · `[?]` needs design discussion ·
> `[blocked]` waiting on something else · `[phase: N]` roadmap phase (1 = run loop · 2 = contract + meta shell · 3 = economy & progression · 4 = content & balance).

## Meta loop (`src/meta/` — not built yet)

- **Tutorial missions** — the first few meta missions double as tutorials, introducing mechanics progressively `[?]` `[phase: 3]`
- **Card modifiers** — meta may offer ways to attach persistent modifiers to individual cards (long-term idea, details TBD) `[?]` `[phase: 3]`
- **Government boards** — alongside deckbuilding, the meta lets the player choose a "board" (themed as government type: monarchy, republic, etc.); the board sets starting resources and scales with the player's progression on the mission tech map (i.e. what the player has already unlocked determines how powerful the starting board is) `[?]` `[phase: 3]`

## Cards & content (`src/content/`)

- **Disasters** — some missions inject disaster/event cards (negative effects) into the player's deck as pressure; Military helps prevent/mitigate them (details TBD) `[?]` `[phase: 4]`
- New mission type: "Metropolis" `[?]` `[phase: 4]`
- New mission: "Build the Wonder" `[?]` `[phase: 4]`
- Culture-based missions (depend on the Culture resource) `[?]` `[phase: 4]`
- Building that changes hand size (e.g. +1 card drawn per round) `[?]` `[phase: 4]`
- Culture thresholds change hand size by default (no building required) — culture as a passive progression axis `[?]` `[phase: 4]`
- Resources transformation? Like a building that transforms production into science for example `[phase: 4]`

## UI (`src/components/`)

- **Game menu** — save, config, codex, and other global actions; the codex is where in-depth mechanic explanations live (not tooltips) `[?]` `[phase: 2]`
- **Multi-pip staffing UI** — once a building can require 2–3 workers, its box needs one pip per worker slot (not the current single staff-toggle icon), so partial staffing is visible and each pip can be dragged independently. Follow-up to the now-shipped building→building worker drag; blocked on a multi-worker building actually existing (see [[multi-worker-buildings-roadmap]]). `[size: M] [?] [blocked]` `[phase: 4]`
- **Bulk-move modifier for worker transfers** — a modifier (e.g. shift-drag) to move N workers from one building to another in one gesture, instead of one pip-drag per worker. Only pays off once multi-pip staffing (above) exists. `[size: S] [?] [blocked]` `[phase: 4]`

## Tech debt & infra (build, tests, tooling)

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
