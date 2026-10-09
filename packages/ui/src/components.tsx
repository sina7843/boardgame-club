// Shared components on the VibeFarsi «انار» language (claymorphism: pill controls with puffy depth that sink on press,
// recessed 16px fields, 28px surfaces, spring motion). Public names and props are unchanged so pages and game renderers
// keep working; the look comes from theme tokens only (no hard-coded colours).
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes
} from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { Icon, type IconName } from './icons.tsx';
import { cn, fa, faPercent } from './vf/lib/utils.ts';
import { SegmentedControl } from './vf/ui/segmented-control.tsx';
import { ToastCard } from './vf/ui/toast.tsx';

export { cn, fa, faNumber, faPercent, formatToman, en } from './vf/lib/utils.ts';

// ---------- Button ----------
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';
  size?: 'md' | 'sm' | 'lg';
  block?: boolean;
  busy?: boolean;
  icon?: IconName;
}
const BTN_VARIANT = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-control active:shadow-press',
  brand: 'bg-brand text-brand-foreground hover:bg-brand/90 shadow-control active:shadow-press',
  secondary: 'bg-card text-foreground hover:bg-accent border-line border-border shadow-control active:shadow-press',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  danger: 'border-line border-destructive/50 text-destructive bg-transparent hover:bg-destructive/10 active:shadow-press'
} as const;
const BTN_SIZE = { sm: 'h-9 px-4 text-sm gap-1.5 [&_svg]:size-4', md: 'h-11 px-5 text-sm gap-2 [&_svg]:size-4.5', lg: 'h-13 px-7 text-base gap-2.5 [&_svg]:size-5' } as const;
export const buttonClass = (variant: NonNullable<ButtonProps['variant']> = 'primary', size: NonNullable<ButtonProps['size']> = 'md', block?: boolean) => cn(
  'btn inline-flex items-center justify-center whitespace-nowrap rounded-control font-semibold no-underline select-none cursor-pointer',
  'transition-[background-color,box-shadow,transform,color] duration-(--motion) ease-motion active:[transform:var(--press)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  BTN_VARIANT[variant], BTN_SIZE[size], block && 'w-full'
);
export function Button({ variant = 'primary', size = 'md', block, busy, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} disabled={disabled || busy} aria-busy={busy || undefined} className={cn(buttonClass(variant, size, block), className)}>
      {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

// ---------- Field / Input / Select ----------
const FIELD = cn(
  'w-full rounded-field border-line-field border-input bg-field shadow-field text-foreground placeholder:text-muted-foreground/70',
  'transition-[box-shadow,border-color] duration-(--motion) ease-motion',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-transparent',
  'aria-invalid:border-destructive/60 disabled:cursor-not-allowed disabled:opacity-50'
);
interface FieldProps { label: string; hint?: string; error?: string | undefined }
function FieldShell({ id, label, hint, error, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="field flex flex-col gap-1.5">
      <label className="field__label text-sm font-medium text-foreground/90" htmlFor={id}>{label}</label>
      {children}
      {hint && <span id={`${id}-h`} className="field__hint text-xs text-muted-foreground">{hint}</span>}
      {error && <span id={`${id}-e`} className="field__error text-xs text-destructive animate-fade-up" role="alert">{error}</span>}
    </div>
  );
}
export function Input({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input id={id} className={cn('input h-12 px-4 text-sm', FIELD, className)} aria-invalid={!!error || undefined}
        aria-describedby={cn(hint && `${id}-h`, error && `${id}-e`) || undefined} {...rest} />
    </FieldShell>
  );
}
export function Select({ label, hint, error, options, className, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select id={id} className={cn('select h-12 cursor-pointer appearance-none ps-4 pe-10 text-sm', FIELD, className)} aria-invalid={!!error || undefined} {...rest}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </FieldShell>
  );
}

/** Radio group as VibeFarsi's segmented control (sliding pill), inside a labelled fieldset. */
export function Segmented<T extends string>({ legend, name, value, options, onChange }: {
  legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0" data-name={name}>
      <legend className="mb-1.5 text-sm font-medium text-foreground/90">{legend}</legend>
      <SegmentedControl aria-label={legend} value={value} onChange={(v) => onChange(v as T)} options={options} className="max-w-full flex-wrap" />
    </fieldset>
  );
}

/** Multi-select as toggle chips (native checkboxes). Selected state shows a check mark, not colour alone. */
export function CheckChips<T extends string>({ legend, hint, values, options, onChange }: {
  legend: string; hint?: string; values: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void;
}) {
  const hintId = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-foreground/90">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <label key={o.value} className={cn('chip relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-4 text-sm transition-all duration-(--motion) ease-motion',
              'has-focus-visible:ring-2 has-focus-visible:ring-ring/60 active:[transform:var(--press)]',
              on ? 'chip--on bg-primary text-primary-foreground font-semibold shadow-control' : 'border-line border-border bg-card text-muted-foreground hover:text-foreground')}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])} />
              <span aria-hidden="true" className="w-4 text-center font-bold">{on ? '✓' : '+'}</span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {hint && <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>}
    </fieldset>
  );
}

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="switch flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="grid cursor-pointer">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-control border border-transparent shadow-field transition-colors duration-(--motion) ease-motion',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          checked ? 'bg-primary' : 'bg-input')}>
        <span className={cn('pointer-events-none block size-5 rounded-control shadow-control transition-transform duration-(--motion) ease-motion',
          checked ? 'bg-primary-foreground -translate-x-6' : 'bg-card -translate-x-1')} />
      </button>
    </div>
  );
}

