export const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
export const MESI_BREVI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

export const fmtEuro = (n) =>
  `€ ${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtData = (iso) => {
  if (!iso) return '';
  const [a, m, g] = iso.split('-');
  return `${g}/${m}/${a}`;
};

// Data di oggi nel fuso locale (toISOString darebbe quella UTC)
export const oggiISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const parseImporto = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export const S = {
  input: {
    width: '100%', padding: '9px 10px', border: '1.5px solid #dfe5ef', borderRadius: 8,
    fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#1a2540',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#45536f', marginBottom: 4 },
  card: { background: '#fff', border: '1px solid #dfe5ef', borderRadius: 10 },
  th: {
    padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6f8c',
    background: '#f6f8fc', borderBottom: '1px solid #dfe5ef', whiteSpace: 'nowrap', textTransform: 'uppercase',
  },
  td: { padding: '8px 10px', fontSize: 13, color: '#1a2540', borderBottom: '1px solid #eef1f7', verticalAlign: 'top' },
};

const VARIANTI = {
  primario: { background: '#2c3e66', color: '#fff', border: '1px solid #2c3e66' },
  ghost: { background: '#fff', color: '#45536f', border: '1.5px solid #dfe5ef' },
  danger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  ok: { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' },
};

export const btn = (variante = 'ghost', extra = {}) => ({
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  ...VARIANTI[variante], ...extra,
});

// Elenco di anni selezionabili: quelli presenti nei dati + corrente e successivo
export const anniDisponibili = (anniDati) => {
  const corrente = new Date().getFullYear();
  return [...new Set([...anniDati, corrente, corrente + 1])].sort((a, b) => b - a);
};

// Esporta righe (array di oggetti con chiavi = intestazioni) in un file Excel
export async function esportaExcel(nomeFile, righe, nomeFoglio = 'Dati') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(righe);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeFoglio.slice(0, 31));
  XLSX.writeFile(wb, `${nomeFile}.xlsx`);
}
