import { z } from 'zod';

/**
 * A rating is kept per game and "mode". Games without a clock use the pace (live / turn). Live games played with a
 * chess clock (option `clock`, "minutes+increment") use a time class instead, so blitz and rapid skill do not mix.
 */
export const RATING_MODES = ['live', 'turn', 'bullet', 'blitz', 'rapid', 'classical'] as const;
export type RatingMode = (typeof RATING_MODES)[number];
export const ratingModeSchema = z.enum(RATING_MODES);

export const RATING_MODE_FA: Record<RatingMode, string> = {
  live: 'زنده', turn: 'نوبتی', bullet: 'گلوله‌ای', blitz: 'برق‌آسا', rapid: 'سریع', classical: 'کلاسیک'
};

/**
 * `m+i` or `a/b+i` (host/guest minutes) → time class by the FIDE estimate base + 60 × increment (seconds):
 * under 3 min bullet, under 10 min blitz, under 60 min rapid, otherwise classical.
 */
export function clockClass(clock: unknown): 'bullet' | 'blitz' | 'rapid' | 'classical' | null {
  const m = typeof clock === 'string' ? /^(\d+)(?:\/(\d+))?\+(\d+)$/.exec(clock) : null;
  if (!m) return null;
  const est = Number(m[1]) * 60 + 60 * Number(m[3]);
  return est < 180 ? 'bullet' : est < 600 ? 'blitz' : est < 3600 ? 'rapid' : 'classical';
}

export function ratingModeOf(pace: 'live' | 'turn' | string, options?: { clock?: unknown } | null): RatingMode {
  if (pace !== 'live') return 'turn';
  return clockClass(options?.clock) ?? 'live';
}
