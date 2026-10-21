import { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import ModaleDocumento from './ModaleDocumento';
import { CARTELLE_DOCUMENTI, cartellaDocumento } from '../utils/cartelleDocumenti';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';
import BadgeStato, { statoScadenza } from './BadgeStato';
import Icona from './Icona';

function VisualiizzatorePdf({ pdfUrl, nome, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90%', maxWidth: 900, height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--ink)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'var(--ink)', color: 'white', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{nome}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={nome}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, background: 'transparent' }} />
        </div>
      </div>
    </div>
  );
}

function TabDocumenti({ azienda, onUpdateAzienda, readOnly, canDownload = false }) {
  const [mostraModaleDocumento, setMostraModaleDocumento] = useState(false);
  const [documentoInModifica, setDocumentoInModifica] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [cartellaAttiva, setCartellaAttiva] = useState('haccp');
  const documentiCartella = (azienda.documenti || []).filter((documento) => cartellaDocumento(documento) === cartellaAttiva);
  const documentiScaricabili = documentiCartella.filter((documento) => documento.pdfUrl);
  const nomeCartella = CARTELLE_DOCUMENTI.find((c) => c.id === cartellaAttiva)?.label;

  const handleDownloadTutti = async () => {
    if (!canDownload || downloadProgress || !documentiScaricabili.length) return;
    setDownloadProgress('Preparazione ZIP...');
    try {
      const { downloadDocumenti } = await import('../utils/downloadDocumenti');
      await downloadDocumenti(documentiScaricabili, `${azienda.nome} - ${nomeCartella}`,(current, total) => {
        setDownloadProgress(`Scaricamento ${current}/${total}...`);
      });
      toast.success('Archivio ZIP pronto: download avviato');
    } catch (error) {
      toast.error(error.message || 'Download non riuscito. Riprova.');
    } finally {
      setDownloadProgress(null);
    }
  };
  const [pdfInVisualizzazione, setPdfInVisualizzazione] = useState(null);

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const handleAddDocumento = () => {
    setDocumentoInModifica(null);
    setMostraModaleDocumento(true);
  };

  const handleSaveDocumento = async (datiDocumento, file) => {
    if (saving) return;
    setSaving(true);
    try {
      let pdfUrl = null;
      let pdfPath = null;

      if (file) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        pdfPath = `documenti/${azienda.id}/${fileName}`;
        const storageRef = ref(storage, pdfPath);
        await uploadBytes(storageRef, file);
        pdfUrl = await getDownloadURL(storageRef);
      }

      const documentoCompleto = {
        ...datiDocumento,
        id: crypto.randomUUID(),
        pdfUrl,
        pdfPath
      };

      const documenti = azienda.documenti || [];
      await onUpdateAzienda(azienda.id, { documenti: [...documenti, documentoCompleto] });

      setMostraModaleDocumento(false);
      setDocumentoInModifica(null);
      toast.success('Documento aggiunto con successo!');
    } catch (error) {
      console.error('Errore nel salvataggio del documento:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleSpostaDocumento = async (documentoId, cartella) => {
    try {
      const documentiAggiornati = (azienda.documenti || []).map((d) => d.id === documentoId ? { ...d, cartella } : d);
      await onUpdateAzienda(azienda.id, { documenti: documentiAggiornati });
      toast.success(`Documento spostato in ${CARTELLE_DOCUMENTI.find((c) => c.id === cartella)?.label}`);
    } catch (error) {
      console.error('Errore nello spostamento del documento:', error);
      toast.error('Errore nello spostamento del documento');
    }
  };

  const handleDeleteDocumento = (documentoId) => {
    setConfirm({
      message: 'Sei sicuro di voler eliminare questo documento?',
      onConfirm: () => { setConfirm(null); _eliminaDocumento(documentoId); }
    });
  };

  const _eliminaDocumento = async (documentoId) => {
    try {
      const documento = (azienda.documenti || []).find((d) => d.id === documentoId);
      if (documento?.pdfPath) {
        const pdfRef = ref(storage, documento.pdfPath);
        await deleteObject(pdfRef);
      }
      const documentiAggiornati = (azienda.documenti || []).filter((d) => d.id !== documentoId);
      await onUpdateAzienda(azienda.id, { documenti: documentiAggiornati });
      toast.success('Documento eliminato con successo!');
    } catch (error) {
      console.error("Errore nell'eliminazione del documento:", error);
      toast.error("Errore nell'eliminazione del documento");
    }
  };

  return (
    <div>
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: 12 }}>
        <h3><Icona nome="cartella" testo />Documenti Azienda ({(azienda.documenti || []).length})</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {canDownload && documentiScaricabili.length > 0 && (
          <button
            onClick={handleDownloadTutti}
            disabled={!!downloadProgress}
            aria-live="polite"
            style={{ background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: 8, cursor: downloadProgress ? 'wait' : 'pointer', fontSize: 14, fontWeight: 'bold', opacity: downloadProgress ? 0.7 : 1 }}
          >
            {downloadProgress || `Scarica tutti (${documentiScaricabili.length}) · ZIP`}
          </button>
        )}
        {!readOnly && (
          <button
            onClick={handleAddDocumento}
            style={{
              background: 'var(--primary-ink)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Aggiungi Documento
          </button>
        )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {CARTELLE_DOCUMENTI.map((cartella) => {
          const attiva = cartella.id === cartellaAttiva;
          const numero = (azienda.documenti || []).filter((d) => cartellaDocumento(d) === cartella.id).length;
          return (
            <button
              key={cartella.id}
              onClick={() => setCartellaAttiva(cartella.id)}
              aria-pressed={attiva}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: attiva ? '1px solid var(--primary)' : '1px solid var(--line)',
                background: attiva ? 'var(--primary)' : 'white',
                color: attiva ? 'white' : 'var(--ink-muted)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {attiva ? <Icona nome="cartella" /> : <Icona nome="cartella" />} {cartella.label} ({numero})
            </button>
          );
        })}
      </div>

      {documentiCartella.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '20px', background: 'white', borderRadius: '10px' }}>
          Nessun documento in {nomeCartella}
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {documentiCartella.map((documento) => {
            const stato = statoScadenza(documento.dataScadenza);

            return (
              <div
                key={documento.id}
                style={{
                  background: 'var(--surface)',
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--line)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>{documento.nome}</div>
                  <div style={{ fontSize: '12px', color: 'var(--primary-ink)', fontWeight: '600', marginBottom: '8px' }}>{documento.tipo}</div>

                  {documento.dataScadenza && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '6px' }}>
                      <span>Scadenza: {formatData(documento.dataScadenza)}</span>
                      <BadgeStato tipo={stato.tipo}>{stato.testo}</BadgeStato>
                    </div>
                  )}

                  {documento.numeroDocumento && (
                    <div style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>N° {documento.numeroDocumento}</div>
                  )}

                  {documento.note && (
                    <div style={{ fontSize: '11px', color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: '4px' }}>{documento.note}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {documento.pdfUrl && (
                    <button
                      onClick={() => setPdfInVisualizzazione(documento)}
                      style={{
                        flex: 1,
                        background: 'var(--primary-soft)',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: 'var(--primary-ink)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <Icona nome="documento" testo />Visualizza
                    </button>
                  )}
                  {documento.pdfUrl && canDownload && (
                    <a
                      href={documento.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: 'var(--success-soft)',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: 'var(--success)',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}
                    >
                      <Icona nome="scarica" testo />Scarica
                    </a>
                  )}
                  {!readOnly && (
                    <select
                      value={cartellaDocumento(documento)}
                      onChange={(e) => handleSpostaDocumento(documento.id, e.target.value)}
                      aria-label="Sposta in cartella"
                      title="Sposta in cartella"
                      style={{ border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '12px', color: 'var(--ink-muted)', background: 'white', cursor: 'pointer' }}
                    >
                      {CARTELLE_DOCUMENTI.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteDocumento(documento.id)}
                      style={{
                        background: 'var(--danger-soft)',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--danger)',
                        fontWeight: 'bold'
                      }}
                    >
                      <Icona nome="cestino" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostraModaleDocumento && (
        <ModaleDocumento
          onClose={() => {
            setMostraModaleDocumento(false);
            setDocumentoInModifica(null);
          }}
          onSave={handleSaveDocumento}
          documento={documentoInModifica}
          cartellaIniziale={cartellaAttiva}
        />
      )}

      {pdfInVisualizzazione && (
        <VisualiizzatorePdf
          pdfUrl={pdfInVisualizzazione.pdfUrl}
          nome={pdfInVisualizzazione.nome}
          onClose={() => setPdfInVisualizzazione(null)}
        />
      )}
    </div>
  );
}

export default TabDocumenti;
