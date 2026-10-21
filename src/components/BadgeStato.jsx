// Badge di stato del design system: sempre parola + icona, mai solo colore.
// tipo: 'ok' | 'warn' | 'danger' | 'neutral' | 'brand'
const ICONE = {
  ok: <path d="M20 6 9 17l-5-5" />,
  brand: <path d="M20 6 9 17l-5-5" />,
  warn: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  danger: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" /></>,
};

export default function BadgeStato({ tipo, children, icona = true }) {
  return (
    <span className={`ns-badge ns-badge--${tipo}`}>
      {icona && ICONE[tipo] && <svg viewBox="0 0 24 24" aria-hidden="true">{ICONE[tipo]}</svg>}
      {children}
    </span>
  );
}

const GIORNO = 1000 * 60 * 60 * 24;

// Stato di una scadenza: 'danger' se passata, 'warn' entro `giorniAvviso`, altrimenti 'ok'.
// Restituisce null se non c'è una data.
// eslint-disable-next-line react-refresh/only-export-components
export function statoScadenza(data, giorniAvviso = 30) {
  if (!data) return null;
  const giorni = Math.ceil((new Date(data) - new Date()) / GIORNO);
  if (giorni < 0) return { tipo: 'danger', testo: 'Scaduto', giorni };
  if (giorni <= giorniAvviso) return { tipo: 'warn', testo: 'In scadenza', giorni };
  return { tipo: 'ok', testo: 'Valido', giorni };
}
