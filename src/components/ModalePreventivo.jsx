import { useState, useRef, useEffect, Fragment } from 'react';
import DropZone from './DropZone';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';

const SERVIZI_PREDEFINITI = [
    'DVR (documentazione di valutazione dei rischi)',
    'Att. RSPP (responsabile prevenzione e protezione)',
    'Att. RLS (rappresentante dei lavoratori)',
    'Att. PREPOSTO (preposto per la sicurezza)',
    'Att. ANTINCENDIO (prevenzione incendio)',
    'Att. PRIMO SOCCORSO (addetto I soccorso)',
    'Att. FORMAZIONE&INFORMAZIONE',
    'Att. FORMAZIONE COVID-19',
    'NOMINA MEDICO COMPETENTE',
    'VISITE MEDICHE (sorveglianza medico sanitaria)',
    'HACCP (manuale di autocontrollo)',
    'Att. ALIMENTARISTA lv 1',
    'Att. ALIMENTARISTA lv 2',
    'Att. ALIMENTARISTA lv 3',
    'FORNITURA MATERIALE ANTINCENDIO',
];

const DEFAULT_CHECKLIST = ['SCIA', 'Impianto elettrico', 'Impianto antincendio', 'Cassetta medica', 'Impianto gas'];

// Ridisegna una foto su canvas e la riesporta come JPEG: normalizza il formato
// (le foto da fotocamera/galleria su mobile possono avere MIME non affidabile o
// essere in HEIC) e riduce il peso, evitando crash per memoria su tablet/telefono.
const fileToJpegBytes = (file, maxDim = 1600, quality = 0.75) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        try {
            let { width, height } = img;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            width = Math.round(width * scale) || 1;
            height = Math.round(height * scale) || 1;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('Impossibile elaborare la foto')); return; }
                blob.arrayBuffer().then(resolve).catch(reject);
            }, 'image/jpeg', quality);
        } catch (e) {
            reject(e);
        } finally {
            URL.revokeObjectURL(url);
        }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato foto non supportato dal browser')); };
    img.src = url;
});

const validaPartitaIva = (piva) => {
    const p = piva.replace(/\s/g, '');
    if (!/^\d{11}$/.test(p)) return false;
    if (/^(\d)\1{10}$/.test(p)) return false; // tutte cifre uguali (es. 00000000000)
    let s = 0;
    for (let i = 0; i < 10; i++) {
        const n = parseInt(p[i]);
        if (i % 2 === 0) {
            s += n;
        } else {
            const d = n * 2;
            s += d >= 10 ? d - 9 : d;
        }
    }
    return (10 - (s % 10)) % 10 === parseInt(p[10]);
};

