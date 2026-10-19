// Sottocartelle della sezione Documenti; i documenti senza cartella finiscono in «Altro»
export const CARTELLE_DOCUMENTI = [
  { id: 'haccp', label: 'HACCP' },
  { id: 'legionella', label: 'Legionella' },
  { id: 'altro', label: 'Altro' },
];

export const cartellaDocumento = (documento) =>
  CARTELLE_DOCUMENTI.some(c => c.id === documento.cartella) ? documento.cartella : 'altro';
