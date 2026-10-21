import { useState, useEffect, useMemo } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ListaAziende from './components/ListaAziende';
import SchedaAzienda from './components/SchedaAzienda';
import ModaleAzienda from './components/ModaleAzienda';
import Agenda from './components/Agenda';
import Login from './components/Login';
import GestioneUtenti from './components/GestioneUtenti';
import ConfirmModal from './components/ConfirmModal';
import Navigazione from './components/Navigazione';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import PannelloNotifiche from './components/PannelloNotifiche';
import PaginaPlanning from './components/PaginaPlanning';
import { useAziende } from './hooks/useAziende';
import { useAppuntamenti } from './hooks/useAppuntamenti';
import RicercaGlobale from './components/RicercaGlobale';
import Impostazioni from './components/Impostazioni';
import ModalePreventivo from './components/ModalePreventivo';
import PaginaPreventivi from './components/PaginaPreventivi';
import ModalePagamento from './components/ModalePagamento';
import { inviaNotificaPushAdmin } from './utils/inviaNotificaAdmin';
import PaginaAziendeAssegnate from './components/PaginaAziendeAssegnate';
import PaginaListino from './components/PaginaListino';
import ContabilitaGruppo from './components/crm/ContabilitaGruppo';
import ModaleContratto from './components/contratto/ModaleContratto';
import Icona from './components/Icona';

// Portale esterno mostrato all'account azienda (link provvisorio, da sostituire con quello vero)
const PORTALE_ESTERNO = { url: 'https://www.esempio.it', label: 'Vai al portale' };

const TIPI_CONTROLLO = [
  'Visita di sicurezza',
  'Controllo DPI',
  'Verifica dispositivi di protezione',
  'Valutazione rischi',
  'Formazione sicurezza',
  'Ispezione macchinari',
  'Verifica antincendio',
  'Controllo pronto soccorso',
];

