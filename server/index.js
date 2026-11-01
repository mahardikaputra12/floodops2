import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, save, nextId, net, uploadsDir } from './store.js';
import { priority, analyzeClosure, floodedSegments, recap, STATUS } from './analysis.js';

const app = express();
const SECRET = process.env.JWT_SECRET || 'dev-secret-ubah-di-produksi';
app.disable('x-powered-by');
app.use((q, r, n) => { r.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); n(); });
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ---------- Izin per tabel (RBAC): c=tambah, r=lihat, u=ubah, d=hapus ----------
export const PERM = {
  users: { admin: 'crud' },
  regions: { admin: 'crud', petugas: 'r', peneliti: 'r', pengguna: 'r' },
  road_segments: { admin: 'crud', petugas: 'r', peneliti: 'r', pengguna: 'r' },
  critical_facilities: { admin: 'crud', petugas: 'r', peneliti: 'r', pengguna: 'r' },
  flood_reports: { warga: 'c', pengguna: 'cr', petugas: 'cru', admin: 'rud', peneliti: 'r' },
  priority_scores: { pengguna: 'r', petugas: 'r', peneliti: 'r', admin: 'r' },
  simulation_runs: { petugas: 'cr', peneliti: 'r', admin: 'r' },
  audit_logs: { petugas: 'r', admin: 'r' },
  system_params: { petugas: 'r', peneliti: 'r', admin: 'ru' },
  export: { petugas: 'r', peneliti: 'r' }
};
export const PERM_NOTES = { 'flood_reports.warga': 'tanpa akun, dibatasi laju', 'flood_reports.pengguna': 'kontak pelapor disembunyikan', 'flood_reports.peneliti': 'kontak pelapor disembunyikan', 'priority_scores.pengguna': 'hanya kategori, tanpa skor dan alasan', 'audit_logs.petugas': 'hanya tindakan sendiri', 'roads.admin': 'hapus hanya bila tanpa laporan' };
const can = (role, res, act) => !!PERM[res]?.[role]?.includes(act);
const ROLES = ['pengguna', 'petugas', 'admin', 'peneliti'];
const PORTALS = { petugas: 'Petugas Penanganan Banjir', pengguna: 'Pengguna', admin: 'Administrator', peneliti: 'Peneliti / Pengelola Wilayah' };
const RISK = ['sangat_tinggi', 'tinggi', 'sedang_tinggi', 'sedang', 'rendah', 'belum_dinilai'];

const log = (u, action, object_type, object_id) => { db.audit_logs.unshift({ id: nextId('audit'), user_id: u?.id ?? null, user_name: u?.name ?? 'Warga', action, object_type, object_id, created_at: new Date().toISOString() }); db.audit_logs.length = Math.min(db.audit_logs.length, 500); };
const authn = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk kembali.' }); }
};
const guard = (resource, act) => [authn, (req, res, next) => (can(req.user.role, resource, act) ? next() : res.status(403).json({ error: 'Peran Anda tidak memiliki izin untuk tindakan ini pada data tersebut.' }))];
const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const by = (arr, id) => arr.find((x) => x.id === +id);

// ---------- Login terpisah per peran ----------
const fails = new Map();
app.post('/api/auth/login', (req, res) => {
  const portal = String(req.body.portal ?? '');
  if (!PORTALS[portal]) return bad(res, 'Portal masuk tidak dikenal.');
  const email = clean(req.body.email, 100).toLowerCase(), key = req.ip + email, f = fails.get(key) || { n: 0, t: 0 };
  if (f.n >= 5 && Date.now() - f.t < 5 * 60e3) return bad(res, 'Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.', 429);
  const u = db.users.find((x) => x.email === email);
  if (!u || !bcrypt.compareSync(String(req.body.password ?? ''), u.password_hash)) { fails.set(key, { n: f.n + 1, t: Date.now() }); return bad(res, 'Email atau kata sandi salah.', 401); }
  if (u.role !== portal) { log({ id: u.id, name: u.name }, `ditolak masuk lewat portal ${portal}`, 'user', u.id); save(); return bad(res, `Akun ini bukan akun ${PORTALS[portal]}. Gunakan halaman masuk yang sesuai dengan peran Anda.`, 403); }
  fails.delete(key);
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  log(user, 'login', 'user', u.id); save();
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
});
app.get('/api/permissions', authn, (req, res) => res.json({ perm: PERM, notes: PERM_NOTES }));

