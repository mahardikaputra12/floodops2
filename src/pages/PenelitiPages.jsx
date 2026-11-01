import { useState } from 'react';
import { api, ago, downloadFile, RISK_LABEL } from '../api.js';
import MapView from '../components/MapView.jsx';
import Detail from '../components/Detail.jsx';
import Icon from '../components/Icon.jsx';
import { SimpleBars } from '../components/Charts.jsx';
import { useList } from '../components/Crud.jsx';

const RO = <div className="ro"><Icon n="lock" s={16} />Akses hanya baca. Peran Peneliti / Pengelola Wilayah tidak dapat mengubah laporan, data master, maupun parameter.</div>;
const riskCls = (r) => (['sangat_tinggi', 'tinggi'].includes(r) ? 't-tinggi' : ['sedang_tinggi', 'sedang'].includes(r) ? 't-menengah' : r === 'rendah' ? 't-rendah' : 'kd');

export function Rekap({ theme }) {
  const [rows, , err] = useList('/recap');
  const S = ({ b, l }) => <div className="s2"><b>{b}</b><span>{l}</span></div>, top = rows.find((r) => r.avg_score != null);
  const bars = rows.filter((r) => r.avg_score != null);
  return (<>{RO}{err && <div className="err">{err}</div>}
    <div className="stat2"><S b={rows.length} l="wilayah dianalisis" /><S b={top ? top.region_name : 'Belum ada'} l="skor rata-rata tertinggi" /><S b={rows.reduce((a, r) => a + r.blocked_n, 0)} l="ruas terendam (di atas batas lewat)" /><S b={rows.reduce((a, r) => a + r.facilities_at_risk, 0)} l="fasilitas berpotensi terganggu" /></div>
    <div className="grid even"><div className="card"><div className="ch"><h2>Skor prioritas rata-rata per wilayah</h2></div>{bars.length ? <SimpleBars labels={bars.map((r) => r.region_name)} values={bars.map((r) => r.avg_score)} colors={bars.map((r) => (r.avg_score >= 70 ? '#e5484d' : r.avg_score >= 40 ? '#f59e0b' : '#2f80ed'))} max={100} theme={theme} /> : <p className="mu">Belum ada data.</p>}</div>
      <div className="card"><h2>Cara membaca</h2><ul className="why"><li>Skor rata-rata dihitung dari ruas yang memiliki laporan aktif pada wilayah tersebut.</li><li>Ruas terendam adalah ruas dengan genangan di atas batas lewat pada parameter penilaian.</li><li>Fasilitas berpotensi terganggu dihitung dari ruas berprioritas tinggi yang bila tidak dapat dilewati memutus akses ke fasilitas.</li><li>Wilayah tanpa laporan ditandai belum ada data, bukan nol.</li></ul></div></div>
    <div className="card"><div className="ch"><h2>Rekap per wilayah</h2></div><div className="scroll"><table><thead><tr><th>Wilayah</th><th>Kerawanan (BPBD)</th><th>Ruas berdata</th><th>Laporan aktif</th><th>Genangan maks.</th><th>Skor rata-rata</th><th>Prioritas tinggi</th><th>Terendam</th><th>Fasilitas berisiko</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.region_id}><td><b>{r.region_name}</b></td><td><span className={`badge ${riskCls(r.risk_level)}`}>{RISK_LABEL[r.risk_level]}</span></td><td>{r.segments_with_data} dari {r.segments_total}</td><td>{r.reports_active}</td><td>{r.max_depth} cm</td><td>{r.avg_score ?? 'Belum ada data'}</td><td>{r.high_n}</td><td>{r.blocked_n}</td><td>{r.facilities_at_risk} dari {r.facilities_total}</td></tr>)}</tbody></table></div></div></>);
}
export function Access({ net, prio }) {
  const [sel, setSel] = useState(null), item = prio.ranked.find((r) => r.segment_id === sel), seg = net?.segments.find((s) => s.id === sel);
  return (<>{RO}<div className="grid two"><div className="card"><div className="ch"><h2>Peta aksesibilitas ruas</h2></div><MapView net={net} ranked={prio.ranked} selected={sel} onSelect={setSel} /></div>
    <div className="card">{sel ? <Detail item={item} segment={seg} /> : <><h2>Detail ruas jalan</h2><p className="mu">Klik ruas pada peta atau tabel untuk melihat skor, alasan, dan fasilitas yang aksesnya berpotensi terputus.</p></>}</div></div>
    <div className="card"><h2>Peringkat ruas</h2><div className="scroll"><table><thead><tr><th>Ruas</th><th>Skor</th><th>Kategori</th><th>Genangan</th><th>Dampak akses</th><th>Jalur alternatif</th></tr></thead><tbody>
      {prio.ranked.map((r) => <tr key={r.segment_id} className={'clk' + (sel === r.segment_id ? ' sel' : '')} onClick={() => setSel(r.segment_id)}><td><b>{r.road_name}</b></td><td>{r.total_score}</td><td><span className={`badge t-${r.category.key}`}>{r.category.label}</span></td><td>{r.reported_depth} cm</td><td>skala {r.facility_impact_score} dari 3</td><td>skala {r.alternative_access_score} dari 3</td></tr>)}</tbody></table></div></div></>);
}
export function Sims({ readOnlyNote = true }) {
  const [rows, , err] = useList('/simulations');
  return (<>{readOnlyNote && RO}<div className="card"><h2>Riwayat simulasi penutupan</h2>{err && <div className="err">{err}</div>}<div className="scroll"><table><thead><tr><th>Ruas yang ditutup</th><th>Hubungan terputus</th><th>Tambahan waktu terbesar</th><th>Tambahan jarak terbesar</th><th>Dijalankan oleh</th><th>Waktu</th></tr></thead><tbody>
    {rows.map((r) => <tr key={r.id}><td><b>{r.road_name}</b><div className="mu">Ruas terendam {r.input_parameters.avoid_flooded ? 'dihindari' : 'diabaikan'}, {r.input_parameters.speed_kmh} km/jam</div></td><td>{r.result_summary.pairs_lost} dari {r.result_summary.pairs_total}</td><td>{r.result_summary.max_add_min} menit</td><td>{r.result_summary.max_add_km} km</td><td>{r.created_by_name}</td><td>{ago(r.created_at)}</td></tr>)}
    {!rows.length && <tr><td colSpan="6" className="mu">Belum ada simulasi yang dijalankan.</td></tr>}</tbody></table></div></div></>);
}
export function ExportPage() {
  const [msg, setMsg] = useState('');
  const dl = async (p, n) => { try { await downloadFile(p, n); setMsg('Berkas diunduh: ' + n); } catch (e) { setMsg(e.message); } };
  return (<>{RO}<div className="grid even">
    <div className="card"><h2>Ringkasan prioritas ruas</h2><p className="mu">Peringkat ruas, skor, kategori, status verifikasi, dan alasan penilaian dalam format CSV.</p><button className="btn pri" onClick={() => dl('/export', 'floodops-ringkasan.csv')}><Icon n="download" s={16} />Unduh CSV</button></div>
    <div className="card"><h2>Rekap per wilayah</h2><p className="mu">Skor rata-rata, ruas terendam, dan fasilitas berisiko per wilayah untuk evaluasi aksesibilitas.</p><button className="btn pri" onClick={() => dl('/export?type=recap', 'floodops-rekap-wilayah.csv')}><Icon n="download" s={16} />Unduh CSV</button></div></div>
    {msg && <div className="ok">{msg}</div>}<p className="mu">Berkas berisi catatan bahwa skor adalah alat bantu analisis, bukan keputusan resmi, dan bahwa data uji bersifat sintetis.</p></>);
}
