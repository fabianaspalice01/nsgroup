import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { useCollezione } from '../../hooks/useCollezione';
import { Modale, Campo, Vuoto } from './ui';
import {
  S, btn, MESI, fmtEuro, fmtData, oggiISO, parseImporto, anniDisponibili, esportaExcel,
} from './util';

const annoDi = (iso) => Number((iso || '').slice(0, 4));
const meseDi = (iso) => Number((iso || '').slice(5, 7));

const valoreIniziale = (campo) => {
  if (campo.tipo === 'persone') return [];
  if (campo.tipo === 'data') return oggiISO();
  if (campo.tipo === 'select') return campo.opzioni[0];
  return '';
};

const formDa = (config, voce) => {
  const form = {};
  config.campi.forEach((c) => {
    const v = voce?.[c.key];
    if (v === undefined || v === null) form[c.key] = valoreIniziale(c);
    else if (c.tipo === 'importo' || c.tipo === 'numero') form[c.key] = String(v);
    else form[c.key] = v;
  });
  return form;
};

const testoCella = (campo, voce) => {
  const v = voce[campo.key];
  if (campo.tipo === 'persone') return (v || []).map((p) => p.nome + (p.prelievo ? ' (prelievo)' : '')).join('; ');
  if (campo.tipo === 'data') return fmtData(v);
  if (campo.tipo === 'importo') return v === undefined || v === '' ? '' : fmtEuro(v);
  return v ?? '';
};

function EditorPersone({ campo, valore, onChange }) {
  const aggiorna = (i, patch) => onChange(valore.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div>
      {valore.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <input
            style={S.input}
            placeholder="Cognome e nome"
            value={p.nome}
            onChange={(e) => aggiorna(i, { nome: e.target.value })}
          />
          {campo.conPrelievo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap', color: '#45536f' }}>
              <input type="checkbox" checked={!!p.prelievo} onChange={(e) => aggiorna(i, { prelievo: e.target.checked })} />
              Prelievo
            </label>
          )}
          <button type="button" onClick={() => onChange(valore.filter((_, j) => j !== i))} style={btn('danger', { padding: '6px 10px' })}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...valore, { nome: '', prelievo: false }])} style={btn('ghost', { padding: '6px 12px' })}>
        + Aggiungi dipendente
      </button>
    </div>
  );
}

