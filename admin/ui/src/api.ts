/** Thin fetch wrapper: same-origin cookie session, CSRF header on every non-GET, errors carry the server's message + correlation ID. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly correlationId?: string) { super(message); }
}
let csrf = '';
export const setCsrf = (value: string) => { csrf = value; };
export async function api<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-admin-csrf': csrf } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => { throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.'); });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.code ?? 'ERROR', data.message ?? 'Request failed.', data.correlationId);
  return data as T;
}

export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536e6], ['month', 2592e6], ['day', 864e5], ['hour', 36e5], ['minute', 6e4]];
/** "3 days ago"; falls back to "just now" under a minute. The full timestamp belongs in a title attribute. */
export function ago(iso?: string | null): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now(); const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  return 'just now';
}
export interface UserRow { id: string; email: string; username: string; status: 'active' | 'suspended' | 'deleted'; deleted_by: string | null; created_at: string; google: boolean; worlds: string }
export interface AuditRow { id: number; action: string; subject_user_id: string | null; reason: string | null; detail: Record<string, unknown>; created_at: string; admin: string | null }

/** Plain-language names for audit actions. */
const ACTIONS: Record<string, string> = {
  'user.suspend': 'Suspended', 'user.unsuspend': 'Unsuspended', 'user.soft_delete': 'Deleted (restorable)', 'user.restore': 'Restored', 'user.hard_delete': 'Deleted permanently',
  'user.rename': 'Username changed', 'user.change_email': 'Email changed', 'user.revoke_sessions': 'Signed out everywhere', 'user.send_recovery': 'Reset code sent',
  'user.send_email': 'Email sent', 'user.send_message': 'In-game message sent', 'entitlement.set': 'Worlds access changed',
  'admin.login': 'Admin signed in', 'admin.login_failed': 'Failed admin sign-in', 'admin.create': 'Admin created', 'admin.password_reset': 'Admin password reset',
};
export const actionLabel = (a: string) => ACTIONS[a] ?? a;
