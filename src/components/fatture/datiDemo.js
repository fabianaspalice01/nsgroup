import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { MESI } from './util';

// Dati fittizi per provare la sezione Fatture. Ogni documento ha demo: true,
// così rimuoviDemo() li elimina senza toccare i dati reali.
const COLLEZIONI = ['fatt_registro', 'fatt_incassi', 'fatt_spese', 'fatt_stipendi', 'fatt_sorveglianza', 'fatt_contanti', 'fatt_presenze'];

const AZIENDE = [
  { nome: 'Bar Sole di Rossi Mario', referente: 'Rossi Mario', canone: '80 + IVA', visite: '35 + IVA', netto: 80 },
  { nome: 'Pizzeria Il Vesuvio Srl', referente: 'Esposito Anna', canone: '100 + IVA', visite: '35 + IVA', netto: 100 },
  { nome: 'Officina Bianchi Snc', referente: 'Bianchi Luca', canone: '85 IVATO', visite: '35 + IVA', ivato: 85 },
  { nome: 'Studio Dentistico Verdi', referente: 'Dott. Verdi', canone: '150 + IVA', visite: '55 + IVA', netto: 150 },
  { nome: 'Alimentari De Luca', referente: 'De Luca Rosa', canone: '60 + IVA', visite: '35 + IVA', netto: 60 },
  { nome: 'Parrucchieri Bella Vita', referente: 'Russo Giulia', canone: '67 IVATO', visite: '35 + IVA', ivato: 67 },
  { nome: 'Autolavaggio Express Srls', referente: 'Gallo Marco', canone: '120 IVATO', visite: '45 + IVA', ivato: 120 },
  { nome: 'Edil Costruzioni Neri Srl', referente: 'Neri Paolo', canone: '1800 + IVA', visite: 'INCLUSE', annuale: 2196 },
];

const DIPENDENTI = ['Verdi Chiara', 'Marino Paolo', 'Conte Elisa', 'Ferri Davide'];
const pad = (n) => String(n).padStart(2, '0');
const importoIva = (a) => (a.ivato ?? Math.round(a.netto * 1.22 * 100) / 100);

