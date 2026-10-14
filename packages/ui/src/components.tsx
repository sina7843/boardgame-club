// Non-visual app helpers (toasts, online state) and the game renderers' own Button. The site UI is the BGV design
// system (./bgv); this Button stays only because the game renderers draw with it inside the felt (.table-night scope).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Icon, type IconName } from './icons.tsx';
import { cn } from './vf/lib/utils.ts';
import { Toast as BgvToast } from './bgv/index.ts';

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
  'transition-[background-color,box-shadow,transform,color] duration-(--dur-base) ease-motion active:scale-95',
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

// ---------- Toast (BGV design-system Toast; error toasts use the crimson tone) ----------
type Toast = { id: number; tone: 'info' | 'success' | 'error' | 'turn' | 'timeout'; text: string; sub?: string };
const ToastCtx = createContext<(tone: Toast['tone'], text: string, sub?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
const TOAST_ICON = { info: 'info', success: 'circle-check', error: 'circle-alert', turn: 'bell-ring', timeout: 'alarm-clock' } as const;
const TOAST_TONE = { info: 'default', success: 'default', error: 'critical', turn: 'turn', timeout: 'critical' } as const;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast['tone'], text: string, sub?: string) => {
    const id = ++seq.current;
    setItems((x) => [...x.slice(-2), { id, tone, text, ...(sub ? { sub } : {}) }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <BgvToast key={t.id} className={`toast toast--${t.tone}`} tone={TOAST_TONE[t.tone]} icon={TOAST_ICON[t.tone]} title={t.text} {...(t.sub ? { text: t.sub } : {})}
            onClose={() => setItems((x) => x.filter((i) => i.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
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
