// Account «manutentore»: vede solo le manutenzioni e se l'azienda è morosa, mai gli importi.
// Le regole non gli lasciano leggere aziende e preventivi; legge invece vista_manutenzioni/<aziendaId>,
// una copia ridotta tenuta aggiornata da qui: anagrafica essenziale, manutenzioni e morosa (sì/no).
//
// Morosità: il campo «morosita» dell'azienda vale 'morosa' | 'in_regola' per forzarla a mano;
// vuoto o 'auto' = morosa se ha almeno un preventivo completato con un residuo da pagare.
//
// Il manutentore registra gli interventi con registraInterventoManutenzione: la funzione controlla
// che sia un manutentore attivo e scrive sull'azienda solo l'intervento, nello storico e nel registro.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { randomUUID } = require('crypto');

const db = () => admin.firestore();
const s = (v) => (v == null ? '' : String(v));
const isData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(s(v));

const residuo = (p) => (Number(p.totale) || 0)
  - (p.pagamenti || []).reduce((t, x) => t + (parseFloat(x.importo) || 0), 0);

async function calcolaMorosa(aziendaId, azienda) {
  if (azienda.morosita === 'morosa') return true;
  if (azienda.morosita === 'in_regola') return false;
  const snap = await db().collection('preventivi').where('aziendaId', '==', aziendaId).get();
  return snap.docs.some((d) => d.data().stato === 'completato' && residuo(d.data()) > 0.01);
}

// Ricalcola la vista di un'azienda; non scrive se non è cambiato nulla
async function aggiornaVista(aziendaId) {
  if (!aziendaId) return;
  const rifVista = db().collection('vista_manutenzioni').doc(aziendaId);
  const snapAz = await db().collection('aziende').doc(aziendaId).get();
  const az = snapAz.exists ? snapAz.data() : null;

  if (!az || az.archiviata || !(az.manutenzioni || []).length) {
    if ((await rifVista.get()).exists) await rifVista.delete();
    return;
  }

  const vista = {
    nome: s(az.nome),
    indirizzo: [s(az.indirizzo), [s(az.cap), s(az.comune), az.provincia ? `(${az.provincia})` : ''].filter(Boolean).join(' ')]
      .filter(Boolean).join(', '),
    telefono: s(az.telefono),
    contatto: s(az.contatto),
    manutenzioni: az.manutenzioni,
    morosa: await calcolaMorosa(aziendaId, az),
  };
  const attuale = await rifVista.get();
  const prima = attuale.exists ? attuale.data() : null;
  if (prima && Object.keys(vista).every((k) => JSON.stringify(prima[k]) === JSON.stringify(vista[k]))) return;
  await rifVista.set({ ...vista, aggiornatoIl: new Date().toISOString() });
}

exports.vistaManutenzioniAzienda = onDocumentWritten('aziende/{id}', (event) => aggiornaVista(event.params.id));

exports.vistaManutenzioniPreventivo = onDocumentWritten('preventivi/{id}', async (event) => {
  const prima = s(event.data?.before?.data()?.aziendaId);
  const dopo = s(event.data?.after?.data()?.aziendaId);
  await Promise.all([...new Set([prima, dopo].filter(Boolean))].map(aggiornaVista));
});

async function manutentoreAttivo(req) {
  const email = s(req.auth?.token?.email).toLowerCase();
  const snap = email ? await db().collection('manutentori').doc(email).get() : null;
  if (!snap?.exists || snap.data().attivo === false) {
    throw new HttpsError('permission-denied', 'Solo un manutentore attivo può registrare interventi.');
  }
  return { email, nome: s(snap.data().nome) || email };
}

exports.registraInterventoManutenzione = onCall(async (req) => {
  const utente = await manutentoreAttivo(req);
  const { aziendaId, manutenzioneId, data, scadenza, tecnico, note, pdfUrl, pdfPath } = req.data || {};
  if (!s(aziendaId) || !s(manutenzioneId)) throw new HttpsError('invalid-argument', 'Manutenzione non indicata.');
  if (!isData(data) || !isData(scadenza)) throw new HttpsError('invalid-argument', 'Date non valide.');
  if (pdfPath && !s(pdfPath).startsWith(`manutenzioni/${aziendaId}/`)) throw new HttpsError('invalid-argument', 'Allegato non valido.');

  const rif = db().collection('aziende').doc(s(aziendaId));
  let messaggio = '';
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(rif);
    if (!snap.exists) throw new HttpsError('not-found', 'Azienda non trovata.');
    const az = snap.data();
    const m = (az.manutenzioni || []).find((x) => x.id === manutenzioneId);
    if (!m) throw new HttpsError('not-found', 'Manutenzione non trovata.');

    const allegato = pdfPath ? { pdfUrl: s(pdfUrl), pdfPath: s(pdfPath) } : { pdfUrl: null, pdfPath: null };
    const intervento = {
      id: randomUUID(), data, tecnico: s(tecnico).slice(0, 200), note: s(note).slice(0, 2000),
      registratoDa: utente.nome, ...allegato,
    };
    const manutenzioni = az.manutenzioni.map((x) => (x.id === manutenzioneId
      ? {
        ...x,
        ultimoIntervento: data > s(x.ultimoIntervento) ? data : x.ultimoIntervento,
        scadenza,
        interventi: [...(x.interventi || []), intervento],
        ...(pdfPath ? allegato : {}),
      }
      : x));
    const fmt = (d) => d.split('-').reverse().join('/');
    const voce = {
      id: randomUUID(), quando: new Date().toISOString(), utente: `${utente.nome} (manutentore)`,
      azione: 'intervento', manutenzione: s(m.tipo),
      dettaglio: [`eseguito il ${fmt(data)}`, intervento.tecnico, intervento.note, `prossima scadenza ${fmt(scadenza)}`].filter(Boolean).join(' · '),
    };
    tx.update(rif, { manutenzioni, registroManutenzioni: [...(az.registroManutenzioni || []), voce] });
    messaggio = `${utente.nome} ha registrato un intervento (${m.tipo}) per ${s(az.nome)}`;
  });

  await db().collection('notifiche_admin').add({
    tipo: 'intervento_manutenzione', titolo: 'Intervento di manutenzione', messaggio,
    createdAt: new Date().toISOString(), letta: false,
  });
  return { ok: true };
});

// Ricostruisce tutte le viste (es. alla creazione del primo manutentore). Solo personale interno.
exports.ricostruisciVistaManutenzioni = onCall({ timeoutSeconds: 300 }, async (req) => {
  const email = s(req.auth?.token?.email).toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'Accesso richiesto.');
  const [manutentore, azienda] = await Promise.all([
    db().collection('manutentori').doc(email).get(),
    db().collection('accessi_azienda').doc(email).get(),
  ]);
  if (manutentore.exists || azienda.exists) throw new HttpsError('permission-denied', 'Operazione non consentita.');

  const ids = (await db().collection('aziende').get()).docs.map((d) => d.id);
  const viste = (await db().collection('vista_manutenzioni').get()).docs.map((d) => d.id);
  for (const id of new Set([...ids, ...viste])) await aggiornaVista(id);
  return { aziende: ids.length };
});
