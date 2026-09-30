'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, LocateFixed, MapPin } from 'lucide-react';
import { api, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { img } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/misc';

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location उपलब्ध नहीं'));
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission दें')), { enableHighAccuracy: true, timeout: 15_000 });
  });

/** Field team: open on-site (phone browser or the app), take a photo — GPS proves the visit. */
export default function VisitVerificationPage() {
  const [near, setNear] = useState<string>('');
  const q = useQuery({ queryKey: ['visit-queue', near], queryFn: () => api<any[]>(`/admin/visit-verification${near ? `?near=${near}` : ''}`) });
  const [busy, setBusy] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  const locate = async () => {
    try {
      const p = await getPosition();
      setNear(`${p.coords.latitude},${p.coords.longitude}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const verify = async (file: File) => {
    if (!target) return;
    setBusy(target);
    try {
      const pos = await getPosition();
      const { url } = await uploadFile(await compressImage(file), 'listing');
      await api(`/admin/listings/${target}/visit-verify`, { method: 'POST', body: { photos: [{ url, lat: pos.coords.latitude, lng: pos.coords.longitude }] } });
      toast.success('✅ Visit verified');
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
      setTarget(null);
    }
  };
  return (
    <>
      <PageHeader
        title="Visit verification"
        subtitle="Property पर पहुँचकर photo लें — GPS से पक्का होता है कि visit सच में हुई (pin से 300 m, pin न हो तो locality से 1.5 km)"
        actions={<Button size="sm" variant="secondary" onClick={locate}><LocateFixed className="size-4" /> मेरे पास वाली</Button>}
      />
      <input ref={pick} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && verify(e.target.files[0])} />
      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : !q.data?.length ? (
        <Empty icon={<MapPin className="size-6" />} title="सब listings verified हैं" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l) => (
            <div key={l.id} className="card overflow-hidden">
              <div className="aspect-[16/9] bg-surface-2">
                {l.coverUrl && (
                   
                  <img src={img(l.coverUrl, 480)} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="space-y-2 p-4">
                <Link href={`/property/${l.slug}`} target="_blank" className="line-clamp-1 font-semibold hover:text-brand-600">{l.title}</Link>
                <p className="text-xs text-muted">{[l.societyName, l.address, l.locality.name].filter(Boolean).join(', ')}{l.km != null ? ` · ${l.km} km दूर` : ''}</p>
                <p className="text-xs text-muted">{l.organization?.name ?? 'Owner'}{l.latitude == null ? ' · map pin नहीं' : ''}</p>
                <div className="flex gap-2">
                  <Button size="sm" loading={busy === l.id} onClick={() => (setTarget(l.id), pick.current?.click())}><Camera className="size-4" /> Photo लेकर verify</Button>
                  <Button size="sm" variant="ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${l.point.lat},${l.point.lng}`} external>Directions</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
