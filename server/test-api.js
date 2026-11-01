// Uji integrasi API: menjalankan server pada port acak dengan data sementara, lalu memeriksa izin per tabel. Jalankan: npm run test:api
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const port = 4100 + Math.floor(Math.random() * 500), B = `http://localhost:${port}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'floodops-'));
const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), FLOODOPS_DATA_DIR: tmp }, stdio: 'ignore' });
const j = (p, o = {}, tok) => fetch(B + '/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => ({ s: r.status, d: await r.json().catch(() => ({})) }));
const up = (p, buf, type, tok) => fetch(B + '/api' + p, { method: 'POST', headers: { 'Content-Type': type, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: buf }).then(async (r) => ({ s: r.status, d: await r.json().catch(() => ({})) }));
const login = (email, password, portal) => j('/auth/login', { method: 'POST', body: { email, password, portal } });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('  ✓', name); };
try {
  for (let i = 0; i < 40; i++) { try { await fetch(B + '/api/public/segments'); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
  await t('login hanya berhasil lewat portal yang sesuai (empat peran; 403 bila salah portal, 400 tanpa portal)', async () => {
    assert.equal((await login('petugas@floodops.id', 'petugas123', 'admin')).s, 403);
    assert.equal((await login('peneliti@floodops.id', 'peneliti123', 'petugas')).s, 403);
    assert.equal((await login('admin@floodops.id', 'admin123', undefined)).s, 400);
    for (const r of ['petugas', 'pengguna', 'admin', 'peneliti']) assert.equal((await login(`${r}@floodops.id`, `${r}123`, r)).s, 200);
  });
  const tok = {}; for (const r of ['petugas', 'pengguna', 'admin', 'peneliti']) tok[r] = (await login(`${r}@floodops.id`, `${r}123`, r)).d.token;
  const st = async (path, o, role) => (await j(path, o, tok[role])).s;
  await t('izin per tabel: setiap peran hanya dapat mengakses tabel/tindakan miliknya (403 untuk selain itu)', async () => {
    const seg12 = { method: 'POST', body: { segment_id: 12 } }, rep = { method: 'POST', body: { road_segment_id: 8, reported_depth: 10 } }, ver = { method: 'PATCH', body: { action: 'verify' } };
    assert.deepEqual([await st('/simulate', seg12, 'pengguna'), await st('/simulate', seg12, 'peneliti'), await st('/simulate', seg12, 'admin')], [403, 403, 403]);
    assert.deepEqual([await st('/export', {}, 'pengguna'), await st('/export', {}, 'admin')], [403, 403]);
    assert.deepEqual([await st('/reports', rep, 'peneliti'), await st('/reports', rep, 'admin')], [403, 403]);
    assert.deepEqual([await st('/reports/1', ver, 'pengguna'), await st('/reports/1', ver, 'peneliti')], [403, 403]);
    assert.deepEqual([await st('/users', {}, 'petugas'), await st('/users', {}, 'peneliti'), await st('/users', {}, 'pengguna')], [403, 403, 403]);
    assert.deepEqual([await st('/regions', { method: 'POST', body: {} }, 'petugas'), await st('/facilities', { method: 'POST', body: {} }, 'pengguna')], [403, 403]);
    assert.equal(await st('/reports/1', { method: 'DELETE' }, 'petugas'), 403);
    assert.equal(await st('/params', { method: 'PUT', body: {} }, 'petugas'), 403);
    assert.equal(await st('/priority', {}, undefined), 401);
    assert.deepEqual([await st('/audit', {}, 'pengguna'), await st('/audit', {}, 'peneliti')], [403, 403]);
  });
  await t('Pengguna hanya melihat peta/dashboard: skor dan alasan disembunyikan di server; Peneliti melihat penuh (hanya baca)', async () => {
    const p = (await j('/priority', {}, tok.pengguna)).d.ranked[0]; assert.equal(p.total_score, undefined); assert.equal(p.reasons, undefined); assert.ok(p.category.label);
    assert.ok((await j('/priority', {}, tok.peneliti)).d.ranked[0].reasons.length);
    assert.equal((await j('/recap', {}, tok.pengguna)).s, 403);
    const rc = (await j('/recap', {}, tok.peneliti)).d; assert.equal(rc.length, 10); assert.ok(rc.some((r) => r.region_name === 'Gedebage'));
    assert.match(await (await fetch(B + '/api/export?type=recap', { headers: { Authorization: 'Bearer ' + tok.peneliti } })).text(), /wilayah,tingkat_kerawanan/);
  });
  await t('simulasi: tambahan jarak dan waktu, ruas terendam dihindari (Jl. Rancabolang: +2,9 km, +5,8 menit)', async () => {
    const r = (await j('/simulate', { method: 'POST', body: { segment_id: 18 } }, tok.petugas)).d;
    assert.equal(r.max_add_km, 2.9); assert.equal(r.max_add_min, 5.8); assert.equal(r.speed_kmh, 30); assert.deepEqual(r.avoided.map((a) => a.segment_id).sort((a, b) => a - b), [1, 7, 17]);
    assert.equal((await j('/simulate', { method: 'POST', body: { segment_id: 9 } }, tok.petugas)).d.pairs_lost, 14);
    assert.equal((await j('/simulate', { method: 'POST', body: { segment_id: 9, avoid_flooded: false } }, tok.petugas)).d.pairs_lost, 0);
    assert.equal((await j('/simulate', { method: 'POST', body: { segment_id: 12, avoid_flooded: false } }, tok.petugas)).d.pairs_lost, 7);
    assert.ok((await j('/simulations', {}, tok.peneliti)).d.length >= 4);
  });
  await t('admin CRUD wilayah: tambah, ubah, hapus; hapus ditolak (409) bila masih dipakai ruas', async () => {
    const c = await j('/regions', { method: 'POST', body: { region_name: 'Wilayah Uji', risk_level: 'sedang', main_cause: 'uji' } }, tok.admin); assert.equal(c.s, 201);
    assert.equal((await j('/regions', { method: 'POST', body: { region_name: 'wilayah uji', risk_level: 'sedang' } }, tok.admin)).s, 409);
    assert.equal((await j('/regions/' + c.d.id, { method: 'PUT', body: { region_name: 'Wilayah Uji 2', risk_level: 'tinggi' } }, tok.admin)).s, 200);
    assert.equal((await j('/regions/8', { method: 'DELETE' }, tok.admin)).s, 409);
    assert.equal((await j('/regions/' + c.d.id, { method: 'DELETE' }, tok.admin)).s, 200);
  });
  await t('admin CRUD pengguna, ruas jalan, fasilitas; administrator terakhir dan akun sendiri dilindungi', async () => {
    const u = await j('/users', { method: 'POST', body: { name: 'Uji', email: 'uji@floodops.id', password: 'rahasia123', role: 'peneliti' } }, tok.admin); assert.equal(u.s, 201);
    assert.equal((await j('/users/' + u.d.id, { method: 'PUT', body: { name: 'Uji 2', email: 'uji@floodops.id', role: 'petugas' } }, tok.admin)).s, 200);
    assert.equal((await j('/users/' + u.d.id, { method: 'DELETE' }, tok.admin)).s, 200);
    const me = (await j('/users', {}, tok.admin)).d.find((x) => x.role === 'admin');
    assert.equal((await j('/users/' + me.id, { method: 'DELETE' }, tok.admin)).s, 409);
    assert.equal((await j('/users/' + me.id, { method: 'PUT', body: { name: me.name, email: me.email, role: 'petugas' } }, tok.admin)).s, 409);
    const s = await j('/segments', { method: 'POST', body: { road_name: 'Jl. Uji', a: 'A', b: 'M', road_length: 3, region_id: 1 } }, tok.admin); assert.equal(s.s, 201);
    assert.equal((await j('/segments/' + s.d.id, { method: 'PUT', body: { road_name: 'Jl. Uji 2', road_length: 4, region_id: 2 } }, tok.admin)).s, 200);
    assert.equal((await j('/segments/' + s.d.id, { method: 'DELETE' }, tok.admin)).s, 200);
    assert.equal((await j('/segments/17', { method: 'DELETE' }, tok.admin)).s, 409);
    const f = await j('/facilities', { method: 'POST', body: { facility_name: 'Puskesmas Uji', facility_type: 'puskesmas', node: 'F', region_id: 4 } }, tok.admin); assert.equal(f.s, 201);
    assert.equal((await j('/facilities/' + f.d.id, { method: 'DELETE' }, tok.admin)).s, 200);
  });
  await t('unggah foto: hanya gambar valid (cek isi berkas), tersimpan dan dapat dibuka; laporan memakai tautan unggahan', async () => {
    assert.equal((await up('/uploads', Buffer.from('bukan gambar'), 'image/png', tok.pengguna)).s, 400);
    assert.equal((await up('/uploads', PNG, 'image/png', undefined)).s, 401);
    assert.equal((await up('/uploads', PNG, 'text/html', tok.pengguna)).d.photo_url, undefined);
    const u = await up('/uploads', PNG, 'image/png', tok.pengguna); assert.equal(u.s, 201); assert.match(u.d.photo_url, /^\/uploads\/[0-9a-f]{32}\.png$/);
    const img = await fetch(B + u.d.photo_url); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
    const r = await j('/reports', { method: 'POST', body: { road_segment_id: 8, reported_depth: 20, photo_url: u.d.photo_url } }, tok.pengguna); assert.equal(r.s, 201); assert.equal(r.d.photo_url, u.d.photo_url);
    assert.equal((await j('/reports', { method: 'POST', body: { road_segment_id: 8, reported_depth: 20, photo_url: '/uploads/../../etc/passwd' } }, tok.pengguna)).s, 400);
    const pub = await up('/public/uploads', PNG, 'image/png'); assert.equal(pub.s, 201);
    assert.equal((await j('/reports?mine=1', {}, tok.pengguna)).d.length, 1);
  });
  let code, id;
  await t('laporan warga tanpa login: validasi, kode pelacakan, status belum terverifikasi', async () => {
    assert.equal((await j('/public/reports', { method: 'POST', body: { road_segment_id: 8, reported_depth: -5 } })).s, 400);
    const r = await j('/public/reports', { method: 'POST', body: { road_segment_id: 8, reported_depth: 45, reporter_contact: '0812' } }); assert.equal(r.s, 201); code = r.d.tracking_code;
    assert.match(code, /^LW-[0-9A-F]{6}$/); assert.equal((await j('/public/reports/' + code)).d.verification_status, 'belum_terverifikasi');
  });
  await t('kontak warga hanya terlihat Petugas/Admin; verifikasi mengubah status yang dilihat warga', async () => {
    const mine = (await j('/reports?source=warga', {}, tok.petugas)).d.find((r) => r.tracking_code === code); id = mine.id;
    assert.equal(mine.reporter_contact, '0812');
    for (const role of ['pengguna', 'peneliti']) assert.equal((await j('/reports?source=warga', {}, tok[role])).d.find((r) => r.tracking_code === code).reporter_contact, undefined);
    assert.equal((await j('/reports/' + id, { method: 'PATCH', body: { action: 'verify' } }, tok.petugas)).s, 200);
    assert.equal((await j('/public/reports/' + code)).d.verification_status, 'terverifikasi');
    assert.equal((await j('/reports/' + id, { method: 'DELETE' }, tok.admin)).s, 200);
  });
  await t('petugas hanya melihat riwayat tindakannya sendiri; admin melihat semua; matriks izin tersedia', async () => {
    const own = (await j('/audit', {}, tok.petugas)).d, all = (await j('/audit', {}, tok.admin)).d;
    assert.ok(own.every((a) => a.user_name === 'Petugas Demo')); assert.ok(all.length > own.length);
    assert.equal((await j('/permissions', {}, tok.peneliti)).d.perm.users.admin, 'crud');
  });
  await t('parameter: hanya Admin; bobot harus 100%; kecepatan dan batas terendam tervalidasi', async () => {
    const ok = { weights: { depth: .4, access: .35, alt: .25 }, staleHours: 24, avgSpeedKmh: 30, blockDepth: 60, depthLow: 20, depthMid: 50 };
    assert.equal((await j('/params', { method: 'PUT', body: { ...ok, weights: { depth: .5, access: .5, alt: .5 } } }, tok.admin)).s, 400);
    assert.equal((await j('/params', { method: 'PUT', body: { ...ok, avgSpeedKmh: 0 } }, tok.admin)).s, 400);
    assert.equal((await j('/params', { method: 'PUT', body: { ...ok, avgSpeedKmh: 40 } }, tok.admin)).s, 200);
    assert.equal((await j('/simulate', { method: 'POST', body: { segment_id: 18 } }, tok.petugas)).d.speed_kmh, 40);
  });
  await t('pembatasan: laporan warga ke-6 dalam 10 menit ditolak (429); anti brute force login ke-6 ditolak (429)', async () => {
    let last; for (let i = 0; i < 6; i++) last = (await j('/public/reports', { method: 'POST', body: { road_segment_id: 8, reported_depth: 10 } })).s; assert.equal(last, 429);
    for (let i = 0; i < 6; i++) last = (await login('admin@floodops.id', 'salah', 'admin')).s; assert.equal(last, 429);
  });
  console.log(`\n${n} kelompok uji API lulus.`);
} catch (e) { console.error('GAGAL:', e.message); process.exitCode = 1; } finally { srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
