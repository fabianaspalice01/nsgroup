import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';
import BadgeStato, { statoScadenza } from './BadgeStato';
import ConfirmModal from './ConfirmModal';
import Icona from './Icona';
import ModaleManutenzione, { ModaleIntervento } from './ModaleManutenzione';
import './PaginaManutenzioni.css';

// Le manutenzioni si avvisano con un mese di anticipo: servono tempo per fissare il tecnico
const GIORNI_AVVISO = 30;

const FILTRI = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'danger', label: 'Scadute' },
  { id: 'warn', label: 'In scadenza' },
  { id: 'ok', label: 'In regola' },
];

const AZIONI_REGISTRO = {
  aggiunta: { icona: 'piu', testo: 'Aggiunta' },
  modifica: { icona: 'modifica', testo: 'Modificata' },
  intervento: { icona: 'check', testo: 'Intervento' },
  eliminata: { icona: 'cestino', testo: 'Eliminata' },
};

const formatData = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

async function caricaPdf(file, aziendaId) {
  const pdfPath = `manutenzioni/${aziendaId}/${Date.now()}_${file.name}`;
  const r = ref(storage, pdfPath);
  await uploadBytes(r, file, { contentType: 'application/pdf' });
  return { pdfUrl: await getDownloadURL(r), pdfPath };
}

function StatCard({ label, valore, meta, allarme = false }) {
  return (
    <div className="ns-card ns-stat">
      <span className="ns-stat__label">{label}</span>
      <span className={`ns-stat__value${allarme && valore > 0 ? ' ns-stat__value--danger' : ''}`}>{valore}</span>
      <span className="ns-stat__meta">{meta}</span>
    </div>
  );
}

