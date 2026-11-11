import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ago, when } from '../api';
import { ActionDialog, ActionRow, Empty, ErrorNote, Loading, PageHeader, Section, StatusText, Tabs, type Field } from '../ui';
import { AuditList } from './Audit';

const password: Field = { name: 'password', label: 'Your admin password', type: 'password', hint: 'Asked again because this action can change who owns the account.' };
const reason: Field = { name: 'reason', label: 'Reason', type: 'textarea', min: 3, max: 500, hint: 'Saved in the audit log. The player never sees it.' };
const ENTITLEMENTS = ['active', 'none', 'revoked', 'refunded'];
type Tab = 'overview' | 'payments' | 'contact' | 'history';
const TABS: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'payments', label: 'Payments' }, { id: 'contact', label: 'Contact' }, { id: 'history', label: 'History' }];

interface Action { key: string; title: string; description?: ReactNode; fields: Field[]; confirm: string; danger?: boolean; path: string; done: string }

export function UserDetail({ id, mail, toast }: { id: string; mail: boolean; toast: (text: string) => void }) {
  const [u, setU] = useState<any>(null); const [error, setError] = useState<unknown>(null);
  const [active, setActive] = useState<Action | null>(null); const [tab, setTab] = useState<Tab>('overview');
  const load = useCallback(() => { setError(null); return api('GET', `/api/users/${id}`).then(setU, e => { setU(null); setError(e); }); }, [id]);
  useEffect(() => { setU(null); load(); }, [load]);
  if (error != null) return <div className="flex flex-col gap-5"><PageHeader title="Player" back={{ href: '#/users', label: 'Back to players' }} /><ErrorNote error={error} retry={load} /></div>;
  if (!u) return <Loading label="Loading player" />;

  const s = u.stats; const deleted = u.status === 'deleted'; const suspended = u.status === 'suspended'; const ent = u.entitlements[0];
  const noMail = 'Email is switched off on this server';
  const actions: Record<string, Action> = {
    rename: { key: 'rename', title: 'Change username', fields: [{ name: 'name', label: 'New username', initial: u.username, min: 3, max: 20 }, reason], confirm: 'Change username', path: 'rename', done: 'Username changed.', description: 'Same rules as the app: 3 to 20 English letters, numbers, spaces, _ and -. No banned words, and it must be unique.' },
    email: { key: 'email', title: 'Change email', fields: [{ name: 'email', label: 'New email', type: 'email', initial: u.email }, reason, password], confirm: 'Change email', path: 'email', done: 'Email changed.' },
    recovery: { key: 'recovery', title: 'Send a password reset code', fields: [password], confirm: 'Send code', path: 'send-recovery', done: 'Reset code sent.', description: <>An 8-digit code goes to <b>{u.email}</b>, valid for 15 minutes. The player enters it under “Forgot password” in the app. One code per minute.</> },
    signout: { key: 'signout', title: 'Sign out everywhere', fields: [reason], confirm: 'Sign out', path: 'revoke-sessions', done: 'Signed out of every device.', description: 'Ends every session. The player can sign back in.' },
    suspend: { key: 'suspend', title: 'Suspend this player', fields: [reason], confirm: 'Suspend', danger: true, path: 'suspend', done: 'Player suspended.', description: 'Blocks sign-in, ends every session and hides the player and their levels. You can lift it any time.' },
    unsuspend: { key: 'unsuspend', title: 'Lift the suspension', fields: [reason], confirm: 'Unsuspend', path: 'unsuspend', done: 'Suspension lifted.' },
    softDelete: { key: 'softDelete', title: 'Delete this account', fields: [reason], confirm: 'Delete account', danger: true, path: 'soft-delete', done: 'Account deleted. You can restore it.', description: 'Works like the player deleting their own account: sign-in is blocked and everything is hidden, but nothing is erased. You can restore it whenever they ask.' },
    restore: { key: 'restore', title: 'Restore this account', fields: [reason], confirm: 'Restore account', path: 'restore', done: 'Account restored.', description: u.deleted_was_suspended ? 'It was suspended before it was deleted, so it comes back suspended.' : 'Sign-in works again and the player and their levels reappear.' },
    hard: { key: 'hard', title: 'Delete permanently', danger: true, confirm: 'Delete forever', path: 'hard-delete', done: 'Player permanently deleted.',
      description: <>This erases <b>{u.username}</b>, their private data and their {s.published} published level{s.published === 1 ? '' : 's'}, with the likes and bookmarks on them. Players who solved those levels keep their solved counts and badges. <b>It cannot be undone.</b></>,
      fields: [reason, { name: 'confirmUsername', label: `Type “${u.username}” to confirm` }, { name: 'password', label: 'Your admin password', type: 'password' }] },
    entitlement: { key: 'entitlement', title: 'Set Worlds access', fields: [{ name: 'status', label: 'Status', type: 'select', options: ENTITLEMENTS, initial: ent?.status ?? 'active' }, { ...reason, name: 'note', label: 'Note', hint: 'Why it changed, e.g. “Play receipt checked” or “goodwill after the outage”.' }], confirm: 'Save', path: 'entitlement', done: 'Worlds access updated.', description: 'Recorded as a manual entitlement. Google Play and Stripe purchases will write the same record once they are connected.' },
    sendEmail: { key: 'sendEmail', title: 'Send an email', fields: [{ name: 'subject', label: 'Subject', max: 150 }, { name: 'body', label: 'Message', type: 'textarea', max: 5000 }], confirm: 'Send email', path: 'send-email', done: 'Email on its way.', description: <>Goes to <b>{u.email}</b> from the Midori address. The text is erased from the database once the mail server accepts it.</> },
    message: { key: 'message', title: 'Send an in-game message', fields: [{ name: 'subject', label: 'Title', max: 150 }, { name: 'body', label: 'Message', type: 'textarea', max: 5000 }], confirm: 'Send message', path: 'send-message', done: 'Message saved for the player.', description: 'The app shows it once its inbox ships. Until then it waits, unread.' },
  };
  const run = async (values: Record<string, string>, operationId: string) => {
    const a = active!; await api('POST', `/api/users/${id}/${a.path}`, { operationId, ...values });
    if (a.key === 'hard') { toast(a.done); location.hash = '#/users'; return; }
    setActive(null); toast(a.done); await load();
  };
  const open = (k: string) => () => setActive(actions[k]!);
  const copyId = () => navigator.clipboard?.writeText(u.id).then(() => toast('Player ID copied.'), () => toast('Could not copy. Select the ID by hand.'));
  const facts = (rows: [string, ReactNode][]) => <dl className="facts card">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: '#/users', label: 'Back to players' }} title={u.username}
        subtitle={<>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusText status={u.status} />{deleted && <span>by {u.deleted_by}, {ago(u.deleted_at)}</span>}
            <span className="break-all">{u.email}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3"><span className="break-all">{u.id}</span><button type="button" className="link" onClick={copyId}>Copy ID</button></span>
        </>} />

      <Tabs label="Player sections" value={tab} onChange={setTab} items={TABS} />

      {tab === 'overview' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-6">
            <Section title="Progress">{facts([['Level', s.level], ['XP', s.xp.toLocaleString()], ['Campaign solved', s.campaign], ['Community solved', s.community], ['Levels published', s.published]])}</Section>
            <Section title="Account">{facts([['Joined', when(u.created_at)], ['Last active', s.lastActive ? new Date(`${s.lastActive}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'], ['Signs in with', u.google ? 'Google or password' : 'Password'], ['Active sessions', s.sessions], ['Unread messages', s.unreadMessages], ['Worlds access', ent?.status ?? 'none']])}</Section>
          </div>
          <div className="flex flex-col gap-5">
            {deleted ? (
              <Section title="Account"><ActionRow tone="primary" title="Restore this account" support="Brings the player and their levels back" onClick={open('restore')} /></Section>
            ) : <>
              <Section title="Account">
                <ActionRow title="Change username" support={u.username} onClick={open('rename')} />
                <ActionRow title="Change email" support={u.email} onClick={open('email')} />
                <ActionRow title="Send a password reset code" support={!mail ? noMail : suspended ? 'Not for suspended accounts' : '8 digits, valid for 15 minutes'} disabled={!mail || suspended} onClick={open('recovery')} />
                <ActionRow title="Sign out everywhere" support={`${s.sessions} active ${s.sessions === 1 ? 'session' : 'sessions'}`} onClick={open('signout')} />
              </Section>
              <Section title="Status">
                {suspended ? <ActionRow title="Lift the suspension" support="Lets the player sign in again" onClick={open('unsuspend')} />
                  : <ActionRow title="Suspend this player" support="Blocks sign-in and hides them" onClick={open('suspend')} />}
                <ActionRow title="Delete this account" support="Restorable. Nothing is erased" onClick={open('softDelete')} />
              </Section>
            </>}
            <Section title="Danger zone">
              <ActionRow tone="danger" title="Delete permanently" support="Erases the player and their levels. Cannot be undone" onClick={open('hard')} />
            </Section>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Section title="Worlds">
            {facts([['Status', ent?.status ?? 'none'], ['Source', ent?.source ?? '—'], ['Updated', ent ? when(ent.updated_at) : '—'], ['Note', ent?.note || '—']])}
            <p className="small muted">Google Play and Stripe purchases will appear here once they are connected. Until then every change is made by hand and recorded in the audit log.</p>
          </Section>
          {!deleted && <Section title="Actions"><ActionRow tone="primary" title="Set Worlds access" support="Grant, revoke or refund by hand" onClick={open('entitlement')} /></Section>}
        </div>
      )}

      {tab === 'contact' && (deleted ? <Empty>Deleted accounts can’t be contacted. Restore it first.</Empty> : (
        <div className="grid gap-2 md:max-w-md">
          <ActionRow title="Send an email" support={mail ? u.email : noMail} disabled={!mail} onClick={open('sendEmail')} />
          <ActionRow title="Send an in-game message" support={s.unreadMessages ? `${s.unreadMessages} unread` : 'Shown in the app once its inbox ships'} onClick={open('message')} />
        </div>
      ))}

      {tab === 'history' && <>
        <Section title="Activity"><AuditList rows={u.history} showPlayer={false} /></Section>
        {u.feedback.length > 0 && <Section title="Feedback and bug reports">
          <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>When</th><th>Type</th><th>App version</th></tr></thead>
            <tbody>{u.feedback.map((f: any) => <tr key={f.id}><td className="muted whitespace-nowrap">{when(f.created_at)}</td><td className="font-semibold">{f.kind === 'bug' ? 'Bug report' : 'Feedback'}</td><td className="muted">{f.app_version || '?'}</td></tr>)}</tbody></table></div>
        </Section>}
      </>}

      {active && <ActionDialog open title={active.title} description={active.description} fields={active.fields} confirm={active.confirm} danger={active.danger} onClose={() => setActive(null)} onSubmit={run} />}
    </div>
  );
}