// ---------- Unggah foto (JPEG/PNG/WebP, maks. 3 MB, divalidasi dari isi berkas) ----------
const buckets = new Map();
const limited = (key, max = 5) => { const now = Date.now(), a = (buckets.get(key) || []).filter((t) => now - t < 600e3); a.push(now); buckets.set(key, a); return a.length > max; };
const rawImg = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '3mb' });
function saveImage(req, res) {
  const b = req.body;
  if (!Buffer.isBuffer(b) || !b.length) return bad(res, 'Berkas foto tidak ditemukan atau tipenya tidak didukung (JPEG, PNG, WebP).');
  const ext = b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpg' : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png' : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
  if (!ext) return bad(res, 'Isi berkas bukan gambar JPEG, PNG, atau WebP yang valid.');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(uploadsDir, name), b);
  res.status(201).json({ photo_url: '/uploads/' + name });
}
app.post('/api/uploads', ...guard('flood_reports', 'c'), rawImg, saveImage);
app.post('/api/public/uploads', (req, res, next) => (limited('up' + req.ip, 10) ? bad(res, 'Terlalu banyak unggahan dari perangkat ini. Coba lagi beberapa menit lagi.', 429) : next()), rawImg, saveImage);
app.use('/uploads', express.static(uploadsDir, { setHeaders: (r) => { r.setHeader('X-Content-Type-Options', 'nosniff'); r.setHeader('Content-Security-Policy', "default-src 'none'"); } }));

