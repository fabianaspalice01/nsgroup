import { useState, useRef } from 'react';
import toast from "react-hot-toast";
import DropZone from './DropZone';

function ModaleAttestato({ onClose, onSave, attestato }) {
  const [form, setForm] = useState(attestato || {
    nome: '',
    dataRilascio: '',
    dataScadenza: '',
    enteRilascio: '',
    numeroAttestato: '',
    note: ''
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (campo, valore) => {
    setForm({ ...form, [campo]: valore });
  };

  const pickFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Solo file PDF sono accettati!'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Il file è troppo grande! Massimo 10MB'); return; }
    setFile(f);
  };
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      pickFile(selectedFile);
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Il nome dell'attestato è obbligatorio!");
      return;
    }
    if (!form.dataScadenza) {
      toast.error("La data di scadenza è obbligatoria!");
      return;
    }

    setUploading(true);
    try {
      await onSave(form, file);
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast.error("Errore nel salvataggio dell'attestato");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ marginBottom: '20px' }}>
          {attestato ? 'Modifica Attestato' : 'Nuovo Attestato'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Nome Attestato *
          </label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="es. Antincendio, Primo Soccorso, Carrellista..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              Data Rilascio
            </label>
            <input
              type="date"
              value={form.dataRilascio}
              onChange={(e) => handleChange('dataRilascio', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #dfe5ef',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              Data Scadenza *
            </label>
            <input
              type="date"
              value={form.dataScadenza}
              onChange={(e) => handleChange('dataScadenza', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #dfe5ef',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Ente Rilascio
          </label>
          <input
            type="text"
            value={form.enteRilascio}
            onChange={(e) => handleChange('enteRilascio', e.target.value)}
            placeholder="es. VVF, ASL, Ente Certificatore..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Numero Attestato
          </label>
          <input
            type="text"
            value={form.numeroAttestato}
            onChange={(e) => handleChange('numeroAttestato', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Carica PDF {!attestato && '(opzionale)'}
          </label>
          <DropZone accept=".pdf" file={file} onFile={pickFile} onRemove={() => setFile(null)} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Note
          </label>
          <textarea
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            rows="2"
            placeholder="Note aggiuntive..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '10px 20px',
              border: '1px solid #dfe5ef',
              borderRadius: '8px',
              background: 'white',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: uploading ? 0.5 : 1
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: uploading ? '#9aa7bf' : '#2c3e66',
              color: 'white',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {uploading ? 'Caricamento...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModaleAttestato;