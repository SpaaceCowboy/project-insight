import { useState } from 'react';
import { api, setCsrf } from '../api';
import { Button, ErrorNote } from '../ui';

export function Login({ onDone }: { onDone: (me: { email: string; mail: boolean }) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api<{ email: string; csrf: string; mail: boolean }>('POST', '/api/login', { email, password }); setCsrf(r.csrf); onDone(r); }
    catch (err) { setError(err); setBusy(false); }
  };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div><h1 className="wordmark">Midori</h1><p className="muted small mt-2">Control room. Sign in to continue.</p></div>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5"><span className="small font-semibold">Email</span>
          <input className="field" type="email" autoComplete="username" autoFocus required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5"><span className="small font-semibold">Password</span>
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error != null && <ErrorNote error={error} />}
        <Button variant="primary" type="submit" disabled={busy} aria-busy={busy} className="btn-lg">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
