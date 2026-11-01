import { useEffect, useState } from 'react';
import { api, ago, STATUS_LABEL, SOURCE_LABEL } from '../api.js';
import Icon from '../components/Icon.jsx';
// Antrean dan daftar laporan: Petugas memverifikasi/menolak/memperbarui; Admin juga dapat menghapus.
export default function Reports({ role, reports: all, refresh }) {
  const [f, setF] = useState({ status: '', min: '', hours: '', source: '' }), [list, setList] = useState(all), [msg, setMsg] = useState(null), [conf, setConf] = useState(null);
  const load = async () => { const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(); try { setList(await api('/reports' + (q ? '?' + q : ''))); } catch (e) { setMsg({ e: e.message }); } };
  useEffect(() => { load(); }, [f, all]);
  const act = async (id, action) => { try { await api('/reports/' + id, { method: 'PATCH', body: { action } }); await refresh(); setMsg({ o: 'Status laporan diperbarui.' }); } catch (e) { setMsg({ e: e.message }); } };
  const del = async (id) => { try { await api('/reports/' + id, { method: 'DELETE' }); setConf(null); await refresh(); setMsg({ o: 'Laporan dihapus.' }); } catch (e) { setMsg({ e: e.message }); } };
  const queue = all.filter((r) => r.source_type === 'warga' && r.verification_status === 'belum_terverifikasi').length;
  return (<div className="card"><div className="ch"><h2>{role === 'admin' ? 'Data laporan banjir' : 'Antrean verifikasi dan daftar laporan'}</h2></div>
    <div className="row" style={{ marginBottom: 10 }}>
      <select className="grow" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">Semua status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input className="grow" type="number" min="0" placeholder="Minimal kedalaman (cm)" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} aria-label="Kedalaman minimal" />
      <select className="grow" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} aria-label="Waktu"><option value="">Semua waktu</option><option value="6">6 jam terakhir</option><option value="24">24 jam terakhir</option><option value="72">3 hari terakhir</option></select>
      <select className="grow" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Sumber"><option value="">Semua sumber</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <div className="row" style={{ marginBottom: 8 }}><button className="btn sm" onClick={() => setF({ status: 'belum_terverifikasi', min: '', hours: '', source: 'warga' })}><Icon n="inbox" s={14} />Antrean laporan warga ({queue})</button><button className="btn sm" onClick={() => setF({ status: '', min: '', hours: '', source: '' })}>Atur ulang filter</button></div>
    {msg?.o && <div className="ok">{msg.o}</div>}{msg?.e && <div className="err">{msg.e}</div>}
    <div className="scroll"><table><thead><tr><th>Ruas dan catatan</th><th>cm</th><th>Foto</th><th>Status</th><th>Pembaruan</th><th>Aksi</th></tr></thead><tbody>
      {list.map((r) => <tr key={r.id}><td><b>{r.road_name}</b><div className="mu">{r.description}, sumber {r.source_type === 'warga' ? <span className="badge kd">Warga {r.tracking_code}</span> : SOURCE_LABEL[r.source_type] || r.source_type}{r.reporter_contact ? `, kontak ${r.reporter_contact}` : ''}</div></td><td>{r.reported_depth}</td>
        <td>{r.photo_url ? <a href={r.photo_url} target="_blank" rel="noreferrer noopener"><img className="thumb sm" src={r.photo_url} alt="Foto laporan" /></a> : <span className="mu">Tanpa foto</span>}</td>
        <td><span className={`badge s-${r.verification_status}`}>{STATUS_LABEL[r.verification_status]}</span> {r.stale && <span className="badge kd">Kedaluwarsa</span>}</td><td>{ago(r.updated_at)}</td>
        <td><div className="acts">{r.verification_status !== 'ditolak' && <><button className="btn sm" onClick={() => act(r.id, 'verify')}><Icon n="check" s={14} />Verifikasi</button><button className="btn sm danger" onClick={() => act(r.id, 'reject')}><Icon n="x" s={14} />Tolak</button><button className="btn sm" onClick={() => act(r.id, 'refresh')}>Perbarui</button></>}
          {role === 'admin' && (conf === r.id ? <><button className="btn sm danger" onClick={() => del(r.id)}>Ya, hapus</button><button className="btn sm" onClick={() => setConf(null)}>Batal</button></> : <button className="btn sm danger" onClick={() => setConf(r.id)}><Icon n="trash" s={14} />Hapus</button>)}</div></td></tr>)}
      {!list.length && <tr><td colSpan="6" className="mu">Tidak ada laporan.</td></tr>}</tbody></table></div></div>);
}
