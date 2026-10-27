import { useState } from 'react';
import { generaReportMensile } from '../utils/generaReport';
import RicercaGlobale from './RicercaGlobale';
import './Dashboard.css';

const ICONE = {
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};
const Icona = ({ nome }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONE[nome]}</svg>;

const euro = (n, decimali = 0) => `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali })}`;

function Collapsible({ titolo, conteggio, urgente = false, children }) {
  const [aperto, setAperto] = useState(false);
  return (
    <section className="ns-card dash-section">
      <button type="button" className="dash-section__head" aria-expanded={aperto} onClick={() => setAperto(a => !a)}>
        <span className="dash-section__title">{titolo}</span>
        {conteggio > 0 && <span className={`ns-count${urgente ? ' ns-count--danger' : ''}`}>{conteggio}</span>}
        <span className="dash-section__chevron"><Icona nome="chevron" /></span>
      </button>
      {aperto && <div className="dash-section__body">{children}</div>}
    </section>
  );
}

function StatCard({ valore, label, meta, allarme = false }) {
  return (
    <div className="ns-card ns-stat">
      <span className="ns-stat__label">{label}</span>
      <span className={`ns-stat__value${allarme ? ' ns-stat__value--danger' : ''}`} title={String(valore)}>{valore}</span>
      <span className="ns-stat__meta">{meta}</span>
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
    (az.manutenzioni || []).forEach(m => {
      if (m.scadenza) {
        const d = new Date(m.scadenza);
        if (d >= inizioMese && d <= fineMese)
          scadenze.push({ azienda: az.nome, tipo: 'Manutenzione', nome: [m.tipo, m.ubicazione].filter(Boolean).join(' — '), scadenza: d });
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

  // Interventi di manutenzione eseguiti nel mese
  const interventiMese = aziende.flatMap(az => (az.manutenzioni || []).flatMap(m =>
    (m.interventi || [])
      .filter(i => i.data?.startsWith(meseSelezionato))
      .map(i => ({ ...i, azienda: az.nome, manutenzione: m.tipo }))
  )).sort((a, b) => b.data.localeCompare(a.data));

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

  const scadute = scadenze.filter(s => s.scadenza < oggi).length;
  const statoScadenza = d => {
    if (d < oggi) return <span className="ns-badge ns-badge--danger"><Icona nome="alert" />Scaduto</span>;
    if (d <= traGiorni) return <span className="ns-badge ns-badge--warn"><Icona nome="clock" />In scadenza</span>;
    return <span className="ns-badge ns-badge--neutral">Prevista</span>;
  };

  return (
    <div className="dash">
      {/* Intestazione */}
      <div className="dash-head">
        <h2 className="ns-page-title">Home</h2>
        {isMobile && ricercaGlobaleProps ? (
          <RicercaGlobale {...ricercaGlobaleProps} />
        ) : (
          <input
            type="search"
            className="ns-input dash-search"
            placeholder="Cerca azienda…"
            aria-label="Cerca azienda"
            value={ricerca}
            onChange={e => onRicerca(e.target.value)}
          />
        )}
      </div>

      {/* Selettore mese */}
      <div className="dash-toolbar">
        <input
          type="month"
          className="ns-input"
          aria-label="Mese"
          value={meseSelezionato}
          onChange={e => setMeseSelezionato(e.target.value)}
        />
        {meseSelezionato !== meseCorrente && (
          <button type="button" className="ns-btn ns-btn--ghost ns-btn--sm" onClick={() => setMeseSelezionato(meseCorrente)}>
            Mese corrente
          </button>
        )}
        <span className="dash-month">{nomeMese}</span>
        <button
          type="button"
          className="ns-btn ns-btn--primary dash-report"
          onClick={() => generaReportMensile({ aziende, appuntamenti, preventivi, anno, mese, giorniPreavviso })}
        >
          <Icona nome="download" />Scarica report PDF
        </button>
      </div>

      {/* Card statistiche */}
      <div className="ns-stats dash-stats">
        <StatCard label="Aziende" valore={aziende.length} meta="Attive" />
        <StatCard label="Appuntamenti" valore={appMese.length} meta={<span style={{ textTransform: 'capitalize' }}>{nomeMese}</span>} />
        <StatCard
          label="Scadenze"
          valore={scadenze.length}
          allarme={scadute > 0}
          meta={scadenze.length === 0
            ? <span className="ns-badge ns-badge--ok"><Icona nome="check" />Tutto in regola</span>
            : scadute > 0
              ? <span className="ns-badge ns-badge--danger"><Icona nome="alert" />{scadute === 1 ? '1 scaduta' : `${scadute} scadute`}</span>
              : <span className="ns-badge ns-badge--warn"><Icona nome="clock" />Da rinnovare</span>}
        />
        <StatCard label="Preventivi" valore={euro(valorePrev)} meta={prevMese.length === 1 ? '1 nel mese' : `${prevMese.length} nel mese`} />
        <StatCard label="Incassato" valore={euro(totalePagamenti)} meta={pagamentiMese.length === 1 ? '1 pagamento' : `${pagamentiMese.length} pagamenti`} />
      </div>

      {/* Elenchi collassabili */}
      <div className="dash-sections">
        <Collapsible titolo="Scadenze del mese" conteggio={scadenze.length} urgente={scadute > 0}>
          {scadenze.length === 0 ? (
            <p className="dash-empty">Nessuna scadenza in questo mese.</p>
          ) : scadenze.map((s, i) => (
            <div key={i} className="dash-row">
              <div className="dash-row__main">
                <span className="dash-row__name">{s.azienda}</span>
                <span className="dash-row__sub">{s.tipo} · {s.nome}</span>
              </div>
              <div className="dash-row__side">
                <span className="dash-row__date">{fmt(s.scadenza)}</span>
                {statoScadenza(s.scadenza)}
              </div>
            </div>
          ))}
        </Collapsible>

        <Collapsible titolo="Appuntamenti del mese" conteggio={appMese.length}>
          {appMese.length === 0 ? (
            <p className="dash-empty">Nessun appuntamento in questo mese.</p>
          ) : appMese.map((a, i) => (
            <div key={i} className="dash-row">
              <div className="dash-row__main">
                <span className="dash-row__name">
                  {a.tipoCliente === 'registrato'
                    ? (aziende.find(az => az.id === a.aziendaId)?.nome || 'Azienda non trovata')
                    : (a.nuovoCliente?.nome || 'Nuovo cliente')}
                </span>
                <span className="dash-row__sub">{[a.tipo, a.consulente].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="dash-row__side">
                <span className="dash-row__date">{fmt(a.data)}{a.ora ? ` · ${a.ora}` : ''}</span>
              </div>
            </div>
          ))}
        </Collapsible>

        <Collapsible titolo="Interventi di manutenzione" conteggio={interventiMese.length}>
          {interventiMese.length === 0 ? (
            <p className="dash-empty">Nessun intervento di manutenzione in questo mese.</p>
          ) : interventiMese.map(i => (
            <div key={i.id} className="dash-row">
              <div className="dash-row__main">
                <span className="dash-row__name">{i.azienda}</span>
                <span className="dash-row__sub">{[i.manutenzione, i.tecnico, i.note].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="dash-row__side">
                <span className="dash-row__date">{fmt(i.data)}</span>
                <span className="ns-badge ns-badge--ok"><Icona nome="check" />Eseguito</span>
              </div>
            </div>
          ))}
        </Collapsible>

        <Collapsible titolo="Pagamenti ricevuti" conteggio={pagamentiMese.length}>
          {pagamentiMese.length === 0 ? (
            <p className="dash-empty">Nessun pagamento registrato in questo mese.</p>
          ) : (
            <>
              {pagamentiMese.map((p, i) => (
                <div key={i} className="dash-row">
                  <div className="dash-row__main">
                    <span className="dash-row__name">{p.azienda}</span>
                    <span className="dash-row__sub">
                      {[fmt(p.data), p.metodoPagamento, p.numeroFattura, p.descrizione].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="dash-row__side">
                    <span className="ns-badge ns-badge--neutral">{p.fonte === 'preventivo' ? 'Preventivo' : 'Azienda'}</span>
                    <span className="dash-row__amount">{euro(p.importo, 2)}</span>
                  </div>
                </div>
              ))}
              <div className="dash-total">
                <span className="ns-label">Totale</span>
                <span className="dash-row__amount">{euro(totalePagamenti, 2)}</span>
              </div>
            </>
          )}
        </Collapsible>
      </div>
    </div>
  );
}

export default Dashboard;
