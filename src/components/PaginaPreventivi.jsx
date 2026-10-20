import { useState } from 'react';

const STATI_PREVENTIVO = [
  { value: 'da_fare', label: 'Da fare', color: 'var(--ink-muted)', bg: 'var(--surface-2)', border: '#c9d1e0', icon: '⬜' },
  { value: 'in_corso', label: 'In corso', color: 'var(--warning)', bg: 'var(--warning-soft)', border: '#fde68a', icon: '🟡' },
  { value: 'completato', label: 'Completato', color: 'var(--success)', bg: 'var(--success-soft)', border: '#bbf7d0', icon: '✅' },
];

function normalizzaStato(stato) {
  if (stato === 'completato') return 'completato';
  if (stato === 'in_corso') return 'in_corso';
  return 'da_fare';
}

const eur = (v) => (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdata = (iso) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '—');
const stileBtn = (bg, fg, bd) => ({ padding: '6px 10px', background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' });

function ElencoContratti({ contratti, onContratto, isMobile }) {
  if (!contratti.length) return null;
  const ordinati = [...contratti].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ margin: '0 0 12px' }}>📝 Contratti ({contratti.length})</h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {ordinati.map((c) => (
          <div key={c.id} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.cliente?.ragioneSociale || 'Cliente'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>📅 {fdata(c.data)} · scade il {fdata(c.scadenza)}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>💰 <strong>€ {eur(c.importoTotale)}</strong> + IVA {c.periodicita === 'annuale' ? 'annuale' : 'mensile'}</div>
            {c.consulente && <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>👤 {c.consulente}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {c.pdfUrl && <a href={c.pdfUrl} target="_blank" rel="noreferrer" style={stileBtn('var(--primary)', 'white', 'var(--primary)')}>📄 PDF</a>}
              <button onClick={() => onContratto(null, c)} style={stileBtn('var(--warning-soft)', 'var(--warning)', '#fde68a')}>✏️ Modifica</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardPreventivo({ prev, contratto, onContratto, onDettaglio, onPagamento, onModifica, onElimina, canCambiaStato, onCambiaStato }) {
  const statoAttuale = normalizzaStato(prev.stato);
  const pagato = (prev.pagamenti || []).reduce((s, p) => s + (parseFloat(p.importo) || 0), 0);
  const residuo = Math.max(0, (prev.totale || 0) - pagato);

  return (
    <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{prev.nomeCliente || 'Cliente sconosciuto'}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>📅 {new Date(prev.dataCreazione).toLocaleDateString()}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>💰 Totale: <strong>€ {(prev.totale || 0).toFixed(2)}</strong></div>
      {pagato > 0 && <div style={{ fontSize: 12, color: 'var(--success)' }}>✅ Pagato: € {pagato.toFixed(2)}</div>}
      {residuo > 0
        ? <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700 }}>⏳ Residuo: € {residuo.toFixed(2)}</div>
        : pagato > 0 && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>✔ Saldato</div>
      }
      {prev.motivazioneModifica && (
        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontStyle: 'italic' }}>📝 {prev.motivazioneModifica}</div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <button onClick={() => onDettaglio(prev)}
          style={{ padding: '6px 10px', background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid #c3cde3', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ℹ️ Dettagli
        </button>
        <button onClick={() => onPagamento(prev)}
          style={{ padding: '6px 10px', background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid #86efac', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          💳 Pagamento
        </button>
        <button onClick={() => onModifica(prev)}
          style={{ padding: '6px 10px', background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ✏️ Modifica
        </button>
        {onContratto && (contratto
          ? <button onClick={() => (contratto.pdfUrl ? window.open(contratto.pdfUrl, '_blank') : onContratto(prev, contratto))}
              title="Contratto già firmato per questo preventivo" style={stileBtn('var(--success-soft)', 'var(--success)', '#6ee7b7')}>📝 Contratto ✓</button>
          : <button onClick={() => onContratto(prev, null)} style={stileBtn('var(--primary-soft)', 'var(--primary)', 'var(--primary)')}>📝 Crea contratto</button>)}
        {prev.pdfUrl && (
          <a href={prev.pdfUrl} target="_blank" rel="noreferrer"
            style={{ padding: '6px 10px', background: 'var(--primary)', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
            📄 PDF
          </a>
        )}
        {onElimina && (
          <button onClick={() => onElimina(prev.id)}
            style={{ padding: '6px 10px', background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🗑️ Elimina
          </button>
        )}
      </div>

      {canCambiaStato && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {STATI_PREVENTIVO.map(s => {
            const attivo = statoAttuale === s.value;
            return (
              <button
                key={s.value}
                onClick={() => onCambiaStato(prev.id, s.value)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: 10,
                  fontWeight: 700,
                  border: `1px solid ${attivo ? s.color : 'var(--line)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: attivo ? s.bg : 'white',
                  color: attivo ? s.color : 'var(--ink-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {s.icon} {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaginaPreventivi({
  preventivi,
  titolo = '📄 Preventivi',
  showNuovo = false,
  onNuovo,
  onDettaglio,
  onPagamento,
  onModifica,
  onElimina,
  canCambiaStato = false,
  onCambiaStato,
  isMobile,
  contratti = [],
  onContratto,
  onNuovoContratto,
}) {
  const contrattoDi = (prev) => contratti.find((c) => c.preventivoId === prev.id);
  const [ricerca, setRicerca] = useState('');
  const [colAttiva, setColAttiva] = useState('da_fare');
  const [completatiAperti, setCompletatiAperti] = useState(false);

  const preventiviFiltrati = preventivi
    .filter(p => (p.nomeCliente || '').toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => new Date(b.dataCreazione) - new Date(a.dataCreazione));

  const perColonna = (stato) => preventiviFiltrati.filter(p => normalizzaStato(p.stato) === stato);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{titolo}</h2>
        {onNuovoContratto && (
          <button onClick={onNuovoContratto}
            style={{ background: 'white', color: 'var(--primary)', border: '2px solid var(--primary)', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14, marginLeft: 'auto' }}>
            + Nuovo Contratto
          </button>
        )}
        {showNuovo && (
          <button
            onClick={onNuovo}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
          >
            + Nuovo Preventivo
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="🔍 Cerca per cliente..."
        value={ricerca}
        onChange={e => setRicerca(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
      />

      {preventivi.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)' }}>Nessun preventivo trovato</p>
      ) : preventiviFiltrati.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-muted)', fontSize: 14 }}>
          Nessun preventivo trovato per "{ricerca}"
        </div>
      ) : isMobile ? (
        <div>
          {/* Selettore colonna */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 16 }}>
            {STATI_PREVENTIVO.map((s, i) => {
              const count = perColonna(s.value).length;
              const active = colAttiva === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => { setColAttiva(s.value); if (s.value === 'completato') setCompletatiAperti(true); }}
                  style={{
                    flex: 1, padding: '11px 4px', border: 'none',
                    borderRight: i < 2 ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: active ? s.bg : 'white',
                    color: active ? s.color : 'var(--ink-muted)',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span>{s.label}</span>
                  <span style={{
                    background: active ? s.color : 'var(--line)',
                    color: active ? 'white' : 'var(--ink-muted)',
                    borderRadius: 8, padding: '0 6px', fontSize: 10, fontWeight: 800,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {colAttiva === 'completato' && !completatiAperti ? (
            <div
              onClick={() => setCompletatiAperti(true)}
              style={{ textAlign: 'center', padding: '22px 0', color: 'var(--success)', fontSize: 13, fontWeight: 600, background: 'var(--success-soft)', borderRadius: 10, border: '1px dashed #bbf7d0', cursor: 'pointer' }}
            >
              ✅ {perColonna('completato').length} completati — clicca per espandere
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perColonna(colAttiva).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#c9d1e0', fontSize: 13, background: 'var(--surface-2)', borderRadius: 10, border: '1px dashed var(--line)' }}>Nessun preventivo</div>
              ) : perColonna(colAttiva).map(prev => (
                <CardPreventivo key={prev.id} prev={prev} contratto={contrattoDi(prev)} onContratto={onContratto} onDettaglio={onDettaglio} onPagamento={onPagamento} onModifica={onModifica} onElimina={onElimina} canCambiaStato={canCambiaStato} onCambiaStato={onCambiaStato} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {STATI_PREVENTIVO.map(stato => {
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
                    background: 'var(--surface-2)', border: `1px solid ${stato.border}`, borderTop: 'none',
                    borderRadius: '0 0 10px 10px', padding: 10,
                    display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120,
                  }}>
                    {col.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#c9d1e0', fontSize: 13 }}>Nessun preventivo</div>
                    ) : col.map(prev => (
                      <CardPreventivo key={prev.id} prev={prev} contratto={contrattoDi(prev)} onContratto={onContratto} onDettaglio={onDettaglio} onPagamento={onPagamento} onModifica={onModifica} onElimina={onElimina} canCambiaStato={canCambiaStato} onCambiaStato={onCambiaStato} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {onContratto && <ElencoContratti contratti={contratti} onContratto={onContratto} isMobile={isMobile} />}
    </div>
  );
}

export default PaginaPreventivi;
