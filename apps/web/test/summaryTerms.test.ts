import { describe, expect, it } from 'vitest';
import type { PublicSummaryView } from '@bg/contracts';
import { localizeSummary } from '../src/games/summaryTerms.ts';

const sum = { seats: [{ seat: 0, stats: [{ key: 'pip', label: 'پیپ', value: 167 }, { key: 'x', label: 'خارج‌شده', value: 0 }], badges: [] }] } as unknown as PublicSummaryView;
describe('summary labels in «فارسی بردگیمی»', () => {
  it('swaps only exact game terms and keeps the object in fa', () => {
    expect(localizeSummary('backgammon', sum, 'fa')).toBe(sum);
    const bg = localizeSummary('backgammon', sum, 'fa-bg');
    expect(bg.seats[0]!.stats!.map((s) => s.label)).toEqual(['Pip', 'خارج‌شده']);
    expect(localizeSummary('unknown-game', sum, 'fa-bg')).toBe(sum);
  });
});