function ModaleVoce({ config, voce, voci, aziende, onClose, onSave }) {
  const [form, setForm] = useState(() => formDa(config, voce));
  const [salvando, setSalvando] = useState(false);

  const imposta = (key, valore) => setForm((f) => ({ ...f, [key]: valore }));

  const opzioniPer = (campo) => {
    if (campo.tipo === 'azienda') return [...new Set(aziende.map((a) => a.nome).filter(Boolean))];
    const usati = voci.map((v) => v[campo.key]).filter(Boolean);
    return [...new Set([...(campo.predefiniti || []), ...usati])];
  };

  const handleSalva = async () => {
    const mancante = config.campi.find((c) => c.obbligatorio && !String(form[c.key] ?? '').trim());
    if (mancante) { toast.error(`Compila il campo "${mancante.label}"`); return; }

    const payload = {};
    config.campi.forEach((c) => {
      const v = form[c.key];
      if (c.tipo === 'importo') payload[c.key] = parseImporto(v);
      else if (c.tipo === 'numero') payload[c.key] = v === '' ? null : parseInt(v, 10) || 0;
      else if (c.tipo === 'persone') payload[c.key] = v.filter((p) => p.nome.trim()).map((p) => ({ nome: p.nome.trim(), prelievo: !!p.prelievo }));
      else payload[c.key] = typeof v === 'string' ? v.trim() : v;
    });

    setSalvando(true);
    try {
      await onSave(payload, voce?.id);
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
      setSalvando(false);
    }
  };

  return (
    <Modale
      titolo={voce ? `Modifica ${config.voce}` : `Nuovo ${config.voce}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={btn('ghost')}>Annulla</button>
        <button onClick={handleSalva} disabled={salvando} style={btn('primario', { opacity: salvando ? 0.6 : 1 })}>
          {salvando ? 'Salvataggio…' : 'Salva'}
        </button>
      </>}
    >
      {config.campi.map((c) => {
        const listaId = `dl-${config.collezione}-${c.key}`;
        return (
          <Campo key={c.key} label={c.label} obbligatorio={c.obbligatorio}>
            {c.tipo === 'select' ? (
              <select style={S.input} value={form[c.key]} onChange={(e) => imposta(c.key, e.target.value)}>
                {c.opzioni.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            ) : c.tipo === 'note' ? (
              <textarea style={{ ...S.input, minHeight: 60, fontFamily: 'inherit' }} value={form[c.key]} onChange={(e) => imposta(c.key, e.target.value)} />
            ) : c.tipo === 'persone' ? (
              <EditorPersone campo={c} valore={form[c.key]} onChange={(v) => imposta(c.key, v)} />
            ) : (
              <>
                <input
                  style={S.input}
                  type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                  inputMode={c.tipo === 'importo' ? 'decimal' : undefined}
                  min={c.tipo === 'numero' ? 0 : undefined}
                  placeholder={c.placeholder || (c.tipo === 'importo' ? '0,00' : '')}
                  list={c.suggerisci || c.tipo === 'azienda' ? listaId : undefined}
                  value={form[c.key]}
                  onChange={(e) => imposta(c.key, e.target.value)}
                />
                {(c.suggerisci || c.tipo === 'azienda') && (
                  <datalist id={listaId}>
                    {opzioniPer(c).map((o) => <option key={o} value={o} />)}
                  </datalist>
                )}
              </>
            )}
          </Campo>
        );
      })}
    </Modale>
  );
}

function TabElenco({ config, aziende }) {
  const { voci, caricando, salva, elimina } = useCollezione(config.collezione);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [mese, setMese] = useState(0); // 0 = tutti
  const [ricerca, setRicerca] = useState('');
  const [modale, setModale] = useState(null); // { voce } | null
  const [confirm, setConfirm] = useState(null);

  const anniDati = useMemo(
    () => (config.campoData ? [...new Set(voci.map((v) => annoDi(v[config.campoData])).filter(Boolean))] : []),
    [voci, config.campoData]
  );

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return voci
      .filter((v) => {
        if (config.campoData) {
          const d = v[config.campoData];
          if (annoDi(d) !== anno) return false;
          if (mese && meseDi(d) !== mese) return false;
        }
        if (!q) return true;
        return config.campi.some((c) => testoCella(c, v).toString().toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const da = a[config.campoData] || '';
        const db = b[config.campoData] || '';
        return db.localeCompare(da) || (b.creatoIl || '').localeCompare(a.creatoIl || '');
      });
  }, [voci, anno, mese, ricerca, config]);

  const totale = config.campoImporto
    ? filtrate.reduce((s, v) => s + (Number(v[config.campoImporto]) || 0), 0)
    : null;

  const handleSave = async (payload, id) => {
    await salva(payload, id);
    toast.success('Salvato');
    setModale(null);
  };

  const handleElimina = (voce) => {
    setConfirm({
      message: `Eliminare questo ${config.voce}?`,
      onConfirm: async () => {
        try {
          await elimina(voce.id);
          toast.success('Eliminato');
        } catch (e) {
          console.error(e);
          toast.error("Errore nell'eliminazione");
        }
        setConfirm(null);
      },
    });
  };

  const handleEsporta = () => {
    const righe = filtrate.map((v) => Object.fromEntries(config.campi.map((c) => [c.label, testoCella(c, v)])));
    esportaExcel(`${config.collezione}-${anno}${mese ? `-${String(mese).padStart(2, '0')}` : ''}`, righe, config.titolo);
  };

  const colonne = config.campi.filter((c) => !c.nascondiInTabella);

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} danger />}
      {modale && (
        <ModaleVoce
          config={config}
          voce={modale.voce}
          voci={voci}
          aziende={aziende}
          onClose={() => setModale(null)}
          onSave={handleSave}
        />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setModale({ voce: null })} style={btn('primario')}>+ Nuovo {config.voce}</button>
        {config.campoData && (
          <>
            <select value={anno} onChange={(e) => setAnno(Number(e.target.value))} style={{ ...S.input, width: 'auto' }}>
              {anniDisponibili(anniDati).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mese} onChange={(e) => setMese(Number(e.target.value))} style={{ ...S.input, width: 'auto' }}>
              <option value={0}>Tutti i mesi</option>
              {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </>
        )}
        <input
          style={{ ...S.input, width: 200 }}
          placeholder="🔍 Cerca…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <button onClick={handleEsporta} disabled={!filtrate.length} style={btn('ghost')}>⬇️ Excel</button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#45536f', textAlign: 'right' }}>
          {filtrate.length} {filtrate.length === 1 ? 'voce' : 'voci'}
          {totale !== null && <> · {config.etichettaTotale}: <strong style={{ color: '#2c3e66', fontSize: 15 }}>{fmtEuro(totale)}</strong></>}
        </div>
      </div>

      <div style={{ ...S.card, overflowX: 'auto' }}>
        {caricando ? <Vuoto>Caricamento…</Vuoto> : !filtrate.length ? (
          <Vuoto>Nessun {config.voce} {voci.length ? 'con questi filtri' : 'registrato'}.</Vuoto>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                {colonne.map((c) => (
                  <th key={c.key} style={{ ...S.th, textAlign: c.tipo === 'importo' ? 'right' : 'left' }}>{c.label}</th>
                ))}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrate.map((v) => (
                <tr key={v.id}>
                  {colonne.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        ...S.td,
                        textAlign: c.tipo === 'importo' ? 'right' : 'left',
                        fontWeight: c.tipo === 'importo' ? 700 : 400,
                        whiteSpace: c.tipo === 'data' || c.tipo === 'importo' ? 'nowrap' : 'normal',
                      }}
                    >
                      {c.tipo === 'persone'
                        ? (v[c.key] || []).map((p, i) => (
                          <div key={i}>{p.nome}{p.prelievo && <span title="Prelievo" style={{ marginLeft: 4 }}>🩸</span>}</div>
                        ))
                        : testoCella(c, v)}
                    </td>
                  ))}
                  <td style={{ ...S.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button onClick={() => setModale({ voce: v })} title="Modifica" style={btn('ghost', { padding: '4px 8px', marginRight: 4 })}>✏️</button>
                    <button onClick={() => handleElimina(v)} title="Elimina" style={btn('danger', { padding: '4px 8px' })}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TabElenco;
