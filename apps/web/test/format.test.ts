import { describe, expect, it } from 'vitest';
import { faNum, jalaliDate, jalaliToday, range, safeNext } from '../src/lib/format.ts';
import { readPrefs } from '../src/lib/prefs.tsx';

describe('display formatting', () => {
  it('renders Persian digits', () => {
    expect(faNum(1405)).toBe('۱٬۴۰۵');
    expect(range(2, 4, 'نفر')).toBe('۲–۴ نفر');
    expect(range(2, 2, 'نفر')).toBe('۲ نفر');
  });
  it('shows UTC instants as Jalali dates in Tehran time', () => {
    // 2026-10-05T21:00Z is 00:30 on 14 Mehr 1405 in Tehran (UTC+03:30).
    expect(jalaliDate('2026-10-05T21:00:00Z')).toBe('۱۴ مهر ۱۴۰۵');
    expect(jalaliDate('2026-03-20T12:00:00Z')).toBe('۲۹ اسفند ۱۴۰۴');
    expect(jalaliToday(new Date('2026-10-06T08:00:00Z'))).toBe('سه‌شنبه، ۱۴ مهر ۱۴۰۵');
  });
});

describe('safeNext', () => {
  it.each([['/games/x', '/games/x'], ['/' + String.fromCharCode(92) + 'evil.example', '/'], ['https://evil.example', '/'], ['/' + String.fromCharCode(92) + 'evil.example', '/'], [null, '/']])(
    '%s → %s', (input, expected) => expect(safeNext(input)).toBe(expected));
});

describe('readPrefs', () => {
  it('falls back to safe defaults on bad input', () => {
    expect(readPrefs('not json')).toEqual({ theme: 'dark', motion: 'system', muted: false });
    expect(readPrefs('{"theme":"light","motion":"reduce","muted":true}')).toEqual({ theme: 'light', motion: 'reduce', muted: true });
    expect(readPrefs('{"theme":"neon"}').theme).toBe('dark');
  });
});
