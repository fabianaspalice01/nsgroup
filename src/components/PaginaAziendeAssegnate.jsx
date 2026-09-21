import { useState } from 'react';
import SchedaAzienda from './SchedaAzienda';

const STATI_AZIENDA = [
  { value: 'da_fare', label: 'Da fare', color: '#45536f', bg: '#eef1f7', border: '#c9d1e0', icon: '⬜' },
  { value: 'in_corso', label: 'In corso', color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: '🟡' },
  { value: 'completato', label: 'Completato', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
];

function normalizzaStato(stato) {
  if (stato === 'completato') return 'completato';
  if (stato === 'in_corso' || stato === 'in_lavorazione') return 'in_corso';
  return 'da_fare';
}

function CardAzienda({ az, onOpen, onCambiaStato }) {
  const statoAttuale = normalizzaStato(az.stato);
  const scadenzeProssime = [
    ...(az.controlli || []).filter(c => !c.completato && c.scadenza),
    ...(az.documenti || []).filter(d => d.dataScadenza),
    ...(az.dipendenti || []).flatMap(d => (d.attestati || []).filter(a => a.dataScadenza)),
  ].length;

  return (
    <div
      onClick={() => onOpen(az)}
      style={{
        background: 'white', border: '1px solid #dfe5ef', borderRadius: 14,
        padding: '16px 18px', cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(44,62,102,0.12)'; e.currentTarget.style.borderColor = '#93a7cc'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#dfe5ef'; }}
    >
      {/* Nome + settore */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2540', marginBottom: 2 }}>{az.nome}</div>
          {az.settore && (
            <span style={{ fontSize: 11, background: '#eef1f8', color: '#1f2e4d', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{az.settore}</span>
          )}
        </div>
        {scadenzeProssime > 0 && (
          <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            ⚠️ {scadenzeProssime}
          </span>
        )}
      </div>

      {/* Indirizzo / comune */}
      {(az.comune || az.indirizzo) && (
        <div style={{ fontSize: 12, color: '#5f6f8c', marginBottom: 8 }}>
          📍 {[az.indirizzo, az.comune, az.provincia ? `(${az.provincia})` : ''].filter(Boolean).join(', ')}
        </div>
      )}

      {/* Contatti */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {az.telefono && <span style={{ fontSize: 12, color: '#45536f' }}>📞 {az.telefono}</span>}
        {az.email && <span style={{ fontSize: 12, color: '#45536f' }}>✉️ {az.email}</span>}
      </div>

      {/* Contatori */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #eef1f7', paddingTop: 10, marginBottom: 10 }}>
        {(az.dipendenti?.length > 0) && (
          <span style={{ fontSize: 11, color: '#2c3e66', background: '#eef1f8', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
            👥 {az.dipendenti.length} dipendenti
          </span>
        )}
        {(az.controlli?.filter(c => !c.completato).length > 0) && (
          <span style={{ fontSize: 11, color: '#d97706', background: '#fef3c7', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
            🔒 {az.controlli.filter(c => !c.completato).length} controlli
          </span>
        )}
        {(az.documenti?.length > 0) && (
          <span style={{ fontSize: 11, color: '#45536f', background: '#f6f8fc', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
            📄 {az.documenti.length} doc
          </span>
        )}
      </div>

      {/* Stato lavorazione */}
      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        {STATI_AZIENDA.map(s => {
          const attivo = statoAttuale === s.value;
          return (
            <button
              key={s.value}
              onClick={() => onCambiaStato?.(az.id, s.value)}
              style={{
                flex: 1,
                padding: '5px 0',
                fontSize: 10,
                fontWeight: 700,
                border: `1px solid ${attivo ? s.color : '#dfe5ef'}`,
                borderRadius: 6,
                cursor: 'pointer',
                background: attivo ? s.bg : 'white',
                color: attivo ? s.color : '#9aa7bf',
                transition: 'all 0.15s',
              }}
            >
              {s.icon} {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaginaAziendeAssegnate({ aziende, userData, preventivi = [], tipiControllo = [], onUpdateAzienda, onAddControllo, onCambiaStato, isMobile }) {
  const [aziendaSelezionata, setAziendaSelezionata] = useState(null);
  const [ricerca, setRicerca] = useState('');
  const [colAttiva, setColAttiva] = useState('da_fare');
  const [completatiAperti, setCompletatiAperti] = useState(false);

  const isAdmin = userData?.ruolo === 'admin' || userData?.ruolo === 'operatore';

  const aziendeAssegnate = aziende.filter(a => a.assegnatoA === userData?.id);

  const aziendeFiltrate = aziendeAssegnate.filter(a =>
    !ricerca || a.nome?.toLowerCase().includes(ricerca.toLowerCase()) || a.comune?.toLowerCase().includes(ricerca.toLowerCase())
  );

  const perColonna = (stato) => aziendeFiltrate.filter(a => normalizzaStato(a.stato) === stato);

  if (aziendaSelezionata) {
    return (
      <SchedaAzienda
        azienda={aziendaSelezionata}
        onBack={() => setAziendaSelezionata(null)}
        onAddControllo={isAdmin ? onAddControllo : () => {}}
        onUpdateAzienda={isAdmin ? onUpdateAzienda : () => {}}
        tipiControllo={tipiControllo}
        readOnly={!isAdmin}
        preventivi={preventivi.filter(p => p.aziendaId === aziendaSelezionata.id)}
        aziende={aziende}
        userData={userData}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#1a2540' }}>🏢 Le mie aziende</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5f6f8c' }}>
          {aziendeAssegnate.length} aziend{aziendeAssegnate.length === 1 ? 'a assegnata' : 'e assegnate'}
        </p>
      </div>

      {/* Cerca */}
      {aziendeAssegnate.length > 3 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#9aa7bf' }}>🔍</span>
          <input
            type="text"
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            placeholder="Cerca azienda..."
            style={{ flex: 1, maxWidth: isMobile ? '100%' : 280, padding: '8px 12px', borderRadius: 8, border: '1px solid #dfe5ef', fontSize: 13, outline: 'none' }}
          />
          {ricerca && (
            <button onClick={() => setRicerca('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9aa7bf', fontSize: 14 }}>✕</button>
          )}
        </div>
      )}

      {/* Stato vuoto */}
      {aziendeAssegnate.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 16, border: '1px dashed #dfe5ef' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2540', marginBottom: 6 }}>Nessuna azienda assegnata</div>
          <div style={{ fontSize: 13, color: '#9aa7bf' }}>Contatta l'amministratore per ottenere l'accesso alle aziende</div>
        </div>
      )}

      {/* Nessun risultato di ricerca */}
      {aziendeAssegnate.length > 0 && aziendeFiltrate.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#9aa7bf', fontSize: 14 }}>
          Nessuna azienda trovata per "{ricerca}"
        </div>
      )}

      {/* Board */}
      {aziendeFiltrate.length > 0 && (
        isMobile ? (
          <div>
            {/* Selettore colonna */}
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #dfe5ef', marginBottom: 16 }}>
              {STATI_AZIENDA.map((s, i) => {
                const count = perColonna(s.value).length;
                const active = colAttiva === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => { setColAttiva(s.value); if (s.value === 'completato') setCompletatiAperti(true); }}
                    style={{
                      flex: 1, padding: '11px 4px', border: 'none',
                      borderRight: i < 2 ? '1px solid #dfe5ef' : 'none',
                      cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: active ? s.bg : 'white',
                      color: active ? s.color : '#9aa7bf',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span>{s.label}</span>
                    <span style={{
                      background: active ? s.color : '#dfe5ef',
                      color: active ? 'white' : '#9aa7bf',
                      borderRadius: 8, padding: '0 6px', fontSize: 10, fontWeight: 800,
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Cards della colonna attiva */}
            {colAttiva === 'completato' && !completatiAperti ? (
              <div
                onClick={() => setCompletatiAperti(true)}
                style={{ textAlign: 'center', padding: '22px 0', color: '#059669', fontSize: 13, fontWeight: 600, background: '#f0fdf4', borderRadius: 10, border: '1px dashed #bbf7d0', cursor: 'pointer' }}
              >
                ✅ {perColonna('completato').length} completate — clicca per espandere
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {perColonna(colAttiva).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: '#c9d1e0', fontSize: 13, background: '#f6f8fc', borderRadius: 10, border: '1px dashed #dfe5ef' }}>Nessuna azienda</div>
                ) : perColonna(colAttiva).map(az => (
                  <CardAzienda key={az.id} az={az} onOpen={setAziendaSelezionata} onCambiaStato={onCambiaStato} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {STATI_AZIENDA.map(stato => {
              const col = perColonna(stato.value);
              const isCompletato = stato.value === 'completato';
              return (
                <div key={stato.value}>
                  <div
                    onClick={isCompletato ? () => setCompletatiAperti(v => !v) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                      background: stato.bg, border: `1px solid ${stato.border}`,
                      borderRadius: completatiAperti || !isCompletato ? '10px 10px 0 0' : 10,
                      cursor: isCompletato ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{stato.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: stato.color }}>{stato.label}</span>
                    <span style={{ marginLeft: 'auto', background: stato.color, color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{col.length}</span>
                    {isCompletato && (
                      <span style={{ fontSize: 12, color: stato.color, marginLeft: 4 }}>{completatiAperti ? '▲' : '▼'}</span>
                    )}
                  </div>
                  {(!isCompletato || completatiAperti) && (
                    <div style={{
                      background: '#f6f8fc', border: `1px solid ${stato.border}`, borderTop: 'none',
                      borderRadius: '0 0 10px 10px', padding: 10,
                      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120,
                    }}>
                      {col.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#c9d1e0', fontSize: 13 }}>Nessuna azienda</div>
                      ) : col.map(az => (
                        <CardAzienda key={az.id} az={az} onOpen={setAziendaSelezionata} onCambiaStato={onCambiaStato} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default PaginaAziendeAssegnate;
