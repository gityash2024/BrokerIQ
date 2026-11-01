'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiBlob, errorMessage } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';

/** Authenticated, in-memory preview. Proxy URLs intentionally have no file extension. */
export function KycMedia({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { user } = useAuth();
  const scope = `${user?.id}:${user?.role}:${user?.organization?.id}`;
  const [result, setResult] = useState<{ src: string; scope: string; url: string; type: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setError('');
    setResult(null);
    apiBlob(src)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setResult({ src, scope, url: objectUrl, type: blob.type });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, scope]);
  if (error)
    return (
      <p role="alert" className="p-2 text-xs text-muted">
        {error}
      </p>
    );
  if (!result || result.src !== src || result.scope !== scope) return <p className="p-2 text-xs text-muted">दस्तावेज़ खुल रहा है…</p>;
  return result.type === 'application/pdf' ? (
    <iframe src={result.url} title={alt} className={className || 'h-[65vh] w-full'} />
  ) : (
    <img src={result.url} alt={alt} className={className || 'max-h-[65vh] w-full object-contain'} />
  );
}

export function KycPreviewButton({ src, title, className, children }: { src: string; title: string; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? title}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={title}>
        {open && <KycMedia src={src} alt={title} className="h-[70vh] w-full object-contain" />}
      </Dialog>
    </>
  );
}