export async function caricaDemo() {
  const anno = new Date().getFullYear();
  const oggi = new Date();
  const meseCorr = oggi.getMonth() + 1;
  const yy = String(anno).slice(-2);
  const ops = []; // { coll, id?, data }
  const aggiungi = (coll, data, id) => ops.push({ coll, id, data: { ...data, demo: true, creatoIl: new Date().toISOString() } });

  let n = 20; // numerazione progressiva fittizia
  AZIENDE.forEach((a, ai) => {
    const mesi = {};
    if (a.annuale) {
      mesi[1] = { numero: `${n++}/${yy}`, stato: 'pagata', importo: a.annuale, data: `${anno}-01-12`, nota: 'Canone annuale' };
      aggiungi('fatt_incassi', { data: `${anno}-01-28`, cliente: a.nome, causale: `SALDO FATTURA ${mesi[1].numero} - CONSULENZA ANNUALE`, importo: a.annuale, metodo: 'Bonifico', conto: 'FINECO BANK', note: '' });
    } else {
      for (let m = 1; m <= meseCorr; m++) {
        const importo = importoIva(a);
        const giorno = pad(5 + ((ai * 3 + m) % 15));
        const cella = { numero: `${n++}/${yy}`, importo, data: `${anno}-${pad(m)}-${giorno}` };
        if (m <= meseCorr - 2) cella.stato = 'pagata';
        else if (m === meseCorr - 1) cella.stato = ai % 3 === 0 ? 'emessa' : 'pagata';
        else cella.stato = ai % 2 === 0 ? 'proforma' : 'emessa';
        // qualche caso particolare per vedere gli avvisi
        if (ai === 6 && m === meseCorr) delete cella.importo;
        mesi[m] = cella;
        if (cella.stato === 'pagata') {
          aggiungi('fatt_incassi', {
            data: `${anno}-${pad(m)}-${pad(Math.min(28, Number(giorno) + 6))}`, cliente: a.nome,
            causale: `SALDO FATTURA ${cella.numero} - CONSULENZA ${MESI[m - 1].toUpperCase()} ${anno}`,
            importo, metodo: ai % 4 === 3 ? 'Contanti' : 'Bonifico', conto: ai % 4 === 3 ? 'CASSA' : (ai % 2 ? 'UNICREDIT' : 'FINECO BANK'), note: '',
          });
        }
      }
      if (ai === 3) mesi[Math.max(1, meseCorr - 3)] = { numero: '', stato: 'emessa', nota: 'Fatturata a Gamma Servizi Srl' };
    }
    aggiungi('fatt_registro', { anno, azienda: a.nome, aziendaId: null, referente: a.referente, canone: a.canone, visite: a.visite, note: '', mesi });
  });

  // Spese ricorrenti
  const FORNITORI = [
    ['NWG ENERGIA SPA', 'SALDO BOLLETTA LUCE', 118.4, 'RID', 'FINECO BANK'],
    ['NEXI SPA', 'COMMISSIONI POS', 31.78, 'RID', 'FINECO BANK'],
    ['AMAZON SPA', 'ACQUISTO MATERIALI', 84.2, 'Carta / POS', 'FINECO BANK'],
    ['UNICREDIT', 'CANONE MENSILE CONTO', 15.95, 'RID', 'UNICREDIT'],
  ];
  for (let m = 1; m <= meseCorr; m++) {
    FORNITORI.forEach(([fornitore, causale, importo, metodo, conto], i) => {
      aggiungi('fatt_spese', { data: `${anno}-${pad(m)}-${pad(3 + i * 6)}`, fornitore, causale, importo: Math.round((importo + ((m * 7 + i) % 9)) * 100) / 100, metodo, conto, note: '' });
    });
  }

  // Stipendi degli ultimi due mesi
  for (let m = Math.max(1, meseCorr - 1); m <= meseCorr; m++) {
    DIPENDENTI.slice(0, 3).forEach((d, i) => {
      aggiungi('fatt_stipendi', { dipendente: d, data: `${anno}-${pad(m)}-13`, importo: 600 + i * 150, tipo: 'Acconto', mese: MESI[m - 1], note: '' });
      if (m < meseCorr) aggiungi('fatt_stipendi', { dipendente: d, data: `${anno}-${pad(m)}-28`, importo: 500 + i * 100, tipo: 'Saldo', mese: MESI[m - 1], note: '' });
    });
  }

  // Sorveglianza sanitaria
  [
    ['Pizzeria Il Vesuvio Srl', 3, [['Esposito Carlo', true], ['Russo Anna', true], ['Gallo Sara', false]], 'PROF'],
    ['Edil Costruzioni Neri Srl', 8, [['Neri Marco', true], ['Ferrara Luigi', true], ['Amato Pietro', true]], ''],
    ['Alimentari De Luca', 2, [['De Luca Rosa', false], ['Conti Elena', false]], ''],
    ['Studio Dentistico Verdi', 1, [['Verdi Andrea', false]], 'PROF'],
  ].forEach(([azienda, nVisite, dip, tipo], i) => {
    const m = Math.max(1, meseCorr - i);
    aggiungi('fatt_sorveglianza', {
      data: `${anno}-${pad(m)}-${pad(10 + i * 3)}`, azienda, nVisite,
      dipendenti: dip.map(([nome, prelievo]) => ({ nome, prelievo })), fattura: `${300 + i * 41}_${yy}${tipo ? ' ' + tipo : ''}`.trim(), note: '',
    });
  });

  // Canoni in contanti
  [
    ['Tabaccheria Centrale', '80 + IVA', '40 + IVA', 97.6],
    ['Bar Sport di Ferri', '85 IVATO', '35 + IVA', 85],
    ['Frutta e Verdura Amato', '60 + IVA', '35 + IVA', 73.2],
  ].forEach(([azienda, canone, visita, importoMensile], i) => {
    const mesi = {};
    for (let m = 1; m <= meseCorr; m++) mesi[m] = (m + i) % 5 === 0 ? 'no' : 'si';
    aggiungi('fatt_contanti', { anno, azienda, canone, visita, importoMensile, note: '', mesi });
  });

  // Presenze del mese corrente (solo se non ne esistono già di reali)
  const idPres = `${anno}-${pad(meseCorr)}`;
  const esistente = await getDoc(doc(db, 'fatt_presenze', idPres));
  let presenzeSaltate = false;
  if (esistente.exists()) presenzeSaltate = true;
  else {
    const righe = DIPENDENTI.map((nome, i) => {
      const giorni = {};
      for (let g = 1; g <= oggi.getDate(); g++) {
        const dow = new Date(anno, meseCorr - 1, g).getDay();
        if (dow === 0) continue;
        if (dow === 6) { if (i % 2 === 0) giorni[g] = 'E'; continue; }
        giorni[g] = i === 3 ? (g % 2 ? 'T.M' : 'T.P') : 'T.C.';
      }
      if (oggi.getDate() >= 9 && i === 1) giorni[8] = 'M';
      if (oggi.getDate() >= 12 && i === 2) { giorni[11] = 'F'; giorni[12] = 'F'; }
      return { nome, giorni };
    });
    aggiungi('fatt_presenze', { anno, mese: meseCorr, righe }, idPres);
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(({ coll, id, data }) => batch.set(id ? doc(db, coll, id) : doc(collection(db, coll)), data));
    await batch.commit();
  }
  return { totale: ops.length, presenzeSaltate };
}

export async function rimuoviDemo() {
  let eliminati = 0;
  for (const coll of COLLEZIONI) {
    const snap = await getDocs(query(collection(db, coll), where('demo', '==', true)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    eliminati += snap.size;
  }
  return eliminati;
}
