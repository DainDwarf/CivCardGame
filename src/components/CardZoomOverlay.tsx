import { CARDS } from '../content/cards';
import { CardFace } from './CardFace';
import styles from './CardZoomOverlay.module.css';

/**
 * A full-screen, dismissable enlargement of a single card — the run loop's own card
 * zoom (`Board.tsx`'s hand/pile-viewer click-to-zoom) lifted out so `Collection.tsx`
 * can reuse the identical backdrop/animation instead of duplicating it.
 */
export function CardZoomOverlay({
  cardId,
  onClose,
  hint,
}: {
  cardId: string | null;
  onClose: () => void;
  hint: string;
}) {
  if (!cardId) return null;
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.wrap}>
        <CardFace card={CARDS[cardId]} className={styles.card} />
      </div>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
