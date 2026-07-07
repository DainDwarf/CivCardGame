import { useRef, useState } from 'react';
import { MISSIONS, type MissionDef } from '../content/missions';
import { AGES } from '../content/ages';
import { BOARDS, type BoardId } from '../content/boards';
import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';
import type { Resources } from '../rules/resources';
import type { OwnedCards } from '../rules/collection';
import { buildRunConfig, type RunConfig } from '../contract';
import { isCompleted, isAvailable } from '../rules/campaign';
import { DeckTile, DeckListOverlay } from '../components/DeckDisplay';
import { CardFace } from '../components/CardFace';
import styles from './CampaignMap.module.css';

const BOARD_IDS = Object.keys(BOARDS) as BoardId[];

const RESOURCE_ICON: Record<keyof Resources, string> = {
  food: '🌾',
  production: '🔨',
  science: '🔬',
  military: '⚔️',
  money: '🪙',
};

// --- Map geometry (px, pre-scale — the whole app is scaled by the UI-size wrapper) ---
const NODE_W = 200;
const NODE_H = 108;
const COL_W = 260; // horizontal gap between column origins
const ROW_H = 150; // vertical gap between row origins
const PAD_X = 56;
const PAD_Y = 36;

const nodeLeft = (col: number) => PAD_X + col * COL_W;
const nodeTop = (row: number) => PAD_Y + row * ROW_H;

