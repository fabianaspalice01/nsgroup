// Collegamento fra l'app e la contabilità delle tre società del gruppo (collezioni crm_<società>_*).
// Aziende, preventivi e contratti hanno il campo «societa» (consulting | safety | academy; se manca vale
// consulting): ognuno finisce nella contabilità della sua società. Un preventivo o un contratto di una
// società diversa da quella dell'azienda rende l'azienda cliente anche di quella società.
//
// - aziende  ↔ crm_<società>_clienti   nei due sensi: si copiano solo i campi anagrafici cambiati,
//   così nessuna delle due parti cancella dati che l'altra non conosce.
// - preventivi → crm_<società>_preventivi, con i pagamenti come incassi di prima nota
//   e i servizi «VISITE MEDICHE» come visite.
// - pagamenti delle aziende → incassi di prima nota.
// - contratti → canone, periodicità e scadenza del cliente (vale il contratto più recente).
//
// Le eliminazioni non si propagano: la contabilità conserva lo storico. Se si elimina una parte,
// l'altra resta ma viene segnata come scollegata e non viene ricreata.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = () => admin.firestore();
const SOCIETA = ['consulting', 'safety', 'academy'];
const societaDi = (x) => (SOCIETA.includes(x?.societa) ? x.societa : 'consulting');
const col = (soc, nome) => db().collection(`crm_${soc}_${nome}`);
// campi dell'azienda con il cliente collegato in ogni contabilità (consulting tiene i nomi storici)
const campoCid = (soc) => (soc === 'consulting' ? 'crmClienteId' : `crmClienteId_${soc}`);
const campoScoll = (soc) => (soc === 'consulting' ? 'crmScollegata' : `crmScollegata_${soc}`);
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

// restituisce l'id del cliente collegato all'azienda nella contabilità «soc», collegandone o creandone uno se serve
async function assicuraCliente(soc, azId, az) {
  if (az[campoScoll(soc)]) return null;
  if (az[campoCid(soc)]) {
    const d = await col(soc, 'clienti').doc(az[campoCid(soc)]).get();
    if (d.exists && (!d.data().aziendaId || d.data().aziendaId === azId)) {
      if (!d.data().aziendaId) await d.ref.update({ aziendaId: azId });
      return d.id;
    }
  }
  const q = await col(soc, 'clienti').where('aziendaId', '==', azId).limit(1).get();
  let cid = q.empty ? null : q.docs[0].id;
  if (!cid) {
    const tutti = await col(soc, 'clienti').get();
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
      await col(soc, 'clienti').doc(cid).set({
        ...daAzienda(az), aziendaId: azId, creato: oggi(), docAbituale: 'fattura',
        note: 'Creato automaticamente dalla sezione Aziende dell\'app.',
      }, { merge: true });
    }
  }
  if (az[campoCid(soc)] !== cid) await db().collection('aziende').doc(azId).update({ [campoCid(soc)]: cid });
  return cid;
}

const METODO = { bonifico: 'bonifico', contanti: 'contanti', assegno: 'assegno', pos: 'pos', carta: 'pos' };
const metodo = (m) => METODO[s(m).trim().toLowerCase()] || 'altro';

// pagamenti registrati nella scheda dell'azienda → incassi di prima nota
async function allineaPagamentiAzienda(soc, azId, pagamenti, cid) {
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
      const f = await col(soc, 'fatture').where('clienteId', '==', cid).where('numero', '==', s(p.numeroFattura)).limit(1).get();
      if (!f.empty) rec.fatturaId = f.docs[0].id;
    }
    await col(soc, 'movimenti').doc(id).set(rec, { merge: true });
  }
  const esistenti = await col(soc, 'movimenti').where('aziendaId', '==', azId).get();
  for (const d of esistenti.docs) {
    if (d.data().origine === 'azienda' && !attesi.has(d.id)) await d.ref.delete();
  }
}

