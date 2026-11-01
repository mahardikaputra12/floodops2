import Icon from './Icon.jsx';
import { ROLE_LABEL } from '../api.js';
// Kerangka panel; setiap peran memakai menu, halaman, dan warna aksen sendiri.
export default function Shell({ role, user, groups, tab, setTab, title, subtitle, tools, note, theme, setTheme, onLogout, children }) {
  return (<div className="shell" data-role={role}>
    <aside className="side">
      <div className="brand"><img src="/logo.png" alt="" />FloodOps</div>
      {groups.map(([g, items]) => <div key={g} style={{ display: 'contents' }}><div className="grp">{g}</div>{items.map(([k, i, n, c]) => <button key={k} className={'nav' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><Icon n={i} /><span>{n}</span>{c > 0 && <span className="cnt">{c}</span>}</button>)}</div>)}
      <div className="sidecard"><b>{ROLE_LABEL[role]}</b>{note}</div>
      <div className="sw"><span>Mode gelap</span><button className={'tg' + (theme === 'dark' ? ' on' : '')} aria-label="Ubah mode gelap" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><i /></button></div>
      <div className="me"><div className="av">{user.name[0]}</div><div style={{ flex: 1, minWidth: 0 }}><b>{user.name}</b><div className="mu">{user.email}</div></div><button className="btn sm ic" title="Keluar" onClick={onLogout}><Icon n="logout" s={15} /></button></div>
    </aside>
    <div className="page">
      <div className="topbar"><div><h1>{title}</h1><div className="sub">{subtitle}</div></div><div className="tools">{tools}<button className="btn mob" onClick={onLogout} title="Keluar"><Icon n="logout" s={16} /></button></div></div>
      <main className="main">{children}</main>
    </div></div>);
}