/** Presentation-only summary of a board's starting profile — all 8 starting values. */
function describeBoard(board: (typeof BOARDS)[BoardId]): string {
  const parts = (Object.entries(board.resources) as [keyof Resources, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}${RESOURCE_ICON[k]}`);
  parts.push(`${board.population}🧍`, `${board.territory} territory`);
  if (board.culture) parts.push(`${board.culture}🎭`);
  return parts.join(' · ');
}

/**
 * The Campaign Map — Phase 3 Step 5.1, replacing the flat `MissionSelect` list. The
 * campaign is humanity's history as a branching tech tree (docs/DESIGN.md): a "long but
 * narrow" horizontal chronology the player scrolls through to orient themselves. Each
 * mission is a node positioned by its authored `map: {col,row}` (`content/missions.ts`),
 * edges are drawn from `prereqs`, and per-node state comes from `rules/campaign.ts`:
 *
 *  - **cleared** (`isCompleted`) — ✓, replayable, opens the launch popup;
 *  - **available** (`isAvailable`, not yet cleared) — opens the launch popup;
 *  - **locked** (prereqs unmet) — a silhouette: position + lock glyph shown, but name /
 *    objective / reward hidden until reachable (a deliberate change from the "unlock is a
 *    surprise" hide-everything precedent — the node's *existence* orients the player in
 *    history, its *identity* stays hidden), and clicking it is inert.
 *
 * Ages (`content/ages.ts`) label ranges of the timeline as right-arrow bands across the
 * top; only a single "Testing" placeholder ships for now. Clicking a cleared/available
 * node opens `MissionDetailPanel` (Step 5.3) first — lore, explanation, and a reward
 * preview; its "Continue" hands off to `LaunchPopup` (board picker left, deck picker
 * right), which assembles the `RunConfig` and calls `onLaunch`. Same props contract as
 * the old `MissionSelect`.
 */
export function CampaignMap({
  decks,
  collection,
  mapProgress,
  uiScale,
  onLaunch,
}: {
  decks: DeckDef[];
  /** Resolves each deck's meta instance ids back to cardIds for display, and translates the
   *  chosen deck into a run's cardId deck via `buildRunConfig` (Phase 3 Step 7.2). */
  collection: OwnedCards;
  mapProgress: Record<string, true>;
  /** Whole-UI scale (settings) — converts pointer-drag deltas (visual px) to scroll px. */
  uiScale: number;
  onLaunch: (config: RunConfig) => void;
}) {
  // 'infinite' missions (Step 6) have no map position and never appear as a timeline node —
  // they're always available, so they live in the bottom banner instead (rendered below).
  const missions = Object.values(MISSIONS).filter((m) => m.kind !== 'infinite');
  const infiniteMissions = Object.values(MISSIONS).filter((m) => m.kind === 'infinite');
  const maxCol = missions.reduce((m, x) => Math.max(m, x.map!.col), 0);
  const maxRow = missions.reduce((m, x) => Math.max(m, x.map!.row), 0);
  const timelineWidth = PAD_X * 2 + maxCol * COL_W + NODE_W;
  const nodeAreaHeight = PAD_Y * 2 + maxRow * ROW_H + NODE_H;

  // Two-step launch flow (Step 5.3): a node click opens the detail panel (lore, explanation,
  // reward); its "Continue" hands off to the board/deck launch popup. Only cleared/available
  // nodes set either.
  const [detail, setDetail] = useState<MissionDef | null>(null);
  const [launching, setLaunching] = useState<MissionDef | null>(null);

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
          <div className={styles.ageRow}>
            {AGES.map((age) => (
              <div key={age.id} className={styles.ageBand}>
                <span className={styles.ageName}>{age.name}</span>
              </div>
            ))}
          </div>

          <div className={styles.nodeArea} style={{ height: `${nodeAreaHeight}px` }}>
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
                  onClick={() => !locked && setDetail(m)}
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
              onClick={() => setDetail(m)}
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

      {detail && (
        <MissionDetailPanel
          mission={detail}
          alreadyCleared={isCompleted(mapProgress, detail.id)}
          onCancel={() => setDetail(null)}
          onContinue={() => {
            setLaunching(detail);
            setDetail(null);
          }}
        />
      )}

      {launching && (
        <LaunchPopup
          mission={launching}
          decks={decks}
          collection={collection}
          onClose={() => setLaunching(null)}
          onLaunch={onLaunch}
        />
      )}
    </div>
  );
}

/**
 * Step 5.3's mission detail panel — the first step of the launch flow, inserted between the
 * map and `LaunchPopup`. Same modal shell/size as `LaunchPopup` (`styles.popup`) so the two
 * steps feel like one flow. Left column is narrative lore plus the mechanical explanation
 * (objective/failure hints); right column is the reward. A `'standard'` mission shows Influence
 * (struck through once already claimed) and the unlock — the real card face once cleared (under
 * a "Cards already unlocked" subtitle), or `CardFace`'s `faceDown` mode beforehand, since which
 * card a mission grants stays a surprise until it's actually cleared (see `rules/rewards.ts`). An
 * `'infinite'` mission (Step 6) has neither a fixed Influence amount nor an unlock — it scores
 * rounds survived every attempt — so it gets its own reward line instead.
 */
function MissionDetailPanel({
  mission,
  alreadyCleared,
  onCancel,
  onContinue,
}: {
  mission: MissionDef;
  alreadyCleared: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const infinite = mission.kind === 'infinite';
  const unlockCard = mission.reward ? CARDS[mission.reward.unlockCardId] : null;
  return (
    <div className={styles.popupBackdrop} onClick={onCancel} role="dialog" aria-modal="true">
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <h2 className={styles.popupTitle}>{mission.name}</h2>
        </div>

        <div className={styles.detailBody}>
          <div className={styles.loreColumn}>
            <p className={styles.loreText}>{mission.lore}</p>
            <p className={styles.popupDesc}>{mission.description}</p>
            <p className={styles.popupHints}>
              🏆 {mission.victoryHint}
              {mission.failureHint && <> · 💀 {mission.failureHint}</>}
            </p>
          </div>

          <div className={styles.rewardColumn}>
            <h3 className={styles.pickerTitle}>Reward</h3>
            {infinite ? (
              <>
                <p className={styles.rewardInfluence}>⭐ Influence = rounds survived</p>
                <span className={styles.rewardSubtitle}>No unlock — paid every attempt</span>
              </>
            ) : (
              <>
                <p className={`${styles.rewardInfluence}${alreadyCleared ? ` ${styles.struckOut}` : ''}`}>
                  +{mission.reward!.influence} ⭐ Influence
                </p>
                <span className={styles.rewardSubtitle}>
                  {alreadyCleared ? 'Cards already unlocked' : '1 new card'}
                </span>
                <div className={styles.rewardCards}>
                  {alreadyCleared ? <CardFace card={unlockCard!} /> : <CardFace faceDown />}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.popupFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.startBtn} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The node launch panel — Step 5.3's second step, reached via `MissionDetailPanel`'s
 * "Continue": a board picker on the left, a deck picker on the right. Lore, explanation, and
 * the reward preview already live in the detail panel, so this step is purely board+deck
 * selection. Nothing is pre-selected; "Start Mission" stays disabled until the player has
 * chosen both. Clicking an unselected deck selects it; clicking the already-selected deck
 * opens its list-view (`DeckListOverlay`, no edit/copy/delete).
 */
function LaunchPopup({
  mission,
  decks,
  collection,
  onClose,
  onLaunch,
}: {
  mission: MissionDef;
  decks: DeckDef[];
  collection: OwnedCards;
  onClose: () => void;
  onLaunch: (config: RunConfig) => void;
}) {
  const [boardId, setBoardId] = useState<BoardId | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  // The deck whose list-view overlay is open (opened by re-clicking the selected deck).
  const [viewing, setViewing] = useState<DeckDef | null>(null);

  const board = boardId ? BOARDS[boardId] : null;
  const canStart = boardId !== null && deckId !== null;

  function start() {
    if (!boardId || !deckId) return;
    onLaunch(buildRunConfig({ missionId: mission.id, boardId, deckId }, crypto.randomUUID(), decks, collection));
  }

  return (
    <>
      <div className={styles.popupBackdrop} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
          <div className={styles.popupHeader}>
            <h2 className={styles.popupTitle}>{mission.name}</h2>
          </div>

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
                    <span className={styles.optionName}>{BOARDS[id].name}</span>
                    <span className={styles.optionDesc}>{BOARDS[id].description}</span>
                  </button>
                ))}
              </div>
              {board && <p className={styles.detail}>{describeBoard(board)}</p>}
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

          <div className={styles.popupFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.startBtn} onClick={start} disabled={!canStart}>
              Start Mission
            </button>
          </div>
        </div>
      </div>

      {viewing && <DeckListOverlay deck={viewing} collection={collection} onClose={() => setViewing(null)} />}
    </>
  );
}
