# NSGroup

App React/Vite derivata da gestione-sicurezza, con progetto Firebase indipendente.

## Avvio

```sh
npm ci
npm run dev
```

Porta predefinita: 5174. Compilazione: `npm run build`.

## Firebase

- Progetto: `nsgroup-app-20260921`
- Console: https://console.firebase.google.com/project/nsgroup-app-20260921/overview
- App web registrata e configurazione locale in `.env`.
- Nessun utente, documento o dato del progetto originale e stato importato.
- Authentication: abilitare il provider Email/password nella console.
- Firestore: attivare l'API e creare il database `(default)` in una regione europea.
- Pubblicare le regole con `firebase deploy --only firestore:rules --project nsgroup-app-20260921`.
- Primo amministratore: creare un nuovo utente in Authentication e un documento
  nella raccolta `users` con `email` corrispondente, `nome`, `ruolo: "admin"`,
  `attivo: true`. Non inserire password in Firestore.
- Storage: attivare il piano Blaze e creare il bucket dalla console, poi pubblicare
  le regole con `firebase deploy --only storage --project nsgroup-app-20260921`.
- Notifiche push: generare la chiave pubblica Web Push nelle impostazioni Cloud
  Messaging e inserirla in `VITE_FIREBASE_VAPID_KEY`. Fino ad allora sono disattivate.
- Cloud Functions: configurare nuovi secret `GMAIL_EMAIL` e `GMAIL_PASSWORD`
  nel nuovo progetto prima del deploy. Non sono stati copiati secret dal progetto originale.

Nome aggiornato nell'interfaccia, nei report e nelle email. Icone generiche
ereditate dal progetto base; il logo definitivo NSGroup resta da fornire.
Le regole di accesso sono quelle del progetto base e consentono accesso a tutti
gli utenti autenticati: i ruoli applicativi non sono imposti dalle regole.

Il progetto non e ancora pubblicato. Login, database, upload e notifiche richiedono
il completamento dei passaggi sopra indicati.
