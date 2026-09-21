import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { deleteField } from 'firebase/firestore';
import ConfirmModal from '../ConfirmModal';
import { Modale, Campo, SelectAnno, Vuoto } from './ui';
import { S, btn, MESI_BREVI, MESI, fmtEuro, parseImporto, esportaExcel } from './util';
import { STATI_DOC } from './registro';

function ModaleCella({ riga, mese, onClose, onSalva, onSvuota }) {
  const cella = riga.mesi?.[mese] || {};
  const [form, setForm] = useState({
    numero: cella.numero || '',
    stato: cella.stato || 'emessa',
    importo: cella.importo !== undefined && cella.importo !== null ? String(cella.importo) : '',
    data: cella.data || '',
    nota: cella.nota || '',
  });
  const [salvando, setSalvando] = useState(false);
  const imposta = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSalva = async () => {
    if (!form.numero.trim() && !form.nota.trim()) { toast.error('Inserisci il numero della fattura o una nota'); return; }
    setSalvando(true);
    try {
      const payload = { numero: form.numero.trim(), stato: form.stato };
      if (form.importo !== '') payload.importo = parseImporto(form.importo);
      if (form.data) payload.data = form.data;
      if (form.nota.trim()) payload.nota = form.nota.trim();
      await onSalva(payload);
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
      setSalvando(false);
    }
  };

  return (
    <Modale
      titolo={`${riga.azienda} — ${MESI[mese - 1]} ${riga.anno}`}
      onClose={onClose}
      larghezza={460}
      footer={<>
        {riga.mesi?.[mese] && <button onClick={onSvuota} style={btn('danger', { marginRight: 'auto' })}>Svuota</button>}
        <button onClick={onClose} style={btn('ghost')}>Annulla</button>
        <button onClick={handleSalva} disabled={salvando} style={btn('primario', { opacity: salvando ? 0.6 : 1 })}>Salva</button>
      </>}
    >
      <Campo label="N° fattura / proforma">
        <input style={S.input} placeholder="Es. 799/26" value={form.numero} onChange={(e) => imposta('numero', e.target.value)} autoFocus />
      </Campo>
      <Campo label="Stato">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STATI_DOC).map(([k, s]) => (
            <button
              key={k}
              type="button"
              onClick={() => imposta('stato', k)}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: s.bg, color: s.color,
                border: form.stato === k ? `2.5px solid ${s.color}` : `1.5px solid ${s.border}`,
              }}
            >
              {form.stato === k ? '✓ ' : ''}{s.label}
            </button>
          ))}
        </div>
      </Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Campo label="Importo (IVA inclusa)">
            <input style={S.input} inputMode="decimal" placeholder="0,00" value={form.importo} onChange={(e) => imposta('importo', e.target.value)} />
          </Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Data documento">
            <input style={S.input} type="date" value={form.data} onChange={(e) => imposta('data', e.target.value)} />
          </Campo>
        </div>
      </div>
      <Campo label="Nota">
        <input style={S.input} placeholder="Es. fatturata a EM SERVIZI FIDUCIARI SRLS" value={form.nota} onChange={(e) => imposta('nota', e.target.value)} />
      </Campo>
    </Modale>
  );
}

function ModaleRiga({ riga, aziende, onClose, onSalva, onElimina }) {
  const [form, setForm] = useState({
    azienda: riga?.azienda || '',
    referente: riga?.referente || '',
    canone: riga?.canone || '',
    visite: riga?.visite || '',
    note: riga?.note || '',
  });
  const [salvando, setSalvando] = useState(false);
  const imposta = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nomiAziende = [...new Set(aziende.map((a) => a.nome).filter(Boolean))];

  const handleSalva = async () => {
    if (!form.azienda.trim()) { toast.error("Inserisci il nome dell'azienda"); return; }
    setSalvando(true);
    try {
      await onSalva({ ...form, azienda: form.azienda.trim() });
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
      setSalvando(false);
    }
  };

  return (
    <Modale
      titolo={riga ? 'Modifica azienda' : 'Nuova azienda nel registro'}
      onClose={onClose}
      footer={<>
        {riga && <button onClick={onElimina} style={btn('danger', { marginRight: 'auto' })}>Elimina riga</button>}
        <button onClick={onClose} style={btn('ghost')}>Annulla</button>
        <button onClick={handleSalva} disabled={salvando} style={btn('primario', { opacity: salvando ? 0.6 : 1 })}>Salva</button>
      </>}
    >
      <Campo label="Azienda" obbligatorio>
        <input style={S.input} list="dl-registro-aziende" value={form.azienda} onChange={(e) => imposta('azienda', e.target.value)} autoFocus />
        <datalist id="dl-registro-aziende">{nomiAziende.map((n) => <option key={n} value={n} />)}</datalist>
      </Campo>
      <Campo label="Referente">
        <input style={S.input} value={form.referente} onChange={(e) => imposta('referente', e.target.value)} />
      </Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Campo label="Canone">
            <input style={S.input} placeholder="Es. 80 + IVA" value={form.canone} onChange={(e) => imposta('canone', e.target.value)} />
          </Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Visite">
            <input style={S.input} placeholder="Es. 35 + IVA" value={form.visite} onChange={(e) => imposta('visite', e.target.value)} />
          </Campo>
        </div>
      </div>
      <Campo label="Note">
        <textarea style={{ ...S.input, minHeight: 60, fontFamily: 'inherit' }} value={form.note} onChange={(e) => imposta('note', e.target.value)} />
      </Campo>
    </Modale>
  );
}

