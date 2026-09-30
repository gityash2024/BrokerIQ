import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { formatPriceShort } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  title?: string;
}

/**
 * Leaflet map inside a WebView — works in Expo Go and release builds without a
 * native Google Maps key. Uses MapTiler tiles when the admin configured a key,
 * otherwise OpenStreetMap.
 */
export function MapView({
  points,
  center,
  zoom = 12,
  height = 260,
  onPick,
  radiusKm,
}: {
  points: MapPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number | '100%';
  onPick?: (id: string) => void;
  radiusKm?: number;
}) {
  const { integrations } = useConfig();
  const { isDark } = useTheme();
  const mt = integrations.maptiler as any;
  const tiles =
    mt?.configured && mt.apiKey
      ? `https://api.maptiler.com/maps/${mt.style || 'streets-v2'}${isDark ? '-dark' : ''}/{z}/{x}/{y}.png?key=${mt.apiKey}`
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const c = center ?? (points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: 28.4595, lng: 77.0266 });
  const html = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:${isDark ? '#0B0D17' : '#EEF1F5'}}
.pin{background:#4F46E5;color:#fff;font:700 11px -apple-system,Roboto,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 10px rgba(79,70,229,.45);border:2px solid #fff;transform:translate(-50%,-50%);display:inline-block}
.dot{width:14px;height:14px;border-radius:50%;background:#4F46E5;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}</style></head>
<body><div id="m"></div><script>
var m=L.map('m',{zoomControl:false,attributionControl:false}).setView([${c.lat},${c.lng}],${zoom});
L.tileLayer('${tiles}',{maxZoom:19}).addTo(m);
var pts=${JSON.stringify(points)};var b=[];
pts.forEach(function(p){var ic=p.label?L.divIcon({className:'',html:'<span class="pin">'+p.label+'</span>'}):L.divIcon({className:'',html:'<div class="dot"></div>',iconSize:[14,14]});
var mk=L.marker([p.lat,p.lng],{icon:ic}).addTo(m);b.push([p.lat,p.lng]);
mk.on('click',function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(p.id)});});
${radiusKm ? `L.circle([${c.lat},${c.lng}],{radius:${radiusKm * 1000},color:'#4F46E5',weight:1,fillOpacity:.08}).addTo(m);` : ''}
if(b.length>1)m.fitBounds(b,{padding:[40,40],maxZoom:15});
</script></body></html>`,
    [points, c.lat, c.lng, zoom, tiles, isDark, radiusKm],
  );
  return (
    <View style={{ height, borderRadius: height === '100%' ? 0 : 20, overflow: 'hidden' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(e) => onPick?.(e.nativeEvent.data)}
        scrollEnabled={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}

export const toPoints = (items: { id: string; latitude?: number | null; longitude?: number | null; price: number; title?: string }[]): MapPoint[] =>
  items
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ id: l.id, lat: l.latitude!, lng: l.longitude!, label: formatPriceShort(l.price), title: l.title }));
