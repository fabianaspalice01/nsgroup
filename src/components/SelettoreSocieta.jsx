import PropTypes from 'prop-types';
import { SOCIETA } from '../utils/societa';

// Scelta della società del gruppo con i loghi in piccolo
export default function SelettoreSocieta({ value, onChange, label = 'Società *', nota }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>{label}</label>
      <div role="radiogroup" aria-label="Società" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SOCIETA.map((s) => {
          const attiva = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={attiva}
              title={s.nome}
              onClick={() => onChange(s.id)}
              style={{
                flex: '1 1 120px', padding: 6, background: '#fff', cursor: 'pointer', borderRadius: 8,
                border: attiva ? '2px solid #2c3e66' : '1px solid #dfe5ef',
                boxShadow: attiva ? '0 0 0 3px rgba(44,62,102,0.15)' : 'none',
                opacity: value && !attiva ? 0.5 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <img src={s.logo} alt="" style={{ display: 'block', height: 30, maxWidth: '100%', objectFit: 'contain' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: attiva ? '#2c3e66' : '#5f6f8c' }}>{s.nome}</span>
            </button>
          );
        })}
      </div>
      {nota && <div style={{ fontSize: 11, color: '#5f6f8c', marginTop: 4 }}>{nota}</div>}
    </div>
  );
}

SelettoreSocieta.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  nota: PropTypes.string,
};
