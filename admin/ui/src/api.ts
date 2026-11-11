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
  }).catch(() => { throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and retry.'); });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.code ?? 'ERROR', data.message ?? 'Request failed.', data.correlationId);
  return data as T;
}
export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export interface UserRow { id: string; email: string; username: string; status: 'active' | 'suspended' | 'deleted'; deleted_by: string | null; created_at: string; google: boolean; worlds: string }
export interface AuditRow { id: number; action: string; subject_user_id: string | null; reason: string | null; detail: Record<string, unknown>; created_at: string; admin: string | null }