// ---------- Laporan ----------
function validateReport(b, allowPast) {
  const seg = by(db.segments, b.road_segment_id), depth = Number(b.reported_depth);
  if (!seg) return { error: 'Ruas jalan tidak ditemukan.' };
  if (b.reported_depth === '' || b.reported_depth == null || !Number.isFinite(depth) || depth < 0 || depth > 300) return { error: 'Kedalaman genangan harus berupa angka 0–300 cm.' };
  const at = allowPast && b.reported_at ? new Date(b.reported_at) : new Date();
  if (isNaN(at) || at > new Date(Date.now() + 60000)) return { error: 'Waktu laporan tidak valid.' };
  const photo = clean(b.photo_url, 300);
  if (photo && !/^(\/uploads\/[0-9a-f]{32}\.(jpg|png|webp)|https?:\/\/\S+)$/.test(photo)) return { error: 'Foto tidak valid. Unggah ulang foto Anda.' };
  return { seg, depth: Math.round(depth), at, photo: photo || null, description: clean(b.description, 200) || '(tanpa catatan)' };
}
const segName = (id) => db.segments.find((s) => s.id === id)?.road_name;
app.get('/api/public/segments', (req, res) => res.json(db.segments.map(({ id, road_name, region_id }) => ({ id, road_name, region_name: by(db.regions, region_id)?.region_name }))));
app.post('/api/public/reports', (req, res) => {
  if (req.body.website) return res.status(201).json({ tracking_code: 'LW-000000' });
  if (limited(req.ip)) return bad(res, 'Terlalu banyak laporan dari perangkat ini. Coba lagi beberapa menit lagi.', 429);
  const v = validateReport(req.body, false); if (v.error) return bad(res, v.error);
  const code = 'LW-' + crypto.randomBytes(3).toString('hex').toUpperCase(), now = v.at.toISOString();
  const r = { id: nextId('report'), road_segment_id: v.seg.id, reported_depth: v.depth, description: v.description, photo_url: v.photo, reported_at: now, updated_at: now,
    verification_status: STATUS.U, source_type: 'warga', tracking_code: code, reporter_contact: clean(req.body.reporter_contact, 60) || null, created_by: null };
  db.reports.push(r); log(null, 'laporan warga masuk', 'flood_report', r.id); save();
  res.status(201).json({ tracking_code: code, verification_status: r.verification_status });
});
app.get('/api/public/reports/:code', (req, res) => {
  if (limited('cek' + req.ip, 30)) return bad(res, 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
  const r = db.reports.find((x) => x.tracking_code === String(req.params.code).toUpperCase());
  if (!r) return bad(res, 'Kode laporan tidak ditemukan.', 404);
  res.json({ tracking_code: r.tracking_code, road_name: segName(r.road_segment_id), reported_depth: r.reported_depth, reported_at: r.reported_at, updated_at: r.updated_at, verification_status: r.verification_status });
});
app.get('/api/reports', ...guard('flood_reports', 'r'), (req, res) => {
  const { status, min, hours, source, mine } = req.query, now = Date.now(), seeContact = ['petugas', 'admin'].includes(req.user.role);
  const list = db.reports.filter((r) => (!status || r.verification_status === status) && (!source || r.source_type === source) && (!min || r.reported_depth >= +min) && (!hours || now - new Date(r.updated_at) <= +hours * 3600e3) && (!mine || r.created_by === req.user.id))
    .map((r) => ({ ...r, stale: now - new Date(r.updated_at) > db.params.staleHours * 3600e3, road_name: segName(r.road_segment_id), reporter_contact: seeContact ? r.reporter_contact : undefined }));
  res.json(list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});
app.post('/api/reports', ...guard('flood_reports', 'c'), (req, res) => {
  const v = validateReport(req.body, true); if (v.error) return bad(res, v.error);
  const r = { id: nextId('report'), road_segment_id: v.seg.id, reported_depth: v.depth, description: v.description, photo_url: v.photo, reported_at: v.at.toISOString(), updated_at: v.at.toISOString(),
    verification_status: STATUS.U, source_type: req.user.role === 'pengguna' ? 'pengguna' : 'petugas', created_by: req.user.id };
  db.reports.push(r); log(req.user, 'buat laporan', 'flood_report', r.id); save(); res.status(201).json(r);
});
app.patch('/api/reports/:id', ...guard('flood_reports', 'u'), (req, res) => {
  const r = by(db.reports, req.params.id); if (!r) return bad(res, 'Laporan tidak ditemukan.', 404);
  const a = req.body.action;
  if (a === 'verify') { r.verification_status = STATUS.V; r.updated_at = new Date().toISOString(); }
  else if (a === 'reject') { r.verification_status = STATUS.X; r.updated_at = new Date().toISOString(); }
  else if (a === 'refresh') { r.updated_at = new Date().toISOString(); if (req.body.reported_depth !== undefined) { const d = Number(req.body.reported_depth); if (!Number.isFinite(d) || d < 0 || d > 300) return bad(res, 'Kedalaman harus 0–300 cm.'); r.reported_depth = Math.round(d); } }
  else return bad(res, 'Aksi tidak dikenal.');
  log(req.user, `${a} laporan`, 'flood_report', r.id); save(); res.json(r);
});
app.delete('/api/reports/:id', ...guard('flood_reports', 'd'), (req, res) => {
  const i = db.reports.findIndex((x) => x.id === +req.params.id); if (i < 0) return bad(res, 'Laporan tidak ditemukan.', 404);
  db.reports.splice(i, 1); log(req.user, 'hapus laporan', 'flood_report', +req.params.id); save(); res.json({ ok: true });
});

// ---------- Jaringan, skor, rekap, simulasi, ekspor ----------
app.get('/api/network', authn, (req, res) => res.json({ ...net(), regions: db.regions, params: db.params }));
app.get('/api/priority', ...guard('priority_scores', 'r'), (req, res) => {
  const p = priority(net(), db.reports, db.params);
  if (req.user.role === 'pengguna') p.ranked = p.ranked.map((r) => ({ segment_id: r.segment_id, road_name: r.road_name, reported_depth: r.reported_depth, depth_score: r.depth_score, updated_at: r.updated_at, verification_status: r.verification_status, stale: r.stale, category: { key: r.category.key, label: r.category.label } }));
  res.json({ ...p, params: db.params });
});
app.get('/api/recap', ...guard('priority_scores', 'r'), (req, res) => {
  if (req.user.role === 'pengguna') return bad(res, 'Rekap wilayah tidak tersedia untuk peran Anda.', 403);
  res.json(recap(net(), db.regions, priority(net(), db.reports, db.params).ranked, db.reports, db.params));
});
app.post('/api/simulate', ...guard('simulation_runs', 'c'), (req, res) => {
  const seg = by(db.segments, req.body.segment_id); if (!seg) return bad(res, 'Pilih ruas jalan yang valid.');
  const avoidOn = req.body.avoid_flooded !== false;
  try {
    const flooded = avoidOn ? floodedSegments(net(), db.reports, db.params) : [];
    const result = { ...analyzeClosure(net(), seg, { avoid: flooded.map((f) => f.segment_id), speed: db.params.avgSpeedKmh }), avoid_flooded: avoidOn, block_depth: db.params.blockDepth, avoided: flooded.filter((f) => f.segment_id !== seg.id) };
    if (avoidOn) result.assumptions.push(`Ruas dengan laporan genangan di atas ${db.params.blockDepth} cm dianggap tidak dapat dilalui dan dihindari rute pengganti; laporan yang belum terverifikasi tetap diperhitungkan demi kehati-hatian.`);
    db.simulation_runs.unshift({ id: nextId('sim'), selected_road_segment_id: seg.id, road_name: seg.road_name, input_parameters: { segment_id: seg.id, avoid_flooded: avoidOn, speed_kmh: db.params.avgSpeedKmh }, result_summary: { pairs_lost: result.pairs_lost, pairs_total: result.pairs_total, max_add_min: result.max_add_min, max_add_km: result.max_add_km }, created_by: req.user.id, created_by_name: req.user.name, created_at: new Date().toISOString() });
    db.simulation_runs.length = Math.min(db.simulation_runs.length, 200);
    log(req.user, 'simulasi penutupan', 'simulation_run', seg.id); save(); res.json(result);
  } catch (e) { bad(res, 'Simulasi gagal dijalankan: ' + e.message, 500); }
});
app.get('/api/simulations', ...guard('simulation_runs', 'r'), (req, res) => res.json(db.simulation_runs.slice(0, 100)));
app.get('/api/export', ...guard('export', 'r'), (req, res) => {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`, P = priority(net(), db.reports, db.params);
  let rows, file;
  if (req.query.type === 'recap') {
    file = 'floodops-rekap-wilayah.csv';
    rows = [['wilayah', 'tingkat_kerawanan', 'ruas_total', 'ruas_ada_data', 'laporan_aktif', 'kedalaman_maks_cm', 'skor_rata_rata', 'ruas_prioritas_tinggi', 'ruas_terendam', 'fasilitas_total', 'fasilitas_berisiko'].join(',')]
      .concat(recap(net(), db.regions, P.ranked, db.reports, db.params).map((r) => [q(r.region_name), r.risk_level, r.segments_total, r.segments_with_data, r.reports_active, r.max_depth, r.avg_score ?? '', r.high_n, r.blocked_n, r.facilities_total, r.facilities_at_risk].join(',')));
  } else {
    file = 'floodops-ringkasan.csv';
    rows = [['peringkat', 'ruas', 'skor', 'kategori', 'genangan_cm', 'skala_genangan', 'skala_akses', 'skala_alternatif', 'status_verifikasi', 'kedaluwarsa', 'alasan'].join(',')]
      .concat(P.ranked.map((r, i) => [i + 1, q(r.road_name), r.total_score, q(r.category.label), r.reported_depth, r.depth_score, r.facility_impact_score, r.alternative_access_score, r.verification_status, r.stale ? 'ya' : 'tidak', q(r.reasons.join(' | '))].join(',')));
  }
  rows.push('', q('Alat bantu analisis, bukan keputusan resmi penanganan bencana. Data uji bersifat sintetis.'));
  log(req.user, 'ekspor ' + (req.query.type === 'recap' ? 'rekap wilayah' : 'ringkasan'), 'export', 0); save();
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"` }).send('\ufeff' + rows.join('\n'));
});
app.post('/api/ai/ringkasan', ...guard('export', 'r'), async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return bad(res, 'OPENROUTER_API_KEY belum diatur pada file .env.', 503);
  const top = priority(net(), db.reports, db.params).ranked.slice(0, 5).map((r) => ({ ruas: r.road_name, skor: r.total_score, kategori: r.category.label, alasan: r.reasons, status: r.verification_status, kedaluwarsa: r.stale }));
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', messages: [
        { role: 'system', content: 'Anda asisten analisis banjir. Ringkas data berikut dalam Bahasa Indonesia, maksimal 5 kalimat, tanpa menambah fakta di luar data. Tegaskan bahwa ini alat bantu, bukan keputusan resmi.' },
        { role: 'user', content: JSON.stringify(top) }] }) });
    const j = await r.json();
    if (!r.ok) return bad(res, j.error?.message || 'Layanan AI menolak permintaan.', 502);
    res.json({ text: j.choices?.[0]?.message?.content ?? '' });
  } catch (e) { bad(res, 'Tidak dapat menghubungi layanan AI: ' + e.message, 502); }
});

