import { useEffect, useState } from 'react';
import { api, setCsrf } from './api';
import { Button, Loading } from './ui';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Audit } from './pages/Audit';

const useRoute = () => {
  const [hash, setHash] = useState(location.hash || '#/users');
  useEffect(() => { const f = () => setHash(location.hash || '#/users'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash.replace(/^#/, '').split('/').filter(Boolean);
};

export function App() {
  const [admin, setAdmin] = useState<string | null | undefined>(undefined);
  const [route0, route1] = useRoute();
  useEffect(() => {
    api<{ email: string; csrf: string }>('GET', '/api/me').then(r => { setCsrf(r.csrf); setAdmin(r.email); }, () => setAdmin(null));
  }, []);
  if (admin === undefined) return <Loading label="Loading" />;
  if (admin === null) return <Login onDone={setAdmin} />;
  const logout = async () => { await api('POST', '/api/logout').catch(() => undefined); setAdmin(null); };
  const link = (href: string, label: string, on: boolean) => <a href={href} aria-current={on ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${on ? 'bg-raise text-ink' : 'text-muted hover:text-ink'}`}>{label}</a>;
  return (
    <>
      <header className="border-b border-line bg-panel">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
          <span className="mr-3 font-mono text-sm font-semibold text-accent">midori · control</span>
          {link('#/users', 'Players', route0 === 'users')}{link('#/audit', 'Audit log', route0 === 'audit')}
          <span className="ml-auto text-xs text-muted">{admin}</span><Button onClick={logout}>Sign out</Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {route0 === 'audit' ? <Audit /> : route0 === 'users' && route1 ? <UserDetail id={route1} key={route1} /> : <Users />}
      </main>
    </>
  );
}
