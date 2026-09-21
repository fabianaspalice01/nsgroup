const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
setGlobalOptions({ maxInstances: 1, region: 'europe-west1' });

const ICON_URL = 'https://nsgroup-app-20260921.web.app/icon-192x192.png';
const BADGE_URL = 'https://nsgroup-app-20260921.web.app/icon-72x72.png';

const sendPush = async (messaging, token, title, body, userId) => {
  try {
    const result = await messaging.send({
      token,
      data: { title, body },
      webpush: { notification: { icon: ICON_URL, badge: BADGE_URL, vibrate: [200, 100, 200] } },
    });
    console.log(`Push OK → ${title} | messageId: ${result}`);
    return true;
  } catch (err) {
    console.error(`Push FALLITA per token ...${token.slice(-10)}: ${err.message}`);
    // Rimuovi token scaduto/invalido da Firestore
    if (userId && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
      try {
        await admin.firestore().doc(`users/${userId}`).update({ fcmToken: admin.firestore.FieldValue.delete() });
        console.log(`Token scaduto rimosso per utente ${userId}`);
      } catch (e) {}
    }
    return false;
  }
};

// ── NOTIFICHE APPUNTAMENTI AI CONSULENTI ────────────────────────────────────
exports.notificaAppuntamenti = onSchedule(
  { schedule: 'every day 08:30', timeZone: 'Europe/Rome' },
  async () => {
    const db = admin.firestore();
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const domani = new Date(oggi.getTime() + 24 * 60 * 60 * 1000);

    const toISO = (d) => d.toISOString().split('T')[0];
    const oggiStr = toISO(oggi);
    const domaniStr = toISO(domani);

    const appSnap = await db.collection('appuntamenti').get();
    const notifiche = {};

    appSnap.forEach((d) => {
      const app = d.data();
      if (!app.consulente || !app.data) return;
      if (app.data !== oggiStr && app.data !== domaniStr) return;
      const giorno = app.data === oggiStr ? 'oggi' : 'domani';
      if (!notifiche[app.consulente]) notifiche[app.consulente] = [];
      notifiche[app.consulente].push({
        giorno,
        azienda: app.aziendaNome || app.nuovoCliente?.nome || 'Cliente',
        ora: app.ora || '',
        tipo: app.tipo || '',
      });
    });

    if (Object.keys(notifiche).length === 0) {
      console.log('Nessun appuntamento da notificare.');
      return;
    }

    const usersSnap = await db.collection('users').where('ruolo', '==', 'consulente').get();
    const tokenMap = {};
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.nome && u.fcmToken) tokenMap[u.nome] = u.fcmToken;
    });

    const messaging = admin.messaging();
    const promises = [];

    for (const [consulente, appuntamenti] of Object.entries(notifiche)) {
      const token = tokenMap[consulente];
      if (!token) continue;
      for (const app of appuntamenti) {
        const title = app.giorno === 'oggi'
          ? `📅 Appuntamento oggi alle ${app.ora}`
          : `📅 Appuntamento domani alle ${app.ora}`;
        const body = `${app.azienda}${app.tipo ? ' — ' + app.tipo : ''}`;
        promises.push(sendPush(messaging, token, title, body));
      }
    }

    await Promise.all(promises);
    console.log(`Notifiche inviate per ${promises.length} appuntamenti.`);
  }
);

// ── NOTIFICHE SCADENZE ───────────────────────────────────────────────────────
const emailEnabled = process.env.NSGROUP_EMAIL_ENABLED === 'true';
const GMAIL_EMAIL = emailEnabled ? defineSecret('GMAIL_EMAIL') : null;
const GMAIL_PASSWORD = emailEnabled ? defineSecret('GMAIL_PASSWORD') : null;

const formatData = (dataStr) => {
  if (!dataStr) return '';
  const [anno, mese, giorno] = dataStr.split('-');
  return `${giorno}/${mese}/${anno}`;
};

