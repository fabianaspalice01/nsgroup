import { useState } from 'react';
import { generaReportMensile } from '../utils/generaReport';
import RicercaGlobale from './RicercaGlobale';

function Collapsible({ titolo, conteggio, coloreBadge, children }) {
  const [aperto, setAperto] = useState(false);
  return (
    <div style={{ border: '1px solid #dfe5ef', borderRadius: 10, overflow: 'hidden', marginBottom: 0 }}>
      <button
        onClick={() => setAperto(a => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f6f8fc', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#45536f' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {titolo}
          {conteggio > 0 && (
            <span style={{ background: coloreBadge || '#2c3e66', color: '#fff', borderRadius: 20, padding: '1px 9px', fontSize: 12, fontWeight: 700 }}>
              {conteggio}
            </span>
          )}
        </span>
        <span style={{ fontSize: 18, transition: 'transform 0.2s', display: 'inline-block', transform: aperto ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {aperto && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function StatCard({ valore, label, bg, color }) {
  return (
    <div style={{ background: bg, padding: '18px 20px', borderRadius: 12, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{valore}</div>
      <div style={{ fontSize: 13, color, opacity: 0.75, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Dashboard({ aziende, ricerca, onRicerca, appuntamenti, preventivi, giorniPreavviso = 7, isMobile = false, ricercaGlobaleProps = null }) {
  const now = new Date();
  const [meseSelezionato, setMeseSelezionato] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  const [anno, mese] = meseSelezionato.split('-').map(Number);
  const inizioMese = new Date(anno, mese - 1, 1);
  const fineMese = new Date(anno, mese, 0, 23, 59, 59);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const traGiorni = new Date(oggi.getTime() + giorniPreavviso * 86400000);

  const nomeMese = inizioMese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const meseCorrente = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fmt = d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  // Scadenze nel mese (controlli + documenti + attestati)
  const scadenze = [];
  aziende.forEach(az => {
    (az.controlli || []).forEach(c => {
      if (!c.completato && c.scadenza) {
        const d = new Date(c.scadenza);
        if (d >= inizioMese && d <= fineMese)
          scadenze.push({ azienda: az.nome, tipo: 'Controllo', nome: c.tipo, scadenza: d });
      }
    });
    (az.documenti || []).forEach(doc => {
      if (doc.dataScadenza) {
        const d = new Date(doc.dataScadenza);
        if (d >= inizioMese && d <= fineMese)
          scadenze.push({ azienda: az.nome, tipo: 'Documento', nome: doc.nome, scadenza: d });
      }
    });
    (az.dipendenti || []).forEach(dip => {
      (dip.attestati || []).forEach(att => {
        if (att.dataScadenza) {
          const d = new Date(att.dataScadenza);
          if (d >= inizioMese && d <= fineMese)
            scadenze.push({ azienda: az.nome, tipo: 'Attestato', nome: `${att.nome} — ${dip.nome} ${dip.cognome}`, scadenza: d });
        }
      });
    });
  });
  scadenze.sort((a, b) => a.scadenza - b.scadenza);

  // Appuntamenti nel mese
  const appMese = [...(appuntamenti || [])]
    .filter(a => { const d = new Date(a.data); return d >= inizioMese && d <= fineMese; })
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  // Preventivi nel mese
  const prevMese = (preventivi || []).filter(p => {
    const d = new Date(p.dataCreazione);
    return d >= inizioMese && d <= fineMese;
  });
  const valorePrev = prevMese.reduce((s, p) => s + (p.totale || 0), 0);

  // Pagamenti ricevuti nel mese (da aziende + da preventivi)
  const pagamentiMese = [];
  aziende.forEach(az => {
    (az.pagamenti || []).forEach(p => {
      if (!p.data) return;
      const d = new Date(p.data + 'T12:00:00');
      if (d >= inizioMese && d <= fineMese)
        pagamentiMese.push({ azienda: az.nome, importo: parseFloat(p.importo) || 0, data: d, metodoPagamento: p.metodoPagamento || '', numeroFattura: p.numeroFattura || '', descrizione: p.descrizione || '', fonte: 'azienda' });
    });
  });
  (preventivi || []).forEach(prev => {
    (prev.pagamenti || []).forEach(p => {
      if (!p.data) return;
      const d = new Date(p.data + 'T12:00:00');
      if (d >= inizioMese && d <= fineMese)
        pagamentiMese.push({ azienda: prev.nomeCliente || 'Cliente', importo: parseFloat(p.importo) || 0, data: d, metodoPagamento: p.metodoPagamento || '', numeroFattura: p.numeroFattura || '', descrizione: p.descrizione || '', fonte: 'preventivo' });
    });
  });
  pagamentiMese.sort((a, b) => b.data - a.data);
  const totalePagamenti = pagamentiMese.reduce((s, p) => s + p.importo, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Home</h2>
        {isMobile && ricercaGlobaleProps ? (
          <RicercaGlobale {...ricercaGlobaleProps} />
        ) : (
          <input
            type="text"
            placeholder="Cerca azienda..."
            value={ricerca}
            onChange={e => onRicerca(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: 200 }}
          />
        )}
      </div>

      {/* Selettore mese */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="month"
          value={meseSelezionato}
          onChange={e => setMeseSelezionato(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        />
        {meseSelezionato !== meseCorrente && (
          <button
            onClick={() => setMeseSelezionato(meseCorrente)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2c3e66', background: 'transparent', color: '#2c3e66', fontSize: 13, cursor: 'pointer' }}
          >
            Mese corrente
          </button>
        )}
        <span style={{ fontSize: 14, color: '#9aa7bf', textTransform: 'capitalize' }}>{nomeMese}</span>
        <button
          onClick={() => generaReportMensile({ aziende, appuntamenti, preventivi, anno, mese, giorniPreavviso })}
          style={{ marginLeft: 'auto', padding: '7px 16px', background: '#2c3e66', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          📋 Scarica Report PDF
        </button>
      </div>

      {/* Card statistiche */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard valore={aziende.length} label="Aziende" bg="#dde3f0" color="#3a5a94" />
        <StatCard valore={appMese.length} label="Appuntamenti" bg="#dde3f0" color="#2c3e66" />
        <StatCard valore={scadenze.length} label="Scadenze" bg={scadenze.length > 0 ? '#fee2e2' : '#d1fae5'} color={scadenze.length > 0 ? '#dc2626' : '#059669'} />
        <StatCard valore={`€ ${valorePrev.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} label="Preventivi" bg="#f0fdf4" color="#15803d" />
        <StatCard valore={`€ ${totalePagamenti.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} label="Incassato" bg="#eef1f8" color="#2c3e66" />
      </div>

      {/* Elenchi collassabili */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <Collapsible titolo={`⚠️ Scadenze — ${nomeMese}`} conteggio={scadenze.length} coloreBadge="#dc2626">
          {scadenze.length === 0 ? (
            <div style={{ color: '#15803d', fontSize: 14 }}>Nessuna scadenza</div>
          ) : scadenze.map((s, i) => (
            <div key={i} style={{ border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.azienda}</span>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{fmt(s.scadenza)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5f6f8c', marginTop: 2 }}>{s.tipo} — {s.nome}</div>
            </div>
          ))}
        </Collapsible>

        <Collapsible titolo={`📅 Appuntamenti — ${nomeMese}`} conteggio={appMese.length} coloreBadge="#2c3e66">
          {appMese.length === 0 ? (
            <div style={{ color: '#9aa7bf', fontSize: 14 }}>Nessun appuntamento</div>
          ) : appMese.map((a, i) => (
            <div key={i} style={{ border: '1px solid #dfe5ef', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {a.tipoCliente === 'registrato'
                    ? (aziende.find(az => az.id === a.aziendaId)?.nome || 'Azienda non trovata')
                    : (a.nuovoCliente?.nome || 'Nuovo cliente')}
                </span>
                <span style={{ fontWeight: 600, color: '#2c3e66', fontSize: 13 }}>{fmt(a.data)}{a.ora ? ` ${a.ora}` : ''}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5f6f8c', marginTop: 2 }}>
                {[a.tipo, a.consulente].filter(Boolean).join(' — ')}
              </div>
            </div>
          ))}
        </Collapsible>

        <Collapsible
          titolo={`💶 Pagamenti ricevuti — ${nomeMese}`}
          conteggio={pagamentiMese.length}
          coloreBadge="#2c3e66"
        >
          {pagamentiMese.length === 0 ? (
            <div style={{ color: '#9aa7bf', fontSize: 14 }}>Nessun pagamento registrato</div>
          ) : (
            <>
              {pagamentiMese.map((p, i) => (
                <div key={i} style={{ border: '1px solid #c3cde3', borderRadius: 8, padding: '10px 14px', background: '#eef1f8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1a2540' }}>{p.azienda}</span>
                    <span style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>€ {p.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#5f6f8c', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fmt(p.data)}</span>
                    {p.metodoPagamento && <span>· {p.metodoPagamento}</span>}
                    {p.numeroFattura && <span>· {p.numeroFattura}</span>}
                    {p.descrizione && <span>· {p.descrizione}</span>}
                    <span style={{ marginLeft: 'auto', color: p.fonte === 'preventivo' ? '#2c3e66' : '#2c3e66', fontWeight: 600 }}>
                      {p.fonte === 'preventivo' ? '📄 Preventivo' : '🏢 Azienda'}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '2px solid #dde3f0', marginTop: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#2c3e66' }}>
                  Totale: € {totalePagamenti.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </Collapsible>

      </div>
    </div>
  );
}

export default Dashboard;
