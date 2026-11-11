import { useEffect, useRef, useState } from 'react';
import { api, ago, when, type UserRow } from '../api';
import { Button, Empty, ErrorNote, Loading, PageHeader, StatusText, Tabs } from '../ui';

type Filter = '' | 'active' | 'suspended' | 'deleted';
const FILTERS: { id: Filter; label: string }[] = [{ id: '', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'suspended', label: 'Suspended' }, { id: 'deleted', label: 'Deleted' }];
const PAGE = 50;

export function Users() {
  const [q, setQ] = useState(''); const [status, setStatus] = useState<Filter>(''); const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; users: UserRow[] } | null>(null);
  const [error, setError] = useState<unknown>(null); const [tick, setTick] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (matchMedia('(pointer: fine)').matches) search.current?.focus(); }, []);
  // "/" jumps to search from anywhere that isn't a text field.
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); search.current?.focus(); } };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, []);
  useEffect(() => {
    let live = true; setError(null);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ page: String(page), ...(q.trim() ? { q: q.trim() } : {}), ...(status ? { status } : {}) });
      api<{ total: number; users: UserRow[] }>('GET', `/api/users?${qs}`).then(r => live && setData(r), e => live && setError(e));
    }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, status, page, tick]);
  const from = page * PAGE + 1; const to = data ? Math.min(data.total, from + data.users.length - 1) : 0;
  const open = (id: string) => { location.hash = `#/users/${id}`; };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Players" subtitle={data ? `${data.total.toLocaleString()} ${q || status ? 'matching' : 'in total'}` : 'Loading'} />
      <input ref={search} className="field" type="search" aria-label="Search players" placeholder="Search by email, username or player ID (press / to focus)" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
      <Tabs label="Filter by status" value={status} onChange={v => { setStatus(v); setPage(0); }} items={FILTERS} />
      {error != null ? <ErrorNote error={error} retry={() => setTick(t => t + 1)} /> : !data ? <Loading label="Loading players" /> : data.users.length === 0 ? <Empty>No players match.</Empty> : (
        <>
          <div className="card overflow-x-auto">
            <table className="tbl tbl-click">
              <thead><tr><th>Player</th><th className="hidden md:table-cell">Email</th><th>Status</th><th className="hidden sm:table-cell">Worlds</th><th className="hidden sm:table-cell">Joined</th></tr></thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id} onClick={() => open(u.id)}>
                    <td><a href={`#/users/${u.id}`} onClick={e => e.stopPropagation()} className="font-semibold">{u.username}</a><span className="small muted block truncate md:hidden">{u.email}</span></td>
                    <td className="muted hidden md:table-cell">{u.email}</td>
                    <td><StatusText status={u.status} /></td>
                    <td className="hidden sm:table-cell">{u.worlds === 'active' ? 'Active' : <span className="muted">{u.worlds === 'none' ? '—' : u.worlds}</span>}</td>
                    <td className="muted hidden whitespace-nowrap sm:table-cell" title={when(u.created_at)}>{ago(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="small muted">{from.toLocaleString()}–{to.toLocaleString()} of {data.total.toLocaleString()}</span>
            {data.total > PAGE && <span className="flex gap-2"><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button disabled={to >= data.total} onClick={() => setPage(page + 1)}>Next</Button></span>}
          </div>
        </>
      )}
    </div>
  );
}