async function allineaAzienda(azId, prima, dopo, forza) {
  if (!dopo) {
    for (const soc of SOCIETA) {
      const q = await col(soc, 'clienti').where('aziendaId', '==', azId).get();
      for (const d of q.docs) await d.ref.update({ aziendaId: CANC(), aziendaScollegata: true });
    }
    return;
  }
  const socAz = societaDi(dopo);
  const socPrima = prima ? societaDi(prima) : socAz;
  // anagrafica: nella contabilità della società dell'azienda e in quelle dove è già cliente;
  // pagamenti della scheda: solo nella contabilità della società dell'azienda
  for (const soc of SOCIETA) {
    const principale = soc === socAz;
    if (!principale) {
      if (forza || socPrima === soc) await allineaPagamentiAzienda(soc, azId, [], null);
      if (!dopo[campoCid(soc)]) continue;
    }
    if (dopo[campoScoll(soc)]) continue;
    const giaCollegata = !!dopo[campoCid(soc)];
    const cid = await assicuraCliente(soc, azId, dopo);
    if (!cid) continue;
    if (giaCollegata) {
      const cl = (await col(soc, 'clienti').doc(cid).get()).data() || {};
      const agg = {};
      for (const [a, c] of (forza ? MAPPA : cambiati(prima, dopo, 'azienda'))) {
        if (s(dopo[a]) !== s(cl[c]) && !(forza && vuoto(dopo[a]))) agg[c] = s(dopo[a]);
      }
      if (Object.keys(agg).length) await col(soc, 'clienti').doc(cid).update(agg);
    }
    if (principale && (forza || !giaCollegata || socPrima !== socAz
      || JSON.stringify(prima?.pagamenti || []) !== JSON.stringify(dopo.pagamenti || []))) {
      await allineaPagamentiAzienda(soc, azId, dopo.pagamenti, cid);
    }
  }
}

/* ───────── clienti → aziende ───────── */

