// Display formatting: Persian digits and Jalali (Solar Hijri) calendar. Storage/API stay UTC ISO-8601.
import type { GameSummary } from '@bg/contracts';

const jalaliLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long', timeZone: 'Asia/Tehran' });
const weekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', timeZone: 'Asia/Tehran' });

export const faNum = (n: number) => n.toLocaleString('fa-IR');
export const jalaliDate = (iso: string | Date) => jalaliLong.format(typeof iso === 'string' ? new Date(iso) : iso);
export const jalaliToday = (now = new Date()) => `${weekday.format(now)}، ${jalaliLong.format(now)}`;

export const range = (a: number, b: number, unit: string) => (a === b ? `${faNum(a)} ${unit}` : `${faNum(a)}–${faNum(b)} ${unit}`);

export const DIFFICULTY_FA: Record<GameSummary['difficulty'], string> = { easy: 'آسان', medium: 'متوسط', hard: 'دشوار' };
export const PACE_FA: Record<GameSummary['paces'][number], string> = { live: 'زنده', turn: 'نوبتی' };
export const COMPETITION_FA: Record<GameSummary['competitions'][number], string> = { friendly: 'دوستانه', ranked: 'رتبه‌دار' };
export const ACCESS_FA: Record<GameSummary['access'], string> = { free: 'رایگان', premium: 'پریمیوم' };
export const AVATAR_FA: Record<string, string> = { meeple: 'آدمک', dice: 'تاس', crown: 'تاج', pawn: 'مهره', card: 'کارت', star: 'ستاره' };

/** Only same-app relative paths are accepted as a post-login destination (no open redirect). */
const BACKSLASH = String.fromCharCode(92);
export const safeNext = (next: string | null) =>
  next && next.startsWith('/') && next[1] !== '/' && next[1] !== BACKSLASH ? next : '/';

/** "۶۰ ثانیه", "۲ دقیقه", "۲۴ ساعت" — table time settings. */
export function durationFa(seconds: number): string {
  if (seconds % 3600 === 0 && seconds >= 3600) return `${faNum(seconds / 3600)} ساعت`;
  if (seconds % 60 === 0 && seconds >= 120) return `${faNum(seconds / 60)} دقیقه`;
  return `${faNum(seconds)} ثانیه`;
}

/** Remaining time until an ISO instant, coarse and readable: "۳ ساعت", "۱۲ دقیقه", "کمتر از یک دقیقه". */
export function remainingFa(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  if (s >= 86400) return `${faNum(Math.floor(s / 86400))} روز`;
  if (s >= 3600) return `${faNum(Math.floor(s / 3600))} ساعت`;
  if (s >= 60) return `${faNum(Math.floor(s / 60))} دقیقه`;
  return 'کمتر از یک دقیقه';
}
