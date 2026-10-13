import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Coins } from 'lucide-react';
import type { CoinsResponse } from '@bg/contracts';
import { cn } from '@bg/ui';
import { useApi } from './api.ts';
import { faNum } from './format.ts';

/** Fired after a spend or purchase so every balance on screen re-reads the server. */
export const COINS_CHANGED = 'coins:changed';
export const coinsChanged = () => window.dispatchEvent(new Event(COINS_CHANGED));

export function useCoins(enabled = true) {
  const r = useApi<CoinsResponse>(enabled ? '/me/coins' : null);
  const reload = r.reload;
  useEffect(() => {
    window.addEventListener(COINS_CHANGED, reload);
    return () => window.removeEventListener(COINS_CHANGED, reload);
  }, [reload]);
  return r;
}

/** Gold coin mark; decorative, the number next to it carries the meaning. */
export const CoinMark = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-[#e9c46a] text-[#7a5300] shadow-control', className ?? 'size-6')}>
    <Coins className="size-[60%]" strokeWidth={2.25} aria-hidden />
  </span>
);

/** Balance pill for the shell; re-reads on navigation (games finish elsewhere) and on COINS_CHANGED. */
export function CoinChip() {
  const { pathname } = useLocation();
  const c = useCoins();
  const reload = c.reload;
  const seen = useRef(pathname);
  useEffect(() => { if (seen.current !== pathname) { seen.current = pathname; reload(); } }, [pathname, reload]);
  if (c.data === undefined) return null;
  return (
    <NavLink to="/coins" aria-label={`سکه‌های من: ${faNum(c.data.balance)}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border-line border-border bg-card ps-1 pe-3 text-sm font-bold text-foreground no-underline shadow-control transition-transform duration-(--motion) ease-motion hover:-translate-y-0.5">
      <CoinMark className="size-7" /><span className="num">{faNum(c.data.balance)}</span>
    </NavLink>
  );
}
