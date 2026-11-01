import { useEffect, useState, useCallback } from 'react';
import { api, setToken } from './api.js';
import Lapor from './pages/Lapor.jsx';
import { Landing, PortalLogin } from './pages/Portal.jsx';
import { PetugasPanel, PenggunaPanel, PenelitiPanel, AdminPanel } from './panels.jsx';

const useHash = () => { const [h, setH] = useState(location.hash || '#/'); useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return h; };
const PANEL = { petugas: PetugasPanel, pengguna: PenggunaPanel, peneliti: PenelitiPanel, admin: AdminPanel };

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('fo_user')); } catch { return null; } });
  const [net, setNet] = useState(null), [prio, setPrio] = useState({ ranked: [], noData: [] }), [reports, setReports] = useState([]), [err, setErr] = useState(''), [at, setAt] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('fo_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const hash = useHash();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('fo_theme', theme); }, [theme]);
  const login = (u) => { localStorage.setItem('fo_user', JSON.stringify(u)); location.hash = '#/'; setUser(u); };
  const onLogout = () => { setToken(''); localStorage.removeItem('fo_user'); location.hash = '#/'; setUser(null); };
  const refresh = useCallback(async () => {
    try { const [n, p, r] = await Promise.all([api('/network'), api('/priority'), api('/reports')]); setNet(n); setPrio(p); setReports(r); setAt(new Date()); setErr(''); }
    catch (e) { setErr(e.message + ' Menampilkan data terakhir jika tersedia.'); }
  }, []);
  useEffect(() => { if (user) refresh(); }, [user, refresh]);
  if (!user) {
    if (hash.startsWith('#/lapor')) return <Lapor />;
    if (hash.startsWith('#/masuk/')) return <PortalLogin portal={hash.split('/')[2]} onLogin={login} />;
    return <Landing />;
  }
  const Panel = PANEL[user.role];
  if (!Panel) { onLogout(); return null; }
  return (<>{err && <div className="note" style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>{err}</div>}<Panel c={{ user, net, prio, reports, refresh, theme, setTheme, onLogout, at }} /></>);
}
