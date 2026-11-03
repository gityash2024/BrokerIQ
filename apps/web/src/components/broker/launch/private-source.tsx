'use client';
import { useEffect, useState } from 'react';
import { apiBlob, errorMessage } from '@/lib/api';
export function PrivateSource({ path, videoType }: { path: string; videoType?: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    apiBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(videoType ? new Blob([blob], { type: videoType }) : blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, videoType]);
  return error ? (
    <p className="text-sm text-muted">{error}</p>
  ) : url && videoType ? (
    <video controls preload="metadata" src={url} aria-label="Original source video" className="max-h-[55vh] w-full rounded-xl" />
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Original source entry" className="max-h-[65vh] w-full rounded-xl object-contain" />
    </a>
  ) : (
    <p className="text-sm text-muted">Loading private source…</p>
  );
}
