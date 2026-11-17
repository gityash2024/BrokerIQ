import { useEffect, useRef, useState } from 'react';
import { shareablePropertyPhotoUrls } from '@brokeriq/shared';
import { errorMessage } from '@/lib/api';
import { canSharePropertyPhotoFiles, sharePropertyPhotoFiles } from '@/lib/property-photo-share';
import { Button, Txt } from '@/ui';

export function SharePhotoFilesButton({
  urls,
  caption,
  disabled,
  onShareOpened,
}: {
  urls: readonly string[];
  caption?: string;
  disabled?: boolean;
  onShareOpened?: () => void;
}) {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photos = shareablePropertyPhotoUrls(urls);

  useEffect(() => () => active.current?.abort(), []);

  async function share() {
    if (active.current || disabled || !photos.length) return;
    const task = new AbortController();
    active.current = task;
    setBusy(true);
    setError('');
    try {
      await sharePropertyPhotoFiles(photos, task.signal, 'Share property photos', caption);
      if (!task.signal.aborted) onShareOpened?.();
    } catch (cause) {
      if (!task.signal.aborted) setError(errorMessage(cause));
    } finally {
      active.current = null;
      if (!task.signal.aborted) setBusy(false);
    }
  }

  return (
    <>
      <Button
        title={busy ? 'Preparing photos…' : `Share all photos (${photos.length})`}
        variant="secondary"
        loading={busy}
        disabled={disabled || !photos.length || !canSharePropertyPhotoFiles}
        onPress={() => void share()}
      />
      <Txt v="caption" color="muted">
        {canSharePropertyPhotoFiles ? 'Choose WhatsApp or another app, then select the client.' : 'Update the BrokerIQ app to share photo files.'}
      </Txt>
      {!!error && (
        <Txt color="danger" accessibilityRole="alert">
          {error}
        </Txt>
      )}
    </>
  );
}
