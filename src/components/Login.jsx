import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

const ICONE = {
  freccia: <path d="M5 12h14M13 6l6 6-6 6" />,
  occhio: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  occhioChiuso: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  avviso: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
};
const Svg = ({ nome }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONE[nome]}</svg>;

// Gli archi dell'orbita che nei loghi gira intorno a «NS»
function Orbita() {
  return (
    <svg className="login-orbit" viewBox="0 0 800 800" aria-hidden="true">
      <g className="login-ring login-ring--3">
        <ellipse cx="400" cy="400" rx="250" ry="105" pathLength="1" />
      </g>
      <g className="login-ring login-ring--1">
        <ellipse cx="400" cy="400" rx="330" ry="140" pathLength="1" />
        <circle className="login-satellite" cx="730" cy="400" r="6" />
      </g>
      <g className="login-ring login-ring--2">
        <ellipse cx="400" cy="400" rx="390" ry="170" pathLength="1" />
      </g>
    </svg>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostraPassword, setMostraPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tentativiErrati, setTentativiErrati] = useState(0);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const mostraErrore = (msg) => {
    setError(msg);
    setTentativiErrati(n => n + 1); // fa ripartire l'animazione del messaggio
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      mostraErrore('Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      mostraErrore(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setResetMsg('');

    if (!email) {
      mostraErrore('Inserisci la tua email');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg('Email inviata. Controlla la tua casella di posta.');
    } catch {
      mostraErrore('Email non trovata o non valida.');
    } finally {
      setLoading(false);
    }
  };

  const cambiaModo = (reset) => {
    setResetMode(reset);
    setError('');
    setResetMsg('');
  };

  const erroreBox = error && (
    <div key={tentativiErrati} className="login-alert login-alert--error" role="alert">
      <Svg nome="avviso" />{error}
    </div>
  );

  return (
    <div className="login">
      <section className="login-brand">
        <Orbita />
        <img
          className="login-logo"
          src="/logo-nsgroup-completo-bianco.png"
          alt="NS Group – Servizi alle imprese: NS Consulting, NS Safety Solutions e NS Academy"
          width="1200"
          height="583"
        />
        <p className="login-claim">Consulenza · Formazione · Igiene · Antincendio · Medicina del lavoro</p>
      </section>

      <main className="login-main">
        <div className="login-card">
          {resetMode ? (
            <form key="reset" className="login-panel" onSubmit={handleReset} noValidate>
              <div className="login-head">
                <h1>Recupera la password</h1>
                <p>Inserisci la tua email: ti mandiamo un link per sceglierne una nuova.</p>
              </div>

              <div className="login-field">
                <label className="ns-label" htmlFor="login-email-reset">Email</label>
                <input
                  id="login-email-reset"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                  disabled={loading}
                  autoFocus
                />
              </div>

              {erroreBox}
              {resetMsg && (
                <div className="login-alert login-alert--ok" role="status">
                  <Svg nome="check" />{resetMsg}
                </div>
              )}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? <><span className="login-spinner" />Invio in corso…</> : <>Invia il link<Svg nome="freccia" /></>}
              </button>

              <button type="button" className="login-secondary" onClick={() => cambiaModo(false)}>
                Torna all'accesso
              </button>
            </form>
          ) : (
            <form key="login" className="login-panel" onSubmit={handleSubmit} noValidate>
              <div className="login-head">
                <h1>Bentornato</h1>
                <p>Accedi con le credenziali fornite dall'amministratore.</p>
              </div>

              <div className="login-field">
                <label className="ns-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                  disabled={loading}
                />
              </div>

              <div className="login-field">
                <div className="login-field-row">
                  <label className="ns-label" htmlFor="login-password">Password</label>
                  <button type="button" className="login-link" onClick={() => cambiaModo(true)}>
                    Password dimenticata?
                  </button>
                </div>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    className="login-input login-input--pw"
                    type={mostraPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="La tua password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setMostraPassword(v => !v)}
                    aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                    aria-pressed={mostraPassword}
                  >
                    <Svg nome={mostraPassword ? 'occhioChiuso' : 'occhio'} />
                  </button>
                </div>
              </div>

              {erroreBox}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? <><span className="login-spinner" />Accesso in corso…</> : <>Accedi<Svg nome="freccia" /></>}
              </button>

              <p className="login-foot">Problemi di accesso? Contatta l'amministratore di NS Group.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default Login;
