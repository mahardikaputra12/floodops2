import { useState } from 'react';
import { api, setToken } from '../api.js';
import Icon from '../components/Icon.jsx';

export const PORTALS = {
  petugas: { name: 'Petugas Penanganan Banjir', icon: 'shield', color: '#0f7b4b', desc: 'Memverifikasi laporan, meninjau skor prioritas dan alasannya, menjalankan simulasi rute alternatif, dan mengekspor ringkasan.', demo: ['petugas@floodops.id', 'petugas123'] },
  pengguna: { name: 'Pengguna', icon: 'map', color: '#2f80ed', desc: 'Melihat peta dan dashboard kondisi jalan serta memasukkan laporan genangan lengkap dengan foto.', demo: ['pengguna@floodops.id', 'pengguna123'] },
  peneliti: { name: 'Peneliti / Pengelola Wilayah', icon: 'chart', color: '#0e8a8a', desc: 'Membaca rekap per wilayah dan analisis aksesibilitas untuk mengevaluasi dampak banjir. Akses hanya baca.', demo: ['peneliti@floodops.id', 'peneliti123'] },
  admin: { name: 'Administrator', icon: 'settings', color: '#7c3aed', desc: 'Mengelola data master (pengguna, wilayah, ruas jalan, fasilitas), parameter penilaian, hak akses, dan riwayat aktivitas.', demo: ['admin@floodops.id', 'admin123'] }
};
const go = (h) => { location.hash = h; };

export function Landing() {
  return (<div className="login" style={{ alignItems: 'start' }}><div style={{ width: 'min(1100px,100%)', padding: '30px 0' }}>
    <div className="brand" style={{ fontSize: 22 }}><img src="/logo.png" alt="" />FloodOps</div>
    <h1 style={{ fontSize: 'clamp(26px,4vw,40px)', margin: '10px 0 8px', maxWidth: 740 }}>Dari lokasi banjir menjadi prioritas penanganan jalan yang bisa dijelaskan.</h1>
    <p className="mu" style={{ fontSize: 15, maxWidth: 700 }}>Analisis dampak banjir terhadap jaringan jalan, akses ke fasilitas penting, dan ketersediaan jalur alternatif. Pilih pintu masuk sesuai peran Anda.</p>
    <div className="card" style={{ margin: '22px 0', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderColor: '#f59e0b88' }}>
      <div className="ico" style={{ background: '#f59e0b22', color: '#b7791f' }}><Icon n="alert" /></div><div style={{ flex: '1 1 260px' }}><h2>Warga: melihat banjir di jalan?</h2><span className="mu">Laporkan tanpa perlu akun, lengkap dengan foto. Anda mendapat kode untuk memantau status laporan.</span></div>
      <button className="btn pri" style={{ background: '#b7791f', borderColor: '#b7791f' }} onClick={() => go('#/lapor')}>Buat laporan warga</button></div>
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
      {Object.entries(PORTALS).map(([k, p]) => <div className="card" key={k} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: `4px solid ${p.color}` }}>
        <div className="ico" style={{ background: p.color + '22', color: p.color }}><Icon n={p.icon} /></div><h2>{p.name}</h2><span className="mu" style={{ flex: 1 }}>{p.desc}</span>
        <button className="btn" style={{ borderColor: p.color, color: p.color }} onClick={() => go('#/masuk/' + k)}>Masuk</button></div>)}
    </div>
    <p className="mu" style={{ marginTop: 22 }}>FloodOps adalah alat bantu analisis, bukan sistem peringatan dini dan bukan keputusan resmi penanganan bencana. Data pada prototipe ini bersifat sintetis dan ilustratif.</p>
  </div></div>);
}

export function PortalLogin({ portal, onLogin }) {
  const p = PORTALS[portal], [f, setF] = useState({ email: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  if (!p) return <Landing />;
  const submit = async (e, c = f) => { e?.preventDefault(); setBusy(true); setErr('');
    try { const r = await api('/auth/login', { method: 'POST', body: { ...c, portal } }); setToken(r.token); onLogin(r.user); } catch (x) { setErr(x.message); } setBusy(false); };
  return (<div className="login"><div className="card" style={{ borderTop: `4px solid ${p.color}` }}>
    <button className="btn sm" onClick={() => go('#/')}>Pilih peran lain</button>
    <div className="row" style={{ margin: '16px 0 4px' }}><div className="ico" style={{ background: p.color + '22', color: p.color }}><Icon n={p.icon} /></div><div><h2>Masuk sebagai {p.name}</h2><span className="mu">Halaman ini khusus akun {p.name.toLowerCase()}.</span></div></div>
    <form onSubmit={submit}><label>Email</label><input type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label>Kata sandi</label><input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button className="btn pri" style={{ width: '100%', marginTop: 16, background: p.color, borderColor: p.color }} disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button></form>
    {err && <div className="err">{err}</div>}
    <div className="demo"><span className="mu">Akun demo {p.name}:</span><button type="button" className="btn sm" onClick={() => submit(null, { email: p.demo[0], password: p.demo[1] })}>{p.demo[0]}, klik untuk masuk</button></div>
    <p className="mu" style={{ marginTop: 14 }}>Bukan pengguna terdaftar? <a href="#/lapor">Kirim laporan sebagai warga</a> tanpa akun.</p>
  </div></div>);
}
