import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const chiama = (dati) => httpsCallable(functions, 'googleCalendar', { timeout: 540000 })(dati).then((r) => r.data);

const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sezione = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 14 };
const titoloSezione = { margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: 'var(--ink)' };
const input = { width: '100%', padding: 8, border: '1px solid var(--line)', borderRadius: 6, fontSize: 14, background: 'white' };
const bottone = (attivo = true) => ({
    padding: '9px 16px', border: 'none', borderRadius: 8, background: attivo ? 'var(--primary)' : 'var(--ink-muted)',
    color: 'white', cursor: attivo ? 'pointer' : 'default', fontSize: 13, fontWeight: 700
});

function ModaleGoogleCalendar({ onClose }) {
    const [stato, setStato] = useState(null);
    const [calendarId, setCalendarId] = useState('');
    const [attivo, setAttivo] = useState(true);
    const [occupato, setOccupato] = useState('');
    const oggi = new Date();
    const [dal, setDal] = useState(`${oggi.getFullYear() - 1}-01-01`);
    const [al, setAl] = useState(toYMD(oggi));
    const [esito, setEsito] = useState(null);

    useEffect(() => {
        chiama({ azione: 'stato' })
            .then((s) => { setStato(s); setCalendarId(s.calendarId); if (s.calendarId) setAttivo(s.attivo); })
            .catch((e) => { toast.error(e.message); setStato({}); });
    }, []);

    const esegui = async (azione, dati, messaggioOk) => {
        setOccupato(azione);
        setEsito(null);
        try {
            const r = await chiama({ azione, ...dati });
            toast.success(messaggioOk(r));
            return r;
        } catch (e) {
            toast.error(e.message);
            return null;
        } finally {
            setOccupato('');
        }
    };

    const salva = async () => {
        const r = await esegui('salva', { calendarId, attivo }, (x) => `Collegato a «${x.nome}»`);
        if (r) setStato((s) => ({ ...s, calendarId: calendarId.trim(), attivo }));
    };

    const esporta = async () => {
        const r = await esegui('esporta', {}, (x) => `${x.inviati} appuntamenti inviati a Google`);
        if (r) setEsito(`Inviati: ${r.inviati} · già allineati: ${r.invariati}${r.errori ? ` · errori: ${r.errori}` : ''}`);
    };

    const importa = async () => {
        if (!dal || !al || dal > al) { toast.error('Intervallo di date non valido'); return; }
        const r = await esegui('importa', { dal, al }, (x) => `${x.importati} eventi importati`);
        if (r) {
            setEsito(`Importati: ${r.importati} · già presenti: ${r.giaPresenti} · creati dall'app (saltati): ${r.creatiDallApp}`);
            setStato((s) => ({ ...s, ultimaImportazione: { il: new Date().toISOString(), dal, al, ...r } }));
        }
    };

    const copia = () => {
        navigator.clipboard?.writeText(stato.serviceAccount).then(() => toast.success('Indirizzo copiato'));
    };

    const collegato = !!stato?.calendarId;
    const ultima = stato?.ultimaImportazione;

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', padding: 24, borderRadius: 12, width: '92%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 20, color: 'var(--ink)' }}>🔗 Google Calendar</h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--ink-muted)' }}>✕</button>
                </div>

                {!stato ? (
                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-muted)' }}>Caricamento…</div>
                ) : (
                    <>
                        {/* 1. Condivisione */}
                        <div style={sezione}>
                            <h4 style={titoloSezione}>1. Condividi il calendario</h4>
                            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                                In Google Calendar apri <b>Impostazioni e condivisione</b> del calendario → <b>Condividi con persone specifiche</b> →
                                aggiungi questo indirizzo con il permesso <b>«Apportare modifiche agli eventi»</b>:
                            </p>
                            {stato.serviceAccount ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <code style={{ flex: 1, padding: 8, background: 'white', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{stato.serviceAccount}</code>
                                    <button onClick={copia} style={bottone()}>Copia</button>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--danger)' }}>Indirizzo dell'account di servizio non disponibile: verifica che le Cloud Functions siano pubblicate.</div>
                            )}
                        </div>

                        {/* 2. Calendario */}
                        <div style={sezione}>
                            <h4 style={titoloSezione}>2. Collega il calendario</h4>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>ID calendario</label>
                            <input value={calendarId} onChange={(e) => setCalendarId(e.target.value)} placeholder="es. nome@gmail.com" style={input} />
                            <p style={{ margin: '4px 0 10px', fontSize: 11, color: 'var(--ink-muted)' }}>
                                Per il calendario principale è l'indirizzo Gmail; per gli altri si trova in «Integra calendario».
                            </p>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
                                Invia automaticamente a Google gli appuntamenti creati, modificati o eliminati in agenda
                            </label>
                            <button onClick={salva} disabled={!!occupato || !calendarId.trim()} style={bottone(!occupato && !!calendarId.trim())}>
                                {occupato === 'salva' ? 'Verifica in corso…' : 'Salva e verifica'}
                            </button>
                            {collegato && (
                                <span style={{ marginLeft: 10, fontSize: 12, color: stato.attivo ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                                    {stato.attivo ? '● Sincronizzazione attiva' : '● Collegato, sincronizzazione sospesa'}
                                </span>
                            )}
                        </div>

                        {/* 3. Importazione storico */}
                        <div style={{ ...sezione, opacity: collegato ? 1 : 0.5 }}>
                            <h4 style={titoloSezione}>3. Importa lo storico da Google</h4>
                            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                                Gli eventi del periodo diventano appuntamenti (tipo «Da Google Calendar»). Se il titolo contiene il nome di
                                un'azienda vengono collegati a quell'azienda. Gli eventi già importati non vengono duplicati.
                            </p>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                <label style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600 }}>
                                    Dal <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} style={{ ...input, marginTop: 4 }} />
                                </label>
                                <label style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600 }}>
                                    Al <input type="date" value={al} onChange={(e) => setAl(e.target.value)} style={{ ...input, marginTop: 4 }} />
                                </label>
                            </div>
                            <button onClick={importa} disabled={!collegato || !!occupato} style={bottone(collegato && !occupato)}>
                                {occupato === 'importa' ? 'Importazione in corso…' : '⬇️ Importa eventi'}
                            </button>
                            {ultima && (
                                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-muted)' }}>
                                    Ultima importazione: {new Date(ultima.il).toLocaleString('it-IT')} ({ultima.dal.split('-').reverse().join('/')} – {ultima.al.split('-').reverse().join('/')}), {ultima.importati} eventi
                                </p>
                            )}
                        </div>

                        {/* 4. Esportazione */}
                        <div style={{ ...sezione, opacity: collegato ? 1 : 0.5, marginBottom: 0 }}>
                            <h4 style={titoloSezione}>4. Invia a Google gli appuntamenti esistenti</h4>
                            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-muted)' }}>
                                Da fare una volta dopo il collegamento: copia su Google gli appuntamenti già presenti in agenda.
                            </p>
                            <button onClick={esporta} disabled={!collegato || !!occupato} style={bottone(collegato && !occupato)}>
                                {occupato === 'esporta' ? 'Invio in corso…' : '⬆️ Invia appuntamenti'}
                            </button>
                        </div>

                        {esito && (
                            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--success-soft)', border: '1px solid #6ee7b7', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                                {esito}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default ModaleGoogleCalendar;
