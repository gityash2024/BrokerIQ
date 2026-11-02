import { Button } from '@/ui';
import { LEGACY_DRAFT_REVIEW } from './drafts';
/** New work is explicit; unknown legacy ownership must not become an empty restored form. */
export function LegacyDraftRecovery({ error, onStart }: { error: string; onStart: () => void }) {
  return error === LEGACY_DRAFT_REVIEW ? <Button title="Start a separate draft" variant="secondary" onPress={onStart} /> : null;
}
