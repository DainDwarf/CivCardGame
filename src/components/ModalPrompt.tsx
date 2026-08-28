import type { ReactNode } from 'react';
import styles from './ModalPrompt.module.css';

/**
 * The chrome every one-time prompt shares: a scrim over the whole app, a titled panel whose body
 * scrolls inside its own bounded height, and a single dismiss button. There is deliberately no
 * click-outside-to-close — a prompt shown once has to be acknowledged, not swiped past.
 *
 * `wide` is for the tutorial popups, whose text needs a paragraph's measure; the default width
 * suits a short settings prompt.
 */
export function ModalPrompt({
  title,
  buttonLabel,
  onDismiss,
  wide,
  children,
}: {
  title: string;
  buttonLabel: string;
  onDismiss: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={wide ? `${styles.panel} ${styles.panelWide}` : styles.panel}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        <button type="button" className={styles.button} onClick={onDismiss}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
