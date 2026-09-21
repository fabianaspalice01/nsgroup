import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, firebaseConfig } from '../firebase';
import toast from "react-hot-toast";

function GestioneUtenti({ aziende, utenteCorrente }) {
  const [utenti, setUtenti] = useState([]);
  const [mostraModale, setMostraModale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [utentePerElimina, setUtentePerElimina] = useState(null);
  const [utentePerRuolo, setUtentePerRuolo] = useState(null);
  const [nuovoRuolo, setNuovoRuolo] = useState('');
  const [nuovoAziendaId, setNuovoAziendaId] = useState('');
  const [utentePerAziende, setUtentePerAziende] = useState(null);
  const [aziendeTemp, setAziendeTemp] = useState([]);
  const [downloadTemp, setDownloadTemp] = useState([]);
  const [confirmAssegna, setConfirmAssegna] = useState(null); // { az, assegnatoNome }

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUtenti(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Errore caricamento utenti:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleAttivo = async (userId, attivoCorrente) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { attivo: !attivoCorrente });
      setUtenti(utenti.map(u => u.id === userId ? { ...u, attivo: !attivoCorrente } : u));
      toast.success(`Utente ${!attivoCorrente ? 'attivato' : 'disattivato'} con successo!`);
    } catch (error) {
      console.error('Errore nell\'aggiornamento:', error);
      toast.error('Errore nell\'aggiornamento dello stato');
    }
  };

  const apriModificaRuolo = (utente) => {
    setUtentePerRuolo(utente);
    setNuovoRuolo(utente.ruolo);
    setNuovoAziendaId(utente.aziendaId || '');
  };

  const salvaRuolo = async () => {
    if (!utentePerRuolo) return;
    if (nuovoRuolo === 'azienda' && !nuovoAziendaId) {
      toast.error('Seleziona un\'azienda');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', utentePerRuolo.id), {
        ruolo: nuovoRuolo,
        aziendaId: nuovoRuolo === 'azienda' ? nuovoAziendaId : '',
      });
      toast.success('Ruolo aggiornato');
      setUtentePerRuolo(null);
    } catch (err) {
      console.error(err);
      toast.error('Errore nel salvataggio');
    }
  };

  const apriAssegnazioneAziende = (utente) => {
    setUtentePerAziende(utente);
    // inizializza dalle aziende che hanno assegnatoA === utente.id
    setAziendeTemp(aziende.filter(a => a.assegnatoA === utente.id).map(a => a.id));
    setDownloadTemp(utente.downloadAbilitato || []);
  };

  const toggleAziendaTemp = (id) => {
    if (!aziendeTemp.includes(id)) {
      const az = aziende.find(a => a.id === id);
      if (az?.assegnatoA && az.assegnatoA !== utentePerAziende?.id) {
        setConfirmAssegna({ az, assegnatoNome: az.assegnatoNome });
        return;
      }
    }
    setAziendeTemp(prev => {
      if (prev.includes(id)) {
        setDownloadTemp(dt => dt.filter(x => x !== id));
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const confermaAssegnaConflitto = () => {
    if (!confirmAssegna) return;
    const id = confirmAssegna.az.id;
    setAziendeTemp(prev => [...prev, id]);
    setConfirmAssegna(null);
  };

  const toggleDownloadTemp = (id) => {
    setDownloadTemp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const salvaAziendeAssegnate = async () => {
    if (!utentePerAziende) return;
    try {
      const vecchieIds = aziende.filter(a => a.assegnatoA === utentePerAziende.id).map(a => a.id);
      const daAssegnare = aziendeTemp.filter(id => !vecchieIds.includes(id));
      const daRimuovere = vecchieIds.filter(id => !aziendeTemp.includes(id));

      // Aggiorna assegnatoA su ogni azienda
      for (const id of daAssegnare) {
        await updateDoc(doc(db, 'aziende', id), {
          assegnatoA: utentePerAziende.id,
          assegnatoNome: utentePerAziende.nome,
        });
      }
      for (const id of daRimuovere) {
        await updateDoc(doc(db, 'aziende', id), {
          assegnatoA: '',
          assegnatoNome: '',
        });
      }

      // Aggiorna download permission sull'utente
      await updateDoc(doc(db, 'users', utentePerAziende.id), {
        downloadAbilitato: downloadTemp,
      });

      // Notifica per le nuove aziende assegnate
      if (daAssegnare.length > 0) {
        const nomi = daAssegnare.map(id => aziende.find(a => a.id === id)?.nome).filter(Boolean);
        const messaggio = nomi.length === 1
          ? `Ti è stata assegnata l'azienda ${nomi[0]}`
          : `Ti sono state assegnate ${nomi.length} aziende: ${nomi.join(', ')}`;
        await addDoc(collection(db, 'notifiche_operatori'), {
          operatoreId: utentePerAziende.id,
          titolo: '🏢 Nuove aziende assegnate',
          messaggio,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Aziende aggiornate');
      setUtentePerAziende(null);
    } catch (err) {
      console.error(err);
      toast.error('Errore nel salvataggio');
    }
  };

  const eliminaUtente = async () => {
    if (!utentePerElimina) return;
    try {
      await deleteDoc(doc(db, 'users', utentePerElimina.id));
      toast.success(`Utente "${utentePerElimina.nome}" eliminato`);
      setUtentePerElimina(null);
    } catch (err) {
      console.error(err);
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const getAziendaNome = (aziendaId) => {
    const azienda = aziende.find(a => a.id === aziendaId);
    return azienda ? azienda.nome : 'N/A';
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Caricamento utenti...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>👥 Gestione Utenti</h2>
          <p style={{ color: '#5f6f8c', fontSize: 14, margin: '4px 0 0' }}>
            {utenti.length} utenti totali
          </p>
        </div>
        <button
          onClick={() => setMostraModale(true)}
          style={{
            background: '#2c3e66',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold'
          }}
        >
          + Nuovo Utente
        </button>
      </div>

      {/* Utenti — tabella su desktop, card su mobile */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {utenti.map((utente) => {
            const isSe = utente.email === utenteCorrente?.email;
            const puoGestireMobile = !isSe && (utente.ruolo !== 'admin' || utenteCorrente?.ruolo === 'admin');
            return (
            <div key={utente.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #dfe5ef', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{utente.nome}{isSe && <span style={{ fontSize: 11, color: '#9aa7bf', marginLeft: 6 }}>(tu)</span>}</div>
                  <div style={{ fontSize: 13, color: '#5f6f8c', marginBottom: 8, wordBreak: 'break-all' }}>{utente.email}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      background: utente.ruolo === 'admin' ? '#eef1f8' : utente.ruolo === 'operatore' ? '#f3f5fa' : utente.ruolo === 'consulente' ? '#f0fdf4' : '#fef3c7',
                      color: utente.ruolo === 'admin' ? '#2c3e66' : utente.ruolo === 'operatore' ? '#3a5a94' : utente.ruolo === 'consulente' ? '#15803d' : '#a16207',
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600
                    }}>
                      {utente.ruolo === 'admin' ? 'Admin' : utente.ruolo === 'operatore' ? 'Operatore' : utente.ruolo === 'consulente' ? 'Consulente' : 'Azienda'}
                    </span>
                    <span style={{
                      background: utente.attivo ? '#d1fae5' : '#fee2e2',
                      color: utente.attivo ? '#059669' : '#dc2626',
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600
                    }}>
                      {utente.attivo ? '✓ Attivo' : '✗ Disattivato'}
                    </span>
                    {utente.aziendaId && (
                      <span style={{ fontSize: 11, color: '#9aa7bf' }}>{getAziendaNome(utente.aziendaId)}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {puoGestireMobile && (
                      <button
                        onClick={() => toggleAttivo(utente.id, utente.attivo)}
                        style={{
                          background: utente.attivo ? '#fee2e2' : '#dcfce7',
                          color: utente.attivo ? '#dc2626' : '#16a34a',
                          border: `1px solid ${utente.attivo ? '#fecaca' : '#bbf7d0'}`,
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 12, fontWeight: 600
                        }}
                      >
                        {utente.attivo ? 'Disattiva' : 'Attiva'}
                      </button>
                    )}
                    {puoGestireMobile && (
                      <button
                        onClick={() => apriModificaRuolo(utente)}
                        style={{ background: '#eef1f8', color: '#2c3e66', border: '1px solid #c3cde3', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        ✏️ Ruolo
                      </button>
                    )}
                    {utente.ruolo !== 'azienda' && (
                      <button
                        onClick={() => apriAssegnazioneAziende(utente)}
                        style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        🏢 Aziende{aziende.filter(a => a.assegnatoA === utente.id).length > 0 && ` (${aziende.filter(a => a.assegnatoA === utente.id).length})`}
                      </button>
                    )}
                    {puoGestireMobile && (
                      <button
                        onClick={() => setUtentePerElimina(utente)}
                        style={{
                          background: '#fff1f2', color: '#be123c',
                          border: '1px solid #fecdd3',
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 12, fontWeight: 600
                        }}
                      >
                        🗑️ Elimina
                      </button>
                    )}
                  </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #dfe5ef' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f6f8fc', borderBottom: '2px solid #dfe5ef' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Nome</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Ruolo</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Azienda</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Stato</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Attiva/Disattiva</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Ruolo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Aziende</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#45536f' }}>Elimina</th>
              </tr>
            </thead>
            <tbody>
              {utenti.map((utente) => {
                const isSe = utente.email === utenteCorrente?.email;
                const puoGestire = !isSe && (utente.ruolo !== 'admin' || utenteCorrente?.ruolo === 'admin');
                return (
                <tr key={utente.id} style={{ borderBottom: '1px solid #eef1f7' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>
                    {utente.nome}{isSe && <span style={{ fontSize: 11, color: '#9aa7bf', marginLeft: 6 }}>(tu)</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#5f6f8c' }}>{utente.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: utente.ruolo === 'admin' ? '#eef1f8' : utente.ruolo === 'operatore' ? '#f3f5fa' : utente.ruolo === 'consulente' ? '#f0fdf4' : '#fef3c7',
                      color: utente.ruolo === 'admin' ? '#2c3e66' : utente.ruolo === 'operatore' ? '#3a5a94' : utente.ruolo === 'consulente' ? '#15803d' : '#a16207',
                      padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600
                    }}>
                      {utente.ruolo === 'admin' ? 'Admin' : utente.ruolo === 'operatore' ? 'Operatore' : utente.ruolo === 'consulente' ? 'Consulente' : 'Azienda'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#5f6f8c' }}>
                    {utente.aziendaId ? getAziendaNome(utente.aziendaId) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      background: utente.attivo ? '#d1fae5' : '#fee2e2',
                      color: utente.attivo ? '#059669' : '#dc2626',
                      padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600
                    }}>
                      {utente.attivo ? '✓ Attivo' : '✗ Disattivato'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {puoGestire ? (
                      <button
                        onClick={() => toggleAttivo(utente.id, utente.attivo)}
                        style={{
                          background: utente.attivo ? '#fee2e2' : '#dcfce7',
                          color: utente.attivo ? '#dc2626' : '#16a34a',
                          border: `1px solid ${utente.attivo ? '#fecaca' : '#bbf7d0'}`,
                          padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                          fontSize: 12, fontWeight: 600
                        }}
                      >
                        {utente.attivo ? 'Disattiva' : 'Attiva'}
                      </button>
                    ) : <span style={{ color: '#c9d1e0', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {puoGestire ? (
                      <button
                        onClick={() => apriModificaRuolo(utente)}
                        style={{ background: '#eef1f8', color: '#2c3e66', border: '1px solid #c3cde3', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        ✏️ Ruolo
                      </button>
                    ) : <span style={{ color: '#c9d1e0', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {utente.ruolo !== 'azienda' ? (
                      <button
                        onClick={() => apriAssegnazioneAziende(utente)}
                        style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        🏢{aziende.filter(a => a.assegnatoA === utente.id).length > 0 ? ` ${aziende.filter(a => a.assegnatoA === utente.id).length}` : ''}
                      </button>
                    ) : <span style={{ color: '#c9d1e0', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {puoGestire ? (
                      <button
                        onClick={() => setUtentePerElimina(utente)}
                        style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        🗑️
                      </button>
                    ) : <span style={{ color: '#c9d1e0', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostraModale && (
        <ModaleNuovoUtente
          onClose={() => setMostraModale(false)}
          onSave={() => setMostraModale(false)}
          aziende={aziende}
          puoCreareAdmin={utenteCorrente?.ruolo === 'admin'}
        />
      )}

      {utentePerElimina && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>🗑️ Elimina utente</h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#45536f' }}>
              Stai per eliminare <strong>{utentePerElimina.nome}</strong> ({utentePerElimina.email}).
            </p>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: '#dc2626', background: '#fff1f2', padding: '10px 14px', borderRadius: 8, border: '1px solid #fecdd3' }}>
              ⚠️ L'account verrà rimosso definitivamente e non potrà più accedere all'app.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setUtentePerElimina(null)}
                style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Annulla
              </button>
              <button
                onClick={eliminaUtente}
                style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {utentePerRuolo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>✏️ Modifica ruolo</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5f6f8c' }}>{utentePerRuolo.nome} — {utentePerRuolo.email}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Ruolo</label>
              <select
                value={nuovoRuolo}
                onChange={e => setNuovoRuolo(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 14 }}
              >
                {utenteCorrente?.ruolo === 'admin' && <option value="admin">Admin</option>}
                <option value="consulente">Consulente</option>
                <option value="operatore">Operatore</option>
                <option value="azienda">Azienda</option>
              </select>
            </div>

            {nuovoRuolo === 'azienda' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Azienda associata *</label>
                <select
                  value={nuovoAziendaId}
                  onChange={e => setNuovoAziendaId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 14 }}
                >
                  <option value="">-- Seleziona azienda --</option>
                  {aziende.map(az => (
                    <option key={az.id} value={az.id}>{az.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setUtentePerRuolo(null)}
                style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Annulla
              </button>
              <button
                onClick={salvaRuolo}
                style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#2c3e66', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ASSEGNAZIONE AZIENDE ── */}
      {utentePerAziende && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>🏢 Aziende assegnate</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5f6f8c' }}>{utentePerAziende.nome} — {utentePerAziende.ruolo}</p>

            {/* Cerca */}
            <input
              type="text"
              id="ricercaAziendeModal"
              placeholder="Cerca azienda..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
            />

            {/* Lista con scroll */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #dfe5ef', borderRadius: 8, marginBottom: 14 }}>
              {aziende.length === 0 && (
                <div style={{ padding: '20px 14px', fontSize: 13, color: '#9aa7bf', textAlign: 'center' }}>Nessuna azienda disponibile</div>
              )}
              {aziende.map(az => {
                const assegnata = aziendeTemp.includes(az.id);
                const downloadOn = downloadTemp.includes(az.id);
                const altroAssegnato = az.assegnatoA && az.assegnatoA !== utentePerAziende?.id;
                return (
                  <div key={az.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f6f8fc', background: assegnata ? '#f0fdf4' : altroAssegnato ? '#fffbeb' : 'white' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={assegnata}
                        onChange={() => toggleAziendaTemp(az.id)}
                        style={{ accentColor: '#10b981', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2540' }}>{az.nome}</div>
                        {az.comune && <div style={{ fontSize: 11, color: '#9aa7bf' }}>{[az.comune, az.provincia ? `(${az.provincia})` : ''].filter(Boolean).join(' ')}</div>}
                        {altroAssegnato && !assegnata && (
                          <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>👤 Assegnata a {az.assegnatoNome}</div>
                        )}
                      </div>
                    </label>
                    {assegnata && (
                      <button
                        onClick={() => toggleDownloadTemp(az.id)}
                        title="Abilita/disabilita download documenti"
                        style={{
                          flexShrink: 0,
                          background: downloadOn ? '#fef3c7' : '#eef1f7',
                          color: downloadOn ? '#92400e' : '#9aa7bf',
                          border: `1px solid ${downloadOn ? '#fde68a' : '#dfe5ef'}`,
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {downloadOn ? '📥 Download ✓' : '📥 Download'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#5f6f8c' }}>
                {aziendeTemp.length > 0 ? `${aziendeTemp.length} selezionat${aziendeTemp.length === 1 ? 'a' : 'e'}` : 'Nessuna selezionata'}
                {aziendeTemp.length > 0 && (
                  <button onClick={() => setAziendeTemp([])} style={{ border: 'none', background: 'none', color: '#9aa7bf', cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>Deseleziona tutto</button>
                )}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setUtentePerAziende(null)} style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}>
                  Annulla
                </button>
                <button onClick={salvaAziendeAssegnate} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog conflitto assegnazione azienda */}
      {confirmAssegna && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>⚠️ Azienda già assegnata</h3>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#45536f' }}>
              <strong>{confirmAssegna.az.nome}</strong> è già assegnata a <strong>{confirmAssegna.assegnatoNome}</strong>.
            </p>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#45536f' }}>
              Vuoi aggiungerla comunque alle aziende visibili da <strong>{utentePerAziende?.nome}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmAssegna(null)}
                style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Annulla
              </button>
              <button
                onClick={confermaAssegnaConflitto}
                style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Sì, aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModaleNuovoUtente({ onClose, onSave, aziende, puoCreareAdmin }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nome: '',
    ruolo: 'azienda',
    aziendaId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (campo, valore) => {
    setForm({ ...form, [campo]: valore });
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    // Validazione
    if (!form.email || !form.password || !form.nome || !form.ruolo) {
      setError('Tutti i campi obbligatori devono essere compilati');
      return;
    }

    if (form.password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return;
    }

    if (form.ruolo === 'azienda' && !form.aziendaId) {
      setError('Seleziona un\'azienda per questo utente');
      return;
    }

    setLoading(true);

    // App Firebase secondaria: evita che la creazione dell'utente disconnetta l'admin
    const secondaryApp = initializeApp(firebaseConfig, `user-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);

      await addDoc(collection(db, 'users'), {
        email: form.email,
        nome: form.nome,
        ruolo: form.ruolo,
        aziendaId: form.ruolo === 'azienda' ? form.aziendaId : '',
        attivo: true
      });

      toast.success('Utente creato con successo!');
      onSave();
    } catch (error) {
      console.error('Errore nella creazione utente:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Questa email è già registrata');
      } else if (error.code === 'auth/invalid-email') {
        setError('Email non valida');
      } else if (error.code === 'auth/weak-password') {
        setError('Password troppo debole');
      } else {
        setError('Errore nella creazione dell\'utente');
      }
    } finally {
      await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: 30,
        borderRadius: 12,
        width: '90%',
        maxWidth: 500
      }}>
        <h2 style={{ marginBottom: 20 }}>Crea Nuovo Utente</h2>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>
            Tipo Utente *
          </label>
          <select
            value={form.ruolo}
            onChange={(e) => handleChange('ruolo', e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #dfe5ef',
              borderRadius: 6,
              fontSize: 14
            }}
          >
            {puoCreareAdmin && <option value="admin">Admin</option>}
            <option value="azienda">Azienda</option>
            <option value="consulente">Consulente</option>
            <option value="operatore">Operatore</option>
          </select>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>
            Nome Completo *
          </label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="Mario Rossi"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #dfe5ef',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>
            Email *
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@esempio.com"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #dfe5ef',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>
            Password *
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="Minimo 6 caratteri"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #dfe5ef',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        {form.ruolo === 'azienda' && (
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>
              Azienda Associata *
            </label>
            <select
              value={form.aziendaId}
              onChange={(e) => handleChange('aziendaId', e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #dfe5ef',
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">-- Seleziona azienda --</option>
              {aziende.map(az => (
                <option key={az.id} value={az.id}>{az.nome}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 15,
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: '1px solid #dfe5ef',
              borderRadius: 8,
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 8,
              background: loading ? '#9aa7bf' : '#2c3e66',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Creazione...' : 'Crea Utente'}
          </button>
        </div>
      </div>
    </div>
  );
}



export default GestioneUtenti;