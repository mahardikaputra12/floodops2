import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COL = () => ({ tinggi: v('--hi'), menengah: v('--md'), rendah: v('--lo') });

// Batang horizontal: skor prioritas (petugas/admin) atau kedalaman genangan (pengguna)
export function ScoreBars({ items, mode, theme, onPick }) {
  const c = useRef();
  useEffect(() => {
    const col = COL(), top = items.slice(0, 8), tx = v('--mu');
    const ch = new Chart(c.current, { type: 'bar', data: { labels: top.map((r) => r.road_name.replace('Jl. ', '')), datasets: [{ data: top.map((r) => (mode === 'score' ? r.total_score : r.reported_depth)), backgroundColor: top.map((r) => col[r.category.key]), borderRadius: 6, barThickness: 14 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, onClick: (_, el) => el[0] && onPick?.(top[el[0].index].segment_id), plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => (mode === 'score' ? `Skor ${x.raw}` : `${x.raw} cm`) } } },
        scales: { x: { beginAtZero: true, max: mode === 'score' ? 100 : undefined, grid: { color: v('--bd') }, ticks: { color: tx } }, y: { grid: { display: false }, ticks: { color: tx, font: { size: 11 } } } } } });
    return () => ch.destroy();
  }, [items, mode, theme]);
  return <div className="cv"><canvas ref={c} /></div>;
}

export function Donut({ counts, theme }) {
  const c = useRef(); const col = COL();
  const data = [['Tinggi', counts.tinggi, col.tinggi], ['Menengah', counts.menengah, col.menengah], ['Lebih rendah', counts.rendah, col.rendah], ['Belum ada data', counts.none, '#94a3b8']];
  useEffect(() => {
    const ch = new Chart(c.current, { type: 'doughnut', data: { labels: data.map((d) => d[0]), datasets: [{ data: data.map((d) => d[1]), backgroundColor: data.map((d) => d[2]), borderWidth: 0 }] }, options: { cutout: '72%', maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    return () => ch.destroy();
  }, [counts.tinggi, counts.menengah, counts.rendah, counts.none, theme]);
  const total = data.reduce((a, d) => a + d[1], 0);
  return (<><div className="dn"><canvas ref={c} /><div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}><div><b style={{ fontSize: 26 }}>{total}</b><div className="mu">total ruas</div></div></div></div>
    <div className="lg">{data.map((d) => <span key={d[0]}><i style={{ background: d[2] }} />{d[0]} · {d[1]}</span>)}</div></>);
}

export function SimpleBars({ labels, values, colors, unit = '', max, theme }) {
  const c = useRef();
  useEffect(() => {
    const tx = v('--mu'), ch = new Chart(c.current, { type: 'bar', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, barThickness: 16 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => `${x.raw}${unit}` } } }, scales: { x: { beginAtZero: true, max, grid: { color: v('--bd') }, ticks: { color: tx } }, y: { grid: { display: false }, ticks: { color: tx, font: { size: 11 } } } } } });
    return () => ch.destroy();
  }, [labels.join('|'), values.join('|'), theme]);
  return <div className="cv"><canvas ref={c} /></div>;
}
