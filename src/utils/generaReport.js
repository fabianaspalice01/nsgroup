import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const VIOLA = [44, 62, 102];
const GRIGIO = [69, 83, 111];
const GRIGIO_CHIARO = [238, 241, 247];
const ROSSO = [220, 38, 38];

const fmt = (dataStr) => {
  if (!dataStr) return '';
  const d = new Date(dataStr);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtEuro = (val) =>
  `€ ${(val || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function generaReportMensile({ aziende, appuntamenti, preventivi, anno, mese, giorniPreavviso }) {
  const inizioMese = new Date(anno, mese - 1, 1);
  const fineMese = new Date(anno, mese, 0, 23, 59, 59);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const nomeMese = inizioMese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // Dati del mese
  const appMese = (appuntamenti || [])
    .filter(a => { const d = new Date(a.data); return d >= inizioMese && d <= fineMese; })
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const prevMese = (preventivi || [])
    .filter(p => { const d = new Date(p.dataCreazione); return d >= inizioMese && d <= fineMese; })
    .sort((a, b) => new Date(a.dataCreazione) - new Date(b.dataCreazione));

  const scadenze = [];
  aziende.forEach(az => {
    (az.controlli || []).forEach(c => {
      if (!c.completato && c.scadenza) {
        const d = new Date(c.scadenza);
        if (d >= inizioMese && d <= fineMese)
          scadenze.push({ azienda: az.nome, tipo: 'Controllo', nome: c.tipo, scadenza: c.scadenza });
      }
    });
    (az.documenti || []).forEach(doc => {
      if (doc.dataScadenza) {
        const d = new Date(doc.dataScadenza);
        if (d >= inizioMese && d <= fineMese)
          scadenze.push({ azienda: az.nome, tipo: 'Documento', nome: doc.nome, scadenza: doc.dataScadenza });
      }
    });
    (az.dipendenti || []).forEach(dip => {
      (dip.attestati || []).forEach(att => {
        if (att.dataScadenza) {
          const d = new Date(att.dataScadenza);
          if (d >= inizioMese && d <= fineMese)
            scadenze.push({ azienda: az.nome, tipo: 'Attestato', nome: `${att.nome} - ${dip.nome} ${dip.cognome}`, scadenza: att.dataScadenza });
        }
      });
    });
  });
  scadenze.sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza));

  const valorePrev = prevMese.reduce((s, p) => s + (p.totale || 0), 0);

  // ── Crea PDF ────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 0;

  // Header
  doc.setFillColor(...VIOLA);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('NSGroup', 14, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report mensile — ${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)}`, 14, 22);
  doc.setFontSize(9);
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, W - 14, 22, { align: 'right' });

  y = 36;

  // Riquadri riepilogo
  const boxes = [
    { label: 'Aziende totali', val: String(aziende.length) },
    { label: 'Appuntamenti', val: String(appMese.length) },
    { label: 'Scadenze', val: String(scadenze.length) },
    { label: 'Valore preventivi', val: fmtEuro(valorePrev) },
  ];
  const bw = (W - 28 - 9) / 4;
  boxes.forEach((b, i) => {
    const x = 14 + i * (bw + 3);
    doc.setFillColor(...GRIGIO_CHIARO);
    doc.roundedRect(x, y, bw, 18, 2, 2, 'F');
    doc.setTextColor(...VIOLA);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(b.val, x + bw / 2, y + 8, { align: 'center' });
    doc.setTextColor(...GRIGIO);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(b.label, x + bw / 2, y + 14, { align: 'center' });
  });

  y += 26;

  const sectionTitle = (title, color = VIOLA) => {
    doc.setFillColor(...color);
    doc.rect(14, y, W - 28, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 17, y + 5);
    y += 10;
  };

  // ── Appuntamenti ────────────────────────────────────────────────────────────
  sectionTitle(`Appuntamenti del mese (${appMese.length})`);
  if (appMese.length === 0) {
    doc.setTextColor(...GRIGIO);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Nessun appuntamento nel mese', 14, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Data', 'Ora', 'Cliente', 'Tipo', 'Consulente']],
      body: appMese.map(a => [
        fmt(a.data),
        a.ora || '-',
        a.aziendaNome || a.nuovoCliente?.nome || 'Cliente',
        a.tipo || '-',
        a.consulente || '-',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: GRIGIO_CHIARO, textColor: GRIGIO, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      theme: 'plain',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Scadenze ────────────────────────────────────────────────────────────────
  sectionTitle(`Scadenze nel mese (${scadenze.length})`, scadenze.length > 0 ? ROSSO : [16, 185, 129]);
  if (scadenze.length === 0) {
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Nessuna scadenza nel mese', 14, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Data', 'Azienda', 'Tipo', 'Elemento']],
      body: scadenze.map(s => [fmt(s.scadenza), s.azienda, s.tipo, s.nome]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: GRIGIO_CHIARO, textColor: GRIGIO, fontStyle: 'bold' },
      columnStyles: { 0: { textColor: [...ROSSO], fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      theme: 'plain',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Preventivi ──────────────────────────────────────────────────────────────
  sectionTitle(`Preventivi del mese (${prevMese.length})`);
  if (prevMese.length === 0) {
    doc.setTextColor(...GRIGIO);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Nessun preventivo nel mese', 14, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Data', 'Cliente', 'Importo']],
      body: prevMese.map(p => [
        fmt(p.dataCreazione),
        p.nomeCliente || '-',
        fmtEuro(p.totale),
      ]),
      foot: [['', 'Totale', fmtEuro(valorePrev)]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: GRIGIO_CHIARO, textColor: GRIGIO, fontStyle: 'bold' },
      footStyles: { fillColor: GRIGIO_CHIARO, textColor: [...GRIGIO], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [250, 255, 250] },
      theme: 'plain',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Footer su ogni pagina
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...VIOLA);
    doc.rect(0, 290, W, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('NSGroup — Gestione Sicurezza sul Lavoro', 14, 295);
    doc.text(`Pagina ${i} di ${totalPages}`, W - 14, 295, { align: 'right' });
  }

  const nomeFile = `report-${anno}-${String(mese).padStart(2, '0')}.pdf`;
  doc.save(nomeFile);
}