// ---------- Pengelolaan data master (admin) ----------
app.get('/api/audit', ...guard('audit_logs', 'r'), (req, res) => res.json(db.audit_logs.filter((a) => req.user.role === 'admin' || a.user_id === req.user.id).slice(0, 200)));
app.get('/api/params', ...guard('system_params', 'r'), (req, res) => res.json(db.params));
app.put('/api/params', ...guard('system_params', 'u'), (req, res) => {
  const w = req.body.weights || {}, sum = +w.depth + +w.access + +w.alt, h = +req.body.staleHours, sp = +req.body.avgSpeedKmh, bd = +req.body.blockDepth, lo = +req.body.depthLow, mid = +req.body.depthMid;
  if (![w.depth, w.access, w.alt].every((x) => x >= 0) || Math.abs(sum - 1) > 1e-6) return bad(res, 'Total bobot harus 100%.');
  if (!(h > 0) || !(sp > 0 && sp <= 120) || !(bd >= 0 && bd <= 300) || !(lo > 0 && mid > lo && mid <= 300)) return bad(res, 'Nilai parameter tidak valid (kecepatan 1–120 km/jam, batas kedalaman 0–300 cm, batas skala 1 < batas skala 2).');
  db.params = { ...db.params, weights: { depth: +w.depth, access: +w.access, alt: +w.alt }, staleHours: h, avgSpeedKmh: sp, blockDepth: bd, depthLow: lo, depthMid: mid };
  log(req.user, 'ubah parameter', 'system_params', 0); save(); res.json(db.params);
});