exports.notificaScadenze = onSchedule(
  {
    schedule: 'every day 09:30',
    timeZone: 'Europe/Rome',
    secrets: emailEnabled ? [GMAIL_EMAIL, GMAIL_PASSWORD] : [],
  },
  async () => {
    const db = admin.firestore();
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    // Leggi giorni di preavviso da Firestore (default 7)
    let giorniPreavviso = 7;
    const impostazioni = await db.collection('config').doc('impostazioni').get();
    if (impostazioni.exists && impostazioni.data().giorniPreavviso) {
      giorniPreavviso = impostazioni.data().giorniPreavviso;
    }

    const traGiorni = new Date(oggi.getTime() + giorniPreavviso * 24 * 60 * 60 * 1000);

    const aziendeSnap = await db.collection('aziende').get();
    const scadenze = [];

    aziendeSnap.forEach((docSnap) => {
      const azienda = { id: docSnap.id, ...docSnap.data() };

      (azienda.controlli || []).forEach((c) => {
        if (!c.completato && c.scadenza) {
          const data = new Date(c.scadenza);
          if (data >= oggi && data <= traGiorni)
            scadenze.push({ azienda: azienda.nome, tipo: 'Controllo sicurezza', nome: c.tipo, scadenza: c.scadenza });
        }
      });

      (azienda.documenti || []).forEach((d) => {
        if (d.dataScadenza) {
          const data = new Date(d.dataScadenza);
          if (data >= oggi && data <= traGiorni)
            scadenze.push({ azienda: azienda.nome, tipo: 'Documento', nome: d.nome, scadenza: d.dataScadenza });
        }
      });

      (azienda.dipendenti || []).forEach((dip) => {
        (dip.attestati || []).forEach((att) => {
          if (att.dataScadenza) {
            const data = new Date(att.dataScadenza);
            if (data >= oggi && data <= traGiorni)
              scadenze.push({ azienda: azienda.nome, tipo: 'Attestato', nome: `${att.nome} — ${dip.nome} ${dip.cognome}`, scadenza: att.dataScadenza });
          }
        });
      });
    });

    if (scadenze.length === 0) {
      console.log(`Nessuna scadenza nei prossimi ${giorniPreavviso} giorni.`);
      return;
    }

    scadenze.sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza));

    // ── Push notification all'admin ──────────────────────────────────────────
    const adminSnap = await db.collection('users').where('ruolo', '==', 'admin').get();
    const messaging = admin.messaging();
    const pushPromises = [];

    adminSnap.forEach((d) => {
      const u = d.data();
      if (u.fcmToken) {
        const title = `⚠️ ${scadenze.length} scadenz${scadenze.length === 1 ? 'a' : 'e'} in arrivo`;
        const body = `Entro ${giorniPreavviso} giorni — vedi la dashboard`;
        pushPromises.push(sendPush(messaging, u.fcmToken, title, body));
      }
    });

    await Promise.all(pushPromises);
    console.log(`Push inviata a ${pushPromises.length} admin.`);

    if (!emailEnabled) return;

    // ── Email ────────────────────────────────────────────────────────────────
    const righe = scadenze.map((s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #dfe5ef;">${s.azienda}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #dfe5ef;">${s.tipo}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #dfe5ef;">${s.nome}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #dfe5ef;font-weight:bold;color:#dc2626;">${formatData(s.scadenza)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#2c3e66;padding:20px 30px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">⚠️ NSGroup — Scadenze in arrivo</h1>
        </div>
        <div style="background:#f6f8fc;padding:20px 30px;">
          <p style="color:#45536f;margin:0 0 16px;">
            Ci sono <strong>${scadenze.length} scadenze</strong> nei prossimi <strong>${giorniPreavviso} giorni</strong> che richiedono attenzione:
          </p>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background:#eef1f7;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#45536f;">Azienda</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#45536f;">Tipo</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#45536f;">Elemento</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#45536f;">Scadenza</th>
              </tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
          <p style="color:#9aa7bf;font-size:12px;margin:20px 0 0;">
            Notifica automatica inviata da NSGroup · ${new Date().toLocaleDateString('it-IT')}
          </p>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_EMAIL.value(), pass: GMAIL_PASSWORD.value() },
    });

    await transporter.sendMail({
      from: `NSGroup <${GMAIL_EMAIL.value()}>`,
      to: GMAIL_EMAIL.value(),
      subject: `⚠️ ${scadenze.length} scadenz${scadenze.length === 1 ? 'a' : 'e'} nei prossimi ${giorniPreavviso} giorni`,
      html,
    });

    console.log(`Email inviata con ${scadenze.length} scadenze.`);
  }
);

// ── ELIMINAZIONE UTENTE DA FIREBASE AUTH ────────────────────────────────────
exports.eliminaUtenteAuth = onDocumentDeleted('users/{docId}', async (event) => {
  const data = event.data?.data();
  if (!data?.email) return;
  try {
    const userRecord = await admin.auth().getUserByEmail(data.email);
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`Utente Auth eliminato: ${data.email}`);
  } catch (err) {
    console.error(`Errore eliminazione Auth per ${data.email}:`, err.message);
  }
});

// ── NOTIFICA UTENTE: AZIENDE ASSEGNATE / TASK ───────────────────────────────
exports.notificaTaskOperatore = onDocumentCreated('notifiche_operatori/{docId}', async (event) => {
  const data = event.data?.data();
  if (!data?.operatoreId) return;

  const db = admin.firestore();
  const messaging = admin.messaging();

  const userDoc = await db.collection('users').doc(data.operatoreId).get();
  if (!userDoc.exists) return;

  const user = userDoc.data();
  if (!user.fcmToken) return;

  await sendPush(messaging, user.fcmToken, data.titolo || '📋 Task assegnato', data.messaggio || '', data.operatoreId);
  console.log(`Push inviata a ${user.nome || data.operatoreId}`);
});

// ── NOTIFICA ADMIN: ATTIVITÀ CONSULENTI ─────────────────────────────────────
exports.notificaAttivitaConsulente = onDocumentCreated('notifiche_admin/{docId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const db = admin.firestore();
  const messaging = admin.messaging();

  const adminSnap = await db.collection('users').where('ruolo', '==', 'admin').get();
  let titolo;
  if (data.titolo) {
    titolo = data.titolo;
  } else if (data.tipo === 'modifica_appuntamento') {
    titolo = '✏️ Appuntamento modificato';
  } else {
    titolo = '📅 Nuovo appuntamento';
  }
  const promises = [];

  adminSnap.forEach(d => {
    const u = d.data();
    if (u.fcmToken) promises.push(sendPush(messaging, u.fcmToken, titolo, data.messaggio, d.id));
  });

  const results = await Promise.all(promises);
  const ok = results.filter(Boolean).length;
  console.log(`Push attività: ${ok}/${promises.length} riuscite — ${data.messaggio}`);
});
