import { ago, STATUS_LABEL, SOURCE_LABEL } from '../api.js';
const Ind = ({ name, scale, value, w }) => (<div><div className="row" style={{ justifyContent: 'space-between' }}><span>{name} <span className="mu">(bobot {Math.round(w * 100)}%)</span></span><b>skala {scale} dari 3, nilai {value}</b></div><div className="bar"><i style={{ width: value + '%' }} /></div></div>);
// Detail ruas jalan + Explainable Priority. onSim hanya diberikan untuk peran yang berhak menjalankan simulasi.
export default function Detail({ item, segment, onSim }) {
  if (!item) return (<><h2>{segment?.road_name ?? 'Ruas jalan'}</h2><div className="note" style={{ marginTop: 10 }}>Data belum tersedia: belum ada laporan aktif untuk ruas ini. Skor tidak dihitung dan tidak dianggap nol.</div>{segment && onSim && <p><button className="btn pri" onClick={() => onSim(segment.id)}>Jalankan simulasi penutupan</button></p>}</>);
  const w = item.weights, v = item.values;
  return (<>
    <h2>{item.road_name}</h2>
    <div className="row" style={{ margin: '10px 0' }}><span className="big" style={{ color: `var(--${item.category.key === 'tinggi' ? 'hi' : item.category.key === 'menengah' ? 'md' : 'lo'})` }}>{item.total_score}</span><div><span className={`badge t-${item.category.key}`}>{item.category.label}</span><div className="mu">Tindak lanjut: {item.category.advice}</div></div></div>
    <div className="row" style={{ gap: 6 }}><span className={`badge s-${item.verification_status}`}>{STATUS_LABEL[item.verification_status]}</span>{item.stale && <span className="badge kd">Kedaluwarsa</span>}</div>
    <p className="mu">Genangan dilaporkan {item.reported_depth} cm, pembaruan terakhir {ago(item.updated_at)}, sumber {SOURCE_LABEL[item.source_type] || item.source_type}</p>
    <h3>Rincian tiga indikator</h3>
    <Ind name="Tingkat genangan" scale={item.depth_score} value={v.depth} w={w.depth} />
    <Ind name="Dampak terhadap akses penting" scale={item.facility_impact_score} value={v.access} w={w.access} />
    <Ind name="Ketersediaan jalur alternatif" scale={item.alternative_access_score} value={v.alt} w={w.alt} />
    <p className="mu">Skor = {Math.round(w.depth * 100)}% x {v.depth} + {Math.round(w.access * 100)}% x {v.access} + {Math.round(w.alt * 100)}% x {v.alt} = <b>{item.total_score}</b></p>
    <h3>Alasan penilaian</h3><ul className="why">{item.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
    <h3>Fasilitas dan wilayah yang berpotensi terdampak</h3>
    <p className="mu">{item.affected.length ? item.affected.map((a, i) => <span key={i}>{a}<br /></span>) : 'Tidak ada yang terputus dalam model.'}</p>
    {onSim && <button className="btn pri" onClick={() => onSim(item.segment_id)}>Jalankan simulasi penutupan</button>}
  </>);
}
