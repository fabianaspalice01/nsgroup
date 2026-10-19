// Società del gruppo: aziende, preventivi e contratti indicano a quale si riferiscono (campo «societa»)
// e finiscono nella sua contabilità (collezioni crm_<id>_*, vedi functions/contabilita.js).
export const SOCIETA = [
  { id: 'consulting', nome: 'NS Consulting', logo: '/logo-nsconsulting.jpeg' },
  { id: 'safety', nome: 'NS Safety', logo: '/logo-nssafety.jpeg' },
  { id: 'academy', nome: 'NS Academy', logo: '/logo-nsacademy.jpeg' },
];

// i dati creati prima dell'introduzione del campo appartengono a NS Consulting
export const societaDi = (x) => (SOCIETA.some((s) => s.id === x?.societa) ? x.societa : 'consulting');
