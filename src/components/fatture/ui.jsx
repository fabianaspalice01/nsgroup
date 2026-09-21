import { useEffect } from 'react';
import { S, anniDisponibili } from './util';

export function Campo({ label, children, obbligatorio }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}{obbligatorio ? ' *' : ''}</label>
      {children}
    </div>
  );
}

export function Modale({ titolo, onClose, children, footer, larghezza = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 12,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: larghezza,
        maxHeight: '92vh', overflowY: 'auto', padding: 24,
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#1a2540' }}>{titolo}</h2>
        {children}
        {footer && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function SelectAnno({ anno, onChange, anniDati }) {
  return (
    <select value={anno} onChange={(e) => onChange(Number(e.target.value))} style={{ ...S.input, width: 'auto' }}>
      {anniDisponibili(anniDati).map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  );
}

export function Vuoto({ children }) {
  return <div style={{ padding: 30, textAlign: 'center', color: '#5f6f8c', fontSize: 14 }}>{children}</div>;
}
