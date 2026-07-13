import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';
import { effectiveBoard } from '../rules/boardStickers';
import { RESOURCE_ICON } from './CardFace';
import { StickerRow } from './CardFace';
import type { CoreResources } from '../rules/resources';
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
  locked = false,
  upgrade = false,
  className,
}: {
  boardId: BoardId;
  /** The board's attached sticker ids — folded into the displayed profile via `effectiveBoard`. */
  stickerIds?: string[];
  /** Empty gold-outlined placeholder slots shown after the attached sticker badges — the Board
   *  menu's buyable-hint affordance (a board's remaining capacity). Defaults to 0 elsewhere. */
  openSlots?: number;
  /** The board counterpart to `CardFace`'s `missionLocked`: renders the same board silhouette
   *  (tinted ground + name pill + banner shape) greyed out, but withholds every number — the core
   *  resource + culture icons show with no values, a "?" stands in for the population tray, and the
   *  territory area is left blank (its token/slot counts would otherwise leak population + territory). The
   *  pre-clear stand-in for a mission's still-secret board unlock. Sticker/openSlots props are
   *  ignored in this mode, mirroring `missionLocked`. */
  locked?: boolean;
  /** The pre-clear stand-in for a `boardUpgrade` reward: the *current* board with its numbers withheld
   *  (like `locked`) but its real tint kept — a ⬆ in the population slot signals "this board gets
   *  upgraded" without revealing the new stats. Once cleared the preview shows the new board plainly
   *  instead, so this is only ever the still-locked upgrade. */
  upgrade?: boolean;
  className?: string;
}) {
  const board = BOARDS[boardId];
  // The 5 core resources in the run board's banner order — all shown, including zeros, so the
  // layout stays stable across boards (unlike the text profile, which hid zeros). Shared with the
  // locked silhouette, which renders the same icon row with the values withheld.
  const coreOrder: (keyof CoreResources)[] = ['food', 'production', 'money', 'military', 'science'];

  if (locked || upgrade) {
    // The board counterpart to `CardFace`'s `faceDown`: the same banner *shape* so it reads as this
    // board, but every number withheld — the core/culture icons show with no value and the territory
    // area is left blank (its slot count would leak territory). The two withholding modes differ only
    // in the ground and the population stand-in: `locked` greys the ground and shows "?" (the whole
    // board is secret); `upgrade` keeps the real tint and shows a ⬆ (the board is known — only that
    // it's about to improve is the message).
    return (
      <div className={`${styles.mini}${locked ? ` ${styles.locked}` : ''}${className ? ` ${className}` : ''}`}>
        <div className={styles.ground} data-board={boardId} />
        <div className={styles.nameLabel}>{board.name}</div>

        <div className={styles.banner}>
          <div className={styles.populationTray}>
            {upgrade ? (
              <span className={styles.upgradeMark} aria-label="Board upgraded">⬆⬆⬆</span>
            ) : (
              <span className={styles.lockedMark} aria-label="Population hidden">?</span>
            )}
          </div>

          <div className={styles.coreGroup}>
            {coreOrder.map((k) => (
              <span key={k} className={styles.stat}>
                <span aria-hidden="true">{RESOURCE_ICON[k]}</span>
              </span>
            ))}
          </div>

          <div className={styles.culture}>{RESOURCE_ICON.culture}</div>
        </div>

        <div className={styles.lockedSlots} />
      </div>
    );
  }

  const b = effectiveBoard(BOARDS[boardId], stickerIds);
  // Individual worker tokens read clearly up to a point; past it, compact to "🧍 ×N" (a board
  // sticker could raise population well past a legible token row).
  const POP_TOKEN_LIMIT = 6;

  return (
    <div className={`${styles.mini}${className ? ` ${className}` : ''}`}>
      <div className={styles.ground} data-board={boardId} />

      <div className={styles.nameLabel}>{board.name}</div>

      <div className={styles.banner}>
        <div className={styles.populationTray}>
          {b.resources.population > POP_TOKEN_LIMIT ? (
            <span className={styles.popCompact} aria-label={`Population ${b.resources.population}`}>
              🧍 ×{b.resources.population}
            </span>
          ) : (
            <span className={styles.popTokens} aria-label={`Population ${b.resources.population}`}>
              {Array.from({ length: b.resources.population }, (_, i) => (
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

        <div className={styles.culture}>{RESOURCE_ICON.culture} {b.resources.culture}</div>
      </div>

      <div className={styles.slotGrid}>
        {Array.from({ length: b.resources.territory }, (_, i) => (
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
