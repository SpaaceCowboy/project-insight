import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, when } from '../api';
import { ActionDialog, Badge, Button, ErrorNote, Loading, Panel, statusBadge, useToast, type Field } from '../ui';
import { AuditTable } from './Audit';

const reason: Field = { name: 'reason', label: 'Reason', type: 'textarea', min: 3, max: 500, hint: 'Recorded in the audit log. Never shown to the player.' };
const ENTITLEMENTS = ['active', 'none', 'revoked', 'refunded'];

interface Action { key: string; title: string; description?: ReactNode; fields: Field[]; confirm: string; danger?: boolean; path: string; done: string; pick?: (v: Record<string, string>) => object }

export function UserDetail({ id }: { id: string }) {
  const [u, setU] = useState<any>(null); const [error, setError] = useState<unknown>(null);
  const [active, setActive] = useState<Action | null>(null); const [toast, toastNode] = useToast();
  const load = useCallback(() => { setError(null); return api('GET', `/api/users/${id}`).then(setU, e => { setU(null); setError(e); }); }, [id]);
  useEffect(() => { setU(null); load(); }, [load]);
  if (error != null) return <><a className="text-sm text-accent hover:underline" href="#/users">← Players</a><div className="mt-4"><ErrorNote error={error} retry={load} /></div></>;
  if (!u) return <Loading label="Loading player" />;

  const s = u.stats; const deleted = u.status === 'deleted'; const suspended = u.status === 'suspended';
  const actions: Record<string, Action> = {
    rename: { key: 'rename', title: 'Change username', fields: [{ name: 'name', label: 'New username', initial: u.username, min: 3, max: 20 }, reason], confirm: 'Change username', path: 'rename', done: 'Username changed.', description: 'Uses the same rules as the app: 3–20 English letters, numbers, spaces, _ and -; no banned words; unique.' },
    email: { key: 'email', title: 'Change email', fields: [{ name: 'email', label: 'New email', type: 'email', initial: u.email }, reason], confirm: 'Change email', path: 'email', done: 'Email changed.' },
    recovery: { key: 'recovery', title: 'Send password reset code', fields: [], confirm: 'Send code', path: 'send-recovery', done: 'Reset code queued.', description: <>Emails an 8-digit code (valid 15 minutes) to <b>{u.email}</b>. The player enters it in the app under “Forgot password”. Allowed once a minute.</> },
    signout: { key: 'signout', title: 'Sign out everywhere', fields: [reason], confirm: 'Sign out', path: 'revoke-sessions', done: 'All sessions revoked.' },
    suspend: { key: 'suspend', title: 'Suspend player', fields: [reason], confirm: 'Suspend', danger: true, path: 'suspend', done: 'Player suspended.', description: 'Blocks sign-in, ends every session and hides the player and their levels. Reversible.' },
    unsuspend: { key: 'unsuspend', title: 'Unsuspend player', fields: [reason], confirm: 'Unsuspend', path: 'unsuspend', done: 'Player unsuspended.' },
    softDelete: { key: 'softDelete', title: 'Delete (restorable)', fields: [reason], confirm: 'Delete account', danger: true, path: 'soft-delete', done: 'Account deleted. It can be restored.', description: 'Same effect as the player deleting their own account: sign-in blocked, everything hidden, data kept. You can restore it at any time.' },
    restore: { key: 'restore', title: 'Restore account', fields: [reason], confirm: 'Restore', path: 'restore', done: 'Account restored.', description: u.deleted_was_suspended ? 'This account was suspended before it was deleted, so it will come back suspended.' : undefined },
    hard: { key: 'hard', title: 'Delete permanently', danger: true, confirm: 'Delete forever', path: 'hard-delete', done: 'Player permanently deleted.',
      description: <>Removes <b>{u.username}</b>, their private data and their {s.published} published level{s.published === 1 ? '' : 's'} (with likes and bookmarks on them). Players who solved those levels keep their solved count and badges. <b>This cannot be undone.</b></>,
      fields: [reason, { name: 'confirmUsername', label: `Type the username “${u.username}” to confirm` }, { name: 'password', label: 'Your admin password', type: 'password' }] },
    entitlement: { key: 'entitlement', title: 'Set Worlds access', fields: [{ name: 'status', label: 'Status', type: 'select', options: ENTITLEMENTS, initial: u.entitlements[0]?.status ?? 'active' }, { ...reason, name: 'note', label: 'Note', hint: 'Why this changed (e.g. “Play receipt checked”, “goodwill after outage”).' }], confirm: 'Save', path: 'entitlement', done: 'Worlds access updated.', description: 'Recorded as a manual entitlement. Real Google Play / Stripe purchases will write the same record when they are connected.' },
    email_: { key: 'email_', title: 'Send email', fields: [{ name: 'subject', label: 'Subject', max: 150 }, { name: 'body', label: 'Message', type: 'textarea', max: 5000 }], confirm: 'Send email', path: 'send-email', done: 'Email queued.', description: <>Sent from the Midori address to <b>{u.email}</b>. The text is erased from the database once the mail server accepts it.</> },
    message: { key: 'message', title: 'Send in-game message', fields: [{ name: 'subject', label: 'Title', max: 150 }, { name: 'body', label: 'Message', type: 'textarea', max: 5000 }], confirm: 'Send message', path: 'send-message', done: 'Message stored.', description: 'Stored for the player. The app will show it once the inbox screen ships; until then it waits unread.' },
  };
  const run = async (values: Record<string, string>, operationId: string) => {
    const a = active!; await api('POST', `/api/users/${id}/${a.path}`, { operationId, ...values });
    if (a.key === 'hard') { toast(a.done); location.hash = '#/users'; return; }
    setActive(null); toast(a.done); await load();
  };
  const Btn = ({ k, variant }: { k: string; variant?: 'danger' | 'primary' }) => <Button variant={variant} onClick={() => setActive(actions[k]!)}>{actions[k]!.title}</Button>;
  const facts: [string, ReactNode][] = [
    ['Email', <span className="font-mono text-xs">{u.email}</span>], ['Sign-in', u.google ? 'Google or password' : 'Password'], ['Joined', when(u.created_at)], ['Last active', s.lastActive ?? '—'],
    ['Level', `${s.level} · ${s.xp.toLocaleString()} XP`], ['Campaign solved', s.campaign], ['Community solved', s.community], ['Levels published', s.published],
    ['Active sessions', s.sessions], ['Unread messages', s.unreadMessages],
  ];
  return (
    <div className="flex flex-col gap-5">
      <a className="text-sm text-accent hover:underline" href="#/users">← Players</a>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{u.username}</h1>{statusBadge(u.status)}
        {deleted && <Badge kind="danger">deleted by {u.deleted_by} · {when(u.deleted_at)}</Badge>}
        <button className="font-mono text-xs text-muted hover:text-ink" onClick={() => navigator.clipboard?.writeText(u.id).then(() => toast('Player ID copied.'))} title="Copy player ID">{u.id}</button>
      </header>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel title="Profile"><dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">{facts.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}</dl></Panel>
          <Panel title="Activity log"><AuditTable rows={u.history.map((h: any) => ({ ...h, subject_user_id: null }))} /></Panel>
          {u.feedback.length > 0 && <Panel title="Feedback and bug reports"><ul className="flex flex-col gap-1 text-sm">{u.feedback.map((f: any) => <li key={f.id}><Badge>{f.kind}</Badge> <span className="text-muted">{when(f.created_at)} · v{f.app_version || '?'} · {f.status}</span></li>)}</ul></Panel>}
        </div>
        <div className="flex flex-col gap-5">
          <Panel title="Account"><div className="flex flex-wrap gap-2">
            {!deleted && <Btn k="rename" />}{!deleted && <Btn k="email" />}{!deleted && !suspended && <Btn k="recovery" />}{!deleted && <Btn k="signout" />}
            {deleted && <p className="text-sm text-muted">Deleted accounts cannot be edited. Restore it first.</p>}
          </div></Panel>
          <Panel title="Payments">
            <p className="mb-3 text-sm">Worlds: <Badge kind={u.entitlements[0]?.status === 'active' ? 'ok' : 'neutral'}>{u.entitlements[0]?.status ?? 'none'}</Badge>{u.entitlements[0] && <span className="text-muted"> · {u.entitlements[0].source} · {when(u.entitlements[0].updated_at)}</span>}</p>
            {u.entitlements[0]?.note && <p className="mb-3 text-sm text-muted">“{u.entitlements[0].note}”</p>}
            {!deleted && <Btn k="entitlement" />}
          </Panel>
          <Panel title="Contact"><div className="flex flex-wrap gap-2">{!deleted && <Btn k="email_" />}{!deleted && <Btn k="message" />}</div></Panel>
          <Panel title="Status"><div className="flex flex-wrap gap-2">
            {u.status === 'active' && <Btn k="suspend" />}{suspended && <Btn k="unsuspend" />}{!deleted && <Btn k="softDelete" />}{deleted && <Btn k="restore" variant="primary" />}
          </div></Panel>
          <Panel title="Danger zone" tint="danger"><p className="mb-3 text-sm">Permanent. Use “Delete (restorable)” unless the player has asked for erasure.</p><Btn k="hard" variant="danger" /></Panel>
        </div>
      </div>
      {active && <ActionDialog open title={active.title} description={active.description} fields={active.fields} confirm={active.confirm} danger={active.danger} onClose={() => setActive(null)} onSubmit={run} />}
      {toastNode}
    </div>
  );
}
