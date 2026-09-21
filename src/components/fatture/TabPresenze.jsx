import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { useCollezione } from '../../hooks/useCollezione';
import { Vuoto } from './ui';
import { S, btn, MESI, anniDisponibili, esportaExcel } from './util';

// Codici della legenda del foglio presenze
const CODICI = [
  { c: 'T.C.', label: 'Turno completo', bg: '#bbf1e8', color: '#0f5c50' },
  { c: 'T.M', label: 'Turno mattina', bg: '#dde3f0', color: '#2c3e66' },
  { c: 'T.P', label: 'Turno pomeriggio', bg: '#d5ddee', color: '#1f2e4d' },
  { c: 'E', label: 'Extra', bg: '#fde68a', color: '#7a5b00' },
  { c: 'F', label: 'Ferie', bg: '#dbeafe', color: '#1e40af' },
  { c: 'M', label: 'Malattia', bg: '#fecaca', color: '#b91c1c' },
  { c: 'P.ORE', label: 'Permesso ore', bg: '#fed7aa', color: '#9a3412' },
  { c: 'R', label: 'Recupero', bg: '#e9d5ff', color: '#6b21a8' },
  { c: 'GF', label: 'Festa', bg: '#f1f5f9', color: '#45536f' },
];
const PER_CODICE = Object.fromEntries(CODICI.map((x) => [x.c, x]));
const GIORNI_SETT = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const idMese = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}`;
const giorniNelMese = (anno, mese) => new Date(anno, mese, 0).getDate();

function TabPresenze() {
  const { voci, caricando, imposta } = useCollezione('fatt_presenze');
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [pennello, setPennello] = useState('T.C.'); // codice da applicare al click; '' = cancella
  const [bozza, setBozza] = useState(null); // modifiche non salvate: [{ nome, giorni: { '1': 'T.C.' } }]
  const [nuovoNome, setNuovoNome] = useState('');
  const [confirm, setConfirm] = useState(null);

  const id = idMese(anno, mese);
  const docMese = voci.find((v) => v.id === id);
  const docPrecedente = useMemo(() => {
    const d = new Date(anno, mese - 2, 1);
    return voci.find((v) => v.id === idMese(d.getFullYear(), d.getMonth() + 1));
  }, [voci, anno, mese]);

  const righe = bozza ?? docMese?.righe ?? [];
  const sporco = bozza !== null;

  const cambiaMese = (anno2, mese2) => {
    setBozza(null);
    setAnno(anno2);
    setMese(mese2);
  };
  const vaiMese = (delta) => {
    const d = new Date(anno, mese - 1 + delta, 1);
    cambiaMese(d.getFullYear(), d.getMonth() + 1);
  };

  const nGiorni = giorniNelMese(anno, mese);
  const giorni = Array.from({ length: nGiorni }, (_, i) => i + 1);

  const modifica = (fn) => setBozza((prev) => fn(prev ?? docMese?.righe ?? []));

  const applica = (rigaIdx, giorno) => modifica((rs) => rs.map((r, i) => {
    if (i !== rigaIdx) return r;
    const g = { ...r.giorni };
    if (pennello) g[giorno] = pennello; else delete g[giorno];
    return { ...r, giorni: g };
  }));

  const aggiungiDipendente = () => {
    const nome = nuovoNome.trim();
    if (!nome) return;
    if (righe.some((r) => r.nome.toLowerCase() === nome.toLowerCase())) { toast.error('Dipendente già presente'); return; }
    modifica((rs) => [...rs, { nome, giorni: {} }]);
    setNuovoNome('');
  };

  const rimuoviDipendente = (idx) => setConfirm({
    message: `Rimuovere ${righe[idx].nome} da questo mese?`,
    onConfirm: () => { modifica((rs) => rs.filter((_, i) => i !== idx)); setConfirm(null); },
  });

  const copiaDalPrecedente = () => modifica(() => (docPrecedente?.righe || []).map((r) => ({ nome: r.nome, giorni: {} })));

  const handleSalva = async () => {
    try {
      await imposta(id, { anno, mese, righe });
      setBozza(null);
      toast.success('Presenze salvate');
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
    }
  };

  const totali = (r) => {
    const v = Object.values(r.giorni || {});
    return {
      presenze: v.filter((c) => ['T.C.', 'T.M', 'T.P', 'E'].includes(c)).length,
      ferie: v.filter((c) => c === 'F').length,
      malattia: v.filter((c) => c === 'M').length,
    };
  };

  const handleEsporta = () => {
    const rows = righe.map((r) => {
      const t = totali(r);
      const o = { Dipendente: r.nome };
      giorni.forEach((g) => { o[g] = r.giorni?.[g] || ''; });
      return { ...o, Presenze: t.presenze, Ferie: t.ferie, Malattia: t.malattia };
    });
    esportaExcel(`presenze-${id}`, rows, `${MESI[mese - 1]} ${anno}`);
  };

  const anniDati = voci.map((v) => v.anno).filter(Boolean);

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} danger />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => vaiMese(-1)} style={btn('ghost')}>‹</button>
        <select value={mese} onChange={(e) => cambiaMese(anno, Number(e.target.value))} style={{ ...S.input, width: 'auto' }}>
          {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={anno} onChange={(e) => cambiaMese(Number(e.target.value), mese)} style={{ ...S.input, width: 'auto' }}>
          {anniDisponibili(anniDati).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => vaiMese(1)} style={btn('ghost')}>›</button>
        <button onClick={handleEsporta} disabled={!righe.length} style={btn('ghost')}>⬇️ Excel</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {sporco && <span style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>Modifiche non salvate</span>}
          <button onClick={handleSalva} disabled={!sporco} style={btn('primario', { opacity: sporco ? 1 : 0.5 })}>💾 Salva</button>
        </div>
      </div>

      <div style={{ ...S.card, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#5f6f8c', marginBottom: 6 }}>
          Scegli un codice e clicca sulle caselle per applicarlo. «Cancella» svuota la casella.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CODICI.map((x) => (
            <button key={x.c} onClick={() => setPennello(x.c)} title={x.label}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: x.bg, color: x.color, border: pennello === x.c ? `2.5px solid ${x.color}` : '1.5px solid transparent',
              }}>
              {x.c} <span style={{ fontWeight: 400 }}>{x.label}</span>
            </button>
          ))}
          <button onClick={() => setPennello('')}
            style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#dc2626', border: pennello === '' ? '2.5px solid #dc2626' : '1.5px solid #fecaca' }}>
            ✕ Cancella
          </button>
        </div>
      </div>

      <div style={{ ...S.card, overflowX: 'auto' }}>
        {caricando ? <Vuoto>Caricamento…</Vuoto> : !righe.length ? (
          <Vuoto>
            Nessun dipendente per {MESI[mese - 1]} {anno}.
            {docPrecedente?.righe?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button onClick={copiaDalPrecedente} style={btn('ok')}>Copia i {docPrecedente.righe.length} dipendenti del mese precedente</button>
              </div>
            )}
          </Vuoto>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, position: 'sticky', left: 0, zIndex: 1, minWidth: 150 }}>Dipendente</th>
                {giorni.map((g) => {
                  const dow = new Date(anno, mese - 1, g).getDay();
                  const festivo = dow === 0 || dow === 6;
                  return (
                    <th key={g} style={{ ...S.th, textAlign: 'center', padding: '4px 0', minWidth: 34, background: festivo ? '#eef1f7' : '#f6f8fc' }}>
                      <div>{g}</div><div style={{ fontWeight: 400 }}>{GIORNI_SETT[dow]}</div>
                    </th>
                  );
                })}
                <th style={{ ...S.th, textAlign: 'center' }} title="T.C. + T.M + T.P + Extra">Pres.</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Ferie</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Mal.</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r, idx) => {
                const t = totali(r);
                return (
                  <tr key={r.nome}>
                    <td style={{ ...S.td, position: 'sticky', left: 0, background: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.nome}</td>
                    {giorni.map((g) => {
                      const cod = r.giorni?.[g];
                      const x = cod ? PER_CODICE[cod] : null;
                      const dow = new Date(anno, mese - 1, g).getDay();
                      return (
                        <td key={g} onClick={() => applica(idx, g)} title={x?.label}
                          style={{
                            ...S.td, padding: '5px 0', textAlign: 'center', fontSize: 10, cursor: 'pointer', userSelect: 'none',
                            minWidth: 34, borderLeft: '1px solid #eef1f7', fontWeight: 700,
                            background: x ? x.bg : (dow === 0 || dow === 6 ? '#f6f8fc' : undefined), color: x?.color,
                          }}>
                          {cod || ''}
                        </td>
                      );
                    })}
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>{t.presenze}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{t.ferie}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{t.malattia}</td>
                    <td style={S.td}>
                      <button onClick={() => rimuoviDipendente(idx)} title="Rimuovi dal mese" style={btn('danger', { padding: '2px 8px' })}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input style={{ ...S.input, width: 220 }} placeholder="Nome dipendente" value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aggiungiDipendente()} />
        <button onClick={aggiungiDipendente} style={btn('ghost')}>+ Aggiungi dipendente</button>
      </div>
    </div>
  );
}

export default TabPresenze;
