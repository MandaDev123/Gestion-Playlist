import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logoArea}>
          <span style={styles.logoIcon}>🎵</span>
          <h1 style={styles.logoText}>Smart MP3</h1>
        </div>

        <h2 style={styles.title}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <p style={styles.subtitle}>
          {mode === 'login'
            ? 'Connectez-vous pour retrouver vos playlists.'
            : 'Inscrivez-vous pour créer et sauvegarder vos playlists.'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Nom d'utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
                minLength={3}
                placeholder="ex: MelodyFan"
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              placeholder="vous@exemple.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              minLength={6}
              placeholder="Au moins 6 caractères"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting
              ? 'Veuillez patienter...'
              : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button type="button" onClick={switchMode} style={styles.switchLink}>
            {mode === 'login' ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b0d',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    boxSizing: 'border-box'
  },
  card: {
    width: '380px',
    maxWidth: '90vw',
    backgroundColor: '#12141c',
    border: '1px solid #1f2430',
    borderRadius: '16px',
    padding: '36px 32px',
    boxSizing: 'border-box',
    boxShadow: '0 20px 50px rgba(0,0,0,0.4)'
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '24px'
  },
  logoIcon: {
    fontSize: '22px',
    background: 'linear-gradient(135deg, #1db954, #1ed760)',
    padding: '6px',
    borderRadius: '8px'
  },
  logoText: {
    fontSize: '17px',
    fontWeight: '700',
    margin: 0,
    color: '#fff'
  },
  title: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 6px 0'
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: '13px',
    margin: '0 0 24px 0',
    lineHeight: 1.5
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af'
  },
  input: {
    backgroundColor: '#0a0b0d',
    border: '1px solid #1f2430',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  error: {
    color: '#f87171',
    fontSize: '13px',
    margin: 0,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: '8px 12px',
    borderRadius: '8px'
  },
  submitBtn: {
    backgroundColor: '#1db954',
    color: '#fff',
    border: 'none',
    padding: '12px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '4px'
  },
  switchText: {
    marginTop: '20px',
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center'
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#1db954',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    padding: 0
  }
};