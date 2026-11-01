// Mesin analisis FloodOps: skor prioritas (PRD 10.1–10.2) dan simulasi penutupan jalan (PRD 10.3).
export const DEFAULT_PARAMS = {
  weights: { depth: 0.4, access: 0.35, alt: 0.25 }, // 40% / 35% / 25%
  staleHours: 24,   // batas kedaluwarsa laporan
  depthLow: 20,     // skala 1: <= 20 cm
  depthMid: 50,     // skala 2: 21–50 cm, skala 3: > 50 cm
  avgSpeedKmh: 30,  // asumsi kecepatan rata-rata untuk estimasi waktu tempuh simulasi
  blockDepth: 60    // genangan di atas batas ini dianggap tidak dapat dilalui oleh rute pengganti
};
export const STATUS = { V: 'terverifikasi', U: 'belum_terverifikasi', X: 'ditolak' };

export const indicatorValue = (scale) => ((scale - 1) / 2) * 100;
export const totalScore = (d, a, l, w) =>
  Math.round((w.depth * indicatorValue(d) + w.access * indicatorValue(a) + w.alt * indicatorValue(l)) * 10) / 10;
export const depthScale = (cm, p) => (cm <= p.depthLow ? 1 : cm <= p.depthMid ? 2 : 3);
export const category = (t) =>
  t >= 70 ? { key: 'tinggi', label: 'Prioritas tinggi', advice: 'Segera ditinjau dan diverifikasi oleh petugas.' }
  : t >= 40 ? { key: 'menengah', label: 'Prioritas menengah', advice: 'Perlu diperiksa dan dipantau.' }
  : { key: 'rendah', label: 'Prioritas lebih rendah', advice: 'Tetap dipantau jika kondisi berubah.' };

// ---------- graf jaringan jalan (simpul = persimpangan, sisi = ruas jalan) ----------
export function shortest(net, src, ban = []) {
  const adj = {}; const dist = {}; const prev = {}; const done = {};
  Object.keys(net.nodes).forEach((k) => { adj[k] = []; dist[k] = Infinity; });
  net.segments.forEach((s) => { if (!ban.includes(s.id)) { adj[s.a].push([s.b, s.road_length, s.id]); adj[s.b].push([s.a, s.road_length, s.id]); } });
  dist[src] = 0;
  for (;;) {
    let u = null;
    for (const k in dist) if (!done[k] && dist[k] < Infinity && (u === null || dist[k] < dist[u])) u = k;
    if (u === null) break;
    done[u] = true;
    for (const [w, c, id] of adj[u]) if (dist[u] + c < dist[w]) { dist[w] = dist[u] + c; prev[w] = [u, id]; }
  }
  return { dist, prev };
}
const settlements = (net) => Object.keys(net.nodes).filter((k) => net.nodes[k].settlement);
function nearest(net, dist) {
  let best = { facility: null, km: Infinity };
  net.facilities.forEach((f) => { if (dist[f.node] < best.km) best = { facility: f, km: dist[f.node] }; });
  return best;
}

// Jumlah jalur pengganti (maks. 2) antara dua ujung ruas setelah ruas dinonaktifkan.
export function alternativeCount(net, seg) {
  let ban = [seg.id], c = 0;
  for (let i = 0; i < 2; i++) {
    const { dist, prev } = shortest(net, seg.a, ban);
    if (dist[seg.b] === Infinity) break;
    c++;
    for (let x = seg.b; x !== seg.a;) { const [p, id] = prev[x]; ban = ban.concat(id); x = p; }
  }
  return c;
}

function pathTo(src, dst, prev) {
  const nodes = [dst], segs = [];
  for (let x = dst; x !== src;) { const [p, id] = prev[x]; segs.unshift(id); nodes.unshift(p); x = p; }
  return { nodes, segs };
}
// Rute terpendek (Dijkstra) dari satu simpul ke fasilitas terdekat; ruas pada `ban` diabaikan.
export function nearestRoute(net, src, ban = []) {
  const { dist, prev } = shortest(net, src, ban);
  let best = null;
  net.facilities.forEach((f) => { if (dist[f.node] < (best ? best.km : Infinity)) best = { facility: f, km: dist[f.node] }; });
  return best ? { ...best, ...pathTo(src, best.facility.node, prev) } : null;
}
// Ruas yang dianggap terendam: laporan aktif terbaru (bukan ditolak) melebihi batas kedalaman.
export function floodedSegments(net, reports, params = DEFAULT_PARAMS) {
  const out = [];
  for (const s of net.segments) {
    const r = reports.filter((x) => x.road_segment_id === s.id && x.verification_status !== STATUS.X).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    if (r && r.reported_depth > params.blockDepth) out.push({ segment_id: s.id, road_name: s.road_name, depth: r.reported_depth });
  }
  return out;
}

