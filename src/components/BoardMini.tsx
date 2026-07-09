import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';
import { effectiveBoard } from '../rules/boardStickers';
import { RESOURCE_ICON } from '../meta/boardDisplay';
import { StickerRow } from './CardFace';
import type { Resources } from '../rules/resources';
import styles from './BoardMini.module.css';

/**
 * The miniature board widget — a read-only, board-agnostic "here's what this board starts you
 * with" picture, rendering a government board as the run loop in miniature (tinted ground · a
 * top banner of starting counters · the territory slot grid). Purely presentational: it takes a
 * board id (+ that board's attached sticker ids), reads nothing from `GameContext`, and holds no
 * game logic, moves, or drag handlers — so it's reusable across meta screens (the Board menu now,
 * mission-select later). Its numbers come from `effectiveBoard` (the single sticker fold that
 * `run/setup.ts` also seeds off), so they match exactly what a launched run will start with.
 */
export function BoardMini({
  boardId,
  stickerIds,
  openSlots = 0,
  className,
}: {
  boardId: BoardId;
  /** The board's attached sticker ids — folded into the displayed profile via `effectiveBoard`. */
  stickerIds?: string[];
  /** Empty gold-outlined placeholder slots shown after the attached sticker badges — the Board
   *  menu's buyable-hint affordance (a board's remaining capacity). Defaults to 0 elsewhere. */
  openSlots?: number;
  className?: string;
}) {
  const b = effectiveBoard(BOARDS[boardId], stickerIds);
  // The 5 core resources in the run board's banner order — all shown, including zeros, so the
  // layout stays stable across boards (unlike the text profile, which hid zeros).
  const coreOrder: (keyof Resources)[] = ['food', 'production', 'money', 'military', 'science'];
  // Individual worker tokens read clearly up to a point; past it, compact to "🧍 ×N" (a board
  // sticker could raise population well past a legible token row).
  const POP_TOKEN_LIMIT = 6;

  const board = BOARDS[boardId];

  return (
    <div className={`${styles.mini}${className ? ` ${className}` : ''}`}>
      <div className={styles.ground} data-board={boardId} />

      <div className={styles.nameLabel}>{board.name}</div>

      <div className={styles.banner}>
        <div className={styles.populationTray}>
          {b.population > POP_TOKEN_LIMIT ? (
            <span className={styles.popCompact} aria-label={`Population ${b.population}`}>
              🧍 ×{b.population}
            </span>
          ) : (
            <span className={styles.popTokens} aria-label={`Population ${b.population}`}>
              {Array.from({ length: b.population }, (_, i) => (
                <span key={i} aria-hidden="true">🧍</span>
              ))}
            </span>
          )}
        </div>

        <div className={styles.coreGroup}>
          {coreOrder.map((k) => (
            <span key={k} className={styles.stat}>
              <span aria-hidden="true">{RESOURCE_ICON[k]}</span> {b.resources[k]}
            </span>
          ))}
        </div>

        <div className={styles.culture}>🎭 {b.culture}</div>
      </div>

      <div className={styles.slotGrid}>
        {Array.from({ length: b.territory }, (_, i) => (
          <div key={i} className={styles.slotEmpty} />
        ))}
      </div>

      <StickerRow
        items={(stickerIds ?? []).map((id) => ({
          icon: BOARD_STICKERS[id]?.icon ?? '🏷️',
          name: BOARD_STICKERS[id]?.name,
        }))}
        openSlots={openSlots}
      />
    </div>
  );
}
