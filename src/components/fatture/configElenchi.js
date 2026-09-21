import { MESI } from './util';

// Ogni elenco è descritto dai suoi campi; TabElenco costruisce tabella, filtri, totali e modale da qui.
// tipi campo: testo | azienda | data | importo | numero | select | note | persone
// suggerisci: propone i valori già usati (+ predefiniti) mentre si scrive

export const CONFIG_INCASSI = {
  collezione: 'fatt_incassi',
  titolo: 'Incassi',
  voce: 'incasso',
  campoData: 'data',
  campoImporto: 'importo',
  etichettaTotale: 'Totale incassato',
  campi: [
    { key: 'data', label: 'Data', tipo: 'data', obbligatorio: true },
    { key: 'cliente', label: 'Cliente', tipo: 'azienda', obbligatorio: true },
    { key: 'causale', label: 'Causale', tipo: 'testo', placeholder: 'Es. Saldo fattura 03/26 - Consulenza dicembre 2025' },
    { key: 'importo', label: 'Importo', tipo: 'importo', obbligatorio: true },
    { key: 'metodo', label: 'Metodo', tipo: 'select', opzioni: ['Bonifico', 'Contanti', 'Assegno', 'Carta / POS', 'Altro'] },
    { key: 'conto', label: 'Conto / banca', tipo: 'testo', suggerisci: true, predefiniti: ['FINECO BANK', 'UNICREDIT', 'CASSA'] },
    { key: 'note', label: 'Note', tipo: 'note', nascondiInTabella: true },
  ],
};

export const CONFIG_SPESE = {
  collezione: 'fatt_spese',
  titolo: 'Spese',
  voce: 'spesa',
  campoData: 'data',
  campoImporto: 'importo',
  etichettaTotale: 'Totale spese',
  campi: [
    { key: 'data', label: 'Data', tipo: 'data', obbligatorio: true },
    { key: 'fornitore', label: 'Fornitore / beneficiario', tipo: 'testo', suggerisci: true, obbligatorio: true },
    { key: 'causale', label: 'Causale', tipo: 'testo', placeholder: 'Es. Saldo bolletta, acquisto materiali…' },
    { key: 'importo', label: 'Importo', tipo: 'importo', obbligatorio: true },
    { key: 'metodo', label: 'Metodo', tipo: 'select', opzioni: ['RID', 'Bonifico', 'Contanti', 'Carta / POS', 'Altro'] },
    { key: 'conto', label: 'Conto / banca', tipo: 'testo', suggerisci: true, predefiniti: ['FINECO BANK', 'UNICREDIT', 'CASSA'] },
    { key: 'note', label: 'Note', tipo: 'note', nascondiInTabella: true },
  ],
};

export const CONFIG_STIPENDI = {
  collezione: 'fatt_stipendi',
  titolo: 'Stipendi dipendenti',
  voce: 'pagamento',
  campoData: 'data',
  campoImporto: 'importo',
  etichettaTotale: 'Totale erogato',
  campi: [
    { key: 'dipendente', label: 'Dipendente', tipo: 'testo', suggerisci: true, obbligatorio: true },
    { key: 'data', label: 'Data', tipo: 'data', obbligatorio: true },
    { key: 'importo', label: 'Importo', tipo: 'importo', obbligatorio: true },
    { key: 'tipo', label: 'Tipo', tipo: 'select', opzioni: ['Acconto', 'Saldo', 'Altro'] },
    { key: 'mese', label: 'Mese di riferimento', tipo: 'select', opzioni: ['', ...MESI] },
    { key: 'note', label: 'Note', tipo: 'note' },
  ],
};

export const CONFIG_SORVEGLIANZA = {
  collezione: 'fatt_sorveglianza',
  titolo: 'Sorveglianza sanitaria',
  voce: 'visita',
  campoData: 'data',
  campi: [
    { key: 'data', label: 'Data', tipo: 'data', obbligatorio: true },
    { key: 'azienda', label: 'Azienda', tipo: 'azienda', obbligatorio: true },
    { key: 'nVisite', label: 'N° visite', tipo: 'numero' },
    { key: 'dipendenti', label: 'Dipendenti visitati', tipo: 'persone', conPrelievo: true },
    { key: 'fattura', label: 'Fattura / pagamento', tipo: 'testo', placeholder: 'Es. 526_25 oppure 936_25 PROF' },
    { key: 'note', label: 'Note', tipo: 'note', nascondiInTabella: true },
  ],
};
