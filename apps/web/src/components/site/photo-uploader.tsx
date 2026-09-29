'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'motion/react';
import { toast } from 'sonner';
import { GripVertical, ImagePlus, Loader2, Orbit, Star, Trash2 } from 'lucide-react';
import { compressImage, uploadFile, ApiError } from '@/lib/api';
import { cn, img } from '@/lib/utils';
import { IntegrationBanner } from '../ui/api-error';

export interface Photo {
  url: string;
  caption?: string | null;
  publicId?: string | null;
  /** PANORAMA = 360° (equirectangular) photo, opened in the 360 viewer. */
  kind?: 'PHOTO' | 'PANORAMA';
}

export function PhotoUploader({ value, onChange, max = 25, kind = 'listing' }: { value: Photo[]; onChange: (v: Photo[]) => void; max?: number; kind?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ id: string; pct: number; preview: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const [notConfigured, setNotConfigured] = useState<ApiError | null>(null);

  const handle = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, max - value.length);
    if (!list.length) return;
    let acc = [...value];
    await Promise.all(
      list.map(async (file) => {
        const id = Math.random().toString(36).slice(2);
        const preview = URL.createObjectURL(file);
        setUploading((u) => [...u, { id, pct: 0, preview }]);
        try {
          const blob = await compressImage(file);
          const res = await uploadFile(blob, kind, (pct) => setUploading((u) => u.map((x) => (x.id === id ? { ...x, pct } : x))));
          acc = [...acc, { url: res.url, publicId: res.publicId }];
          onChange(acc);
        } catch (e) {
          if (e instanceof ApiError && e.isNotConfigured) setNotConfigured(e);
          else toast.error(`${file.name}: ${(e as Error).message}`);
        } finally {
          setUploading((u) => u.filter((x) => x.id !== id));
          URL.revokeObjectURL(preview);
        }
      }),
    );
  };

  return (
    <div>
      {notConfigured?.body.integration && <div className="mb-4"><IntegrationBanner name={notConfigured.body.integration.name} message={notConfigured.body.message} /></div>}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-line hover:border-brand-300 hover:bg-surface-2')}
      >
        <motion.div animate={drag ? { scale: 1.1, rotate: -6 } : { scale: 1, rotate: 0 }} className="grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
          <ImagePlus className="size-7" />
        </motion.div>
        <p className="mt-3 font-semibold">Photos यहाँ drag करें या click करके चुनें</p>
        <p className="text-sm text-muted">JPG / PNG · ज़्यादा से ज़्यादा {max} · अच्छी रोशनी वाली photos ज़्यादा enquiries लाती हैं</p>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handle(e.target.files)} />
      </div>

      {(value.length > 0 || uploading.length > 0) && (
        <Reorder.Group axis="x" values={value} onReorder={onChange} className="mt-4 flex flex-wrap gap-3">
          <AnimatePresence>
            {value.map((p, i) => (
              <Reorder.Item key={p.url} value={p} className="group relative size-32 cursor-grab overflow-hidden rounded-xl border border-line bg-surface-2 active:cursor-grabbing" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(p.url, 300)} alt="" className="pointer-events-none h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-saffron-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                    <Star className="size-3" /> Cover
                  </span>
                )}
                <GripVertical className="absolute top-1.5 right-1.5 size-4 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                <button
                  type="button"
                  onClick={() => onChange(value.map((x) => (x.url === p.url ? { ...x, kind: x.kind === 'PANORAMA' ? 'PHOTO' : 'PANORAMA' } : x)))}
                  className={cn('absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold transition', p.kind === 'PANORAMA' ? 'bg-brand-600 text-white' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100')}
                  title="360° photo है? निशान लगाएँ"
                >
                  <Orbit className="size-3" /> 360°
                </button>
                <button type="button" onClick={() => onChange(value.filter((x) => x.url !== p.url))} className="absolute right-1.5 bottom-1.5 grid size-7 place-items-center rounded-lg bg-rose-600 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                  <Trash2 className="size-3.5" />
                </button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
          {uploading.map((u) => (
            <div key={u.id} className="relative size-32 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.preview} alt="" className="h-full w-full object-cover opacity-50" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-1 text-xs font-bold">
                  <Loader2 className="size-5 animate-spin text-brand-600" /> {u.pct}%
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-2">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </Reorder.Group>
      )}
      {value.length > 1 && <p className="mt-2 text-xs text-subtle">Drag करके order बदलें — पहली photo cover बनेगी। 360° camera वाली photo पर "360°" दबाएँ।</p>}
    </div>
  );
}
