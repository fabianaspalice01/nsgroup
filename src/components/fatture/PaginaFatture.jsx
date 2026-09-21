import { useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { btn } from './util';
import { caricaDemo, rimuoviDemo } from './datiDemo';
import { useCollezione } from '../../hooks/useCollezione';
import TabRegistro from './TabRegistro';
import TabInsoluti from './TabInsoluti';
import TabElenco from './TabElenco';
import TabContanti from './TabContanti';
import TabPresenze from './TabPresenze';
import { CONFIG_INCASSI, CONFIG_SPESE, CONFIG_STIPENDI, CONFIG_SORVEGLIANZA } from './configElenchi';
import { estraiDaIncassare } from './registro';

const SEZIONI = [
  { id: 'registro', label: '🧾 Fatturazione' },
  { id: 'insoluti', label: '⏳ Insoluti' },
  { id: 'incassi', label: '💶 Incassi' },
  { id: 'spese', label: '📤 Spese' },
  { id: 'stipendi', label: '👤 Stipendi' },
  { id: 'sorveglianza', label: '🩺 Sorveglianza sanitaria' },
  { id: 'contanti', label: '💵 Contanti' },
  { id: 'presenze', label: '🗓️ Presenze' },
];

// Sezione riservata all'amministratore. Ogni sotto-sezione ha i suoi dati (collezioni Firestore fatt_*).
function PaginaFatture({ aziende }) {
  const [sezione, setSezione] = useState('registro');
  // Il registro serve sia alla sezione Fatturazione sia agli Insoluti, quindi si carica una volta sola
  const registro = useCollezione('fatt_registro');
  const nInsoluti = estraiDaIncassare(registro.voci).length;
  const [confirm, setConfirm] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const haDemo = registro.voci.some((v) => v.demo);

  const esegui = async (azione, okMsg) => {
    setConfirm(null);
    setOccupato(true);
    try {
      await azione();
    } catch (e) {
      console.error(e);
      toast.error('Operazione non riuscita');
      setOccupato(false);
      return;
    }
    setOccupato(false);
    toast.success(okMsg);
  };

  const chiediCaricaDemo = () => setConfirm({
    message: 'Aggiungere dati fittizi (aziende, fatture, incassi, spese, presenze…) per provare la sezione? Sono marcati come esempio e si possono rimuovere in un clic senza toccare i dati veri.',
    confirmLabel: 'Aggiungi',
    onConfirm: () => esegui(async () => {
      const r = await caricaDemo();
      if (r.presenzeSaltate) toast('Presenze del mese già presenti: non sostituite', { icon: 'ℹ️' });
    }, 'Dati di esempio aggiunti'),
  });

  const chiediRimuoviDemo = () => setConfirm({
    message: 'Rimuovere tutti i dati di esempio? I dati che hai inserito tu non verranno toccati.',
    confirmLabel: 'Rimuovi',
    danger: true,
    onConfirm: () => esegui(rimuoviDemo, 'Dati di esempio rimossi'),
  });

  return (
    <div>
      {confirm && (
        <ConfirmModal message={confirm.message} confirmLabel={confirm.confirmLabel} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <h2 style={{ margin: 0, color: '#1a2540' }}>🧾 Fatture e contabilità</h2>
        {haDemo ? (
          <button onClick={chiediRimuoviDemo} disabled={occupato} style={btn('danger', { opacity: occupato ? 0.6 : 1 })}>
            {occupato ? 'Attendi…' : '🗑️ Rimuovi dati di esempio'}
          </button>
        ) : (
          <button onClick={chiediCaricaDemo} disabled={occupato} style={btn('ghost', { opacity: occupato ? 0.6 : 1 })}>
            {occupato ? 'Attendi…' : '🧪 Carica dati di esempio'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {SEZIONI.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSezione(id)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              border: sezione === id ? 'none' : '1.5px solid #dfe5ef',
              background: sezione === id ? '#2c3e66' : '#fff',
              color: sezione === id ? '#fff' : '#45536f',
            }}
          >
            {label}
            {id === 'insoluti' && nInsoluti > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11, background: '#dc2626', color: '#fff' }}>{nInsoluti}</span>
            )}
          </button>
        ))}
      </div>

      {sezione === 'registro' && (
        <TabRegistro registro={registro.voci} caricando={registro.caricando} salva={registro.salva} elimina={registro.elimina} aziende={aziende} />
      )}
      {sezione === 'insoluti' && (
        <TabInsoluti registro={registro.voci} caricando={registro.caricando} salva={registro.salva} />
      )}
      {sezione === 'incassi' && <TabElenco config={CONFIG_INCASSI} aziende={aziende} />}
      {sezione === 'spese' && <TabElenco config={CONFIG_SPESE} aziende={aziende} />}
      {sezione === 'stipendi' && <TabElenco config={CONFIG_STIPENDI} aziende={aziende} />}
      {sezione === 'sorveglianza' && <TabElenco config={CONFIG_SORVEGLIANZA} aziende={aziende} />}
      {sezione === 'contanti' && <TabContanti aziende={aziende} />}
      {sezione === 'presenze' && <TabPresenze />}
    </div>
  );
}

export default PaginaFatture;