async function cercaComuni(q) {
    if (q.length < 2) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)},Italia&countrycodes=it&addressdetails=1&limit=7`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
    const data = await res.json();
    return data.filter(r => r.address && (r.address.city || r.address.town || r.address.village || r.address.municipality));
}

function ModalePreventivo({ onClose, onSave, aziende, appuntamento, userData, preventivoInModifica, listino = {}, serviziExtra = [], tuttiIServizi = [], checklistVoci = [] }) {
    const isEdit = !!preventivoInModifica;
    const isAdmin = userData?.ruolo === 'admin';
    const prezzoBloccato = userData?.ruolo === 'consulente';
    const bozzaKey = `nsgroup:preventivo-bozza:${userData?.uid || userData?.email || userData?.nome || 'utente'}:${appuntamento?.id || 'libero'}`;
    const [bozzaIniziale] = useState(() => {
        if (isEdit) return null;
        try {
            return JSON.parse(localStorage.getItem(bozzaKey));
        } catch {
            return null;
        }
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [step, setStep] = useState(bozzaIniziale?.step || 1); // 1=dati, 2=servizi, 3=pagamento, 4=documenti, 5=firma
    const [tipoCliente, setTipoCliente] = useState(
        bozzaIniziale?.tipoCliente || preventivoInModifica?.tipoCliente || (appuntamento?.aziendaId ? 'registrato' : 'nuovo')
    );
    const [ricercaAzienda, setRicercaAzienda] = useState('');
    const tipoDocumento = 'preventivo';
    const [documentiDaAggiungere, setDocumentiDaAggiungere] = useState([]);

    const listaBase = tuttiIServizi.length > 0
        ? tuttiIServizi
        : [...SERVIZI_PREDEFINITI, ...serviziExtra.filter(d => !SERVIZI_PREDEFINITI.includes(d))];

    const serviziIniziali = preventivoInModifica?.servizi
        ? (() => {
            const prevServizi = preventivoInModifica.servizi.map(s => ({
                ...s,
                responsabileFiles: [],
                prezzoUnitario: listino[s.descrizione] > 0 && (prezzoBloccato || !s.prezzoUnitario)
                    ? String(listino[s.descrizione])
                    : s.prezzoUnitario,
                dipendenti: (s.dipendenti || []).map(d => ({ ...d, file: null, files: [] }))
            }));
            const listaSet = new Set(listaBase);
            const custom = prevServizi.filter(s => s.custom);
            const nonCustom = prevServizi.filter(s => !s.custom && listaSet.has(s.descrizione));
            const byDesc = Object.fromEntries(nonCustom.map(s => [s.descrizione, s]));
            const ordinati = listaBase.map((desc, i) =>
                byDesc[desc] || {
                    id: i + 1, descrizione: desc, quantita: '',
                    prezzoUnitario: listino[desc] > 0 ? String(listino[desc]) : '',
                    custom: false, dipendenti: []
                }
            );
            return [...ordinati, ...custom];
          })()
        : [
            ...listaBase.map((desc, i) => {
                const prezzoListino = listino[desc];
                return {
                    id: i + 1, descrizione: desc, quantita: '',
                    prezzoUnitario: prezzoListino > 0 ? String(prezzoListino) : '',
                    custom: false, dipendenti: []
                };
            }),
            { id: 201, descrizione: '', quantita: '', prezzoUnitario: '', custom: true, dipendenti: [] },
            { id: 202, descrizione: '', quantita: '', prezzoUnitario: '', custom: true, dipendenti: [] },
            { id: 203, descrizione: '', quantita: '', prezzoUnitario: '', custom: true, dipendenti: [] },
          ];

    const formIniziale = {
        aziendaId: preventivoInModifica?.aziendaId || appuntamento?.aziendaId || '',
        nuovoCliente: preventivoInModifica?.nuovoCliente || {
            nome: appuntamento?.nuovoCliente?.nome || '',
            indirizzo: appuntamento?.nuovoCliente?.indirizzo || '',
            comune: '',
            provincia: '',
            cap: '',
            telefono: appuntamento?.nuovoCliente?.telefono || '',
            email: '',
            piva: '',
            pec: '',
            codiceUnivoco: '',
            contatto: ''
        },
        data: preventivoInModifica?.data || appuntamento?.data || new Date().toISOString().split('T')[0],
        consulente: preventivoInModifica?.consulente || appuntamento?.consulente || userData?.nome || '',
        servizi: serviziIniziali,
        sconto: preventivoInModifica?.sconto || '',
        codiceUnivocoPec: preventivoInModifica?.codiceUnivocoPec || '',
        rate: preventivoInModifica?.rate || [
            { data: '', contanti: '', bonifico: '', assegno: '' },
            { data: '', contanti: '', bonifico: '', assegno: '' },
            { data: '', contanti: '', bonifico: '', assegno: '' },
        ],
        nota: preventivoInModifica?.nota || '',
        checklistSopralluogo: (() => {
            const voci = checklistVoci.length > 0 ? checklistVoci : DEFAULT_CHECKLIST;
            const saved = preventivoInModifica?.checklistSopralluogo || {};
            return Object.fromEntries(voci.map(v => [v, saved[v] ?? false]));
        })(),
        firmaCliente: null,
        firmaConsulente: null
    };
    const [form, setForm] = useState(() => bozzaIniziale?.form
        ? { ...formIniziale, ...bozzaIniziale.form, servizi: bozzaIniziale.form.servizi || formIniziale.servizi }
        : formIniziale
    );

    const sigCanvasCliente = useRef(null);
    const sigCanvasConsulente = useRef(null);
    const [suggerimenti, setSuggerimenti] = useState([]);
    const [cercando, setCercando] = useState(false);
    const debounceRef = useRef(null);
    const comuneDropdownRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isEdit) return;
        const formSenzaFile = {
            ...form,
            servizi: (form.servizi || []).map(servizio => {
                const { responsabileFile: _responsabileFile, responsabileFiles: _responsabileFiles, ...servizioPulito } = servizio;
                return {
                    ...servizioPulito,
                    dipendenti: (servizio.dipendenti || []).map(({ file: _file, files: _files, ...dipendentePulito }) => dipendentePulito)
                };
            })
        };
        try {
            localStorage.setItem(bozzaKey, JSON.stringify({ form: formSenzaFile, step, tipoCliente, aggiornataIl: Date.now() }));
        } catch (err) {
            console.warn('Impossibile salvare la bozza del preventivo:', err);
        }
    }, [bozzaKey, form, isEdit, step, tipoCliente]);

    useEffect(() => {
        const chiudi = (e) => {
            if (comuneDropdownRef.current && !comuneDropdownRef.current.contains(e.target)) setSuggerimenti([]);
        };
        document.addEventListener('mousedown', chiudi);
        return () => document.removeEventListener('mousedown', chiudi);
    }, []);

    // Quando il listino arriva (async), sincronizza la lista servizi: rimuove ciò che non c'è, aggiunge ciò che manca, riordina
    useEffect(() => {
        if (Object.keys(listino).length === 0 && tuttiIServizi.length === 0 && serviziExtra.length === 0) return;
        setForm(prev => {
            const lista = tuttiIServizi.length > 0
                ? tuttiIServizi
                : [...SERVIZI_PREDEFINITI, ...serviziExtra.filter(d => !SERVIZI_PREDEFINITI.includes(d))];
            const listaSet = new Set(lista);
            const custom = prev.servizi.filter(s => s.custom);
            const nonCustom = prev.servizi
                .filter(s => !s.custom && listaSet.has(s.descrizione))
                .map(s => ({
                    ...s,
                    prezzoUnitario: listino[s.descrizione] > 0 && (prezzoBloccato || !s.prezzoUnitario)
                        ? String(listino[s.descrizione])
                        : (s.prezzoUnitario || '')
                }));
            const byDesc = Object.fromEntries(nonCustom.map(s => [s.descrizione, s]));
            const ordinati = lista.map((desc, i) =>
                byDesc[desc] || {
                    id: 100 + i + prev.servizi.length,
                    descrizione: desc, quantita: '',
                    prezzoUnitario: listino[desc] > 0 ? String(listino[desc]) : '',
                    custom: false, dipendenti: []
                }
            );
            return { ...prev, servizi: [...ordinati, ...custom] };
        });
    }, [listino, serviziExtra, tuttiIServizi]);

    const handleComuneNuovoClienteChange = (valore) => {
        handleNuovoClienteChange('comune', valore);
        clearTimeout(debounceRef.current);
        if (valore.length >= 2) {
            debounceRef.current = setTimeout(async () => {
                setCercando(true);
                try {
                    const risultati = await cercaComuni(valore);
                    setSuggerimenti(risultati);
                } catch { setSuggerimenti([]); }
                setCercando(false);
            }, 400);
        } else {
            setSuggerimenti([]);
        }
    };

    const selezionaComune = (r) => {
        const addr = r.address;
        const nome = addr.city || addr.town || addr.village || addr.municipality || '';
        const sigla = addr['ISO3166-2-lvl6']?.split('-')[1] || '';
        const cap = addr.postcode?.split(';')[0] || '';
        setForm(prev => ({ ...prev, nuovoCliente: { ...prev.nuovoCliente, comune: nome, provincia: sigla, cap } }));
        setSuggerimenti([]);
    };

    const handleChange = (campo, valore) => setForm({ ...form, [campo]: valore });

    const handleNuovoClienteChange = (campo, valore) => {
        setForm({ ...form, nuovoCliente: { ...form.nuovoCliente, [campo]: valore } });
    };

    const handleServizioChange = (id, campo, valore) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => {
                if (s.id !== id) return s;
                const updated = { ...s, [campo]: valore };
                const noNomiServizi = ['DVR', 'HACCP', 'NOMINA MEDICO', 'VISITE MEDICHE', 'FORNITURA'];
                if (campo === 'quantita' && !noNomiServizi.some(k => s.descrizione?.includes(k))) {
                    const n = Math.max(0, parseInt(valore) || 0);
                    const current = s.dipendenti || [];
                    updated.dipendenti = Array.from({ length: n }, (_, i) => current[i] || { nome: '', mansione: '', file: null, files: [] });
                }
                return updated;
            })
        }));
    };

    const handleDipendenteChange = (servizioId, idx, campo, valore) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => {
                if (s.id !== servizioId) return s;
                const dipendenti = (s.dipendenti || []).map((d, i) => i === idx ? { ...d, [campo]: valore } : d);
                return { ...s, dipendenti };
            })
        }));
    };

    const aggiungiFileServizio = (servizioId, file) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => s.id === servizioId
                ? { ...s, responsabileFiles: [...(s.responsabileFiles || []), file] }
                : s)
        }));
    };

    const rimuoviFileServizio = (servizioId, fileIdx) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => s.id === servizioId
                ? { ...s, responsabileFiles: (s.responsabileFiles || []).filter((_, i) => i !== fileIdx) }
                : s)
        }));
    };

    const aggiungiFileDipendente = (servizioId, dipIdx, file) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => s.id !== servizioId ? s : {
                ...s,
                dipendenti: (s.dipendenti || []).map((d, i) => i === dipIdx
                    ? { ...d, files: [...(d.files || []), file] }
                    : d)
            })
        }));
    };

    const rimuoviFileDipendente = (servizioId, dipIdx, fileIdx) => {
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => s.id !== servizioId ? s : {
                ...s,
                dipendenti: (s.dipendenti || []).map((d, i) => i === dipIdx
                    ? { ...d, files: (d.files || []).filter((_, j) => j !== fileIdx) }
                    : d)
            })
        }));
    };

    const toggleOmaggio = (id) => {
        if (!isAdmin) return;
        setForm(prev => ({
            ...prev,
            servizi: prev.servizi.map(s => s.id === id ? { ...s, omaggio: !s.omaggio } : s)
        }));
    };

    const handleRataChange = (idx, campo, valore) => {
        const rate = [...form.rate];
        rate[idx] = { ...rate[idx], [campo]: valore };
        setForm({ ...form, rate });
    };

    const validaServizi = () => {
        const conQuantita = form.servizi.filter(s => parseFloat(s.quantita) > 0);
        if (conQuantita.length === 0) { toast.error('Inserisci almeno un servizio con la quantità!'); return false; }
        for (const s of conQuantita) {
            const hasPrice = parseFloat(s.prezzoUnitario) > 0;
            const desc = s.descrizione || `Servizio #${s.id}`;
            if (!s.omaggio && !hasPrice) { toast.error(`"${desc}": inserisci il prezzo unitario.`); return false; }
            // Consulente: prezzo non può essere inferiore al listino
            if (userData?.ruolo === 'consulente' && listino[s.descrizione] > 0) {
                if (parseFloat(s.prezzoUnitario) < listino[s.descrizione]) {
                    toast.error(`"${desc}": il prezzo non può essere inferiore a € ${listino[s.descrizione].toFixed(2)}`);
                    return false;
                }
            }
            // Alimentarista: telefono obbligatorio per ogni dipendente
            if (s.descrizione?.includes('ALIMENTARISTA')) {
                for (let i = 0; i < (s.dipendenti || []).length; i++) {
                    const dip = s.dipendenti[i];
                    if (!dip.telefono?.trim()) {
                        toast.error(`"${desc}" – dipendente ${i + 1}: inserisci il numero di telefono.`);
                        return false;
                    }
                }
            }
        }
        return true;
    };

    const calcolaTotaleImponibile = () =>
        form.servizi.reduce((tot, s) => s.omaggio
            ? tot
            : tot + (parseFloat(s.quantita) || 0) * (parseFloat(s.prezzoUnitario) || 0), 0);

    const calcolaScontoEuro = () => calcolaTotaleImponibile() * ((parseFloat(form.sconto) || 0) / 100);

    const calcolaIvaEuro = () => Math.max(0, calcolaTotaleImponibile() - calcolaScontoEuro()) * 0.22;

    const calcolaTotale = () => Math.max(0, calcolaTotaleImponibile() - calcolaScontoEuro() + calcolaIvaEuro());

    const [docIdentitaCliente, setDocIdentitaCliente] = useState([]);

    const aggiungiDocumento = () => {
        setDocumentiDaAggiungere(prev => [...prev, { id: crypto.randomUUID(), nome: '', tipo: 'Altro', dataScadenza: '', file: null }]);
    };
    const rimuoviDocumento = (id) => setDocumentiDaAggiungere(prev => prev.filter(d => d.id !== id));
    const handleDocumentoChange = (id, campo, valore) => {
        setDocumentiDaAggiungere(prev => prev.map(d => d.id === id ? { ...d, [campo]: valore } : d));
    };

    const salvaFirme = () => {
        const clienteEmpty = sigCanvasCliente.current?.isEmpty();
        const consulenteEmpty = sigCanvasConsulente.current?.isEmpty();
        if (isEdit) {
            return {
                firmaCliente: !clienteEmpty ? sigCanvasCliente.current.toDataURL('image/png') : (preventivoInModifica?.firmaCliente || null),
                firmaConsulente: !consulenteEmpty ? sigCanvasConsulente.current.toDataURL('image/png') : (preventivoInModifica?.firmaConsulente || null)
            };
        }
        if (clienteEmpty || consulenteEmpty) return null;
        return {
            firmaCliente: sigCanvasCliente.current.toDataURL('image/png'),
            firmaConsulente: sigCanvasConsulente.current.toDataURL('image/png')
        };
    };

    const handleSubmit = async () => {
        if (tipoCliente === 'registrato' && !form.aziendaId) { toast.error("Seleziona un'azienda!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.nome) { toast.error("Inserisci la ragione sociale!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.indirizzo) { toast.error("Inserisci l'indirizzo!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.comune) { toast.error("Inserisci il comune!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.provincia) { toast.error("Inserisci la provincia!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.cap) { toast.error("Inserisci il CAP!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.piva) { toast.error("Inserisci la P.IVA o Codice Fiscale!"); return; }
        if (tipoCliente === 'nuovo' && !validaPartitaIva(form.nuovoCliente.piva)) { toast.error("P.IVA / Codice Fiscale non valido! Deve essere composto da 11 cifre valide."); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.telefono) { toast.error("Inserisci il numero di telefono!"); return; }
        if (tipoCliente === 'nuovo' && !form.nuovoCliente.pec) { toast.error("Inserisci la PEC!"); return; }
        const firme = salvaFirme();
        if (!isEdit && !firme && !isAdmin) { toast.error('Mancano le firme!'); return; }
        await generaPDF(firme || {});
    };

    const generaPDF = async (firme) => {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const ml = 10, mr = 10, pw = 210;
        const cw = pw - ml - mr; // 190mm
        let y = 10;

        const azienda = tipoCliente === 'registrato' ? aziende.find(a => a.id === form.aziendaId) : null;
        const nomeCliente = azienda ? azienda.nome : form.nuovoCliente.nome;
        const contattoCliente = azienda ? (azienda.contatto || '') : form.nuovoCliente.contatto;
        const telefonoCliente = azienda ? (azienda.telefono || '') : form.nuovoCliente.telefono;
        const emailCliente = azienda ? (azienda.email || '') : form.nuovoCliente.email;
        const pivaCliente = azienda ? (azienda.partitaIva || '') : form.nuovoCliente.piva;
        const codiceUnivocoCliente = azienda ? (azienda.codiceUnivoco || '') : form.nuovoCliente.codiceUnivoco;
        const pecCliente = azienda ? (azienda.pec || '') : form.nuovoCliente.pec;
        const comuneCliente = azienda ? (azienda.comune || '') : form.nuovoCliente.comune;
        const provinciaCliente = azienda ? (azienda.provincia || '') : form.nuovoCliente.provincia;
        const capCliente = azienda ? (azienda.cap || '') : form.nuovoCliente.cap;
        const localitaCliente = [capCliente, comuneCliente, provinciaCliente ? `(${provinciaCliente})` : ''].filter(Boolean).join(' ');

        // ---- HEADER ----
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NSGroup', ml, y + 7);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Sicurezza sul lavoro  -  D.Lgs 81/08', ml, y + 13);

        // Checkbox preventivo
        const cx = 130;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.rect(cx, y + 1, 4, 4);
        pdf.text('X', cx + 0.8, y + 4.8);
        pdf.text('PREVENTIVO', cx + 6, y + 5);

        y += 18;
        pdf.setLineWidth(0.4);
        pdf.line(ml, y, ml + cw, y);
        y += 4;

        // DATA + AGENTE
        const dataFmt = form.data ? new Date(form.data + 'T12:00:00').toLocaleDateString('it-IT') : '__/__/2026';
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`DATA:  ${dataFmt}`, ml, y + 5);
        pdf.text(`AGENTE:  ${form.consulente || ''}`, ml + 90, y + 5);
        y += 7;
        pdf.line(ml, y, ml + cw, y);
        y += 5;

        // CLIENT INFO BOX
        const clientRows = [
            ['NOME DEL AZIENDA:', nomeCliente || ''],
            ['TITOLARE/AMMINISTRATORE:', contattoCliente],
            ['INDIRIZZO:', azienda ? (azienda.indirizzo || '') : form.nuovoCliente.indirizzo],
            ['LOCALITA\':', localitaCliente],
            ['TELEFONO:', telefonoCliente],
            ['EMAIL:', emailCliente],
            ['P.IVA / C.F.:', pivaCliente],
        ];
        const labelW = 60, rowH = 6, boxW = cw * 0.65;
        clientRows.forEach(([label, value]) => {
            pdf.setFillColor(220, 220, 220);
            pdf.rect(ml, y, labelW, rowH, 'F');
            pdf.rect(ml, y, labelW, rowH);
            pdf.rect(ml + labelW, y, boxW - labelW, rowH);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(label, ml + 2, y + rowH / 2 + 1.5);
            pdf.setFont('helvetica', 'normal');
            pdf.text(String(value), ml + labelW + 2, y + rowH / 2 + 1.5);
            y += rowH;
        });
        y += 6;

        // CHECKLIST SOPRALLUOGO
        const sopralluogoVoci = checklistVoci.length > 0 ? checklistVoci : DEFAULT_CHECKLIST;
        const sopralluogoChecklist = form.checklistSopralluogo || {};
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('CONTROLLI SOPRALLUOGO:', ml, y + 3.5);
        y += 6;
        pdf.setLineWidth(0.3);
        for (let ri = 0; ri < sopralluogoVoci.length; ri += 5) {
            const rigaVoci = sopralluogoVoci.slice(ri, ri + 5);
            const sopItemW = cw / rigaVoci.length;
            rigaVoci.forEach((label, i) => {
                const ix = ml + i * sopItemW;
                pdf.rect(ix, y, 4, 4);
                if (sopralluogoChecklist[label]) {
                    pdf.setFontSize(7);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('X', ix + 0.8, y + 3.2);
                }
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7.5);
                const lbl = label.length > 22 ? label.substring(0, 20) + '…' : label;
                pdf.text(lbl, ix + 6, y + 3.2);
            });
            y += 7;
        }
        pdf.setLineWidth(0.4);
        y += 1;

        // SERVICES TABLE
        const colW = [140, 20, 30];
        const colX = [ml, ml + 140, ml + 160];
        const thH = 7;
        const trH = 5.5;

        // Header
        const thLabels = ['DESCRIZIONE', "QUANTITA'", 'IMPORTO'];
        thLabels.forEach((h, i) => {
            pdf.setFillColor(44, 62, 102);
            pdf.rect(colX[i], y, colW[i], thH, 'FD');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(255, 255, 255);
            pdf.text(h, colX[i] + colW[i] / 2, y + thH / 2 + 1.5, { align: 'center' });
        });
        y += thH;
        pdf.setTextColor(0, 0, 0);

        // Rows
        form.servizi.forEach((s, idx) => {
            if (idx % 2 === 0) {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(colX[0], y, cw, trH, 'F');
            }
            colX.forEach((x, i) => pdf.rect(x, y, colW[i], trH));

            const qty = parseFloat(s.quantita) || 0;
            const price = parseFloat(s.prezzoUnitario) || 0;
            const importo = s.omaggio ? 0 : qty * price;

            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', s.custom ? 'normal' : 'bold');
            const desc = s.descrizione || '';
            pdf.text(desc.length > 73 ? desc.substring(0, 71) + '…' : desc, colX[0] + 2, y + trH / 2 + 1.5);

            pdf.setFont('helvetica', 'normal');
            pdf.text(s.quantita ? `N. ${s.quantita}` : 'N.', colX[1] + colW[1] / 2, y + trH / 2 + 1.5, { align: 'center' });
            if (s.omaggio) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('OMAGGIO', colX[2] + colW[2] - 2, y + trH / 2 + 1.5, { align: 'right' });
            } else if (importo > 0) {
                pdf.text(`€ ${importo.toFixed(2)}`, colX[2] + colW[2] - 2, y + trH / 2 + 1.5, { align: 'right' });
            }
            y += trH;

            // Nota sotto la riga per DVR e FORNITURA MATERIALE ANTINCENDIO
            if (s.nota && (s.descrizione?.includes('DVR') || s.descrizione?.includes('FORNITURA'))) {
                const notaH = 5;
                colX.forEach((x, i) => pdf.rect(x, y, colW[i], notaH));
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'italic');
                const notaTxt = `Note: ${s.nota}`;
                pdf.text(notaTxt.length > 90 ? notaTxt.substring(0, 88) + '…' : notaTxt, colX[0] + 4, y + notaH / 2 + 1.5);
                y += notaH;
            }
        });

        // Totali
        const totImponibile = calcolaTotaleImponibile();
        const scontoPct = parseFloat(form.sconto) || 0;
        const scontoEuro = calcolaScontoEuro();
        const ivaEuro = calcolaIvaEuro();
        const totIvato = calcolaTotale();
        [
            ['TOTALE IMPONIBILE', totImponibile, null],
            [`SCONTO (${scontoPct}%)`, scontoEuro, 'sconto'],
            ['IVA (22%)', ivaEuro, null],
            ['TOTALE IVATO', totIvato, null],
        ].forEach(([label, val, tipo]) => {
            const lblW = colW[0] + colW[1];
            pdf.rect(colX[0], y, lblW, trH);
            pdf.rect(colX[2], y, colW[2], trH);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(label, colX[1] + colW[1] - 2, y + trH / 2 + 1.5, { align: 'right' });
            pdf.text(val > 0 || tipo === 'sconto' ? `€ ${val.toFixed(2)}` : '€', colX[2] + colW[2] - 2, y + trH / 2 + 1.5, { align: 'right' });
            y += trH;
        });
        y += 6;

        // Check page
        if (y > 235) { pdf.addPage(); y = 15; }

        // PAYMENT SECTION
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('PAGAMENTO', ml, y + 5);
        const codiceUnivocoPdf = codiceUnivocoCliente || pecCliente || '_______________________';
        pdf.text(`CODICE UNIVOCO/PEC: ${codiceUnivocoPdf}`, ml + 45, y + 5);
        y += 7;
        pdf.line(ml, y, ml + cw, y);
        y += 4;

        const payColW = [45, 48, 48, 49];
        const payColX = [ml, ml + 45, ml + 93, ml + 141];
        const payH = 6;
        ['DATA DELLE RATE', 'CONTANTI', 'BONIFICO', 'ASSEGNO'].forEach((h, i) => {
            pdf.setFillColor(44, 62, 102);
            pdf.rect(payColX[i], y, payColW[i], payH, 'FD');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(255, 255, 255);
            pdf.text(h, payColX[i] + payColW[i] / 2, y + payH / 2 + 1.5, { align: 'center' });
        });
        y += payH;
        pdf.setTextColor(0, 0, 0);

        form.rate.forEach(rata => {
            payColX.forEach((x, i) => pdf.rect(x, y, payColW[i], payH));
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            if (rata.data) pdf.text(new Date(rata.data + 'T12:00:00').toLocaleDateString('it-IT'), payColX[0] + payColW[0] / 2, y + payH / 2 + 1.5, { align: 'center' });
            if (rata.contanti) pdf.text(`€ ${parseFloat(rata.contanti).toFixed(2)}`, payColX[1] + 2, y + payH / 2 + 1.5);
            if (rata.bonifico) pdf.text(`€ ${parseFloat(rata.bonifico).toFixed(2)}`, payColX[2] + 2, y + payH / 2 + 1.5);
            if (rata.assegno) pdf.text(`€ ${parseFloat(rata.assegno).toFixed(2)}`, payColX[3] + 2, y + payH / 2 + 1.5);
            y += payH;
        });
        y += 7;

        // NOTA
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NOTA:', ml, y);
        pdf.setFont('helvetica', 'normal');
        pdf.line(ml + 12, y, ml + cw, y);
        if (form.nota) pdf.text(form.nota, ml + 14, y - 1);
        y += 10;

        // FIRMA
        if (y > 255) { pdf.addPage(); y = 15; }
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('FIRMA DEL CLIENTE PER ACCETTAZIONE', ml, y);
        pdf.line(ml + 72, y, ml + cw, y);
        y += 5;
        if (firme.firmaCliente) pdf.addImage(firme.firmaCliente, 'PNG', ml, y, 60, 20);
        if (firme.firmaConsulente) pdf.addImage(firme.firmaConsulente, 'PNG', ml + 100, y, 60, 20);

        let mainBlob = pdf.output('blob');
        const fileName = `Preventivo_${nomeCliente.replace(/[^a-z0-9]/gi, '_')}_${form.data}.pdf`;

        // Allega documento d'identità in fondo al PDF
        if (docIdentitaCliente.length > 0) {
            try {
                const mainBytes = await mainBlob.arrayBuffer();
                const mainPdf = await PDFDocument.load(mainBytes);

                for (const documento of docIdentitaCliente) {
                    try {
                        if (documento.type === 'application/pdf') {
                            const docBytes = await documento.arrayBuffer();
                            const docPdf = await PDFDocument.load(docBytes);
                            const copied = await mainPdf.copyPages(docPdf, docPdf.getPageIndices());
                            copied.forEach(p => mainPdf.addPage(p));
                        } else {
                            // Sempre ridisegnata come JPEG: normalizza formati non affidabili (HEIC, MIME mancante)
                            // e riduce il peso delle foto scattate da mobile prima di incorporarle nel PDF.
                            const jpegBytes = await fileToJpegBytes(documento);
                            const img = await mainPdf.embedJpg(jpegBytes);
                            const margin = 20;
                            const maxW = 595 - margin * 2;
                            const maxH = 842 - margin * 2;
                            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
                            const w = img.width * scale;
                            const h = img.height * scale;
                            const page = mainPdf.addPage([595, 842]);
                            page.drawImage(img, { x: (595 - w) / 2, y: (842 - h) / 2, width: w, height: h });
                        }
                    } catch (fileErr) {
                        console.error('Errore allegato singolo nel PDF:', fileErr);
                        toast.error(`"${documento.name}" non allegato al PDF (formato non supportato)`);
                    }
                }

                const merged = await mainPdf.save();
                mainBlob = new Blob([merged], { type: 'application/pdf' });
            } catch (err) {
                console.error('Errore allegato doc identità nel PDF:', err);
                toast.error('Documenti identità non allegati al PDF');
            }
        }

        await onSave({ ...form, ...firme, tipoCliente, tipoDocumento, nomeCliente, totale: calcolaTotale(), pdfBlob: mainBlob, fileName, documentiDaAggiungere, docIdentitaCliente, isEdit, preventivoId: preventivoInModifica?.id });
        if (!isEdit) localStorage.removeItem(bozzaKey);
        onClose();
    };

    const aziendaSelezionata = tipoCliente === 'registrato' ? aziende.find(a => a.id === form.aziendaId) : null;
    const ricercaAziendaNormalizzata = ricercaAzienda.trim().toLocaleLowerCase('it');
    const aziendeFiltrate = ricercaAziendaNormalizzata
        ? aziende.filter(az => [az.nome, az.partitaIva, az.comune, az.telefono, az.email]
            .filter(Boolean)
            .some(valore => String(valore).toLocaleLowerCase('it').includes(ricercaAziendaNormalizzata)))
        : aziende;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? 0 : 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: isMobile ? '16px 16px 0 0' : 12, width: '100%', maxWidth: isMobile ? '100%' : 820, maxHeight: isMobile ? '96vh' : '92vh', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ padding: isMobile ? '14px 14px 10px' : '16px 20px', borderBottom: '1px solid #dfe5ef' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18 }}>{isEdit ? '✏️ Modifica Preventivo' : '📋 Nuovo Preventivo'}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[
                            { n: 1, label: '1. Dati' },
                            { n: 2, label: '2. Servizi' },
                            { n: 3, label: '3. Pagamento' },
                            { n: 4, label: '4. Documenti' },
                            { n: 5, label: '5. Firma' },
                        ].map(({ n, label }) => (
                            <div key={n} style={{
                                flex: 1, padding: '7px 4px', background: step >= n ? '#2c3e66' : '#eef1f7',
                                color: step >= n ? 'white' : '#5f6f8c', borderRadius: 7, fontSize: 12, fontWeight: 600, textAlign: 'center'
                            }}>{label}</div>
                        ))}
                    </div>
                </div>

                {/* Contenuto scrollabile */}
                <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 20 }}>

                    {/* STEP 1: Dati */}
                    {step === 1 && (
                        <div>
                            {/* Tipo cliente */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 14 }}>Tipo Cliente</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {[{ v: 'registrato', label: '🏢 Cliente Registrato', color: '#2c3e66' }, { v: 'nuovo', label: '✨ Nuovo Cliente', color: '#10b981' }].map(({ v, label, color }) => (
                                        <button key={v} type="button" onClick={() => setTipoCliente(v)} style={{
                                            flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                            border: tipoCliente === v ? `2px solid ${color}` : '1px solid #dfe5ef',
                                            background: tipoCliente === v ? (v === 'registrato' ? '#eef1f8' : '#d1fae5') : 'white',
                                            color: tipoCliente === v ? color : '#5f6f8c'
                                        }}>{label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Cliente registrato */}
                            {tipoCliente === 'registrato' && (
                                <div style={{ marginBottom: 16 }}>
                                    <label htmlFor="ricerca-azienda-preventivo" style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>Cerca azienda</label>
                                    <input
                                        id="ricerca-azienda-preventivo"
                                        type="search"
                                        value={ricercaAzienda}
                                        onChange={e => setRicercaAzienda(e.target.value)}
                                        placeholder="Nome, P.IVA, comune, telefono o email"
                                        autoComplete="off"
                                        style={{ width: '100%', padding: 10, marginBottom: 8, border: '1px solid #c9d1e0', borderRadius: 8, fontSize: 16, boxSizing: 'border-box' }}
                                    />
                                    <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 }}>Seleziona Azienda *</label>
                                    <select value={form.aziendaId} onChange={e => {
                                        const az = aziende.find(a => a.id === e.target.value);
                                        setForm(prev => ({
                                            ...prev,
                                            aziendaId: e.target.value,
                                            codiceUnivocoPec: az?.codiceUnivoco || az?.pec || prev.codiceUnivocoPec
                                        }));
                                    }}
                                        style={{ width: '100%', padding: 10, border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 14 }}>
                                        <option value="">{aziendeFiltrate.length ? `-- Seleziona (${aziendeFiltrate.length}) --` : '-- Nessuna azienda trovata --'}</option>
                                        {aziendaSelezionata && !aziendeFiltrate.some(az => az.id === aziendaSelezionata.id) && (
                                            <option value={aziendaSelezionata.id}>{aziendaSelezionata.nome} (selezionata)</option>
                                        )}
                                        {aziendeFiltrate.map(az => <option key={az.id} value={az.id}>{az.nome}</option>)}
                                    </select>
                                    {aziendaSelezionata && (
                                        <div style={{ marginTop: 10, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 13 }}>
                                            {[
                                                ['Indirizzo', aziendaSelezionata.indirizzo],
                                                ['Comune', [aziendaSelezionata.cap, aziendaSelezionata.comune, aziendaSelezionata.provincia ? `(${aziendaSelezionata.provincia})` : ''].filter(Boolean).join(' ')],
                                                ['Telefono', aziendaSelezionata.telefono],
                                                ['Email', aziendaSelezionata.email],
                                                ['Amministratore', aziendaSelezionata.contatto],
                                                ['P.IVA', aziendaSelezionata.partitaIva],
                                                ['Codice Univoco', aziendaSelezionata.codiceUnivoco],
                                                ['PEC', aziendaSelezionata.pec],
                                            ].filter(([, v]) => v).map(([label, value]) => (
                                                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                                                    <span style={{ fontWeight: 600, color: '#166534', minWidth: 120 }}>{label}:</span>
                                                    <span style={{ color: '#1a2540' }}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Nuovo cliente */}
                            {tipoCliente === 'nuovo' && (
                                <div style={{ marginBottom: 16, padding: 14, background: '#f6f8fc', borderRadius: 8, border: '1px solid #dfe5ef' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Dati Nuovo Cliente</h4>
                                    <div style={{ marginBottom: 10 }}>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Ragione Sociale *</label>
                                        <input type="text" value={form.nuovoCliente.nome} onChange={e => handleNuovoClienteChange('nome', e.target.value)}
                                            placeholder="Nome azienda" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Indirizzo *</label>
                                        <input type="text" value={form.nuovoCliente.indirizzo} onChange={e => handleNuovoClienteChange('indirizzo', e.target.value)}
                                            placeholder="Indirizzo completo" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                    </div>
                                    <div style={{ marginBottom: 10, position: 'relative' }} ref={comuneDropdownRef}>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Comune *</label>
                                        <input type="text" value={form.nuovoCliente.comune}
                                            onChange={e => handleComuneNuovoClienteChange(e.target.value)}
                                            placeholder="Inizia a digitare..." autoComplete="off"
                                            style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        {cercando && <div style={{ position: 'absolute', right: 10, top: 30, fontSize: 11, color: '#9aa7bf' }}>Ricerca...</div>}
                                        {suggerimenti.length > 0 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #dfe5ef', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: 200, overflowY: 'auto' }}>
                                                {suggerimenti.map((r, i) => {
                                                    const addr = r.address;
                                                    const nome = addr.city || addr.town || addr.village || addr.municipality || '';
                                                    const prov = addr['ISO3166-2-lvl6']?.split('-')[1] || '';
                                                    const cap = addr.postcode?.split(';')[0] || '';
                                                    return (
                                                        <div key={i} onMouseDown={() => selezionaComune(r)}
                                                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eef1f7', fontSize: 13 }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#eef1f8'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                                            <span style={{ fontWeight: 600 }}>{nome}</span>
                                                            {prov && <span style={{ color: '#2c3e66', marginLeft: 6 }}>({prov})</span>}
                                                            {cap && <span style={{ color: '#9aa7bf', marginLeft: 6 }}>{cap}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Provincia *</label>
                                            <input type="text" value={form.nuovoCliente.provincia}
                                                onChange={e => handleNuovoClienteChange('provincia', e.target.value.toUpperCase().slice(0, 2))}
                                                placeholder="Es. LE" maxLength={2}
                                                style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14, textTransform: 'uppercase' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>CAP *</label>
                                            <input type="text" value={form.nuovoCliente.cap}
                                                onChange={e => handleNuovoClienteChange('cap', e.target.value.replace(/\D/g, '').slice(0, 5))}
                                                placeholder="Es. 73100" maxLength={5}
                                                style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Telefono *</label>
                                            <input type="tel" value={form.nuovoCliente.telefono} onChange={e => handleNuovoClienteChange('telefono', e.target.value)}
                                                placeholder="Telefono" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>P.IVA / Codice Fiscale *</label>
                                            <input type="text" value={form.nuovoCliente.piva}
                                                onChange={e => handleNuovoClienteChange('piva', e.target.value)}
                                                onBlur={e => {
                                                    const piva = e.target.value.trim();
                                                    if (!piva) return;
                                                    const trovata = aziende.find(a => a.partitaIva?.trim() === piva);
                                                    if (trovata) {
                                                        toast.error(`Cliente già registrato: ${trovata.nome}. Selezionato automaticamente.`);
                                                        setTipoCliente('registrato');
                                                        handleChange('aziendaId', trovata.id);
                                                    }
                                                }}
                                                placeholder="P.IVA / Codice Fiscale" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>PEC *</label>
                                            <input type="email" value={form.nuovoCliente.pec} onChange={e => handleNuovoClienteChange('pec', e.target.value)}
                                                placeholder="indirizzo@pec.it" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Codice Univoco</label>
                                            <input type="text" value={form.nuovoCliente.codiceUnivoco} onChange={e => handleNuovoClienteChange('codiceUnivoco', e.target.value)}
                                                placeholder="Es. XXXXXXX" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Amministratore</label>
                                            <input type="text" value={form.nuovoCliente.contatto} onChange={e => handleNuovoClienteChange('contatto', e.target.value)}
                                                placeholder="Nome cognome" style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data e Agente */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, padding: 14, background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Data</label>
                                    <input type="date" value={form.data} onChange={e => handleChange('data', e.target.value)}
                                        style={{ width: '100%', padding: 8, border: '1px solid #fde68a', borderRadius: 6, fontSize: 14 }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Referente</label>
                                    <input type="text" value={form.consulente} onChange={e => handleChange('consulente', e.target.value)}
                                        placeholder="Nome agente" style={{ width: '100%', padding: 8, border: '1px solid #fde68a', borderRadius: 6, fontSize: 14 }} />
                                </div>
                            </div>

                            {/* Controlli Sopralluogo */}
                            <div style={{ marginTop: 16, padding: 14, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#166534' }}>🔍 Controlli Sopralluogo</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                                    {(checklistVoci.length > 0 ? checklistVoci : DEFAULT_CHECKLIST).map(label => (
                                        <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 8px', background: form.checklistSopralluogo[label] ? '#dcfce7' : 'white', borderRadius: 6, border: `1px solid ${form.checklistSopralluogo[label] ? '#86efac' : '#dfe5ef'}` }}>
                                            <input
                                                type="checkbox"
                                                checked={form.checklistSopralluogo[label] ?? false}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    checklistSopralluogo: { ...prev.checklistSopralluogo, [label]: e.target.checked }
                                                }))}
                                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: form.checklistSopralluogo[label] ? '#166534' : '#374151' }}>{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Servizi */}
                    {step === 2 && (
                        <div>
                            <h3 style={{ marginBottom: 4, fontSize: 16 }}>💼 Servizi</h3>
                            <p style={{ marginBottom: 12, fontSize: 13, color: '#5f6f8c' }}>Inserisci quantità e prezzo unitario per ogni servizio da includere nel preventivo.</p>

                            {/* Tabella */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#1a2540', color: 'white' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '50%' }}>DESCRIZIONE</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '12%' }}>QUANTITÀ</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', width: '18%' }}>PREZZO UNITARIO</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', width: '20%' }}>IMPORTO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {form.servizi.map((s, idx) => {
                                            const qty = parseInt(s.quantita) || 0;
                                            const price = parseFloat(s.prezzoUnitario) || 0;
                                            const importo = s.omaggio ? 0 : qty * price;
                                            return (
                                                <Fragment key={s.id}>
                                                    <tr style={{ background: idx % 2 === 0 ? '#f6f8fc' : 'white', borderBottom: qty > 0 ? 'none' : '1px solid #dfe5ef' }}>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            {s.custom ? (
                                                                <input type="text" value={s.descrizione} onChange={e => handleServizioChange(s.id, 'descrizione', e.target.value)}
                                                                    placeholder="Descrizione servizio..." style={{ width: '100%', padding: '4px 6px', border: '1px solid #dfe5ef', borderRadius: 4, fontSize: 13 }} />
                                                            ) : (
                                                                <span style={{ fontWeight: 600 }}>{s.descrizione}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                            <input type="number" value={s.quantita} onChange={e => handleServizioChange(s.id, 'quantita', e.target.value)}
                                                                placeholder="N." min="0" step="1"
                                                                style={{ width: '60px', padding: '4px 6px', border: '1px solid #dfe5ef', borderRadius: 4, fontSize: 13, textAlign: 'center' }} />
                                                        </td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                                                {(() => {
                                                                    const prezzoMin = prezzoBloccato && listino[s.descrizione] > 0 ? listino[s.descrizione] : 0;
                                                                    const sottoMin = prezzoBloccato && prezzoMin > 0 && parseFloat(s.prezzoUnitario) < prezzoMin && s.prezzoUnitario !== '';
                                                                    return (
                                                                        <div style={{ display: 'flex', flexDirection: isAdmin ? 'row' : 'column', alignItems: 'center', justifyContent: 'flex-end', gap: isAdmin ? 8 : 2, whiteSpace: 'nowrap' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                {s.omaggio ? (
                                                                                    <span style={{ width: 98, padding: '5px 6px', borderRadius: 4, fontSize: 12, textAlign: 'center', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 800 }}>
                                                                                        OMAGGIO
                                                                                    </span>
                                                                                ) : (
                                                                                    <>
                                                                                        <span style={{ color: '#5f6f8c', fontSize: 12 }}>€</span>
                                                                                        <input type="number" value={s.prezzoUnitario}
                                                                                            onChange={e => handleServizioChange(s.id, 'prezzoUnitario', e.target.value)}
                                                                                            placeholder="0.00" min={prezzoMin || 0} step="0.01"
                                                                                            style={{ width: '85px', padding: '4px 6px', borderRadius: 4, fontSize: 13, textAlign: 'right', border: `1px solid ${sottoMin ? '#fca5a5' : '#dfe5ef'}`, background: sottoMin ? '#fef2f2' : 'white' }} />
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            {isAdmin && (
                                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: s.omaggio ? '#15803d' : '#5f6f8c', cursor: 'pointer', fontWeight: s.omaggio ? 700 : 500 }}>
                                                                                    <input type="checkbox" checked={!!s.omaggio} onChange={() => toggleOmaggio(s.id)} />
                                                                                    Omaggio
                                                                                </label>
                                                                            )}
                                                                            {prezzoBloccato && prezzoMin > 0 && (
                                                                                <span style={{ fontSize: 10, color: sottoMin ? '#dc2626' : '#9aa7bf' }}>
                                                                                    min € {prezzoMin.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: importo > 0 ? 700 : 400, color: importo > 0 ? '#1a2540' : '#9aa7bf' }}>
                                                            {s.omaggio ? <span style={{ color: '#15803d', fontWeight: 800 }}>OMAGGIO</span> : (importo > 0 ? `€ ${importo.toFixed(2)}` : '—')}
                                                        </td>
                                                    </tr>
                                                    {qty > 0 && s.descrizione?.includes('DVR') && (
                                                        <tr key={`nota-${s.id}`} style={{ background: '#f0fdf4', borderBottom: '1px solid #dfe5ef' }}>
                                                            <td colSpan={4} style={{ padding: '6px 8px 6px 24px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700, minWidth: 50 }}>📝 Note</span>
                                                                    <input
                                                                        type="text"
                                                                        value={s.nota || ''}
                                                                        onChange={e => handleServizioChange(s.id, 'nota', e.target.value)}
                                                                        placeholder="Note DVR..."
                                                                        style={{ flex: 1, padding: '3px 7px', border: '1px solid #bbf7d0', borderRadius: 4, fontSize: 12 }}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {qty > 0 && s.descrizione?.includes('FORNITURA') && (
                                                        <tr key={`fornitura-${s.id}`} style={{ background: '#fff7ed', borderBottom: '1px solid #dfe5ef' }}>
                                                            <td colSpan={4} style={{ padding: '6px 8px 6px 24px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 11, color: '#c2410c', fontWeight: 700, minWidth: 50 }}>📝 Note</span>
                                                                    <input
                                                                        type="text"
                                                                        value={s.nota || ''}
                                                                        onChange={e => handleServizioChange(s.id, 'nota', e.target.value)}
                                                                        placeholder="Elenco materiali antincendio..."
                                                                        style={{ flex: 1, padding: '3px 7px', border: '1px solid #fed7aa', borderRadius: 4, fontSize: 12 }}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {qty > 0 && s.descrizione?.includes('HACCP') && (
                                                        <tr key={`haccp-${s.id}`} style={{ background: '#fefce8', borderBottom: '1px solid #dfe5ef' }}>
                                                            <td colSpan={4} style={{ padding: '6px 8px 6px 24px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: 11, color: '#a16207', fontWeight: 700, whiteSpace: 'nowrap' }}>👤 Resp. Auto Controllo</span>
                                                                    <input
                                                                        type="text"
                                                                        value={s.responsabile || ''}
                                                                        onChange={e => handleServizioChange(s.id, 'responsabile', e.target.value)}
                                                                        placeholder="Nome responsabile auto controllo..."
                                                                        style={{ flex: 1, minWidth: 160, padding: '3px 7px', border: '1px solid #fde68a', borderRadius: 4, fontSize: 12 }}
                                                                    />
                                                                    {(s.responsabileFiles || []).map((file, fileIdx) => (
                                                                        <span key={`${file.name}-${fileIdx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px', background: '#ecfdf5', borderRadius: 4 }}>
                                                                            <span style={{ fontSize: 11, color: '#059669', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {file.name}</span>
                                                                            <button type="button" onClick={() => rimuoviFileServizio(s.id, fileIdx)} style={{ fontSize: 10, padding: '1px 4px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                                                                        </span>
                                                                    ))}
                                                                    <DropZone multiple compact colorScheme="yellow" accept=".pdf,.jpg,.jpeg,.png" label={(s.responsabileFiles || []).length ? 'Aggiungi' : 'Allega'} onFile={f => aggiungiFileServizio(s.id, f)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {qty > 0 && !['DVR', 'HACCP', 'NOMINA MEDICO', 'VISITE MEDICHE', 'FORNITURA'].some(k => s.descrizione?.includes(k)) && (s.dipendenti || []).map((dip, dipIdx) => {
                                                        const isAlimentarista = s.descrizione?.includes('ALIMENTARISTA');
                                                        const telefonoMancante = isAlimentarista && !dip.telefono?.trim();
                                                        return (
                                                        <tr key={`dip-${s.id}-${dipIdx}`} style={{ background: '#eef1f8', borderBottom: dipIdx === qty - 1 ? '1px solid #dfe5ef' : '1px solid #dde3f0' }}>
                                                            <td colSpan={4} style={{ padding: '3px 8px 3px 24px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: 11, color: '#2c3e66', fontWeight: 700, minWidth: 50 }}>👤 #{dipIdx + 1}</span>
                                                                    <input
                                                                        type="text"
                                                                        value={dip.nome}
                                                                        onChange={e => handleDipendenteChange(s.id, dipIdx, 'nome', e.target.value)}
                                                                        placeholder={`Nome dipendente ${dipIdx + 1}`}
                                                                        style={{ flex: 1, minWidth: 100, padding: '3px 7px', border: '1px solid #c3cde3', borderRadius: 4, fontSize: 12 }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={dip.mansione || ''}
                                                                        onChange={e => handleDipendenteChange(s.id, dipIdx, 'mansione', e.target.value)}
                                                                        placeholder="Mansione"
                                                                        style={{ flex: 1, minWidth: 80, padding: '3px 7px', border: '1px solid #c3cde3', borderRadius: 4, fontSize: 12 }}
                                                                    />
                                                                    {isAlimentarista && (
                                                                        <input
                                                                            type="tel"
                                                                            value={dip.telefono || ''}
                                                                            onChange={e => handleDipendenteChange(s.id, dipIdx, 'telefono', e.target.value)}
                                                                            placeholder="Telefono *"
                                                                            style={{ flex: 1, minWidth: 100, padding: '3px 7px', borderRadius: 4, fontSize: 12, border: `1px solid ${telefonoMancante ? '#fca5a5' : '#c3cde3'}`, background: telefonoMancante ? '#fef2f2' : 'white' }}
                                                                        />
                                                                    )}
                                                                    {(dip.files || []).map((file, fileIdx) => (
                                                                        <span key={`${file.name}-${fileIdx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px', background: '#ecfdf5', borderRadius: 4 }}>
                                                                            <span style={{ fontSize: 11, color: '#059669', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {file.name}</span>
                                                                            <button type="button" onClick={() => rimuoviFileDipendente(s.id, dipIdx, fileIdx)} style={{ fontSize: 10, padding: '1px 4px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                                                                        </span>
                                                                    ))}
                                                                    <DropZone multiple compact colorScheme="blue" accept=".pdf,.jpg,.jpeg,.png" label={(dip.files || []).length ? 'Aggiungi' : 'Allega'} onFile={f => aggiungiFileDipendente(s.id, dipIdx, f)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totale imponibile */}
                            <div style={{ textAlign: 'right', marginTop: 12, padding: '10px 16px', background: '#eef1f8', borderRadius: 8 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2e4d' }}>
                                    TOTALE IMPONIBILE: € {calcolaTotaleImponibile().toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Pagamento */}
                    {step === 3 && (
                        <div>
                            <h3 style={{ marginBottom: 16, fontSize: 16 }}>💳 Pagamento</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 5, fontWeight: 600, fontSize: 14 }}>
                                        Sconto (%)
                                        {prezzoBloccato && <span style={{ fontWeight: 400, fontSize: 12, color: '#9aa7bf', marginLeft: 6 }}>max 10%</span>}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="number"
                                            value={form.sconto}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value) || 0;
                                                if (prezzoBloccato && val > 10) { toast.error('Il consulente può applicare max il 10% di sconto'); return; }
                                                handleChange('sconto', e.target.value);
                                            }}
                                            placeholder="0"
                                            min="0"
                                            max={prezzoBloccato ? 10 : 100}
                                            step="0.5"
                                            style={{ flex: 1, padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14 }}
                                        />
                                        <span style={{ color: '#5f6f8c', fontWeight: 600 }}>%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Riepilogo totali */}
                            <div style={{ padding: 12, background: '#f6f8fc', borderRadius: 8, marginBottom: 16, border: '1px solid #dfe5ef' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 14, color: '#5f6f8c' }}>Totale Imponibile</span>
                                    <span style={{ fontWeight: 600 }}>€ {calcolaTotaleImponibile().toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 14, color: '#5f6f8c' }}>Sconto {form.sconto ? `(${parseFloat(form.sconto)}%)` : ''}</span>
                                    <span style={{ fontWeight: 600, color: '#dc2626' }}>- € {calcolaScontoEuro().toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 14, color: '#5f6f8c' }}>IVA (22%)</span>
                                    <span style={{ fontWeight: 600 }}>+ € {calcolaIvaEuro().toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #dfe5ef' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700 }}>Totale Ivato</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2e4d' }}>€ {calcolaTotale().toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Rate */}
                            <h4 style={{ marginBottom: 10, fontSize: 14 }}>Date di pagamento</h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#1a2540', color: 'white' }}>
                                            {['Data', 'Contanti (€)', 'Bonifico (€)', 'Assegno (€)'].map(h => (
                                                <th key={h} style={{ padding: '8px 10px', textAlign: 'center' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {form.rate.map((rata, idx) => (
                                            <tr key={idx} style={{ background: idx % 2 === 0 ? '#f6f8fc' : 'white', borderBottom: '1px solid #dfe5ef' }}>
                                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                    <input type="date" value={rata.data} onChange={e => handleRataChange(idx, 'data', e.target.value)}
                                                        style={{ padding: '4px 6px', border: '1px solid #dfe5ef', borderRadius: 4, fontSize: 13 }} />
                                                </td>
                                                {['contanti', 'bonifico', 'assegno'].map(campo => (
                                                    <td key={campo} style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                        <input type="number" value={rata[campo]} onChange={e => handleRataChange(idx, campo, e.target.value)}
                                                            placeholder="0.00" min="0" step="0.01"
                                                            style={{ width: '90px', padding: '4px 6px', border: '1px solid #dfe5ef', borderRadius: 4, fontSize: 13, textAlign: 'right' }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Nota */}
                            <div style={{ marginTop: 16 }}>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Nota</label>
                                <textarea value={form.nota} onChange={e => handleChange('nota', e.target.value)}
                                    rows="3" placeholder="Note aggiuntive..."
                                    style={{ width: '100%', padding: 10, border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Documenti */}
                    {step === 4 && (
                        <div>
                            <h3 style={{ marginBottom: 6, fontSize: 16 }}>📁 Documenti Azienda</h3>
                            {tipoCliente === 'nuovo' && (
                                <div style={{ padding: 12, background: '#d1fae5', borderRadius: 8, border: '1px solid #6ee7b7', marginBottom: 16 }}>
                                    <p style={{ margin: 0, fontSize: 13, color: '#065f46' }}>
                                        ✓ Il nuovo cliente verrà registrato automaticamente in Lista Aziende al salvataggio.
                                    </p>
                                </div>
                            )}
                            <p style={{ marginBottom: 16, fontSize: 13, color: '#5f6f8c' }}>
                                Carica i documenti dell'azienda. Verranno salvati automaticamente nella sezione Documenti del cliente.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {documentiDaAggiungere.map(doc => (
                                    <div key={doc.id} style={{ background: '#f6f8fc', padding: 12, borderRadius: 8, border: '1px solid #dfe5ef' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Tipo</label>
                                                <select value={doc.tipo} onChange={e => handleDocumentoChange(doc.id, 'tipo', e.target.value)}
                                                    style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 13 }}>
                                                    {['Visura Camerale', 'Certificato CCIAA', 'DURC', 'Polizza Assicurativa', 'Certificazione ISO', 'Attestazione SOA', 'Contratto', 'Licenze', 'Autorizzazioni', 'Altro'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Scadenza (opzionale)</label>
                                                <input type="date" value={doc.dataScadenza} onChange={e => handleDocumentoChange(doc.id, 'dataScadenza', e.target.value)}
                                                    style={{ width: '100%', padding: 8, border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 13 }} />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 8 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>File PDF o foto *</label>
                                            <DropZone accept=".pdf,.jpg,.jpeg,.png" file={doc.file}
                                                onFile={f => setDocumentiDaAggiungere(prev => prev.map(d => d.id === doc.id ? { ...d, file: f, nome: f.name.replace(/\.[^/.]+$/, '') } : d))}
                                                onRemove={() => setDocumentiDaAggiungere(prev => prev.map(d => d.id === doc.id ? { ...d, file: null } : d))}
                                            />
                                        </div>
                                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                                            <button type="button" onClick={() => rimuoviDocumento(doc.id)}
                                                style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                                🗑️ Rimuovi
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={aggiungiDocumento}
                                style={{ marginTop: 12, width: '100%', padding: 10, background: '#eef1f8', color: '#2c3e66', border: '2px dashed #2c3e66', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                                + Aggiungi Documento
                            </button>
                        </div>
                    )}

                    {/* STEP 5: Firme */}
                    {step === 5 && (
                        <div>
                            <h3 style={{ marginBottom: 15, fontSize: 16 }}>✍️ Firme</h3>
                            {isEdit && (
                                <div style={{ padding: 12, background: '#eef1f8', borderRadius: 8, border: '1px solid #c3cde3', marginBottom: 16 }}>
                                    <p style={{ margin: 0, fontSize: 13, color: '#2c3e66' }}>
                                        ℹ️ Modalità modifica: le firme sono opzionali. Lascia il campo vuoto per mantenere le firme precedenti.
                                    </p>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 20 }}>

                                {/* Firma Cliente + Documento identità */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 14 }}>Firma Cliente {isAdmin ? '(opzionale)' : '*'}</label>
                                    <div style={{ border: '2px solid #dfe5ef', borderRadius: 8, overflow: 'hidden' }}>
                                        <SignatureCanvas ref={sigCanvasCliente} canvasProps={{ width: 350, height: 200, style: { width: '100%', height: 200, background: 'white' } }} />
                                    </div>
                                    <button onClick={() => sigCanvasCliente.current?.clear()}
                                        style={{ marginTop: 8, padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}>
                                        Cancella
                                    </button>

                                    {/* Documento di identità */}
                                    <div style={{ marginTop: 14, padding: '12px 12px 10px', background: '#f6f8fc', borderRadius: 8, border: '1px solid #dfe5ef' }}>
                                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#45536f' }}>
                                            🪪 Documento di identità cliente
                                        </label>
                                        {docIdentitaCliente.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                                                {docIdentitaCliente.map((file, fileIdx) => (
                                                    <div key={`${file.name}-${fileIdx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#d1fae5', borderRadius: 6, border: '1px solid #6ee7b7' }}>
                                                        <span style={{ fontSize: 13, color: '#065f46', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {file.name}</span>
                                                        <button type="button" onClick={() => setDocIdentitaCliente(prev => prev.filter((_, i) => i !== fileIdx))}
                                                            style={{ fontSize: 11, padding: '2px 7px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <DropZone multiple accept=".pdf,.jpg,.jpeg,.png" label={docIdentitaCliente.length ? 'Aggiungi altre foto o documenti' : undefined} onFile={f => setDocIdentitaCliente(prev => [...prev, f])} />
                                    </div>
                                </div>

                                {/* Firma Consulente */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 14 }}>Firma Consulente {isAdmin ? '(opzionale)' : '*'}</label>
                                    <div style={{ border: '2px solid #dfe5ef', borderRadius: 8, overflow: 'hidden' }}>
                                        <SignatureCanvas ref={sigCanvasConsulente} canvasProps={{ width: 350, height: 200, style: { width: '100%', height: 200, background: 'white' } }} />
                                    </div>
                                    <button onClick={() => sigCanvasConsulente.current?.clear()}
                                        style={{ marginTop: 8, padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}>
                                        Cancella
                                    </button>
                                </div>
                            </div>
                            <div style={{ padding: 14, background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                                <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
                                    {isAdmin
                                        ? 'ℹ️ Come admin puoi generare il PDF anche senza firme.'
                                        : '⚠️ Assicurarsi che entrambe le firme siano apposte prima di generare il PDF.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: isMobile ? '12px 14px' : '14px 20px', borderTop: '1px solid #dfe5ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                        Annulla
                    </button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)} style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                                ← Indietro
                            </button>
                        )}
                        {step < 5 ? (
                            <button onClick={() => {
                                if (step === 2 && !validaServizi()) return;
                                setStep(step + 1);
                            }} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#2c3e66', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                                Avanti →
                            </button>
                        ) : (
                            <button onClick={handleSubmit} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                                ✓ Genera PDF e Salva
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ModalePreventivo;
