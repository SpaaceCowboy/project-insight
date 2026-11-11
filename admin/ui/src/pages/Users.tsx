import { useEffect, useState } from 'react';
import { api, when, type UserRow } from '../api';
import { Badge, Button, ErrorNote, Loading, inputClass, statusBadge } from '../ui';

export function Users() {
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; users: UserRow[] } | null>(null);
  const [error, setError] = useState<unknown>(null); const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true; setError(null);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ page: String(page), ...(q.trim() ? { q: q.trim() } : {}), ...(status ? { status } : {}) });
      api<{ total: number; users: UserRow[] }>('GET', `/api/users?${qs}`).then(r => live && setData(r), e => live && setError(e));
    }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, status, page, tick]);
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">Search
          <input className={inputClass} type="search" placeholder="Email, username or player ID" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Status
          <select className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
          </select>
        </label>
      </div>
      {error != null ? <ErrorNote error={error} retry={() => setTick(t => t + 1)} /> : !data ? <Loading label="Loading players" /> : (
        <>
          <p className="text-sm text-muted" aria-live="polite">{data.total} {data.total === 1 ? 'player' : 'players'}</p>
          <div className="overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr><th className="p-3">Player</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Worlds</th><th className="p-3">Joined</th></tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-raise">
                    <td className="p-0"><a className="block p-3 font-semibold text-accent underline-offset-2 hover:underline" href={`#/users/${u.id}`}>{u.username}</a></td>
                    <td className="p-3 font-mono text-xs">{u.email}</td>
                    <td className="p-3">{statusBadge(u.status)}</td>
                    <td className="p-3"><Badge kind={u.worlds === 'active' ? 'ok' : u.worlds === 'none' ? 'neutral' : 'warn'}>{u.worlds}</Badge></td>
                    <td className="p-3 text-muted">{when(u.created_at)}</td>
                  </tr>
                ))}
                {data.users.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">No players match.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-muted">Page {page + 1} of {pages}</span>
            <Button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
