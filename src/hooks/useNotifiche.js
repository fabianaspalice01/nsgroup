import { useEffect } from 'react';
import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { messaging, db } from '../firebase';
import toast from 'react-hot-toast';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function useNotifiche(userData) {
  useEffect(() => {
    if (!VAPID_KEY || !userData || !['consulente', 'admin', 'operatore'].includes(userData.ruolo) || !messaging) return;

    const registraToken = async () => {
      try {
        if (!('Notification' in window)) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Usa lo stesso service worker della PWA: registrarne un secondo sullo
        // scope "/" impedirebbe all'app installata di aggiornarsi correttamente.
        const serviceWorkerPath = import.meta.env.DEV ? '/firebase-messaging-sw.js' : '/sw.js';
        const serviceWorkerRegistration = await navigator.serviceWorker.register(serviceWorkerPath, { scope: '/' });
        await navigator.serviceWorker.ready;

        // Forza token fresco: elimina quello vecchio e ne ottiene uno nuovo
        try { await deleteToken(messaging); } catch (_) {}
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
        if (!token) return;

        const q = query(collection(db, 'users'), where('email', '==', userData.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'users', snap.docs[0].id), { fcmToken: token });
        }
      } catch (err) {
        console.error('Errore registrazione notifiche:', err.code || err.message);
      }
    };

    registraToken();

    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || '';
      const body = payload.notification?.body || payload.data?.body || '';
      if (title) toast.success(`${title}\n${body}`, { duration: 6000 });
    });

    return () => unsubscribe();
  }, [userData?.email, userData?.ruolo]);
}
