import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
export function useList(path) {
  const [rows, setRows] = useState([]), [err, setErr] = useState('');
  const load = useCallback(() => api(path).then((r) => { setRows(r); setErr(''); }).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return [rows, load, err];
}
// Halaman pengelolaan satu model/tabel: daftar, tambah, ubah, hapus (dengan konfirmasi).
export default function Crud({ title, intro, rows, columns, fields, onSave, onDelete, canCreate = true, canEdit = true, canDelete = true, createLabel = 'Tambah data', error }) {
  const [edit, setEdit] = useState(null), [vals, setVals] = useState({}), [err, setErr] = useState(''), [ok, setOk] = useState(''), [conf, setConf] = useState(null);
  const open = (row) => { setEdit(row || {}); setVals(row ? { ...row, password: '' } : Object.fromEntries(fields.map((f) => [f.key, f.default ?? '']))); setErr(''); setOk(''); };
  const submit = async (e) => { e.preventDefault(); try { await onSave(vals, edit.id); setOk(edit.id ? 'Perubahan disimpan.' : 'Data ditambahkan.'); setEdit(null); } catch (x) { setErr(x.message); } };
  const del = async (r) => { try { await onDelete(r); setOk('Data dihapus.'); setConf(null); } catch (x) { setErr(x.message); setConf(null); } };
  const F = ({ f }) => {
    const v = vals[f.key] ?? '', set = (x) => setVals({ ...vals, [f.key]: x });
    return (<div className={f.full ? 'full' : ''}><label>{f.label}{f.type === 'password' && edit.id ? ' (kosongkan jika tidak diubah)' : ''}</label>
      {f.type === 'select' ? <select required={f.required !== false} value={v} onChange={(e) => set(e.target.value)} disabled={f.createOnly && !!edit.id}><option value="">Pilih</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === 'textarea' ? <textarea rows="2" value={v} onChange={(e) => set(e.target.value)} />
        : <input type={f.type || 'text'} required={f.required !== false && !(f.type === 'password' && edit.id)} step={f.step} min={f.min} max={f.max} minLength={f.type === 'password' && !edit.id ? 8 : undefined} value={v} onChange={(e) => set(e.target.value)} />}
      {f.hint && <span className="mu">{f.hint}</span>}</div>);
  };
  return (<div className="card">
    <div className="ch"><h2>{title}</h2>{canCreate && !edit && <button className="btn pri" onClick={() => open(null)}><Icon n="plus" s={16} />{createLabel}</button>}</div>
    {intro && <p className="mu" style={{ marginTop: -4 }}>{intro}</p>}
    {error && <div className="err">{error}</div>}{ok && <div className="ok">{ok}</div>}{!edit && err && <div className="err">{err}</div>}
    {edit && <form onSubmit={submit} className="card" style={{ background: 'var(--sf2)', marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>{edit.id ? 'Ubah data' : createLabel}</h3>
      <div className="fgrid">{fields.filter((f) => !(f.createOnly && edit.id && f.type !== 'select')).map((f) => <F key={f.key} f={f} />)}</div>
      {err && <div className="err">{err}</div>}<div className="row" style={{ marginTop: 14 }}><button className="btn pri">Simpan</button><button type="button" className="btn" onClick={() => setEdit(null)}>Batal</button></div></form>}
    <div className="scroll"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{(canEdit || canDelete) && <th>Aksi</th>}</tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}
        {(canEdit || canDelete) && <td><div className="acts">{canEdit && <button className="btn sm" onClick={() => open(r)}><Icon n="edit" s={14} />Ubah</button>}
          {canDelete && (conf === r.id ? <><button className="btn sm danger" onClick={() => del(r)}>Ya, hapus</button><button className="btn sm" onClick={() => setConf(null)}>Batal</button></> : <button className="btn sm danger" onClick={() => setConf(r.id)}><Icon n="trash" s={14} />Hapus</button>)}</div></td>}</tr>)}
      {!rows.length && <tr><td colSpan={columns.length + 1} className="mu">Belum ada data.</td></tr>}</tbody></table></div>
  </div>);
}
