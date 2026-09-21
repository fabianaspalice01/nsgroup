import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ConfirmModal from './ConfirmModal';
import ModaleDipendente from './ModaleDipendente';
import ModaleAttestato from './ModaleAttestato';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';

const COLONNE_MAPPA = {
  nome: ['nome', 'name', 'firstname', 'first name'],
  cognome: ['cognome', 'surname', 'lastname', 'last name'],
  mansione: ['mansione', 'ruolo', 'role', 'posizione', 'qualifica'],
  telefono: ['telefono', 'tel', 'phone', 'cellulare', 'cell'],
  email: ['email', 'mail', 'e-mail'],
  note: ['note', 'notes', 'annotazioni'],
};

function normalizza(str) {
  return (str || '').toString().toLowerCase().trim();
}

function mappaRiga(intestazioni, riga) {
  const result = { nome: '', cognome: '', mansione: '', telefono: '', email: '', note: '' };
  for (const [campo, varianti] of Object.entries(COLONNE_MAPPA)) {
    const idx = intestazioni.findIndex((h) => varianti.includes(normalizza(h)));
    if (idx !== -1) result[campo] = (riga[idx] || '').toString().trim();
  }
  return result;
}

function TabDipendenti({ azienda, onUpdateAzienda, readOnly, canDownload = false }) {
  const [mostraModaleDipendente, setMostraModaleDipendente] = useState(false);
  const [dipendenteInModifica, setDipendenteInModifica] = useState(null);
  const [mostraModaleAttestato, setMostraModaleAttestato] = useState(false);
  const [dipendentePerAttestato, setDipendentePerAttestato] = useState(null);
  const [attestatoInModifica, setAttestatoInModifica] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [anteprima, setAnteprima] = useState(null);
  const fileInputRef = useRef(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const attestatiScaricabili = (azienda.dipendenti || []).flatMap((dipendente) =>
    (dipendente.attestati || []).filter((attestato) => attestato.pdfUrl).map((attestato) => ({
      ...attestato,
      nome: `${[dipendente.cognome, dipendente.nome].filter(Boolean).join(' ') || 'Dipendente'} - ${attestato.nome || 'Attestato'}`,
    }))
  );

  const handleDownloadTutti = async () => {
    if (!canDownload || downloadProgress || !attestatiScaricabili.length) return;
    setDownloadProgress('Preparazione ZIP...');
    try {
      const { downloadDocumenti } = await import('../utils/downloadDocumenti');
      await downloadDocumenti(attestatiScaricabili, `Dipendenti_${azienda.nome || 'Azienda'}`, (current, total) => {
        setDownloadProgress(`Scaricamento ${current}/${total}...`);
      });
      toast.success('Archivio ZIP pronto: download avviato');
    } catch (error) {
      toast.error(error.message || 'Download non riuscito. Riprova.');
    } finally {
      setDownloadProgress(null);
    }
  };

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const handleSaveDipendente = (nuovoDipendente) => {
    if (dipendenteInModifica) {
      const dipendentiAggiornati = (azienda.dipendenti || []).map((d) =>
        d.id === dipendenteInModifica.id ? { ...nuovoDipendente, id: d.id, attestati: d.attestati } : d
      );
      onUpdateAzienda(azienda.id, { dipendenti: dipendentiAggiornati });
    } else {
      const dipendentiAttuali = azienda.dipendenti || [];
      const nuovoDipendenteCompleto = { ...nuovoDipendente, id: crypto.randomUUID(), attestati: [] };
      onUpdateAzienda(azienda.id, { dipendenti: [...dipendentiAttuali, nuovoDipendenteCompleto] });
    }
    setMostraModaleDipendente(false);
    setDipendenteInModifica(null);
  };

  const handleDeleteDipendente = (dipId) => {
    setConfirm({
      message: 'Sei sicuro di voler eliminare questo dipendente?',
      onConfirm: () => {
        setConfirm(null);
        const dipendentiAggiornati = (azienda.dipendenti || []).filter((d) => d.id !== dipId);
        onUpdateAzienda(azienda.id, { dipendenti: dipendentiAggiornati });
      }
    });
  };

  const handleFileExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const righe = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (righe.length < 2) {
          toast.error('Il file è vuoto o non ha righe di dati');
          return;
        }
        const intestazioni = righe[0];
        const dipendenti = righe.slice(1)
          .map((r) => mappaRiga(intestazioni, r))
          .filter((d) => d.nome || d.cognome);

        if (dipendenti.length === 0) {
          toast.error('Nessun dipendente trovato. Verifica le intestazioni delle colonne.');
          return;
        }
        setAnteprima(dipendenti);
      } catch {
        toast.error('Errore nella lettura del file Excel');
      }
    };
    reader.readAsBinaryString(file);
  };

  const confermaImport = () => {
    const nuovi = anteprima.map((d) => ({ ...d, id: crypto.randomUUID(), attestati: [] }));
    const dipendentiAggiornati = [...(azienda.dipendenti || []), ...nuovi];
    onUpdateAzienda(azienda.id, { dipendenti: dipendentiAggiornati });
    setAnteprima(null);
    toast.success(`${nuovi.length} dipendenti importati con successo!`);
  };

  const scaricaModello = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Nome', 'Cognome', 'Mansione', 'Telefono', 'Email', 'Note']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dipendenti');
    XLSX.writeFile(wb, 'modello_dipendenti.xlsx');
  };

  const handleAddAttestato = (dipendente) => {
    setDipendentePerAttestato(dipendente);
    setAttestatoInModifica(null);
    setMostraModaleAttestato(true);
  };

  const handleEditAttestato = (dipendente, attestato) => {
    setDipendentePerAttestato(dipendente);
    setAttestatoInModifica(attestato);
    setMostraModaleAttestato(true);
  };

  const handleSaveAttestato = async (datiAttestato, file) => {
    if (saving) return;
    setSaving(true);
    try {
      let pdfUrl = attestatoInModifica?.pdfUrl || null;
      let pdfPath = attestatoInModifica?.pdfPath || null;
      if (file) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        pdfPath = `attestati/${azienda.id}/${dipendentePerAttestato.id}/${fileName}`;
        const storageRef = ref(storage, pdfPath);
        await uploadBytes(storageRef, file);
        pdfUrl = await getDownloadURL(storageRef);
      }

      const dipendentiAggiornati = (azienda.dipendenti || []).map((d) => {
        if (d.id !== dipendentePerAttestato.id) return d;
        if (attestatoInModifica) {
          return {
            ...d,
            attestati: (d.attestati || []).map((a) =>
              a.id === attestatoInModifica.id
                ? { ...datiAttestato, id: a.id, pdfUrl, pdfPath }
                : a
            )
          };
        }
        const attestatoCompleto = { ...datiAttestato, id: crypto.randomUUID(), pdfUrl, pdfPath };
        return { ...d, attestati: [...(d.attestati || []), attestatoCompleto] };
      });

      await onUpdateAzienda(azienda.id, { dipendenti: dipendentiAggiornati });
      setMostraModaleAttestato(false);
      setDipendentePerAttestato(null);
      setAttestatoInModifica(null);
      toast.success(attestatoInModifica ? 'Attestato aggiornato!' : 'Attestato aggiunto con successo!');
    } catch (error) {
      console.error("Errore nel salvataggio dell'attestato:", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttestato = (dipendente, attestatoId) => {
    setConfirm({
      message: 'Sei sicuro di voler eliminare questo attestato?',
      onConfirm: () => { setConfirm(null); _eliminaAttestato(dipendente, attestatoId); }
    });
  };

  const _eliminaAttestato = async (dipendente, attestatoId) => {
    try {
      const attestato = (dipendente.attestati || []).find((a) => a.id === attestatoId);
      if (attestato?.pdfPath) {
        await deleteObject(ref(storage, attestato.pdfPath));
      }
      const dipendentiAggiornati = (azienda.dipendenti || []).map((d) => {
        if (d.id === dipendente.id) {
          return { ...d, attestati: (d.attestati || []).filter((a) => a.id !== attestatoId) };
        }
        return d;
      });
      await onUpdateAzienda(azienda.id, { dipendenti: dipendentiAggiornati });
      toast.success('Attestato eliminato con successo!');
    } catch (error) {
      console.error("Errore nell'eliminazione dell'attestato:", error);
      toast.error("Errore nell'eliminazione dell'attestato");
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
        <h3>Organigramma Aziendale ({(azienda.dipendenti || []).length})</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {canDownload && attestatiScaricabili.length > 0 && (
          <button
            onClick={handleDownloadTutti}
            disabled={!!downloadProgress}
            aria-live="polite"
            title="Scarica tutti gli attestati allegati dei dipendenti"
            style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: 8, cursor: downloadProgress ? 'wait' : 'pointer', fontSize: 14, fontWeight: 'bold', opacity: downloadProgress ? 0.7 : 1 }}
          >
            {downloadProgress || `Scarica tutto (${attestatiScaricabili.length}) · ZIP`}
          </button>
        )}
        {!readOnly && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={scaricaModello}
              style={{
                background: 'white', color: '#5f6f8c', border: '1px solid #dfe5ef',
                padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Modello Excel
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#4a68a0', color: 'white', border: 'none',
                padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: 'bold'
              }}
            >
              Importa Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileExcel}
            />
            <button
              onClick={() => { setDipendenteInModifica(null); setMostraModaleDipendente(true); }}
              style={{
                background: '#10b981', color: 'white', border: 'none',
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '14px', fontWeight: 'bold'
              }}
            >
              + Aggiungi Dipendente
            </button>
          </div>
        )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(!azienda.dipendenti || azienda.dipendenti.length === 0) && (
          <p style={{ textAlign: 'center', color: '#9aa7bf', padding: '30px' }}>Nessun dipendente inserito</p>
        )}

        {(azienda.dipendenti || []).map((dipendente) => (
          <div key={dipendente.id} style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #dfe5ef', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '5px', color: '#1a2540' }}>{dipendente.nome} {dipendente.cognome}</h4>
                {dipendente.mansione && <p style={{ fontSize: '14px', color: '#2c3e66', marginBottom: '5px', fontWeight: '600' }}>{dipendente.mansione}</p>}
                <div style={{ fontSize: '13px', color: '#5f6f8c' }}>
                  {dipendente.telefono && <span>📱 {dipendente.telefono}</span>}
                  {dipendente.telefono && dipendente.email && <span> • </span>}
                  {dipendente.email && <span>✉️ {dipendente.email}</span>}
                </div>
                {dipendente.note && <p style={{ fontSize: '12px', color: '#9aa7bf', marginTop: '5px', fontStyle: 'italic' }}>{dipendente.note}</p>}
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setDipendenteInModifica(dipendente); setMostraModaleDipendente(true); }}
                    style={{ background: '#eef1f8', border: '1px solid #d5ddee', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#34508a', fontWeight: 'bold' }}
                  >
                    ✏️ Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteDipendente(dipendente.id)}
                    style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #eef1f7', paddingTop: '12px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '13px', color: '#5f6f8c', fontWeight: '600' }}>
                  📜 Attestati ({(dipendente.attestati || []).length})
                </h5>
                {!readOnly && (
                  <button
                    onClick={() => handleAddAttestato(dipendente)}
                    style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}
                  >
                    + Aggiungi
                  </button>
                )}
              </div>

              {(!dipendente.attestati || dipendente.attestati.length === 0) ? (
                <p style={{ fontSize: '12px', color: '#9aa7bf', fontStyle: 'italic', margin: 0 }}>Nessun attestato registrato</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dipendente.attestati.map((attestato) => {
                    const oggi = new Date();
                    const scadenza = attestato.dataScadenza ? new Date(attestato.dataScadenza) : null;
                    const isScaduto = scadenza && scadenza < oggi;
                    const isUrgente = scadenza && !isScaduto && Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24)) <= 30;

                    return (
                      <div
                        key={attestato.id}
                        style={{
                          background: isScaduto ? '#fef2f2' : isUrgente ? '#fffbeb' : '#f6f8fc',
                          padding: '10px', borderRadius: '6px',
                          border: `1px solid ${isScaduto ? '#fecaca' : isUrgente ? '#fde68a' : '#dfe5ef'}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a2540', marginBottom: '3px' }}>{attestato.nome}</div>
                          {attestato.dataScadenza && (
                            <div style={{ fontSize: '11px', color: isScaduto ? '#dc2626' : isUrgente ? '#d97706' : '#5f6f8c' }}>
                              Scadenza: {formatData(attestato.dataScadenza)}
                              {isScaduto && ' ⚠️ SCADUTO'}
                              {isUrgente && !isScaduto && ' ⏰ In scadenza'}
                            </div>
                          )}
                          {attestato.numeroAttestato && <div style={{ fontSize: '11px', color: '#9aa7bf' }}>N° {attestato.numeroAttestato}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {attestato.pdfUrl && (
                            <a href={attestato.pdfUrl} target="_blank" rel="noopener noreferrer"
                              style={{ background: '#eef1f8', border: '1px solid #d5ddee', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: '#34508a', textDecoration: 'none', fontWeight: 'bold' }}>
                              📄 PDF
                            </a>
                          )}
                          {!readOnly && (
                            <>
                              <button
                                onClick={() => handleEditAttestato(dipendente, attestato)}
                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteAttestato(dipendente, attestato.id)}
                                style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {mostraModaleDipendente && (
        <ModaleDipendente
          dipendente={dipendenteInModifica}
          onClose={() => { setMostraModaleDipendente(false); setDipendenteInModifica(null); }}
          onSave={handleSaveDipendente}
        />
      )}

      {mostraModaleAttestato && (
        <ModaleAttestato
          onClose={() => { setMostraModaleAttestato(false); setDipendentePerAttestato(null); setAttestatoInModifica(null); }}
          onSave={handleSaveAttestato}
          attestato={attestatoInModifica}
        />
      )}

      {anteprima && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '30px', width: '90%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 6px' }}>Anteprima importazione</h2>
            <p style={{ margin: '0 0 16px', color: '#5f6f8c', fontSize: '14px' }}>
              {anteprima.length} dipendenti trovati. Verifica i dati prima di confermare.
            </p>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #dfe5ef', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f6f8fc', position: 'sticky', top: 0 }}>
                    {['Nome', 'Cognome', 'Mansione', 'Telefono', 'Email', 'Note'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#45536f', fontWeight: 600, borderBottom: '2px solid #dfe5ef' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anteprima.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eef1f7', background: (!d.nome && !d.cognome) ? '#fef2f2' : 'white' }}>
                      <td style={{ padding: '8px 12px' }}>{d.nome || <span style={{ color: '#dc2626' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px' }}>{d.cognome || <span style={{ color: '#dc2626' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{d.mansione}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{d.telefono}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{d.email}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{d.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setAnteprima(null)}
                style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                Annulla
              </button>
              <button
                onClick={confermaImport}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: '#4a68a0', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                Importa {anteprima.length} dipendenti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabDipendenti;
