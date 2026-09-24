import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';

// Il CRM di NS Safety è una pagina HTML autonoma (public/crm-safety.html) caricata in un iframe.
// Qui gli prepariamo l'archivio: le collezioni Firestore crm_safety_* e gli allegati su Storage.
// Il CRM lo legge da window.parent.NS_CRM con la stessa forma dell'interfaccia che si aspetta.
const PREFISSO = 'crm_safety_';
const COLL_ALLEGATI = `${PREFISSO}allegati`;

// Firestore rifiuta i campi undefined: il giro in JSON li toglie
const pulisci = (dati) => JSON.parse(JSON.stringify(dati));

function creaArchivio(utente) {
  const ascolti = [];

  const archivio = {
    utente,
    collection: (nome) => ({
      onSnapshot: (ok, errore) => {
        const stop = onSnapshot(collection(db, PREFISSO + nome), ok, errore);
        ascolti.push(stop);
        return stop;
      },
      doc: (id) => ({
        set: (dati) => setDoc(doc(db, PREFISSO + nome, id), pulisci(dati)),
        delete: () => deleteDoc(doc(db, PREFISSO + nome, id)),
      }),
    }),
    allegati: {
      async elenco(chiave) {
        const snap = await getDocs(query(collection(db, COLL_ALLEGATI), where('chiave', '==', chiave)));
        return snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => String(b.caricato).localeCompare(String(a.caricato)));
      },
      async salva(rec) {
        const { blob, ...meta } = rec;
        const percorso = `crm_safety/allegati/${rec.id}/${rec.nome}`;
        await uploadBytes(ref(storage, percorso), blob, { contentType: rec.mime });
        const url = await getDownloadURL(ref(storage, percorso));
        await setDoc(doc(db, COLL_ALLEGATI, rec.id), pulisci({ ...meta, percorso, url }));
      },
      async elimina(a) {
        if (a.percorso) await deleteObject(ref(storage, a.percorso)).catch(() => {});
        await deleteDoc(doc(db, COLL_ALLEGATI, a.id));
      },
      sposta: (a, chiave) => updateDoc(doc(db, COLL_ALLEGATI, a.id), { chiave }),
    },
  };

  const chiudi = () => ascolti.splice(0).forEach((stop) => stop());
  return { archivio, chiudi };
}

export default function CrmSafety({ utente }) {
  const cornice = useRef(null);

  // L'iframe riceve l'indirizzo solo dopo che l'archivio è pronto, così il CRM lo trova all'avvio
  useEffect(() => {
    const { archivio, chiudi } = creaArchivio(utente);
    window.NS_CRM = archivio;
    const iframe = cornice.current;
    iframe.src = '/crm-safety.html';
    return () => {
      iframe.src = 'about:blank';
      chiudi();
      delete window.NS_CRM;
    };
  }, [utente]);

  return <iframe ref={cornice} className="crm-frame" title="Contabilità NS Safety" />;
}

CrmSafety.propTypes = { utente: PropTypes.string };
