import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from './api';
import { BackIcon, ChevronIcon } from './art';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** Status words always travel with their dot: colour is never the only signal. */
export const STATUS_LABEL = { active: 'Active', suspended: 'Suspended', deleted: 'Deleted' } as const;
export function StatusChip({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <span className={cx('chip', status === 'active' ? 'chip-ok' : status === 'suspended' ? 'chip-warn' : 'chip-bad')}>{STATUS_LABEL[status]}</span>;
}
export const Chip = ({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) => <span className={cx('chip', tone ? `chip-${tone}` : 'chip-plain')}>{children}</span>;

type Variant = 'menu' | 'primary' | 'danger';
export function Button({ variant = 'menu', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={cx('key pebble', variant === 'primary' && 'key-primary', variant === 'danger' && 'key-danger', className)} />;
}

export function BackButton({ href, label }: { href: string; label: string }) {
  return <a href={href} aria-label={label} className="key round"><BackIcon /></a>;
}

/** Page anatomy from the app: round Back, then the title over a quiet subtitle, then content. */
export function PageHeader({ title, subtitle, back, aside, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: { href: string; label: string }; aside?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex items-start gap-3.5">
      {back && <BackButton {...back} />}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="headline break-words">{title}</h1>
        {subtitle && <div className="support mt-1.5">{subtitle}</div>}
      </div>
      {aside}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {items.map(t => <button key={t.id} role="tab" type="button" aria-selected={value === t.id} className="key tab" onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}

export const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3">{title && <h2 className="section-title">{title}</h2>}{children}</section>
);

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="card px-3.5 py-3"><p className="eyebrow">{label}</p><p className="mt-1.5 text-xl leading-none">{value}</p></div>;
}

/** A whole-row pebble: label and a line of support on the left, a chevron on the right. */
export function ActionRow({ title, support, onClick, tone, disabled }: { title: string; support?: ReactNode; onClick: () => void; tone?: 'danger' | 'primary'; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cx('key flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', tone === 'primary' && 'key-primary')}>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-semibold tracking-wide', tone === 'danger' && 'text-danger')}>{title}</span>
        {support && <span className={cx('mt-0.5 block text-xs', tone === 'primary' ? 'opacity-80' : 'text-muted')}>{support}</span>}
      </span>
      <ChevronIcon size={18} />
    </button>
  );
}

export function Loading({ label }: { label: string }) { return <p role="status" className="support py-16 text-center">{label}…</p>; }
export function Empty({ children }: { children: ReactNode }) { return <p className="card p-8 text-center text-sm text-muted">{children}</p>; }
export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="rounded-2xl border border-danger/70 p-4 text-sm">
      <p className="font-semibold text-danger">{e?.message ?? 'Something went wrong.'}</p>
      {e?.correlationId && <p className="support mt-1">ref {e.correlationId}</p>}
      {retry && <Button className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  );
}

/** Transient confirmation pebble; aria-live so screen readers hear it. */
export function useToast() {
  const [text, setText] = useState('');
  useEffect(() => { if (!text) return; const t = setTimeout(() => setText(''), 5000); return () => clearTimeout(t); }, [text]);
  const node = <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">{text && <p className="sheet pointer-events-auto rounded-[14px] px-5 py-3.5 text-sm font-semibold">{text}</p>}</div>;
  return [setText, node] as const;
}

export interface Field { name: string; label: string; type?: 'text' | 'textarea' | 'password' | 'select' | 'email'; options?: string[]; hint?: string; initial?: string; min?: number; max?: number }
/**
 * The overlay sheet from the app: scrim, a deep-pool sheet (28 radius), title, a support line, pebble buttons. A native <dialog>, so focus is
 * trapped and Esc closes it. The operation ID is minted when it opens: a retry after a network error resends it and the server applies the action once.
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
      className="sheet m-auto w-[min(26.25rem,calc(100vw-2rem))] rounded-[28px] p-0 max-h-[calc(100dvh-2rem)]">
      <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <div className="text-center">
          <h2 id="dlg-title" className="headline">{title}</h2>
          {description && <div className="support mt-2.5 leading-relaxed">{description}</div>}
        </div>
        {fields.map(f => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="section-title">{f.label}</span>
            {f.type === 'textarea' ? <textarea required minLength={f.min} maxLength={f.max} className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />
              : f.type === 'select' ? <select className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)}>{f.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input required minLength={f.min} maxLength={f.max} type={f.type ?? 'text'} autoComplete="off" className="field" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />}
            {f.hint && <span className="support">{f.hint}</span>}
          </label>
        ))}
        {error != null && <ErrorNote error={error} />}
        <div className="flex flex-col gap-2">
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy} aria-busy={busy}>{busy ? 'Working…' : confirm}</Button>
          <Button type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </dialog>
  );
}
