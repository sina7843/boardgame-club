/**
 * Replay keyboard: Home/End jump to the start/end; arrows step in reading direction. In RTL the timeline runs right to
 * left, so ← is «بعدی» and → is «قبلی» (mirrored in LTR). Returns the target revision, or null for other keys.
 */
export function replayKey(key: string, rev: number, total: number, rtl: boolean): number | null {
  const clamp = (n: number) => Math.min(Math.max(n, 1), total);
  if (key === 'Home') return 1;
  if (key === 'End') return total;
  if (key === 'ArrowLeft') return clamp(rev + (rtl ? 1 : -1));
  if (key === 'ArrowRight') return clamp(rev + (rtl ? -1 : 1));
  return null;
}
