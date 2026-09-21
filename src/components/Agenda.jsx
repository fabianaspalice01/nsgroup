import { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import toast from "react-hot-toast";
import ModaleAppuntamento from './ModaleAppuntamento';
import ModalePreventivo from './ModalePreventivo';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

function Agenda({ appuntamenti, aziende, consulenti = [], onSaveAppuntamento, onDeleteAppuntamento, canDelete = true, userRole = 'admin', userData, listino = {}, serviziExtra = [], tuttiIServizi = [], checklistVoci = [] }) {
    const [mostraModale, setMostraModale] = useState(false);
    const [appuntamentoInModifica, setAppuntamentoInModifica] = useState(null);
    const [filtroStato, setFiltroStato] = useState('tutti');
    const [vistaCorrente, setVistaCorrente] = useState('lista'); // 'lista' | 'calendario'
    const [mostraModaleDrop, setMostraModaleDrop] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropCtx, setDropCtx] = useState(null);
    const [mostraPrecedenti, setMostraPrecedenti] = useState(false);
    const [mostraModalePreventivo, setMostraModalePreventivo] = useState(false);
    const [appuntamentoPerPreventivo, setAppuntamentoPerPreventivo] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [nuovoAppuntamentoDefaults, setNuovoAppuntamentoDefaults] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handler = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setVistaCorrente('lista');
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    // dropCtx = { info, id, prev, newDateYMD }

    const [dropOraMode, setDropOraMode] = useState('keep'); // 'keep' | 'set'
    const [dropOra, setDropOra] = useState('09:00');

    const formatDataLunga = (dataStr) => {
        const data = new Date(dataStr + 'T00:00:00');
        const opzioni = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return data.toLocaleDateString('it-IT', opzioni);
    };

    const formatDataCompleta = (ymd) => {
        const data = new Date(ymd + "T00:00:00");
        const s = data.toLocaleDateString("it-IT", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        return capitalizeFirst(s);
    };

    const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    const getBadgeStato = (stato) => {
        const map = {
            Programmato: { bg: '#d5ddee', color: '#1f2e4d' },
            Confermato: { bg: '#d1fae5', color: '#065f46' },
            Completato: { bg: '#dde3f0', color: '#16223b' },
            Disdetto: { bg: '#fee2e2', color: '#991b1b' }
        };
        return map[stato] || map.Programmato;
    };

    const getNomeCliente = (app) => {
        if (app.tipoCliente === 'registrato') {
            const azienda = aziende.find((az) => az.id === app.aziendaId);
            return azienda ? azienda.nome : 'Azienda non trovata';
        }
        return app.nuovoCliente?.nome || 'Nuovo cliente';
    };

    const getDettagliCliente = (app) => {
        if (app.tipoCliente === 'registrato') {
            const azienda = aziende.find((az) => az.id === app.aziendaId);
            return azienda ? `${azienda.contatto} • ${azienda.telefono}` : '';
        }
        return `${app.nuovoCliente?.contatto || 'N/D'} • ${app.nuovoCliente?.telefono || 'N/D'}`;
    };

    const getColoreStato = (stato) => {
        const colori = {
            Programmato: { bg: '#d5ddee', color: '#1f2e4d', border: '#93a7cc' },
            Confermato: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
            Completato: { bg: '#dde3f0', color: '#16223b', border: '#c3cde3' },
            Disdetto: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
        };
        return colori[stato] || colori.Programmato;
    };

    // ===== Helpers calendario =====
    const toYMD = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const toHM = (date) => {
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mi}`;
    };

    const isValidHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '').trim());

    const normalizeText = (value) =>
        String(value || '')
            .toLowerCase()
            .trim();

    // ===== Filtri + ordinamento =====
    const appuntamentiFiltrati = appuntamenti
        .filter((app) => (filtroStato === 'tutti' ? true : app.stato === filtroStato))
        .filter((app) => {
            const q = normalizeText(searchTerm);
            if (!q) return true;

            const nomeCliente = normalizeText(getNomeCliente(app));
            const dettagliCliente = normalizeText(getDettagliCliente(app));
            const consulente = normalizeText(app.consulente);
            const tipo = normalizeText(app.tipo);
            const stato = normalizeText(app.stato);
            const note = normalizeText(app.note);

            const dataIso = normalizeText(app.data);
            const dataFormattata = normalizeText(
                new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT')
            );
            const dataLunga = normalizeText(formatDataLunga(app.data));

            return (
                nomeCliente.includes(q) ||
                dettagliCliente.includes(q) ||
                consulente.includes(q) ||
                tipo.includes(q) ||
                stato.includes(q) ||
                note.includes(q) ||
                dataIso.includes(q) ||
                dataFormattata.includes(q) ||
                dataLunga.includes(q)
            );
        })
        .sort((a, b) => new Date(a.data + 'T' + a.ora) - new Date(b.data + 'T' + b.ora));

    // Raggruppa per data (per la lista)
    const appuntamentiPerData = {};
    appuntamentiFiltrati.forEach((app) => {
        if (!appuntamentiPerData[app.data]) appuntamentiPerData[app.data] = [];
        appuntamentiPerData[app.data].push(app);
    });

    const oggiYMD = toYMD(new Date());

    const tutteLeDate = Object.keys(appuntamentiPerData).sort();

    const datePrecedenti = tutteLeDate
        .filter((data) => data < oggiYMD)
        .sort((a, b) => b.localeCompare(a)); // le più recenti prima

    const dateOggi = tutteLeDate.filter((data) => data === oggiYMD);

    const dateSuccessive = tutteLeDate
        .filter((data) => data > oggiYMD)
        .sort((a, b) => a.localeCompare(b));

    const handleAddAppuntamento = () => {
        setAppuntamentoInModifica(null);
        setMostraModale(true);
    };

    const handleEditAppuntamento = (app) => {
        setAppuntamentoInModifica(app);
        setMostraModale(true);
    };

    const handleSave = (datiAppuntamento) => {
        // Se è un consulente che modifica, aggiungi il log
        if (userRole === 'consulente' && appuntamentoInModifica) {
            const modifiche = [];

            // Controlla cosa è stato modificato
            if (datiAppuntamento.data !== appuntamentoInModifica.data) {
                modifiche.push(`Data: ${appuntamentoInModifica.data} → ${datiAppuntamento.data}`);
            }
            if (datiAppuntamento.ora !== appuntamentoInModifica.ora) {
                modifiche.push(`Ora: ${appuntamentoInModifica.ora} → ${datiAppuntamento.ora}`);
            }
            if (datiAppuntamento.stato !== appuntamentoInModifica.stato) {
                modifiche.push(`Stato: ${appuntamentoInModifica.stato} → ${datiAppuntamento.stato}`);
            }

            if (modifiche.length > 0) {
                // Aggiungi il log delle modifiche
                const logModifica = {
                    timestamp: new Date().toISOString(),
                    consulente: userRole === 'consulente' ? datiAppuntamento.consulente : 'Admin',
                    modifiche: modifiche,
                    motivazione: datiAppuntamento.motivazioneModificaDataOra || ''
                };

                const logEsistente = appuntamentoInModifica.logModifiche || [];
                datiAppuntamento.logModifiche = [...logEsistente, logModifica];
            }
        }

        onSaveAppuntamento(appuntamentoInModifica?.id, datiAppuntamento);
        setMostraModale(false);
        setAppuntamentoInModifica(null);
    };

    const handleDelete = (id) => {
        setConfirm({
            message: 'Sei sicuro di voler eliminare questo appuntamento?',
            onConfirm: () => {
                setConfirm(null);
                onDeleteAppuntamento(id);
            }
        });
    };

    const handleCreaPreventivo = (app) => {
        setAppuntamentoPerPreventivo(app);
        setMostraModalePreventivo(true);
    };

    const handleSavePreventivo = async (datiPreventivo) => {
        try {
            const { pdfBlob, fileName, documentiDaAggiungere, docIdentitaCliente, isEdit: _isEdit, preventivoId: _preventivoId, ...datiPreventivoSenzaPdf } = datiPreventivo;

            // Auto-crea azienda se nuovo cliente
            let aziendaId = datiPreventivoSenzaPdf.aziendaId;
            if (datiPreventivoSenzaPdf.tipoCliente === 'nuovo' && datiPreventivoSenzaPdf.nuovoCliente?.nome) {
                const nuovaAziendaRef = await addDoc(collection(db, 'aziende'), {
                    nome: datiPreventivoSenzaPdf.nuovoCliente.nome,
                    indirizzo: datiPreventivoSenzaPdf.nuovoCliente.indirizzo || '',
                    telefono: datiPreventivoSenzaPdf.nuovoCliente.telefono || '',
                    email: datiPreventivoSenzaPdf.nuovoCliente.email || '',
                    partitaIva: datiPreventivoSenzaPdf.nuovoCliente.piva || '',
                    pec: datiPreventivoSenzaPdf.nuovoCliente.pec || '',
                    codiceUnivoco: datiPreventivoSenzaPdf.nuovoCliente.codiceUnivoco || '',
                    contatto: datiPreventivoSenzaPdf.nuovoCliente.contatto || '',
                    note: '',
                    controlli: [],
                    dipendenti: [],
                    documenti: [],
                    pagamenti: []
                });
                aziendaId = nuovaAziendaRef.id;
            }

            const timestamp = Date.now();
            const pdfPath = `preventivi/${timestamp}_${fileName}`;
            const storageRef = ref(storage, pdfPath);
            await uploadBytes(storageRef, pdfBlob);
            const pdfUrl = await getDownloadURL(storageRef);

            const serviziPuliti = (datiPreventivoSenzaPdf.servizi || []).map(s => {
                const { responsabileFile: _responsabileFile, responsabileFiles: _responsabileFiles, ...servizioSenzaFile } = s;
                return {
                    ...servizioSenzaFile,
                    dipendenti: (s.dipendenti || []).map(({ file: _file, files: _files, ...dipendenteSenzaFile }) => dipendenteSenzaFile)
                };
            });
            const preventivoCompleto = {
                ...datiPreventivoSenzaPdf,
                servizi: serviziPuliti,
                aziendaId,
                pdfUrl,
                pdfPath,
                dataCreazione: new Date().toISOString(),
                appuntamentoId: appuntamentoPerPreventivo?.id || null
            };

            await addDoc(collection(db, 'preventivi'), preventivoCompleto);

            // Salva documenti e aggiorna organigramma dipendenti
            if (aziendaId) {
                const aziendaCorrente = aziende.find(a => a.id === aziendaId);
                const documentiEsistenti = aziendaCorrente?.documenti || [];
                const dipendentiAggiornati = [...(aziendaCorrente?.dipendenti || [])];
                const nuoviDocumenti = [];
                let dipendentiModificati = false;

                // Documenti azienda (step 4)
                for (const docItem of (documentiDaAggiungere || [])) {
                    if (!docItem.file) continue;
                    const ts = Date.now();
                    const docPath = `documenti/${aziendaId}/${ts}_${docItem.file.name}`;
                    const docRef2 = ref(storage, docPath);
                    await uploadBytes(docRef2, docItem.file);
                    const docUrl = await getDownloadURL(docRef2);
                    nuoviDocumenti.push({
                        id: crypto.randomUUID(),
                        nome: docItem.nome || docItem.file.name,
                        tipo: docItem.tipo || 'Altro',
                        dataEmissione: '',
                        dataScadenza: docItem.dataScadenza || '',
                        numeroDocumento: '',
                        note: '',
                        pdfUrl: docUrl,
                        pdfPath: docPath
                    });
                }

                // Dipendenti per servizio (step 2)
                for (const servizio of (datiPreventivoSenzaPdf.servizi || [])) {
                    for (const dip of (servizio.dipendenti || [])) {
                        if (!dip.nome?.trim()) continue;
                        dipendentiModificati = true;

                        // Upload documento identità se presente
                        const filesDip = dip.files || (dip.file ? [dip.file] : []);
                        const nuoviAttestati = [];
                        for (const fileDip of filesDip) {
                            const ts = `${Date.now()}_${crypto.randomUUID()}`;
                            const docPath = `documenti/${aziendaId}/${ts}_${fileDip.name}`;
                            const dipRef = ref(storage, docPath);
                            await uploadBytes(dipRef, fileDip);
                            const docUrl = await getDownloadURL(dipRef);
                            nuoviDocumenti.push({
                                id: crypto.randomUUID(),
                                nome: `Doc. Identità - ${dip.nome}`,
                                tipo: 'Documento di Identità',
                                dataEmissione: '',
                                dataScadenza: '',
                                numeroDocumento: '',
                                note: `Servizio: ${servizio.descrizione}`,
                                pdfUrl: docUrl,
                                pdfPath: docPath
                            });
                            nuoviAttestati.push({
                                id: crypto.randomUUID(),
                                nome: 'Documento di Identità',
                                dataScadenza: '',
                                numeroAttestato: '',
                                pdfUrl: docUrl,
                                pdfPath: docPath
                            });
                        }

                        // Aggiungi/aggiorna nell'organigramma
                        const nomeParts = dip.nome.trim().split(' ');
                        const nomeDip = nomeParts[0] || '';
                        const cognomeDip = nomeParts.slice(1).join(' ') || '';
                        const nomeCompleto = dip.nome.trim().toLowerCase();
                        const idxEsistente = dipendentiAggiornati.findIndex(d =>
                            `${d.nome} ${d.cognome}`.toLowerCase().trim() === nomeCompleto
                        );
                        if (idxEsistente >= 0) {
                            if (nuoviAttestati.length) {
                                dipendentiAggiornati[idxEsistente] = {
                                    ...dipendentiAggiornati[idxEsistente],
                                    attestati: [...(dipendentiAggiornati[idxEsistente].attestati || []), ...nuoviAttestati]
                                };
                            }
                        } else {
                            dipendentiAggiornati.push({
                                id: crypto.randomUUID(),
                                nome: nomeDip,
                                cognome: cognomeDip,
                                mansione: '',
                                telefono: '',
                                email: '',
                                note: `Aggiunto da preventivo – ${servizio.descrizione}`,
                                attestati: nuoviAttestati
                            });
                        }
                    }
                }

                // Documento di identità cliente (step 5)
                if (docIdentitaCliente) {
                    const ts = Date.now();
                    const docPath = `documenti/${aziendaId}/${ts}_${docIdentitaCliente.name}`;
                    const docStorageRef = ref(storage, docPath);
                    await uploadBytes(docStorageRef, docIdentitaCliente);
                    const docUrl = await getDownloadURL(docStorageRef);
                    nuoviDocumenti.push({
                        id: crypto.randomUUID(),
                        nome: `Doc. Identità - ${datiPreventivoSenzaPdf.nomeCliente || 'Cliente'}`,
                        tipo: 'Documento di Identità',
                        dataEmissione: '',
                        dataScadenza: '',
                        numeroDocumento: '',
                        note: 'Documento di identità cliente — allegato al preventivo',
                        pdfUrl: docUrl,
                        pdfPath: docPath
                    });
                }

                const updatePayload = {};
                if (nuoviDocumenti.length > 0) updatePayload.documenti = [...documentiEsistenti, ...nuoviDocumenti];
                if (dipendentiModificati) updatePayload.dipendenti = dipendentiAggiornati;
                if (Object.keys(updatePayload).length > 0) {
                    await updateDoc(doc(db, 'aziende', aziendaId), updatePayload);
                }
            }

            toast.success('Preventivo generato e salvato!');

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.click();

            setMostraModalePreventivo(false);
            setAppuntamentoPerPreventivo(null);
        } catch (error) {
            console.error('Errore salvataggio preventivo:', error);
            toast.error('Errore nel salvataggio del preventivo');
        }
    };

    // Eventi per FullCalendar
    const eventi = appuntamentiFiltrati.map((app) => {
        const start = new Date(`${app.data}T${app.ora}`);
        const end = new Date(start.getTime() + Number(app.durata || 0) * 60 * 1000);

        return {
            id: String(app.id),
            title: `${getNomeCliente(app)} • ${app.tipo}`,
            start,
            end,
            classNames: [`evento-${String(app.stato || '').toLowerCase()}`],
            extendedProps: { ...app }
        };
    });

    const filtri = [
        { key: 'tutti', label: 'Tutti' },
        { key: 'Programmato', label: 'Programmati' },
        { key: 'Confermato', label: 'Confermati' },
        { key: 'Completato', label: 'Completati' },
        { key: 'Disdetto', label: 'Disdetti' }
    ];

    // ===== Drag & Drop (mese + week/day) =====
    const handleEventDrop = async (info) => {
        if (userRole === 'consulente') {
            info.revert();
            toast.error('Non puoi spostare appuntamenti trascinandoli. Usa il pulsante Modifica per cambiare data/ora e inserire la motivazione.');
            return;
        }
        try {
            const id = String(info.event.id);
            const viewType = info.view?.type;

            const start = info.event.start;
            const end = info.event.end;

            const prev = info.oldEvent?.extendedProps || info.event.extendedProps;

            // ✅ Se mese: apri modale e NON salvare subito
            if (viewType === 'dayGridMonth') {
                setDropCtx({
                    info,
                    id,
                    prev,
                    newDateYMD: toYMD(start),
                    // durata calcolata se serve (in month spesso end è null)
                    durataMin: end ? Math.round((end - start) / 60000) : Number(prev.durata || 60),
                });

                setDropOraMode('keep');
                setDropOra(prev.ora || '09:00');
                setMostraModaleDrop(true);
                return;
            }

            // ✅ Week/Day: salva subito
            const oraFinale = toHM(start);
            const durataMin = end ? Math.round((end - start) / 60000) : Number(prev.durata || 60);

            await onSaveAppuntamento(id, {
                ...prev,
                ...info.event.extendedProps,
                data: toYMD(start),
                ora: oraFinale,
                durata: durataMin
            });
        } catch (e) {
            console.error('Errore drag&drop:', e);
            info.revert();
            toast.error("Errore nello spostamento dell'appuntamento");
        }
    };

    const annullaDrop = () => {
        try {
            dropCtx?.info?.revert?.();
        } finally {
            setMostraModaleDrop(false);
            setDropCtx(null);
        }
    };

    const confermaDrop = async () => {
        if (!dropCtx) return;

        const { info, id, prev, newDateYMD, durataMin } = dropCtx;

        const oraFinale = dropOraMode === 'keep' ? (prev.ora || '09:00') : dropOra;

        // validazione ora
        if (dropOraMode === 'set' && !isValidHHMM(oraFinale)) {
            toast.error('Formato ora non valido. Usa HH:MM (es. 14:30)');
            return;
        }

        try {
            await onSaveAppuntamento(id, {
                ...prev,
                ...info.event.extendedProps,
                data: newDateYMD,
                ora: oraFinale,
                durata: Number(durataMin || prev.durata || 60)
            });

            setMostraModaleDrop(false);
            setDropCtx(null);
        } catch (e) {
            console.error('Errore salvataggio drop month:', e);
            info.revert();
            setMostraModaleDrop(false);
            setDropCtx(null);
            toast.error("Errore nel salvataggio dello spostamento");
        }
    };

    const handleEventResize = async (info) => {
        try {
            const id = String(info.event.id);
            const start = info.event.start;
            const end = info.event.end;

            const prev = info.event.extendedProps;
            const durataMin = end ? Math.round((end - start) / 60000) : Number(prev.durata || 60);

            await onSaveAppuntamento(id, {
                ...prev,
                data: toYMD(start),
                ora: toHM(start),
                durata: durataMin
            });
        } catch (e) {
            console.error('Errore resize:', e);
            info.revert();
            toast.error('Errore nel cambio durata dell’appuntamento');
        }
    };

    const renderCard = (app) => {
        const colore = getColoreStato(app.stato);
        const opacity = app.stato === 'Completato' || app.stato === 'Disdetto' ? 0.72 : 1;

        if (isMobile) {
            return (
                <div key={app.id} style={{ background: 'white', borderRadius: 12, border: `2px solid ${colore.border}`, overflow: 'hidden', opacity }}>
                    {/* Fascia ora + stato */}
                    <div style={{ background: colore.bg, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: colore.color }}>{app.ora}</span>
                            <span style={{ fontSize: 11, color: colore.color }}>{app.durata} min</span>
                        </div>
                        <span style={{ background: 'white', color: colore.color, border: `1px solid ${colore.border}`, borderRadius: 10, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>
                            {app.stato.toUpperCase()}
                        </span>
                    </div>

                    {/* Contenuto */}
                    <div style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2540' }}>{getNomeCliente(app)}</span>
                            {app.tipoCliente === 'nuovo' && (
                                <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>NUOVO</span>
                            )}
                        </div>

                        <div style={{ fontSize: 12, color: '#5f6f8c', marginBottom: 6 }}>{getDettagliCliente(app)}</div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: app.note ? 6 : 0 }}>
                            <span style={{ fontSize: 12, color: '#4a68a0', fontWeight: 600 }}>📋 {app.tipo}</span>
                            {app.consulente && <span style={{ fontSize: 12, color: '#5f6f8c' }}>👤 {app.consulente}</span>}
                        </div>

                        {app.note && <p style={{ fontSize: 12, color: '#9aa7bf', margin: '4px 0 0', fontStyle: 'italic' }}>{app.note}</p>}

                        {app.stato === 'Disdetto' && app.motivazioneDisdetta && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>Motivo disdetta:</div>
                                <div style={{ fontSize: 11, color: '#991b1b' }}>{app.motivazioneDisdetta}</div>
                            </div>
                        )}

                        {userRole === 'admin' && app.logModifiche?.length > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: '#eef1f8', borderRadius: 6, border: '1px solid #c3cde3' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#2c3e66', marginBottom: 4 }}>📋 Storico modifiche</div>
                                {app.logModifiche.map((log, idx) => (
                                    <div key={idx} style={{ fontSize: 10, color: '#16223b', paddingLeft: 6, borderLeft: '2px solid #4a68a0', marginBottom: 4 }}>
                                        <div style={{ fontWeight: 700 }}>
                                            {new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — {log.consulente}
                                        </div>
                                        {log.modifiche.map((mod, i) => <div key={i}>• {mod}</div>)}
                                        {log.motivazione && <div style={{ fontStyle: 'italic' }}>💬 {log.motivazione}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Azioni in fondo */}
                    <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #eef1f7' }}>
                        <button onClick={() => handleCreaPreventivo(app)} style={{ flex: 1, background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                            📋 Preventivo
                        </button>
                        <button onClick={() => handleEditAppuntamento(app)} style={{ flex: 1, background: '#eef1f8', border: '1px solid #d5ddee', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, color: '#34508a', fontWeight: 700 }}>
                            ✏️ Modifica
                        </button>
                        {canDelete && (
                            <button onClick={() => handleDelete(app.id)} style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                                🗑️
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        /* Desktop */
        return (
            <div key={app.id} style={{ background: 'white', padding: 16, borderRadius: 12, border: `2px solid ${colore.border}`, display: 'flex', gap: 16, alignItems: 'flex-start', opacity }}>
                <div style={{ minWidth: 70, textAlign: 'center', padding: '8px 12px', background: colore.bg, borderRadius: 8, border: `1px solid ${colore.border}` }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: colore.color }}>{app.ora}</div>
                    <div style={{ fontSize: 11, color: colore.color, marginTop: 2 }}>{app.durata} min</div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2540' }}>{getNomeCliente(app)}</h4>
                        {app.tipoCliente === 'nuovo' && (
                            <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>NUOVO</span>
                        )}
                    </div>
                    <div style={{ fontSize: 13, color: '#5f6f8c', marginBottom: 6 }}>{getDettagliCliente(app)}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#4a68a0', fontWeight: 600 }}>📋 {app.tipo}</span>
                        {app.consulente && <span style={{ fontSize: 13, color: '#5f6f8c' }}>👤 {app.consulente}</span>}
                    </div>
                    {app.note && <p style={{ fontSize: 13, color: '#9aa7bf', margin: '6px 0 0', fontStyle: 'italic' }}>{app.note}</p>}
                    {app.stato === 'Disdetto' && app.motivazioneDisdetta && (
                        <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Motivo disdetta:</div>
                            <div style={{ fontSize: 12, color: '#991b1b' }}>{app.motivazioneDisdetta}</div>
                        </div>
                    )}
                    {userRole === 'admin' && app.logModifiche?.length > 0 && (
                        <div style={{ marginTop: 8, padding: 10, background: '#eef1f8', borderRadius: 6, border: '1px solid #c3cde3' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#2c3e66', marginBottom: 6 }}>📋 Storico Modifiche:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {app.logModifiche.map((log, idx) => (
                                    <div key={idx} style={{ fontSize: 11, color: '#16223b', paddingLeft: 8, borderLeft: '2px solid #4a68a0' }}>
                                        <div style={{ fontWeight: 600 }}>
                                            {new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} - {log.consulente}
                                        </div>
                                        {log.modifiche.map((mod, i) => <div key={i}>• {mod}</div>)}
                                        {log.motivazione && <div style={{ fontStyle: 'italic', marginTop: 2 }}>💬 {log.motivazione}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ background: colore.bg, color: colore.color, padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                        {app.stato.toUpperCase()}
                    </span>
                    <button onClick={() => handleCreaPreventivo(app)} style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>📋</button>
                    <button onClick={() => handleEditAppuntamento(app)} style={{ background: '#eef1f8', border: '1px solid #d5ddee', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#34508a', fontWeight: 'bold' }}>✏️</button>
                    {canDelete && (
                        <button onClick={() => handleDelete(app.id)} style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>🗑️</button>
                    )}
                </div>
            </div>
        );
    };

    const renderGiorno = (data) => (
        <div key={data}>
            <h3 style={{ margin: '0 0 12px', fontSize: isMobile ? 14 : 16, color: data === oggiYMD ? '#1f2e4d' : '#1a2540', fontWeight: 700, textTransform: 'capitalize' }}>
                {data === oggiYMD ? `Oggi • ${formatDataLunga(data)}` : formatDataLunga(data)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {appuntamentiPerData[data].map((app) => renderCard(app))}
            </div>
        </div>
    );

    return (
        <div>
            {confirm && (
                <ConfirmModal
                    message={confirm.message}
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                    danger
                />
            )}
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: isMobile ? 10 : 0 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, color: '#1a2540', fontWeight: 700 }}>📅 Agenda</h2>
                        {!isMobile && <p style={{ margin: '4px 0 0', color: '#5f6f8c', fontSize: 13 }}>{appuntamenti.length} appuntamenti totali</p>}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isMobile && (
                            <>
                                <button onClick={() => setVistaCorrente('lista')} style={{ padding: '10px 14px', borderRadius: 8, border: vistaCorrente === 'lista' ? 'none' : '1.5px solid #dfe5ef', background: vistaCorrente === 'lista' ? '#101a2e' : '#fff', color: vistaCorrente === 'lista' ? '#fff' : '#45536f', cursor: 'pointer', fontWeight: 700 }}>
                                    📋 Lista
                                </button>
                                <button onClick={() => setVistaCorrente('calendario')} style={{ padding: '10px 14px', borderRadius: 8, border: vistaCorrente === 'calendario' ? 'none' : '1.5px solid #dfe5ef', background: vistaCorrente === 'calendario' ? '#101a2e' : '#fff', color: vistaCorrente === 'calendario' ? '#fff' : '#45536f', cursor: 'pointer', fontWeight: 700 }}>
                                    🗓️ Calendario
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => { setAppuntamentoPerPreventivo(null); setMostraModalePreventivo(true); }}
                            style={{ padding: isMobile ? '9px 12px' : '10px 20px', border: '2px solid #10b981', borderRadius: 8, background: 'white', color: '#10b981', cursor: 'pointer', fontSize: isMobile ? 13 : 14, fontWeight: 'bold' }}
                        >
                            {isMobile ? '📋 Preventivo' : '📋 Nuovo Preventivo'}
                        </button>
                        <button
                            onClick={handleAddAppuntamento}
                            style={{ padding: isMobile ? '9px 12px' : '10px 20px', border: 'none', borderRadius: 8, background: '#2c3e66', color: 'white', cursor: 'pointer', fontSize: isMobile ? 13 : 14, fontWeight: 'bold' }}
                        >
                            {isMobile ? '+ Appuntamento' : '+ Nuovo Appuntamento'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Filtri */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 2 : 0 }}>
                {filtri.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFiltroStato(f.key)}
                        style={{
                            padding: '6px 14px', flexShrink: 0,
                            border: filtroStato === f.key ? 'none' : '1.5px solid #dfe5ef',
                            borderRadius: 20,
                            background: filtroStato === f.key ? '#2c3e66' : '#fff',
                            color: filtroStato === f.key ? '#fff' : '#45536f',
                            cursor: 'pointer', fontSize: 13, fontWeight: 600
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Cerca */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#5f6f8c' }}>🔍</span>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cerca..."
                    style={{
                        flex: 1,
                        maxWidth: isMobile ? '100%' : 240,
                        padding: '7px 10px', borderRadius: 8,
                        border: searchTerm ? '1.5px solid #2c3e66' : '1.5px solid #dfe5ef',
                        boxShadow: searchTerm ? '0 0 0 3px rgba(44,62,102,0.10)' : 'none',
                        fontSize: 13, outline: 'none', background: '#fff'
                    }}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#9aa7bf' }}>✕</button>
                )}
            </div>

            {vistaCorrente === 'calendario' ? (
                <div style={{ background: 'white', borderRadius: 12, padding: isMobile ? 4 : 12, overflowX: 'auto' }}>
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={isMobile ? {
                            left: 'prev,next',
                            center: 'title',
                            right: 'today'
                        } : {
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        locale="it"
                        height="auto"
                        selectable
                        selectMirror
                        nowIndicator
                        events={eventi}
                        editable={userRole !== 'consulente'}
                        eventStartEditable={userRole !== 'consulente'}
                        eventDurationEditable={userRole !== 'consulente'}
                        eventClick={(info) => {
                            handleEditAppuntamento({ id: info.event.id, ...info.event.extendedProps });
                        }}
                        eventDrop={handleEventDrop}
                        eventResize={handleEventResize}
                        select={(selection) => {
                            const start = selection.start;

                            const yyyy = start.getFullYear();
                            const mm = String(start.getMonth() + 1).padStart(2, '0');
                            const dd = String(start.getDate()).padStart(2, '0');
                            const hh = String(start.getHours()).padStart(2, '0');
                            const mi = String(start.getMinutes()).padStart(2, '0');

                            setAppuntamentoInModifica(null);
                            setNuovoAppuntamentoDefaults({
                                data: `${yyyy}-${mm}-${dd}`,
                                ora: `${hh}:${mi}`
                            });
                            setMostraModale(true);
                        }}
                    />
                </div>
            ) : (
                // LISTA
                appuntamentiFiltrati.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9aa7bf', padding: 40, background: 'white', borderRadius: 12, fontSize: 14 }}>
                        Nessun appuntamento trovato
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Giorni precedenti */}
                            {datePrecedenti.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setMostraPrecedenti(!mostraPrecedenti)}
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1px solid #dfe5ef',
                                            background: '#f6f8fc',
                                            color: '#34405c',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: 13
                                        }}
                                    >
                                        {mostraPrecedenti
                                            ? '🔽 Nascondi giorni precedenti'
                                            : `▶️ Mostra giorni precedenti (${datePrecedenti.length})`}
                                    </button>

                                    {mostraPrecedenti && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                                            {datePrecedenti.map(renderGiorno)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Oggi */}
                            {dateOggi.length > 0 && dateOggi.map(renderGiorno)}

                            {/* Se oggi non ha appuntamenti */}
                            {dateOggi.length === 0 && (
                                <div
                                    style={{
                                        background: '#eef1f8',
                                        border: '1px solid #c3cde3',
                                        color: '#1f2e4d',
                                        borderRadius: 12,
                                        padding: 16,
                                        fontWeight: 600
                                    }}
                                >
                                    Nessun appuntamento per oggi
                                </div>
                            )}

                            {/* Giorni successivi */}
                            {dateSuccessive.map(renderGiorno)}
                        </div>
                    </div>
                )
            )}

            {mostraModaleDrop && dropCtx && (
                <div
                    className="drop-backdrop"
                    onClick={annullaDrop}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',  // leggermente più soft
                        backdropFilter: 'blur(3px)',   // ✅ BONUS PROFESSIONALE
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200
                    }}
                >
                    <div
                        className="drop-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '92%',
                            maxWidth: 440,
                            background: 'white',
                            borderRadius: 16,
                            padding: 18,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                            border: '1px solid #dfe5ef'
                        }}
                    >
                        {/* HEADER */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 12,
                                            display: 'grid',
                                            placeItems: 'center',
                                            background: '#eef1f7',
                                            border: '1px solid #dfe5ef'
                                        }}
                                    >
                                        📅
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: '#101a2e' }}>Sposta appuntamento</div>
                                </div>

                                <div style={{ marginTop: 8, fontSize: 13, color: '#5f6f8c' }}>
                                    <b style={{ color: '#101a2e' }}>{getNomeCliente(dropCtx.prev || {})}</b>
                                    {dropCtx.prev?.tipo ? ` • ${dropCtx.prev.tipo}` : ''}
                                </div>
                            </div>

                            {(() => {
                                const stato = dropCtx.prev?.stato || 'Programmato';
                                const badge = getBadgeStato(stato);
                                return (
                                    <span
                                        style={{
                                            background: badge.bg,
                                            color: badge.color,
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 900,
                                            border: '1px solid #dfe5ef',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {String(stato).toUpperCase()}
                                    </span>
                                );
                            })()}
                        </div>

                        {/* DATA */}
                        <div
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                background: '#f6f8fc',
                                border: '1px solid #dfe5ef',
                                fontSize: 13,
                                color: '#34405c'
                            }}
                        >
                            Nuova data:{' '}
                            <b style={{ color: '#101a2e' }}>{formatDataCompleta(dropCtx.newDateYMD)}</b>
                        </div>

                        {/* ORA: KEEP / SET */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 12 }}>
                            <button
                                type="button"
                                onClick={() => setDropOraMode('keep')}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    border: dropOraMode === 'keep' ? '2px solid #101a2e' : '1px solid #dfe5ef',
                                    background: dropOraMode === 'keep' ? '#101a2e' : 'white',
                                    color: dropOraMode === 'keep' ? 'white' : '#101a2e',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                Mantieni ora ({dropCtx.prev?.ora || '09:00'})
                            </button>

                            <button
                                type="button"
                                onClick={() => setDropOraMode('set')}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    border: dropOraMode === 'set' ? '2px solid #101a2e' : '1px solid #dfe5ef',
                                    background: dropOraMode === 'set' ? '#101a2e' : 'white',
                                    color: dropOraMode === 'set' ? 'white' : '#101a2e',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                Cambia ora
                            </button>
                        </div>

                        {dropOraMode === 'set' && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: 12, color: '#5f6f8c', fontWeight: 800, marginBottom: 6 }}>
                                    Nuova ora
                                </label>
                                <input
                                    type="time"
                                    value={dropOra}
                                    onChange={(e) => setDropOra(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid #dfe5ef',
                                        fontWeight: 800
                                    }}
                                />
                            </div>
                        )}

                        {/* AZIONI */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={annullaDrop}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: '1px solid #dfe5ef',
                                    background: 'white',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                Annulla
                            </button>

                            <button
                                type="button"
                                onClick={confermaDrop}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: '#2c3e66',
                                    color: 'white',
                                    fontWeight: 950,
                                    cursor: 'pointer'
                                }}
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mostraModale && (
                <ModaleAppuntamento
                    appuntamento={appuntamentoInModifica}
                    defaultValues={nuovoAppuntamentoDefaults}
                    onClose={() => {
                        setMostraModale(false);
                        setAppuntamentoInModifica(null);
                        setNuovoAppuntamentoDefaults(null);
                    }}
                    onSave={handleSave}
                    aziende={aziende}
                    consulenti={consulenti}
                    userRole={userRole}
                />
            )}
            {mostraModalePreventivo && (
                <ModalePreventivo
                    onClose={() => {
                        setMostraModalePreventivo(false);
                        setAppuntamentoPerPreventivo(null);
                    }}
                    onSave={handleSavePreventivo}
                    aziende={aziende}
                    appuntamento={appuntamentoPerPreventivo}
                    userData={userData}
                    listino={listino}
                    serviziExtra={serviziExtra}
                    tuttiIServizi={tuttiIServizi}
                    checklistVoci={checklistVoci}
                />
            )}
        </div>
    );
}

export default Agenda;
