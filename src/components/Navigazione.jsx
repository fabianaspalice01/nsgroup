import './Navigazione.css';
import Icona from './Icona';

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
