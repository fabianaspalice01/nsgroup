import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import DropZone from './DropZone';

function ModalePagamento({ onClose, onSave, pagamento }) {
  const [form, setForm] = useState(pagamento || {
    data: new Date().toISOString().split('T')[0],
    importo: '',
    metodoPagamento: 'Bonifico',
    numeroFattura: '',
    descrizione: '',
    note: ''
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const metodiPagamento = [
    'Bonifico',
    'Contanti',
    'Assegno'
  ];

  const handleChange = (campo, valore) => {
    setForm({ ...form, [campo]: valore });
  };

  const pickFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Solo file PDF sono accettati!'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Il file è troppo grande! Massimo 10MB'); return; }
    setFile(f);
  };
  const handleFileChange = (e) => pickFile(e.target.files[0]);

  const handleSave = async () => {
    if (!form.data || !form.importo) {
      toast.error('Data e importo sono obbligatori!');
      return;
    }

    if (parseFloat(form.importo) <= 0) {
      toast.error("L'importo deve essere maggiore di zero!");
      return;
    }
    
    setUploading(true);
    try {
      await onSave(form, file);
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast.error('Errore nel salvataggio del pagamento');
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
          {pagamento ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Data Pagamento *
          </label>
          <input 
            type="date"
            value={form.data}
            onChange={(e) => handleChange('data', e.target.value)}
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
            Importo (€) *
          </label>
          <input 
            type="number"
            step="0.01"
            min="0"
            value={form.importo}
            onChange={(e) => handleChange('importo', e.target.value)}
            placeholder="es. 1500.00"
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
            Metodo di Pagamento
          </label>
          <select
            value={form.metodoPagamento}
            onChange={(e) => handleChange('metodoPagamento', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'white'
            }}
          >
            {metodiPagamento.map(metodo => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Numero Fattura / Ricevuta
          </label>
          <input 
            type="text"
            value={form.numeroFattura}
            onChange={(e) => handleChange('numeroFattura', e.target.value)}
            placeholder="es. FT-2024-001"
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
            Descrizione
          </label>
          <input 
            type="text"
            value={form.descrizione}
            onChange={(e) => handleChange('descrizione', e.target.value)}
            placeholder="es. Servizi consulenza gennaio 2024"
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
            Carica Contabile PDF {!pagamento && '(opzionale)'}
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

export default ModalePagamento;