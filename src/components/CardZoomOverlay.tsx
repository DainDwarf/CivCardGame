import { useEffect, useRef, useState } from 'react';
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
  // "Pet the dog": clicking the Dogs card's art band puffs floating *pet* text + a woof! bubble
  // instead of closing. Each pet self-removes on a timer; timers are tracked so a mid-animation
  // close leaves none dangling.
  const wrapRef = useRef<HTMLDivElement>(null);
  const nextPetId = useRef(0);
  const timers = useRef<number[]>([]);
  const [pets, setPets] = useState<{ id: number; x: number; y: number }[]>([]);
  const [woof, setWoof] = useState<number | null>(null);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  if (!cardId) return null;

  const petable = cardId === 'dogs';

  const petTheDog = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation(); // don't fall through to the backdrop's close
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const id = nextPetId.current++;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPets((ps) => [...ps, { id, x, y }]);
    timers.current.push(window.setTimeout(() => setPets((ps) => ps.filter((p) => p.id !== id)), 1000));

    const woofId = nextPetId.current++;
    setWoof(woofId);
    timers.current.push(window.setTimeout(() => setWoof((w) => (w === woofId ? null : w)), 900));
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.wrap} ref={wrapRef}>
        <CardFace
          card={overrideCard ?? CARDS[cardId]}
          overrideText={overrideText}
          stickerBadge={stickerBadge}
          className={styles.card}
          onArtClick={petable ? petTheDog : undefined}
        />
        {woof !== null && (
          <div key={woof} className={styles.woof} aria-hidden="true">
            woof!
          </div>
        )}
        {pets.map((p) => (
          <div
            key={p.id}
            className={styles.pet}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-hidden="true"
          >
            *pet* *pet*
          </div>
        ))}
      </div>
      <p className={styles.hint}>Click anywhere to close</p>
    </div>
  );
}
