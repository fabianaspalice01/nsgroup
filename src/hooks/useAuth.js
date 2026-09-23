import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const userDoc = snap.docs[0];
            const data = { id: userDoc.id, ...userDoc.data() };

            if (!['admin', 'operatore', 'consulente'].includes(data.ruolo)) {
              setUser(null);
              setUserData(null);
              toast.error('Accesso riservato al personale interno.');
              await signOut(auth);
              setLoading(false);
              return;
            }

            if (!data.attivo) {
              toast.error("Il tuo account è stato disattivato. Contatta l'amministratore.");
              await signOut(auth);
              setLoading(false);
              return;
            }

            setUser(firebaseUser);
            setUserData(data);
          } else {
            toast.error('Utente non autorizzato');
            await signOut(auth);
          }
        } catch (error) {
          toast.error('Errore nel caricamento dati utente');
          console.error(error);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/invalid-credential') throw new Error('Email o password non corretti');
      if (error.code === 'auth/too-many-requests') throw new Error('Troppi tentativi. Riprova più tardi');
      throw new Error('Errore durante il login');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, userData, loading, login, logout };
}
