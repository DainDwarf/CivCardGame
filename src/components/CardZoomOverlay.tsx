import { CARDS, type CardDef } from '../content/cards';
import { CardFace } from './CardFace';
import styles from './CardZoomOverlay.module.css';

/**
 * A full-screen, dismissable enlargement of a single card — the run loop's own card
 * zoom (`Board.tsx`'s hand/pile-viewer click-to-zoom) lifted out so `Collection.tsx`
 * can reuse the identical backdrop/animation instead of duplicating it.
 */
export function CardZoomOverlay({
  cardId,
  overrideCard,
  overrideText,
  stickerBadge,
  onClose,
}: {
  cardId: string | null;
  /** A stickered instance's true stats (`rules/stickers.ts`'s `effectiveCard`) — passed by callers
   *  with a real instance to read (Board.tsx's run instances; the meta screens' owned/deck-group
   *  instances); absent falls back to the catalogue's plain `CARDS[cardId]`. */
  overrideCard?: CardDef;
  /** A dynamic card's live current-value text (see `CardDisplay.dynamicText`) — passed by callers that
   *  have a real run instance to read (Board.tsx); absent in static contexts (Collection, deck
   *  editor), which fall back to the card's own description. */
  overrideText?: string;
  /** The zoomed instance's attached sticker id(s) (`CardFace`'s bottom-left badge row) —
   *  shown alongside `overrideCard`'s updated numbers, not instead of them. Absent for a plain
   *  copy or a static context with no instance to read. */
  stickerBadge?: string[];
  onClose: () => void;
}) {
  if (!cardId) return null;
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.wrap}>
        <CardFace
          card={overrideCard ?? CARDS[cardId]}
          overrideText={overrideText}
          stickerBadge={stickerBadge}
          className={styles.card}
        />
      </div>
      <p className={styles.hint}>Click anywhere to close</p>
    </div>
  );
}
