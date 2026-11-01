let token = localStorage.getItem('fo_token') || '';
export const setToken = (t) => { token = t; t ? localStorage.setItem('fo_token', t) : localStorage.removeItem('fo_token'); };
export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (opts.raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { setToken(''); location.reload(); }
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}
export const ago = (iso) => { const h = (Date.now() - new Date(iso)) / 3600e3; return h < 1 ? Math.max(1, Math.round(h * 60)) + ' mnt lalu' : h < 48 ? Math.round(h) + ' jam lalu' : Math.round(h / 24) + ' hari lalu'; };
export const STATUS_LABEL = { terverifikasi: 'Terverifikasi', belum_terverifikasi: 'Belum terverifikasi', ditolak: 'Ditolak' };

export async function uploadPhoto(blob, pub) {
  const res = await fetch('/api' + (pub ? '/public' : '') + '/uploads', { method: 'POST', headers: { 'Content-Type': blob.type, ...(token && !pub ? { Authorization: 'Bearer ' + token } : {}) }, body: blob });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Unggah foto gagal.');
  return d.photo_url;
}
export const RISK_LABEL = { sangat_tinggi: 'Sangat tinggi', tinggi: 'Tinggi', sedang_tinggi: 'Sedang hingga tinggi', sedang: 'Sedang', rendah: 'Rendah', belum_dinilai: 'Belum dinilai' };
export const ROLE_LABEL = { pengguna: 'Pengguna', petugas: 'Petugas Penanganan Banjir', admin: 'Administrator', peneliti: 'Peneliti / Pengelola Wilayah' };
export const SOURCE_LABEL = { warga: 'Warga', pengguna: 'Pengguna', petugas: 'Petugas', sintetis: 'Data uji' };
export async function downloadFile(path, name) {
  const res = await api(path, { raw: true }), b = await res.blob(), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
