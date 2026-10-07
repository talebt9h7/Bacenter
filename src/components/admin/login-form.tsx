'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck, UserRound } from 'lucide-react';

export function LoginForm({ hint }: { hint: string | null }) {
  const [mode, setMode] = useState<'owner' | 'team'>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: mode === 'team' ? username : '', password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.replace('/admin'); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
      setBusy(false);
    }
  }

  return <main className="admin-login">
    <form className="admin-login-card" onSubmit={submit}>
      <img src="/images/bellroy-logo.svg" alt="Bellroy" width="88" height="52" />
      <span className="admin-eyebrow"><ShieldCheck size={14} /> Store administration</span>
      <h1>Welcome back.</h1>
      <p>{mode === 'owner' ? 'Sign in as the store owner.' : 'Sign in with your team account.'}</p>

      {mode === 'team' && <>
        <label htmlFor="admin-username">Username</label>
        <div className="admin-input-icon"><UserRound size={17} /><input id="admin-username" type="text" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required autoFocus /></div>
      </>}

      <label htmlFor="admin-password">Password</label>
      <div className="admin-input-icon"><KeyRound size={17} /><input id="admin-password" type="password" autoComplete={mode === 'owner' ? 'current-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required autoFocus={mode === 'owner'} /></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button className="admin-btn admin-btn-primary admin-btn-block" type="submit" disabled={busy}>
        {busy ? <LoaderCircle size={17} className="spin" /> : <>Sign in <ArrowRight size={16} /></>}
      </button>

      <button type="button" className="admin-btn admin-btn-ghost admin-btn-block" onClick={() => { setMode(mode === 'owner' ? 'team' : 'owner'); setError(''); setPassword(''); }}>
        {mode === 'owner' ? 'Sign in as team member' : 'Sign in as owner'}
      </button>

      {mode === 'owner' && hint && <small>Demo environment: no <code>ADMIN_PASSWORD</code> is configured, so the password is <code>{hint}</code>. Set <code>ADMIN_PASSWORD</code> in your environment to change it.</small>}
    </form>
  </main>;
}
