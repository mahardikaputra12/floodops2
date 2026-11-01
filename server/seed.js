// Data uji SINTETIS/ILUSTRATIF untuk wilayah uji coba Kota Bandung (nama jalan & kecamatan merujuk laporan BPBD).
// Geometri berupa garis lurus antar persimpangan (bukan hasil ekstraksi OpenStreetMap). Ganti dengan data OSM untuk produksi.
import bcrypt from 'bcryptjs';
// Wilayah (kecamatan) – tingkat kerawanan dan penyebab mengacu pada rekap BPBD Kota Bandung 2020–2025.
export const regions = [['Sukajadi', 'sedang', 'Luapan Sungai Citepus / runoff KBU'], ['Cicendo', 'sedang', 'Luapan Sungai Citepus / runoff KBU'], ['Sumur Bandung', 'tinggi', 'Luapan Sungai Cikapundung / tanggul jebol'],
  ['Babakan Ciparay', 'tinggi', 'Kapasitas drainase dan luapan Citepus'], ['Bandung Kulon', 'tinggi', 'Pendangkalan Sungai Cilember'], ['Bojongloa Kaler', 'sedang_tinggi', 'Banjir cileuncang / aliran KBU'],
  ['Bojongloa Kidul', 'belum_dinilai', ''], ['Gedebage', 'sangat_tinggi', 'Luapan Sungai Cikeruh dan topografi rendah'], ['Rancasari', 'sedang_tinggi', 'Limpasan Sungai Citarum dan Cikeruh'], ['Arcamanik', 'sedang_tinggi', 'Limpasan Sungai Citarum dan Cikeruh']]
  .map(([region_name, risk_level, main_cause], i) => ({ id: i + 1, region_name, region_type: 'kecamatan', risk_level, main_cause }));
