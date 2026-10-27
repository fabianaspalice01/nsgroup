// Icone a tratto del design system NS Group (griglia 24px, colore del testo).
// Si adattano alla dimensione del testo intorno: <Icona nome="calendario" /> dentro un testo da 14px è alta 14px.
const ICONE = {
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  planning: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  manutenzioni: <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3M14.7 6.3 13 4.6a4 4 0 0 0-5.6 5.6l-4.7 4.7 3 3 4.7-4.7" />,
  utenti: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  aziende: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  preventivi: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></>,
  contabilita: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M8 9h8M8 13h5" /></>,
  listino: <><path d="M17 6.5A7 7 0 1 0 17 17.5" /><path d="M4 10h9M4 14h9" /></>,
  impostazioni: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  portale: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>,

  check: <path d="M20 6 9 17l-5-5" />,
  avviso: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></>,
  elenco: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9zM9 11h6M9 15h4" /></>,
  modifica: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></>,
  firma: <><path d="M3 16c3 0 4-8 6-8s0 8 3 8 3-4 5-4 2 2 4 2" /><path d="M3 20h18" /></>,
  documento: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></>,
  cestino: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  banca: <><path d="m3 10 9-6 9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" /></>,
  utente: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  tessera: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h3" /></>,
  nota: <><path d="M4 4h16v12l-4 4H4z" /><path d="M16 20v-4h4M8 9h8M8 13h5" /></>,
  cerca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  contanti: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></>,
  cartella: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  carta: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  allegato: <path d="m21 11.5-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />,
  scarica: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  carica: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  messaggio: <path d="M4 5h16v11H9l-5 4z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  archivio: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11h14V8M10 12h4" /></>,
  lucchetto: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  sblocca: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  campanella: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  foto: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  ripristina: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  piu: <path d="M12 5v14M5 12h14" />,
  luogo: <><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  telefono: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  salva: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
  scudo: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  play: <path d="M8 5v14l11-7z" />,
  giu: <path d="m6 9 6 6 6-6" />,
  fuoco: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-1-2.5-1-4.5 0-7z" />,
  valigetta: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  orologio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  grafico: <path d="M4 20h16M7 16v-5M12 16V7M17 16V9" />,
  cerchio: <circle cx="12" cy="12" r="8" />,
  metà: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>,
};

export default function Icona({ nome, testo = false }) {
  return (
    <svg className={testo ? 'ico ico--testo' : 'ico'} viewBox="0 0 24 24" aria-hidden="true">
      {ICONE[nome]}
    </svg>
  );
}
