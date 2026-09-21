import { useState } from 'react';
import ModaleControllo from './ModaleControllo';
import toast from 'react-hot-toast';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

function TabControlli({ azienda, onUpdateAzienda, onAddControllo, tipiControllo, readOnly }) {
  const [mostraModaleControllo, setMostraModaleControllo] = useState(false);
  const [controlloInModifica, setControlloInModifica] = useState(null);
  const [controlloInRinnovo, setControlloInRinnovo] = useState(null);
  const [nuovaScadenza, setNuovaScadenza] = useState('');
  const [salvandoRinnovo, setSalvandoRinnovo] = useState(false);

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const getStatoScadenza = (scadenza, completato) => {
    if (completato) return { label: 'COMPLETATO', color: '#16223b', bg: '#dde3f0' };
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const diff = Math.ceil((dataScadenza - oggi) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'SCADUTO', color: '#dc2626', bg: '#fee2e2' };
    if (diff <= 7) return { label: 'URGENTE', color: '#d97706', bg: '#fef3c7' };
    return { label: 'OK', color: '#059669', bg: '#d1fae5' };
  };

  const uploadFileControllo = async (file, aziendaId) => {
    if (!file) return { pdfUrl: null, pdfPath: null };
    const fileName = `${Date.now()}_${file.name}`;
    const pdfPath = `controlli/${aziendaId}/${fileName}`;
    const storageRef = ref(storage, pdfPath);
    await uploadBytes(storageRef, file);
    const pdfUrl = await getDownloadURL(storageRef);
    return { pdfUrl, pdfPath };
  };

  const handleSaveControllo = async (nuovoControllo, file) => {
    try {
      const { pdfUrl, pdfPath } = await uploadFileControllo(file, azienda.id);
      onAddControllo(azienda.id, { ...nuovoControllo, pdfUrl, pdfPath });
      setMostraModaleControllo(false);
    } catch {
      toast.error('Errore nel caricamento del documento');
    }
  };

  const handleSaveModifica = async (controlloAggiornato, file, rimuoviDoc) => {
    try {
      let pdfUrl = controlloInModifica.pdfUrl ?? null;
      let pdfPath = controlloInModifica.pdfPath ?? null;

      if (rimuoviDoc && pdfPath) {
        try { await deleteObject(ref(storage, pdfPath)); } catch (_) {}
        pdfUrl = null;
        pdfPath = null;
      } else if (file) {
        const uploaded = await uploadFileControllo(file, azienda.id);
        pdfUrl = uploaded.pdfUrl;
        pdfPath = uploaded.pdfPath;
      }

      const controlliAggiornati = azienda.controlli.map(c =>
        c.id === controlloInModifica.id
          ? { ...controlloAggiornato, id: c.id, pdfUrl, pdfPath }
          : c
      );
      await onUpdateAzienda(azienda.id, { controlli: controlliAggiornati });
      toast.success('Controllo aggiornato!');
      setControlloInModifica(null);
    } catch {
      toast.error('Errore nel salvataggio');
    }
  };

  const apriRinnovo = (controllo) => {
    setControlloInRinnovo(controllo);
    setNuovaScadenza('');
  };

  const handleConfermRinnovo = async () => {
    if (!nuovaScadenza) { toast.error('Inserisci la nuova data di scadenza'); return; }
    setSalvandoRinnovo(true);
    try {
      const controlliAggiornati = azienda.controlli.map(c =>
        c.id === controlloInRinnovo.id
          ? { ...c, scadenza: nuovaScadenza, completato: false }
          : c
      );
      await onUpdateAzienda(azienda.id, { controlli: controlliAggiornati });
      toast.success('Controllo rinnovato con successo!');
      setControlloInRinnovo(null);
    } catch {
      toast.error('Errore nel rinnovo del controllo');
    } finally {
      setSalvandoRinnovo(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>Controlli di sicurezza ({azienda.controlli.length})</h3>
        {!readOnly && (
          <button
            onClick={() => setMostraModaleControllo(true)}
            style={{
              background: '#2c3e66',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Nuovo Controllo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {azienda.controlli.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9aa7bf', padding: '30px' }}>Nessun controllo associato</p>
        )}

        {azienda.controlli.map((controllo) => {
          const stato = getStatoScadenza(controllo.scadenza, controllo.completato);
          return (
            <div
              key={controllo.id}
              style={{
                background: 'white',
                padding: '16px',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #dfe5ef',
                gap: 12
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ marginBottom: '5px' }}>{controllo.tipo}</h4>
                <p style={{ fontSize: '14px', color: '#5f6f8c' }}>Scadenza: {formatData(controllo.scadenza)}</p>
                {controllo.note && (
                  <p style={{ fontSize: '13px', color: '#9aa7bf', marginTop: '5px' }}>Note: {controllo.note}</p>
                )}
                {controllo.pdfUrl && (
                  <a href={controllo.pdfUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#2c3e66', fontWeight: 600 }}>
                    📄 Visualizza documento
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span
                  style={{
                    background: stato.bg,
                    color: stato.color,
                    padding: '5px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                >
                  {stato.label}
                </span>
                {!readOnly && (
                  <>
                    <button
                      onClick={() => setControlloInModifica(controllo)}
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      ✏️ Modifica
                    </button>
                    <button
                      onClick={() => apriRinnovo(controllo)}
                      style={{
                        background: '#eef1f8',
                        color: '#34508a',
                        border: '1px solid #d5ddee',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      🔄 Rinnova
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {mostraModaleControllo && (
        <ModaleControllo
          onClose={() => setMostraModaleControllo(false)}
          onSave={handleSaveControllo}
          tipiControllo={tipiControllo}
        />
      )}

      {controlloInModifica && (
        <ModaleControllo
          onClose={() => setControlloInModifica(null)}
          onSave={handleSaveModifica}
          controllo={controlloInModifica}
          tipiControllo={tipiControllo}
        />
      )}

      {controlloInRinnovo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 6px' }}>🔄 Rinnova Controllo</h3>
            <p style={{ color: '#5f6f8c', fontSize: 14, margin: '0 0 20px' }}>
              <strong>{controlloInRinnovo.tipo}</strong><br />
              Scadenza attuale: {formatData(controlloInRinnovo.scadenza)}
            </p>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Nuova data di scadenza *
            </label>
            <input
              type="date"
              value={nuovaScadenza}
              onChange={e => setNuovaScadenza(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setControlloInRinnovo(null)}
                disabled={salvandoRinnovo}
                style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfermRinnovo}
                disabled={salvandoRinnovo}
                style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: salvandoRinnovo ? '#9aa7bf' : '#34508a', color: 'white', cursor: salvandoRinnovo ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                {salvandoRinnovo ? 'Salvataggio...' : 'Conferma Rinnovo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabControlli;
