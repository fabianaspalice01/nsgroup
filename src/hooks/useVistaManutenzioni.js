import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Per l'account manutentore: le viste ridotte delle aziende (manutenzioni + morosa sì/no),
// preparate dalle Cloud Functions. Non contengono importi né altri dati dell'azienda.
export function useVistaManutenzioni(attivo) {
  const [aziende, setAziende] = useState([]);

  useEffect(() => {
    if (!attivo) return;
    return onSnapshot(
      collection(db, 'vista_manutenzioni'),
      snap => setAziende(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Errore caricamento manutenzioni:', err)
    );
  }, [attivo]);

  return attivo ? aziende : [];
}
