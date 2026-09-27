'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Chip, Input } from '../ui/field';
import { LocalityCard } from './cards';
import { Map } from './map';

export function LocalitiesExplorer({ locs }: { locs: any[] }) {
  const [q, setQ] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const zones = useMemo(() => [...new Set(locs.map((l) => l.zone).filter(Boolean))] as string[], [locs]);
  const list = locs.filter((l) => (!zone || l.zone === zone) && (!q || l.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="container-x py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <Input icon={<Search className="size-4" />} placeholder="Sector या locality खोजें" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <Chip active={!zone} onClick={() => setZone(null)}>
              All
            </Chip>
            {zones.map((z) => (
              <Chip key={z} active={zone === z} onClick={() => setZone(z)}>
                {z}
              </Chip>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {list.map((l, i) => (
              <LocalityCard key={l.id} l={l} i={i} />
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="card sticky top-24 h-[640px] overflow-hidden">
            <Map points={list.map((l) => ({ id: l.id, lat: l.latitude, lng: l.longitude, label: l.name, href: `/locality/${l.slug}`, dot: true }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
