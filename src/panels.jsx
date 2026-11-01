import { useState } from 'react';
import Shell from './components/Shell.jsx';
import Icon from './components/Icon.jsx';
import ReportForm from './components/ReportForm.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import Simulation from './pages/Simulation.jsx';
import DataBanjir from './pages/DataBanjir.jsx';
import { PenggunaHome, PenggunaForm, MyReports } from './pages/PenggunaPages.jsx';
import { Rekap, Access, Sims, ExportPage } from './pages/PenelitiPages.jsx';
import { AdminHome, UsersPage, RegionsPage, SegmentsPage, FacilitiesPage, ParamsPage, PermsPage, AuditPage } from './pages/AdminPages.jsx';
import { useList } from './components/Crud.jsx';

const find = (groups, tab) => groups.flatMap(([, i]) => i).find((t) => t[0] === tab) || groups[0][1][0];
const SUB = (t) => `${t}, wilayah uji coba Kota Bandung (data sintetis dan ilustratif)`;
const Refresh = ({ refresh }) => <button className="btn ic" title="Muat ulang data" onClick={refresh}><Icon n="refresh" /></button>;
function Frame({ c, role, groups, tab, setTab, tools, note, subtitle, children }) {
  return <Shell role={role} user={c.user} groups={groups} tab={tab} setTab={setTab} title={find(groups, tab)[2]} subtitle={subtitle} tools={tools} note={note} theme={c.theme} setTheme={c.setTheme} onLogout={c.onLogout}>{children}</Shell>;
}

// Petugas: panel operasional (verifikasi, skor, simulasi rute)
export function PetugasPanel({ c }) {
  const [tab, setTab] = useState('dash'), [sim, setSim] = useState(null), [period, setPeriod] = useState('');
  const pending = c.reports.filter((r) => r.verification_status === 'belum_terverifikasi').length;
  const groups = [['OPERASI', [['dash', 'grid', 'Ringkasan Operasi'], ['queue', 'inbox', 'Antrean Verifikasi', pending], ['form', 'plus', 'Input Laporan']]], ['ANALISIS', [['sim', 'route', 'Simulasi Rute Alternatif'], ['data', 'chart', 'Data Banjir']]]];
  const tools = <><select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Periode laporan" style={{ width: 'auto' }}><option value="">Semua waktu</option><option value="6">6 jam terakhir</option><option value="24">24 jam terakhir</option><option value="72">3 hari terakhir</option></select><Refresh refresh={c.refresh} /><button className="btn pri" onClick={() => setTab('form')}><Icon n="plus" s={16} />Laporan baru</button></>;
  return (<Frame c={c} role="petugas" groups={groups} tab={tab} setTab={setTab} tools={tools} subtitle={SUB('Petugas Penanganan Banjir')} note="Skor dan simulasi adalah alat bantu analisis, bukan keputusan resmi penanganan bencana.">
    {tab === 'dash' && <Dashboard {...c} period={period} goSim={(id) => { setSim(id); setTab('sim'); }} />}
    {tab === 'queue' && <Reports role="petugas" reports={c.reports} refresh={c.refresh} />}
    {tab === 'form' && <div className="card"><h2>Input laporan kondisi jalan</h2><ReportForm net={c.net} onDone={c.refresh} allowOld /></div>}
    {tab === 'sim' && <Simulation net={c.net} prio={c.prio} initial={sim} />}{tab === 'data' && <DataBanjir />}</Frame>);
}
// Pengguna: peta, dashboard ringan, input laporan
export function PenggunaPanel({ c }) {
  const [tab, setTab] = useState('home'), [mine, loadMine] = useList('/reports?mine=1');
  const groups = [['BERANDA', [['home', 'map', 'Peta dan Dashboard']]], ['LAPORAN', [['form', 'plus', 'Input Laporan'], ['mine', 'file', 'Laporan Saya']]]];
  const tools = <><Refresh refresh={() => { c.refresh(); loadMine(); }} /><button className="btn pri" onClick={() => setTab('form')}><Icon n="plus" s={16} />Laporan baru</button></>;
  return (<Frame c={c} role="pengguna" groups={groups} tab={tab} setTab={setTab} tools={tools} subtitle={SUB('Pengguna')} note="Anda dapat melihat peta dan melaporkan kondisi jalan. Laporan diperiksa petugas sebelum terverifikasi.">
    {tab === 'home' && <PenggunaHome net={c.net} prio={c.prio} reports={c.reports} setTab={setTab} />}
    {tab === 'form' && <PenggunaForm net={c.net} refresh={() => { c.refresh(); loadMine(); }} />}{tab === 'mine' && <MyReports reports={mine} />}</Frame>);
}
// Peneliti / Pengelola Wilayah: analisis dan rekap, hanya baca
export function PenelitiPanel({ c }) {
  const [tab, setTab] = useState('rekap');
  const groups = [['ANALISIS', [['rekap', 'building', 'Rekap Wilayah'], ['access', 'road', 'Aksesibilitas Ruas'], ['sims', 'history', 'Riwayat Simulasi']]], ['DATA', [['data', 'chart', 'Data Banjir'], ['export', 'download', 'Ekspor Data']]]];
  return (<Frame c={c} role="peneliti" groups={groups} tab={tab} setTab={setTab} tools={<Refresh refresh={c.refresh} />} subtitle={SUB('Peneliti / Pengelola Wilayah')} note="Akses hanya baca untuk mengevaluasi dampak banjir terhadap aksesibilitas wilayah.">
    {tab === 'rekap' && <Rekap theme={c.theme} />}{tab === 'access' && <Access net={c.net} prio={c.prio} />}{tab === 'sims' && <Sims />}{tab === 'data' && <DataBanjir />}{tab === 'export' && <ExportPage />}</Frame>);
}
// Administrator: pengelolaan data per tabel dan konfigurasi
export function AdminPanel({ c }) {
  const [tab, setTab] = useState('home');
  const groups = [['SISTEM', [['home', 'grid', 'Ringkasan Sistem']]], ['DATA MASTER', [['users', 'users', 'Pengguna'], ['regions', 'building', 'Wilayah'], ['segments', 'road', 'Ruas Jalan'], ['facilities', 'hospital', 'Fasilitas Penting']]],
    ['DATA OPERASIONAL', [['reports', 'file', 'Laporan Banjir'], ['sims', 'flask', 'Riwayat Simulasi']]], ['KONFIGURASI', [['params', 'sliders', 'Parameter Penilaian'], ['perms', 'lock', 'Hak Akses']]], ['PEMANTAUAN', [['audit', 'history', 'Riwayat Aktivitas']]]];
  const P = { net: c.net, refresh: c.refresh };
  return (<Frame c={c} role="admin" groups={groups} tab={tab} setTab={setTab} tools={<Refresh refresh={c.refresh} />} subtitle="Pengelolaan data per tabel dan konfigurasi sistem" note="Mengelola data master dan konfigurasi. Simulasi dan ekspor analisis ada pada peran lain.">
    {tab === 'home' && <AdminHome net={c.net} reports={c.reports} setTab={setTab} />}{tab === 'users' && <UsersPage {...P} />}{tab === 'regions' && <RegionsPage {...P} />}{tab === 'segments' && <SegmentsPage {...P} />}{tab === 'facilities' && <FacilitiesPage {...P} />}
    {tab === 'reports' && <Reports role="admin" reports={c.reports} refresh={c.refresh} />}{tab === 'sims' && <Sims readOnlyNote={false} />}{tab === 'params' && <ParamsPage {...P} />}{tab === 'perms' && <PermsPage />}{tab === 'audit' && <AuditPage />}</Frame>);
}
