import { useEffect, useMemo } from 'react';
import type { Presence } from '@bg/contracts';
import { useApi } from './api.ts';
import { faNum, jalaliDate } from './format.ts';

/** Online status for friends and table-mates (the server leaves others out); refreshed every minute. */
export function usePresence(ids: (string | null | undefined)[]): Record<string, Presence> {
  const key = useMemo(() => [...new Set(ids.filter((x): x is string => !!x))].sort().slice(0, 60).join(','), [ids]);
  const res = useApi<{ items: Record<string, Presence> }>(key ? `/presence?ids=${key}` : null);
  const reload = res.reload;
  useEffect(() => {
    if (!key) return;
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [key, reload]);
  return res.data?.items ?? {};
}

export function lastSeenFa(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 2) return 'همین الان';
  if (min < 60) return `${faNum(min)} دقیقه پیش`;
  if (min < 24 * 60) return `${faNum(Math.round(min / 60))} ساعت پیش`;
  if (min < 48 * 60) return 'دیروز';
  return jalaliDate(iso);
}

/** One meta line: «در حال بازی کاتان» / «آنلاین» / «آخرین بازدید …». */
export const presenceLine = (p?: Presence) =>
  !p ? undefined : p.playing ? `در حال بازی ${p.playing.gameNameFa}` : p.online ? 'آنلاین' : p.lastSeenAt ? `آخرین بازدید ${lastSeenFa(p.lastSeenAt)}` : undefined;
