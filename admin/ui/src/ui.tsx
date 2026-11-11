import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from './api';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** A status always travels as a word with a dot: colour is never the only signal. */
export const STATUS_LABEL = { active: 'Active', suspended: 'Suspended', deleted: 'Deleted' } as const;
const STATUS_DOT = { active: 'dot-ok', suspended: 'dot-warn', deleted: 'dot-bad' } as const;
export const StatusText = ({ status }: { status: keyof typeof STATUS_LABEL }) => <span className={cx('dot whitespace-nowrap', STATUS_DOT[status])}>{STATUS_LABEL[status]}</span>;

type Variant = 'plain' | 'primary' | 'danger';
export function Button({ variant = 'plain', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={cx('btn', variant === 'primary' && 'btn-primary', variant === 'danger' && 'btn-danger', className)} />;
}

export function PageHeader({ title, subtitle, back }: { title: ReactNode; subtitle?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header>
      {back && <a href={back.href} className="link small muted">{back.label}</a>}
      <h1 className="h1 break-words">{title}</h1>
      {subtitle && <div className="small muted mt-1">{subtitle}</div>}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {items.map(t => <button key={t.id} role="tab" type="button" aria-selected={value === t.id} className="tab" onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}

export const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2">{title && <h2 className="h2">{title}</h2>}{children}</section>
);

/** One action: what it is, then what it does. Disabled ones say why. */
export function ActionRow({ title, support, onClick, tone, disabled }: { title: string; support?: ReactNode; onClick: () => void; tone?: 'danger' | 'primary'; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cx('act', tone === 'primary' && 'act-primary', tone === 'danger' && 'act-danger')}>
      <b>{title}</b>{support && <span>{support}</span>}
    </button>
  );
}

export function Loading({ label }: { label: string }) { return <p role="status" className="muted small py-12 text-center">{label}…</p>; }
export function Empty({ children }: { children: ReactNode }) { return <p className="card muted p-6 text-center text-sm">{children}</p>; }
export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="rounded-xl border border-danger/70 p-4 text-sm">
      <p className="font-semibold text-danger">{e?.message ?? 'Something went wrong.'}</p>
      {e?.correlationId && <p className="small muted mt-1">ref {e.correlationId}</p>}
      {retry && <Button className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  );
}

/** Transient confirmation; aria-live so screen readers hear it. */
export function useToast() {
  const [text, setText] = useState('');
  useEffect(() => { if (!text) return; const t = setTimeout(() => setText(''), 4000); return () => clearTimeout(t); }, [text]);
  const node = <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">{text && <p className="sheet pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-semibold">{text}</p>}</div>;
  return [setText, node] as const;
}

export interface Field { name: string; label: string; type?: 'text' | 'textarea' | 'password' | 'select' | 'email'; options?: string[]; hint?: string; initial?: string; min?: number; max?: number }
/**
 * A native <dialog>, so focus is trapped and Esc closes it. The operation ID is minted when it opens: a retry after a network error resends it
 * and the server applies the action once. The first field is focused on open; Cancel on the left, the action on the right.
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
  const set = (name: string, v: string) => setValues(s => ({ ...s, [name]: v }));
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} aria-labelledby="dlg-title"
      className="sheet m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 max-h-[calc(100dvh-2rem)]">
      <form onSubmit={submit} className="flex flex-col gap-3.5 p-5">
        <div>
          <h2 id="dlg-title" className="text-lg">{title}</h2>
          {description && <div className="small muted mt-2 leading-relaxed">{description}</div>}
        </div>
        {fields.map((f, i) => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="small font-semibold">{f.label}</span>
            {f.type === 'textarea' ? <textarea autoFocus={i === 0} required minLength={f.min} maxLength={f.max} className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />
              : f.type === 'select' ? <select autoFocus={i === 0} className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)}>{f.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input autoFocus={i === 0} required minLength={f.min} maxLength={f.max} type={f.type ?? 'text'} autoComplete="off" className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />}
            {f.hint && <span className="small muted">{f.hint}</span>}
          </label>
        ))}
        {error != null && <ErrorNote error={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy} aria-busy={busy}>{busy ? 'Working…' : confirm}</Button>
        </div>
      </form>
    </dialog>
  );
}
