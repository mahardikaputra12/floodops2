import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MapView from '../components/MapView.jsx';
import Icon from '../components/Icon.jsx';

const statusOf = (r) => r.unreachable_before ? ['Sudah terputus akibat genangan', 'kd'] : r.disconnected ? ['Terputus', 't-tinggi'] : r.add_km > 0 ? ['Rute memutar', 't-menengah'] : ['Tidak terdampak', 's-terverifikasi'];
export default function Simulation({ net, prio, initial }) {
  const [id, setId] = useState(initial || ''), [avoid, setAvoid] = useState(true), [res, setRes] = useState(null), [sel, setSel] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const run = async (sid = id, av = avoid) => {
    if (!sid) return setErr('Pilih satu ruas jalan terlebih dahulu.');
    setBusy(true); setErr('');
    try { const r = await api('/simulate', { method: 'POST', body: { segment_id: +sid, avoid_flooded: av } }); setRes(r); const first = r.rows.find((x) => x.disconnected) || [...r.rows].sort((a, b) => (b.add_min ?? 0) - (a.add_min ?? 0))[0]; setSel(first?.settlement ?? null); }
    catch (e) { setRes(null); setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (initial) { setId(initial); run(initial); } }, [initial]);
  const ll = (n) => [net.nodes[n].lat, net.nodes[n].lng], row = res?.rows.find((r) => r.settlement === sel);
  const routes = row ? [row.route_before && { kind: 'before', coords: row.route_before.nodes.map(ll) }, row.route_after && { kind: 'after', coords: row.route_after.nodes.map(ll) }].filter(Boolean) : [];
  const dest = row?.after && net.facilities.find((f) => f.name === row.after.facility), marks = row ? [{ lat: ll(row.settlement)[0], lng: ll(row.settlement)[1], color: '#0e8a8a', label: `Asal: ${row.settlement_name}` }, ...(dest ? [{ lat: ll(dest.node)[0], lng: ll(dest.node)[1], color: '#2563eb', label: `Tujuan: ${dest.name}` }] : [])] : [];
  const S = ({ b, l }) => <div className="s2"><b>{b}</b><span>{l}</span></div>;
  return (<div className="grid two">
    <div className="card"><div className="ch"><div className="row"><span className="sim">SIMULASI</span><span className="mu">Data simulasi dipisahkan dari laporan nyata.</span></div></div>
      <MapView sim net={net} ranked={prio.ranked} selected={+id || null} onSelect={(s) => { setId(s); setRes(null); }} closed={res?.segment_id} avoided={res?.avoided.map((a) => a.segment_id) ?? []} lostFacilities={res?.lost_facility_ids ?? []} routes={routes} marks={marks} /></div>
    <div className="card"><h2>Simulasi penutupan satu ruas jalan</h2>
      <label>Ruas yang akan ditutup</label><select value={id} onChange={(e) => { setId(e.target.value); setRes(null); }}><option value="">Pilih ruas</option>{net?.segments.map((s) => <option key={s.id} value={s.id}>{s.road_name}</option>)}</select>
      <label className="chk"><input type="checkbox" checked={avoid} onChange={(e) => { setAvoid(e.target.checked); setRes(null); }} />Hindari ruas yang sedang terendam (genangan di atas {net?.params.blockDepth} cm)</label>
      <p><button className="btn pri" disabled={busy} onClick={() => run()}><Icon n="route" s={16} />{busy ? 'Menghitung…' : 'Jalankan simulasi'}</button></p>
      {err && <div className="err">{err}</div>}
      {res && <>
        <h3>Perbandingan sebelum dan sesudah penutupan: {res.road_name}</h3>
        <div className="stat2">
          <S b={`${res.pairs_total - res.pairs_lost} dari ${res.pairs_total}`} l="hubungan permukiman dan fasilitas tetap tersambung" />
          <S b={`${res.max_add_min} menit`} l={`tambahan waktu terbesar (rata-rata ${res.avg_add_min} menit)`} />
          <S b={`${res.max_add_km} km`} l="tambahan jarak terbesar" />
        </div>
        {res.pairs_lost > 0 && <div className="note" style={{ marginBottom: 12 }}>{res.lost_facility_ids.length} fasilitas kehilangan akses dari sebagian permukiman: {[...new Set(res.lost_pairs.map((l) => l.settlement_name))].join(', ')}.</div>}
        <div className="scroll"><table><thead><tr><th>Permukiman</th><th>Sebelum</th><th>Sesudah</th><th>Tambahan</th><th>Status</th></tr></thead><tbody>
          {res.rows.map((r) => { const [t, c] = statusOf(r); return (<tr key={r.settlement} className={'clk' + (sel === r.settlement ? ' sel' : '')} onClick={() => setSel(r.settlement)}>
            <td><b>{r.settlement_name}</b></td>
            <td>{r.before ? <>{r.before.facility}<div className="mu">{r.before.km} km, {r.before.minutes} menit</div></> : <span className="mu">Tidak ada rute</span>}</td>
            <td>{r.disconnected ? <b className="hi">Tidak ada rute</b> : r.after ? <>{r.after.facility}<div className="mu">{r.after.km} km, {r.after.minutes} menit</div></> : <span className="mu">Tidak ada rute</span>}</td>
            <td>{r.add_km != null ? <>+{r.add_km} km<div className="mu">+{r.add_min} menit{r.detour_pct > 0 ? `, +${r.detour_pct}%` : ''}</div></> : <span className="mu">Tidak tersedia</span>}</td>
            <td><span className={`badge ${c}`}>{t}</span></td></tr>); })}</tbody></table></div>
        <p className="mu">Klik satu baris untuk menampilkan rute sebelum (titik abu-abu) dan rute pengganti (garis biru) pada peta.</p>
        {res.avoided.length > 0 && <><h3>Ruas terendam yang dihindari rute pengganti</h3><div>{res.avoided.map((a) => <span key={a.segment_id} className="chip">{a.road_name}, {a.depth} cm</span>)}</div></>}
        <div className="note" style={{ marginTop: 12 }}><b>Asumsi dan keterbatasan simulasi:</b><ul className="why">{res.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></div></>}
      {!res && !err && <p className="mu">Pilih ruas pada peta atau daftar, lalu jalankan untuk melihat jarak dan tambahan waktu rute pengganti ke fasilitas penting.</p>}
    </div></div>);
}
