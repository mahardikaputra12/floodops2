import { useEffect, useState } from 'react';
import { api, ago, RISK_LABEL, ROLE_LABEL } from '../api.js';
import Crud, { useList } from '../components/Crud.jsx';
import Icon from '../components/Icon.jsx';

const opt = (o) => Object.entries(o).map(([value, label]) => ({ value, label }));
const send = (path, vals, id) => api(path + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: vals });

export function AdminHome({ net, reports, setTab }) {
  const [users] = useList('/users'), [sims] = useList('/simulations'), [audit] = useList('/audit');
  const cards = [['users', 'users', 'Pengguna', users.length], ['regions', 'building', 'Wilayah', net?.regions.length ?? 0], ['segments', 'road', 'Ruas Jalan', net?.segments.length ?? 0], ['facilities', 'hospital', 'Fasilitas Penting', net?.facilities.length ?? 0], ['reports', 'file', 'Laporan Banjir', reports.length], ['sims', 'flask', 'Riwayat Simulasi', sims.length], ['audit', 'history', 'Riwayat Aktivitas', audit.length]];
  return (<><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>{cards.map(([k, i, n, c]) => <button key={k} className="card" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', color: 'var(--tx)', font: 'inherit' }} onClick={() => setTab(k)}>
    <div className="ico"><Icon n={i} /></div><div><b style={{ fontSize: 26, display: 'block', lineHeight: 1.1 }}>{c}</b><span className="mu">{n}</span></div></button>)}</div>
    <div className="grid even" style={{ marginTop: 16 }}><div className="card"><h2>Pengguna menurut peran</h2><p>{Object.entries(ROLE_LABEL).map(([k, v]) => <span key={k} className="chip">{v}: {users.filter((u) => u.role === k).length}</span>)}</p></div>
      <div className="card"><h2>Batas peran administrator</h2><p className="mu">Administrator mengelola data master dan konfigurasi. Administrator tidak menjalankan simulasi, tidak mengekspor ringkasan analisis, dan tidak membuat laporan; fungsi tersebut ada pada peran Petugas, Peneliti, dan Pengguna. Lihat halaman Hak Akses untuk matriks lengkap per tabel.</p></div></div></>);
}
export function UsersPage({ refresh }) {
  const [rows, load, error] = useList('/users');
  return <Crud title="Pengguna" intro="Akun dan peran. Kata sandi disimpan sebagai hash. Administrator terakhir dan akun yang sedang dipakai tidak dapat dihapus." rows={rows} error={error} createLabel="Tambah pengguna"
    columns={[{ key: 'name', label: 'Nama' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Peran', render: (r) => <span className="badge kd">{ROLE_LABEL[r.role]}</span> }, { key: 'created_at', label: 'Dibuat', render: (r) => ago(r.created_at) }]}
    fields={[{ key: 'name', label: 'Nama' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'role', label: 'Peran', type: 'select', options: opt(ROLE_LABEL) }, { key: 'password', label: 'Kata sandi (minimal 8 karakter)', type: 'password' }]}
    onSave={async (v, id) => { await send('/users', v, id); load(); }} onDelete={async (r) => { await api('/users/' + r.id, { method: 'DELETE' }); load(); }} />;
}
export function RegionsPage({ net, refresh }) {
  const [rows, load, error] = useList('/regions'), n = (id) => net?.segments.filter((s) => s.region_id === id).length ?? 0;
  const done = () => { load(); refresh(); };
  return <Crud title="Wilayah (Region Management)" intro="Wilayah dipakai oleh ruas jalan dan fasilitas penting. Wilayah yang masih dipakai tidak dapat dihapus." rows={rows} error={error} createLabel="Tambah wilayah"
    columns={[{ key: 'region_name', label: 'Wilayah' }, { key: 'region_type', label: 'Jenis' }, { key: 'risk_level', label: 'Tingkat kerawanan', render: (r) => RISK_LABEL[r.risk_level] }, { key: 'main_cause', label: 'Penyebab utama' }, { key: 'n', label: 'Ruas', render: (r) => n(r.id) }]}
    fields={[{ key: 'region_name', label: 'Nama wilayah' }, { key: 'region_type', label: 'Jenis wilayah', type: 'select', default: 'kecamatan', options: [{ value: 'kecamatan', label: 'Kecamatan' }, { value: 'kelurahan', label: 'Kelurahan' }, { value: 'kawasan', label: 'Kawasan' }] },
      { key: 'risk_level', label: 'Tingkat kerawanan', type: 'select', options: opt(RISK_LABEL) }, { key: 'main_cause', label: 'Penyebab utama', type: 'textarea', required: false, full: true }]}
    onSave={async (v, id) => { await send('/regions', v, id); done(); }} onDelete={async (r) => { await api('/regions/' + r.id, { method: 'DELETE' }); done(); }} />;
}
export function SegmentsPage({ net, refresh }) {
  const nodeOpts = Object.entries(net?.nodes ?? {}).map(([value, n]) => ({ value, label: n.name })), regOpts = (net?.regions ?? []).map((r) => ({ value: r.id, label: r.region_name }));
  const nm = (k) => net.nodes[k]?.name, rg = (id) => net.regions.find((r) => r.id === id)?.region_name;
  return <Crud title="Ruas Jalan" intro="Ruas menghubungkan dua simpul persimpangan. Titik ujung tidak dapat diubah setelah dibuat. Ruas yang masih memiliki laporan tidak dapat dihapus." rows={net?.segments ?? []} createLabel="Tambah ruas"
    columns={[{ key: 'road_name', label: 'Nama ruas' }, { key: 'ends', label: 'Titik ujung', render: (r) => `${nm(r.a)} dan ${nm(r.b)}` }, { key: 'road_length', label: 'Panjang', render: (r) => r.road_length + ' km' }, { key: 'region_id', label: 'Wilayah', render: (r) => rg(r.region_id) }]}
    fields={[{ key: 'road_name', label: 'Nama ruas' }, { key: 'a', label: 'Simpul awal', type: 'select', options: nodeOpts, createOnly: true }, { key: 'b', label: 'Simpul akhir', type: 'select', options: nodeOpts, createOnly: true },
      { key: 'road_length', label: 'Panjang (km)', type: 'number', step: '0.1', min: '0.1', max: '50' }, { key: 'region_id', label: 'Wilayah', type: 'select', options: regOpts }]}
    onSave={async (v, id) => { await send('/segments', v, id); await refresh(); }} onDelete={async (r) => { await api('/segments/' + r.id, { method: 'DELETE' }); await refresh(); }} />;
}
const FTYPE = { rumah_sakit: 'Rumah sakit', puskesmas: 'Puskesmas', sekolah: 'Sekolah', pusat_evakuasi: 'Pusat evakuasi' };
export function FacilitiesPage({ net, refresh }) {
  const nodeOpts = Object.entries(net?.nodes ?? {}).map(([value, n]) => ({ value, label: n.name })), regOpts = (net?.regions ?? []).map((r) => ({ value: r.id, label: r.region_name }));
  return <Crud title="Fasilitas Penting" intro="Rumah sakit, puskesmas, sekolah, dan pusat evakuasi. Fasilitas dihubungkan ke simpul persimpangan terdekat dan memengaruhi analisis akses." rows={net?.facilities ?? []} createLabel="Tambah fasilitas"
    columns={[{ key: 'facility_name', label: 'Nama' }, { key: 'facility_type', label: 'Jenis', render: (r) => FTYPE[r.facility_type] }, { key: 'node', label: 'Simpul', render: (r) => net.nodes[r.node]?.name }, { key: 'region_id', label: 'Wilayah', render: (r) => net.regions.find((x) => x.id === r.region_id)?.region_name }]}
    fields={[{ key: 'facility_name', label: 'Nama fasilitas' }, { key: 'facility_type', label: 'Jenis', type: 'select', options: opt(FTYPE) }, { key: 'node', label: 'Simpul persimpangan terdekat', type: 'select', options: nodeOpts }, { key: 'region_id', label: 'Wilayah', type: 'select', options: regOpts }]}
    onSave={async (v, id) => { await send('/facilities', v, id); await refresh(); }} onDelete={async (r) => { await api('/facilities/' + r.id, { method: 'DELETE' }); await refresh(); }} />;
}
export function ParamsPage({ net, refresh }) {
  const p = net?.params, init = (p) => (p ? { depth: p.weights.depth * 100, access: p.weights.access * 100, alt: p.weights.alt * 100, stale: p.staleHours, speed: p.avgSpeedKmh, block: p.blockDepth, low: p.depthLow, mid: p.depthMid } : null);
  const [w, setW] = useState(() => init(p)), [m, setM] = useState(null);
  useEffect(() => { setW(init(p)); }, [p]);
  if (!w) return null;
  const F = ([k, l, h, step]) => <div key={k}><label>{l}</label><input type="number" step={step} min="0" value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} />{h && <span className="mu">{h}</span>}</div>;
  const save = async () => { try { await api('/params', { method: 'PUT', body: { weights: { depth: w.depth / 100, access: w.access / 100, alt: w.alt / 100 }, staleHours: w.stale, avgSpeedKmh: w.speed, blockDepth: w.block, depthLow: w.low, depthMid: w.mid } }); await refresh(); setM({ o: 'Parameter disimpan dan skor dihitung ulang.' }); } catch (e) { setM({ e: e.message }); } };
  let okc = 0; for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) { const man = (40 * (a - 1) * 50 + 35 * (b - 1) * 50 + 25 * (c - 1) * 50) / 100; if (Math.abs(man - (0.4 * (a - 1) * 50 + 0.35 * (b - 1) * 50 + 0.25 * (c - 1) * 50)) < 1e-9) okc++; }
  return (<div className="grid even"><div className="card"><h2>Bobot dan ambang penilaian</h2><div className="fgrid">{[['depth', 'Bobot tingkat genangan (%)'], ['access', 'Bobot dampak akses penting (%)'], ['alt', 'Bobot jalur alternatif (%)'], ['stale', 'Batas kedaluwarsa laporan (jam)'], ['low', 'Batas skala 1 genangan (cm)', 'Genangan sampai batas ini termasuk skala 1.'], ['mid', 'Batas skala 2 genangan (cm)', 'Di atas batas ini termasuk skala 3.']].map(F)}</div></div>
    <div className="card"><h2>Parameter simulasi rute</h2><div className="fgrid">{[['speed', 'Kecepatan rata-rata (km/jam)', 'Dipakai untuk menghitung estimasi waktu tempuh.', '1'], ['block', 'Batas genangan tidak dapat dilewati (cm)', 'Ruas dengan genangan di atas batas ini dihindari rute pengganti.']].map(F)}</div>
      <p><button className="btn pri" onClick={save}>Simpan parameter</button></p>{m?.o && <div className="ok">{m.o}</div>}{m?.e && <div className="err">{m.e}</div>}
      <p className="mu">Uji rumus (Skenario F): <b>{okc} dari 27</b> kombinasi skala sesuai perhitungan manual pada bobot awal 40/35/25. Ambang kedalaman adalah kategori awal prototipe, bukan standar keselamatan resmi.</p></div></div>);
}
const RES = { users: 'Pengguna', regions: 'Wilayah', road_segments: 'Ruas Jalan', critical_facilities: 'Fasilitas Penting', flood_reports: 'Laporan Banjir', priority_scores: 'Skor Prioritas', simulation_runs: 'Simulasi', audit_logs: 'Riwayat Aktivitas', system_params: 'Parameter Penilaian', export: 'Ekspor Ringkasan' };
const ACT = { c: 'Tambah', r: 'Lihat', u: 'Ubah', d: 'Hapus' }, COLS = ['warga', 'pengguna', 'petugas', 'peneliti', 'admin'];
export function PermsPage() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/permissions').then(setD).catch(() => {}); }, []);
  if (!d) return null;
  return (<div className="card"><h2>Matriks hak akses per tabel</h2><p className="mu">Izin ditegakkan di server pada setiap permintaan. Setiap peran memiliki halaman dan hak yang berbeda.</p>
    <div className="scroll"><table><thead><tr><th>Tabel / data</th>{COLS.map((c) => <th key={c}>{c === 'warga' ? 'Warga (tanpa akun)' : ROLE_LABEL[c]}</th>)}</tr></thead><tbody>
      {Object.entries(RES).map(([k, label]) => <tr key={k}><td><b>{label}</b></td>{COLS.map((c) => { const a = d.perm[k]?.[c] || '', note = d.notes[`${k}.${c}`]; return <td key={c}>{a ? [...a].map((x) => <span key={x} className="chip">{ACT[x]}</span>) : <span className="mu">Tidak ada akses</span>}{note && <div className="mu">{note}</div>}</td>; })}</tr>)}</tbody></table></div></div>);
}
export function AuditPage() {
  const [rows, , err] = useList('/audit');
  return (<div className="card"><h2>Riwayat aktivitas (audit log)</h2>{err && <div className="err">{err}</div>}<div className="scroll"><table><thead><tr><th>Waktu</th><th>Pelaku</th><th>Tindakan</th><th>Objek</th></tr></thead><tbody>
    {rows.map((a) => <tr key={a.id}><td>{ago(a.created_at)}</td><td>{a.user_name}</td><td>{a.action}</td><td>{a.object_type} nomor {a.object_id}</td></tr>)}{!rows.length && <tr><td colSpan="4" className="mu">Belum ada aktivitas.</td></tr>}</tbody></table></div></div>);
}
