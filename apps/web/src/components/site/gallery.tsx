'use client';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, ChevronLeft, ChevronRight, Grid3x3, X } from 'lucide-react';
import { cn, img } from '@/lib/utils';

export function Gallery({ photos, title }: { photos: { url: string; caption?: string | null }[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [dir, setDir] = useState(0);
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length));
    },
    [photos.length],
  );
  useEffect(() => {
    if (open == null) return;
    const k = (e: KeyboardEvent) => (e.key === 'ArrowRight' ? go(1) : e.key === 'ArrowLeft' ? go(-1) : e.key === 'Escape' ? setOpen(null) : null);
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, go]);

  if (!photos.length)
    return (
      <div className="grid aspect-[21/9] place-items-center rounded-3xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-300 dark:from-brand-950 dark:to-surface-2">
        <div className="text-center">
          <Camera className="mx-auto size-12" />
          <p className="mt-2 text-sm font-medium">Photos जल्द ही</p>
        </div>
      </div>
    );

  return (
    <>
      <div className={cn('grid gap-2 overflow-hidden rounded-3xl', photos.length >= 3 ? 'grid-cols-4 grid-rows-2 sm:h-[460px]' : 'grid-cols-1')}>
        {photos.slice(0, 5).map((p, i) => (
          <button
            key={p.url + i}
            onClick={() => setOpen(i)}
            className={cn('group relative overflow-hidden bg-surface-2', photos.length >= 3 ? (i === 0 ? 'col-span-4 row-span-2 aspect-[4/3] sm:col-span-2 sm:aspect-auto' : 'hidden sm:block') : 'aspect-[16/9]')}
          >
            { }
            <img src={img(p.url, i === 0 ? 1400 : 700)} alt={p.caption ?? `${title} photo ${i + 1}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            {i === 4 && photos.length > 5 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-lg font-bold text-white">+{photos.length - 5} more</span>}
          </button>
        ))}
      </div>
      <button onClick={() => setOpen(0)} className="relative z-10 -mt-14 ml-4 inline-flex items-center gap-2 rounded-xl bg-surface/95 px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur">
        <Grid3x3 className="size-4" /> All {photos.length} photos
      </button>
      <AnimatePresence>
        {open != null && (
          <motion.div className="fixed inset-0 z-[80] flex flex-col bg-black/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between p-4 text-white">
              <span className="text-sm font-semibold">
                {open + 1} / {photos.length}
                {photos[open].caption ? ` · ${photos[open].caption}` : ''}
              </span>
              <button onClick={() => setOpen(null)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close">
                <X className="size-6" />
              </button>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.img
                  key={open}
                  src={img(photos[open].url, 2000)}
                  alt=""
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 80 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -dir * 80 }}
                  transition={{ duration: 0.25 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => (info.offset.x < -60 ? go(1) : info.offset.x > 60 ? go(-1) : null)}
                  className="max-h-full max-w-full object-contain select-none"
                />
              </AnimatePresence>
              <button onClick={() => go(-1)} className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous">
                <ChevronLeft className="size-6" />
              </button>
              <button onClick={() => go(1)} className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next">
                <ChevronRight className="size-6" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto p-4 scrollbar-none">
              {photos.map((p, i) => (
                <button key={i} onClick={() => setOpen(i)} className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2', i === open ? 'border-saffron-400' : 'border-transparent opacity-60')}>
                  { }
                  <img src={img(p.url, 200)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
