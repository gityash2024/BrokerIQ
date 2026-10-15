'use client';
import { useEffect, useState } from 'react';
import { apiBlob, errorMessage } from '@/lib/api';
export function PrivateSource({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    apiBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
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
  }, [path]);
  return error ? (
    <p className="text-sm text-muted">{error}</p>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Original source entry" className="max-h-[65vh] w-full rounded-xl object-contain" />
    </a>
  ) : (
    <p className="text-sm text-muted">Loading private source…</p>
  );
}
