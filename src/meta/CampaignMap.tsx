import { useRef, useState } from 'react';
import { MISSIONS, type MissionDef } from '../content/missions';
import { ageColSpans } from '../content/ages';
import { BOARDS, type BoardId } from '../content/boards';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import type { OwnedCards } from '../rules/collection';
import { type BoardStickers } from '../rules/boardStickers';
import { buildRunConfig, type RunConfig } from '../contract';
import { isCompleted, isAvailable } from '../rules/campaign';
import { BOARD_IDS } from './boardDisplay';
import { DeckTile, DeckListOverlay } from '../components/DeckDisplay';
import { BoardMini } from '../components/BoardMini';
import { CardFace } from '../components/CardFace';
import { CardZoomOverlay } from '../components/CardZoomOverlay';
import styles from './CampaignMap.module.css';

// --- Map geometry (px, pre-scale — the whole app is scaled by the UI-size wrapper) ---
const NODE_W = 200;
const NODE_H = 108;
const COL_W = 260; // horizontal gap between column origins
const ROW_H = 150; // vertical gap between row origins
const PAD_X = 56;
const PAD_Y = 36;

// Half-width (% of map width) of each age→age color transition in the node-area gradient wash —
// smaller keeps each age's color solid longer with a tighter blend between them.
const AGE_BLEND = 2;

const nodeLeft = (col: number) => PAD_X + col * COL_W;
const nodeTop = (row: number) => PAD_Y + row * ROW_H;

/**
 * The Campaign Map. The campaign is humanity's history as a branching tech tree (docs/DESIGN.md): a
 * "long but narrow" horizontal chronology the player scrolls through to orient themselves. Each
 * mission is a node positioned by its authored `map: {col,row}` (`content/missions.ts`), edges are
 * drawn from `prereqs`, and per-node state comes from `rules/campaign.ts`:
 *
 *  - **cleared** (`isCompleted`) — ✓, replayable, opens the launch popup;
 *  - **available** (`isAvailable`, not yet cleared) — opens the launch popup;
 *  - **locked** (prereqs unmet) — a silhouette: position + lock glyph shown, but name /
 *    objective / reward hidden until reachable (a deliberate change from the "unlock is a
 *    surprise" hide-everything precedent — the node's *existence* orients the player in
 *    history, its *identity* stays hidden), and clicking it is inert.
 *
 * Ages (`content/ages.ts`) label ranges of the timeline as themed right-arrow bands across the top
 * (Neolithic / Bronze Age / Iron Age), each tinted via a `data-age` attribute matched in the CSS
 * module (the `data-board` precedent). Each age *covers its slice of the DAG*: its band + the
 * gradient wash beneath echo the same age colors and span exactly the columns its missions occupy,
 * derived from those missions' `map.col` (`ageColSpans`). With no standard missions placed yet the
 * derivation is dormant — no bands render until the first age's missions land (Step 6).
 * Clicking a cleared/available node opens
 * `MissionFlowPopup` on its 'detail' step — lore, explanation, and a reward preview; its "Continue"
 * advances the same popup to its 'launch' step (board picker left, deck picker right), which
 * assembles the `RunConfig` and calls `onLaunch`.
 */
