import { useEffect } from 'react';
import type { CoinsResponse } from '@bg/contracts';
import { Coin } from '@bg/ui/bgv';
import { useApi } from './api.ts';

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

/** Gold coin mark (DS Coin); decorative, the number next to it carries the meaning. Other pages still import this name. */
export const CoinMark = ({ className }: { className?: string }) => <Coin className={className} aria-hidden />;
