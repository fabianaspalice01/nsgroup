import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';

export function useAziende(userData) {
  const [aziende, setAziende] = useState([]);

  useEffect(() => {
    if (!userData) {
      setAziende([]);
      return;
    }

    let unsubscribe;

    if (userData.ruolo === 'admin' || userData.ruolo === 'operatore') {
      unsubscribe = onSnapshot(
        collection(db, 'aziende'),
        (snap) => setAziende(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Errore caricamento aziende:', err)
      );
    } else if (userData.ruolo === 'consulente') {
      unsubscribe = onSnapshot(
        collection(db, 'aziende'),
        (snap) => setAziende(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Errore caricamento aziende:', err)
      );
    } else if (userData.ruolo === 'azienda') {
      unsubscribe = onSnapshot(
        doc(db, 'aziende', userData.aziendaId),
        (snap) => {
          if (snap.exists()) setAziende([{ id: snap.id, ...snap.data() }]);
          else setAziende([]);
        },
        (err) => console.error('Errore caricamento azienda:', err)
      );
    }

    return () => unsubscribe?.();
  }, [userData?.id, userData?.ruolo, userData?.aziendaId]);

  return { aziende };
}
