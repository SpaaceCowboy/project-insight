import { useEffect, useState } from 'react';
import { api, setCsrf, setOnUnauth } from './api';
import { Button, Loading, useToast } from './ui';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Audit } from './pages/Audit';

const useRoute = () => {
  const [hash, setHash] = useState(location.hash || '#/users');
  useEffect(() => { const f = () => { setHash(location.hash || '#/users'); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash.replace(/^#/, '').split('/').filter(Boolean);
};

type Me = { email: string; mail: boolean };

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [route0, route1] = useRoute();
  const [toast, toastNode] = useToast();
  useEffect(() => { setOnUnauth(() => setMe(null)); }, []); // an expired session sends you back to the sign-in form
  useEffect(() => { api<Me & { csrf: string }>('GET', '/api/me').then(r => { setCsrf(r.csrf); setMe(r); }, () => setMe(null)); }, []);
  if (me === undefined) return <Loading label="Loading" />;
  if (me === null) return <Login onDone={setMe} />;
  const logout = async () => { await api('POST', '/api/logout').catch(() => undefined); setMe(null); };
  const nav = (href: string, label: string, on: boolean) => <a href={href} aria-current={on ? 'page' : undefined} className="nav">{label}</a>;
  return (
    <>
      <header className="bar sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4">
          <a href="#/users" className="wordmark hidden sm:block">Midori</a>
          <nav aria-label="Main" className="flex gap-5">{nav('#/users', 'Players', route0 === 'users' || !route0)}{nav('#/audit', 'Audit log', route0 === 'audit')}</nav>
          <span className="small muted ml-auto hidden max-w-[16rem] truncate md:block">{me.email}</span>
          <Button onClick={logout} className="ml-auto md:ml-0">Sign out</Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
        {route0 === 'audit' ? <Audit /> : route0 === 'users' && route1 ? <UserDetail id={route1} key={route1} mail={me.mail} toast={toast} /> : <Users />}
      </main>
      {toastNode}
    </>
  );
}
