'use client';

import { useSyncExternalStore } from 'react';
import { requestActivity } from '@/lib/api';
import { cn } from '@/lib/utils';

export function InlineLoader({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="progressbar" aria-label={label} className={cn('biq-loader-inline inline-flex shrink-0 items-center justify-center', className)}>
      <img src="/product/loading-property.webp" alt="" className="size-full object-contain" width={32} height={22} />
    </span>
  );
}

export function RequestLoader() {
  const visible = useSyncExternalStore(requestActivity.subscribe, requestActivity.getVisibility, () => false);
  return visible ? (
    <div className="pointer-events-none fixed right-3 top-2 z-[9999] flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-2 pr-3 shadow-md">
      <InlineLoader className="h-7 w-10" />
      <span className="sr-only">Loading…</span>
      <span aria-hidden="true" className="h-1 w-12 overflow-hidden rounded-full bg-brand-600/15">
        <span className="biq-request-progress block" />
      </span>
    </div>
  ) : null;
}

export function LoadingArtwork({ className, label = 'Loading' }: { className?: string; label?: string } = {}) {
  return (
    <div className={cn('grid place-items-center overflow-hidden', className || 'h-[40vh] min-h-32 px-5 py-4')}>
      <div className="flex size-full max-w-40 flex-col items-center justify-center gap-1">
        <InlineLoader label={label} className="min-h-0 w-[90%] flex-1 basis-0 max-h-24" />
        <div aria-hidden="true" className="h-1 w-[70%] shrink-0 overflow-hidden rounded-full bg-brand-600/15">
          <div className="biq-request-progress" />
        </div>
      </div>
    </div>
  );
}
