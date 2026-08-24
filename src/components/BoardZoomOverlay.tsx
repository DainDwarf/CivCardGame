import { BOARDS, type BoardId } from '../content/boards';
import { CARDS } from '../content/cards';
import { BoardMini } from './BoardMini';
import { CardFace } from './CardFace';
import { ZoomOverlay } from './ZoomOverlay';
import styles from './BoardZoomOverlay.module.css';

/**
 * The board counterpart to `CardZoomOverlay`: a government board enlarged past reading size, beside a
 * real `CardFace` for each structure it stands pre-built — which on a tile is an emoji in a slot, so
 * the rule a board is chosen for isn't readable anywhere else. Everything inside is display only: the
 * faces open no further zoom, and the mini takes no `onRemoveSticker`, so the enlargement is never a
 * second place to spend or destroy.
 */
export function BoardZoomOverlay({
  boardId,
  stickerIds,
  onClose,
}: {
  boardId: BoardId | null;
  /** The board's attached sticker ids — folded into the enlarged mini's numbers and shown as badges,
   *  so the zoom reads as the tile it was opened from rather than the bare board. */
  stickerIds?: string[];
  onClose: () => void;
}) {
  if (!boardId) return null;
  const prebuilt = BOARDS[boardId].prebuilt ?? [];

  return (
    <ZoomOverlay onClose={onClose}>
      <div className={styles.row}>
        <div className={styles.enlarged}>
          <BoardMini boardId={boardId} stickerIds={stickerIds} className={styles.mini} />
        </div>
        {prebuilt.length > 0 && (
          <div className={styles.standing}>
            <p className={styles.caption}>Unique building</p>
            <div className={styles.faces}>
              {prebuilt.map((cardId, i) => (
                <div key={i} className={styles.enlargedFace}>
                  <CardFace card={CARDS[cardId]} className={styles.face} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ZoomOverlay>
  );
}
