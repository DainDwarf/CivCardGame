import type { CodexBlock } from '../content/codex';
import { CodexBlocks } from './CodexBlocks';
import { ModalPrompt } from './ModalPrompt';

/**
 * A one-time onboarding popup: the same `CodexBlock[]` its Codex page draws, at the popup type
 * scale. `App.tsx` owns which one is mounted and when; dismissing it writes the matching
 * `seen…Intro` flag through `persistSettings`, so it is shown once and reopened from the Codex.
 */
export function TutorialPopup({ title, blocks, onDismiss }: { title: string; blocks: CodexBlock[]; onDismiss: () => void }) {
  return (
    <ModalPrompt title={title} buttonLabel="Got it" onDismiss={onDismiss} wide>
      <CodexBlocks blocks={blocks} variant="popup" />
    </ModalPrompt>
  );
}
