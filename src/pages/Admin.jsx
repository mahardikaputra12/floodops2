import { useEffect, useState } from 'react';
import { api, ago } from '../api.js';

export default function Admin({ net, refresh }) {
  const [w, setW] = useState({ depth: 40, access: 35, alt: 25, stale: 24 }), [users, setUsers] = useState([]), [audit, setAudit] = useState([]), [m, setM] = useState({});
  const [u, setU] = useState({ name: '', email: '', password: '', role: 'pengguna' }), [f, setF] = useState({ facility_name: '', facility_type: 'puskesmas', node: '' });
  const load = () => { api('/users').then(setUsers).catch(() => {}); api('/audit').then(setAudit).catch(() => {}); };
  useEffect(() => { load(); if (net?.params) setW({ depth: net.params.weights.depth * 100, access: net.params.weights.access * 100, alt: net.params.weights.alt * 100, stale: net.params.staleHours }); }, [net]);
  const run = async (key, fn, ok) => { try { await fn(); setM({ [key]: { o: ok } }); load(); refresh(); } catch (e) { setM({ [key]: { e: e.message } }); } };
  const Msg = ({ k }) => m[k]?.o ? <div className="ok">{m[k].o}</div> : m[k]?.e ? <div className="err">{m[k].e}</div> : null;
  // Uji rumus Skenario F ditampilkan di UI (perhitungan manual integer vs. rumus bobot)
  let okc = 0; for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) { const man = (40 * (a - 1) * 50 + 35 * (b - 1) * 50 + 25 * (c - 1) * 50) / 100; if (Math.abs(man - (0.4 * (a - 1) * 50 + 0.35 * (b - 1) * 50 + 0.25 * (c - 1) * 50)) < 1e-9) okc++; }
  return (<div className="grid even">
    <div className="grid" style={{ alignContent: 'start' }}>
      <div className="card"><h2>Parameter dan bobot penilaian</h2>
        {[['depth', 'Tingkat genangan (%)'], ['access', 'Dampak terhadap akses penting (%)'], ['alt', 'Ketersediaan jalur alternatif (%)'], ['stale', 'Batas kedaluwarsa laporan (jam)']].map(([k, l]) => <div key={k}><label>{l}</label><input type="number" min="0" value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} /></div>)}
        <p><button className="btn pri" onClick={() => run('p', () => api('/params', { method: 'PUT', body: { weights: { depth: w.depth / 100, access: w.access / 100, alt: w.alt / 100 }, staleHours: w.stale } }), 'Parameter disimpan dan skor dihitung ulang.')}>Simpan</button></p><Msg k="p" />
        <p className="mu">Uji rumus (Skenario F): <b>{okc}/27</b> kombinasi skala sesuai perhitungan manual. Batas kedalaman 20/50 cm adalah kategori awal prototipe, bukan standar resmi keselamatan.</p></div>
      <div className="card"><h2>Pengguna</h2><div className="scroll"><table><tbody>{users.map((x) => <tr key={x.id}><td>{x.name}<div className="mu">{x.email}</div></td><td>{x.role}</td></tr>)}</tbody></table></div>
        <form onSubmit={(e) => { e.preventDefault(); run('u', () => api('/users', { method: 'POST', body: u }), 'Pengguna ditambahkan.'); }}>
          <label>Nama</label><input required value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /><label>Email</label><input required type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
          <label>Kata sandi (min. 8 karakter, disimpan sebagai hash)</label><input required type="password" minLength="8" value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} />
          <label>Peran</label><select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}><option value="pengguna">Pengguna</option><option value="petugas">Petugas</option><option value="admin">Administrator</option></select>
          <p><button className="btn">Tambah pengguna</button></p></form><Msg k="u" /></div></div>
    <div className="grid" style={{ alignContent: 'start' }}>
      <div className="card"><h2>Fasilitas penting</h2><div className="scroll"><table><tbody>{net?.facilities.map((x) => <tr key={x.id}><td>{x.facility_name}</td><td className="mu">{x.facility_type} · {net.nodes[x.node].name}</td></tr>)}</tbody></table></div>
        <form onSubmit={(e) => { e.preventDefault(); run('f', () => api('/facilities', { method: 'POST', body: f }), 'Fasilitas ditambahkan; analisis dihitung ulang.'); }}>
          <label>Nama fasilitas</label><input required value={f.facility_name} onChange={(e) => setF({ ...f, facility_name: e.target.value })} />
          <label>Jenis</label><select value={f.facility_type} onChange={(e) => setF({ ...f, facility_type: e.target.value })}><option value="rumah_sakit">Rumah sakit</option><option value="puskesmas">Puskesmas</option><option value="sekolah">Sekolah</option><option value="pusat_evakuasi">Pusat evakuasi</option></select>
          <label>Lokasi (simpul persimpangan terdekat)</label><select required value={f.node} onChange={(e) => setF({ ...f, node: e.target.value })}><option value="">Pilih…</option>{Object.entries(net?.nodes ?? {}).map(([k, n]) => <option key={k} value={k}>{n.name}</option>)}</select>
          <p><button className="btn">Tambah fasilitas</button></p></form><Msg k="f" /></div>
      <div className="card"><h2>Riwayat aktivitas (audit log)</h2><div className="list">{audit.map((a) => <div key={a.id} className="mu" style={{ padding: '5px 8px' }}>{a.user_name} · {a.action} ({a.object_type} #{a.object_id}) · {ago(a.created_at)}</div>)}</div></div>
      <div className="card"><h2>Sumber &amp; cakupan data</h2><p className="mu">Jaringan jalan: 16 simpul / 23 ruas, skema ilustratif untuk wilayah uji Kota Bandung (bukan ekstraksi OSM). Fasilitas &amp; laporan: data sintetis berlabel. Peta dasar © OpenStreetMap contributors. Data banjir historis: BPBD Kota Bandung 2020–2025.</p></div></div>
  </div>);
}
