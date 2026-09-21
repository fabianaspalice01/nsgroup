import { useState } from 'react';
import toast from 'react-hot-toast';
import DropZone from './DropZone';

function ModaleControllo({ onClose, onSave, controllo, tipiControllo = [] }) {
  const dataOggi = new Date().toISOString().split('T')[0];

  const [tipiLocali, setTipiLocali] = useState(tipiControllo);
  const [nuovoTipoControllo, setNuovoTipoControllo] = useState('');
  const [file, setFile] = useState(null);
  const [rimuoviDoc, setRimuoviDoc] = useState(false);

  const [form, setForm] = useState(
    controllo || {
      tipo: tipiControllo[0] || '',
      scadenza: dataOggi,
      completato: false,
      note: ''
    }
  );

  const handleChange = (campo, valore) => {
    setForm(prev => ({ ...prev, [campo]: valore }));
  };

  const aggiungiTipoControllo = () => {
    const valore = nuovoTipoControllo.trim();

    if (!valore) return;

    const esiste = tipiLocali.some(
      tipo => tipo.toLowerCase() === valore.toLowerCase()
    );

    if (esiste) {
      toast.error('Questo tipo di controllo esiste già');
      return;
    }

    setTipiLocali(prev => [...prev, valore]);
    setNuovoTipoControllo('');
    setForm(prev => ({ ...prev, tipo: valore }));
  };

  const handleSave = () => {
    if (!form.tipo || !form.scadenza) {
      toast.error('Tipo e scadenza sono obbligatori!');
      return;
    }
    onSave(form, file, rimuoviDoc);
  };

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '30px',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '500px'
        }}
      >
        <h2 style={{ marginBottom: '20px' }}>
          {controllo ? 'Modifica Controllo' : 'Nuovo Controllo'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Tipo di Controllo *
          </label>

          <select
            value={form.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            {tipiLocali.map(tipo => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Aggiungi tipo controllo
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
              <input
                type="text"
                value={nuovoTipoControllo}
                onChange={(e) => setNuovoTipoControllo(e.target.value)}
                placeholder="Es. Verifica impianto elettrico"
                style={{
                  flex: 1,
                  padding: 8,
                  border: '1px solid #dfe5ef',
                  borderRadius: 6,
                  fontSize: 13
                }}
              />

              <button
                type="button"
                onClick={aggiungiTipoControllo}
                style={{
                  padding: '8px 12px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                + Aggiungi
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Data Scadenza *
          </label>
          <input
            type="date"
            value={form.scadenza}
            onChange={(e) => handleChange('scadenza', e.target.value)}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.completato}
              onChange={(e) => handleChange('completato', e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '14px' }}>Controllo completato</span>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Documento PDF (opzionale)
          </label>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#15803d', fontWeight: 600 }}>✓ {file.name}</span>
              <button type="button" onClick={() => setFile(null)}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ✕ Rimuovi
              </button>
            </div>
          ) : controllo?.pdfUrl && !rimuoviDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#eef1f8', border: '1px solid #c3cde3', borderRadius: 8 }}>
              <a href={controllo.pdfUrl} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, fontSize: 13, color: '#2c3e66', fontWeight: 600 }}>
                📄 Documento attuale
              </a>
              <button type="button" onClick={() => setRimuoviDoc(true)}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ✕ Rimuovi
              </button>
            </div>
          ) : (
            <DropZone
              accept=".pdf"
              file={null}
              onFile={f => {
                if (f.type !== 'application/pdf') { toast.error('Solo file PDF sono accettati!'); return; }
                if (f.size > 10 * 1024 * 1024) { toast.error('Il file è troppo grande! Massimo 10MB'); return; }
                setFile(f);
                setRimuoviDoc(false);
              }}
            />
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Note
          </label>
          <textarea
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            rows="3"
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
            style={{
              padding: '10px 20px',
              border: '1px solid #dfe5ef',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: '#2c3e66',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModaleControllo;