import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes
} from 'react';
import { Icon, type IconName } from './icons.tsx';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Button ----------
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
  busy?: boolean;
  icon?: IconName;
}
export function Button({ variant = 'primary', size = 'md', block, busy, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || busy} aria-busy={busy || undefined}
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', className)}>
      {busy ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

// ---------- Field / Input / Select ----------
interface FieldProps { label: string; hint?: string; error?: string | undefined }
export function Input({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <input id={id} className={cx('input', className)} aria-invalid={!!error || undefined}
        aria-describedby={cx(hint && `${id}-h`, error && `${id}-e`) || undefined} {...rest} />
      {hint && <span id={`${id}-h`} className="field__hint">{hint}</span>}
      {error && <span id={`${id}-e`} className="field__error" role="alert">{error}</span>}
    </div>
  );
}

export function Select({ label, hint, error, options, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <select id={id} className="select" aria-invalid={!!error || undefined} {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error" role="alert">{error}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ legend, name, value, options, onChange }: {
  legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field__label" style={{ marginBlockEnd: 4 }}>{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="switch">
      <label htmlFor={id} style={{ display: 'grid' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

// ---------- Tabs (WAI-ARIA tabs pattern, arrow keys follow reading direction) ----------
export function Tabs({ label, tabs }: { label: string; tabs: { id: string; title: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const step = e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : e.key === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
    if (!step) return;
    const next = (i + step + tabs.length) % tabs.length;
    setActive(tabs[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tabs__list">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`${base}-t-${t.id}`}
            aria-selected={active === t.id} aria-controls={`${base}-p-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            className="tabs__tab" onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.title}</button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-p-${t.id}`} aria-labelledby={`${base}-t-${t.id}`} hidden={active !== t.id} className="tabs__panel" tabIndex={0}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

// ---------- Badge / LeagueBadge / Progress / Timer / Avatar ----------
export function Badge({ tone, children, icon }: { tone?: 'test' | 'premium' | 'success' | 'danger'; children: ReactNode; icon?: IconName }) {
  return <span className={cx('badge', tone && `badge--${tone}`)}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

const LEAGUES = {
  bronze: { fa: 'برنز', color: '#c7845a' }, silver: { fa: 'نقره', color: '#b9c4d6' }, gold: { fa: 'طلا', color: '#d6ad60' },
  platinum: { fa: 'پلاتین', color: '#7fd1c7' }, diamond: { fa: 'الماس', color: '#8fb8ff' }, master: { fa: 'استاد', color: '#c49bff' }
} as const;
export type League = keyof typeof LEAGUES;
export function LeagueBadge({ league }: { league: League }) {
  const l = LEAGUES[league];
  return (
    <span className="league">
      <svg className="league__gem" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 2 29 11 24 29H8L3 11Z" fill={l.color} opacity="0.25" stroke={l.color} strokeWidth="2" />
        <path d="M16 8 23 13 20 24h-8L9 13Z" fill={l.color} />
      </svg>
      <span>لیگ {l.fa}</span>
    </span>
  );
}

export function Progress({ label, value, max, valueText }: { label: string; value: number; max: number; valueText?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress">
      <div className="progress__meta"><span>{label}</span><span className="num">{valueText ?? `${pct.toLocaleString('fa-IR')}٪`}</span></div>
      <div className="progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}>
        <div className="progress__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Counts down to a server-provided deadline. Display only — the server decides timeouts. */
export function Timer({ deadline, label = 'زمان باقی‌مانده', lowSeconds = 10 }: { deadline: Date; label?: string; lowSeconds?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((deadline.getTime() - now) / 1000));
  const text = `${Math.floor(left / 60).toLocaleString('fa-IR')}:${(left % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
  return (
    <span className={cx('timer', left <= lowSeconds && 'timer--low')} role="timer" aria-label={`${label}: ${left.toLocaleString('fa-IR')} ثانیه`}>
      <Icon name="clock" size={18} /><span className="num" aria-hidden>{text}</span>
    </span>
  );
}

const AVATAR_ICON: Record<string, IconName> = { meeple: 'meeple', dice: 'dice', crown: 'crown', pawn: 'pawn', card: 'card', star: 'star' };
export function Avatar({ avatarKey, name, size = 40 }: { avatarKey: string; name: string; size?: number }) {
  return (
    <span className="avatar" style={{ inlineSize: size, blockSize: size }} role="img" aria-label={`نماد ${name}`}>
      <Icon name={AVATAR_ICON[avatarKey] ?? 'meeple'} />
    </span>
  );
}

// ---------- Dialog / Drawer (native <dialog>) ----------
export function Dialog({ open, onClose, title, children, footer, drawer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={cx('dialog', drawer && 'drawer')} aria-labelledby={titleId} onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog__head">
        <h2 id={titleId} style={{ fontSize: 'var(--fs-lg)' }}>{title}</h2>
        <Button variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="بستن" />
      </div>
      <div className="dialog__body">{children}</div>
      {footer && <div className="dialog__foot">{footer}</div>}
    </dialog>
  );
}
export const Drawer = (p: Omit<Parameters<typeof Dialog>[0], 'drawer'>) => <Dialog {...p} drawer />;

// ---------- Toast ----------
type Toast = { id: number; tone: 'info' | 'success' | 'error'; text: string };
const ToastCtx = createContext<(tone: Toast['tone'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++seq.current;
    setItems((x) => [...x.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span>{t.text}</span>
            <Button variant="ghost" size="sm" icon="close" aria-label="بستن پیام" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Table ----------
export function DataTable<T>({ caption, columns, rows, rowKey }: {
  caption: string; columns: { key: string; title: string; render: (row: T) => ReactNode }[]; rows: T[]; rowKey: (row: T) => string;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------- Honest screen states ----------
export type StateKind = 'loading' | 'empty' | 'error' | 'offline' | 'denied';
const STATE_ICON: Record<Exclude<StateKind, 'loading'>, IconName> = { empty: 'box', error: 'alert', offline: 'offline', denied: 'lock' };
export function StateBlock({ kind, title, children, action }: { kind: StateKind; title: string; children?: ReactNode; action?: ReactNode }) {
  if (kind === 'loading') {
    return <div className="state" role="status" aria-live="polite"><span className="spinner" style={{ fontSize: 32 }} aria-hidden /><span>{title}</span></div>;
  }
  return (
    <div className={cx('state', `state--${kind}`)} role={kind === 'error' ? 'alert' : undefined}>
      <Icon name={STATE_ICON[kind]} className="state__icon" size={56} />
      <div className="state__title">{title}</div>
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return useMemo(() => online, [online]);
}
