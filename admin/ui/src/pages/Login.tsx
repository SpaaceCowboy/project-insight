import { useState } from 'react';
import { api, setCsrf } from '../api';
import { Button, ErrorNote, inputClass } from '../ui';

export function Login({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api<{ email: string; csrf: string }>('POST', '/api/login', { email, password }); setCsrf(r.csrf); onDone(r.email); }
    catch (err) { setError(err); setBusy(false); }
  };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <p className="font-mono text-sm font-semibold text-accent">midori</p>
        <h1 className="text-2xl font-semibold">Control</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">Email
          <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Password
          <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error != null && <ErrorNote error={error} />}
        <Button variant="primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
