import { useState } from 'react';
import toast from 'react-hot-toast';
import DropZone from './DropZone';
import Icona from './Icona';

// Tipi di manutenzione con la periodicità di legge/uso più comune (in mesi), modificabile caso per caso.
const TIPI_MANUTENZIONE = [
  { tipo: 'Estintori', mesi: 6 },
  { tipo: 'Idranti e naspi', mesi: 6 },
  { tipo: 'Porte tagliafuoco (REI)', mesi: 6 },
  { tipo: 'Luci di emergenza', mesi: 6 },
  { tipo: 'Impianto rilevazione fumi', mesi: 6 },
  { tipo: 'Cassetta primo soccorso', mesi: 6 },
  { tipo: 'Defibrillatore (DAE)', mesi: 12 },
  { tipo: 'Impianto elettrico', mesi: 12 },
  { tipo: 'Messa a terra (DPR 462/01)', mesi: 24 },
  { tipo: 'Impianto di condizionamento', mesi: 12 },
  { tipo: 'Ascensore', mesi: 6 },
  { tipo: 'Altro', mesi: 12 },
];

const oggiIso = () => new Date().toISOString().split('T')[0];

// Somma mesi a una data 'aaaa-mm-gg' restando nell'ultimo giorno del mese se serve (31/01 + 1 → 28/02).
// eslint-disable-next-line react-refresh/only-export-components
export function aggiungiMesi(data, mesi) {
  if (!data || !mesi) return '';
  const [a, m, g] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + Number(mesi) + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + Number(mesi), Math.min(g, ultimo))).toISOString().slice(0, 10);
}

function CampoPdf({ file, onFile, urlAttuale, onRimuoviAttuale }) {
  if (file) {
    return (
      <div className="man-file">
        <Icona nome="documento" /><span>{file.name}</span>
        <button type="button" className="ns-btn ns-btn--ghost ns-btn--sm" onClick={() => onFile(null)}>Rimuovi</button>
      </div>
    );
  }
  if (urlAttuale) {
    return (
      <div className="man-file">
        <Icona nome="documento" /><a href={urlAttuale} target="_blank" rel="noopener noreferrer">Rapporto attuale</a>
        <button type="button" className="ns-btn ns-btn--ghost ns-btn--sm" onClick={onRimuoviAttuale}>Rimuovi</button>
      </div>
    );
  }
  return (
    <DropZone
      accept=".pdf"
      file={null}
      compact
      onFile={f => {
        if (f.type !== 'application/pdf') { toast.error('Sono accettati solo file PDF'); return; }
        if (f.size > 10 * 1024 * 1024) { toast.error('Il file è troppo grande: massimo 10MB'); return; }
        onFile(f);
      }}
    />
  );
}

