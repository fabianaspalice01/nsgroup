import './Navigazione.css';

// Icone a tratto del design system NS Group (griglia 24px, tratto 1,75)
const ICONE = {
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  planning: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  utenti: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  aziende: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  preventivi: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></>,
  contabilita: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M8 9h8M8 13h5" /></>,
  listino: <><path d="M17 6.5A7 7 0 1 0 17 17.5" /><path d="M4 10h9M4 14h9" /></>,
  impostazioni: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  portale: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>,
};

export function Icona({ nome }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{ICONE[nome]}</svg>;
}

const NOMI_RUOLO = { admin: 'Amministratore', operatore: 'Operatore', consulente: 'Consulente', azienda: 'Azienda' };

function VoceNav({ voce, attiva, onSeleziona }) {
  if (voce.href) {
    return (
      <a className="ns-nav-item" href={voce.href} target="_blank" rel="noopener noreferrer">
        <Icona nome={voce.icona} />{voce.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="ns-nav-item"
      aria-current={attiva ? 'page' : undefined}
      onClick={() => onSeleziona(voce.id)}
    >
      <Icona nome={voce.icona} />{voce.label}
    </button>
  );
}

function Marchio() {
  return (
    <div className="ns-brand">
      <img src="/logo-nsgroup-bianco.png" alt="NS Group – Servizi alle imprese" width="640" height="201" />
    </div>
  );
}

// Guscio dell'app: barra laterale su desktop, barra in alto su telefono.
// `strumenti` sono ricerca e notifiche; `notificheCompatte` è la versione per telefono.
export default function Navigazione({ voci, attiva, onSeleziona, userData, onLogout, isMobile, strumenti, notificheCompatte, children }) {
  const ruolo = NOMI_RUOLO[userData.ruolo] || userData.ruolo;

  if (isMobile) {
    return (
      <div className="ns-shell ns-shell--mobile">
        <header className="ns-mobilebar">
          <div className="ns-mobilebar-row">
            <Marchio />
            {notificheCompatte}
            <button type="button" className="ns-logout" onClick={onLogout}>Esci</button>
          </div>
          {voci.length > 0 && (
            <nav className="ns-mobile-nav" aria-label="Principale">
              {voci.map(v => <VoceNav key={v.id} voce={v} attiva={v.id === attiva} onSeleziona={onSeleziona} />)}
            </nav>
          )}
        </header>
        <main className="ns-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="ns-shell">
      <aside className="ns-sidebar">
        <Marchio />
        <nav className="ns-nav-list" aria-label="Principale">
          {voci.map(v => <VoceNav key={v.id} voce={v} attiva={v.id === attiva} onSeleziona={onSeleziona} />)}
        </nav>
        <div className="ns-sidebar-foot">
          <div className="ns-user">
            <div className="ns-user-name">{userData.nome}</div>
            <div className="ns-user-role">{ruolo}</div>
          </div>
          <button type="button" className="ns-logout" onClick={onLogout}>Esci</button>
        </div>
      </aside>
      <main className="ns-main">
        {strumenti && <div className="ns-topbar">{strumenti}</div>}
        {children}
      </main>
    </div>
  );
}
