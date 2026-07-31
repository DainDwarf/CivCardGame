# Code review — `trade-redesign`

Untracked working file. 8 finder angles over `main...trade-redesign` (116 files,
+5206/−2653), deduped to 16 candidates, each put through one recall-biased verifier:
**12 CONFIRMED · 4 PLAUSIBLE · 0 REFUTED**. Two save-compatibility findings were
dropped on the pre-alpha rule; the two `sim/enablers.ts` findings, the replay-bounds
finding, the cost-schema finding, the per-copy cost merge, the Codex territory
contradiction, the orphaned docstring, the territory-weight rationale, the trade
face's dropped play-time effect and the `placedCards` bypass have been fixed and
removed; the 4 below are open.

---

## Cleanup / altitude

### 1. "Durable standing producer" encoded twice — `src/sim/enablers.ts:457` and `:485`

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

### 2. `canonicalPlay` re-implements `enumeratePlays[0]` — `src/sim/actions.ts:72-81`

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

### 3. Five copy-pasted card-kind sections, in two files

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

### 4. Hot-path cost re-resolution — `src/rules/cost.ts:80` / `:92`

Repeated cost re-resolution on a hot path, plus `canAfford`'s new `Object.entries`
allocation. One drop-in fast path at those two sites covers most of it.
