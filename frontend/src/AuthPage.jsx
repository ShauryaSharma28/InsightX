import { useState } from 'react';
import './AuthPage.css';

const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (registering && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/auth/${registering ? 'register' : 'login'}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.detail || Object.values(result).flat().join(' '));
        return;
      }
      localStorage.setItem('insightx.access', result.access);
      localStorage.setItem('insightx.refresh', result.refresh);
      localStorage.setItem('insightx.user', JSON.stringify(result.user));
      window.location.assign(window.location.pathname);
    } catch {
      setMessage('Could not connect to InsightX. Check that the API is running and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <a className="auth-brand" href={window.location.pathname} aria-label="InsightX home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>insight<span>x</span></a>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-kicker">YOUR DATA, IN A NEW LIGHT</span>
        <h1 id="auth-title">{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p>{registering ? 'Create an account only if you want to save datasets online. You can use InsightX locally without one.' : 'Sign in to save datasets to your account. Your local workspace does not require an account.'}</p>
        <form onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={registering ? 8 : undefined} required /></label>
          {registering && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>}
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">{registering ? 'Already have an account?' : 'New to InsightX?'} <a href={`?auth=${registering ? 'login' : 'register'}`}>{registering ? 'Sign in' : 'Create an account'}</a></p>
      </section>
      <a className="auth-back" href={window.location.pathname}>← Back to workspace</a>
    </main>
  );
}
