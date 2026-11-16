'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { requestActivity } from '@/lib/api';

export function RequestLoader() {
  const pending = useSyncExternalStore(requestActivity.subscribe, requestActivity.getSnapshot, () => 0);
  const busy = pending > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 140);
    return () => window.clearTimeout(timer);
  }, [busy]);
  return visible && busy ? (
    <div role="progressbar" aria-label="Loading" className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden bg-brand-600/15">
      <div className="biq-request-progress" />
    </div>
  ) : null;
}

export function LoadingArtwork() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-[40vh] place-items-center px-5 py-8">
      <div className="flex w-40 flex-col items-center gap-3">
        <img src="/product/loading-property.webp" alt="" width={144} height={96} />
        <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-brand-600/15">
          <div className="biq-request-progress" />
        </div>
        <span className="text-sm font-medium text-muted">Loading…</span>
      </div>
    </div>
  );
}
