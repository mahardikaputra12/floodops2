import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const COLOR = { tinggi: '#e5484d', menengah: '#f59e0b', rendah: '#2f80ed', none: '#94a3b8' };
const FAC = {
  rumah_sakit: ['#e5484d', 'M12 7v10M7 12h10', 'Rumah sakit'], puskesmas: ['#2f80ed', 'M12 7v10M7 12h10', 'Puskesmas'],
  sekolah: ['#8b5cf6', 'M5 6.5c3-1 5-.5 7 1.5 2-2 4-2.5 7-1.5v11c-3-1-5-.5-7 1.5-2-2-4-2.5-7-1.5z', 'Sekolah'], pusat_evakuasi: ['#0e8a8a', 'M5 11l7-6 7 6v8H5z', 'Pusat evakuasi']
};
const svg = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const pin = (bg, d, ring) => L.divIcon({ className: '', html: `<div class="pin" style="background:${bg};${ring ? 'outline:3px solid #e5484d55;' : ''}">${svg(d)}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

// Peta Leaflet + OpenStreetMap. Ruas diwarnai menurut kategori prioritas; mode simulasi menambah ruas ditutup,
// ruas terendam yang dihindari, serta rute sebelum/sesudah hasil Dijkstra.
export default function MapView({ net, ranked = [], selected, onSelect, closed, avoided = [], lostFacilities = [], routes = [], marks = [], sim = false }) {
  const el = useRef(), map = useRef(), layer = useRef(), fitted = useRef(false);
  useEffect(() => {
    map.current = L.map(el.current).setView([-6.935, 107.63], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);
  useEffect(() => {
    if (!net) return;
    const g = layer.current; g.clearLayers();
    const by = Object.fromEntries(ranked.map((r) => [r.segment_id, r])), pts = [], ll = (id) => [net.nodes[id].lat, net.nodes[id].lng];
    net.segments.forEach((s) => {
      const r = by[s.id], isClosed = closed === s.id, isAv = avoided.includes(s.id), pair = [ll(s.a), ll(s.b)]; pts.push(...pair);
      const line = L.polyline(pair, { color: isClosed ? '#111827' : isAv ? '#7f1d1d' : COLOR[r?.category.key ?? 'none'], weight: isAv ? 6 : r ? 4 + r.depth_score * 2 : 4, opacity: sim && !isClosed && !isAv ? 0.45 : selected === s.id ? 1 : 0.85, dashArray: isClosed ? '2 9' : isAv ? '8 7' : null, lineCap: 'round' }).addTo(g);
      line.bindTooltip(`${s.road_name}${isClosed ? ' (ditutup dalam simulasi)' : isAv ? ' (terendam, dihindari rute pengganti)' : r ? (r.total_score != null ? `, skor ${r.total_score}` : `, ${r.category.label}`) : ', data belum tersedia'}`, { sticky: true });
      line.on('click', () => onSelect?.(s.id));
      if (selected === s.id && !sim) L.polyline(pair, { color: '#fff', weight: 2, dashArray: '1 6', interactive: false }).addTo(g);
      if (isClosed) L.marker([(pair[0][0] + pair[1][0]) / 2, (pair[0][1] + pair[1][1]) / 2], { interactive: false, icon: pin('#111827', 'M7 7l10 10M17 7 7 17') }).addTo(g);
    });
    routes.forEach((r) => { // rute: garis putih sebagai tepi agar terbaca di atas peta
      if (r.kind === 'after') L.polyline(r.coords, { color: '#fff', weight: 11, opacity: 0.9, interactive: false }).addTo(g);
      const pl = L.polyline(r.coords, r.kind === 'after' ? { color: '#2563eb', weight: 7, opacity: 0.95, lineCap: 'round' } : { color: '#475569', weight: 5, opacity: 0.8, dashArray: '1 10', lineCap: 'round' }).addTo(g);
      pl.bindTooltip(r.kind === 'after' ? 'Rute pengganti (Dijkstra)' : 'Rute sebelum penutupan', { sticky: true }); pts.push(...r.coords);
    });
    Object.values(net.nodes).forEach((n) => L.circleMarker([n.lat, n.lng], { radius: n.settlement ? 6 : 4, color: '#fff', weight: 2, fillColor: n.settlement ? '#0e8a8a' : '#475569', fillOpacity: 1 }).bindTooltip(n.name + (n.settlement ? ' (permukiman)' : '')).addTo(g));
    net.facilities.forEach((f, i) => {
      const n = net.nodes[f.node], [c, d, lbl] = FAC[f.facility_type] || ['#555', 'M5 12h14'], lost = lostFacilities.includes(f.id);
      L.marker([n.lat + 0.0022 + (i % 2) * 0.0004, n.lng + 0.0022], { icon: pin(lost ? '#e5484d' : c, d, lost) }).bindTooltip(`${f.facility_name} (${lbl})${lost ? ', akses terputus pada simulasi' : ''}`).addTo(g);
    });
    marks.forEach((m) => L.circleMarker([m.lat, m.lng], { radius: 11, color: m.color, weight: 4, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(m.label, { permanent: true, direction: 'top', offset: [0, -10] }).addTo(g));
    if (!fitted.current && pts.length) { map.current.fitBounds(pts, { padding: [24, 24] }); fitted.current = true; }
  }, [net, ranked, selected, closed, avoided.join(), lostFacilities.join(), routes, marks, sim]);
  const sw = (c, t) => <span key={t}><i style={{ background: c }} />{t}</span>;
  return (<>
    <div ref={el} className="map" />
    <div className="legend">
      {sw(COLOR.tinggi, 'Prioritas tinggi')}{sw(COLOR.menengah, 'Menengah')}{sw(COLOR.rendah, 'Lebih rendah')}{sw(COLOR.none, 'Data belum tersedia')}
      {sim && <>{sw('#2563eb', 'Rute pengganti')}{sw('#475569', 'Rute sebelum penutupan')}{sw('#7f1d1d', 'Ruas terendam (dihindari)')}{sw('#111827', 'Ruas ditutup')}</>}
      {Object.values(FAC).map(([c, , t]) => <span key={t}><i style={{ background: c, height: 10, width: 10 }} />{t}</span>)}
      <span>Garis lebih tebal menunjukkan genangan lebih dalam</span>
    </div></>);
}
