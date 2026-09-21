import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { deleteField } from 'firebase/firestore';
import ConfirmModal from '../ConfirmModal';
import { useCollezione } from '../../hooks/useCollezione';
import { Modale, Campo, SelectAnno, Vuoto } from './ui';
import { S, btn, MESI_BREVI, fmtEuro, parseImporto, esportaExcel } from './util';

const CICLO = { undefined: 'si', si: 'no', no: undefined };
const STILE = {
  si: { bg: '#bbf1e8', color: '#0f5c50', testo: 'SÌ' },
  no: { bg: '#fee2e2', color: '#b91c1c', testo: 'NO' },
};

function ModaleRiga({ riga, aziende, onClose, onSalva, onElimina }) {
  const [form, setForm] = useState({
    azienda: riga?.azienda || '',
    canone: riga?.canone || '',
    visita: riga?.visita || '',
    importoMensile: riga?.importoMensile != null ? String(riga.importoMensile) : '',
    note: riga?.note || '',
  });
  const [salvando, setSalvando] = useState(false);
  const imposta = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nomi = [...new Set(aziende.map((a) => a.nome).filter(Boolean))];

  const handleSalva = async () => {
    if (!form.azienda.trim()) { toast.error("Inserisci il nome dell'azienda"); return; }
    setSalvando(true);
    try {
      await onSalva({
        azienda: form.azienda.trim(), canone: form.canone.trim(), visita: form.visita.trim(),
        importoMensile: form.importoMensile === '' ? null : parseImporto(form.importoMensile), note: form.note.trim(),
      });
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
      setSalvando(false);
    }
  };

  return (
    <Modale
      titolo={riga ? 'Modifica azienda' : 'Nuova azienda (canone in contanti)'}
      onClose={onClose}
      footer={<>
        {riga && <button onClick={onElimina} style={btn('danger', { marginRight: 'auto' })}>Elimina riga</button>}
        <button onClick={onClose} style={btn('ghost')}>Annulla</button>
        <button onClick={handleSalva} disabled={salvando} style={btn('primario', { opacity: salvando ? 0.6 : 1 })}>Salva</button>
      </>}
    >
      <Campo label="Azienda" obbligatorio>
        <input style={S.input} list="dl-contanti-aziende" value={form.azienda} onChange={(e) => imposta('azienda', e.target.value)} autoFocus />
        <datalist id="dl-contanti-aziende">{nomi.map((n) => <option key={n} value={n} />)}</datalist>
      </Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Campo label="Canone"><input style={S.input} placeholder="Es. 80 + IVA" value={form.canone} onChange={(e) => imposta('canone', e.target.value)} /></Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Visita"><input style={S.input} placeholder="Es. 35 + IVA" value={form.visita} onChange={(e) => imposta('visita', e.target.value)} /></Campo>
        </div>
      </div>
      <Campo label="Importo mensile (IVA inclusa)">
        <input style={S.input} inputMode="decimal" placeholder="0,00" value={form.importoMensile} onChange={(e) => imposta('importoMensile', e.target.value)} />
      </Campo>
      <Campo label="Note">
        <textarea style={{ ...S.input, minHeight: 60, fontFamily: 'inherit' }} value={form.note} onChange={(e) => imposta('note', e.target.value)} />
      </Campo>
    </Modale>
  );
}