function RigaManutenzione({ m, puoIntervenire, puoGestire, mostraAzienda, onApriAzienda, onIntervento, onModifica, onElimina }) {
  const [storicoAperto, setStoricoAperto] = useState(false);
  const stato = statoScadenza(m.scadenza, GIORNI_AVVISO) || { tipo: 'neutral', testo: 'Senza data' };
  const interventi = [...(m.interventi || [])].sort((a, b) => b.data.localeCompare(a.data));
  const dettagli = [m.descrizione, m.ubicazione, m.ditta].filter(Boolean).join(' · ');

  return (
    <div className="man-row">
      <div className="man-row__main">
        <span className="man-row__name">
          {m.tipo}{m.quantita ? ` (${m.quantita})` : ''}
        </span>
        {(mostraAzienda || dettagli) && (
          <span className="man-row__sub">
            {mostraAzienda && (onApriAzienda
              ? <button type="button" className="man-row__azienda" onClick={() => onApriAzienda(m.aziendaId)}>{m.aziendaNome}</button>
              : <strong>{m.aziendaNome}</strong>)}
            {mostraAzienda && dettagli && ' · '}
            {dettagli}
          </span>
        )}
        {m.aziendaIndirizzo && <span className="man-row__sub"><Icona nome="luogo" testo />{m.aziendaIndirizzo}</span>}
        {m.aziendaMorosa !== undefined && (
          <span className="man-row__sub">
            {/* Il manutentore sa solo se l'azienda è in regola, non di quanto */}
            {m.aziendaMorosa
              ? <BadgeStato tipo="danger">Azienda morosa</BadgeStato>
              : <BadgeStato tipo="ok">Pagamenti in regola</BadgeStato>}
          </span>
        )}
        <span className="man-row__sub">
          Ultimo intervento: {formatData(m.ultimoIntervento)} · ogni {m.periodicitaMesi} mesi
          {m.pdfUrl && <> · <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer"><Icona nome="documento" testo />Rapporto</a></>}
        </span>
      </div>

      <div className="man-row__side">
        <span className="man-row__date">{formatData(m.scadenza)}</span>
        <BadgeStato tipo={stato.tipo}>{stato.testo}</BadgeStato>
        {puoIntervenire && (
          <button type="button" className="ns-btn ns-btn--primary ns-btn--sm" onClick={() => onIntervento(m)}>
            <Icona nome="check" />Intervento
          </button>
        )}
        {interventi.length > 0 && (
          <button type="button" className="ns-btn ns-btn--secondary ns-btn--sm" aria-expanded={storicoAperto} onClick={() => setStoricoAperto(a => !a)}>
            <Icona nome="orologio" />Storico ({interventi.length})
          </button>
        )}
        {puoGestire && (
          <>
            <button type="button" className="ns-btn ns-btn--ghost ns-btn--sm" onClick={() => onModifica(m)} aria-label={`Modifica ${m.tipo}`}>
              <Icona nome="modifica" />
            </button>
            <button type="button" className="ns-btn ns-btn--ghost ns-btn--sm" onClick={() => onElimina(m)} aria-label={`Elimina ${m.tipo}`}>
              <Icona nome="cestino" />
            </button>
          </>
        )}
      </div>

      {storicoAperto && (
        <ul className="man-storico">
          {interventi.map(i => (
            <li key={i.id}>
              <strong>{formatData(i.data)}</strong>
              {i.tecnico && ` · ${i.tecnico}`}
              {i.note && ` — ${i.note}`}
              {i.pdfUrl && <> · <a href={i.pdfUrl} target="_blank" rel="noopener noreferrer">Rapporto</a></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Registro di chi ha aggiunto, modificato o eseguito manutenzioni su un'azienda
function RegistroAggiornamenti({ registro }) {
  const voci = [...registro].sort((a, b) => b.quando.localeCompare(a.quando));
  return (
    <section className="ns-card man-list" aria-label="Registro aggiornamenti">
      <div className="man-registro__head"><Icona nome="elenco" testo />Registro aggiornamenti</div>
      {voci.length === 0 ? (
        <p className="man-empty">Nessun aggiornamento registrato.</p>
      ) : voci.map(v => {
        const azione = AZIONI_REGISTRO[v.azione] || AZIONI_REGISTRO.modifica;
        return (
          <div key={v.id} className="man-row">
            <div className="man-row__main">
              <span className="man-row__name"><Icona nome={azione.icona} testo />{azione.testo} · {v.manutenzione}</span>
              {v.dettaglio && <span className="man-row__sub">{v.dettaglio}</span>}
            </div>
            <div className="man-row__side">
              <span className="man-row__sub">{v.utente}</span>
              <span className="man-row__date">
                {new Date(v.quando).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Manutenzioni periodiche (estintori, impianti, porte REI…). Sono salvate nel campo `manutenzioni`
// della scheda azienda, come i controlli; ogni modifica finisce anche in `registroManutenzioni`.
// Con `aziendaFissa` diventa la scheda "Manutenzioni" di una sola azienda.
// Con `manutentore` riceve le viste ridotte (vista_manutenzioni) e può solo registrare interventi,
// che passano dalla Cloud Function registraInterventoManutenzione.
export default function PaginaManutenzioni({ aziende = [], aziendaFissa = null, onApriAzienda, utente = '', readOnly = false, manutentore = false }) {
  const puoGestire = !readOnly && !manutentore;
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState('tutte');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modale, setModale] = useState(null); // { tipo: 'scheda' | 'intervento', manutenzione? }
  const [daEliminare, setDaEliminare] = useState(null);

  const elencoAziende = useMemo(() => (aziendaFissa ? [aziendaFissa] : aziende), [aziendaFissa, aziende]);

  const tutte = useMemo(() => elencoAziende.flatMap(az =>
    (az.manutenzioni || []).map(m => ({
      ...m,
      aziendaId: az.id,
      aziendaNome: az.nome,
      ...(manutentore ? { aziendaMorosa: !!az.morosa, aziendaIndirizzo: az.indirizzo } : {}),
    }))
  ).sort((a, b) => (a.scadenza || '9999').localeCompare(b.scadenza || '9999')), [elencoAziende, manutentore]);

  const conStato = useMemo(() => tutte.map(m => ({ ...m, stato: statoScadenza(m.scadenza, GIORNI_AVVISO)?.tipo })), [tutte]);

  const visibili = conStato.filter(m => {
    if (filtroStato !== 'tutte' && m.stato !== filtroStato) return false;
    if (filtroTipo && m.tipo !== filtroTipo) return false;
    const q = ricerca.trim().toLowerCase();
    if (!q) return true;
    return [m.aziendaNome, m.tipo, m.descrizione, m.ubicazione, m.ditta].some(v => v?.toLowerCase().includes(q));
  });

  const scadute = conStato.filter(m => m.stato === 'danger').length;
  const inScadenza = conStato.filter(m => m.stato === 'warn').length;
  const meseCorrente = new Date().toISOString().slice(0, 7);
  const interventiMese = tutte.reduce((n, m) => n + (m.interventi || []).filter(i => i.data?.startsWith(meseCorrente)).length, 0);
  const tipiPresenti = [...new Set(tutte.map(m => m.tipo))].sort();

  // Riscrive l'elenco manutenzioni di un'azienda partendo dai dati più recenti e annota l'evento nel registro
  const salvaElenco = (aziendaId, trasforma, evento) => {
    const az = elencoAziende.find(a => a.id === aziendaId);
    const voce = { id: crypto.randomUUID(), quando: new Date().toISOString(), utente: utente || 'Utente', ...evento };
    return updateDoc(doc(db, 'aziende', aziendaId), {
      manutenzioni: trasforma(az?.manutenzioni || []),
      registroManutenzioni: [...(az?.registroManutenzioni || []), voce],
    });
  };

  const handleSalvaScheda = async (form, file, rimuoviDoc) => {
    const { aziendaId, aziendaNome, stato, ...dati } = form;
    void aziendaNome; void stato;
    try {
      let { pdfUrl = null, pdfPath = null } = dati;
      if ((rimuoviDoc || file) && pdfPath) {
        try { await deleteObject(ref(storage, pdfPath)); } catch { /* file già rimosso */ }
        pdfUrl = null; pdfPath = null;
      }
      if (file) ({ pdfUrl, pdfPath } = await caricaPdf(file, aziendaId));
      const scheda = { ...dati, quantita: dati.quantita ? Number(dati.quantita) : '', periodicitaMesi: Number(dati.periodicitaMesi) || 12, pdfUrl, pdfPath };
      const dettaglio = [dati.ubicazione, `prossima scadenza ${formatData(scheda.scadenza)}`].filter(Boolean).join(' · ');

      if (dati.id) {
        await salvaElenco(aziendaId, elenco => elenco.map(m => (m.id === dati.id ? scheda : m)),
          { azione: 'modifica', manutenzione: scheda.tipo, dettaglio });
        toast.success('Manutenzione aggiornata');
      } else {
        await salvaElenco(aziendaId, elenco => [...elenco, { ...scheda, id: crypto.randomUUID(), interventi: [] }],
          { azione: 'aggiunta', manutenzione: scheda.tipo, dettaglio });
        toast.success('Manutenzione aggiunta');
      }
      setModale(null);
    } catch (err) {
      console.error('Errore salvataggio manutenzione:', err);
      toast.error('Errore nel salvataggio della manutenzione');
    }
  };

  const handleSalvaIntervento = async ({ data, scadenza, tecnico, note }, file) => {
    const m = modale.manutenzione;
    try {
      const allegato = file ? await caricaPdf(file, m.aziendaId) : { pdfUrl: null, pdfPath: null };
      if (manutentore) {
        await httpsCallable(functions, 'registraInterventoManutenzione')({
          aziendaId: m.aziendaId, manutenzioneId: m.id, data, scadenza, tecnico, note, ...allegato,
        });
        toast.success('Intervento registrato');
        setModale(null);
        return;
      }
      const intervento = { id: crypto.randomUUID(), data, tecnico, note, ...allegato };
      await salvaElenco(m.aziendaId, elenco => elenco.map(x => (x.id === m.id
        ? {
          ...x,
          ultimoIntervento: data > (x.ultimoIntervento || '') ? data : x.ultimoIntervento,
          scadenza,
          interventi: [...(x.interventi || []), intervento],
          ...(file ? allegato : {}),
        }
        : x)), {
        azione: 'intervento',
        manutenzione: m.tipo,
        dettaglio: [`eseguito il ${formatData(data)}`, tecnico, note, `prossima scadenza ${formatData(scadenza)}`].filter(Boolean).join(' · '),
      });
      toast.success('Intervento registrato');
      setModale(null);
    } catch (err) {
      console.error('Errore registrazione intervento:', err);
      toast.error("Errore nella registrazione dell'intervento");
    }
  };

  const handleElimina = async () => {
    const m = daEliminare;
    setDaEliminare(null);
    try {
      await salvaElenco(m.aziendaId, elenco => elenco.filter(x => x.id !== m.id),
        { azione: 'eliminata', manutenzione: m.tipo, dettaglio: m.ubicazione || '' });
      const percorsi = [m.pdfPath, ...(m.interventi || []).map(i => i.pdfPath)].filter(Boolean);
      await Promise.allSettled([...new Set(percorsi)].map(p => deleteObject(ref(storage, p))));
      toast.success('Manutenzione eliminata');
    } catch (err) {
      console.error('Errore eliminazione manutenzione:', err);
      toast.error("Errore nell'eliminazione");
    }
  };

  const pulsanteNuova = puoGestire && (
    <button type="button" className={`ns-btn ns-btn--primary${aziendaFissa ? ' ns-btn--sm' : ''}`} onClick={() => setModale({ tipo: 'scheda' })}>
      <Icona nome="piu" />Nuova manutenzione
    </button>
  );

  return (
    <div className={aziendaFissa ? 'man man--scheda' : 'man'}>
      {aziendaFissa ? (
        <div className="man-head">
          <h3 style={{ margin: 0 }}>Manutenzioni ({tutte.length})</h3>
          {pulsanteNuova}
        </div>
      ) : (
        <>
          <div className="man-head">
            <h2 className="ns-page-title">Manutenzioni</h2>
            {pulsanteNuova}
          </div>
          <div className="ns-stats">
            <StatCard label="Registrate" valore={tutte.length} meta={`${new Set(tutte.map(m => m.aziendaId)).size} aziende`} />
            <StatCard label="Scadute" valore={scadute} allarme meta={scadute > 0 ? 'Da programmare subito' : 'Nessuna'} />
            <StatCard label="In scadenza" valore={inScadenza} meta={`Entro ${GIORNI_AVVISO} giorni`} />
            {manutentore
              ? <StatCard label="Aziende morose" valore={elencoAziende.filter(az => az.morosa).length} allarme meta="Verifica prima di intervenire" />
              : <StatCard label="Interventi del mese" valore={interventiMese} meta={new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} />}
          </div>
        </>
      )}

      {tutte.length > 0 && (
        <div className="man-toolbar">
          <input
            type="search"
            className="ns-input man-search"
            placeholder={aziendaFissa ? 'Cerca tipo, ubicazione…' : 'Cerca azienda, tipo, ubicazione…'}
            aria-label="Cerca manutenzioni"
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
          />
          <select className="ns-input" aria-label="Tipo" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Tutti i tipi</option>
            {tipiPresenti.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="man-filtri" role="group" aria-label="Stato">
            {FILTRI.map(f => (
              <button
                key={f.id}
                type="button"
                className="ns-btn ns-btn--secondary ns-btn--sm man-filtro"
                aria-pressed={filtroStato === f.id}
                onClick={() => setFiltroStato(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="ns-card man-list" aria-label="Elenco manutenzioni">
        {tutte.length === 0 ? (
          <p className="man-empty">
            Nessuna manutenzione registrata.{puoGestire && ' Aggiungi la prima con «Nuova manutenzione».'}
          </p>
        ) : visibili.length === 0 ? (
          <p className="man-empty">Nessuna manutenzione corrisponde ai filtri.</p>
        ) : visibili.map(m => (
          <RigaManutenzione
            key={`${m.aziendaId}-${m.id}`}
            m={m}
            puoIntervenire={!readOnly}
            puoGestire={puoGestire}
            mostraAzienda={!aziendaFissa}
            onApriAzienda={aziendaFissa ? null : onApriAzienda}
            onIntervento={x => setModale({ tipo: 'intervento', manutenzione: x })}
            onModifica={x => setModale({ tipo: 'scheda', manutenzione: x })}
            onElimina={setDaEliminare}
          />
        ))}
      </section>

      {aziendaFissa && <RegistroAggiornamenti registro={aziendaFissa.registroManutenzioni || []} />}

      {modale?.tipo === 'scheda' && (
        <ModaleManutenzione
          manutenzione={modale.manutenzione}
          aziende={elencoAziende}
          onClose={() => setModale(null)}
          onSave={handleSalvaScheda}
        />
      )}

      {modale?.tipo === 'intervento' && (
        <ModaleIntervento
          manutenzione={modale.manutenzione}
          onClose={() => setModale(null)}
          onSave={handleSalvaIntervento}
        />
      )}

      {daEliminare && (
        <ConfirmModal
          message={`Eliminare la manutenzione «${daEliminare.tipo}» di ${daEliminare.aziendaNome}? Verrà cancellato anche lo storico degli interventi.`}
          confirmLabel="Elimina"
          danger
          onConfirm={handleElimina}
          onCancel={() => setDaEliminare(null)}
        />
      )}
    </div>
  );
}