export function CampaignMap({
  decks,
  collection,
  mapProgress,
  boardStickers,
  uiScale,
  onLaunch,
}: {
  decks: DeckDef[];
  /** Resolves each deck's meta instance ids back to cardIds for display, and translates the
   *  chosen deck into a run's cardId deck via `buildRunConfig`. */
  collection: OwnedCards;
  mapProgress: Record<string, true>;
  /** Board stickers attached per board — the launch popup's board picker shows the *effective*
   *  profile, and `buildRunConfig` snapshots the chosen board's stickers into the `RunConfig`. */
  boardStickers: BoardStickers;
  /** Whole-UI scale (settings) — converts pointer-drag deltas (visual px) to scroll px. */
  uiScale: number;
  onLaunch: (config: RunConfig) => void;
}) {
  // 'infinite' missions have no map position and never appear as a timeline node —
  // they're always available, so they live in the bottom banner instead (rendered below).
  const missions = Object.values(MISSIONS).filter((m) => m.kind !== 'infinite');
  const infiniteMissions = Object.values(MISSIONS).filter((m) => m.kind === 'infinite');
  const maxCol = missions.reduce((m, x) => Math.max(m, x.map!.col), 0);
  const maxRow = missions.reduce((m, x) => Math.max(m, x.map!.row), 0);
  const timelineWidth = PAD_X * 2 + maxCol * COL_W + NODE_W;
  const nodeAreaHeight = PAD_Y * 2 + maxRow * ROW_H + NODE_H;

  // Each age covers its slice of the DAG: its band + wash span exactly the columns its missions
  // occupy, derived from those missions' `map.col` (`content/ages.ts`'s `ageColSpans`). With no
  // standard missions placed yet, this is `[]` — the map renders no bands (the dormant state).
  const spans = ageColSpans(missions);
  // px left edge of a column on the same grid the nodes use, so bands align over their columns.
  const colX = (col: number) => PAD_X + col * COL_W;

  // The node area echoes the age bands' colors as a horizontal wash: each age holds its pure color
  // solid across its slice of the width and blends into the next only over a short strip around each
  // boundary (`AGE_BLEND` = the transition half-width, %). Boundaries sit at each slice's real column
  // position (as a % of the timeline width), so the wash lines up under the bands. Built off the same
  // `--map-age-*-bg` tokens the bands use, so it stays in step and a fourth age needs only its token.
  // Empty (no missions placed) → a flat fallback tint, since there are no slices to wash.
  let ageBackdrop = 'var(--map-age-bg)';
  if (spans.length > 0) {
    const pct = (col: number) => (100 * colX(col)) / timelineWidth;
    const stops = [`var(--map-age-${spans[0].age.id}-bg) 0%`];
    for (let i = 1; i < spans.length; i++) {
      const boundary = pct(spans[i].startCol);
      stops.push(`var(--map-age-${spans[i - 1].age.id}-bg) ${(boundary - AGE_BLEND).toFixed(2)}%`);
      stops.push(`var(--map-age-${spans[i].age.id}-bg) ${(boundary + AGE_BLEND).toFixed(2)}%`);
    }
    stops.push(`var(--map-age-${spans[spans.length - 1].age.id}-bg) 100%`);
    ageBackdrop = `linear-gradient(to right, ${stops.join(', ')})`;
  }

  // Two-step launch flow: a node click opens the detail panel (lore, explanation,
  // reward); its "Continue" advances to the board/deck picker. Both steps render inside one
  // persistent popup (see MissionFlowPopup) so the backdrop never unmounts/remounts between
  // them — that remount was the source of a white-flash bug (the backdrop's fade-in replaying
  // from transparent on every mount).
  const [flow, setFlow] = useState<{ mission: MissionDef; step: 'detail' | 'launch' } | null>(null);

  // Drag-to-pan: grabbing empty canvas scrolls it horizontally. Nodes stopPropagation on
  // their own pointerdown so a pan never starts from a node (avoids click/drag ambiguity).
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function beginPan(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas || e.button !== 0) return;
    panRef.current = { startX: e.clientX, startScroll: canvas.scrollLeft };
    canvas.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function movePan(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    const pan = panRef.current;
    if (!canvas || !pan) return;
    // clientX is visual (post-scale) px; scrollLeft is layout px inside the scaled wrapper.
    canvas.scrollLeft = pan.startScroll - (e.clientX - pan.startX) / uiScale;
  }
  function endPan(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (panRef.current && canvas) canvas.releasePointerCapture(e.pointerId);
    panRef.current = null;
    setDragging(false);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Campaign</h1>
      </div>

      <div
        ref={canvasRef}
        className={`${styles.canvas}${dragging ? ` ${styles.dragging}` : ''}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div className={styles.timeline} style={{ width: `${timelineWidth}px` }}>
          {/* One arrow band per age, positioned over its own column slice (`ageColSpans`) rather
              than an equal share — empty until the first age's missions land. */}
          <div className={styles.ageRow}>
            {spans.map(({ age, startCol, endCol }) => (
              <div
                key={age.id}
                className={styles.ageBand}
                data-age={age.id}
                style={{
                  left: `${colX(startCol)}px`,
                  // Clamp the last slice's right edge to the timeline (COL_W > NODE_W overruns it slightly).
                  width: `${Math.min((endCol - startCol) * COL_W, timelineWidth - colX(startCol))}px`,
                }}
              >
                <span className={styles.ageName}>{age.name}</span>
              </div>
            ))}
          </div>

          <div className={styles.nodeArea} style={{ minHeight: `${nodeAreaHeight}px`, background: ageBackdrop }}>
            {/* Edges behind the nodes: a line from each mission to each of its prereqs. */}
            <svg className={styles.edges} width={timelineWidth} height={nodeAreaHeight} aria-hidden="true">
              {missions.flatMap((m) =>
                m.prereqs
                  .filter((pid) => MISSIONS[pid])
                  .map((pid) => {
                    const from = MISSIONS[pid];
                    return (
                      <line
                        key={`${pid}->${m.id}`}
                        className={styles.edge}
                        x1={nodeLeft(from.map!.col) + NODE_W / 2}
                        y1={nodeTop(from.map!.row) + NODE_H / 2}
                        x2={nodeLeft(m.map!.col) + NODE_W / 2}
                        y2={nodeTop(m.map!.row) + NODE_H / 2}
                      />
                    );
                  }),
              )}
            </svg>

            {missions.map((m) => {
              const cleared = isCompleted(mapProgress, m.id);
              const available = isAvailable(m, mapProgress);
              const locked = !available;
              const state = cleared ? 'cleared' : available ? 'available' : 'locked';
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.node} ${styles[state]}`}
                  style={{ left: `${nodeLeft(m.map!.col)}px`, top: `${nodeTop(m.map!.row)}px`, width: `${NODE_W}px` }}
                  disabled={locked}
                  title={locked ? 'Complete its prerequisite to reveal this.' : undefined}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => !locked && setFlow({ mission: m, step: 'detail' })}
                >
                  <span className={styles.nodeGlyph} aria-hidden="true">
                    {cleared ? '✓' : locked ? '🔒' : '▶'}
                  </span>
                  <span className={styles.nodeName}>{locked ? '???' : m.name}</span>
                  <span className={styles.nodeState}>
                    {cleared ? 'Cleared' : locked ? 'Locked' : 'Available'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 'infinite' missions never gate on prereqs and are never cleared/locked — they're
          always available, so they get their own row rather than a timeline node. A `flex: 0 0
          auto` sibling of .canvas (mirroring .header), never `position: fixed` — the app's
          transform:scale() wrapper breaks viewport-fixed positioning (see CLAUDE.md's UI-scaling
          invariants), which is why the map itself scrolls inside .canvas instead. */}
      {infiniteMissions.length > 0 && (
        <div className={styles.infiniteBanner}>
          {infiniteMissions.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.infiniteNode}
              onClick={() => setFlow({ mission: m, step: 'detail' })}
            >
              <span className={styles.nodeGlyph} aria-hidden="true">♾️</span>
              <span className={styles.infiniteNodeText}>
                <span className={styles.nodeName}>{m.name}</span>
                <span className={styles.nodeState}>Always available</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {flow && (
        <MissionFlowPopup
          key={flow.mission.id}
          mission={flow.mission}
          step={flow.step}
          alreadyCleared={isCompleted(mapProgress, flow.mission.id)}
          decks={decks}
          collection={collection}
          boardStickers={boardStickers}
          onCancel={() => setFlow(null)}
          onContinue={() => setFlow({ mission: flow.mission, step: 'launch' })}
          onLaunch={onLaunch}
        />
      )}
    </div>
  );
}

/**
 * The launch flow's popup — one persistent `styles.popupBackdrop`/`styles.popup` shell shared by
 * both steps ('detail' then 'launch'), so advancing via "Continue" only swaps the inner content,
 * never unmounts/remounts the backdrop. (An earlier version rendered the two steps as separate
 * components, each with its own backdrop; the backdrop's mount-time `fadeIn` animation replaying
 * from `opacity: 0` on that remount caused a visible white flash between steps.)
 *
 * **Detail step** — lore, the mechanical explanation (objective/failure hints), and a reward
 * preview. A `'standard'` mission shows its Influence (struck through once already claimed; hidden
 * entirely when the mission grants none) and the
 * unlock — the real card face once cleared (under a "Cards already unlocked" subtitle), or
 * `CardFace`'s `missionLocked` mode beforehand (the real `unlockCard` passed in, but rendered
 * blank but for its name — a deliberate sliver of information, since which card a mission grants
 * otherwise stays a surprise until it's actually cleared; see `rules/rewards.ts`). An `'infinite'`
 * mission has neither a fixed Influence amount nor an unlock — it scores rounds survived every
 * attempt — so it gets its own short "Influence" / "No Unlock" reward line instead.
 *
 * **Launch step** — a board picker on the left, a deck picker on the right (lore/reward already
 * shown in the detail step). Nothing is pre-selected; "Start Mission" stays disabled until the
 * player has chosen both. Clicking an unselected deck selects it; clicking the already-selected
 * deck opens its list-view (`DeckListOverlay`, no edit/copy/delete).
 */
function MissionFlowPopup({
  mission,
  step,
  alreadyCleared,
  decks,
  collection,
  boardStickers,
  onCancel,
  onContinue,
  onLaunch,
}: {
  mission: MissionDef;
  step: 'detail' | 'launch';
  alreadyCleared: boolean;
  decks: DeckDef[];
  collection: OwnedCards;
  boardStickers: BoardStickers;
  onCancel: () => void;
  onContinue: () => void;
  onLaunch: (config: RunConfig) => void;
}) {
  const infinite = mission.kind === 'infinite';
  const unlockCards = mission.reward ? mission.reward.unlockCardIds.map((id) => CARDS[id]) : [];
  // The cards this mission is actually about: its objective (always exactly one) plus whichever
  // threat/event cards it seeds — read straight off the same declarative `threats`/`events` lists
  // `setup` injects from (see `content/missions.ts`), so this can't drift from what a launched run
  // actually sees. Grouped by cardId since `events`/`threats` may repeat an id for multiple copies
  // (e.g. repeated event entries for a mission's several waves) — one face per distinct card,
  // with a ×N badge standing in for the repeats instead of silently collapsing them.
  const seededCardCounts = new Map<string, number>();
  for (const cardId of [...(mission.threats ?? []), ...(mission.events ?? [])]) {
    seededCardCounts.set(cardId, (seededCardCounts.get(cardId) ?? 0) + 1);
  }

  const [boardId, setBoardId] = useState<BoardId | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  // The deck whose list-view overlay is open (opened by re-clicking the selected deck).
  const [viewing, setViewing] = useState<DeckDef | null>(null);
  // The card zoomed via click — the reward (only once already unlocked; a face-down card has
  // nothing to reveal) or one of the objective/threat/event cards below the lore text.
  const [zoomCardId, setZoomCardId] = useState<string | null>(null);

  const canStart = boardId !== null && deckId !== null;
  const boardName = boardId ? BOARDS[boardId].name : null;
  const deckName = deckId ? (decks.find((d) => d.id === deckId)?.name ?? null) : null;

  function start() {
    if (!boardId || !deckId) return;
    onLaunch(buildRunConfig({ missionId: mission.id, boardId, deckId }, crypto.randomUUID(), decks, collection, boardStickers));
  }

  return (
    <>
      <div className={styles.popupBackdrop} onClick={onCancel} role="dialog" aria-modal="true">
        <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
          <div className={styles.popupHeader}>
            <h2 className={styles.popupTitle}>{mission.name}</h2>
            {step === 'launch' && (
              <div className={styles.headerIndicators}>
                <span className={`${styles.token}${boardId ? ` ${styles.tokenDone}` : ''}`}>
                  <span className={styles.tokenBox} aria-hidden="true">▦</span>
                  <span className={styles.tokenLabel} title={boardName ?? undefined}>
                    {boardName ?? 'Government'}
                  </span>
                </span>
                <span className={`${styles.token}${deckId ? ` ${styles.tokenDone}` : ''}`}>
                  <span className={styles.tokenBox} aria-hidden="true">🂠</span>
                  <span className={styles.tokenLabel} title={deckName ?? undefined}>
                    {deckName ?? 'Deck'}
                  </span>
                </span>
              </div>
            )}
            {step === 'detail' ? (
              <button type="button" className={styles.startBtn} onClick={onContinue}>
                Continue
              </button>
            ) : (
              <button type="button" className={styles.startBtn} onClick={start} disabled={!canStart}>
                Start Mission
              </button>
            )}
          </div>

          <div className={styles.popupBody}>
            {step === 'detail' ? (
              <div className={styles.detailBody}>
                <div className={styles.loreColumn}>
                  <p className={styles.loreText}>{mission.lore}</p>
                  <p className={styles.popupHints}>
                    🏆 {mission.victoryHint}
                    {mission.failureHint && (
                      <>
                        <br />
                        💀 {mission.failureHint}
                      </>
                    )}
                  </p>
                  <div className={styles.loreCards}>
                    <CardFace
                      card={CARDS[mission.objectiveCardId]}
                      className={styles.zoomableCard}
                      onClick={() => setZoomCardId(mission.objectiveCardId)}
                    />
                    {Array.from(seededCardCounts, ([cardId, count]) => (
                      <CardFace
                        key={cardId}
                        card={CARDS[cardId]}
                        className={styles.zoomableCard}
                        countBadge={count}
                        onClick={() => setZoomCardId(cardId)}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.rewardColumn}>
                  <h3 className={styles.pickerTitle}>Reward</h3>
                  {infinite ? (
                    <>
                      <p className={styles.rewardInfluence}>⭐ Influence</p>
                      <span className={styles.rewardSubtitle}>No Unlock</span>
                    </>
                  ) : (
                    <>
                      {mission.reward!.influence > 0 && (
                        <p className={`${styles.rewardInfluence}${alreadyCleared ? ` ${styles.struckOut}` : ''}`}>
                          +{mission.reward!.influence} ⭐ Influence
                        </p>
                      )}
                      <span className={styles.rewardSubtitle}>
                        {alreadyCleared
                          ? 'Cards already unlocked'
                          : `${unlockCards.length} new card${unlockCards.length === 1 ? '' : 's'}`}
                      </span>
                      <div className={styles.rewardCards}>
                        {unlockCards.map((card) =>
                          alreadyCleared ? (
                            <CardFace
                              key={card.id}
                              card={card}
                              className={styles.zoomableCard}
                              onClick={() => setZoomCardId(card.id)}
                            />
                          ) : (
                            <CardFace key={card.id} card={card} missionLocked />
                          ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.pickers}>
                <section className={styles.picker}>
                  <h3 className={styles.pickerTitle}>Government</h3>
                  <div className={styles.boardList}>
                    {BOARD_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.optionCard}${boardId === id ? ` ${styles.selected}` : ''}`}
                        aria-pressed={boardId === id}
                        onClick={() => setBoardId(id)}
                      >
                        <BoardMini boardId={id} stickerIds={boardStickers[id]} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.picker}>
                  <h3 className={styles.pickerTitle}>Deck</h3>
                  {decks.length === 0 ? (
                    <p className={styles.detail}>No decks yet — build one in the Decks tab.</p>
                  ) : (
                    <div className={styles.deckList}>
                      {decks.map((d) => (
                        <DeckTile
                          key={d.id}
                          deck={d}
                          collection={collection}
                          selected={deckId === d.id}
                          title={deckId === d.id ? "Click to view this deck's cards" : 'Click to select this deck'}
                          onClick={() => (deckId === d.id ? setViewing(d) : setDeckId(d.id))}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewing && <DeckListOverlay deck={viewing} collection={collection} onClose={() => setViewing(null)} />}
      <CardZoomOverlay cardId={zoomCardId} onClose={() => setZoomCardId(null)} />
    </>
  );
}
