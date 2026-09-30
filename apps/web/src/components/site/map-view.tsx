'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { formatPriceShort } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';

export const GURGAON_CENTER: [number, number] = [28.4595, 77.0266];

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  price?: number;
  label?: string;
  href?: string;
  /** Render as a small dot with hover tooltip instead of a price pill */
  dot?: boolean;
}

function Tiles() {
  const { integrations } = useConfig();
  const mt = integrations.maptiler as any;
  if (mt?.configured && mt.apiKey)
    return (
      <TileLayer
        url={`https://api.maptiler.com/maps/${mt.style || 'streets-v2'}/{z}/{x}/{y}.png?key=${mt.apiKey}`}
        attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OpenStreetMap contributors'
        tileSize={512}
        zoomOffset={-1}
        maxZoom={20}
      />
    );
  return (
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      maxZoom={19}
    />
  );
}

function Bounds({ onBounds }: { onBounds?: (bbox: string) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBounds?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(','));
    },
  });
  return null;
}

function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() < 14 ? 15 : map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

function FitTo({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function MapView({
  points,
  center = GURGAON_CENTER,
  zoom = 12,
  activeId,
  onBounds,
  onSelect,
  fit = true,
  radius,
  className = 'h-full w-full',
  scrollWheelZoom = true,
  onPick,
  recenter,
}: {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  activeId?: string | null;
  onBounds?: (bbox: string) => void;
  onSelect?: (p: MapPoint) => void;
  fit?: boolean;
  radius?: number;
  className?: string;
  scrollWheelZoom?: boolean;
  onPick?: (lat: number, lng: number) => void;
  recenter?: boolean;
}) {
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    for (const p of points) {
      m.set(
        p.id,
        p.dot
          ? L.divIcon({ className: '', html: `<span class="biq-dot"></span>`, iconSize: [0, 0] })
          : L.divIcon({
              className: '',
              html: `<span class="biq-price-pin ${p.id === activeId ? 'active' : ''}">${p.label ?? (p.price ? formatPriceShort(p.price) : '•')}</span>`,
              iconSize: [0, 0],
            }),
      );
    }
    return m;
  }, [points, activeId]);
  return (
    <MapContainer center={center} zoom={zoom} className={className} scrollWheelZoom={scrollWheelZoom} zoomControl>
      <Tiles />
      {fit && <FitTo points={points} />}
      {onBounds && <Bounds onBounds={onBounds} />}
      {onPick && <Picker onPick={onPick} />}
      {recenter && <Recenter center={center} />}
      {radius && <Circle center={center} radius={radius} pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.12, weight: 2 }} />}
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={icons.get(p.id)!}
          zIndexOffset={p.id === activeId ? 1000 : 0}
          eventHandlers={{ click: () => (onSelect ? onSelect(p) : p.href && (window.location.href = p.href)) }}
        >
          {p.dot && p.label ? (
            <Tooltip direction="top" offset={[0, -6]}>
              {p.label}
            </Tooltip>
          ) : null}
        </Marker>
      ))}
    </MapContainer>
  );
}
