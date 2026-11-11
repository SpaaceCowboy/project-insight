import { useState } from 'react';
import { api, setCsrf } from '../api';
import { Hero } from '../art';
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[22.5rem] flex-col justify-center gap-7 px-4 py-10">
      <div className="flex flex-col items-center gap-5 text-center">
        <Hero size={112} />
        <div>
          <h1 className="wordmark text-[26px]">Midori</h1>
          <p className="support mt-2 text-sm">Control room</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5"><span className="section-title">Email</span>
          <input className="field" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5"><span className="section-title">Password</span>
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error != null && <ErrorNote error={error} />}
        <Button variant="primary" type="submit" disabled={busy} aria-busy={busy} className="mt-1.5 min-h-14">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
