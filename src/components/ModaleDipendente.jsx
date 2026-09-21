import { useState } from 'react';
import toast from 'react-hot-toast';

function ModaleDipendente({ onClose, onSave, dipendente }) {
  const [form, setForm] = useState(dipendente || {
    nome: '',
    cognome: '',
    mansione: '',
    telefono: '',
    email: '',
    note: ''
  });

  const handleChange = (campo, valore) => {
    setForm({ ...form, [campo]: valore });
  };

  const handleSave = () => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      toast.error('Nome e cognome sono obbligatori!');
      return;
    }
    onSave(form);
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
          {dipendente ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Nome *
          </label>
          <input 
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
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
            Cognome *
          </label>
          <input 
            type="text"
            value={form.cognome}
            onChange={(e) => handleChange('cognome', e.target.value)}
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
            Mansione
          </label>
          <input 
            type="text"
            value={form.mansione}
            onChange={(e) => handleChange('mansione', e.target.value)}
            placeholder="es. Responsabile sicurezza, Operaio, Tecnico..."
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
            Telefono
          </label>
          <input 
            type="tel"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
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
            Email
          </label>
          <input 
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Note
          </label>
          <textarea 
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            rows="2"
            placeholder="Qualifiche, certificazioni, informazioni aggiuntive..."
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

export default ModaleDipendente;