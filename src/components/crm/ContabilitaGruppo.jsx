import { useState } from 'react';
import PropTypes from 'prop-types';
import CrmContabilita from './CrmContabilita';

// Aziende del gruppo: ognuna ha la sua contabilità (collezioni crm_<id>_*); senza «pronta» è in preparazione
const AZIENDE = [
  { id: 'consulting', nome: 'NS Consulting', logo: '/logo-nsconsulting.jpeg', pronta: true },
  { id: 'safety', nome: 'NS Safety', logo: '/logo-nssafety.jpeg', pronta: true },
  { id: 'academy', nome: 'NS Academy', logo: '/logo-nsacademy.jpeg', pronta: true },
];

const ALTEZZA = 'calc(100vh - 200px)';

export default function ContabilitaGruppo({ utente }) {
  const [scelta, setScelta] = useState(AZIENDE[0]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--ink)' }}>Contabilità {scelta.nome}</h2>
        <div role="tablist" aria-label="Azienda" style={{ display: 'flex', gap: 8 }}>
          {AZIENDE.map((az) => {
            const attiva = az.id === scelta.id;
            return (
              <button
                key={az.id}
                type="button"
                role="tab"
                aria-selected={attiva}
                title={az.pronta ? az.nome : `${az.nome} — in preparazione`}
                onClick={() => setScelta(az)}
                style={{
                  padding: 4, background: '#fff', cursor: 'pointer', borderRadius: 8, lineHeight: 0,
                  border: attiva ? '2px solid var(--primary)' : '1px solid var(--line)',
                  boxShadow: attiva ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                  opacity: attiva ? 1 : 0.55,
                }}
              >
                <img src={az.logo} alt={az.nome} style={{ display: 'block', height: 34, width: 'auto' }} />
              </button>
            );
          })}
        </div>
      </div>

      {scelta.pronta ? (
        <CrmContabilita
          key={scelta.id}
          azienda={scelta.id}
          nomeAzienda={scelta.nome}
          utente={utente}
          style={{ display: 'block', width: '100%', height: ALTEZZA, minHeight: 560, border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}
        />
      ) : (
        <div style={{ height: ALTEZZA, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', borderRadius: 12, background: '#fff', color: 'var(--ink-muted)', fontSize: 15 }}>
          Contabilità {scelta.nome} in preparazione
        </div>
      )}
    </div>
  );
}

ContabilitaGruppo.propTypes = {
  utente: PropTypes.string,
};
