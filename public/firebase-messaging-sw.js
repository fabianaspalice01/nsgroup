importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDpB5ihO9M7srcvQrF45UTi2dtMRHPkib4',
  authDomain: 'nsgroup-app-20260921.firebaseapp.com',
  projectId: 'nsgroup-app-20260921',
  storageBucket: 'nsgroup-app-20260921.firebasestorage.app',
  messagingSenderId: '643642755589',
  appId: '1:643642755589:web:58e5a078809e60759caa6c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appAperta = clients.some(c => c.visibilityState === 'visible');
  if (appAperta) return; // l'app è aperta: ci pensa il toast in-app

  const { title, body } = payload.data || payload.notification || {};
  if (!title) return;
  await self.registration.showNotification(title, {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
  });
});
