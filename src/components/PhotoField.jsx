import { useState } from 'react';
import { uploadPhoto } from '../api.js';
import Icon from './Icon.jsx';
// Foto dikecilkan (maks. 1280 px) dan dienkode ulang di perangkat sebelum diunggah; data lokasi (EXIF) ikut terhapus.
async function shrink(file) {
  const bmp = await createImageBitmap(file), sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}
export default function PhotoField({ value, onChange, pub }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const pick = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; setErr('');
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr('Pilih foto berformat JPEG, PNG, atau WebP.');
    if (f.size > 15e6) return setErr('Ukuran foto terlalu besar (maksimal 15 MB sebelum dikompres).');
    setBusy(true);
    try { const blob = await shrink(f); if (!blob) throw new Error('Foto tidak dapat diproses.'); onChange(await uploadPhoto(blob, pub)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (<div><div className="photo">
    {value ? <><img className="thumb" src={value} alt="Foto laporan" /><button type="button" className="btn sm danger" onClick={() => onChange('')}><Icon n="trash" s={14} />Hapus foto</button></>
      : <label className="drop"><Icon n="camera" />{busy ? 'Mengunggah foto…' : 'Pilih atau ambil foto'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pick} disabled={busy} /></label>}
  </div><span className="mu">Foto dikompres dan data lokasi (EXIF) dihapus sebelum diunggah.</span>{err && <div className="err">{err}</div>}</div>);
}
