import { useState } from 'react';
import { api } from '../api.js';
import PhotoField from './PhotoField.jsx';
const PRESETS = [['Mata kaki', 10], ['Betis', 30], ['Lutut', 50], ['Paha', 80]];
export default function ReportForm({ net, onDone, allowOld }) {
  const [n, setN] = useState({ road_segment_id: '', reported_depth: '', description: '', photo_url: '', old: false }), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setMsg(null);
    try { await api('/reports', { method: 'POST', body: { ...n, road_segment_id: +n.road_segment_id, reported_at: n.old ? new Date(Date.now() - 30 * 3600e3).toISOString() : undefined } });
      setMsg({ o: 'Laporan terkirim dengan status belum terverifikasi.' }); setN({ ...n, description: '', photo_url: '', reported_depth: '' }); onDone?.(); } catch (x) { setMsg({ e: x.message }); } setBusy(false); };
  return (<form onSubmit={submit}>
    <div className="fgrid">
      <div><label>Ruas jalan</label><select required value={n.road_segment_id} onChange={(e) => setN({ ...n, road_segment_id: e.target.value })}><option value="">Pilih ruas</option>{net?.segments.map((s) => <option key={s.id} value={s.id}>{s.road_name}</option>)}</select></div>
      <div><label>Kedalaman genangan (cm)</label><input type="number" required min="0" max="300" value={n.reported_depth} onChange={(e) => setN({ ...n, reported_depth: e.target.value })} placeholder="Contoh: 30" /></div>
    </div>
    <div className="row" style={{ marginTop: 8 }}>{PRESETS.map(([t, v]) => <button type="button" key={t} className="btn sm" onClick={() => setN({ ...n, reported_depth: v })}>{t}, sekitar {v} cm</button>)}</div>
    <label>Catatan</label><textarea rows="3" maxLength="200" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} placeholder="Kondisi di lapangan" />
    <label>Foto (opsional)</label><PhotoField value={n.photo_url} onChange={(v) => setN({ ...n, photo_url: v })} />
    {allowOld && <label className="chk"><input type="checkbox" checked={n.old} onChange={(e) => setN({ ...n, old: e.target.checked })} />Catat sebagai pengamatan 30 jam lalu (uji data kedaluwarsa)</label>}
    <p><button className="btn pri" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan'}</button></p>
    {msg?.o && <div className="ok">{msg.o}</div>}{msg?.e && <div className="err">{msg.e}</div>}
    <p className="mu">Waktu laporan dicatat otomatis. Laporan berstatus belum terverifikasi sampai diperiksa petugas.</p></form>);
}
