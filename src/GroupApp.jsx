import { Toaster } from 'react-hot-toast';
import App from './App';
import Login from './components/Login';
import { useAuth } from './hooks/useAuth';
import { useNotifiche } from './hooks/useNotifiche';
import './GroupApp.css';

// Dopo il login si entra direttamente nella home NSGroup; la scelta dell'azienda è nella Contabilità
function Sessione({ session }) {
  useNotifiche(session.userData);
  return <App session={session} />;
}

export default function GroupApp() {
  const session = useAuth();
  if (session.loading) return <div className="group-loading" role="status">Caricamento NSGroup...</div>;
  if (!session.user || !session.userData) return <><Toaster position="bottom-right" /><Login onLogin={session.login} /></>;
  return <Sessione key={`${session.user.uid}:${session.userData.ruolo}`} session={session} />;
}
