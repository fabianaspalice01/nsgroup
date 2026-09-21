import { useState, useRef, useEffect } from 'react';

function Gruppo({ titolo, items, onSelect, renderItem }) {
  if (!items.length) return null;
  return (
    <div>
      <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#9aa7bf', textTransform: 'uppercase', letterSpacing: 1, background: '#f6f8fc' }}>
        {titolo}
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => onSelect(item)}
          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #eef1f7', display: 'flex', flexDirection: 'column', gap: 2 }}
          onMouseEnter={e => e.currentTarget.style.background = '#eef1f7'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

export default function RicercaGlobale({ aziende, appuntamenti, preventivi, onSelectAzienda, onVistaChange }) {
  const [query, setQuery] = useState('');
  const [aperto, setAperto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setAperto(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();

  const risultati = q.length < 2 ? null : (() => {
    const az = aziende.filter(a =>
      [a.nome, a.email, a.telefono, a.partitaIva, a.indirizzo].some(v => v?.toLowerCase().includes(q))
    ).slice(0, 5);

    const dip = [];
    aziende.forEach(a => {
      (a.dipendenti || []).forEach(d => {
        if (`${d.nome} ${d.cognome}`.toLowerCase().includes(q))
          dip.push({ ...d, _azienda: a });
      });
    });

    const doc = [];
    aziende.forEach(a => {
      (a.documenti || []).forEach(d => {
        if (d.nome?.toLowerCase().includes(q))
          doc.push({ ...d, _azienda: a });
      });
    });

    const app = (appuntamenti || []).filter(a =>
      [a.aziendaNome, a.nuovoCliente?.nome, a.tipo, a.consulente].some(v => v?.toLowerCase().includes(q))
    ).slice(0, 4);

    const prev = (preventivi || []).filter(p =>
      p.nomeCliente?.toLowerCase().includes(q)
    ).slice(0, 4);

    return { az, dip: dip.slice(0, 5), doc: doc.slice(0, 5), app, prev };
  })();

  const totale = risultati ? Object.values(risultati).reduce((s, a) => s + a.length, 0) : 0;

  const seleziona = (tipo, item) => {
    setQuery('');
    setAperto(false);
    if (tipo === 'az') onSelectAzienda(item.id);
    else if (tipo === 'dip' || tipo === 'doc') onSelectAzienda(item._azienda.id);
    else if (tipo === 'app') onVistaChange('agenda');
    else if (tipo === 'prev') onVistaChange('preventivi');
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: 260 }}>
      <input
        type="text"
        placeholder="🔍 Cerca ovunque..."
        value={query}
        onChange={e => { setQuery(e.target.value); setAperto(true); }}
        onFocus={() => setAperto(true)}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
      />

      {aperto && risultati && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '1px solid #dfe5ef', zIndex: 1000, maxHeight: 420, overflowY: 'auto' }}>
          {totale === 0 ? (
            <div style={{ padding: '16px 14px', color: '#9aa7bf', fontSize: 14 }}>Nessun risultato per "{query}"</div>
          ) : (
            <>
              <Gruppo
                titolo="Aziende"
                items={risultati.az}
                onSelect={item => seleziona('az', item)}
                renderItem={item => (
                  <>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.nome}</span>
                    {item.indirizzo && <span style={{ fontSize: 12, color: '#9aa7bf' }}>{item.indirizzo}</span>}
                  </>
                )}
              />
              <Gruppo
                titolo="Dipendenti"
                items={risultati.dip}
                onSelect={item => seleziona('dip', item)}
                renderItem={item => (
                  <>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.nome} {item.cognome}</span>
                    <span style={{ fontSize: 12, color: '#9aa7bf' }}>{item._azienda.nome}</span>
                  </>
                )}
              />
              <Gruppo
                titolo="Documenti"
                items={risultati.doc}
                onSelect={item => seleziona('doc', item)}
                renderItem={item => (
                  <>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.nome}</span>
                    <span style={{ fontSize: 12, color: '#9aa7bf' }}>{item._azienda.nome}</span>
                  </>
                )}
              />
              <Gruppo
                titolo="Appuntamenti"
                items={risultati.app}
                onSelect={item => seleziona('app', item)}
                renderItem={item => (
                  <>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.aziendaNome || item.nuovoCliente?.nome || 'Cliente'}</span>
                    <span style={{ fontSize: 12, color: '#9aa7bf' }}>{item.data}{item.ora ? ` ${item.ora}` : ''}{item.consulente ? ` — ${item.consulente}` : ''}</span>
                  </>
                )}
              />
              <Gruppo
                titolo="Preventivi"
                items={risultati.prev}
                onSelect={item => seleziona('prev', item)}
                renderItem={item => (
                  <>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.nomeCliente}</span>
                    <span style={{ fontSize: 12, color: '#9aa7bf' }}>€ {item.totale?.toFixed(2)} — {new Date(item.dataCreazione).toLocaleDateString('it-IT')}</span>
                  </>
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
