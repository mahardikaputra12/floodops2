// Penyimpanan data lokal berbasis file JSON agar proyek langsung jalan tanpa konfigurasi.
// Skema tabel PostgreSQL/Supabase yang setara ada di supabase/schema.sql (PRD bagian 12).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodes, segments, facilities, regions, seedReports, seedUsers } from './seed.js';
import { DEFAULT_PARAMS } from './analysis.js';
const dir = process.env.FLOODOPS_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const file = path.join(dir, 'db.json');
export const DB_VERSION = 3;
export const uploadsDir = path.join(dir, 'uploads');
const fresh = () => ({ v: DB_VERSION, nodes, regions, segments, facilities, reports: seedReports(), users: seedUsers(), params: DEFAULT_PARAMS, simulation_runs: [], audit_logs: [], seq: { report: 100, user: 100, sim: 1, audit: 1, facility: 100, region: 100, segment: 100 } });
export let db;
try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { db = fresh(); }
// Struktur data berubah (wilayah, izin per tabel): data lama dari versi sebelumnya diganti dengan data uji.
if (db.v !== DB_VERSION) db = fresh();
db.params = { ...DEFAULT_PARAMS, ...db.params, weights: { ...DEFAULT_PARAMS.weights, ...db.params?.weights } };
export const save = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(db, null, 1)); } catch (e) { console.error('Gagal menyimpan data:', e.message); } };
export const resetDb = () => { db = fresh(); save(); return db; };
export const nextId = (k) => db.seq[k]++;
export const net = () => ({ nodes: db.nodes, segments: db.segments, facilities: db.facilities });
save();
