import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
// Sumber: Laporan Data Bencana Banjir Kota Bandung 2020–2025 (BPBD Kota Bandung, Diskar PB, Open Data Kota Bandung).
const Y = [['2020', 98, 2400], ['2021', 105, 2800], ['2022', 118, 3100], ['2023', 94, 2150], ['2024', 132, 4500], ['2025', 127, 3500]];
const K = [['Gedebage', 'Sangat tinggi', 'Luapan Sungai Cikeruh & topografi rendah'], ['Sumur Bandung', 'Tinggi', 'Luapan Cikapundung / tanggul jebol'], ['Bandung Kulon', 'Tinggi', 'Pendangkalan Sungai Cilember'], ['Babakan Ciparay', 'Tinggi', 'Kapasitas drainase & luapan Citepus'], ['Bojongloa Kaler', 'Sedang–tinggi', 'Banjir cileuncang / aliran KBU'], ['Cicendo & Sukajadi', 'Sedang', 'Luapan Citepus / runoff KBU'], ['Rancasari & Arcamanik', 'Sedang–tinggi', 'Limpasan Citarum & Cikeruh']];
const EV = [['24 Des 2020', 'Banjir luapan Pasteur & Sukajadi', 'Citepus meluap; kendaraan terendam hingga 1,2 m dan memutus jalan arteri primer.'], ['11 Jan 2024', 'Tanggul jebol Braga', 'Tanggul anak Sungai Cikapundung jebol 10 m; 857 jiwa dievakuasi.'], ['15 Mar 2025', 'Genangan kronis Gedebage & Kopo', 'Hujan >4 jam menggenangi Soekarno-Hatta 3 km, kedalaman 80 cm.']];
export default function DataBanjir() {
  const c = useRef();
  useEffect(() => { const ch = new Chart(c.current, { type: 'bar', data: { labels: Y.map((y) => y[0]), datasets: [{ label: 'Jumlah kejadian', data: Y.map((y) => y[1]), backgroundColor: '#0b6bcb', borderRadius: 8 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); return () => ch.destroy(); }, []);
  return (<div className="grid even">
    <div className="card"><h2>Kejadian banjir Kota Bandung 2020–2025</h2><p className="mu">Total 674 kejadian · sekitar 18.450 jiwa terdampak · 15 kecamatan rawan · 31 kolam retensi. Puncak pada Januari–Maret dan November–Desember (muson barat).</p>
      <canvas ref={c} height="170" />
      <div className="scroll"><table><thead><tr><th>Tahun</th><th>Kejadian</th><th>Korban terdampak</th></tr></thead><tbody>{Y.map((y) => <tr key={y[0]}><td>{y[0]}</td><td>{y[1]}</td><td>~{y[2].toLocaleString('id')} jiwa</td></tr>)}</tbody></table></div></div>
    <div className="grid" style={{ alignContent: 'start' }}>
      <div className="card"><h2>Kecamatan rawan</h2><div className="scroll"><table><thead><tr><th>Kecamatan</th><th>Tingkat</th><th>Penyebab utama</th></tr></thead><tbody>{K.map((k) => <tr key={k[0]}><td>{k[0]}</td><td>{k[1]}</td><td>{k[2]}</td></tr>)}</tbody></table></div></div>
      <div className="card"><h2>Peristiwa signifikan</h2>{EV.map((e) => <p key={e[0]}><b>{e[0]} – {e[1]}</b><br /><span className="mu">{e[2]}</span></p>)}
        <div className="note">Sumber: BPBD Kota Bandung, Diskar PB &amp; Open Data Kota Bandung. Data ini menjadi konteks pemilihan wilayah uji; data historis tidak dipakai langsung dalam perhitungan skor (sesuai ruang lingkup MVP).</div></div></div></div>);
}