// ---------- Tabs (WAI-ARIA pattern, arrow keys follow reading direction) ----------
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
      <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[calc(var(--shape-control)+2px)] bg-muted p-1">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`${base}-t-${t.id}`}
            aria-selected={active === t.id} aria-controls={`${base}-p-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            className={cn('h-10 shrink-0 cursor-pointer rounded-control px-4 text-sm whitespace-nowrap transition-all duration-(--motion) ease-motion',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              active === t.id ? 'bg-card font-bold text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.title}</button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-p-${t.id}`} aria-labelledby={`${base}-t-${t.id}`} hidden={active !== t.id} className="pt-4 animate-fade-up" tabIndex={0}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

// ---------- Badge / LeagueBadge / Progress / Timer / Avatar ----------
const BADGE = {
  none: 'bg-secondary text-secondary-foreground',
  test: 'bg-warning/12 text-warning ring-1 ring-warning/40',
  premium: 'bg-brand/15 text-brand ring-1 ring-brand/40',
  success: 'bg-success/12 text-success ring-1 ring-success/40',
  danger: 'bg-destructive/10 text-destructive ring-1 ring-destructive/40'
} as const;
export function Badge({ tone, children, icon }: { tone?: 'test' | 'premium' | 'success' | 'danger'; children: ReactNode; icon?: IconName }) {
  return (
    <span className={cn('badge inline-flex items-center gap-1 whitespace-nowrap rounded-control px-2.5 py-0.5 text-xs font-semibold leading-6', BADGE[tone ?? 'none'])}>
      {icon && <Icon name={icon} size={14} />}{children}
    </span>
  );
}

const LEAGUES = {
  bronze: { fa: 'برنز', cls: 'text-[#b06a3b]' }, silver: { fa: 'نقره', cls: 'text-[#7f8ea3]' }, gold: { fa: 'طلا', cls: 'text-brand' },
  platinum: { fa: 'پلاتین', cls: 'text-[#3d9e93]' }, diamond: { fa: 'الماس', cls: 'text-[#4f7fd6]' }, master: { fa: 'استاد', cls: 'text-[#9061d6]' }
} as const;
export type League = keyof typeof LEAGUES;
export function LeagueBadge({ league }: { league: League }) {
  const l = LEAGUES[league];
  return (
    <span className="league inline-flex items-center gap-2 font-bold">
      <span className={cn('flex size-8 items-center justify-center rounded-control bg-card shadow-control', l.cls)} aria-hidden><Icon name="crown" size={18} strokeWidth={2} /></span>
      <span>لیگ {l.fa}</span>
    </span>
  );
}

