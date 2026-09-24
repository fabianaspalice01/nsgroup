import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import App from './App';
import Login from './components/Login';
import CrmContabilita from './components/crm/CrmContabilita';
import { useAuth } from './hooks/useAuth';
import { useNotifiche } from './hooks/useNotifiche';
import './GroupApp.css';

// Aziende con un'area già pronta; le altre mostrano "In preparazione"
const pronte = ['consulting', 'safety'];

const companies = [
  { id: 'consulting', name: 'NSConsulting', logo: '/logo-nsconsulting.jpeg' },
  { id: 'safety', name: 'NS Safety Solutions', logo: '/logo-nssafety.jpeg' },
  { id: 'academy', name: 'NS Academy', logo: '/logo-nsacademy.jpeg' },
];

function CompanySession({ session }) {
  const [company, setCompany] = useState(null);
  const [leaving, setLeaving] = useState(false);
  useNotifiche(session.userData);

  const logout = async () => {
    setLeaving(true);
    try {
      await session.logout();
    } finally {
      setLeaving(false);
    }
  };

  if (session.userData.ruolo !== 'admin') {
    return <App session={session} />;
  }

  if (company?.id === 'consulting') {
    return <App session={session} onChangeCompany={() => setCompany(null)} />;
  }

  if (company?.id === 'safety') {
    return (
      <div className="group-crm">
        <Toaster position="bottom-right" />
        <header className="group-crm-bar">
          <button type="button" className="group-back" onClick={() => setCompany(null)}>Cambia azienda</button>
          <img src={company.logo} alt={company.name} />
          <div className="group-account">
            <span>{session.userData.nome}</span>
            <button type="button" onClick={logout} disabled={leaving}>{leaving ? 'Uscita...' : 'Esci'}</button>
          </div>
        </header>
        <CrmContabilita className="crm-frame" azienda="safety" nomeAzienda="NS Safety" utente={session.userData.nome} />
      </div>
    );
  }

  return (
    <div className="group-shell">
      <Toaster position="bottom-right" />
      <header className="group-header">
        <img className="group-logo" src="/logo-nsgroup-completo.jpeg" alt="NSGroup" width="1399" height="768" />
        <div className="group-account">
          <span>{session.userData.nome}</span>
          <button type="button" onClick={logout} disabled={leaving}>{leaving ? 'Uscita...' : 'Esci'}</button>
        </div>
      </header>
      <main className="group-main">
        {company ? (
          <>
            <button type="button" className="group-back" onClick={() => setCompany(null)}>Cambia azienda</button>
            <section className="group-empty">
              <img src={company.logo} alt={company.name} />
              <h1>{company.name}</h1>
              <p>Area in preparazione</p>
            </section>
          </>
        ) : (
          <>
            <h1>Scegli l'azienda</h1>
            <div className="group-companies">
              {companies.map(item => (
                <button className="group-company" type="button" key={item.id} onClick={() => setCompany(item)} aria-label={`Accedi a ${item.name}`}>
                  <div className="group-company-image"><img src={item.logo} alt="" /></div>
                  <span className="group-company-name">{item.name}</span>
                  {!pronte.includes(item.id) && <span className="group-company-status">In preparazione</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function GroupApp() {
  const session = useAuth();
  if (session.loading) return <div className="group-loading" role="status">Caricamento NSGroup...</div>;
  if (!session.user || !session.userData) return <><Toaster position="bottom-right" /><Login onLogin={session.login} /></>;
  return <CompanySession key={`${session.user.uid}:${session.userData.ruolo}`} session={session} />;
}
