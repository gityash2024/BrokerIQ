'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, assertAccountContext, captureAccountContext, compressImage, errorMessage, uploadFile } from '@/lib/api';

export function SurveyPhotoAction({ sector, allowed, customFolderId }: { sector?: string; allowed: boolean; customFolderId?: string }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<{
    file: File;
    clientMutationId: string;
    sector?: string;
    customFolderId?: string;
    owner: ReturnType<typeof captureAccountContext>;
    photoUrl?: string;
  } | null>(null);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(file?: File) {
    if (running.current || !allowed) return;
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
        setError('Choose an image smaller than 20 MB.');
        return;
      }
      pending.current = { file, clientMutationId: crypto.randomUUID(), sector, customFolderId, owner: captureAccountContext() };
    }
    const photo = pending.current;
    if (!photo) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      if (!photo.photoUrl) {
        const asset = await compressImage(photo.file);
        assertAccountContext(photo.owner);
        photo.photoUrl = (await uploadFile(asset, 'listing')).url;
      }
      assertAccountContext(photo.owner);
      await api('/inventory/survey-photo', {
        method: 'POST',
        ownerContext: photo.owner,
        body: { clientMutationId: photo.clientMutationId, sector: photo.sector, customFolderId: photo.customFolderId, photoUrl: photo.photoUrl },
      });
      pending.current = null;
      await Promise.all(['inventory-folders', 'inventory-folder-items', 'broker-today'].map((key) => client.invalidateQueries({ queryKey: [key] })));
      toast.success('Photo saved to Survey for review');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" loading={busy} disabled={!allowed} onClick={() => (pending.current ? void save() : input.current?.click())}>
        <ImagePlus className="size-4" /> {pending.current && error ? 'Retry survey photo' : 'Take survey photo'}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Select survey photo"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void save(file);
        }}
      />
      {error && (
        <p role="alert" className="basis-full text-sm text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </>
  );
}