function TabRegistro({ registro, caricando, salva, elimina, aziende }) {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [ricerca, setRicerca] = useState('');
  const [cella, setCella] = useState(null); // { rigaId, mese }
  const [modaleRiga, setModaleRiga] = useState(null); // { riga } | null
  const [confirm, setConfirm] = useState(null);

  const anniDati = useMemo(() => [...new Set(registro.map((r) => r.anno).filter(Boolean))], [registro]);
  const righe = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return registro
      .filter((r) => r.anno === anno)
      .filter((r) => !q || `${r.azienda} ${r.referente || ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.azienda.localeCompare(b.azienda, 'it'));
  }, [registro, anno, ricerca]);

  const righeAnnoPrec = useMemo(() => registro.filter((r) => r.anno === anno - 1), [registro, anno]);
  const rigaCella = cella ? registro.find((r) => r.id === cella.rigaId) : null;

  const riepilogo = useMemo(() => {
    let pagate = 0, daIncassare = 0, importoDaIncassare = 0;
    righe.forEach((r) => Object.values(r.mesi || {}).forEach((c) => {
      if (!c) return;
      if (c.stato === 'pagata') pagate++;
      else { daIncassare++; importoDaIncassare += Number(c.importo) || 0; }
    }));
    return { pagate, daIncassare, importoDaIncassare };
  }, [righe]);

  const aziendaId = (nome) => aziende.find((a) => a.nome?.trim().toLowerCase() === nome.trim().toLowerCase())?.id || null;

  const handleSalvaRiga = async (dati) => {
    const base = { ...dati, aziendaId: aziendaId(dati.azienda) };
    if (modaleRiga.riga) await salva(base, modaleRiga.riga.id);
    else await salva({ ...base, anno, mesi: {} });
    toast.success('Salvato');
    setModaleRiga(null);
  };

  const handleEliminaRiga = () => {
    const riga = modaleRiga.riga;
    setConfirm({
      message: `Eliminare "${riga.azienda}" dal registro ${riga.anno}, con tutte le fatture registrate?`,
      onConfirm: async () => {
        try {
          await elimina(riga.id);
          toast.success('Riga eliminata');
          setModaleRiga(null);
        } catch (e) {
          console.error(e);
          toast.error("Errore nell'eliminazione");
        }
        setConfirm(null);
      },
    });
  };

  const handleSalvaCella = async (payload) => {
    await salva({ [`mesi.${cella.mese}`]: payload }, cella.rigaId);
    setCella(null);
  };

  const handleSvuotaCella = async () => {
    try {
      await salva({ [`mesi.${cella.mese}`]: deleteField() }, cella.rigaId);
      setCella(null);
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
    }
  };

  const copiaDaAnnoPrecedente = async () => {
    try {
      await Promise.all(righeAnnoPrec.map((r) => salva({
        anno, azienda: r.azienda, aziendaId: r.aziendaId || null,
        referente: r.referente || '', canone: r.canone || '', visite: r.visite || '', note: r.note || '', mesi: {},
      })));
      toast.success(`Copiate ${righeAnnoPrec.length} aziende dal ${anno - 1}`);
    } catch (e) {
      console.error(e);
      toast.error('Errore nella copia');
    }
  };

  const handleEsporta = () => {
    const rows = righe.map((r) => {
      const o = { Azienda: r.azienda, Referente: r.referente || '', Canone: r.canone || '', Visite: r.visite || '' };
      MESI_BREVI.forEach((m, i) => {
        const c = r.mesi?.[i + 1];
        o[m] = c ? `${c.numero || ''}${c.stato === 'proforma' ? ' PROF' : ''}${c.stato === 'pagata' ? ' (pagata)' : ''}`.trim() : '';
      });
      return o;
    });
    esportaExcel(`registro-fatturazione-${anno}`, rows, `Fatturazione ${anno}`);
  };

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} danger />}
      {rigaCella && cella && (
        <ModaleCella riga={rigaCella} mese={cella.mese} onClose={() => setCella(null)} onSalva={handleSalvaCella} onSvuota={handleSvuotaCella} />
      )}
      {modaleRiga && (
        <ModaleRiga riga={modaleRiga.riga} aziende={aziende} onClose={() => setModaleRiga(null)} onSalva={handleSalvaRiga} onElimina={handleEliminaRiga} />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setModaleRiga({ riga: null })} style={btn('primario')}>+ Azienda</button>
        <SelectAnno anno={anno} onChange={setAnno} anniDati={anniDati} />
        <input style={{ ...S.input, width: 200 }} placeholder="🔍 Cerca azienda…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        <button onClick={handleEsporta} disabled={!righe.length} style={btn('ghost')}>⬇️ Excel</button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#45536f', textAlign: 'right' }}>
          {righe.length} aziende · {riepilogo.pagate} pagate · <strong style={{ color: '#7a5b00' }}>{riepilogo.daIncassare} da incassare</strong>
          {riepilogo.importoDaIncassare > 0 && <> ({fmtEuro(riepilogo.importoDaIncassare)})</>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
        {Object.values(STATI_DOC).map((s) => (
          <span key={s.label} style={{ padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700 }}>{s.label}</span>
        ))}
        <span style={{ color: '#5f6f8c', alignSelf: 'center' }}>Clicca su un mese per registrare o modificare la fattura.</span>
      </div>

      <div style={{ ...S.card, overflowX: 'auto' }}>
        {caricando ? <Vuoto>Caricamento…</Vuoto> : !righe.length ? (
          <Vuoto>
            {registro.length && !ricerca ? `Nessuna azienda nel registro ${anno}.` : 'Nessuna azienda trovata.'}
            {!ricerca && righeAnnoPrec.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button onClick={copiaDaAnnoPrecedente} style={btn('ok')}>Copia le {righeAnnoPrec.length} aziende dal {anno - 1}</button>
              </div>
            )}
          </Vuoto>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: 1250, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, position: 'sticky', left: 0, zIndex: 1 }}>Azienda</th>
                <th style={S.th}>Referente</th>
                <th style={S.th}>Canone</th>
                <th style={S.th}>Visite</th>
                {MESI_BREVI.map((m) => <th key={m} style={{ ...S.th, textAlign: 'center' }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.id}>
                  <td
                    onClick={() => setModaleRiga({ riga: r })}
                    title="Modifica azienda"
                    style={{ ...S.td, position: 'sticky', left: 0, background: '#fff', fontWeight: 700, cursor: 'pointer', minWidth: 190, maxWidth: 240 }}
                  >
                    {r.azienda}
                  </td>
                  <td style={S.td}>{r.referente}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.canone}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.visite}</td>
                  {MESI_BREVI.map((_, i) => {
                    const c = r.mesi?.[i + 1];
                    const st = c ? STATI_DOC[c.stato] || STATI_DOC.emessa : null;
                    return (
                      <td
                        key={i}
                        onClick={() => setCella({ rigaId: r.id, mese: i + 1 })}
                        title={c ? [c.numero, st.label, c.importo != null ? fmtEuro(c.importo) : '', c.nota].filter(Boolean).join(' · ') : 'Aggiungi'}
                        style={{
                          ...S.td, cursor: 'pointer', textAlign: 'center', fontSize: 12, padding: '6px 4px',
                          minWidth: 78, background: st ? st.bg : undefined, color: st ? st.color : '#9aa7bf',
                          fontWeight: st ? 700 : 400, borderLeft: '1px solid #eef1f7',
                        }}
                      >
                        {c ? (c.numero || c.nota) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TabRegistro;