function App({ session }) {
  const { user, userData, loading, login, logout } = session;
  const { aziende } = useAziende(userData);
  const { appuntamenti } = useAppuntamenti(userData);

  const [aziendaSelezionataId, setAziendaSelezionataId] = useState(null);
  const [navKey, setNavKey] = useState(0);
  const [tabAzienda, setTabAzienda] = useState('controlli');
  const [mostraModaleAzienda, setMostraModaleAzienda] = useState(false);
  const [vistaCorrente, setVistaCorrente] = useState('dashboard');
  const [listino, setListino] = useState({});
  const [serviziExtra, setServiziExtra] = useState([]);
  const [tuttiIServizi, setTuttiIServizi] = useState([]);
  const [checklistVoci, setChecklistVoci] = useState([]);
  const [consulenti, setConsulenti] = useState([]);
  const [operatoriList, setOperatoriList] = useState([]);
  const [referentiList, setReferentiList] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [mostraModalePreventivo, setMostraModalePreventivo] = useState(false);
  const [contratti, setContratti] = useState([]);
  const [modaleContratto, setModaleContratto] = useState(null); // { preventivo?, contratto? }
  const [preventivoInModifica, setPreventivoInModifica] = useState(null);
  const [preventivoDettaglio, setPreventivoDettaglio] = useState(null);
  const [preventivoPerPagamento, setPreventivoPerPagamento] = useState(null);
  const [mostraPromptMotivazione, setMostraPromptMotivazione] = useState(false);
  const [preventivoPerModifica, setPreventivoPerModifica] = useState(null);
  const [motivazioneTemp, setMotivazioneTemp] = useState('');
  const [motivazioneModifica, setMotivazioneModifica] = useState('');
  const [nuovoTipoControllo, setNuovoTipoControllo] = useState('');
  const [tipiControlloPersonalizzati, setTipiControlloPersonalizzati] = useState([]);
  const [giorniPreavviso, setGiorniPreavviso] = useState(7);
  const [ricerca, setRicerca] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  const aziendaSelezionata = useMemo(
    () => aziende.find(az => az.id === aziendaSelezionataId) ?? null,
    [aziende, aziendaSelezionataId]
  );

  const aziendeFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const base = q ? aziende.filter(az => az.nome?.toLowerCase().includes(q)) : aziende;
    // Separa attive e archiviate ma le passa tutte a ListaAziende (che gestisce internamente la separazione)
    return base;
  }, [aziende, ricerca]);

  const aziendAttive = useMemo(() => aziende.filter(az => !az.archiviata), [aziende]);

  // Carica dati secondari e imposta vista in base al ruolo
  useEffect(() => {
    if (!userData) {
      setConsulenti([]);
      setPreventivi([]);
      setTipiControlloPersonalizzati([]);
      setAziendaSelezionataId(null);
      setVistaCorrente('dashboard');
      return;
    }
    if (userData.ruolo === 'consulente') {
      setVistaCorrente('agenda');
    }
    if (['admin', 'operatore', 'consulente'].includes(userData.ruolo)) caricaConsulenti();
    if (['admin', 'operatore'].includes(userData.ruolo)) caricaOperatori();
    if (['admin', 'operatore'].includes(userData.ruolo)) caricaReferenti();
    // L'account azienda legge solo la propria scheda: niente listino né altre raccolte
    if (userData.ruolo === 'azienda') return;
    if (userData.ruolo === 'admin' || userData.ruolo === 'operatore') {
      caricaPreventivi();
      getDoc(doc(db, 'config', 'tipiControllo')).then(snap => {
        if (snap.exists()) setTipiControlloPersonalizzati(snap.data().tipi || []);
      }).catch(err => console.error('Errore caricamento tipi controllo:', err));
      getDoc(doc(db, 'config', 'impostazioni')).then(snap => {
        if (snap.exists() && snap.data().giorniPreavviso) setGiorniPreavviso(snap.data().giorniPreavviso);
      }).catch(() => {});
    }
    const unsubListino = onSnapshot(doc(db, 'config', 'listino'), snap => {
      if (snap.exists()) {
        setListino(snap.data().prezzi || {});
        setServiziExtra(snap.data().serviziExtra || []);
        setTuttiIServizi(snap.data().tuttiIServizi || []);
        setChecklistVoci(snap.data().checklistSopralluogo || []);
      }
    }, () => {});
    return () => unsubListino();
  }, [userData]);

  // Contratti in tempo reale: admin e operatori li vedono tutti, i consulenti i propri
  useEffect(() => {
    if (!['admin', 'operatore', 'consulente'].includes(userData?.ruolo)) return;
    const q = userData.ruolo === 'consulente'
      ? query(collection(db, 'contratti'), where('consulente', '==', userData.nome || ''))
      : collection(db, 'contratti');
    return onSnapshot(q, snap => setContratti(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Errore caricamento contratti:', err));
  }, [userData?.ruolo, userData?.nome]);

  // Preventivi consulente in tempo reale
  useEffect(() => {
    if (userData?.ruolo !== 'consulente' || !userData?.nome) return;
    const unsub = onSnapshot(
      query(collection(db, 'preventivi'), where('consulente', '==', userData.nome)),
      snap => setPreventivi(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Errore caricamento preventivi consulente:', err)
    );
    return () => unsub();
  }, [userData?.ruolo, userData?.nome]);

  // Auto-seleziona l'azienda per il ruolo 'azienda' non appena arriva da onSnapshot
  useEffect(() => {
    if (userData?.ruolo === 'azienda' && aziende.length > 0 && !aziendaSelezionataId) {
      setAziendaSelezionataId(aziende[0].id);
    }
  }, [userData, aziende, aziendaSelezionataId]);

  // Reset selezione se l'azienda selezionata viene eliminata
  useEffect(() => {
    if (aziendaSelezionataId && !aziendaSelezionata) {
      setAziendaSelezionataId(null);
    }
  }, [aziendaSelezionata, aziendaSelezionataId]);

  const caricaConsulenti = async () => {
    try {
      const q = query(collection(db, 'users'), where('ruolo', 'in', ['consulente', 'admin']));
      const snap = await getDocs(q);
      setConsulenti(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Errore nel caricamento consulenti:', error);
    }
  };

  const caricaOperatori = async () => {
    try {
      const q = query(collection(db, 'users'), where('ruolo', 'in', ['operatore', 'admin']));
      const snap = await getDocs(q);
      setOperatoriList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Errore nel caricamento operatori:', error);
    }
  };

  const caricaReferenti = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const interni = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => ['admin', 'operatore', 'consulente'].includes(u.ruolo) && u.attivo !== false);
      setReferentiList(interni);
    } catch (error) {
      console.error('Errore nel caricamento referenti:', error);
    }
  };

  const caricaPreventivi = async () => {
    try {
      const snap = await getDocs(collection(db, 'preventivi'));
      setPreventivi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Errore nel caricamento preventivi:', error);
    }
  };

  const notificaOperatore = async (tipo, messaggio) => {
    if (userData?.ruolo !== 'operatore') return;
    try {
      await addDoc(collection(db, 'notifiche_admin'), {
        tipo,
        messaggio,
        operatore: userData.nome,
        createdAt: new Date().toISOString(),
        letta: false,
      });
    } catch (err) {
      console.error('Errore notifica operatore:', err);
    }
  };

  const handleSavePreventivo = async (datiPreventivo) => {
    try {
      const { pdfBlob, fileName, documentiDaAggiungere, docIdentitaCliente, isEdit, preventivoId, ...datiSenzaPdf } = datiPreventivo;

      // Auto-crea azienda se nuovo cliente (solo in creazione)
      let aziendaId = datiSenzaPdf.aziendaId;
      if (!isEdit && datiSenzaPdf.tipoCliente === 'nuovo' && datiSenzaPdf.nuovoCliente?.nome) {
        const nuovaAziendaRef = await addDoc(collection(db, 'aziende'), {
          societa: datiSenzaPdf.societa || 'consulting',
          nome: datiSenzaPdf.nuovoCliente.nome,
          indirizzo: datiSenzaPdf.nuovoCliente.indirizzo || '',
          telefono: datiSenzaPdf.nuovoCliente.telefono || '',
          email: datiSenzaPdf.nuovoCliente.email || '',
          partitaIva: datiSenzaPdf.nuovoCliente.piva || '',
          pec: datiSenzaPdf.nuovoCliente.pec || '',
          codiceUnivoco: datiSenzaPdf.nuovoCliente.codiceUnivoco || '',
          contatto: datiSenzaPdf.nuovoCliente.contatto || '',
          note: '',
          controlli: [],
          dipendenti: [],
          documenti: [],
          pagamenti: []
        });
        aziendaId = nuovaAziendaRef.id;
      }

      let pdfUrl = null;
      let pdfPath = null;
      let storageQuotaExceeded = false;
      try {
        const timestamp = Date.now();
        pdfPath = `preventivi/${timestamp}_${fileName}`;
        const storageRef = ref(storage, pdfPath);
        await uploadBytes(storageRef, pdfBlob);
        pdfUrl = await getDownloadURL(storageRef);
      } catch (storErr) {
        storageQuotaExceeded = true;
        toast.error(
          storErr.code === 'storage/quota-exceeded'
            ? 'Quota Storage Firebase esaurita. Il PDF viene scaricato in locale ma non salvato nel cloud.'
            : 'Upload PDF non riuscito. Il PDF viene scaricato in locale.',
          { duration: 6000 }
        );
      }
      const serviziPuliti = (datiSenzaPdf.servizi || []).map(servizio => {
        const { responsabileFile, responsabileFiles, ...servizioSenzaFile } = servizio;
        void responsabileFile;
        void responsabileFiles;
        return {
          ...servizioSenzaFile,
          dipendenti: (servizio.dipendenti || []).map(dipendente => {
            const { file, files, ...dipendenteSenzaFile } = dipendente;
            void file;
            void files;
            return dipendenteSenzaFile;
          })
        };
      });
      const preventivoCompleto = { ...datiSenzaPdf, servizi: serviziPuliti, aziendaId, pdfUrl, pdfPath, appuntamentoId: null };

      if (isEdit && preventivoId) {
        const updatePayloadPreventivo = { ...preventivoCompleto, dataModifica: new Date().toISOString() };
        if (motivazioneModifica) updatePayloadPreventivo.motivazioneModifica = motivazioneModifica;
        await updateDoc(doc(db, 'preventivi', preventivoId), updatePayloadPreventivo);
        setPreventivi(prev => prev.map(p => p.id === preventivoId ? { ...p, ...updatePayloadPreventivo, id: preventivoId } : p));
        setMotivazioneModifica('');
      } else {
        const nuovoPreventivo = { ...preventivoCompleto, dataCreazione: new Date().toISOString(), stato: 'da_fare' };
        const docRef = await addDoc(collection(db, 'preventivi'), nuovoPreventivo);
        setPreventivi(prev => [...prev, { id: docRef.id, ...nuovoPreventivo }]);
      }

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
          if (storageQuotaExceeded) continue;
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

        // Responsabile HACCP con doc. identità
        for (const servizio of (datiSenzaPdf.servizi || [])) {
          if (!servizio.descrizione?.includes('HACCP')) continue;
          const nomeResp = servizio.responsabile?.trim();
          const filesResp = servizio.responsabileFiles || (servizio.responsabileFile ? [servizio.responsabileFile] : []);
          if (!nomeResp && filesResp.length === 0) continue;
          const attestatiResp = [];
          if (!storageQuotaExceeded) for (const fileResp of filesResp) {
            const ts = `${Date.now()}_${crypto.randomUUID()}`;
            const docPath = `documenti/${aziendaId}/${ts}_${fileResp.name}`;
            const rRef = ref(storage, docPath);
            await uploadBytes(rRef, fileResp);
            const docUrl = await getDownloadURL(rRef);
            nuoviDocumenti.push({ id: crypto.randomUUID(), nome: `Doc. Identità - ${nomeResp || 'Resp. HACCP'}`, tipo: 'Documento di Identità', dataEmissione: '', dataScadenza: '', numeroDocumento: '', note: 'Responsabile Auto Controllo HACCP', pdfUrl: docUrl, pdfPath: docPath });
            attestatiResp.push({ id: crypto.randomUUID(), nome: 'Documento di Identità', dataScadenza: '', numeroAttestato: '', pdfUrl: docUrl, pdfPath: docPath });
          }
          if (nomeResp) {
            dipendentiModificati = true;
            const nomeParts = nomeResp.split(' ');
            const nomeCompleto = nomeResp.toLowerCase();
            const idxEsistente = dipendentiAggiornati.findIndex(d =>
              `${d.nome} ${d.cognome}`.toLowerCase().trim() === nomeCompleto
            );
            if (idxEsistente >= 0) {
              if (attestatiResp.length) dipendentiAggiornati[idxEsistente] = { ...dipendentiAggiornati[idxEsistente], attestati: [...(dipendentiAggiornati[idxEsistente].attestati || []), ...attestatiResp] };
            } else {
              dipendentiAggiornati.push({ id: crypto.randomUUID(), nome: nomeParts[0] || '', cognome: nomeParts.slice(1).join(' ') || '', mansione: 'Responsabile Auto Controllo', telefono: '', email: '', note: 'Aggiunto da preventivo HACCP', attestati: attestatiResp });
            }
          }
        }

        // Dipendenti per servizio (step 2)
        const noNomiServizi = ['HACCP', 'DVR', 'NOMINA MEDICO', 'VISITE MEDICHE', 'FORNITURA'];
        for (const servizio of (datiSenzaPdf.servizi || [])) {
          if (noNomiServizi.some(k => servizio.descrizione?.includes(k))) continue;
          for (const dip of (servizio.dipendenti || [])) {
            if (!dip.nome?.trim()) continue;
            dipendentiModificati = true;

            // Upload documento identità se presente
            const filesDip = dip.files || (dip.file ? [dip.file] : []);
            const nuoviAttestati = [];
            if (!storageQuotaExceeded) for (const fileDip of filesDip) {
              const ts = `${Date.now()}_${crypto.randomUUID()}`;
              const docPath = `documenti/${aziendaId}/${ts}_${fileDip.name}`;
              const dipRef = ref(storage, docPath);
              await uploadBytes(dipRef, fileDip);
              const docUrl = await getDownloadURL(dipRef);
              nuoviDocumenti.push({ id: crypto.randomUUID(), nome: `Doc. Identità - ${dip.nome}`, tipo: 'Documento di Identità', dataEmissione: '', dataScadenza: '', numeroDocumento: '', note: `Servizio: ${servizio.descrizione}`, pdfUrl: docUrl, pdfPath: docPath });
              nuoviAttestati.push({ id: crypto.randomUUID(), nome: 'Documento di Identità', dataScadenza: '', numeroAttestato: '', pdfUrl: docUrl, pdfPath: docPath });
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
        if (docIdentitaCliente?.length && !storageQuotaExceeded) for (const documentoCliente of docIdentitaCliente) {
          const ts = `${Date.now()}_${crypto.randomUUID()}`;
          const docPath = `documenti/${aziendaId}/${ts}_${documentoCliente.name}`;
          const docStorageRef = ref(storage, docPath);
          await uploadBytes(docStorageRef, documentoCliente);
          const docUrl = await getDownloadURL(docStorageRef);
          nuoviDocumenti.push({
            id: crypto.randomUUID(),
            nome: `Doc. Identità - ${datiSenzaPdf.nomeCliente || 'Cliente'}`,
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

      toast.success(
        storageQuotaExceeded
          ? (isEdit ? 'Preventivo modificato (salvato senza PDF nel cloud).' : 'Preventivo salvato (PDF solo in locale).')
          : (isEdit ? 'Preventivo modificato e salvato!' : 'Preventivo generato e salvato!')
      );
      const nomeClientePreventivo = datiSenzaPdf.nomeCliente || '';
      await notificaOperatore(
        isEdit ? 'modifica_preventivo' : 'nuovo_preventivo',
        `${userData.nome} ha ${isEdit ? 'modificato' : 'creato'} un preventivo${nomeClientePreventivo ? ` per ${nomeClientePreventivo}` : ''}`
      );
      if (pdfUrl) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = fileName;
        link.click();
      } else {
        const localUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = localUrl;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(localUrl), 3000);
      }
      setMostraModalePreventivo(false);
      setPreventivoInModifica(null);
    } catch (err) {
      console.error('Errore salvataggio preventivo:', err);
      toast.error('Errore nel salvataggio del preventivo');
    }
  };

  const handleSaveContratto = async ({ pdfBlob, fileName, isEdit, contrattoId, ...contratto }) => {
    try {
      // cliente non ancora registrato: lo si crea in Aziende (e da lì arriva in contabilità)
      let aziendaId = contratto.aziendaId;
      if (!aziendaId) {
        const c = contratto.cliente;
        const nuova = await addDoc(collection(db, 'aziende'), {
          societa: contratto.societa || 'consulting',
          nome: c.ragioneSociale, indirizzo: c.sedeLegale || '', telefono: c.telefono || '', email: c.email || '',
          partitaIva: c.piva || '', pec: c.pec || '', codiceUnivoco: '', contatto: c.rappresentante || '', note: '',
          controlli: [], dipendenti: [], documenti: [], pagamenti: [],
        });
        aziendaId = nuova.id;
      }
      let pdfUrl = null, pdfPath = null;
      try {
        pdfPath = `contratti/${Date.now()}_${fileName}`;
        const r = ref(storage, pdfPath);
        await uploadBytes(r, pdfBlob, { contentType: 'application/pdf' });
        pdfUrl = await getDownloadURL(r);
      } catch (e) {
        console.error(e); pdfUrl = null; pdfPath = null;
        toast.error('PDF non caricato nel cloud: viene scaricato solo in locale', { duration: 6000 });
      }
      const [a, m, g] = contratto.data.split('-').map(Number);
      const scadenza = new Date(Date.UTC(a + 3, m - 1, g)).toISOString().slice(0, 10);
      const dati = { ...contratto, aziendaId, scadenza, ...(pdfUrl ? { pdfUrl, pdfPath } : {}) };
      if (isEdit && contrattoId) await updateDoc(doc(db, 'contratti', contrattoId), { ...dati, dataModifica: new Date().toISOString() });
      else await addDoc(collection(db, 'contratti'), { ...dati, stato: 'attivo', dataCreazione: new Date().toISOString() });
      const url = pdfUrl || URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.target = '_blank'; link.click();
      if (!pdfUrl) setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success(isEdit ? 'Contratto aggiornato' : 'Contratto salvato');
      await notificaOperatore(isEdit ? 'modifica_contratto' : 'nuovo_contratto',
        `${userData.nome} ha ${isEdit ? 'modificato' : 'creato'} il contratto di ${contratto.cliente.ragioneSociale}`);
      setModaleContratto(null);
    } catch (err) {
      console.error('Errore salvataggio contratto:', err);
      toast.error('Errore nel salvataggio del contratto');
    }
  };

  const handleSavePagamentoPreventivo = async (datiPagamento, file) => {
    if (!preventivoPerPagamento) return;
    try {
      let pdfUrl = null;
      let pdfPath = null;
      if (file) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        pdfPath = `pagamenti-preventivi/${preventivoPerPagamento.id}/${fileName}`;
        const storageRef = ref(storage, pdfPath);
        await uploadBytes(storageRef, file);
        pdfUrl = await getDownloadURL(storageRef);
      }
      const nuovoPagamento = { ...datiPagamento, id: crypto.randomUUID(), pdfUrl, pdfPath };
      const pagamenti = [...(preventivoPerPagamento.pagamenti || []), nuovoPagamento];
      await updateDoc(doc(db, 'preventivi', preventivoPerPagamento.id), { pagamenti });
      setPreventivi(prev => prev.map(p => p.id === preventivoPerPagamento.id ? { ...p, pagamenti } : p));
      setPreventivoPerPagamento(null);
      toast.success('Pagamento registrato!');
    } catch (err) {
      console.error(err);
      toast.error('Errore nel salvataggio del pagamento');
    }
  };

  const handleSelectAzienda = (azienda) => setAziendaSelezionataId(azienda.id);
  const handleBack = () => setAziendaSelezionataId(null);
  const handleNavigaAzienda = (aziendaId, tab) => {
    setTabAzienda(tab || 'controlli');
    setAziendaSelezionataId(aziendaId);
    setNavKey(k => k + 1);
  };
  const handleAddAzienda = () => setMostraModaleAzienda(true);

  const handleSaveAzienda = async (nuovaAzienda) => {
    setSaving(true);
    try {
      const { emailAccesso, passwordAccesso, ...datiAzienda } = nuovaAzienda;
      const aziendaCompleta = {
        ...datiAzienda,
        controlli: [],
        dipendenti: [],
        documenti: [],
        pagamenti: []
      };

      await addDoc(collection(db, 'aziende'), aziendaCompleta);
      // onSnapshot aggiorna aziende automaticamente

      toast.success('Azienda aggiunta con successo!');

      await notificaOperatore('nuova_azienda', `${userData.nome} ha aggiunto l'azienda ${nuovaAzienda.nome}`);
      setMostraModaleAzienda(false);
    } catch (error) {
      console.error("Errore nell'aggiunta dell'azienda:", error);
      toast.error("Errore nell'aggiunta dell'azienda");
    } finally {
      setSaving(false);
    }
  };

  const handleAddControllo = async (azId, nuovoControllo) => {
    try {
      const azienda = aziende.find(az => az.id === azId);
      const controlloCompleto = { ...nuovoControllo, id: crypto.randomUUID() };
      const controlliAggiornati = [...azienda.controlli, controlloCompleto];
      await updateDoc(doc(db, 'aziende', azId), { controlli: controlliAggiornati });
      toast.success('Controllo aggiunto con successo!');
    } catch (error) {
      console.error("Errore nell'aggiunta del controllo:", error);
      toast.error("Errore nell'aggiunta del controllo");
    }
  };

  const aggiungiTipoControllo = () => {
    const valore = nuovoTipoControllo.trim();
    if (!valore) return;
    const esiste = [...TIPI_CONTROLLO, ...tipiControlloPersonalizzati].some(
      t => t.toLowerCase() === valore.toLowerCase()
    );
    if (esiste) {
      toast.error('Questo tipo di controllo esiste già');
      return;
    }
    const nuoviTipi = [...tipiControlloPersonalizzati, valore];
    setTipiControlloPersonalizzati(nuoviTipi);
    setNuovoTipoControllo('');
    setDoc(doc(db, 'config', 'tipiControllo'), { tipi: nuoviTipi }).catch(err =>
      console.error('Errore salvataggio tipi controllo:', err)
    );
  };

  const handleUpdateAzienda = async (azId, datiAggiornati) => {
    try {
      const az = aziende.find(a => a.id === azId);
      await updateDoc(doc(db, 'aziende', azId), datiAggiornati);
      toast.success('Azienda modificata con successo!');
      await notificaOperatore('modifica_azienda', `${userData.nome} ha modificato l'azienda ${az?.nome || ''}`);
    } catch (error) {
      console.error('Errore nella modifica:', error);
      toast.error("Errore nella modifica dell'azienda");
    }
  };

  const handleCambiaStatoAzienda = async (azId, stato) => {
    try {
      await updateDoc(doc(db, 'aziende', azId), { stato });
      toast.success('Stato aggiornato!');
    } catch (error) {
      console.error('Errore aggiornamento stato:', error);
      toast.error("Errore nell'aggiornamento dello stato");
    }
  };

  const handleImportAziende = async (listaAziende) => {
    const batch = listaAziende.map(az => {
      const controlli = [];
      if (az.scadenzaDvr) controlli.push({ id: crypto.randomUUID(), tipo: 'DVR', scadenza: az.scadenzaDvr, completato: false, note: '' });
      if (az.scadenzaHaccp) controlli.push({ id: crypto.randomUUID(), tipo: 'HACCP', scadenza: az.scadenzaHaccp, completato: false, note: '' });
      return addDoc(collection(db, 'aziende'), {
        nome: az.nome || '',
        contatto: az.contatto || '',
        indirizzo: az.indirizzo || '',
        telefono: az.telefono || '',
        email: az.email || '',
        pec: az.pec || '',
        partitaIva: az.partitaIva || '',
        note: az.note || '',
        codiceUnivoco: '',
        controlli,
        dipendenti: [],
        documenti: [],
        pagamenti: [],
      });
    });
    await Promise.all(batch);
  };

  const handleDeleteAzienda = (azId) => {
    const az = aziende.find(a => a.id === azId);
    setConfirm({
      message: 'Sei sicuro di voler eliminare questa azienda? Questa operazione non può essere annullata.',
      onConfirm: async () => {
        setConfirm(null);
        setSaving(true);
        try {
          await deleteDoc(doc(db, 'aziende', azId));
          if (aziendaSelezionataId === azId) setAziendaSelezionataId(null);
          toast.success('Azienda eliminata con successo!');
          await notificaOperatore('elimina_azienda', `${userData.nome} ha eliminato l'azienda ${az?.nome || ''}`);
        } catch (error) {
          console.error("Errore nell'eliminazione:", error);
          toast.error("Errore nell'eliminazione dell'azienda");
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleDeletePreventivo = (prevId) => {
    if (userData?.ruolo !== 'admin') return;
    setConfirm({
      message: 'Sei sicuro di voler eliminare questo preventivo? Questa operazione non può essere annullata.',
      onConfirm: async () => {
        setConfirm(null);
        setSaving(true);
        try {
          await deleteDoc(doc(db, 'preventivi', prevId));
          setPreventivi(p => p.filter(x => x.id !== prevId));
          toast.success('Preventivo eliminato con successo!');
        } catch (error) {
          console.error("Errore nell'eliminazione del preventivo:", error);
          toast.error("Errore nell'eliminazione del preventivo");
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleCambiaStatoPreventivo = async (prevId, stato) => {
    try {
      await updateDoc(doc(db, 'preventivi', prevId), { stato });
      setPreventivi(prev => prev.map(p => p.id === prevId ? { ...p, stato } : p));
      toast.success('Stato aggiornato!');
    } catch (error) {
      console.error('Errore aggiornamento stato preventivo:', error);
      toast.error("Errore nell'aggiornamento dello stato");
    }
  };

  const handleArchiviaAzienda = (azId) => {
    const az = aziende.find(a => a.id === azId);
    setConfirm({
      message: "Vuoi archiviare questa azienda? Potrai ripristinarla in qualsiasi momento.",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await updateDoc(doc(db, 'aziende', azId), { archiviata: true });
          toast.success('Azienda archiviata');
          await notificaOperatore('archivia_azienda', `${userData.nome} ha archiviato l'azienda ${az?.nome || ''}`);
        } catch (err) {
          toast.error("Errore nell'archiviazione");
        }
      }
    });
  };

  const handleRipristinaAzienda = async (azId) => {
    const az = aziende.find(a => a.id === azId);
    try {
      await updateDoc(doc(db, 'aziende', azId), { archiviata: false });
      toast.success('Azienda ripristinata');
      await notificaOperatore('ripristina_azienda', `${userData.nome} ha ripristinato l'azienda ${az?.nome || ''}`);
    } catch (err) {
      toast.error('Errore nel ripristino');
    }
  };

  const handleSaveAppuntamento = async (appId, datiAppuntamento) => {
    try {
      const { id: _ignore, ...payload } = datiAppuntamento;
      const isModifica = !!appId;
      if (appId) {
        await setDoc(doc(db, 'appuntamenti', String(appId)), payload, { merge: true });
        toast.success('Appuntamento modificato con successo!');
      } else {
        await addDoc(collection(db, 'appuntamenti'), payload);
        toast.success('Appuntamento aggiunto con successo!');
      }

      const az = aziende.find(a => a.id === datiAppuntamento.aziendaId);
      const nomeCliente = az?.nome || datiAppuntamento.nuovoCliente?.nome || 'cliente';
      const dataF = datiAppuntamento.data ? datiAppuntamento.data.split('-').reverse().join('/') : '';
      const azione = isModifica ? 'modificato' : 'aggiunto';

      // Notifica admin se è un consulente o operatore
      if (userData.ruolo === 'consulente' || userData.ruolo === 'operatore') {
        const messaggio = `${userData.nome} ha ${azione} un appuntamento con ${nomeCliente}${dataF ? ` per il ${dataF}` : ''}`;
        await addDoc(collection(db, 'notifiche_admin'), {
          tipo: isModifica ? 'modifica_appuntamento' : 'nuovo_appuntamento',
          messaggio,
          consulente: userData.ruolo === 'consulente' ? userData.nome : undefined,
          operatore: userData.ruolo === 'operatore' ? userData.nome : undefined,
          aziendaNome: nomeCliente,
          dataAppuntamento: datiAppuntamento.data || '',
          createdAt: new Date().toISOString(),
          letta: false,
        });
      }

      // Notifica all'assegnatario se diverso dall'utente corrente
      if (datiAppuntamento.consulente) {
        const assegnatario = consulenti.find(c => c.nome === datiAppuntamento.consulente);
        if (assegnatario && assegnatario.id !== userData.id) {
          const messaggio = `${userData.nome} ti ha ${azione} un appuntamento con ${nomeCliente}${dataF ? ` per il ${dataF}` : ''}`;
          await addDoc(collection(db, 'notifiche_operatori'), {
            operatoreId: assegnatario.id,
            titolo: isModifica ? 'Appuntamento modificato' : 'Nuovo appuntamento',
            messaggio,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio appuntamento:', error);
      toast.error("Errore nel salvataggio dell'appuntamento");
      throw error;
    }
  };

  const handleDeleteAppuntamento = async (appId) => {
    try {
      const app = appuntamenti.find(a => a.id === appId);
      const az = aziende.find(a => a.id === app?.aziendaId);
      const nomeCliente = az?.nome || app?.nuovoCliente?.nome || '';
      await deleteDoc(doc(db, 'appuntamenti', String(appId)));
      toast.success('Appuntamento eliminato con successo!');
      await notificaOperatore('elimina_appuntamento', `${userData.nome} ha eliminato un appuntamento${nomeCliente ? ` con ${nomeCliente}` : ''}`);
    } catch (error) {
      console.error("Errore nell'eliminazione appuntamento:", error);
      toast.error("Errore nell'eliminazione dell'appuntamento");
    }
  };

  if (loading) {
    return (
      <div className="App">
        <h1><Icona nome="scudo" testo />NSGroup</h1>
        <p>Caricamento in corso...</p>
      </div>
    );
  }

  if (!user || !userData) {
    return <Login onLogin={login} />;
  }

  const isAdmin = userData.ruolo === 'admin' || userData.ruolo === 'operatore';

  const vociNav = isAdmin ? [
    { id: 'dashboard', label: 'Home', icona: 'home' },
    { id: 'agenda', label: 'Agenda', icona: 'agenda' },
    { id: 'planning', label: 'Planning', icona: 'planning' },
    { id: 'utenti', label: 'Utenti', icona: 'utenti' },
    { id: 'preventivi', label: 'Preventivi', icona: 'preventivi' },
    ...(userData.ruolo === 'admin' ? [{ id: 'contabilita', label: 'Contabilità', icona: 'contabilita' }] : []),
    { id: 'listino', label: 'Listino', icona: 'listino' },
    { id: 'impostazioni', label: 'Impostazioni', icona: 'impostazioni' },
  ] : userData.ruolo === 'consulente' ? [
    { id: 'agenda', label: 'Agenda', icona: 'agenda' },
    { id: 'aziende', label: 'Aziende', icona: 'aziende' },
    { id: 'preventivi', label: 'Preventivi', icona: 'preventivi' },
  ] : userData.ruolo === 'azienda' ? [
    { id: 'portale', label: PORTALE_ESTERNO.label, icona: 'portale', href: PORTALE_ESTERNO.url },
  ] : [];

  // Dalla scheda di un'azienda, una voce del menu riporta alla vista scelta
  const handleVoceNav = id => {
    if (isAdmin) setAziendaSelezionataId(null);
    setVistaCorrente(id);
  };

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--ink)',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '14px'
          }
        }}
      />

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}

      <Navigazione
        voci={vociNav}
        attiva={isAdmin && aziendaSelezionata ? 'dashboard' : vistaCorrente}
        onSeleziona={handleVoceNav}
        userData={userData}
        onLogout={logout}
        isMobile={isMobile}
        strumenti={isAdmin ? (
          <>
            <RicercaGlobale
              aziende={aziendAttive}
              appuntamenti={appuntamenti}
              preventivi={preventivi}
              onSelectAzienda={handleSelectAzienda}
              onVistaChange={setVistaCorrente}
            />
            <PannelloNotifiche aziende={aziende} onNavigaAzienda={handleNavigaAzienda} />
          </>
        ) : null}
        notificheCompatte={userData.ruolo === 'admin' ? (
          <PannelloNotifiche aziende={aziende} compact={true} onNavigaAzienda={handleNavigaAzienda} />
        ) : null}
      >
      <div className="App">
        {/* ADMIN / OPERATORE - Vede tutto */}
        {isAdmin && !aziendaSelezionata && (
          <>
            {vistaCorrente === 'dashboard' && (
              <>
                <Dashboard
                  aziende={aziendAttive}
                  ricerca={ricerca}
                  onRicerca={setRicerca}
                  appuntamenti={appuntamenti}
                  preventivi={preventivi}
                  giorniPreavviso={giorniPreavviso}
                  isMobile={isMobile}
                  ricercaGlobaleProps={isMobile ? { aziende: aziendAttive, appuntamenti, preventivi, onSelectAzienda: handleSelectAzienda, onVistaChange: setVistaCorrente } : null}
                />
                <ListaAziende
                  aziende={aziendeFiltrate}
                  onSelectAzienda={handleSelectAzienda}
                  onAddAzienda={handleAddAzienda}
                  onDeleteAzienda={handleDeleteAzienda}
                  onImportAziende={handleImportAziende}
                  onArchiviaAzienda={handleArchiviaAzienda}
                  onRipristinaAzienda={handleRipristinaAzienda}
                  ricerca={ricerca}
                  onRicerca={setRicerca}
                  isMobile={isMobile}
                />
              </>
            )}

            {vistaCorrente === 'agenda' && (
              <Agenda
                appuntamenti={appuntamenti}
                aziende={aziende}
                consulenti={consulenti}
                onSaveAppuntamento={handleSaveAppuntamento}
                onDeleteAppuntamento={handleDeleteAppuntamento}
                canDelete={true}
                userRole={userData.ruolo}
                userData={userData}
                listino={listino}
                serviziExtra={serviziExtra}
                tuttiIServizi={tuttiIServizi}
                checklistVoci={checklistVoci}
              />
            )}

            {vistaCorrente === 'planning' && (
              <PaginaPlanning operatori={operatoriList} userData={userData} />
            )}

            {vistaCorrente === 'utenti' && (
              <GestioneUtenti aziende={aziende} utenteCorrente={userData} />
            )}

            {userData.ruolo === 'admin' && vistaCorrente === 'contabilita' && (
              <ContabilitaGruppo utente={userData.nome} />
            )}

            {vistaCorrente === 'preventivi' && (
              <PaginaPreventivi
                preventivi={preventivi}
                titolo="Preventivi"
                showNuovo
                onNuovo={() => setMostraModalePreventivo(true)}
                contratti={contratti}
                onNuovoContratto={() => setModaleContratto({})}
                onContratto={(prev, contratto) => setModaleContratto({ preventivo: prev, contratto })}
                onDettaglio={setPreventivoDettaglio}
                onPagamento={setPreventivoPerPagamento}
                onModifica={prev => { setPreventivoInModifica(prev); setMostraModalePreventivo(true); }}
                onElimina={userData.ruolo === 'admin' ? handleDeletePreventivo : undefined}
                canCambiaStato
                onCambiaStato={handleCambiaStatoPreventivo}
                isMobile={isMobile}
              />
            )}

            {modaleContratto && (
              <ModaleContratto
                onClose={() => setModaleContratto(null)}
                onSave={handleSaveContratto}
                aziende={aziendAttive}
                preventivo={modaleContratto.preventivo}
                contrattoInModifica={modaleContratto.contratto}
                userData={userData}
              />
            )}

            {mostraModalePreventivo && (
              <ModalePreventivo
                onClose={() => { setMostraModalePreventivo(false); setPreventivoInModifica(null); }}
                onSave={handleSavePreventivo}
                aziende={aziendAttive}
                appuntamento={null}
                userData={userData}
                preventivoInModifica={preventivoInModifica}
                listino={listino}
                serviziExtra={serviziExtra}
                tuttiIServizi={tuttiIServizi}
                checklistVoci={checklistVoci}
              />
            )}

            {vistaCorrente === 'listino' && (
              <PaginaListino />
            )}

            {vistaCorrente === 'impostazioni' && (
              <Impostazioni
                giorniPreavviso={giorniPreavviso}
                onUpdate={setGiorniPreavviso}
              />
            )}
          </>
        )}

        {/* ADMIN / OPERATORE - Scheda azienda con tutti i permessi */}
        {isAdmin && aziendaSelezionata && (
          <SchedaAzienda
            key={navKey}
            azienda={aziendaSelezionata}
            onBack={handleBack}
            onAddControllo={handleAddControllo}
            onUpdateAzienda={handleUpdateAzienda}
            tipiControllo={TIPI_CONTROLLO}
            readOnly={false}
            aziende={aziende}
            preventivi={preventivi}
            tabIniziale={tabAzienda}
            referenti={referentiList}
            userData={userData}
            onDeletePreventivo={handleDeletePreventivo}
          />
        )}

        {/* CONSULENTE - Agenda + Preventivi */}
        {userData.ruolo === 'consulente' && (
          <div>
            {vistaCorrente === 'agenda' && (
              <Agenda
                appuntamenti={appuntamenti}
                aziende={aziende}
                consulenti={consulenti}
                onSaveAppuntamento={handleSaveAppuntamento}
                onDeleteAppuntamento={handleDeleteAppuntamento}
                canDelete={false}
                userRole={userData.ruolo}
                userData={userData}
                listino={listino}
                serviziExtra={serviziExtra}
                tuttiIServizi={tuttiIServizi}
                checklistVoci={checklistVoci}
              />
            )}

            {vistaCorrente === 'aziende' && (
              <PaginaAziendeAssegnate
                tutteLeAziende
                aziende={aziende}
                userData={userData}
                preventivi={preventivi}
                tipiControllo={TIPI_CONTROLLO}
                onUpdateAzienda={() => {}}
                onAddControllo={() => {}}
                onCambiaStato={handleCambiaStatoAzienda}
                isMobile={isMobile}
              />
            )}

            {modaleContratto && (
              <ModaleContratto
                onClose={() => setModaleContratto(null)}
                onSave={handleSaveContratto}
                aziende={aziendAttive}
                preventivo={modaleContratto.preventivo}
                contrattoInModifica={modaleContratto.contratto}
                userData={userData}
              />
            )}

            {mostraModalePreventivo && (
              <ModalePreventivo
                onClose={() => { setMostraModalePreventivo(false); setPreventivoInModifica(null); }}
                onSave={handleSavePreventivo}
                aziende={aziendAttive}
                appuntamento={null}
                userData={userData}
                preventivoInModifica={preventivoInModifica}
                listino={listino}
                serviziExtra={serviziExtra}
                tuttiIServizi={tuttiIServizi}
                checklistVoci={checklistVoci}
              />
            )}

            {vistaCorrente === 'preventivi' && (
              <PaginaPreventivi
                preventivi={preventivi}
                titolo="I miei preventivi"
                contratti={contratti}
                onContratto={(prev, contratto) => setModaleContratto({ preventivo: prev, contratto })}
                onDettaglio={setPreventivoDettaglio}
                onPagamento={setPreventivoPerPagamento}
                onModifica={prev => { setPreventivoPerModifica(prev); setMotivazioneTemp(''); setMostraPromptMotivazione(true); }}
                canCambiaStato={false}
                isMobile={isMobile}
              />
            )}
          </div>
        )}

        {/* AZIENDA - Solo visualizzazione propri dati */}
        {userData.ruolo === 'azienda' && aziendaSelezionata && (
          <SchedaAzienda
            azienda={aziendaSelezionata}
            onBack={() => {}}
            onAddControllo={() => {}}
            onUpdateAzienda={() => {}}
            tipiControllo={TIPI_CONTROLLO}
            readOnly={true}
            userData={userData}
          />
        )}
        {userData.ruolo === 'azienda' && !aziendaSelezionata && (
          <p style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 40 }}>
            Nessun dato disponibile per la tua azienda. Contatta NS Consulting.
          </p>
        )}

        {mostraModaleAzienda && (
          <ModaleAzienda
            onClose={() => setMostraModaleAzienda(false)}
            onSave={handleSaveAzienda}
            saving={saving}
            aziende={aziende}
            referenti={referentiList}
          />
        )}

        {preventivoPerPagamento && (
          <ModalePagamento
            onClose={() => setPreventivoPerPagamento(null)}
            onSave={handleSavePagamentoPreventivo}
          />
        )}

        {preventivoDettaglio && (() => {
          const p = preventivoDettaglio;
          const serviziAttivi = (p.servizi || []).filter(s => parseInt(s.quantita) > 0);
          const pagamenti = p.pagamenti || [];
          const pagato = pagamenti.reduce((s, pg) => s + (parseFloat(pg.importo) || 0), 0);
          const residuo = Math.max(0, (p.totale || 0) - pagato);
          return (
            <div onClick={() => setPreventivoDettaglio(null)}
              style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1100, padding: isMobile ? 0 : 20 }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background: 'white', borderRadius: isMobile ? '16px 16px 0 0' : 12, width: '100%', maxWidth: isMobile ? '100%' : 560, maxHeight: isMobile ? '92vh' : '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-pop)' }}>

                {/* Header */}
                <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ minWidth: 0, paddingRight: 8 }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? 15 : 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Icona nome="elenco" testo />{p.nomeCliente}</h3>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2, textTransform: 'capitalize' }}>{p.tipoDocumento || 'preventivo'}</div>
                  </div>
                  <button onClick={() => setPreventivoDettaglio(null)}
                    style={{ border: 'none', background: 'var(--surface-2)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--ink-muted)', flexShrink: 0 }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', padding: isMobile ? 14 : 20, flex: 1 }}>

                  {/* Info generali */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    {[
                      ['Data', p.data ? new Date(p.data + 'T12:00:00').toLocaleDateString('it-IT') : '—'],
                      ['Consulente', p.consulente || '—'],
                      ['Totale', `€ ${p.totale?.toFixed(2) || '0.00'}`],
                      ['Creato il', p.dataCreazione ? new Date(p.dataCreazione).toLocaleDateString('it-IT') : '—'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Servizi */}
                  {serviziAttivi.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}><Icona nome="elenco" testo />Servizi</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {serviziAttivi.map(s => {
                          const qty = parseFloat(s.quantita) || 0;
                          const pu = parseFloat(s.prezzoUnitario) || 0;
                          const tot = s.omaggio ? 0 : qty * pu;
                          const hasDip = (s.dipendenti || []).some(d => d.nome?.trim());
                          return (
                            <div key={s.id} style={{ background: hasDip ? '#f0f9ff' : 'var(--surface-2)', border: `1px solid ${hasDip ? '#bae6fd' : 'var(--line)'}`, borderRadius: 8, padding: '10px 12px' }}>
                              {/* Riga descrizione + totale */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: hasDip || isMobile ? 6 : 0 }}>
                                <span style={{ fontSize: 13, color: hasDip ? '#0369a1' : 'var(--ink)', fontWeight: 600, flex: 1 }}>{s.descrizione}</span>
                                <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {s.omaggio ? 'OMAGGIO' : `€ ${tot.toFixed(2)}`}
                                </span>
                              </div>
                              {/* Riga qtà + prezzo unit */}
                              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-muted)' }}>
                                <span>× {s.quantita}</span>
                                <span>{s.omaggio ? 'Gratuito' : `€ ${pu.toFixed(2)} / cad.`}</span>
                              </div>
                              {hasDip && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4, borderTop: '1px dashed #bae6fd', paddingTop: 6 }}>
                                  {(s.dipendenti || []).filter(d => d.nome?.trim()).map((dip, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#0369a1' }}><Icona nome="utente" testo />{dip.nome}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '2px solid var(--line)' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600 }}>Totale:</span>
                        <span style={{ fontSize: 17, color: 'var(--success)', fontWeight: 800 }}>€ {p.totale?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  )}

                  {p.motivazioneModifica && (
                    <div style={{ marginBottom: 16, padding: 12, background: 'var(--warning-soft)', borderRadius: 8, border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, marginBottom: 4 }}><Icona nome="nota" testo />Motivazione modifica</div>
                      <div style={{ fontSize: 13, color: 'var(--warning)' }}>{p.motivazioneModifica}</div>
                    </div>
                  )}

                  {/* Pagamenti */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}><Icona nome="carta" testo />Pagamenti ricevuti</h4>
                      <button onClick={() => { setPreventivoDettaglio(null); setPreventivoPerPagamento(p); }}
                        style={{ padding: '5px 12px', background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid #86efac', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        + Aggiungi
                      </button>
                    </div>
                    {pagamenti.length === 0 ? (
                      <p style={{ color: 'var(--ink-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Nessun pagamento registrato</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pagamenti.map((pg, i) => (
                          <div key={pg.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--success-soft)', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>€ {parseFloat(pg.importo).toFixed(2)}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                                {pg.data ? new Date(pg.data + 'T12:00:00').toLocaleDateString('it-IT') : '—'}
                                {pg.metodoPagamento ? ` · ${pg.metodoPagamento}` : ''}
                                {pg.numeroFattura ? ` · ${pg.numeroFattura}` : ''}
                              </div>
                              {pg.descrizione && <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 1 }}>{pg.descrizione}</div>}
                            </div>
                            {pg.pdfUrl && (
                              <a href={pg.pdfUrl} target="_blank" rel="noreferrer"
                                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}><Icona nome="documento" testo />Doc</a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '2px solid var(--line)' }}>
                      <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>Pagato: € {pagato.toFixed(2)}</div>
                      <div style={{ fontSize: 13, color: residuo > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                        {residuo > 0 ? `Residuo: € ${residuo.toFixed(2)}` : 'Saldato'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: isMobile ? '12px 16px' : '12px 20px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
                  <button onClick={() => setPreventivoDettaglio(null)}
                    style={{ width: isMobile ? '100%' : 'auto', float: isMobile ? 'none' : 'right', padding: '11px 20px', border: '1px solid var(--line)', borderRadius: 10, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {mostraPromptMotivazione && (
          <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
            <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-pop)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}><Icona nome="modifica" testo />Motivazione modifica</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-muted)' }}>
                Stai modificando il preventivo di <strong>{preventivoPerModifica?.nomeCliente}</strong>.<br />
                Inserisci la motivazione della modifica.
              </p>
              <textarea
                value={motivazioneTemp}
                onChange={e => setMotivazioneTemp(e.target.value)}
                rows={3}
                placeholder="Es. Aggiornamento prezzi, correzione servizi richiesti..."
                autoFocus
                style={{ width: '100%', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  onClick={() => { setMostraPromptMotivazione(false); setPreventivoPerModifica(null); setMotivazioneTemp(''); }}
                  style={{ padding: '9px 18px', border: '1px solid var(--line)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    if (!motivazioneTemp.trim()) { toast.error('Inserisci una motivazione!'); return; }
                    setMotivazioneModifica(motivazioneTemp.trim());
                    setPreventivoInModifica(preventivoPerModifica);
                    setMostraModalePreventivo(true);
                    setMostraPromptMotivazione(false);
                  }}
                  style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  Continua →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </Navigazione>
    </>
  );
}

export default App;
