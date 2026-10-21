import { useState } from 'react';
import { useAccount } from './AccountContext.jsx';

export default function AccountPanel({ onOpenDataset }) {
  const { user, datasets, isLoading, login, register, logout, deleteDataset } = useAccount();
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage('');
    setIsWorking(true);
    const fields = new FormData(form);
    const credentials = {
      username: fields.get('username'),
      password: fields.get('password'),
      ...(isRegistering ? { email: fields.get('email') } : {}),
    };
    try {
      if (isRegistering) await register(credentials);
      else await login(credentials);
      form.reset();
      setMessage(isRegistering ? 'Account created and signed in.' : 'Signed in.');
    } catch (error) {
      setMessage(error.message || 'Could not connect to the account service.');
    } finally {
      setIsWorking(false);
    }
  }

  async function signOut() {
    setIsWorking(true);
    try { await logout(); } catch (error) {
      setMessage(error.message || 'Signed out locally.');
    } finally { setIsWorking(false); }
  }

  async function removeDataset(id) {
    setIsWorking(true);
    setMessage('');
    try { await deleteDataset(id); }
    catch (error) { setMessage(error.message || 'Could not delete this dataset.'); }
    finally { setIsWorking(false); }
  }

  return (
    <section className="account-panel" aria-label="InsightX account">
      {isLoading ? <p className="account-note">Checking your account…</p> : user ? (
        <>
          <div className="account-heading">
            <div><span className="section-kicker">YOUR ACCOUNT</span><h2>{user.username}</h2></div>
            <button className="report-button" type="button" onClick={signOut} disabled={isWorking}>Sign out</button>
          </div>
          <h3 className="saved-datasets-title">Saved datasets <span>{datasets.length}</span></h3>
          {datasets.length ? <ul className="saved-dataset-list">
            {datasets.map((dataset) => (
              <li key={dataset.id}>
                <div><strong>{dataset.name}</strong><small>{dataset.original_filename} · {dataset.profile_status}</small></div>
                <button type="button" className="report-button" onClick={() => onOpenDataset(dataset)} disabled={isWorking}>Open</button>
                <button type="button" className="report-button" onClick={() => removeDataset(dataset.id)} disabled={isWorking}>Delete</button>
              </li>
            ))}
          </ul> : <p className="account-note">No datasets saved yet. Open a file and choose “Save to account”.</p>}
        </>
      ) : (
        <>
          <div className="account-heading">
            <div><span className="section-kicker">CLOUD SAVED DATASETS</span><h2>{isRegistering ? 'Create an account' : 'Sign in to InsightX'}</h2></div>
            <p>Files stay local until you choose to save one to your account.</p>
          </div>
          <form className="account-form" onSubmit={submit}>
            <label>Username<input name="username" autoComplete="username" minLength="1" maxLength="150" required /></label>
            {isRegistering && <label>Email <span className="optional-label">optional</span><input name="email" type="email" autoComplete="email" maxLength="254" /></label>}
            <label>Password<input name="password" type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={isRegistering ? 8 : 1} required /></label>
            <button className="report-button" type="submit" disabled={isWorking}>{isWorking ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
          </form>
          <button className="account-toggle" type="button" onClick={() => { setIsRegistering((current) => !current); setMessage(''); }}>
            {isRegistering ? 'Already have an account? Sign in' : 'New to InsightX? Create an account'}
          </button>
        </>
      )}
      {message && <p className="account-message" role="status">{message}</p>}
    </section>
  );
}
