'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assertAccountContext, captureAccountContext, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { img } from '@/lib/utils';
import { shareablePropertyPhotoUrls } from '@brokeriq/shared';

export function PropertyMedia({
  urls,
  onAdd,
  onRemove,
  onUploading,
  video = false,
  disabled = false,
  camera = false,
  agentCoverPhotoUrl,
  onSetAgentCoverPhoto,
  photoLabel = 'Property photos',
}: {
  urls: readonly string[];
  onAdd: (url: string) => void | Promise<void>;
  onRemove?: (index: number) => void;
  onUploading?: (busy: boolean) => void;
  video?: boolean;
  disabled?: boolean;
  camera?: boolean;
  agentCoverPhotoUrl?: string | null;
  onSetAgentCoverPhoto?: (url: string | null) => Promise<void>;
  photoLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [error, setError] = useState('');
  const limit = video ? 10 : 50;
  const noun = video ? 'video' : 'photo';
  const label = video ? 'Property videos' : photoLabel;

  async function selectCover(url: string | null) {
    if (!onSetAgentCoverPhoto || running.current) return;
    running.current = true;
    setSavingCover(true);
    setError('');
    try {
      await onSetAgentCoverPhoto(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setSavingCover(false);
    }
  }

  async function upload(files: File[]) {
    if (!files.length || running.current || disabled) return;
    if (files.length > limit - urls.length) {
      setError(`You can save up to ${limit} ${noun}s per property.`);
      return;
    }
    const owner = captureAccountContext();
    running.current = true;
    setPending(true);
    onUploading?.(true);
    setError('');
    try {
      for (const file of files) {
        if (!file.type.startsWith(video ? 'video/' : 'image/')) throw new Error(`Choose a ${noun} file.`);
        if (file.size > (video ? 100 : 20) * 1024 * 1024) throw new Error(`${file.name} exceeds the ${video ? 100 : 20} MB limit.`);
        const asset = video ? file : await compressImage(file);
        assertAccountContext(owner);
        const { url } = await uploadFile(asset, 'listing');
        assertAccountContext(owner);
        await onAdd(url);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      onUploading?.(false);
      setPending(false);
    }
  }

  return (
    <section aria-label={label} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{label}</h3>
        {urls.length < limit && (
          <>
            {camera && !video && (
              <>
                <Button type="button" variant="secondary" size="sm" disabled={disabled || pending} onClick={() => cameraInput.current?.click()}>
                  Take property photo
                </Button>
                <input
                  ref={cameraInput}
                  aria-label="Take property photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    void upload(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = '';
                  }}
                />
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || savingCover}
              title={disabled ? 'Upload access is unavailable for this property or account' : undefined}
              loading={pending}
              onClick={() => input.current?.click()}
            >
              {video ? <Video className="size-4" /> : <ImagePlus className="size-4" />}
              {pending ? 'Uploading…' : `Upload ${noun}s`}
            </Button>
            <input
              ref={input}
              aria-label={`Select ${noun} files`}
              type="file"
              accept={video ? 'video/*' : 'image/*'}
              hidden
              multiple={!!onRemove}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
                void upload(files);
              }}
            />
          </>
        )}
      </div>
      {!!urls.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl border border-line bg-surface-2">
              {video ? (
                <>
                  <video src={url} controls preload="metadata" className="aspect-video w-full" />
                  <a className="block p-2 text-xs text-brand-600" href={url} target="_blank" rel="noreferrer">
                    Open video {index + 1}
                  </a>
                </>
              ) : (
                <a href={url} target="_blank" rel="noreferrer">
                  <img src={img(url, 480)} loading="lazy" alt={`Property photo ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                </a>
              )}
              {!video && onSetAgentCoverPhoto && shareablePropertyPhotoUrls([url]).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 p-2">
                  {agentCoverPhotoUrl === url && <span className="text-xs font-semibold">Agent cover photo</span>}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending || savingCover}
                    aria-label={agentCoverPhotoUrl === url ? 'Remove agent cover photo' : `Set photo ${index + 1} as agent cover`}
                    onClick={() => void selectCover(agentCoverPhotoUrl === url ? null : url)}
                  >
                    {agentCoverPhotoUrl === url ? 'Remove cover' : 'Set as agent cover'}
                  </Button>
                </div>
              )}
              {onRemove && !disabled && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label={`Remove ${noun} ${index + 1}`}
                  disabled={pending}
                  onClick={() => onRemove(index)}
                  className="absolute right-1 top-1 shadow"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
