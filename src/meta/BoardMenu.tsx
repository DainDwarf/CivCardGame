import { BOARDS, type BoardId } from '../content/boards';
import { BOARD_STICKERS } from '../content/boardStickers';
import { boardStickerAppliesTo, isBoardStickerFull, type BoardStickers } from '../rules/boardStickers';
import { BoardMini } from '../components/BoardMini';
import { BOARD_IDS } from './boardDisplay';
import styles from './BoardMenu.module.css';

/**
 * The Board screen: spend Influence (⭐) on permanent board stickers — modifiers that tweak a
 * board's *starting* profile (`rules/boardStickers.ts`), attached per board on the store's
 * `boardStickers`. A board is singular (no per-copy identity), so — unlike a card sticker — the buy
 * attaches directly (one click), no instance picker. Each board now renders as a `BoardMini`
 * (Step 9.3.2's mini-board, the board counterpart to Collection's real `CardFace`s); the one-click
 * buy `<button>`s remain beneath it as the interim buy surface until Step 9.3.3 replaces them with
 * a drag-drop sticker tray.
 */
export function BoardMenu({
  boardStickers,
  influence,
  onBuyBoardSticker,
}: {
  /** Board stickers attached per board — shows each board's effective profile and hides a
   *  sticker already at the per-board cap. */
  boardStickers: BoardStickers;
  influence: number;
  /** Attach a board sticker to a board — spends Influence and mutates the store's
   *  `boardStickers` (`App.tsx`'s `buyBoardStickerAt`). A board is singular, so this attaches
   *  directly (one click), no per-instance picker. */
  onBuyBoardSticker: (boardId: BoardId, stickerId: string) => void;
}) {
  function boardTile(boardId: BoardId) {
    const board = BOARDS[boardId];
    const attached = boardStickers[boardId] ?? [];
    const full = isBoardStickerFull(attached);
    const applicable = Object.values(BOARD_STICKERS).filter((s) => boardStickerAppliesTo(s, board));
    return (
      <div key={boardId} className={styles.boardTile}>
        <div className={styles.boardHead}>
          <span className={styles.boardName}>{board.name}</span>
          {attached.length > 0 && (
            <span className={styles.boardStickers}>
              {attached.map((sid, i) => (
                <span key={i} title={BOARD_STICKERS[sid]?.name}>
                  {BOARD_STICKERS[sid]?.icon}
                </span>
              ))}
            </span>
          )}
        </div>
        <BoardMini boardId={boardId} stickerIds={attached} />
        <div className={styles.boardBuys}>
          {applicable.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.buyBtn}
              disabled={full || influence < s.cost}
              onClick={() => onBuyBoardSticker(boardId, s.id)}
              title={
                full
                  ? `This board is full (${attached.length}/2 stickers)`
                  : influence >= s.cost
                    ? `Attach ${s.name} (${s.description}) for ${s.cost} Influence`
                    : 'Not enough Influence'
              }
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.cost} → {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.boardMenu}>
      <h1 className={styles.title}>Board</h1>
      <p className={styles.subtitle}>Spend Influence on permanent modifiers for your boards.</p>
      <div className={styles.balance}>
        <span aria-hidden="true">⭐</span>
        {influence} to spend
      </div>

      <div className={styles.boardGrid}>{BOARD_IDS.map(boardTile)}</div>
    </div>
  );
}