const adminCount = () => db.users.filter((u) => u.role === 'admin').length;
app.get('/api/users', ...guard('users', 'r'), (req, res) => res.json(db.users.map(({ password_hash, ...u }) => u)));
function userInput(b, creating) {
  const name = clean(b.name, 60), email = clean(b.email, 100).toLowerCase(), pw = String(b.password ?? '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !ROLES.includes(b.role)) return { error: 'Nama, email valid, dan peran wajib diisi.' };
  if ((creating || pw) && pw.length < 8) return { error: 'Kata sandi minimal 8 karakter.' };
  return { name, email, role: b.role, pw };
}
app.post('/api/users', ...guard('users', 'c'), (req, res) => {
  const v = userInput(req.body, true); if (v.error) return bad(res, v.error);
  if (db.users.some((u) => u.email === v.email)) return bad(res, 'Email sudah terdaftar.', 409);
  const u = { id: nextId('user'), name: v.name, email: v.email, role: v.role, password_hash: bcrypt.hashSync(v.pw, 10), created_at: new Date().toISOString() };
  db.users.push(u); log(req.user, 'tambah pengguna', 'user', u.id); save(); res.status(201).json({ id: u.id });
});
app.put('/api/users/:id', ...guard('users', 'u'), (req, res) => {
  const u = by(db.users, req.params.id); if (!u) return bad(res, 'Pengguna tidak ditemukan.', 404);
  const v = userInput(req.body, false); if (v.error) return bad(res, v.error);
  if (db.users.some((x) => x.email === v.email && x.id !== u.id)) return bad(res, 'Email sudah dipakai pengguna lain.', 409);
  if (u.role === 'admin' && v.role !== 'admin' && adminCount() <= 1) return bad(res, 'Tidak dapat mengubah peran administrator terakhir.', 409);
  Object.assign(u, { name: v.name, email: v.email, role: v.role }); if (v.pw) u.password_hash = bcrypt.hashSync(v.pw, 10);
  log(req.user, 'ubah pengguna', 'user', u.id); save(); res.json({ id: u.id });
});
app.delete('/api/users/:id', ...guard('users', 'd'), (req, res) => {
  const u = by(db.users, req.params.id); if (!u) return bad(res, 'Pengguna tidak ditemukan.', 404);
  if (u.id === req.user.id) return bad(res, 'Anda tidak dapat menghapus akun yang sedang dipakai.', 409);
  if (u.role === 'admin' && adminCount() <= 1) return bad(res, 'Tidak dapat menghapus administrator terakhir.', 409);
  db.users.splice(db.users.indexOf(u), 1); log(req.user, 'hapus pengguna', 'user', u.id); save(); res.json({ ok: true });
});

app.get('/api/regions', ...guard('regions', 'r'), (req, res) => res.json(db.regions));
function regionInput(b) {
  const region_name = clean(b.region_name, 60);
  if (!region_name) return { error: 'Nama wilayah wajib diisi.' };
  if (!RISK.includes(b.risk_level)) return { error: 'Tingkat kerawanan tidak valid.' };
  return { region_name, region_type: ['kecamatan', 'kelurahan', 'kawasan'].includes(b.region_type) ? b.region_type : 'kecamatan', risk_level: b.risk_level, main_cause: clean(b.main_cause, 120) };
}
app.post('/api/regions', ...guard('regions', 'c'), (req, res) => {
  const v = regionInput(req.body); if (v.error) return bad(res, v.error);
  if (db.regions.some((r) => r.region_name.toLowerCase() === v.region_name.toLowerCase())) return bad(res, 'Nama wilayah sudah ada.', 409);
  const r = { id: nextId('region'), ...v }; db.regions.push(r); log(req.user, 'tambah wilayah', 'region', r.id); save(); res.status(201).json(r);
});
app.put('/api/regions/:id', ...guard('regions', 'u'), (req, res) => {
  const r = by(db.regions, req.params.id); if (!r) return bad(res, 'Wilayah tidak ditemukan.', 404);
  const v = regionInput(req.body); if (v.error) return bad(res, v.error);
  if (db.regions.some((x) => x.id !== r.id && x.region_name.toLowerCase() === v.region_name.toLowerCase())) return bad(res, 'Nama wilayah sudah ada.', 409);
  Object.assign(r, v); log(req.user, 'ubah wilayah', 'region', r.id); save(); res.json(r);
});
app.delete('/api/regions/:id', ...guard('regions', 'd'), (req, res) => {
  const r = by(db.regions, req.params.id); if (!r) return bad(res, 'Wilayah tidak ditemukan.', 404);
  if (db.segments.some((s) => s.region_id === r.id) || db.facilities.some((f) => f.region_id === r.id)) return bad(res, 'Wilayah masih dipakai oleh ruas jalan atau fasilitas. Pindahkan datanya terlebih dahulu.', 409);
  db.regions.splice(db.regions.indexOf(r), 1); log(req.user, 'hapus wilayah', 'region', r.id); save(); res.json({ ok: true });
});

function segInput(b, creating) {
  const road_name = clean(b.road_name, 80), len = Number(b.road_length), region = by(db.regions, b.region_id);
  if (!road_name || !(len > 0 && len <= 50) || !region) return { error: 'Nama ruas, panjang (0–50 km), dan wilayah yang valid wajib diisi.' };
  if (creating && (!db.nodes[b.a] || !db.nodes[b.b] || b.a === b.b)) return { error: 'Pilih dua simpul persimpangan yang berbeda.' };
  return { road_name, road_length: len, region_id: region.id, a: b.a, b: b.b };
}
app.get('/api/segments', ...guard('road_segments', 'r'), (req, res) => res.json(db.segments));
app.post('/api/segments', ...guard('road_segments', 'c'), (req, res) => {
  const v = segInput(req.body, true); if (v.error) return bad(res, v.error);
  const s = { id: nextId('segment'), ...v }; db.segments.push(s); log(req.user, 'tambah ruas jalan', 'road_segment', s.id); save(); res.status(201).json(s);
});
app.put('/api/segments/:id', ...guard('road_segments', 'u'), (req, res) => {
  const s = by(db.segments, req.params.id); if (!s) return bad(res, 'Ruas tidak ditemukan.', 404);
  const v = segInput(req.body, false); if (v.error) return bad(res, v.error);
  Object.assign(s, { road_name: v.road_name, road_length: v.road_length, region_id: v.region_id }); log(req.user, 'ubah ruas jalan', 'road_segment', s.id); save(); res.json(s);
});
app.delete('/api/segments/:id', ...guard('road_segments', 'd'), (req, res) => {
  const s = by(db.segments, req.params.id); if (!s) return bad(res, 'Ruas tidak ditemukan.', 404);
  if (db.reports.some((r) => r.road_segment_id === s.id)) return bad(res, 'Ruas masih memiliki laporan. Hapus laporan terkait terlebih dahulu.', 409);
  db.segments.splice(db.segments.indexOf(s), 1); log(req.user, 'hapus ruas jalan', 'road_segment', s.id); save(); res.json({ ok: true });
});

function facInput(b) {
  const name = clean(b.facility_name, 80), region = by(db.regions, b.region_id);
  if (!name || !db.nodes[b.node] || !region || !['rumah_sakit', 'puskesmas', 'sekolah', 'pusat_evakuasi'].includes(b.facility_type)) return { error: 'Nama, jenis, simpul lokasi, dan wilayah wajib valid.' };
  return { facility_name: name, name, facility_type: b.facility_type, node: b.node, region_id: region.id };
}
app.get('/api/facilities', ...guard('critical_facilities', 'r'), (req, res) => res.json(db.facilities));
app.post('/api/facilities', ...guard('critical_facilities', 'c'), (req, res) => {
  const v = facInput(req.body); if (v.error) return bad(res, v.error);
  const f = { id: nextId('facility'), ...v }; db.facilities.push(f); log(req.user, 'tambah fasilitas', 'critical_facility', f.id); save(); res.status(201).json(f);
});
app.put('/api/facilities/:id', ...guard('critical_facilities', 'u'), (req, res) => {
  const f = by(db.facilities, req.params.id); if (!f) return bad(res, 'Fasilitas tidak ditemukan.', 404);
  const v = facInput(req.body); if (v.error) return bad(res, v.error);
  Object.assign(f, v); log(req.user, 'ubah fasilitas', 'critical_facility', f.id); save(); res.json(f);
});
app.delete('/api/facilities/:id', ...guard('critical_facilities', 'd'), (req, res) => {
  const f = by(db.facilities, req.params.id); if (!f) return bad(res, 'Fasilitas tidak ditemukan.', 404);
  if (db.facilities.length <= 1) return bad(res, 'Minimal satu fasilitas penting harus tersedia untuk analisis akses.', 409);
  db.facilities.splice(db.facilities.indexOf(f), 1); log(req.user, 'hapus fasilitas', 'critical_facility', f.id); save(); res.json({ ok: true });
});

app.use('/api', (req, res) => bad(res, 'Endpoint tidak ditemukan.', 404));
app.use((err, req, res, next) => bad(res, err.type === 'entity.too.large' ? 'Ukuran berkas melebihi batas (maks. 3 MB).' : 'Terjadi kesalahan pada server.', err.status || 500));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^(?!\/api|\/uploads).*/, (q, r) => r.sendFile(path.join(dist, 'index.html'))); }
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FloodOps API berjalan di http://localhost:${PORT}`));