const rid = (name) => regions.find((r) => r.region_name === name).id;
const n = (name, lat, lng, settlement = false) => ({ name, lat, lng, settlement });
export const nodes = {
  A: n('Pasteur', -6.8940, 107.5960), B: n('Sukajadi', -6.8810, 107.5930), C: n('Braga', -6.9175, 107.6091),
  D: n('Cicendo', -6.9086, 107.5970), E: n('Alun-alun/Merdeka', -6.9218, 107.6070), F: n('Pasirkoja', -6.9230, 107.5780, true),
  G: n('Kopo', -6.9410, 107.5830), H: n('Citarip', -6.9310, 107.5960, true), I: n('Cijerah', -6.9230, 107.5600, true),
  J: n('Sukahaji', -6.9500, 107.5720), K: n('Cibaduyut', -6.9660, 107.5890, true), L: n('Margacinta', -6.9500, 107.6450),
  M: n('Gedebage', -6.9560, 107.6870), O: n('Rancabolang', -6.9650, 107.6700, true), P: n('Cisaranten', -6.9300, 107.6850, true),
  Q: n('Arcamanik', -6.9190, 107.6720)
};
const s = (id, a, b, road_name, road_length, region) => ({ id, a, b, road_name, road_length, region_id: rid(region) });
export const segments = [
  s(1, 'A', 'B', 'Jl. Pasteur–Sukajadi', 2.0, 'Sukajadi'), s(2, 'A', 'D', 'Jl. Pasteur', 1.5, 'Cicendo'), s(3, 'B', 'C', 'Jl. Cipaganti', 2.2, 'Sukajadi'),
  s(4, 'C', 'E', 'Jl. Braga', 1.6, 'Sumur Bandung'), s(5, 'D', 'E', 'Jl. Jend. Sudirman', 2.4, 'Cicendo'), s(6, 'B', 'D', 'Jl. Sukajadi', 1.7, 'Sukajadi'),
  s(7, 'D', 'F', 'Jl. Pasirkoja', 2.0, 'Babakan Ciparay'), s(8, 'E', 'H', 'Jl. Otto Iskandardinata', 2.1, 'Sumur Bandung'), s(9, 'F', 'G', 'Jl. Kopo (utara)', 1.9, 'Babakan Ciparay'),
  s(10, 'G', 'H', 'Jl. Citarip', 1.8, 'Bojongloa Kaler'), s(11, 'E', 'G', 'Jl. Jamika', 2.5, 'Bojongloa Kaler'), s(12, 'F', 'I', 'Jl. Caringin–Cijerah', 2.2, 'Bandung Kulon'),
  s(13, 'G', 'J', 'Jl. Kopo (selatan)', 1.6, 'Bojongloa Kaler'), s(14, 'J', 'K', 'Jl. Cibaduyut', 2.1, 'Bojongloa Kidul'), s(15, 'H', 'L', 'Jl. Soekarno-Hatta (barat)', 2.8, 'Bojongloa Kaler'),
  s(16, 'K', 'L', 'Jl. Raya Margacinta', 3.0, 'Bojongloa Kidul'), s(17, 'L', 'M', 'Jl. Soekarno-Hatta (Gedebage)', 3.0, 'Gedebage'), s(18, 'M', 'O', 'Jl. Rancabolang', 1.8, 'Gedebage'),
  s(19, 'L', 'O', 'Jl. Cimencrang', 1.9, 'Gedebage'), s(20, 'M', 'P', 'Jl. Cisaranten', 2.6, 'Rancasari'), s(21, 'P', 'Q', 'Jl. Arcamanik', 2.4, 'Arcamanik'),
  s(22, 'Q', 'E', 'Jl. A.H. Nasution', 4.5, 'Arcamanik'), s(23, 'H', 'P', 'Jl. Soekarno-Hatta (tengah)', 3.5, 'Rancasari')
];
export const facilities = [
  { id: 1, facility_name: 'RS Rujukan Pasteur', facility_type: 'rumah_sakit', node: 'A', region_id: 'Cicendo' },
  { id: 2, facility_name: 'RS Gedebage', facility_type: 'rumah_sakit', node: 'M', region_id: 'Gedebage' },
  { id: 3, facility_name: 'Puskesmas Kopo', facility_type: 'puskesmas', node: 'G', region_id: 'Bojongloa Kaler' },
  { id: 4, facility_name: 'Puskesmas Cibaduyut', facility_type: 'puskesmas', node: 'K', region_id: 'Bojongloa Kidul' },
  { id: 5, facility_name: 'Puskesmas Arcamanik', facility_type: 'puskesmas', node: 'Q', region_id: 'Arcamanik' },
  { id: 6, facility_name: 'Pusat Evakuasi GOR', facility_type: 'pusat_evakuasi', node: 'M', region_id: 'Gedebage' },
  { id: 7, facility_name: 'SDN Citarip', facility_type: 'sekolah', node: 'H', region_id: 'Bojongloa Kaler' }
].map((f) => ({ ...f, name: f.facility_name, region_id: rid(f.region_id) }));
export function seedReports(now = Date.now()) {
  const r = (id, seg, cm, desc, hAgo, st) => ({ id, road_segment_id: seg, reported_depth: cm, description: desc, photo_url: null,
    reported_at: new Date(now - hAgo * 3600e3).toISOString(), updated_at: new Date(now - hAgo * 3600e3).toISOString(), verification_status: st, source_type: 'sintetis' });
  const V = 'terverifikasi', U = 'belum_terverifikasi', X = 'ditolak';
  return [r(1, 17, 80, 'Genangan di jalur Soekarno-Hatta', 5, V), r(2, 20, 60, 'Air masuk badan jalan', 2, U), r(3, 15, 45, 'Genangan di persimpangan', 30, V),
    r(4, 7, 70, 'Luapan Sungai Citepus', 8, V), r(5, 9, 55, 'Genangan setempat', 3, U), r(6, 4, 35, 'Air dari tanggul anak sungai', 10, V),
    r(7, 1, 90, 'Kendaraan terendam', 1, V), r(8, 12, 25, 'Genangan ringan, laporan warga', 4, U), r(9, 19, 15, 'Genangan tipis', 6, V), r(10, 16, 10, 'Salah input lokasi', 9, X),
    { ...r(11, 14, 40, 'Air setinggi lutut anak, motor mogok', 1.5, U), source_type: 'warga', tracking_code: 'LW-A1B2C3', reporter_contact: null },
    { ...r(12, 5, 20, 'Genangan di depan pertokoan', 0.5, U), source_type: 'warga', tracking_code: 'LW-D4E5F6', reporter_contact: null }];
}
export const seedUsers = () => [
  { id: 1, name: 'Petugas Demo', email: 'petugas@floodops.id', role: 'petugas', password_hash: bcrypt.hashSync('petugas123', 10), created_at: new Date().toISOString() },
  { id: 2, name: 'Pengguna Demo', email: 'pengguna@floodops.id', role: 'pengguna', password_hash: bcrypt.hashSync('pengguna123', 10), created_at: new Date().toISOString() },
  { id: 4, name: 'Peneliti Demo', email: 'peneliti@floodops.id', role: 'peneliti', password_hash: bcrypt.hashSync('peneliti123', 10), created_at: new Date().toISOString() },
  { id: 3, name: 'Admin Demo', email: 'admin@floodops.id', role: 'admin', password_hash: bcrypt.hashSync('admin123', 10), created_at: new Date().toISOString() }
];
