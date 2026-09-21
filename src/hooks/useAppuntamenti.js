import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function useAppuntamenti(userData) {
  const [appuntamenti, setAppuntamenti] = useState([]);

  useEffect(() => {
    if (!userData || userData.ruolo === 'azienda') {
      setAppuntamenti([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'appuntamenti'),
      (snap) => {
        let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (userData.ruolo === 'consulente') {
          lista = lista.filter(app => app.consulente === userData.nome);
        }
        setAppuntamenti(lista);
      },
      (err) => console.error('Errore caricamento appuntamenti:', err)
    );

    return () => unsubscribe();
  }, [userData?.id, userData?.ruolo, userData?.nome]);

  return { appuntamenti };
}
