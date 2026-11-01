import { useEffect, useState } from 'react';
import { api, ago, STATUS_LABEL } from '../api.js';
import PhotoField from '../components/PhotoField.jsx';
import Icon from '../components/Icon.jsx';

const PRESETS = [['Mata kaki', 10], ['Betis', 30], ['Lutut', 50], ['Paha', 80]];
const MSG = { terverifikasi: 'Laporan Anda sudah diperiksa dan diverifikasi petugas.', belum_terverifikasi: 'Laporan Anda diterima dan menunggu pemeriksaan petugas.', ditolak: 'Laporan Anda tidak dapat dipakai (misalnya lokasi atau data tidak sesuai).' };

// Halaman publik tanpa login (laporan warga). Laporan masuk sebagai "belum terverifikasi" dan tidak otomatis menjadi keputusan penanganan.
export default function Lapor() {
  const [segs, setSegs] = useState([]), [f, setF] = useState({ road_segment_id: '', reported_depth: '', description: '', photo_url: '', reporter_contact: '', website: '' });
  const [done, setDone] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [code, setCode] = useState(''), [track, setTrack] = useState(null), [terr, setTerr] = useState('');
  useEffect(() => { api('/public/segments').then(setSegs).catch(() => setErr('Daftar ruas jalan belum dapat dimuat. Periksa koneksi Anda.')); }, []);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api('/public/reports', { method: 'POST', body: { ...f, road_segment_id: +f.road_segment_id } }); setDone(r.tracking_code); setCode(r.tracking_code); } catch (x) { setErr(x.message); } setBusy(false); };
  const cek = async (e) => { e.preventDefault(); setTerr(''); setTrack(null); try { setTrack(await api('/public/reports/' + encodeURIComponent(code.trim()))); } catch (x) { setTerr(x.message); } };
  return (<div className="login" style={{ alignItems: 'start' }}><div style={{ width: 'min(920px,100%)', padding: '24px 0' }}>
    <button className="btn sm" onClick={() => (location.hash = '#/')}>Beranda</button>
    <h1 style={{ margin: '14px 0 4px' }}>Laporan Warga</h1>
    <p className="mu" style={{ margin: '0 0 16px' }}>Bantu petugas mengetahui kondisi jalan yang tergenang. Tidak perlu akun.</p>
    <div className="grid even">
      <div className="card">{done ? <>
        <h2>Laporan diterima</h2><p>Simpan kode ini untuk memantau status laporan Anda:</p><div className="big" style={{ letterSpacing: 2, margin: '8px 0' }}>{done}</div>
        <p className="mu">Laporan berstatus <b>belum terverifikasi</b> sampai diperiksa petugas. Jika ada bahaya langsung terhadap keselamatan, hubungi layanan darurat setempat (112) — FloodOps bukan layanan darurat.</p>
        <button className="btn" onClick={() => { setDone(null); setF({ ...f, reported_depth: '', description: '', photo_url: '' }); }}>Kirim laporan lain</button></> :
        <form onSubmit={submit}><h2>Formulir laporan</h2>
          <label>Ruas jalan yang tergenang</label><select required value={f.road_segment_id} onChange={(e) => setF({ ...f, road_segment_id: e.target.value })}><option value="">Pilih ruas…</option>{segs.map((s) => <option key={s.id} value={s.id}>{s.road_name} ({s.region_name})</option>)}</select>
          <label>Perkiraan kedalaman genangan (cm)</label><input type="number" required min="0" max="300" value={f.reported_depth} onChange={(e) => setF({ ...f, reported_depth: e.target.value })} placeholder="Contoh: 30" />
          <div className="row" style={{ marginTop: 8 }}>{PRESETS.map(([n, v]) => <button type="button" key={n} className="btn sm" onClick={() => setF({ ...f, reported_depth: v })}>{n}, sekitar {v} cm</button>)}</div>
          <span className="mu">Pilihan cepat hanya perkiraan kasar tinggi air terhadap tubuh orang dewasa.</span>
          <label>Keterangan (opsional)</label><textarea rows="3" maxLength="200" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Misalnya: motor mogok, air mulai surut" />
          <label>Foto (opsional)</label><PhotoField pub value={f.photo_url} onChange={(v) => setF({ ...f, photo_url: v })} />
          <label>Kontak (opsional, hanya terlihat petugas)</label><input maxLength="60" value={f.reporter_contact} onChange={(e) => setF({ ...f, reporter_contact: e.target.value })} placeholder="Nama/nomor bila petugas perlu menghubungi" />
          <input name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          <button className="btn pri" style={{ width: '100%', marginTop: 16 }} disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan'}</button>
          {err && <div className="err">{err}</div>}
          <p className="mu" style={{ marginTop: 10 }}>Data pribadi diminimalkan: kontak bersifat opsional. Laporan dibatasi 5 per 10 menit per perangkat untuk mencegah penyalahgunaan.</p></form>}</div>
      <div className="card"><h2>Cek status laporan</h2>
        <form onSubmit={cek}><label>Kode laporan</label><div className="row"><input className="grow" required placeholder="LW-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn">Cek</button></div></form>
        {terr && <div className="err">{terr}</div>}
        {track && <div style={{ marginTop: 14 }}><span className={`badge s-${track.verification_status}`}>{STATUS_LABEL[track.verification_status]}</span><p><b>{track.road_name}</b><br />Kedalaman dilaporkan {track.reported_depth} cm · dikirim {ago(track.reported_at)} · diperbarui {ago(track.updated_at)}</p><p className="mu">{MSG[track.verification_status]}</p></div>}
        <div className="note" style={{ marginTop: 16 }}>Laporan warga membantu petugas menentukan ruas yang perlu diperiksa, tetapi <b>tidak otomatis</b> menjadi keputusan penanganan. Setiap laporan diperiksa petugas dan ditandai jelas sebagai belum terverifikasi sebelum itu.</div></div>
    </div></div></div>);
}