export function Progress({ label, value, max, valueText }: { label: string; value: number; max: number; valueText?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><span className="tabular-nums">{valueText ?? faPercent(pct)}</span></div>
      <div className="h-3 w-full overflow-hidden rounded-control bg-input shadow-field" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}>
        <div className="h-full rounded-control bg-primary shadow-control transition-[width] duration-700 ease-motion" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Counts down to a server-provided deadline. Display only — the server decides timeouts. */
export function Timer({ deadline, label = 'زمان باقی‌مانده', lowSeconds = 10 }: { deadline: Date; label?: string; lowSeconds?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((deadline.getTime() - now) / 1000));
  const low = left <= lowSeconds;
  const text = `${fa(Math.floor(left / 60))}:${fa(String(left % 60).padStart(2, '0'))}`;
  return (
    <span className={cn('timer inline-flex h-10 items-center gap-2 rounded-control px-4 font-bold tabular-nums shadow-control', low ? 'timer--low bg-destructive text-destructive-foreground animate-pulse-soft' : 'bg-card')}
      role="timer" aria-label={`${label}: ${fa(left)} ثانیه`}>
      <Icon name="clock" size={18} /><span aria-hidden>{text}</span>
    </span>
  );
}

const AVATAR_ICON: Record<string, IconName> = { meeple: 'meeple', dice: 'dice', crown: 'crown', pawn: 'pawn', card: 'card', star: 'star' };
export function Avatar({ avatarKey, name, size = 40 }: { avatarKey: string; name: string; size?: number }) {
  return (
    <span className="avatar inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-primary shadow-control ring-2 ring-card"
      style={{ width: size, height: size }} role="img" aria-label={`نماد ${name}`}>
      <Icon name={AVATAR_ICON[avatarKey] ?? 'meeple'} size={Math.round(size * 0.52)} />
    </span>
  );
}

// ---------- Dialog / Drawer (native <dialog>: focus trap, Esc, inert background) ----------
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
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={cn('dialog border-line border-border bg-popover p-0 text-popover-foreground shadow-overlay backdrop:bg-foreground/45 backdrop:backdrop-blur-sm',
        drawer ? 'drawer ms-auto me-0 h-dvh max-h-dvh w-[min(420px,100vw)] rounded-none rounded-s-overlay animate-slide-in'
          : 'm-auto w-[min(520px,calc(100vw-2rem))] rounded-overlay animate-fade-up')}>
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 id={titleId} className="text-lg">{title}</h2>
        <Button variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="بستن" className="size-11 p-0" />
      </div>
      <div className="px-6 pb-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
    </dialog>
  );
}
export const Drawer = (p: Omit<Parameters<typeof Dialog>[0], 'drawer'>) => <Dialog {...p} drawer />;

// ---------- Toast (VibeFarsi toast card) ----------
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
      <div className="toasts pointer-events-none fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-60 flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-[360px]" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={cn('toast w-full', `toast--${t.tone}`)}>
            <ToastCard toast={{ title: t.text, variant: t.tone === 'info' ? 'default' : t.tone }} onClose={() => setItems((x) => x.filter((i) => i.id !== t.id))} />
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
    <div className="table-wrap w-full overflow-x-auto rounded-surface border-line border-border bg-card shadow-surface">
      <table className="table w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/70 text-xs text-muted-foreground"><tr>{columns.map((c) => <th key={c.key} scope="col" className="h-11 px-4 text-start align-middle font-semibold">{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={rowKey(r)} className="border-t border-border transition-colors hover:bg-accent/40">{columns.map((c) => <td key={c.key} className="px-4 py-3 align-middle">{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------- Honest screen states (VibeFarsi empty-state / skeleton) ----------
export type StateKind = 'loading' | 'empty' | 'error' | 'offline' | 'denied';
const STATE_ICON: Record<Exclude<StateKind, 'loading'>, IconName> = { empty: 'box', error: 'alert', offline: 'offline', denied: 'lock' };
export function StateBlock({ kind, title, children, action }: { kind: StateKind; title: string; children?: ReactNode; action?: ReactNode }) {
  if (kind === 'loading') {
    return (
      <div className="state flex flex-col items-center gap-4 px-4 py-12 text-muted-foreground" role="status" aria-live="polite">
        <div className="grid w-full max-w-md gap-3" aria-hidden>
          <div className="h-5 w-2/3 animate-pulse-soft rounded-control bg-secondary" />
          <div className="h-24 animate-pulse-soft rounded-surface bg-secondary" />
          <div className="h-4 w-1/2 animate-pulse-soft rounded-control bg-secondary" />
        </div>
        <span className="state__title text-sm">{title}</span>
      </div>
    );
  }
  return (
    <div className={cn('state mx-auto flex max-w-lg flex-col items-center gap-3 rounded-surface border border-dashed border-input px-6 py-10 text-center animate-fade-up', `state--${kind}`)} role={kind === 'error' ? 'alert' : undefined}>
      <span className={cn('flex size-16 items-center justify-center rounded-full shadow-control', kind === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-primary')}>
        <Icon name={STATE_ICON[kind]} size={28} />
      </span>
      <div className="state__title text-lg font-bold text-foreground">{title}</div>
      {children && <div className="max-w-sm text-sm leading-7 text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
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
