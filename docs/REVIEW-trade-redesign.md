# Code review — `trade-redesign`

Untracked working file. 8 finder angles over `main...trade-redesign` (116 files,
+5206/−2653), deduped to 16 candidates, each put through one recall-biased verifier:
**12 CONFIRMED · 4 PLAUSIBLE · 0 REFUTED**. Two save-compatibility findings were
dropped on the pre-alpha rule; the two `sim/enablers.ts` findings, the replay-bounds
finding, the cost-schema finding and the per-copy cost merge have been fixed and
removed; the 9 below are open.

---

## Correctness

### 1. Codex states both territory rules at once — `src/content/codex.ts:91`

The Trade route entry tells the player a route "holds its slot" on a territory.
`rules/territory.ts:16` `usedTerritory` returns `G.tableau.length` only ("a trade
route is bounded by its rent, so neither spends land"), and the same Codex file says
"Work cards and trade routes take none" (`:47`) and "Work cards, trade routes and
actions take none" (`:124`).

A player reading the Trade route entry plans around routes consuming land — e.g.
concluding a 0-territory Tribe board cannot open Bartering, when it can.

### 2. Territory weight doubled on a rationale the rules contradict — `src/sim/heuristicPolicy.ts:240`

Weight 1.5 → 3, justified as "Territory is now the cap on the whole play area, not
just on buildings — a slot hosts a building, a Work box or a route". Work boxes and
routes cost no land, so if the stated reason were true it would argue for a *lower*
weight, not a higher one — and the same file contradicts itself at `:98` ("a work box
or a route, neither of which competes for it").

The weight change is real in the diff, so the next balance pass cannot tell whether 3
is defensible or an artifact of the abandoned merged cap.

The same false rule survives in three more places, worth one sweep:

- `src/rules/state.ts:61` — "It holds a territory slot for the rest of the run like a building"
- `src/rules/testFixtures.ts:128` — "taking a territory slot but no workers"
- `CLAUDE.md:123` — repeats the `placedCards` claim below

Separately, `src/rules/territory.ts:5` names "the UI's box lookup" as a `placedCards`
consumer that does not exist — `Board.tsx:857-858` builds its own per-zone maps, and a
repo-wide grep for `placedCards` returns zero component hits. The real second consumer
is `sim/actions.ts:46`.

### 3. Trade face drops a play-time effect the engine resolves — `src/components/CardFace.tsx:182`

`if (c.kind === 'trade') return describeTradeFlow(c);` lands before `const e = c.effect`
and `describeSignedResources`, while `rules/tradeRoutes.ts:14` `openTradeRoute` calls
`resolveCard` on the route — "a no-op for the usual effect-less route", i.e. a
non-no-op is anticipated.

A Bronze/Iron route with a one-time entry effect and no hand-written
`display.description` would ship a card that charges or pays a delta its face never
states; only the netted arrow renders. Latent — `bartering` is the sole shipped trade
card and has no effect. Composing the flow line alongside the effect description (the
way threats compose entry effect + drain) keeps face and engine in step.

---

## Cleanup / altitude

### 4. `placedCards` is bypassed by three sweeps in its own branch

`src/rules/territory.ts:3-8` introduces it as "the one read-path for what is on the
board … so a new board zone reaches them by landing here". Adding the one new board
zone on this same branch required four hand edits that went around it:

| site | edit |
|---|---|
| `src/rules/events.ts:73` | `+ G.tradeRoutes.find((c) => c.id === id)` |
| `src/sim/invariants.ts:38` | `+ G.tradeRoutes` appended to the zone list |
| `src/sim/enablers.ts:239` | `+ G.tradeRoutes` appended |
| `src/sim/enablers.ts:485` | `G.tableau` → `[...G.tableau, ...G.tradeRoutes]` |

- `sim/enablers.ts:239` is the cleanest fit — `runCardIds` wants "conversions available
  to *this deck*", and `placedCards` deliberately omits threats/objective, exactly the
  exclusion this site needs.
- `sim/invariants.ts:38` folds cleanly too. One counter-argument worth recording: an
  invariant assertion arguably wants zone enumeration independent of the helper it
  validates. But `nextInstanceId` already folds through `placedCards`, so the asymmetry
  is unexplained either way.
- `rules/events.ts:64-75` is the weak one — it replaces 3 of 8 `.find()` calls, leaving
  a mixed idiom, and allocates a 3-way spread per call on a path the sim hits often.

Not a blanket pattern. These must stay hand-listed: `events.ts:131-137` (per-zone
`isOperating` gating), `sim/oracleKey.ts:56/134` (per-zone multisets),
`population.ts:123` `findStaffable`, `population.ts:58` `freePopulation`.

No import obstacle — `territory.ts` imports only types from `state.ts`, and
`rules/index.ts:15` re-exports it.

### 5. "Durable standing producer" encoded twice — `src/sim/enablers.ts:457` and `:485`

A kind filter (`isStructure(card) || card.kind === 'trade'`) and a zone walk
(`[...G.tableau, ...G.tradeRoutes]`) hold the same concept with nothing tying them
together; both were hand-edited in this branch for the same change. The prose at
`:437-439` states the concept once but enforces nothing.

Zone↔kind correspondence is exact — `run/moves.ts:45/52/54` are the only writers — so
`:485` could iterate `placedCards(G)` with **no behaviour change**, since `:457`
already excludes work-kind cardIds from `producerCredit`.

Use a **file-local** `isDurableProducer` in `sim/enablers.ts`. Not in
`content/cards.ts`: its only consumers would be these two simulator sites, and every
other `kind === 'trade'` in the repo is a routing or display branch that genuinely
needs the distinction. A sim-motivated kind predicate in a game file is the "sim logic
stays in sim" violation.

### 6. `canonicalPlay` re-implements `enumeratePlays[0]` — `src/sim/actions.ts:72-81`

Equivalence holds in all reachable cases: both compute `required` identically
(`:73` / `:96`); `cost.ts:115-118` waives the cost to 0 when the hand cannot spare
enough, so `plays` is never empty and `[0]` is never `undefined`; `walk` is an
ascending combination walk (`:114`) whose first combo is exactly what `canonicalPlay`
builds, and `seen` is empty at the first push. For `required === 0` one returns
`discardHandIdxs: undefined` and the other omits the key — indistinguishable to the
sole consumer, `sim/simulate.ts:111` (`?? []`).

The fast-path defence fails: every call site (`heuristicPolicy.ts:163/179/196`) is
immediately followed by `applyAction`, i.e. a full `cloneState` deep walk. The only
discard-cost card shipped is `fire` (`content/cards.ts:354`).

Fix: `return enumeratePlays(G, playHandIdx, card)[0];`, delete the tautological pinning
test at `actions.test.ts:62-66`, retarget the docstring. Net ~−14 lines and one
invariant that can no longer drift.

### 7. Five copy-pasted card-kind sections, in two files

- `src/meta/Collection.tsx:59-147` — five ~17-line blocks differing only in the
  guard/list identifier and the `<h2>` text; every `CardFace` prop list is
  character-identical, and no block has a special case.
- `src/meta/DeckEditor.tsx:237-266` — the same five sections at 6 lines each.
- The heading↔kind table is duplicated *across* the files: `Collection.tsx:49-53` and
  `DeckEditor.tsx:95-99` are the same five filter+sort lines, rendering the same five
  headings in the same order (Buildings / Wonders / Work / Actions / Trade routes).

One shared table beside `compareCards`/`isDeckable` in `content/cards.ts` plus a `map`
in each file. As it stands, a sixth card kind needs four more edit sites across two
files.

### 8. Orphaned docstring — `src/rules/testFixtures.ts:439-450`

`mint` was inserted between the pre-existing `installCards` docstring and
`installCards` itself, so two stacked doc comments now precede `mint` — the first
describing splicing into `CARDS`, i.e. semantic bleeding onto unrelated code — and
`installCards:450` is left bare. Zero-net-line fix: move lines 439-442 above line 450.

### 9. Hot-path cost re-resolution — `src/rules/cost.ts:80` / `:92`

Repeated cost re-resolution on a hot path, plus `canAfford`'s new `Object.entries`
allocation. One drop-in fast path at those two sites covers most of it.