async function allineaCliente(soc, cid, prima, dopo) {
  if (!dopo) {
    const q = await db().collection('aziende').where(campoCid(soc), '==', cid).get();
    for (const d of q.docs) await d.ref.update({ [campoCid(soc)]: CANC(), [campoScoll(soc)]: true });
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
  // cliente nuovo della contabilità: si collega a un'azienda esistente o se ne crea una della stessa società
  const aziende = await db().collection('aziende').get();
  const trovata = aziende.docs.find((d) => d.data()[campoCid(soc)] === cid)
    || aziende.docs.find((d) => {
      const a = d.data();
      return !a[campoCid(soc)] && !a[campoScoll(soc)]
        && somiglia({ piva: dopo.piva, nome: dopo.ragioneSociale }, { piva: a.partitaIva, nome: a.nome });
    });
  let azId;
  if (trovata) {
    azId = trovata.id;
    await trovata.ref.update({ [campoCid(soc)]: cid, ...completa(dopo, trovata.data(), 'cliente') });
    const verso = completa(trovata.data(), dopo, 'azienda');
    await col(soc, 'clienti').doc(cid).update({ aziendaId: azId, ...verso });
  } else {
    const nuova = await db().collection('aziende').add({
      ...daCliente(dopo), note: '', controlli: [], dipendenti: [], documenti: [], pagamenti: [],
      societa: soc, [campoCid(soc)]: cid, origine: 'contabilita',
    });
    azId = nuova.id;
    await col(soc, 'clienti').doc(cid).update({ aziendaId: azId });
  }
}

/* ───────── preventivi → contabilità ───────── */

const figliPreventivo = async (soc, pid, nome) => (await col(soc, nome).where('preventivoId', '==', pid).get()).docs
  .filter((d) => d.data().origine === 'preventivo');

// toglie il preventivo da una contabilità (restano incassi e visite già fatturati)
async function rimuoviPreventivo(soc, pid) {
  const ref = col(soc, 'preventivi').doc(pid);
  if (!(await ref.get()).exists) return;
  await ref.delete();
  for (const d of await figliPreventivo(soc, pid, 'movimenti')) if (!d.data().fatturaId) await d.ref.delete();
  for (const d of await figliPreventivo(soc, pid, 'visite')) if (!d.data().fatturaId) await d.ref.delete();
}

async function allineaPreventivo(pid, dopo) {
  if (!dopo) {
    for (const soc of SOCIETA) await rimuoviPreventivo(soc, pid);
    return;
  }
  const az = dopo.aziendaId ? await db().collection('aziende').doc(dopo.aziendaId).get() : null;
  const soc = SOCIETA.includes(dopo.societa) ? dopo.societa : societaDi(az?.exists ? az.data() : null);
  // se il preventivo è passato a un'altra società, esce dalla contabilità precedente
  for (const altra of SOCIETA) if (altra !== soc) await rimuoviPreventivo(altra, pid);
  const figli = (nome) => figliPreventivo(soc, pid, nome);
  let cid = null;
  if (az?.exists) cid = await assicuraCliente(soc, az.id, az.data());
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
  await col(soc, 'preventivi').doc(pid).set(rec, { merge: true });
  const clienteId = cid || (await col(soc, 'preventivi').doc(pid).get()).data()?.clienteId || null;
  const etichetta = `preventivo del ${fdate(rec.data)}${rec.nomeCliente ? ' — ' + rec.nomeCliente : ''}`;

  // pagamenti del preventivo → incassi
  const attesiMov = new Set();
  for (const p of (dopo.pagamenti || [])) {
    const imp = numero(p.importo);
    if (!p.id || !(imp > 0)) continue;
    const id = `pp_${pid}_${p.id}`;
    attesiMov.add(id);
    const met = metodo(p.metodoPagamento);
    await col(soc, 'movimenti').doc(id).set({
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
    await col(soc, 'visite').doc(id).set({
      clienteId, data: rec.data, dipendenti: dip, nVisite: Math.round(numero(x.quantita)), prelievi: 0,
      tipo: 'pagamento', importo: x.omaggio ? 0 : tondo(numero(x.quantita) * numero(x.prezzoUnitario) * (1 - sconto / 100)),
      preventivoId: pid, origine: 'preventivo', note: `Dal ${etichetta}`,
    }, { merge: true });
  }
  for (const d of await figli('visite')) if (!attesiVis.has(d.id) && !d.data().fatturaId) await d.ref.delete();
}

/* ───────── contratti → canone del cliente ───────── */

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const CAMPI_CONTRATTO = ['contrattoId', 'contrattoData', 'contrattoScadenza', 'contrattoPdf'];
const scollegaContratto = (d) => d.ref.update(Object.fromEntries(CAMPI_CONTRATTO.map((k) => [k, CANC()])));

async function allineaContratto(kid, dopo) {
  const legati = {};
  for (const soc of SOCIETA) legati[soc] = (await col(soc, 'clienti').where('contrattoId', '==', kid).get()).docs;
  if (!dopo) {
    // contratto eliminato: il cliente resta con il suo canone, si toglie solo il collegamento
    for (const soc of SOCIETA) for (const d of legati[soc]) await scollegaContratto(d);
    return;
  }
  if (!dopo.aziendaId) return;
  const az = await db().collection('aziende').doc(dopo.aziendaId).get();
  if (!az.exists) return;
  const soc = SOCIETA.includes(dopo.societa) ? dopo.societa : societaDi(az.data());
  // se il contratto è passato a un'altra società, esce dalla contabilità precedente
  for (const altra of SOCIETA) if (altra !== soc) for (const d of legati[altra]) await scollegaContratto(d);
  const cid = await assicuraCliente(soc, az.id, az.data());
  if (!cid) return;
  const cl = (await col(soc, 'clienti').doc(cid).get()).data() || {};
  // un contratto più vecchio non sostituisce quello più recente già registrato
  if (cl.contrattoId && cl.contrattoId !== kid && s(cl.contrattoData) > s(dopo.data)) return;
  const importo = tondo(numero(dopo.importoTotale));
  const periodicita = dopo.periodicita === 'annuale' ? 'annuale' : 'mensile';
  const mese = MESI[Number(s(dopo.data).slice(5, 7)) - 1] || '';
  await col(soc, 'clienti').doc(cid).update({
    canoneRaw: importo ? `${String(importo).replace('.', ',')} + IVA` : '',
    canoneImporto: importo || null, canoneRegime: importo ? 'netto' : '', daVerificare: false,
    periodicita, meseRinnovo: periodicita === 'annuale' ? mese : s(cl.meseRinnovo),
    contrattoId: kid, contrattoData: s(dopo.data), contrattoScadenza: s(dopo.scadenza), contrattoPdf: s(dopo.pdfUrl),
  });
  for (const d of legati[soc]) if (d.id !== cid) await scollegaContratto(d);
}

/* ───────── trigger ───────── */

exports.contabilitaAzienda = onDocumentWritten('aziende/{id}', (event) =>
  allineaAzienda(event.params.id, event.data?.before?.data(), event.data?.after?.data(), false));

const triggerCliente = (soc) => onDocumentWritten(`crm_${soc}_clienti/{id}`, (event) =>
  allineaCliente(soc, event.params.id, event.data?.before?.data(), event.data?.after?.data()));
exports.contabilitaCliente = triggerCliente('consulting');
exports.contabilitaClienteSafety = triggerCliente('safety');
exports.contabilitaClienteAcademy = triggerCliente('academy');

exports.contabilitaPreventivo = onDocumentWritten('preventivi/{id}', (event) =>
  allineaPreventivo(event.params.id, event.data?.after?.data()));

exports.contabilitaContratto = onDocumentWritten('contratti/{id}', (event) =>
  allineaContratto(event.params.id, event.data?.after?.data()));
