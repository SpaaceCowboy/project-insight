import { useEffect, useState } from 'react';
import { api, when, type AuditRow } from '../api';
import { Button, ErrorNote, Loading, inputClass } from '../ui';

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">By</th><th className="p-3">Reason / detail</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
              <td className="whitespace-nowrap p-3 text-muted">{when(r.created_at)}</td>
              <td className="p-3 font-mono text-xs">{r.action}{r.subject_user_id && <> <a className="text-accent hover:underline" href={`#/users/${r.subject_user_id}`}>↗</a></>}</td>
              <td className="p-3">{r.admin ?? '—'}</td>
              <td className="p-3">{r.reason && <p>{r.reason}</p>}{Object.keys(r.detail).length > 0 && <p className="font-mono text-xs text-muted">{JSON.stringify(r.detail)}</p>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">Nothing recorded.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Audit() {
  const [action, setAction] = useState(''); const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditRow[] | null>(null); const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let live = true; setError(null);
    const qs = new URLSearchParams({ page: String(page), ...(action ? { action } : {}) });
    api<AuditRow[]>('GET', `/api/audit?${qs}`).then(r => live && setRows(r), e => live && setError(e));
    return () => { live = false; };
  }, [action, page]);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-1.5 text-sm font-medium">Action starts with
        <input className={inputClass} placeholder="user.hard_delete" value={action} onChange={e => { setAction(e.target.value.trim()); setPage(0); }} />
      </label>
      {error != null ? <ErrorNote error={error} /> : !rows ? <Loading label="Loading audit log" /> : (
        <>
          <AuditTable rows={rows} />
          <div className="flex justify-between"><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><Button disabled={rows.length < 100} onClick={() => setPage(page + 1)}>Older</Button></div>
        </>
      )}
    </div>
  );
}
