import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';

// Il CRM contabilità è una pagina HTML autonoma (public/crm-contabilita.html) caricata in un iframe.
// Qui gli prepariamo l'archivio dell'azienda: le collezioni Firestore crm_<azienda>_* e gli allegati su Storage.
// Il CRM lo legge da window.parent.NS_CRM con la stessa forma dell'interfaccia che si aspetta.

// Firestore rifiuta i campi undefined: il giro in JSON li toglie
const pulisci = (dati) => JSON.parse(JSON.stringify(dati));

function creaArchivio(azienda, nomeAzienda, utente) {
  const prefisso = `crm_${azienda}_`;
  const collAllegati = `${prefisso}allegati`;
  const ascolti = [];

  const archivio = {
    utente,
    azienda: nomeAzienda,
    collection: (nome) => ({
      onSnapshot: (ok, errore) => {
        const stop = onSnapshot(collection(db, prefisso + nome), ok, errore);
        ascolti.push(stop);
        return stop;
      },
      doc: (id) => ({
        set: (dati) => setDoc(doc(db, prefisso + nome, id), pulisci(dati)),
        delete: () => deleteDoc(doc(db, prefisso + nome, id)),
      }),
    }),
    allegati: {
      async elenco(chiave) {
        const snap = await getDocs(query(collection(db, collAllegati), where('chiave', '==', chiave)));
        return snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => String(b.caricato).localeCompare(String(a.caricato)));
      },
      async salva(rec) {
        const { blob, ...meta } = rec;
        const percorso = `crm_${azienda}/allegati/${rec.id}/${rec.nome}`;
        await uploadBytes(ref(storage, percorso), blob, { contentType: rec.mime });
        const url = await getDownloadURL(ref(storage, percorso));
        await setDoc(doc(db, collAllegati, rec.id), pulisci({ ...meta, percorso, url }));
      },
      async elimina(a) {
        if (a.percorso) await deleteObject(ref(storage, a.percorso)).catch(() => {});
        await deleteDoc(doc(db, collAllegati, a.id));
      },
      sposta: (a, chiave) => updateDoc(doc(db, collAllegati, a.id), { chiave }),
    },
  };

  const chiudi = () => ascolti.splice(0).forEach((stop) => stop());
  return { archivio, chiudi };
}

export default function CrmContabilita({ azienda, nomeAzienda, utente, className, style }) {
  const cornice = useRef(null);

  // L'iframe riceve l'indirizzo solo dopo che l'archivio è pronto, così il CRM lo trova all'avvio
  useEffect(() => {
    const { archivio, chiudi } = creaArchivio(azienda, nomeAzienda, utente);
    window.NS_CRM = archivio;
    const iframe = cornice.current;
    iframe.src = '/crm-contabilita.html';
    return () => {
      iframe.src = 'about:blank';
      chiudi();
      delete window.NS_CRM;
    };
  }, [azienda, nomeAzienda, utente]);

  return <iframe ref={cornice} className={className} style={style} title={`Contabilità ${nomeAzienda}`} />;
}

CrmContabilita.propTypes = {
  azienda: PropTypes.string.isRequired,
  nomeAzienda: PropTypes.string.isRequired,
  utente: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
};
