import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export default function Impostazioni({ giorniPreavviso, onUpdate }) {
  const [giorni, setGiorni] = useState(giorniPreavviso);
  const [saving, setSaving] = useState(false);

  const salva = async () => {
    const val = parseInt(giorni);
    if (!val || val < 1 || val > 365) {
      toast.error('Inserisci un valore tra 1 e 365 giorni');
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'impostazioni'), { giorniPreavviso: val }, { merge: true });
      onUpdate(val);
      toast.success('Impostazioni salvate');
    } catch (err) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h2 style={{ marginBottom: 24 }}>⚙️ Impostazioni</h2>

      <div style={{ background: '#fff', border: '1px solid #dfe5ef', borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a2540' }}>Notifiche scadenze</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#5f6f8c' }}>
          Quanti giorni prima di una scadenza inviare l'email e la notifica push all'amministratore.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#45536f', whiteSpace: 'nowrap' }}>
            Preavviso giorni:
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={giorni}
            onChange={e => setGiorni(e.target.value)}
            style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, textAlign: 'center' }}
          />
          <button
            onClick={salva}
            disabled={saving}
            style={{ padding: '8px 20px', background: saving ? '#9aa7bf' : '#2c3e66', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
