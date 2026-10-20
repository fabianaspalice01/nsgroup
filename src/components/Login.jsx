import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setResetMsg('');

    if (!email) {
      setError('Inserisci la tua email');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg('Email inviata! Controlla la tua casella di posta.');
    } catch (err) {
      setError('Email non trovata o non valida.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--navy-900) 100%)',
      padding: 20
    }}>
      <div style={{
        background: 'white',
        padding: 40,
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: 400
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img
            src="/logo-nsgroup-completo.jpeg"
            alt="NSGroup - Servizi alle imprese: Consulting, Safety Solutions e Academy"
            width={1399}
            height={768}
            style={{ display: 'block', width: '100%', height: 'auto', margin: '0 auto' }}
          />
{/*           <p style={{ color: 'var(--ink-muted)', marginTop: 8, fontSize: 14 }}>Gestione Sicurezza sul Lavoro</p>
 */}        </div>

        {resetMode ? (
          <form onSubmit={handleReset}>
            <p style={{ color: 'var(--ink-muted)', fontSize: 14, marginBottom: 20 }}>
              Inserisci la tua email e ti invieremo un link per reimpostare la password.
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tua@email.com"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 20, border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            {resetMsg && (
              <div style={{ background: 'var(--success-soft)', color: 'var(--success)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 20, border: '1px solid #bbf7d0' }}>
                {resetMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: loading ? 'var(--ink-muted)' : 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 12,
              }}
            >
              {loading ? 'Invio in corso...' : 'Invia email di reset'}
            </button>

            <button
              type="button"
              onClick={() => { setResetMode(false); setError(''); setResetMsg(''); }}
              style={{
                width: '100%',
                padding: '10px 24px',
                background: 'transparent',
                color: 'var(--primary)',
                border: '2px solid var(--primary)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Torna al login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tua@email.com"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setResetMode(true); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Password dimenticata?
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 20, border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: loading ? 'var(--ink-muted)' : 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = 'var(--primary-hover)')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'var(--primary)')}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--ink-muted)' }}>
          Accedi con le credenziali fornite dall'amministratore
        </p>
      </div>
    </div>
  );
}

export default Login;
