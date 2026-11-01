# FloodOps – Sistem Analisis Dampak Banjir dan Prioritas Penanganan Jalan

Prototipe MVP sesuai PRD v1.0. Stack: **React + Vite**, **Leaflet + OpenStreetMap**, **Express.js**, **Chart.js**, mesin graf Dijkstra (`server/analysis.js`), PWA, ringkasan AI opsional via OpenRouter.

## Menjalankan di VS Code
Prasyarat: Node.js 18+.
```bash
npm install
npm run dev        # API http://localhost:4000, web http://localhost:5173
npm run test:all   # uji logika (Skenario A-F, simulasi, rekap) + uji integrasi API (izin per tabel)
npm run build && npm start   # produksi: satu server di http://localhost:4000
```
Salin `.env.example` menjadi `.env` untuk mengatur `JWT_SECRET` dan (opsional) `OPENROUTER_API_KEY`. Peta OpenStreetMap membutuhkan internet.

## Empat portal masuk dan satu halaman publik
| Peran | Alamat | Akun demo |
|---|---|---|
| Petugas Penanganan Banjir | `/#/masuk/petugas` | `petugas@floodops.id` / `petugas123` |
| Pengguna | `/#/masuk/pengguna` | `pengguna@floodops.id` / `pengguna123` |
| Peneliti / Pengelola Wilayah | `/#/masuk/peneliti` | `peneliti@floodops.id` / `peneliti123` |
| Administrator | `/#/masuk/admin` | `admin@floodops.id` / `admin123` |
| Warga (tanpa akun) | `/#/lapor` | – |

Setiap peran memiliki **panel, menu, dan hak yang berbeda**; server menolak login bila peran akun tidak sesuai portal (403).

## Hak akses per tabel (ditegakkan di server; matriks juga tampil di panel Admin, menu Hak Akses)
| Data / tabel | Warga | Pengguna | Petugas | Peneliti | Admin |
|---|---|---|---|---|---|
| Pengguna | – | – | – | – | tambah, lihat, ubah, hapus |
| Wilayah | – | lihat | lihat | lihat | tambah, lihat, ubah, hapus |
| Ruas jalan | – | lihat | lihat | lihat | tambah, lihat, ubah, hapus |
| Fasilitas penting | – | lihat | lihat | lihat | tambah, lihat, ubah, hapus |
| Laporan banjir | tambah | tambah, lihat | tambah, lihat, ubah | lihat | lihat, ubah, hapus |
| Skor prioritas | – | hanya kategori | lihat | lihat | lihat |
| Simulasi | – | – | jalankan, lihat | lihat | lihat |
| Riwayat aktivitas | – | – | milik sendiri | – | semua |
| Parameter | – | – | lihat | lihat | lihat, ubah |
| Ekspor CSV | – | – | ya | ya | – |

## Fitur menurut masukan pembimbing
- **Peran Peneliti / Pengelola Wilayah**: portal sendiri, rekap per wilayah, aksesibilitas ruas, riwayat simulasi, ekspor CSV (hanya baca).
- **Pengelolaan wilayah (Region Management)**: CRUD wilayah di panel Admin; wilayah dipakai ruas jalan dan fasilitas, dan tidak dapat dihapus bila masih dipakai.
- **Unggah foto**: kamera/berkas JPEG, PNG, atau WebP; dikompres di perangkat (data lokasi EXIF terhapus), divalidasi dari isi berkas di server (maks. 3 MB), disimpan di `FLOODOPS_DATA_DIR/uploads`.
- **Simulasi dengan jarak dan waktu**: tambahan km, tambahan menit, dan persentase per permukiman (kecepatan rata-rata dapat diatur, default 30 km/jam).
- **Rute alternatif di peta (Dijkstra)**: rute sebelum (titik abu-abu) dan sesudah (garis biru) dapat dilihat per permukiman; ruas dengan genangan di atas batas lewat (default 60 cm) dihindari.
- **Panel Admin per model**: Pengguna, Wilayah, Ruas Jalan, Fasilitas, Laporan, Riwayat Simulasi, Parameter, Hak Akses, Riwayat Aktivitas.
- **UI tanpa emoji dan simbol teks**: ikon memakai SVG.

## Deployment (Docker)
```bash
docker build -t floodops .
docker run -d -p 4000:4000 -e JWT_SECRET=ganti-ini -v floodops-data:/data --name floodops floodops
```
Volume `/data` menyimpan `db.json` dan folder `uploads`. Tanpa volume, data kembali ke data uji bila container dibuat ulang. CI GitHub Actions menjalankan uji dan build.

## Batasan yang perlu dinyatakan
- Jaringan jalan berupa skema ilustratif (garis lurus antar persimpangan), bukan ekstraksi OSM; laporan dan fasilitas adalah data sintetis berlabel.
- Penyimpanan berupa berkas JSON; `supabase/schema.sql` belum dipakai kode dan masih perlu dilengkapi (lihat catatan di berkasnya). Data lama dari versi sebelumnya diganti data uji saat struktur berubah.
- Estimasi waktu tempuh memakai kecepatan konstan; keterhubungan jalan tidak menjamin jalan aman dilalui. Laporan belum terverifikasi tetap dianggap saat menghindari ruas terendam.
- Pembatasan laju dan percobaan login memakai memori server. Untuk produksi: ganti `JWT_SECRET`, hapus akun demo, batasi CORS, gunakan HTTPS.
- Skor adalah alat bantu analisis, bukan keputusan resmi. Uji pengguna dan waktu muat belum dijalankan; tampilan belum diperiksa di browser sungguhan.
