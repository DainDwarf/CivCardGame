import type { ReactNode, Ref } from 'react';
import styles from './ZoomOverlay.module.css';

/**
 * The shell of a full-screen, click-anywhere-to-dismiss enlargement: the scrim, the hint, the
 * arrival animation, the dismiss. What it enlarges is the caller's — `CardZoomOverlay` puts a card
 * inside it, `BoardZoomOverlay` a board — so the two are one gesture by construction rather than by
 * two modules being kept in step.
 */
export function ZoomOverlay({
  onClose,
  className,
  contentRef,
  children,
}: {
  onClose: () => void;
  /** The caller's class on the animated content wrap — where the enlarged thing's footprint is
   *  declared, since this shell reserves none. */
  className?: string;
  /** The content wrap's node, for a caller that positions something against it. */
  contentRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={`${styles.wrap}${className ? ` ${className}` : ''}`} ref={contentRef}>
        {children}
      </div>
      <p className={styles.hint}>Click anywhere to close</p>
    </div>
  );
}
