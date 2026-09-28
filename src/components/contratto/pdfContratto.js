import jsPDF from 'jspdf';
import { caricaLogoPdf, LOGO_RATIO } from '../../utils/logoPdf';
import { AREE, TUTTE_LE_VOCI, CONDIZIONI_PREMESSA, CLAUSOLA_FINALE, condizioni } from './vociContratto';

const BLU = [28, 52, 102];
const GRIGIO = [110, 118, 135];
const eur = (v) => (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdata = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; };

// casella da spuntare: piena se scelta
function casella(pdf, x, y, lato, piena) {
  pdf.setDrawColor(...BLU);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y - lato + 0.3, lato, lato);
  if (piena) {
    pdf.setLineWidth(0.35);
    pdf.line(x + 0.35, y - lato / 2 + 0.2, x + lato * 0.42, y + 0.05);
    pdf.line(x + lato * 0.42, y + 0.05, x + lato - 0.2, y - lato + 0.5);
  }
}

// testo che si restringe per stare nella larghezza
function testoIn(pdf, testo, x, y, larg) {
  let t = String(testo);
  while (t.length > 3 && pdf.getTextWidth(t) > larg) t = t.slice(0, -2);
  if (t !== String(testo)) t = `${t.trimEnd()}…`;
  pdf.text(t, x, y);
}

// Riga del riquadro cliente: «etichetta: valore», con il valore sottolineato
function campo(pdf, etichetta, valore, x, y, larg) {
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRIGIO);
  pdf.text(`${etichetta}:`, x, y);
  const lx = x + pdf.getTextWidth(`${etichetta}: `);
  pdf.setDrawColor(200, 205, 215); pdf.setLineWidth(0.15);
  pdf.line(lx, y + 0.7, x + larg, y + 0.7);
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(20, 26, 40);
  testoIn(pdf, valore || '', lx + 0.5, y, x + larg - lx - 1);
}

