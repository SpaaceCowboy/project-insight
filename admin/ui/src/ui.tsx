import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from './api';

const tone = {
  neutral: 'bg-raise text-ink', ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', danger: 'bg-danger-bg text-danger',
} as const;
export function Badge({ kind = 'neutral', children }: { kind?: keyof typeof tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[kind]}`}>{children}</span>;
}
export const statusBadge = (status: string) => <Badge kind={status === 'active' ? 'ok' : status === 'suspended' ? 'warn' : 'danger'}>{status}</Badge>;

type Variant = 'primary' | 'quiet' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  quiet: 'border border-line bg-panel text-ink hover:bg-raise',
  danger: 'bg-danger text-bg hover:brightness-110',
};
// min-h-11 keeps a real touch target.
export function Button({ variant = 'quiet', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} />;
}
export function Panel({ title, children, tint }: { title?: string; children: ReactNode; tint?: 'danger' }) {
  return (
    <section className={`rounded-xl border p-5 ${tint === 'danger' ? 'border-danger/60 bg-danger-bg/30' : 'border-line bg-panel'}`}>
      {title && <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${tint === 'danger' ? 'text-danger' : 'text-muted'}`}>{title}</h2>}
      {children}
    </section>
  );
}
export const inputClass = 'min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted';

export function Loading({ label }: { label: string }) { return <p role="status" className="py-10 text-center text-muted">{label}…</p>; }
export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="rounded-lg border border-danger/60 bg-danger-bg p-4 text-sm text-danger">
      <p className="font-semibold">{e?.message ?? 'Something went wrong.'}</p>
      {e?.correlationId && <p className="mt-1 font-mono text-xs opacity-80">ref {e.correlationId}</p>}
      {retry && <Button className="mt-3" onClick={retry}>Retry</Button>}
    </div>
  );
}

/** Transient confirmation. aria-live so screen readers hear it. */
export function useToast() {
  const [text, setText] = useState('');
  useEffect(() => { if (!text) return; const t = setTimeout(() => setText(''), 5000); return () => clearTimeout(t); }, [text]);
  const node = <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">{text && <p className="pointer-events-auto rounded-lg bg-ink px-4 py-3 text-sm font-medium text-bg shadow-lg">{text}</p>}</div>;
  return [setText, node] as const;
}

export interface Field { name: string; label: string; type?: 'text' | 'textarea' | 'password' | 'select' | 'email'; options?: string[]; hint?: string; initial?: string; min?: number; max?: number }
/**
 * A native <dialog>: focus is trapped and Esc closes it for free. The operation ID is minted each time it opens, so a retry after a
 * network error resends the same ID and the server applies the action once.
 */
export function ActionDialog({ open, title, description, fields, confirm, danger, onClose, onSubmit }: {
  open: boolean; title: string; description?: ReactNode; fields: Field[]; confirm: string; danger?: boolean;
  onClose: () => void; onSubmit: (values: Record<string, string>, operationId: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const op = useRef('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { op.current = crypto.randomUUID(); setError(null); setBusy(false); setValues(Object.fromEntries(fields.map(f => [f.name, f.initial ?? (f.type === 'select' ? f.options?.[0] ?? '' : '')]))); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(values, op.current); } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title" className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-ink">
      <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <h2 id="dlg-title" className={`text-lg font-semibold ${danger ? 'text-danger' : ''}`}>{title}</h2>
        {description && <div className="text-sm text-muted">{description}</div>}
        {fields.map(f => (
          <label key={f.name} className="flex flex-col gap-1.5 text-sm font-medium">
            {f.label}
            {f.type === 'textarea' ? <textarea required minLength={f.min} maxLength={f.max} rows={4} className={`${inputClass} py-2`} value={values[f.name] ?? ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })} />
              : f.type === 'select' ? <select className={inputClass} value={values[f.name] ?? ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })}>{f.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input required minLength={f.min} maxLength={f.max} type={f.type ?? 'text'} autoComplete="off" className={inputClass} value={values[f.name] ?? ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })} />}
            {f.hint && <span className="text-xs font-normal text-muted">{f.hint}</span>}
          </label>
        ))}
        {error != null && <ErrorNote error={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy} aria-busy={busy}>{busy ? 'Working…' : confirm}</Button>
        </div>
      </form>
    </dialog>
  );
}
