// Collegamento fra l'Agenda (collezione appuntamenti) e un Google Calendar.
//
// Il calendario si collega condividendolo con l'account di servizio delle Cloud Functions
// (permesso «Apportare modifiche agli eventi»): niente login OAuth né token da custodire.
// La configurazione sta in config/googleCalendar { calendarId, attivo }.
//
// - app → Google: ogni scrittura su appuntamenti crea/aggiorna l'evento collegato.
//   L'id dell'evento è ricavato dall'id dell'appuntamento, così non nascono doppioni.
//   «googleHash» ricorda cosa è già stato inviato: se non cambia nulla non si chiama Google.
// - Google → app: «importa» copia gli eventi di un intervallo di date come appuntamenti
//   (origine: 'google'), saltando quelli già importati e quelli creati dall'app.
//
// Eliminare in app un appuntamento importato da Google NON elimina l'evento su Google:
// lo storico del calendario resta intatto.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { GoogleAuth } = require('google-auth-library');

const db = () => admin.firestore();
const TZ = 'Europe/Rome';
const API = 'https://www.googleapis.com/calendar/v3';
const TIPO_IMPORTATO = 'Da Google Calendar';

const s = (v) => (v == null ? '' : String(v));
const nomeNorm = (t) => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').toUpperCase()
  .replace(/\b(SRLS|SRL|SPA|SAS|SNC|SS)\b/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/calendar'] });

async function google(method, path, { params, data } = {}) {
  const client = await auth.getClient();
  return (await client.request({ url: API + path, method, params, data })).data;
}
const stato = (err) => err?.response?.status || err?.status || err?.code;

async function leggiConfig() {
  const d = await db().collection('config').doc('googleCalendar').get();
  return d.exists ? d.data() : {};
}

// id evento Google valido (caratteri base32hex) e stabile per ogni appuntamento
const idEvento = (appId) => 'nsg' + Buffer.from(s(appId)).toString('hex');
const calPath = (calId) => `/calendars/${encodeURIComponent(calId)}/events`;

/* ───────── appuntamento → evento ───────── */

// somma minuti/giorni a data e ora «locali» senza passare dal fuso
function sposta(data, ora, minuti) {
  const d = new Date(`${data}T${ora || '00:00'}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minuti);
  return d.toISOString().slice(0, 19);
}

const COLORI = { Confermato: '10', Completato: '8', Disdetto: '11' };

function corpoEvento(appId, app, azienda) {
  const cliente = azienda?.nome || app.nuovoCliente?.nome || 'Cliente';
  const durata = Number(app.durata) || 60;
  const righe = [
    app.tipo && `Tipo: ${app.tipo}`,
    app.stato && `Stato: ${app.stato}`,
    app.consulente && `Consulente: ${app.consulente}`,
    (azienda?.contatto || app.nuovoCliente?.contatto) && `Referente: ${azienda?.contatto || app.nuovoCliente?.contatto}`,
    (azienda?.telefono || app.nuovoCliente?.telefono) && `Telefono: ${azienda?.telefono || app.nuovoCliente?.telefono}`,
    app.stato === 'Disdetto' && app.motivazioneDisdetta && `Motivo disdetta: ${app.motivazioneDisdetta}`,
    app.note && `\n${app.note}`,
  ].filter(Boolean);

  let start, end;
  if (app.tuttoIlGiorno) {
    const giorni = Math.max(1, Math.round(durata / 1440));
    start = { date: app.data, dateTime: null, timeZone: null };
    end = { date: sposta(app.data, '00:00', giorni * 1440).slice(0, 10), dateTime: null, timeZone: null };
  } else {
    start = { dateTime: `${app.data}T${app.ora}:00`, timeZone: TZ, date: null };
    end = { dateTime: sposta(app.data, app.ora, durata), timeZone: TZ, date: null };
  }

  return {
    summary: `${app.stato === 'Disdetto' ? '[DISDETTO] ' : ''}${cliente}${app.tipo && app.tipo !== TIPO_IMPORTATO ? ` • ${app.tipo}` : ''}`,
    description: righe.join('\n'),
    location: azienda?.indirizzo || app.nuovoCliente?.indirizzo || '',
    start,
    end,
    colorId: COLORI[app.stato] || null,
    status: 'confirmed',
    extendedProperties: { private: { nsgroupId: s(appId) } },
  };
}
const hash = (corpo) => crypto.createHash('sha1').update(JSON.stringify(corpo)).digest('hex');

async function aziendaDi(app) {
  if (!app.aziendaId) return null;
  const d = await db().collection('aziende').doc(app.aziendaId).get();
  return d.exists ? d.data() : null;
}

// invia a Google un appuntamento; restituisce true se ha scritto qualcosa
async function inviaAppuntamento(calId, appId, app) {
  if (!app?.data || (!app.ora && !app.tuttoIlGiorno)) return false;
  const corpo = corpoEvento(appId, app, await aziendaDi(app));
  const h = hash(corpo);
  const eventId = app.googleEventId || idEvento(appId);
  if (app.googleHash === h && app.googleEventId) return false;

  try {
    await google('PATCH', `${calPath(calId)}/${eventId}`, { data: corpo });
  } catch (err) {
    if (![404, 410].includes(stato(err))) throw err;
    // i null servono solo al PATCH per azzerare un campo: in creazione si tolgono
    const senzaNull = JSON.parse(JSON.stringify(corpo, (k, v) => (v === null ? undefined : v)));
    await google('POST', calPath(calId), { data: { ...senzaNull, id: eventId } });
  }
  await db().collection('appuntamenti').doc(appId).update({ googleEventId: eventId, googleHash: h });
  return true;
}

exports.googleCalendarAppuntamento = onDocumentWritten('appuntamenti/{id}', async (event) => {
  const id = event.params.id;
  const prima = event.data?.before?.data();
  const dopo = event.data?.after?.data();
  const cfg = await leggiConfig();
  if (!cfg.attivo || !cfg.calendarId) return;

  try {
    if (!dopo) {
      // gli eventi importati da Google restano su Google
      if (!prima || prima.origine === 'google') return;
      if (!prima.googleEventId) return;
      try {
        await google('DELETE', `${calPath(cfg.calendarId)}/${prima.googleEventId}`);
      } catch (err) {
        if (![404, 410].includes(stato(err))) throw err;
      }
      return;
    }
    await inviaAppuntamento(cfg.calendarId, id, dopo);
  } catch (err) {
    // niente rilancio: un nuovo tentativo partirà alla prossima modifica o da «Esporta»
    console.error(`Google Calendar, appuntamento ${id}: ${err.message}`);
  }
});

/* ───────── evento → appuntamento ───────── */

const PARTI = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function locale(iso) {
  const p = Object.fromEntries(PARTI.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, ora: `${p.hour}:${p.minute}` };
}
const testo = (html) => s(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .trim();

// azienda il cui nome compare nel titolo dell'evento (vince il nome più lungo)
function trovaAzienda(titolo, aziende) {
  const t = ` ${nomeNorm(titolo)} `;
  let migliore = null;
  for (const az of aziende) {
    const n = nomeNorm(az.nome);
    if (n.length < 3 || !t.includes(` ${n} `)) continue;
    if (!migliore || n.length > nomeNorm(migliore.nome).length) migliore = az;
  }
  return migliore;
}

function daEvento(ev, aziende, utentiPerEmail, adesso) {
  let data, ora, durata, tuttoIlGiorno = false;
  if (ev.start?.dateTime) {
    ({ data, ora } = locale(ev.start.dateTime));
    durata = Math.max(15, Math.round((new Date(ev.end?.dateTime || ev.start.dateTime) - new Date(ev.start.dateTime)) / 60000));
  } else if (ev.start?.date) {
    tuttoIlGiorno = true;
    data = ev.start.date;
    ora = '00:00';
    const giorni = Math.max(1, Math.round((new Date(ev.end?.date || ev.start.date) - new Date(ev.start.date)) / 86400000));
    durata = giorni * 1440;
  } else {
    return null;
  }

  const titolo = s(ev.summary).trim() || '(senza titolo)';
  const azienda = trovaAzienda(titolo, aziende);
  const fine = ev.end?.dateTime || ev.end?.date || ev.start.dateTime || ev.start.date;
  const persona = [ev.creator?.email, ev.organizer?.email, ...(ev.attendees || []).map((a) => a.email)]
    .map((e) => utentiPerEmail[s(e).toLowerCase()]).find(Boolean);
  const note = [azienda ? titolo : '', testo(ev.description)].filter(Boolean).join('\n');

  return {
    tipoCliente: azienda ? 'registrato' : 'nuovo',
    aziendaId: azienda?.id || '',
    nuovoCliente: azienda
      ? { nome: '', contatto: '', telefono: '', indirizzo: '' }
      : { nome: titolo, contatto: '', telefono: '', indirizzo: s(ev.location) },
    data,
    ora,
    durata,
    tuttoIlGiorno,
    tipo: TIPO_IMPORTATO,
    consulente: persona || '',
    stato: new Date(fine) < adesso ? 'Completato' : 'Programmato',
    note,
    motivazioneDisdetta: '',
    origine: 'google',
    googleEventId: ev.id,
    googleLink: s(ev.htmlLink),
    importatoIl: adesso.toISOString(),
  };
}

async function importa(calId, dal, al) {
  const [aziendeSnap, utentiSnap, appSnap] = await Promise.all([
    db().collection('aziende').get(), db().collection('users').get(), db().collection('appuntamenti').get(),
  ]);
  const aziende = aziendeSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => !a.archiviata);
  const aziendePerId = Object.fromEntries(aziende.map((a) => [a.id, a]));
  const utentiPerEmail = {};
  utentiSnap.forEach((d) => { const u = d.data(); if (u.email && u.nome) utentiPerEmail[s(u.email).toLowerCase()] = u.nome; });
  const giaCollegati = new Set(appSnap.docs.map((d) => d.data().googleEventId).filter(Boolean));

  const conta = { importati: 0, giaPresenti: 0, creatiDallApp: 0, annullati: 0 };
  const adesso = new Date();
  let batch = db().batch(), inBatch = 0, pageToken;

  do {
    const pagina = await google('GET', calPath(calId), {
      params: {
        timeMin: new Date(`${dal}T00:00:00Z`).toISOString(),
        timeMax: new Date(`${al}T23:59:59Z`).toISOString(),
        singleEvents: true, orderBy: 'startTime', maxResults: 2500, timeZone: TZ, pageToken,
      },
    });
    for (const ev of pagina.items || []) {
      if (ev.status === 'cancelled') { conta.annullati++; continue; }
      if (ev.extendedProperties?.private?.nsgroupId) { conta.creatiDallApp++; continue; }
      if (giaCollegati.has(ev.id)) { conta.giaPresenti++; continue; }
      const app = daEvento(ev, aziende, utentiPerEmail, adesso);
      if (!app) continue;

      const ref = db().collection('appuntamenti').doc();
      // stesso hash che calcolerà il trigger: l'evento originale su Google non viene riscritto
      app.googleHash = hash(corpoEvento(ref.id, { ...app, googleEventId: ev.id }, aziendePerId[app.aziendaId]));
      batch.set(ref, app);
      giaCollegati.add(ev.id);
      conta.importati++;
      if (++inBatch === 400) { await batch.commit(); batch = db().batch(); inBatch = 0; }
    }
    pageToken = pagina.nextPageToken;
  } while (pageToken);

  if (inBatch) await batch.commit();
  return conta;
}

/* ───────── pannello «Google Calendar» dell'Agenda (solo amministratori) ───────── */

const isData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(s(v));
const messaggio = (err) => err?.response?.data?.error?.message || err.message;

exports.googleCalendar = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (req) => {
  const email = s(req.auth?.token?.email).toLowerCase();
  if (!email || !(await db().collection('admins').doc(email).get()).exists) {
    throw new HttpsError('permission-denied', 'Solo gli amministratori possono gestire il collegamento a Google Calendar.');
  }
  const { azione, calendarId, attivo, dal, al } = req.data || {};
  const cfgRef = db().collection('config').doc('googleCalendar');
  const cfg = await leggiConfig();

  if (azione === 'stato') {
    let serviceAccount = '';
    try { serviceAccount = (await auth.getCredentials()).client_email || ''; } catch (err) {
      console.error('Account di servizio non leggibile:', err.message);
    }
    return { serviceAccount, calendarId: cfg.calendarId || '', attivo: !!cfg.attivo, ultimaImportazione: cfg.ultimaImportazione || null };
  }

  if (azione === 'salva') {
    const calId = s(calendarId).trim();
    if (!calId) throw new HttpsError('invalid-argument', 'Indica l\'ID del calendario.');
    let nome;
    try {
      nome = (await google('GET', `/calendars/${encodeURIComponent(calId)}`)).summary;
    } catch (err) {
      throw new HttpsError('failed-precondition',
        `Calendario non raggiungibile (${messaggio(err)}). Controlla l'ID e che sia condiviso con l'account di servizio.`);
    }
    await cfgRef.set({ calendarId: calId, attivo: !!attivo, aggiornatoDa: email, aggiornatoIl: new Date().toISOString() }, { merge: true });
    return { nome };
  }

  if (!cfg.calendarId) throw new HttpsError('failed-precondition', 'Collega prima un calendario.');

  if (azione === 'esporta') {
    const conta = { inviati: 0, invariati: 0, errori: 0 };
    for (const d of (await db().collection('appuntamenti').get()).docs) {
      try {
        if (await inviaAppuntamento(cfg.calendarId, d.id, d.data())) conta.inviati++; else conta.invariati++;
      } catch (err) {
        conta.errori++;
        console.error(`Esportazione appuntamento ${d.id}: ${messaggio(err)}`);
      }
    }
    return conta;
  }

  if (azione === 'importa') {
    if (!isData(dal) || !isData(al) || dal > al) throw new HttpsError('invalid-argument', 'Intervallo di date non valido.');
    let conta;
    try {
      conta = await importa(cfg.calendarId, dal, al);
    } catch (err) {
      throw new HttpsError('internal', `Importazione non riuscita: ${messaggio(err)}`);
    }
    await cfgRef.set({ ultimaImportazione: { il: new Date().toISOString(), dal, al, ...conta } }, { merge: true });
    return conta;
  }

  throw new HttpsError('invalid-argument', 'Azione sconosciuta.');
});
