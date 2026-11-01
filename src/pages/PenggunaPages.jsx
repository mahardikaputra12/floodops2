import { ago, STATUS_LABEL } from '../api.js';
import MapView from '../components/MapView.jsx';
import ReportForm from '../components/ReportForm.jsx';
import Icon from '../components/Icon.jsx';

export function PenggunaHome({ net, prio, reports, setTab }) {
  const ranked = prio.ranked, active = reports.filter((r) => r.verification_status !== 'ditolak');
  const S = ({ i, b, l }) => <div className="card stat" style={{ display: 'flex', gap: 14, alignItems: 'center' }}><div className="ico"><Icon n={i} /></div><div><b style={{ fontSize: 26, display: 'block', lineHeight: 1.1 }}>{b}</b><span className="mu">{l}</span></div></div>;
  return (<>
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
      <S i="file" b={active.length} l="Laporan aktif di wilayah uji" /><S i="alert" b={ranked.filter((r) => r.category.key === 'tinggi').length} l="Ruas berkategori tinggi" /><S i="road" b={ranked.filter((r) => r.depth_score === 3).length} l="Ruas genangan lebih dari 50 cm" />
    </div>
    <div className="grid two">
      <div className="card"><div className="ch"><h2>Peta kondisi ruas jalan</h2><button className="btn pri" onClick={() => setTab('form')}><Icon n="plus" s={16} />Buat laporan</button></div><MapView net={net} ranked={ranked} /></div>
      <div className="card"><h2>Laporan terbaru</h2><div className="list" style={{ maxHeight: 520 }}>{active.slice(0, 12).map((r) => <div key={r.id} className="item" style={{ cursor: 'default' }}>
        <div><div className="n">{r.road_name}</div><span className="mu">{r.reported_depth} cm, {ago(r.updated_at)}</span></div><span className={`badge s-${r.verification_status}`}>{STATUS_LABEL[r.verification_status]}</span></div>)}</div>
        <p className="mu">Akun Pengguna dapat melihat peta, dashboard, dan memasukkan laporan. Skor prioritas dan simulasi tersedia untuk petugas.</p></div>
    </div></>);
}
export function PenggunaForm({ net, refresh }) { return (<div className="grid even"><div className="card"><h2>Input laporan kondisi jalan</h2><ReportForm net={net} onDone={refresh} /></div>
  <div className="card"><h2>Panduan singkat</h2><ul className="why"><li>Pilih ruas jalan yang tergenang dan perkirakan kedalaman air.</li><li>Gunakan tombol kedalaman cepat bila ragu mengukur, lalu sesuaikan angkanya.</li><li>Lampirkan foto bila aman; jangan memotret dengan membahayakan diri.</li><li>Laporan Anda diperiksa petugas sebelum berstatus terverifikasi.</li></ul></div></div>); }
export function MyReports({ reports }) {
  return (<div className="card"><h2>Laporan saya</h2><div className="scroll"><table><thead><tr><th>Ruas</th><th>Kedalaman</th><th>Foto</th><th>Status</th><th>Pembaruan</th></tr></thead><tbody>
    {reports.map((r) => <tr key={r.id}><td><b>{r.road_name}</b><div className="mu">{r.description}</div></td><td>{r.reported_depth} cm</td><td>{r.photo_url ? <a href={r.photo_url} target="_blank" rel="noreferrer noopener"><img className="thumb sm" src={r.photo_url} alt="Foto laporan" /></a> : <span className="mu">Tanpa foto</span>}</td>
      <td><span className={`badge s-${r.verification_status}`}>{STATUS_LABEL[r.verification_status]}</span> {r.stale && <span className="badge kd">Kedaluwarsa</span>}</td><td>{ago(r.updated_at)}</td></tr>)}
    {!reports.length && <tr><td colSpan="5" className="mu">Anda belum mengirim laporan.</td></tr>}</tbody></table></div></div>);
}
