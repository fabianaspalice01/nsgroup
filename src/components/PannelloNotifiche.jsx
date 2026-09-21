import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_KEY = 'nsgroup:notifiche_ignorate';

const getIgnorate = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const setIgnorate = (ids) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};
const notificaId = (n) => `${n.categoria}_${n.azienda}_${n.descrizione}_${n.scadenza}`;

function BlocoAttivita({ attivita, segnaAttivitaLetta }) {
  if (!attivita.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c3e66', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        👤 Attività
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {attivita.map(a => (
          <div key={a.id} style={{ background: a.letta ? '#f6f8fc' : '#eef1f8', border: `1px solid ${a.letta ? '#dfe5ef' : '#c3cde3'}`, borderRadius: 8, padding: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 16 }}>
              {a.tipo === 'modifica_appuntamento' ? '✏️'
                : a.tipo === 'nuovo_appuntamento' ? '📅'
                : a.tipo === 'elimina_appuntamento' ? '🗑️'
                : a.tipo === 'nuovo_preventivo' ? '📄'
                : a.tipo === 'modifica_preventivo' ? '✏️'
                : a.tipo === 'nuova_azienda' ? '🏢'
                : a.tipo === 'modifica_azienda' ? '✏️'
                : a.tipo === 'elimina_azienda' ? '🗑️'
                : a.tipo === 'archivia_azienda' ? '📦'
                : a.tipo === 'ripristina_azienda' ? '♻️'
                : a.tipo === 'cambio_stato_task' ? '📋'
                : '🔔'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#1a2540', marginBottom: 2 }}>{a.messaggio}</div>
              <div style={{ fontSize: 11, color: '#9aa7bf' }}>
                {new Date(a.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {!a.letta && (
              <button onClick={() => segnaAttivitaLetta(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa7bf', fontSize: 14, padding: '0 2px', flexShrink: 0 }} title="Segna come letta">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlocoScadenze({ notifiche, notificheFiltrate, filtroAttivo, setFiltroAttivo, onNavigaAzienda, setMostraPannello, ignoraNotifica, getColore, getIcona, formatData }) {
  if (!notifiche.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#5f6f8c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        ⏰ Scadenze {filtroAttivo && (
          <span style={{ textTransform: 'none', fontWeight: 400, color: '#9aa7bf' }}>
            — filtro attivo · <button onClick={() => setFiltroAttivo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2c3e66', fontSize: 12, padding: 0, fontWeight: 600 }}>Mostra tutte</button>
          </span>
        )}
      </div>
      {notificheFiltrate.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 12, color: '#9aa7bf', fontSize: 13 }}>
          Nessuna notifica di questo tipo
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notificheFiltrate.map((notifica, index) => {
            const colore = getColore(notifica.tipo);
            return (
              <div
                key={index}
                onClick={() => {
                  if (onNavigaAzienda && notifica.aziendaId) {
                    onNavigaAzienda(notifica.aziendaId, notifica.tabDestinazione);
                    setMostraPannello(false);
                  }
                }}
                style={{
                  background: colore.bg,
                  border: `1px solid ${colore.border}`,
                  borderRadius: 8,
                  padding: 12,
                  cursor: onNavigaAzienda && notifica.aziendaId ? 'pointer' : 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{getIcona(notifica.tipo)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: colore.text, marginBottom: 2 }}>
                      {notifica.categoria} - {notifica.azienda}
                    </div>
                    <div style={{ fontSize: 13, color: '#1a2540', marginBottom: 4 }}>
                      {notifica.descrizione}
                    </div>
                    <div style={{ fontSize: 11, color: colore.text }}>
                      Scadenza: {formatData(notifica.scadenza)} •{' '}
                      {notifica.tipo === 'scaduto'
                        ? `Scaduto da ${notifica.giorni} giorn${notifica.giorni === 1 ? 'o' : 'i'}`
                        : `Scade tra ${notifica.giorni} giorn${notifica.giorni === 1 ? 'o' : 'i'}`
                      }
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); ignoraNotifica(notifica); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa7bf', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                    title="Cancella notifica"
                  >✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListaNotifiche({ attivita, notifiche, notificheFiltrate, filtroAttivo, setFiltroAttivo, onNavigaAzienda, setMostraPannello, ignoraNotifica, segnaAttivitaLetta, getColore, getIcona, formatData }) {
  const propsBlocoScadenze = { notifiche, notificheFiltrate, filtroAttivo, setFiltroAttivo, onNavigaAzienda, setMostraPannello, ignoraNotifica, getColore, getIcona, formatData };
  const propsBlocoAttivita = { attivita, segnaAttivitaLetta };
  if (filtroAttivo) {
    return <><BlocoScadenze {...propsBlocoScadenze} /><BlocoAttivita {...propsBlocoAttivita} /></>;
  }
  return <><BlocoAttivita {...propsBlocoAttivita} /><BlocoScadenze {...propsBlocoScadenze} /></>;
}

function PannelloNotifiche({ aziende, compact = false, onNavigaAzienda }) {
  const [notifiche, setNotifiche] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [mostraPannello, setMostraPannello] = useState(false);

  useEffect(() => {
    calcolaNotifiche();
  }, [aziende]);

  // Listener real-time su notifiche_admin (attività consulenti)
  useEffect(() => {
    const q = query(collection(db, 'notifiche_admin'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const nuove = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttivita(nuove);
    }, () => {});
    return () => unsub();
  }, []);

  const calcolaNotifiche = () => {
    const oggi = new Date();
    const ignorate = getIgnorate();
    const notificheArray = [];

    aziende.forEach(azienda => {
      // 1. Controlli in scadenza
      azienda.controlli?.forEach(controllo => {
        if (!controllo.completato) {
          const scadenza = new Date(controllo.scadenza);
          const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));

          if (giorni < 0) {
            notificheArray.push({
              tipo: 'scaduto',
              categoria: 'Controllo',
              aziendaId: azienda.id,
              tabDestinazione: 'controlli',
              azienda: azienda.nome,
              descrizione: `${controllo.tipo}`,
              scadenza: controllo.scadenza,
              giorni: Math.abs(giorni),
              priorita: 3
            });
          } else if (giorni <= 7) {
            notificheArray.push({
              tipo: 'urgente',
              categoria: 'Controllo',
              aziendaId: azienda.id,
              tabDestinazione: 'controlli',
              azienda: azienda.nome,
              descrizione: `${controllo.tipo}`,
              scadenza: controllo.scadenza,
              giorni: giorni,
              priorita: 2
            });
          } else if (giorni <= 30) {
            notificheArray.push({
              tipo: 'avviso',
              categoria: 'Controllo',
              aziendaId: azienda.id,
              tabDestinazione: 'controlli',
              azienda: azienda.nome,
              descrizione: `${controllo.tipo}`,
              scadenza: controllo.scadenza,
              giorni: giorni,
              priorita: 1
            });
          }
        }
      });

      // 2. Attestati in scadenza
      azienda.dipendenti?.forEach(dipendente => {
        dipendente.attestati?.forEach(attestato => {
          if (attestato.dataScadenza) {
            const scadenza = new Date(attestato.dataScadenza);
            const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));

            if (giorni < 0) {
              notificheArray.push({
                tipo: 'scaduto',
                categoria: 'Attestato',
                aziendaId: azienda.id,
                tabDestinazione: 'dipendenti',
                azienda: azienda.nome,
                descrizione: `${attestato.nome} - ${dipendente.nome} ${dipendente.cognome}`,
                scadenza: attestato.dataScadenza,
                giorni: Math.abs(giorni),
                priorita: 3
              });
            } else if (giorni <= 30) {
              notificheArray.push({
                tipo: 'urgente',
                categoria: 'Attestato',
                aziendaId: azienda.id,
                tabDestinazione: 'dipendenti',
                azienda: azienda.nome,
                descrizione: `${attestato.nome} - ${dipendente.nome} ${dipendente.cognome}`,
                scadenza: attestato.dataScadenza,
                giorni: giorni,
                priorita: 2
              });
            }
          }
        });
      });

      // 3. Documenti in scadenza
      azienda.documenti?.forEach(documento => {
        if (documento.dataScadenza) {
          const scadenza = new Date(documento.dataScadenza);
          const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));

          if (giorni < 0) {
            notificheArray.push({
              tipo: 'scaduto',
              categoria: 'Documento',
              aziendaId: azienda.id,
              tabDestinazione: 'documenti',
              azienda: azienda.nome,
              descrizione: `${documento.nome} (${documento.tipo})`,
              scadenza: documento.dataScadenza,
              giorni: Math.abs(giorni),
              priorita: 3
            });
          } else if (giorni <= 30) {
            notificheArray.push({
              tipo: 'urgente',
              categoria: 'Documento',
              aziendaId: azienda.id,
              tabDestinazione: 'documenti',
              azienda: azienda.nome,
              descrizione: `${documento.nome} (${documento.tipo})`,
              scadenza: documento.dataScadenza,
              giorni: giorni,
              priorita: 2
            });
          }
        }
      });
    });

    // Filtra le ignorate e ordina per priorità
    const filtrate = notificheArray.filter(n => !ignorate.includes(notificaId(n)));
    filtrate.sort((a, b) => {
      if (b.priorita !== a.priorita) return b.priorita - a.priorita;
      return a.giorni - b.giorni;
    });

    setNotifiche(filtrate);
  };

  const ignoraNotifica = (n) => {
    const ignorate = getIgnorate();
    const id = notificaId(n);
    if (!ignorate.includes(id)) setIgnorate([...ignorate, id]);
    setNotifiche(prev => prev.filter(x => notificaId(x) !== id));
  };

  const ignoraTutte = async () => {
    const ignorate = getIgnorate();
    const nuovi = notifiche.map(notificaId).filter(id => !ignorate.includes(id));
    setIgnorate([...ignorate, ...nuovi]);
    setNotifiche([]);
    // Segna come lette anche le attività
    const batch = writeBatch(db);
    attivita.filter(a => !a.letta).forEach(a => batch.update(doc(db, 'notifiche_admin', a.id), { letta: true }));
    await batch.commit().catch(() => {});
  };

  const segnaAttivitaLetta = async (id) => {
    await updateDoc(doc(db, 'notifiche_admin', id), { letta: true }).catch(() => {});
  };

  const nonLette = attivita.filter(a => !a.letta).length;

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const getIcona = (tipo) => {
    if (tipo === 'scaduto') return '🔴';
    if (tipo === 'urgente') return '🟡';
    return '🔵';
  };

  const getColore = (tipo) => {
    if (tipo === 'scaduto') return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
    if (tipo === 'urgente') return { bg: '#fef3c7', border: '#fde68a', text: '#d97706' };
    return { bg: '#eef1f8', border: '#d5ddee', text: '#34508a' };
  };

  const [filtroAttivo, setFiltroAttivo] = useState(null);

  const scaduti = notifiche.filter(n => n.tipo === 'scaduto').length;
  const urgenti = notifiche.filter(n => n.tipo === 'urgente').length;
  const totBadge = notifiche.length + nonLette;

  const notificheFiltrate = filtroAttivo
    ? notifiche.filter(n => n.tipo === filtroAttivo)
    : notifiche;

  const toggleFiltro = (tipo) => setFiltroAttivo(prev => prev === tipo ? null : tipo);

  return (
    <div style={{ position: 'relative' }}>
      {/* Badge notifiche */}
      <button
        onClick={() => setMostraPannello(!mostraPannello)}
        style={{
          position: 'relative',
          padding: compact ? '8px 10px' : '8px 16px',
          background: totBadge > 0 ? '#fee2e2' : '#eef1f7',
          color: totBadge > 0 ? '#dc2626' : '#5f6f8c',
          border: `1px solid ${totBadge > 0 ? '#fecaca' : '#dfe5ef'}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: compact ? 18 : 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 4 : 8
        }}
      >
        🔔
        {!compact && ' Notifiche'}
        {totBadge > 0 && (
          <span style={{
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 'bold'
          }}>
            {totBadge > 99 ? '99+' : totBadge}
          </span>
        )}
      </button>

      {/* Pannello notifiche */}
      {mostraPannello && (
        <>
          {/* Overlay per chiudere */}
          <div
            onClick={() => setMostraPannello(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />

          {/* Pannello — full-screen su mobile, dropdown su desktop */}
          <div style={compact ? {
            position: 'fixed',
            inset: 0,
            margin: 0,
            width: '100%',
            maxHeight: '100%',
            background: 'white',
            borderRadius: 0,
            boxShadow: 'none',
            border: 'none',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          } : {
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 450,
            maxHeight: 600,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid #dfe5ef',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: 20, borderBottom: '1px solid #dfe5ef', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔔 Notifiche Scadenze</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {notifiche.length > 0 && (
                    <button
                      onClick={ignoraTutte}
                      style={{ background: 'none', border: '1px solid #dfe5ef', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#5f6f8c', fontWeight: 600 }}
                    >
                      Cancella tutte
                    </button>
                  )}
                  {compact && (
                    <button
                      onClick={() => setMostraPannello(false)}
                      style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#5f6f8c', lineHeight: 1, padding: '0 4px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 13, flexWrap: 'wrap' }}>
                {scaduti > 0 && (
                  <button onClick={() => toggleFiltro('scaduto')} style={{
                    color: '#dc2626', fontWeight: 600, background: filtroAttivo === 'scaduto' ? '#fecaca' : '#fef2f2',
                    border: `1px solid ${filtroAttivo === 'scaduto' ? '#dc2626' : '#fecaca'}`,
                    borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 13
                  }}>🔴 {scaduti} scadut{scaduti === 1 ? 'o' : 'i'}</button>
                )}
                {urgenti > 0 && (
                  <button onClick={() => toggleFiltro('urgente')} style={{
                    color: '#d97706', fontWeight: 600, background: filtroAttivo === 'urgente' ? '#fde68a' : '#fef3c7',
                    border: `1px solid ${filtroAttivo === 'urgente' ? '#d97706' : '#fde68a'}`,
                    borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 13
                  }}>🟡 {urgenti} urgent{urgenti === 1 ? 'e' : 'i'}</button>
                )}
                {nonLette > 0 && <span style={{ color: '#2c3e66', fontWeight: 600, padding: '3px 0' }}>🔵 {nonLette} attività</span>}
                {totBadge === 0 && <span style={{ color: '#059669', fontWeight: 600 }}>✅ Tutto ok!</span>}
              </div>
            </div>

            {/* Lista notifiche */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {notifiche.length === 0 && attivita.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9aa7bf' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Nessuna scadenza imminente</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Tutti i documenti sono in regola</div>
                </div>
              ) : (
                <ListaNotifiche
                  attivita={attivita}
                  notifiche={notifiche}
                  notificheFiltrate={notificheFiltrate}
                  filtroAttivo={filtroAttivo}
                  setFiltroAttivo={setFiltroAttivo}
                  onNavigaAzienda={onNavigaAzienda}
                  setMostraPannello={setMostraPannello}
                  ignoraNotifica={ignoraNotifica}
                  segnaAttivitaLetta={segnaAttivitaLetta}
                  getColore={getColore}
                  getIcona={getIcona}
                  formatData={formatData}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PannelloNotifiche;