/** Genera il PDF del contratto e lo restituisce come Blob. */
export async function generaPdfContratto(c) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const W = 297, H = 210, M = 8;
  const voci = c.voci || {};

  /* ── pagina 1: intestazione, cliente e voci ── */
  const logo = await caricaLogoPdf();
  if (logo) pdf.addImage(logo, 'PNG', M, 7, 26 * LOGO_RATIO, 26);
  else { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.setTextColor(...BLU); pdf.text('NS Consulting', M, 22); }

  const bx = 118, bw = W - M - bx;
  pdf.setDrawColor(...BLU); pdf.setLineWidth(0.35);
  pdf.roundedRect(bx, 6, bw, 32, 3, 3);
  pdf.setFontSize(6.6);
  const cl = c.cliente || {};
  const r1 = 12, r2 = 19, r3 = 26, r4 = 33, x0 = bx + 4, fine = bx + bw - 4;
  campo(pdf, 'Ragione sociale', cl.ragioneSociale, x0, r1, 76);
  campo(pdf, 'sede legale', cl.sedeLegale, x0 + 78, r1, fine - x0 - 78);
  campo(pdf, 'località', cl.localitaLegale, x0, r2, 58);
  campo(pdf, 'Prov.', cl.provLegale, x0 + 60, r2, 16);
  campo(pdf, 'sede operativa', cl.sedeOperativa, x0 + 78, r2, fine - x0 - 78);
  campo(pdf, 'località', cl.localitaOperativa, x0, r3, 58);
  campo(pdf, 'Prov.', cl.provOperativa, x0 + 60, r3, 16);
  campo(pdf, 'Cod. Fisc. / P.ta IVA', cl.piva, x0 + 78, r3, 50);
  campo(pdf, 'pec', cl.pec, x0 + 130, r3, fine - x0 - 130);
  campo(pdf, 'cod. ATECO', cl.ateco, x0, r4, 36);
  campo(pdf, 'Rappr. legale', cl.rappresentante, x0 + 38, r4, 50);
  campo(pdf, 'Tel./fax', cl.telefono, x0 + 90, r4, 38);
  campo(pdf, 'email', cl.email, x0 + 130, r4, fine - x0 - 130);

  pdf.setFillColor(...BLU);
  pdf.roundedRect(M, 41, W - 2 * M, 7.5, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text('C O N T R A T T O   D I   C O N S U L E N Z A', W / 2, 46.4, { align: 'center' });

  const colW = (W - 2 * M - 8) / 3, lh = 2.62, fs = 5.3;
  const colX = [M, M + colW + 4, M + 2 * (colW + 4)];
  const yCol = [53, 53, 53];
  for (const area of AREE) {
    const x = colX[area.colonna];
    let y = yCol[area.colonna];
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.1); pdf.setTextColor(...BLU);
    testoIn(pdf, `${area.cod}. ${area.titolo}`, x, y, colW);
    y += lh + 0.35;
    for (const v of area.voci) {
      const st = voci[v.cod] || {};
      const scelta = !!st.sel;
      pdf.setFontSize(fs);
      pdf.setFont('helvetica', scelta ? 'bold' : 'normal');
      pdf.setTextColor(...(scelta ? [15, 20, 35] : [70, 76, 92]));
      const xi = x + (v.rientro ? 3 : 0);
      let etichetta = `${v.cod} ${v.label}`;
      if (st.testo && v.testo) etichetta += ` — ${st.testo}`;
      const larghezzaPrezzo = v.titoletto ? 0 : 17;
      let xo = xi;
      // opzioni con casella dopo l'etichetta
      if (v.opzioni) {
        const spazioOpz = v.opzioni.reduce((t, o) => t + pdf.getTextWidth(o) + 3.2, 0);
        testoIn(pdf, etichetta, xi, y, colW - larghezzaPrezzo - spazioOpz - (xi - x) - 1);
        xo = x + colW - larghezzaPrezzo - spazioOpz;
        for (const o of v.opzioni) {
          casella(pdf, xo, y, 1.7, (st.opzioni || []).includes(o) && scelta);
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70, 76, 92);
          pdf.text(o, xo + 2.2, y);
          xo += pdf.getTextWidth(o) + 3.2;
        }
      } else {
        testoIn(pdf, etichetta, xi, y, colW - larghezzaPrezzo - (xi - x) - 1);
      }
      if (!v.titoletto) {
        pdf.setFont('helvetica', scelta ? 'bold' : 'normal');
        pdf.setTextColor(...(scelta ? [15, 20, 35] : [150, 156, 170]));
        const prezzo = v.senzaPrezzo ? (scelta ? 'firma ______' : 'firma ......')
          : (scelta && st.prezzo !== '' && st.prezzo != null) ? `€ ${eur(st.prezzo)}` : '€ ...........';
        pdf.text(prezzo, x + colW, y, { align: 'right' });
      }
      y += lh;
    }
    yCol[area.colonna] = y + 2.1;
  }

  /* ── pagina 2: condizioni, riepilogo e firme ── */
  pdf.addPage('a4', 'landscape');
  const sx = M + 2, sw = 150;
  let y = 14;
  pdf.setTextColor(20, 26, 40);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text('Condizioni generali del servizio', sx + sw / 2, y, { align: 'center' });
  y += 7;
  pdf.setFontSize(7.4);
  CONDIZIONI_PREMESSA.forEach((p, i) => {
    pdf.setFont('helvetica', i === 0 ? 'normal' : 'normal');
    const righe = pdf.splitTextToSize(p, sw);
    pdf.text(righe, sx, y); y += righe.length * 3.1 + 1.2;
  });
  y += 2;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.4);
  pdf.text(`L'importo totale del servizio è di € ${c.importoTotale ? eur(c.importoTotale) : '________________'}`, sx, y);
  const xm = sx + 104;
  casella(pdf, xm, y, 2.6, c.periodicita === 'mensile'); pdf.text('Mensile', xm + 3.6, y);
  casella(pdf, xm + 22, y, 2.6, c.periodicita === 'annuale'); pdf.text('Annuale', xm + 25.6, y);
  y += 5;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.4);
  pdf.text('Le modalità di pagamento concordate sono le seguenti: A RICEVIMENTO FATTURA', sx, y);
  y += 6;
  pdf.setFont('helvetica', 'bold'); pdf.text('Condizioni contrattuali:', sx, y); y += 4;
  pdf.setFont('helvetica', 'normal');
  for (const [lettera, testo] of condizioni(c)) {
    const righe = pdf.splitTextToSize(testo, sw - 5);
    pdf.setFont('helvetica', 'bold'); pdf.text(`${lettera})`, sx, y);
    pdf.setFont('helvetica', 'normal'); pdf.text(righe, sx + 5, y);
    y += righe.length * 3.1 + 1.1;
  }

  // firme
  y = Math.max(y + 6, 158);
  const fx = [sx, sx + 52, sx + 104];
  pdf.setFontSize(7.6); pdf.setFont('helvetica', 'normal');
  ['Luogo e data', 'Contrattore', 'Contraente'].forEach((t, i) => pdf.text(t, fx[i] + 22, y, { align: 'center' }));
  if (c.firmaConsulente) pdf.addImage(c.firmaConsulente, 'PNG', fx[1] + 2, y + 1, 40, 13);
  if (c.firmaCliente) pdf.addImage(c.firmaCliente, 'PNG', fx[2] + 2, y + 1, 40, 13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${c.luogo || ''}${c.luogo && c.data ? ', ' : ''}${fdata(c.data)}`, fx[0] + 22, y + 10, { align: 'center' });
  pdf.setDrawColor(90, 96, 110); pdf.setLineWidth(0.2);
  fx.forEach((x) => pdf.line(x, y + 15, x + 44, y + 15));
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.2); pdf.setTextColor(...GRIGIO);
  const clausola = pdf.splitTextToSize(CLAUSOLA_FINALE, sw);
  pdf.text(clausola, sx, H - 8 - clausola.length * 2.6);

  // riepilogo dei servizi scelti (colonna destra)
  const rx = sx + sw + 12, rw = W - M - rx;
  let ry = 14;
  pdf.setTextColor(...BLU); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
  pdf.text('Riepilogo dei servizi scelti', rx, ry); ry += 3;
  pdf.setDrawColor(...BLU); pdf.setLineWidth(0.3); pdf.line(rx, ry, rx + rw, ry); ry += 4.2;
  const scelte = TUTTE_LE_VOCI.filter((v) => voci[v.cod]?.sel && !v.titoletto);
  pdf.setFontSize(7); pdf.setTextColor(20, 26, 40);
  let totaleVoci = 0;
  for (const v of scelte) {
    if (ry > H - 26) { pdf.setFont('helvetica', 'italic'); pdf.text(`… e altre ${scelte.length - scelte.indexOf(v)} voci (vedi pagina 1)`, rx, ry); ry += 3.6; break; }
    const st = voci[v.cod];
    const dett = [st.opzioni?.length ? st.opzioni.join(', ') : '', st.testo || ''].filter(Boolean).join(' · ');
    pdf.setFont('helvetica', 'bold'); pdf.text(v.cod, rx, ry);
    pdf.setFont('helvetica', 'normal');
    testoIn(pdf, `${v.label}${dett ? ` (${dett})` : ''}${v.perDipendente ? ' — a dip.' : ''}`, rx + 10, ry, rw - 34);
    if (!v.senzaPrezzo && st.prezzo !== '' && st.prezzo != null) {
      pdf.text(`€ ${eur(st.prezzo)}`, rx + rw, ry, { align: 'right' });
      if (!v.perDipendente) totaleVoci += Number(st.prezzo) || 0;
    }
    ry += 3.6;
  }
  if (!scelte.length) { pdf.setFont('helvetica', 'italic'); pdf.text('Nessuna voce selezionata', rx, ry); ry += 3.6; }
  ry += 1.5; pdf.setLineWidth(0.15); pdf.line(rx, ry, rx + rw, ry); ry += 4;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.6);
  pdf.text('Somma delle voci (esclusi i prezzi a dipendente)', rx, ry);
  pdf.text(`€ ${eur(totaleVoci)} + IVA`, rx + rw, ry, { align: 'right' });
  ry += 4.4;
  pdf.setTextColor(...BLU);
  pdf.text(`Importo del servizio (${c.periodicita === 'annuale' ? 'annuale' : 'mensile'})`, rx, ry);
  pdf.text(`€ ${eur(c.importoTotale)} + IVA`, rx + rw, ry, { align: 'right' });

  return pdf.output('blob');
}