// Nuova manutenzione o modifica di una esistente (scheda dell'impianto/attrezzatura).
export default function ModaleManutenzione({ manutenzione, aziende, onClose, onSave }) {
  const nuova = !manutenzione;
  const [form, setForm] = useState(manutenzione || {
    aziendaId: aziende.length === 1 ? aziende[0].id : '',
    tipo: TIPI_MANUTENZIONE[0].tipo,
    descrizione: '',
    quantita: '',
    ubicazione: '',
    periodicitaMesi: TIPI_MANUTENZIONE[0].mesi,
    ultimoIntervento: '',
    scadenza: '',
    ditta: '',
    note: '',
  });
  const [file, setFile] = useState(null);
  const [rimuoviDoc, setRimuoviDoc] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const cambia = (campo, valore) => setForm(prev => {
    const next = { ...prev, [campo]: valore };
    if (campo === 'tipo' && nuova) {
      next.periodicitaMesi = TIPI_MANUTENZIONE.find(t => t.tipo === valore)?.mesi ?? prev.periodicitaMesi;
    }
    // La prossima scadenza segue l'ultimo intervento finché non viene scritta a mano
    if ((campo === 'ultimoIntervento' || campo === 'periodicitaMesi' || campo === 'tipo') && next.ultimoIntervento) {
      next.scadenza = aggiungiMesi(next.ultimoIntervento, next.periodicitaMesi);
    }
    return next;
  });

  const salva = async () => {
    if (!form.aziendaId) { toast.error("Scegli l'azienda"); return; }
    if (!form.scadenza) { toast.error('Indica la prossima scadenza'); return; }
    setSalvando(true);
    try {
      await onSave(form, file, rimuoviDoc);
    } finally {
      setSalvando(false);
    }
  };

  const aziendeOrdinate = [...aziende].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  return (
    <div className="man-overlay" role="dialog" aria-modal="true" aria-labelledby="man-modal-titolo">
      <div className="man-modal">
        <h3 id="man-modal-titolo">{nuova ? 'Nuova manutenzione' : 'Modifica manutenzione'}</h3>

        <div className="man-grid">
          <label className="man-field man-field--wide">
            <span className="ns-label">Azienda *</span>
            <select className="ns-input" value={form.aziendaId} disabled={!nuova || aziende.length === 1} onChange={e => cambia('aziendaId', e.target.value)}>
              <option value="">Seleziona…</option>
              {aziendeOrdinate.map(az => <option key={az.id} value={az.id}>{az.nome}</option>)}
            </select>
          </label>

          <label className="man-field">
            <span className="ns-label">Tipo *</span>
            <select className="ns-input" value={form.tipo} onChange={e => cambia('tipo', e.target.value)}>
              {TIPI_MANUTENZIONE.map(t => <option key={t.tipo} value={t.tipo}>{t.tipo}</option>)}
              {!TIPI_MANUTENZIONE.some(t => t.tipo === form.tipo) && <option value={form.tipo}>{form.tipo}</option>}
            </select>
          </label>

          <label className="man-field">
            <span className="ns-label">Quantità</span>
            <input className="ns-input" type="number" min="1" placeholder="Es. 14" value={form.quantita} onChange={e => cambia('quantita', e.target.value)} />
          </label>

          <label className="man-field man-field--wide">
            <span className="ns-label">Descrizione</span>
            <input className="ns-input" placeholder="Es. Estintori a polvere 6 kg" value={form.descrizione} onChange={e => cambia('descrizione', e.target.value)} />
          </label>

          <label className="man-field">
            <span className="ns-label">Ubicazione</span>
            <input className="ns-input" placeholder="Es. Magazzino, piano terra" value={form.ubicazione} onChange={e => cambia('ubicazione', e.target.value)} />
          </label>

          <label className="man-field">
            <span className="ns-label">Ditta manutentrice</span>
            <input className="ns-input" placeholder="Es. NS Safety" value={form.ditta} onChange={e => cambia('ditta', e.target.value)} />
          </label>

          <label className="man-field">
            <span className="ns-label">Ogni quanti mesi</span>
            <input className="ns-input" type="number" min="1" value={form.periodicitaMesi} onChange={e => cambia('periodicitaMesi', e.target.value)} />
          </label>

          <label className="man-field">
            <span className="ns-label">Ultimo intervento</span>
            <input className="ns-input" type="date" max={oggiIso()} value={form.ultimoIntervento} onChange={e => cambia('ultimoIntervento', e.target.value)} />
          </label>

          <label className="man-field man-field--wide">
            <span className="ns-label">Prossima scadenza *</span>
            <input className="ns-input" type="date" value={form.scadenza} onChange={e => cambia('scadenza', e.target.value)} />
            <span className="man-hint">Calcolata dall'ultimo intervento e dalla periodicità; puoi correggerla a mano.</span>
          </label>

          <div className="man-field man-field--wide">
            <span className="ns-label">Rapporto PDF (facoltativo)</span>
            <CampoPdf
              file={file}
              onFile={f => { setFile(f); if (f) setRimuoviDoc(false); }}
              urlAttuale={!rimuoviDoc ? manutenzione?.pdfUrl : null}
              onRimuoviAttuale={() => setRimuoviDoc(true)}
            />
          </div>

          <label className="man-field man-field--wide">
            <span className="ns-label">Note</span>
            <textarea className="ns-input" rows="3" value={form.note} onChange={e => cambia('note', e.target.value)} />
          </label>
        </div>

        <div className="man-actions">
          <button type="button" className="ns-btn ns-btn--secondary" onClick={onClose} disabled={salvando}>Annulla</button>
          <button type="button" className="ns-btn ns-btn--primary" onClick={salva} disabled={salvando}>
            <Icona nome="salva" />{salvando ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Registra un intervento eseguito: va nello storico e sposta in avanti la scadenza.
export function ModaleIntervento({ manutenzione, onClose, onSave }) {
  const [data, setData] = useState(oggiIso());
  const [scadenza, setScadenza] = useState(aggiungiMesi(oggiIso(), manutenzione.periodicitaMesi));
  const [tecnico, setTecnico] = useState(manutenzione.ditta || '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const cambiaData = valore => {
    setData(valore);
    setScadenza(aggiungiMesi(valore, manutenzione.periodicitaMesi));
  };

  const salva = async () => {
    if (!data || !scadenza) { toast.error('Indica data e prossima scadenza'); return; }
    setSalvando(true);
    try {
      await onSave({ data, scadenza, tecnico: tecnico.trim(), note: note.trim() }, file);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="man-overlay" role="dialog" aria-modal="true" aria-labelledby="man-int-titolo">
      <div className="man-modal">
        <div>
          <h3 id="man-int-titolo">Registra intervento</h3>
          <p className="ns-muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            {manutenzione.tipo} · {manutenzione.aziendaNome}
          </p>
        </div>

        <div className="man-grid">
          <label className="man-field">
            <span className="ns-label">Data intervento *</span>
            <input className="ns-input" type="date" max={oggiIso()} value={data} onChange={e => cambiaData(e.target.value)} />
          </label>
          <label className="man-field">
            <span className="ns-label">Prossima scadenza *</span>
            <input className="ns-input" type="date" value={scadenza} onChange={e => setScadenza(e.target.value)} />
          </label>
          <label className="man-field man-field--wide">
            <span className="ns-label">Tecnico / ditta</span>
            <input className="ns-input" value={tecnico} onChange={e => setTecnico(e.target.value)} />
          </label>
          <div className="man-field man-field--wide">
            <span className="ns-label">Rapporto PDF (facoltativo)</span>
            <CampoPdf file={file} onFile={setFile} />
          </div>
          <label className="man-field man-field--wide">
            <span className="ns-label">Esito / note</span>
            <textarea className="ns-input" rows="3" placeholder="Es. Sostituito 1 estintore, revisione 2 manichette" value={note} onChange={e => setNote(e.target.value)} />
          </label>
        </div>

        <div className="man-actions">
          <button type="button" className="ns-btn ns-btn--secondary" onClick={onClose} disabled={salvando}>Annulla</button>
          <button type="button" className="ns-btn ns-btn--primary" onClick={salva} disabled={salvando}>
            <Icona nome="check" />{salvando ? 'Salvataggio…' : 'Registra'}
          </button>
        </div>
      </div>
    </div>
  );
}
