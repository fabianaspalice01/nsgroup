import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import DropZone from './DropZone';

function ModaleDocumento({ onClose, onSave, documento }) {
  const [form, setForm] = useState(documento || {
    nome: '',
    tipo: 'Visura Camerale',
    dataEmissione: '',
    dataScadenza: '',
    numeroDocumento: '',
    note: ''
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const tipiDocumento = [
    'Visura Camerale',
    'Certificato CCIAA',
    'DURC',
    'Polizza Assicurativa',
    'Certificazione ISO',
    'Attestazione SOA',
    'Contratto',
    'Licenze',
    'Autorizzazioni',
    'Altro'
  ];

  const handleChange = (campo, valore) => {
    setForm({ ...form, [campo]: valore });
  };

  const TIPI_ACCETTATI = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  const pickFile = (f) => {
    if (!f) return;
    const estensioneImmagine = /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || '');
    if (!TIPI_ACCETTATI.includes(f.type) && !estensioneImmagine && f.type !== 'application/pdf') {
      toast.error('Sono accettati solo file PDF o foto (JPG, PNG)!');
      return;
    }
    if (f.size > 10 * 1024 * 1024) { toast.error('Il file è troppo grande! Massimo 10MB'); return; }
    setFile(f);
  };
  const handleFileChange = (e) => pickFile(e.target.files[0]);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Il nome del documento è obbligatorio!');
      return;
    }

    setUploading(true);
    try {
      await onSave(form, file);
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast.error('Errore nel salvataggio del documento');
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
          {documento ? 'Modifica Documento' : 'Nuovo Documento'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Nome Documento *
          </label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="es. Visura Camerale 2024, DURC Dicembre..."
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
            Tipo Documento
          </label>
          <select
            value={form.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'white'
            }}
          >
            {tipiDocumento.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              Data Emissione
            </label>
            <input
              type="date"
              value={form.dataEmissione}
              onChange={(e) => handleChange('dataEmissione', e.target.value)}
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
              Data Scadenza
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
            Numero Documento / Protocollo
          </label>
          <input
            type="text"
            value={form.numeroDocumento}
            onChange={(e) => handleChange('numeroDocumento', e.target.value)}
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
            Carica PDF o foto {!documento && '(opzionale)'}
          </label>
          <DropZone accept=".pdf,.jpg,.jpeg,.png" file={file} onFile={pickFile} onRemove={() => setFile(null)} />
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

export default ModaleDocumento;