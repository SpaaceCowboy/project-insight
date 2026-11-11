import { useEffect, useState } from 'react';
import { api, setCsrf } from './api';
import { Hero } from './art';
import { Button, Loading } from './ui';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Audit } from './pages/Audit';

const useRoute = () => {
  const [hash, setHash] = useState(location.hash || '#/users');
  useEffect(() => { const f = () => { setHash(location.hash || '#/users'); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash.replace(/^#/, '').split('/').filter(Boolean);
};

export function App() {
  const [me, setMe] = useState<{ email: string; mail: boolean } | null | undefined>(undefined);
  const [route0, route1] = useRoute();
  useEffect(() => { api<{ email: string; csrf: string; mail: boolean }>('GET', '/api/me').then(r => { setCsrf(r.csrf); setMe(r); }, () => setMe(null)); }, []);
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      {me === undefined ? <Loading label="Loading" /> : me === null ? <Login onDone={setMe} /> : <Shell me={me} route0={route0} route1={route1} onOut={() => setMe(null)} />}
    </>
  );
}

function Shell({ me, route0, route1, onOut }: { me: { email: string; mail: boolean }; route0?: string; route1?: string; onOut: () => void }) {
  const logout = async () => { await api('POST', '/api/logout').catch(() => undefined); onOut(); };
  const nav = (href: string, label: string, on: boolean) => <a href={href} aria-current={on ? 'page' : undefined} className={`inline-flex min-h-12 items-center rounded-[14px] px-4 text-[13px] font-semibold tracking-wide transition-colors ${on ? 'bg-accent text-accent-ink' : 'hover:bg-accent/12'}`}>{label}</a>;
  return (
    <>
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
          <a href="#/users" className="mr-1 flex items-center gap-2.5" aria-label="Midori control, home"><Hero size={30} symbols={false} float={false} /><span className="wordmark">Midori</span></a>
          <nav aria-label="Main" className="flex gap-1.5">{nav('#/users', 'Players', route0 === 'users' || !route0)}{nav('#/audit', 'Audit log', route0 === 'audit')}</nav>
          <span className="support ml-auto hidden max-w-[14rem] truncate md:block">{me.email}</span>
          <Button onClick={logout} className="min-h-11 px-4 text-[13px]">Sign out</Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-7">
        {route0 === 'audit' ? <Audit /> : route0 === 'users' && route1 ? <UserDetail id={route1} key={route1} mail={me.mail} /> : <Users />}
      </main>
    </>
  );
}
