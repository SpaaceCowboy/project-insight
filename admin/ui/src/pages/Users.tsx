import { useEffect, useRef, useState } from 'react';
import { api, ago, when, type UserRow } from '../api';
import { Avatar, SearchIcon } from '../art';
import { Button, Chip, Empty, ErrorNote, Loading, PageHeader, StatusChip, Tabs } from '../ui';

type Filter = '' | 'active' | 'suspended' | 'deleted';
const FILTERS: { id: Filter; label: string }[] = [{ id: '', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'suspended', label: 'Suspended' }, { id: 'deleted', label: 'Deleted' }];

export function Users() {
  const [q, setQ] = useState(''); const [status, setStatus] = useState<Filter>(''); const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; users: UserRow[] } | null>(null);
  const [error, setError] = useState<unknown>(null); const [tick, setTick] = useState(0);
  const search = useRef<HTMLInputElement>(null);
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
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Control" title="Players" subtitle={data ? `${data.total} ${data.total === 1 ? 'player' : 'players'}${q || status ? ' match' : ''}` : 'Loading'} />
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><SearchIcon size={18} /></span>
        <input ref={search} className="field pl-11" type="search" aria-label="Search players" placeholder="Search email, username or ID  ·  press /" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
      </div>
      <Tabs label="Filter by status" value={status} onChange={v => { setStatus(v); setPage(0); }} items={FILTERS} />
      {error != null ? <ErrorNote error={error} retry={() => setTick(t => t + 1)} /> : !data ? <Loading label="Loading players" /> : data.users.length === 0 ? <Empty>No players match.</Empty> : (
        <>
          <ul className="flex flex-col gap-2">
            {data.users.map(u => (
              <li key={u.id}>
                <a href={`#/users/${u.id}`} className="row-link card">
                  <Avatar id={u.id} name={u.username} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="title block truncate">{u.username}</span>
                    <span className="support block truncate">{u.email}</span>
                    <span className="support mt-0.5 block sm:hidden" title={when(u.created_at)}>Joined {ago(u.created_at)}</span>
                  </span>
                  <span className="hidden text-right sm:block"><span className="support" title={when(u.created_at)}>Joined {ago(u.created_at)}</span></span>
                  <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    {u.worlds === 'active' && <Chip tone="ok">Worlds</Chip>}
                    <StatusChip status={u.status} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="support">Page {page + 1} of {pages}</span>
              <Button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
