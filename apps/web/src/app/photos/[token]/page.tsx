'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { LoadingArtwork } from '@/components/ui/request-loader';

export default function PhotoGallery({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [selected, setSelected] = useState(0);
  const gallery = useQuery({
    queryKey: ['public-photo-gallery', token],
    queryFn: () => api<{ caption: string; photos: string[] }>(`/public/photo-galleries/${token}`),
    enabled: /^[a-f0-9]{48}$/.test(token),
  });
  if (!/^[a-f0-9]{48}$/.test(token)) return <p className="p-8">Photo gallery not found.</p>;
  if (gallery.error)
    return (
      <div className="p-8">
        <ApiErrorState error={gallery.error} onRetry={() => gallery.refetch()} />
      </div>
    );
  if (!gallery.data) return <LoadingArtwork className="h-40" label="Loading property photos…" />;
  const photos = gallery.data.photos;
  const index = Math.min(selected, photos.length - 1);
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Property photos</h1>
        <Button variant="secondary" href={`brokeriq://photos/${token}`}>
          Open in BrokerIQ app
        </Button>
      </header>
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-label="Property photo gallery">
        <div
          className="relative grid min-h-72 place-items-center bg-surface-2"
          onTouchStart={(event) => {
            const start = event.touches[0]?.clientX;
            event.currentTarget.dataset.swipeStart = String(start);
          }}
          onTouchEnd={(event) => {
            const start = Number(event.currentTarget.dataset.swipeStart);
            const distance = event.changedTouches[0].clientX - start;
            if (Math.abs(distance) > 50) setSelected(Math.max(0, Math.min(photos.length - 1, index + (distance < 0 ? 1 : -1))));
          }}
        >
          <img
            src={photos[index]}
            alt={`Property photo ${index + 1} of ${photos.length}`}
            className="h-[58vh] min-h-72 w-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <Button variant="secondary" disabled={index === 0} onClick={() => setSelected(index - 1)} aria-label="Previous photo">
            <ArrowLeft className="size-5" />
          </Button>
          <p role="status" className="text-sm">
            {index + 1} / {photos.length}
          </p>
          <Button variant="secondary" disabled={index === photos.length - 1} onClick={() => setSelected(index + 1)} aria-label="Next photo">
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto py-1" aria-label="Photo thumbnails">
        {photos.map((url, position) => (
          <button
            key={url}
            onClick={() => setSelected(position)}
            aria-label={`View photo ${position + 1}`}
            aria-pressed={position === index}
            className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 ${position === index ? 'border-brand-600' : 'border-transparent'}`}
          >
            <img src={url} alt="" loading="lazy" className="size-full object-cover" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
      <p className="whitespace-pre-line rounded-2xl border border-line bg-surface p-5 leading-relaxed">{gallery.data.caption}</p>
    </main>
  );
}