// Simulasi: nonaktifkan satu ruas, lalu hitung ulang rute (Dijkstra) dari tiap permukiman ke fasilitas terdekat.
// opts.avoid = ruas lain yang dihindari (terendam); sebelum = kondisi saat ini (avoid saja), sesudah = avoid + ruas ditutup.
export function analyzeClosure(net, seg, opts = {}) {
  const avoid = (opts.avoid || []).filter((id) => id !== seg.id), speed = opts.speed || DEFAULT_PARAMS.avgSpeedKmh;
  const minutes = (km) => Math.round((km / speed) * 600) / 10, lost = [], rows = [];
  for (const s of settlements(net)) {
    const dB = shortest(net, s, avoid).dist, dA = shortest(net, s, [seg.id, ...avoid]).dist;
    net.facilities.forEach((f) => { if (dB[f.node] < Infinity && dA[f.node] === Infinity) lost.push({ settlement: s, settlement_name: net.nodes[s].name, facility_id: f.id, facility_name: f.name }); });
    const b = nearestRoute(net, s, avoid), a = nearestRoute(net, s, [seg.id, ...avoid]);
    const pick = (r) => (r ? { facility: r.facility.name, km: +r.km.toFixed(2), minutes: minutes(r.km) } : null);
    rows.push({
      settlement: s, settlement_name: net.nodes[s].name, before: pick(b), after: pick(a),
      add_km: b && a ? +(a.km - b.km).toFixed(2) : null, add_min: b && a ? +(minutes(a.km) - minutes(b.km)).toFixed(1) : null,
      detour_pct: b && a && b.km > 0 ? Math.round((a.km / b.km - 1) * 100) : null,
      disconnected: !!b && !a, unreachable_before: !b,
      route_before: b ? { nodes: b.nodes, segs: b.segs } : null, route_after: a ? { nodes: a.nodes, segs: a.segs } : null
    });
  }
  const lostFacilityIds = [...new Set(lost.map((l) => l.facility_id))], det = rows.filter((r) => r.add_min != null);
  return {
    segment_id: seg.id, road_name: seg.road_name, label: 'SIMULASI – bukan kondisi nyata',
    speed_kmh: speed, avoid_ids: avoid,
    facilities_total: net.facilities.length, facilities_still_connected: net.facilities.length - lostFacilityIds.length,
    pairs_total: settlements(net).length * net.facilities.length, pairs_lost: lost.length,
    lost_pairs: lost, lost_facility_ids: lostFacilityIds, rows,
    unreachable_before: rows.filter((r) => r.unreachable_before).map((r) => r.settlement_name),
    max_detour_pct: Math.max(0, ...rows.map((r) => r.detour_pct ?? 0)),
    max_add_km: Math.max(0, ...det.map((r) => r.add_km)), max_add_min: Math.max(0, ...det.map((r) => r.add_min)),
    avg_add_min: det.length ? +(det.reduce((t, r) => t + r.add_min, 0) / det.length).toFixed(1) : 0,
    assumptions: [
      'Hasil merupakan perkiraan berdasarkan jaringan dan data yang tersedia, bukan jaminan kondisi lapangan.',
      `Waktu tempuh dihitung dari panjang rute dengan kecepatan rata-rata ${speed} km/jam (asumsi prototipe), tanpa memperhitungkan kemacetan.`,
      'Hanya satu ruas yang ditutup dalam satu simulasi; keterhubungan jalan pada peta tidak menjamin jalan tersebut aman dilalui.'
    ]
  };
}

export function structure(net, seg) {
  const a = analyzeClosure(net, seg), al = alternativeCount(net, seg);
  const access = a.lost_pairs.length ? 3 : a.max_detour_pct > 25 ? 2 : 1;
  const alt = al >= 2 ? 1 : al === 1 ? 2 : 3;
  return { access, alt, closure: a, altCount: al };
}

const isStale = (r, p, now) => now - new Date(r.updated_at).getTime() > p.staleHours * 3600e3;

