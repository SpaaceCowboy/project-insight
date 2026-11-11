import { useEffect, useState } from 'react';
import { api, actionLabel, when, type AuditRow } from '../api';
import { Button, Empty, ErrorNote, Loading, PageHeader, Tabs } from '../ui';

/** One row per change: when, what, (who it was done to), who did it, and why. */
export function AuditList({ rows, showPlayer = true }: { rows: AuditRow[]; showPlayer?: boolean }) {
  if (rows.length === 0) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>When</th><th>Action</th>{showPlayer && <th>Player</th>}<th>By</th><th>Reason</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="whitespace-nowrap muted">{when(r.created_at)}</td>
              <td className="font-semibold">{actionLabel(r.action)}</td>
              {showPlayer && <td>{r.subject_user_id ? <a className="link" href={`#/users/${r.subject_user_id}`}>Open</a> : <span className="muted">—</span>}</td>}
              <td className="muted">{r.admin ?? 'system'}</td>
              <td className="min-w-48">{r.reason ?? <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit log" subtitle="Every change, who made it and why. Newest first." />
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
