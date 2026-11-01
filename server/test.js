// Pengujian otomatis sesuai PRD bagian 15 (Skenario A, B, C, D, E, F). Jalankan: npm test
import assert from 'node:assert/strict';
import { nodes, segments, facilities, seedReports } from './seed.js';
import { priority, analyzeClosure, totalScore, DEFAULT_PARAMS, indicatorValue, floodedSegments, recap } from './analysis.js';
import { regions } from './seed.js';
const net = { nodes, segments, facilities };
const W = DEFAULT_PARAMS.weights; let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓', name); };

t('Skenario F – 27 kombinasi skala 1–3 sesuai perhitungan manual (integer)', () => {
  for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) {
    const manual = (40 * (a - 1) * 50 + 35 * (b - 1) * 50 + 25 * (c - 1) * 50) / 100;
    assert.equal(totalScore(a, b, c, W), Math.round(manual * 10) / 10);
  }
  assert.equal(totalScore(1, 1, 1, W), 0); assert.equal(totalScore(3, 3, 3, W), 100); assert.equal(indicatorValue(2), 50);
});
t('Skenario A – urutan prioritas menurun dan konsisten dengan rumus', () => {
  const { ranked } = priority(net, seedReports());
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].total_score >= ranked[i].total_score);
  ranked.forEach((r) => assert.equal(r.total_score, totalScore(r.depth_score, r.facility_impact_score, r.alternative_access_score, W)));
});
t('Skenario B/D – Jl. Caringin–Cijerah (ruas 12) memutus akses Cijerah ke seluruh 7 fasilitas', () => {
  const r = analyzeClosure(net, segments.find((s) => s.id === 12));
  assert.equal(r.lost_pairs.filter((l) => l.settlement === 'I').length, 7);
  assert.equal(r.rows.find((x) => x.settlement === 'I').disconnected, true);
});
t('Skenario D – penutupan Jl. Jend. Sudirman (ruas 5) tidak memutus fasilitas apa pun', () => {
  assert.equal(analyzeClosure(net, segments.find((s) => s.id === 5)).lost_pairs.length, 0);
});
t('Skenario C – laporan belum terverifikasi ditandai & disebut dalam alasan', () => {
  const x = priority(net, seedReports()).ranked.find((r) => r.segment_id === 12);
  assert.equal(x.verification_status, 'belum_terverifikasi'); assert.ok(x.reasons.some((s) => s.includes('verifikasi lapangan')));
});
t('Skenario E – laporan melewati batas waktu ditandai kedaluwarsa', () => {
  const x = priority(net, seedReports()).ranked.find((r) => r.segment_id === 15);
  assert.equal(x.stale, true);
});
t('Laporan ditolak tidak dihitung; ruas tanpa laporan = data belum tersedia (bukan nol)', () => {
  const p = priority(net, seedReports());
  assert.ok(!p.ranked.some((r) => r.segment_id === 16)); assert.ok(p.noData.some((r) => r.segment_id === 16));
});
const seg = (id) => segments.find((x) => x.id === id);
const flooded = () => floodedSegments(net, seedReports(), DEFAULT_PARAMS).map((f) => f.segment_id);
t('Simulasi: tambahan jarak dan waktu dari rute Dijkstra (Jl. Rancabolang ditutup: +2,9 km, +5,8 menit pada 30 km/jam)', () => {
  const r = analyzeClosure(net, seg(18), { avoid: flooded(), speed: 30 }), row = r.rows.find((x) => x.settlement === 'O');
  assert.equal(row.add_km, 2.9); assert.equal(row.add_min, 5.8); assert.equal(row.disconnected, false);
  assert.equal(row.after.minutes, Math.round((row.after.km / 30) * 600) / 10); assert.equal(r.max_add_min, 5.8);
});
t('Rute pengganti tidak melewati ruas terendam maupun ruas yang ditutup', () => {
  const avoid = flooded(); assert.deepEqual(avoid.sort((a, b) => a - b), [1, 7, 17]);
  for (const id of [18, 21, 9]) for (const row of analyzeClosure(net, seg(id), { avoid }).rows) if (row.route_after) for (const sid of row.route_after.segs) { assert.ok(!avoid.includes(sid)); assert.notEqual(sid, id); }
});
t('Menghindari ruas terendam mengubah hasil: Jl. Kopo (utara) tidak memutus akses bila ruas terendam diabaikan, tetapi memutus 14 pasangan bila dihindari', () => {
  assert.equal(analyzeClosure(net, seg(9)).pairs_lost, 0); assert.equal(analyzeClosure(net, seg(9), { avoid: flooded() }).pairs_lost, 14);
});
t('Rekap wilayah: seluruh ruas terhitung dan wilayah rawan sesuai data BPBD', () => {
  const rc = recap(net, regions, priority(net, seedReports()).ranked, seedReports());
  assert.equal(rc.reduce((a, r) => a + r.segments_total, 0), segments.length); assert.equal(regions.find((r) => r.region_name === 'Gedebage').risk_level, 'sangat_tinggi');
});
console.log(`\n${pass} kelompok uji lulus.`);