// ---------- skor prioritas + penjelasan ----------
export function priority(net, reports, params = DEFAULT_PARAMS, now = Date.now()) {
  const ranked = [], noData = [];
  for (const seg of net.segments) {
    const rs = reports.filter((r) => r.road_segment_id === seg.id && r.verification_status !== STATUS.X)
      .sort((x, y) => new Date(y.updated_at) - new Date(x.updated_at));
    const r = rs[0];
    if (!r) { noData.push({ segment_id: seg.id, road_name: seg.road_name }); continue; }
    const st = structure(net, seg), d = depthScale(r.reported_depth, params);
    const total = totalScore(d, st.access, st.alt, params.weights);
    const stale = isStale(r, params, now), reasons = [];
    reasons.push(d === 3 ? `Kedalaman genangan yang dilaporkan cukup tinggi (${r.reported_depth} cm, lebih dari ${params.depthMid} cm).`
      : d === 2 ? `Kedalaman genangan yang dilaporkan tingkat menengah (${r.reported_depth} cm).`
      : `Kedalaman genangan yang dilaporkan rendah (${r.reported_depth} cm).`);
    reasons.push(st.access === 3 ? `Akses menuju fasilitas penting atau permukiman berpotensi terputus: ${[...new Set(st.closure.lost_pairs.map((l) => `${l.settlement_name} ke ${l.facility_name}`))].slice(0, 3).join('; ')}.`
      : st.access === 2 ? `Akses menuju fasilitas penting berpotensi terganggu (rute terdekat memanjang hingga ${st.closure.max_detour_pct}%), tetapi alternatif masih tersedia.`
      : 'Tidak ada gangguan akses penting yang teridentifikasi dalam model.');
    reasons.push(st.alt === 3 ? 'Jalur alternatif tidak ditemukan dalam jaringan yang dianalisis.'
      : st.alt === 2 ? 'Jalur alternatif terbatas dalam jaringan yang dianalisis.' : 'Beberapa jalur alternatif tersedia.');
    if (r.verification_status === STATUS.U) reasons.push('Laporan masih memerlukan verifikasi lapangan.');
    if (stale) reasons.push(`Laporan melewati batas waktu pembaruan (${params.staleHours} jam) dan perlu diperiksa kembali.`);
    ranked.push({
      segment_id: seg.id, road_name: seg.road_name, report_id: r.id, reported_depth: r.reported_depth,
      updated_at: r.updated_at, verification_status: r.verification_status, source_type: r.source_type, stale,
      depth_score: d, facility_impact_score: st.access, alternative_access_score: st.alt,
      values: { depth: indicatorValue(d), access: indicatorValue(st.access), alt: indicatorValue(st.alt) },
      weights: params.weights, total_score: total, category: category(total), reasons,
      affected: [...new Set(st.closure.lost_pairs.map((l) => `${l.settlement_name} ke ${l.facility_name}`))], affected_facility_ids: st.closure.lost_facility_ids,
      calculated_at: new Date(now).toISOString()
    });
  }
  ranked.sort((a, b) => b.total_score - a.total_score);
  return { ranked, noData };
}

// Rekap per wilayah untuk Peneliti / Pengelola Wilayah (evaluasi dampak banjir terhadap aksesibilitas).
export function recap(net, regions, ranked, reports, params = DEFAULT_PARAMS) {
  return regions.map((rg) => {
    const segIds = net.segments.filter((s) => s.region_id === rg.id).map((s) => s.id), items = ranked.filter((x) => segIds.includes(x.segment_id));
    const high = items.filter((x) => x.category.key === 'tinggi'), fac = new Set(high.flatMap((x) => x.affected_facility_ids || []));
    const rep = reports.filter((r) => segIds.includes(r.road_segment_id) && r.verification_status !== STATUS.X);
    return {
      region_id: rg.id, region_name: rg.region_name, risk_level: rg.risk_level, segments_total: segIds.length, segments_with_data: items.length,
      reports_active: rep.length, max_depth: Math.max(0, ...rep.map((r) => r.reported_depth)),
      avg_score: items.length ? Math.round((items.reduce((t, x) => t + x.total_score, 0) / items.length) * 10) / 10 : null,
      high_n: high.length, blocked_n: items.filter((x) => x.reported_depth > params.blockDepth).length,
      facilities_total: net.facilities.filter((f) => f.region_id === rg.id).length, facilities_at_risk: fac.size
    };
  }).sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));
}
