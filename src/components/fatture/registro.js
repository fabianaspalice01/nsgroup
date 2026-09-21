import { MESI } from './util';

// Stati di un documento nel registro (i colori riprendono quelli del vostro foglio Excel)
export const STATI_DOC = {
  emessa: { label: 'Emessa', bg: '#eef1f8', color: '#2c3e66', border: '#c3cde3' },
  pagata: { label: 'Pagata', bg: '#bbf1e8', color: '#0f5c50', border: '#7fd8ca' },
  proforma: { label: 'Proforma', bg: '#fff2cc', color: '#7a5b00', border: '#f0d98a' },
};

// Documenti da incassare (proforma ed emesse non ancora pagate) di tutte le aziende e anni.
// Ogni voce corrisponde a una cella del registro (riga azienda + mese).
export function estraiDaIncassare(registro, soloProforma = false) {
  const out = [];
  registro.forEach((riga) => {
    Object.entries(riga.mesi || {}).forEach(([m, cella]) => {
      // le celle con sola nota (es. fatturata ad altra società) non sono documenti da incassare
      if (!cella || !cella.numero || cella.stato === 'pagata') return;
      if (soloProforma && cella.stato !== 'proforma') return;
      const mese = Number(m);
      out.push({
        rigaId: riga.id,
        azienda: riga.azienda,
        anno: riga.anno,
        mese,
        numero: cella.numero || '',
        stato: cella.stato,
        data: cella.data || '',
        importo: cella.importo ?? null,
        causale: `CONSULENZA ${MESI[mese - 1].toUpperCase()} ${riga.anno}${cella.nota ? ` — ${cella.nota}` : ''}`,
      });
    });
  });
  return out.sort((a, b) => a.anno - b.anno || a.mese - b.mese);
}
