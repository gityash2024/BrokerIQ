export function directoryMapHtml(
  items: { id: string; name: string; latitude: number; longitude: number; sector?: string | null; coordinateSource?: string | null; geometry?: any }[],
  origin: string,
  tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
) {
  const safe = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const base = new URL(origin).origin;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="${base}/map-assets/leaflet.css"><style>html,body,#map{height:100%;margin:0;font:14px system-ui}#notice{position:absolute;top:10px;left:55px;right:10px;z-index:1000;border-radius:8px;background:white;padding:8px;box-shadow:0 1px 5px #0003}button{padding:9px;border:0;border-radius:6px;background:#215d4c;color:white;margin-top:8px}</style></head><body><div id="map"></div><div id="notice">Gurugram · Source locations; colony points are approximate within the recorded boundary.</div><script src="${base}/map-assets/leaflet.js"></script><script>
 const items=${safe(items)},map=L.map('map').setView([28.4595,77.0266],12);
 L.tileLayer(${safe(tileUrl)},{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',referrerPolicy:'strict-origin-when-cross-origin'}).addTo(map);
 const bounds=[];for(const item of items){if(!Number.isFinite(item.latitude)||!Number.isFinite(item.longitude))continue;const point=[item.latitude,item.longitude];bounds.push(point);const node=document.createElement('div');const title=document.createElement('strong');title.textContent=item.name;node.appendChild(title);const text=document.createElement('p');text.textContent=[item.sector,item.coordinateSource].filter(Boolean).join(' · ');node.appendChild(text);const button=document.createElement('button');button.textContent='View source details';button.onclick=()=>{const message=JSON.stringify({type:'directory-select',id:item.id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,${safe(base)});};node.appendChild(button);L.circleMarker(point,{radius:6,color:'#215d4c',fillOpacity:.8}).addTo(map).bindPopup(node);if(item.geometry)L.geoJSON(item.geometry,{style:{color:'#52716a',weight:1,fillOpacity:.06}}).addTo(map);}
 if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:15});else document.getElementById('notice').textContent='No source-backed coordinates match these filters. Use List to see records without map coordinates.';
 </script></body></html>`;
}