function TabContanti({ aziende }) {
  const { voci, caricando, salva, elimina } = useCollezione('fatt_contanti');
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [ricerca, setRicerca] = useState('');
  const [modale, setModale] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const anniDati = useMemo(() => [...new Set(voci.map((v) => v.anno).filter(Boolean))], [voci]);
  const righe = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return voci
      .filter((v) => v.anno === anno && (!q || v.azienda.toLowerCase().includes(q)))
      .sort((a, b) => a.azienda.localeCompare(b.azienda, 'it'));
  }, [voci, anno, ricerca]);
  const righeAnnoPrec = useMemo(() => voci.filter((v) => v.anno === anno - 1), [voci, anno]);

  const conta = (r) => Object.values(r.mesi || {}).filter((s) => s === 'si').length;

  const cambiaCella = async (r, mese) => {
    const successivo = CICLO[r.mesi?.[mese]];
    try {
      await salva({ [`mesi.${mese}`]: successivo === undefined ? deleteField() : successivo }, r.id);
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
    }
  };

  const handleSalvaRiga = async (dati) => {
    if (modale.riga) await salva(dati, modale.riga.id);
    else await salva({ ...dati, anno, mesi: {} });
    toast.success('Salvato');
    setModale(null);
  };

  const handleEliminaRiga = () => {
    const riga = modale.riga;
    setConfirm({
      message: `Eliminare "${riga.azienda}" dai canoni in contanti ${riga.anno}?`,
      onConfirm: async () => {
        try {
          await elimina(riga.id);
          toast.success('Riga eliminata');
          setModale(null);
        } catch (e) {
          console.error(e);
          toast.error("Errore nell'eliminazione");
        }
        setConfirm(null);
      },
    });
  };

  const copiaDaAnnoPrecedente = async () => {
    try {
      await Promise.all(righeAnnoPrec.map((r) => salva({
        anno, azienda: r.azienda, canone: r.canone || '', visita: r.visita || '',
        importoMensile: r.importoMensile ?? null, note: r.note || '', mesi: {},
      })));
      toast.success(`Copiate ${righeAnnoPrec.length} aziende dal ${anno - 1}`);
    } catch (e) {
      console.error(e);
      toast.error('Errore nella copia');
    }
  };

  const handleEsporta = () => {
    const rows = righe.map((r) => {
      const o = { Azienda: r.azienda, Canone: r.canone || '', Visita: r.visita || '', 'Importo mensile': r.importoMensile ?? '' };
      MESI_BREVI.forEach((m, i) => { o[m] = STILE[r.mesi?.[i + 1]]?.testo || ''; });
      return o;
    });
    esportaExcel(`canoni-contanti-${anno}`, rows, `Contanti ${anno}`);
  };

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} danger />}
      {modale && <ModaleRiga riga={modale.riga} aziende={aziende} onClose={() => setModale(null)} onSalva={handleSalvaRiga} onElimina={handleEliminaRiga} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setModale({ riga: null })} style={btn('primario')}>+ Azienda</button>
        <SelectAnno anno={anno} onChange={setAnno} anniDati={anniDati} />
        <input style={{ ...S.input, width: 200 }} placeholder="🔍 Cerca azienda…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        <button onClick={handleEsporta} disabled={!righe.length} style={btn('ghost')}>⬇️ Excel</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5f6f8c' }}>Clicca su un mese per passare tra vuoto → SÌ → NO.</span>
      </div>

      <div style={{ ...S.card, overflowX: 'auto' }}>
        {caricando ? <Vuoto>Caricamento…</Vuoto> : !righe.length ? (
          <Vuoto>
            {voci.length && !ricerca ? `Nessuna azienda per il ${anno}.` : 'Nessuna azienda registrata.'}
            {!ricerca && righeAnnoPrec.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button onClick={copiaDaAnnoPrecedente} style={btn('ok')}>Copia le {righeAnnoPrec.length} aziende dal {anno - 1}</button>
              </div>
            )}
          </Vuoto>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: 1100, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, position: 'sticky', left: 0, zIndex: 1 }}>Azienda</th>
                <th style={S.th}>Canone</th>
                <th style={S.th}>Visita</th>
                {MESI_BREVI.map((m) => <th key={m} style={{ ...S.th, textAlign: 'center' }}>{m}</th>)}
                <th style={{ ...S.th, textAlign: 'right' }}>Mensile</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Mesi SÌ</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.id}>
                  <td onClick={() => setModale({ riga: r })} title="Modifica azienda"
                    style={{ ...S.td, position: 'sticky', left: 0, background: '#fff', fontWeight: 700, cursor: 'pointer', minWidth: 190 }}>
                    {r.azienda}
                  </td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.canone}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.visita}</td>
                  {MESI_BREVI.map((_, i) => {
                    const st = STILE[r.mesi?.[i + 1]];
                    return (
                      <td key={i} onClick={() => cambiaCella(r, i + 1)}
                        style={{
                          ...S.td, cursor: 'pointer', textAlign: 'center', fontSize: 12, padding: '6px 4px', minWidth: 46,
                          background: st?.bg, color: st?.color, fontWeight: 700, borderLeft: '1px solid #eef1f7', userSelect: 'none',
                        }}>
                        {st?.testo || ''}
                      </td>
                    );
                  })}
                  <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.importoMensile != null ? fmtEuro(r.importoMensile) : '—'}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>{conta(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TabContanti;
