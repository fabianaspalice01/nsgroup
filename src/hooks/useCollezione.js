import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Collezione Firestore in tempo reale con le operazioni base.
// - salva(dati, id): con id aggiorna (le chiavi possono essere percorsi tipo "mesi.3"), senza id crea
// - imposta(id, dati): crea o unisce il documento con id noto
// - elimina(id)
export function useCollezione(nome) {
  const [voci, setVoci] = useState([]);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, nome),
      (snap) => {
        setVoci(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCaricando(false);
      },
      (err) => {
        console.error(`Errore caricamento ${nome}:`, err);
        toast.error('Errore nel caricamento dei dati');
        setCaricando(false);
      }
    );
    return () => unsubscribe();
  }, [nome]);

  const salva = useCallback(async (dati, id) => {
    if (id) {
      await updateDoc(doc(db, nome, id), dati);
      return id;
    }
    const ref = await addDoc(collection(db, nome), { ...dati, creatoIl: new Date().toISOString() });
    return ref.id;
  }, [nome]);

  const imposta = useCallback((id, dati) => setDoc(doc(db, nome, id), dati, { merge: true }), [nome]);

  const elimina = useCallback((id) => deleteDoc(doc(db, nome, id)), [nome]);

  return { voci, caricando, salva, imposta, elimina };
}
