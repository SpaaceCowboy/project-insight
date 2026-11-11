import { useEffect, useState } from 'react';
import { api, actionLabel, ago, when, type AuditRow } from '../api';
import { Button, Empty, ErrorNote, Loading, PageHeader, Tabs } from '../ui';

export function AuditList({ rows, showPlayer = true }: { rows: AuditRow[]; showPlayer?: boolean }) {
  if (rows.length === 0) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(r => (
        <li key={r.id} className="card px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold tracking-wide">{actionLabel(r.action)}</p>
            <p className="support flex-none" title={when(r.created_at)}>{ago(r.created_at)}</p>
          </div>
          {r.reason && <p className="mt-1.5 text-sm leading-relaxed">{r.reason}</p>}
          <p className="support mt-1.5">
            {r.admin ?? 'system'}
            {showPlayer && r.subject_user_id && <> · <a className="text-accent underline-offset-2 hover:underline" href={`#/users/${r.subject_user_id}`}>open player</a></>}
          </p>
        </li>
      ))}
    </ul>
  );
}

type Scope = '' | 'user.' | 'entitlement.' | 'admin.';
const SCOPES: { id: Scope; label: string }[] = [{ id: '', label: 'All' }, { id: 'user.', label: 'Players' }, { id: 'entitlement.', label: 'Payments' }, { id: 'admin.', label: 'Admins' }];

export function Audit() {
  const [scope, setScope] = useState<Scope>(''); const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditRow[] | null>(null); const [error, setError] = useState<unknown>(null); const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true; setError(null); setRows(null);
    const qs = new URLSearchParams({ page: String(page), ...(scope ? { action: scope } : {}) });
    api<AuditRow[]>('GET', `/api/audit?${qs}`).then(r => live && setRows(r), e => live && setError(e));
    return () => { live = false; };
  }, [scope, page, tick]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Control" title="Audit log" subtitle="Every change, who made it and why" />
      <Tabs label="Filter the log" value={scope} onChange={v => { setScope(v); setPage(0); }} items={SCOPES} />
      {error != null ? <ErrorNote error={error} retry={() => setTick(t => t + 1)} /> : !rows ? <Loading label="Loading the log" /> : (
        <>
          <AuditList rows={rows} />
          {(page > 0 || rows.length >= 100) && (
            <div className="flex justify-between gap-3"><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><Button disabled={rows.length < 100} onClick={() => setPage(page + 1)}>Older</Button></div>
          )}
        </>
      )}
    </div>
  );
}
