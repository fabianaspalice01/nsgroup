// Collegamento fra l'app NS Consulting e la sua contabilità (collezioni crm_consulting_*).
//
// - aziende  ↔ crm_consulting_clienti   nei due sensi: si copiano solo i campi anagrafici cambiati,
//   così nessuna delle due parti cancella dati che l'altra non conosce.
// - preventivi → crm_consulting_preventivi, con i pagamenti come incassi di prima nota
//   e i servizi «VISITE MEDICHE» come visite.
// - pagamenti delle aziende → incassi di prima nota.
//
// Le eliminazioni non si propagano: la contabilità conserva lo storico. Se si elimina una parte,
// l'altra resta ma viene segnata come scollegata e non viene ricreata.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = () => admin.firestore();
const CRM = 'crm_consulting_';
const col = (nome) => db().collection(CRM + nome);
const CANC = () => admin.firestore.FieldValue.delete();

const s = (v) => (v == null ? '' : String(v));
const vuoto = (v) => !s(v).trim();
const nomeNorm = (t) => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/\b(SRLS|SRL|SPA|SAS|SNC|SS)\b/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();
const pivaNorm = (p) => s(p).toUpperCase().replace(/^IT/, '').replace(/\D/g, '');
const numero = (v) => { const n = parseFloat(s(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const tondo = (n) => Math.round(n * 100) / 100;
const oggi = () => new Date().toISOString().slice(0, 10);
const fdate = (iso) => { const p = s(iso).slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s(iso); };

// campo azienda ↔ campo cliente della contabilità
const MAPPA = [
  ['nome', 'ragioneSociale'], ['partitaIva', 'piva'], ['indirizzo', 'indirizzo'], ['telefono', 'telefono'],
  ['email', 'email'], ['pec', 'pec'], ['codiceUnivoco', 'codiceUnivoco'], ['contatto', 'referente'],
];
const daAzienda = (az) => Object.fromEntries(MAPPA.map(([a, c]) => [c, s(az[a])]));
const daCliente = (cl) => Object.fromEntries(MAPPA.map(([a, c]) => [a, s(cl[c])]));

// campi di «dati» che sono cambiati fra prima e dopo (lato azienda o lato cliente)
function cambiati(prima, dopo, lato) {
  const out = [];
  for (const coppia of MAPPA) {
    const k = lato === 'azienda' ? coppia[0] : coppia[1];
    if (s(prima?.[k]) !== s(dopo?.[k])) out.push(coppia);
  }
  return out;
}
// completa i campi vuoti di «dest» con quelli pieni di «src»
function completa(src, dest, daLato) {
  const agg = {};
  for (const [a, c] of MAPPA) {
    const [kSrc, kDest] = daLato === 'azienda' ? [a, c] : [c, a];
    if (vuoto(dest[kDest]) && !vuoto(src[kSrc])) agg[kDest] = s(src[kSrc]);
  }
  return agg;
}
const somiglia = (a, b) => {
  const pa = pivaNorm(a.piva), pb = pivaNorm(b.piva);
  if (pa && pb) return pa === pb;
  return !!nomeNorm(a.nome) && nomeNorm(a.nome) === nomeNorm(b.nome);
};

/* ───────── aziende → clienti ───────── */

// restituisce l'id del cliente collegato all'azienda, collegandone o creandone uno se serve
async function assicuraCliente(azId, az) {
  if (az.crmScollegata) return null;
  if (az.crmClienteId) {
    const d = await col('clienti').doc(az.crmClienteId).get();
    if (d.exists && (!d.data().aziendaId || d.data().aziendaId === azId)) {
      if (!d.data().aziendaId) await d.ref.update({ aziendaId: azId });
      return d.id;
    }
  }
  const q = await col('clienti').where('aziendaId', '==', azId).limit(1).get();
  let cid = q.empty ? null : q.docs[0].id;
  if (!cid) {
    const tutti = await col('clienti').get();
    const libero = tutti.docs.find((d) => {
      const c = d.data();
      return !c.aziendaId && !c.aziendaScollegata && c.natura !== 'categoria'
        && somiglia({ piva: az.partitaIva, nome: az.nome }, { piva: c.piva, nome: c.ragioneSociale });
    });
    if (libero) {
      cid = libero.id;
      await libero.ref.update({ aziendaId: azId, ...completa(az, libero.data(), 'azienda') });
      const verso = completa(libero.data(), az, 'cliente');
      if (Object.keys(verso).length) await db().collection('aziende').doc(azId).update(verso);
    } else {
      cid = azId;
      await col('clienti').doc(cid).set({
        ...daAzienda(az), aziendaId: azId, creato: oggi(), docAbituale: 'fattura',
        note: 'Creato automaticamente dalla sezione Aziende dell\'app.',
      }, { merge: true });
    }
  }
  if (az.crmClienteId !== cid) await db().collection('aziende').doc(azId).update({ crmClienteId: cid });
  return cid;
}

const METODO = { bonifico: 'bonifico', contanti: 'contanti', assegno: 'assegno', pos: 'pos', carta: 'pos' };
const metodo = (m) => METODO[s(m).trim().toLowerCase()] || 'altro';

// pagamenti registrati nella scheda dell'azienda → incassi di prima nota
async function allineaPagamentiAzienda(azId, pagamenti, cid) {
  const attesi = new Set();
  for (const p of (pagamenti || [])) {
    const imp = numero(p.importo);
    if (!p.id || !(imp > 0)) continue;
    const id = `pa_${azId}_${p.id}`;
    attesi.add(id);
    const met = metodo(p.metodoPagamento);
    const rec = {
      data: s(p.data).slice(0, 10) || oggi(), tipo: 'entrata', metodo: met, importo: tondo(imp),
      istituto: met === 'contanti' ? 'CASSA' : '', clienteId: cid, aziendaId: azId, origine: 'azienda',
      causale: `Pagamento${p.descrizione ? ' ' + s(p.descrizione) : ''}${p.numeroFattura ? ' — fatt. ' + s(p.numeroFattura) : ''}`,
      note: s(p.note),
    };
    if (p.numeroFattura && cid) {
      const f = await col('fatture').where('clienteId', '==', cid).where('numero', '==', s(p.numeroFattura)).limit(1).get();
      if (!f.empty) rec.fatturaId = f.docs[0].id;
    }
    await col('movimenti').doc(id).set(rec, { merge: true });
  }
  const esistenti = await col('movimenti').where('aziendaId', '==', azId).get();
  for (const d of esistenti.docs) {
    if (d.data().origine === 'azienda' && !attesi.has(d.id)) await d.ref.delete();
  }
}

async function allineaAzienda(azId, prima, dopo, forza) {
  if (!dopo) {
    const q = await col('clienti').where('aziendaId', '==', azId).get();
    for (const d of q.docs) await d.ref.update({ aziendaId: CANC(), aziendaScollegata: true });
    return;
  }
  if (dopo.crmScollegata) return;
  const giaCollegata = !!dopo.crmClienteId;
  const cid = await assicuraCliente(azId, dopo);
  if (!cid) return;
  if (giaCollegata) {
    const cl = (await col('clienti').doc(cid).get()).data() || {};
    const agg = {};
    for (const [a, c] of (forza ? MAPPA : cambiati(prima, dopo, 'azienda'))) {
      if (s(dopo[a]) !== s(cl[c]) && !(forza && vuoto(dopo[a]))) agg[c] = s(dopo[a]);
    }
    if (Object.keys(agg).length) await col('clienti').doc(cid).update(agg);
  }
  if (forza || JSON.stringify(prima?.pagamenti || []) !== JSON.stringify(dopo.pagamenti || []) || !giaCollegata) {
    await allineaPagamentiAzienda(azId, dopo.pagamenti, cid);
  }
}

/* ───────── clienti → aziende ───────── */

async function allineaCliente(cid, prima, dopo) {
  if (!dopo) {
    const q = await db().collection('aziende').where('crmClienteId', '==', cid).get();
    for (const d of q.docs) await d.ref.update({ crmClienteId: CANC(), crmScollegata: true });
    return;
  }
  if (dopo.aziendaScollegata || dopo.natura === 'categoria') return;
  if (dopo.aziendaId) {
    const az = await db().collection('aziende').doc(dopo.aziendaId).get();
    if (!az.exists) return;
    const agg = {};
    for (const [a, c] of cambiati(prima, dopo, 'cliente')) {
      if (s(dopo[c]) !== s(az.data()[a])) agg[a] = s(dopo[c]);
    }
    if (Object.keys(agg).length) await az.ref.update(agg);
    return;
  }
  // cliente nuovo della contabilità: si collega a un'azienda esistente o se ne crea una
  const aziende = await db().collection('aziende').get();
  const trovata = aziende.docs.find((d) => d.data().crmClienteId === cid)
    || aziende.docs.find((d) => {
      const a = d.data();
      return !a.crmClienteId && !a.crmScollegata
        && somiglia({ piva: dopo.piva, nome: dopo.ragioneSociale }, { piva: a.partitaIva, nome: a.nome });
    });
  let azId;
  if (trovata) {
    azId = trovata.id;
    await trovata.ref.update({ crmClienteId: cid, ...completa(dopo, trovata.data(), 'cliente') });
    const verso = completa(trovata.data(), dopo, 'azienda');
    await col('clienti').doc(cid).update({ aziendaId: azId, ...verso });
  } else {
    const nuova = await db().collection('aziende').add({
      ...daCliente(dopo), note: '', controlli: [], dipendenti: [], documenti: [], pagamenti: [],
      crmClienteId: cid, origine: 'contabilita',
    });
    azId = nuova.id;
    await col('clienti').doc(cid).update({ aziendaId: azId });
  }
}

/* ───────── preventivi → contabilità ───────── */

async function allineaPreventivo(pid, dopo) {
  const figli = async (nome) => (await col(nome).where('preventivoId', '==', pid).get()).docs
    .filter((d) => d.data().origine === 'preventivo');
  if (!dopo) {
    await col('preventivi').doc(pid).delete();
    for (const d of await figli('movimenti')) if (!d.data().fatturaId) await d.ref.delete();
    for (const d of await figli('visite')) if (!d.data().fatturaId) await d.ref.delete();
    return;
  }
  let cid = null;
  if (dopo.aziendaId) {
    const az = await db().collection('aziende').doc(dopo.aziendaId).get();
    if (az.exists) cid = await assicuraCliente(az.id, az.data());
  }
  const servizi = (dopo.servizi || []).filter((x) => numero(x.quantita) > 0 && s(x.descrizione).trim());
  const lordo = servizi.reduce((t, x) => t + (x.omaggio ? 0 : numero(x.quantita) * numero(x.prezzoUnitario)), 0);
  const sconto = numero(dopo.sconto);
  const imponibile = tondo(Math.max(0, lordo * (1 - sconto / 100)));
  const rec = {
    data: s(dopo.data).slice(0, 10) || s(dopo.dataCreazione).slice(0, 10) || oggi(),
    nomeCliente: s(dopo.nomeCliente), consulente: s(dopo.consulente), stato: s(dopo.stato) || 'da_fare',
    tipoDocumento: s(dopo.tipoDocumento), sconto, imponibile, iva: 22,
    totale: tondo(numero(dopo.totale) || imponibile * 1.22),
    servizi: servizi.map((x) => ({
      descrizione: s(x.descrizione), quantita: numero(x.quantita), prezzo: numero(x.prezzoUnitario), omaggio: !!x.omaggio,
    })),
    descrizione: servizi.map((x) => `${s(x.descrizione)}${numero(x.quantita) > 1 ? ' ×' + numero(x.quantita) : ''}`).join(', '),
    pdfUrl: s(dopo.pdfUrl), aziendaId: s(dopo.aziendaId), origine: 'app',
  };
  if (cid) rec.clienteId = cid;
  await col('preventivi').doc(pid).set(rec, { merge: true });
  const clienteId = cid || (await col('preventivi').doc(pid).get()).data()?.clienteId || null;
  const etichetta = `preventivo del ${fdate(rec.data)}${rec.nomeCliente ? ' — ' + rec.nomeCliente : ''}`;

  // pagamenti del preventivo → incassi
  const attesiMov = new Set();
  for (const p of (dopo.pagamenti || [])) {
    const imp = numero(p.importo);
    if (!p.id || !(imp > 0)) continue;
    const id = `pp_${pid}_${p.id}`;
    attesiMov.add(id);
    const met = metodo(p.metodoPagamento);
    await col('movimenti').doc(id).set({
      data: s(p.data).slice(0, 10) || oggi(), tipo: 'entrata', metodo: met, importo: tondo(imp),
      istituto: met === 'contanti' ? 'CASSA' : '', clienteId, preventivoId: pid, origine: 'preventivo',
      causale: `Pagamento ${etichetta}`, note: s(p.note || p.descrizione),
    }, { merge: true });
  }
  for (const d of await figli('movimenti')) if (!attesiMov.has(d.id)) await d.ref.delete();

  // servizi «visite mediche» → visite da registro
  const attesiVis = new Set();
  for (const x of servizi) {
    if (!/VISIT[AE]\s+MEDIC/i.test(s(x.descrizione))) continue;
    const id = `pv_${pid}_${s(x.id) || attesiVis.size}`;
    attesiVis.add(id);
    const dip = (x.dipendenti || []).map((d) => s(d.nome).trim()).filter(Boolean);
    await col('visite').doc(id).set({
      clienteId, data: rec.data, dipendenti: dip, nVisite: Math.round(numero(x.quantita)), prelievi: 0,
      tipo: 'pagamento', importo: x.omaggio ? 0 : tondo(numero(x.quantita) * numero(x.prezzoUnitario) * (1 - sconto / 100)),
      preventivoId: pid, origine: 'preventivo', note: `Dal ${etichetta}`,
    }, { merge: true });
  }
  for (const d of await figli('visite')) if (!attesiVis.has(d.id) && !d.data().fatturaId) await d.ref.delete();
}

/* ───────── trigger ───────── */

exports.contabilitaAzienda = onDocumentWritten('aziende/{id}', (event) =>
  allineaAzienda(event.params.id, event.data?.before?.data(), event.data?.after?.data(), false));

exports.contabilitaCliente = onDocumentWritten(`${CRM}clienti/{id}`, (event) =>
  allineaCliente(event.params.id, event.data?.before?.data(), event.data?.after?.data()));

exports.contabilitaPreventivo = onDocumentWritten('preventivi/{id}', (event) =>
  allineaPreventivo(event.params.id, event.data?.after?.data()));

// allineamento completo, lanciato dal pulsante «Sincronizza con l'app» della contabilità (solo amministratori)
exports.sincronizzaContabilita = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (req) => {
  const email = s(req.auth?.token?.email).toLowerCase();
  if (!email || !(await db().collection('admins').doc(email).get()).exists) {
    throw new HttpsError('permission-denied', 'Solo gli amministratori possono sincronizzare la contabilità.');
  }
  const conta = { aziende: 0, clienti: 0, preventivi: 0 };
  for (const d of (await db().collection('aziende').get()).docs) {
    await allineaAzienda(d.id, null, d.data(), true); conta.aziende++;
  }
  for (const d of (await col('clienti').get()).docs) {
    const c = d.data();
    if (!c.aziendaId && !c.aziendaScollegata && c.natura !== 'categoria') { await allineaCliente(d.id, null, c); conta.clienti++; }
  }
  for (const d of (await db().collection('preventivi').get()).docs) {
    await allineaPreventivo(d.id, d.data()); conta.preventivi++;
  }
  return conta;
});
