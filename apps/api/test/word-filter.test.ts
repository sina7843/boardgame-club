import { describe, expect, it } from 'vitest';
import { maskProfanity } from '../src/modules/social/word-filter.ts';

describe('chat word filter', () => {
  it('masks whole insults and their spelling tricks, keeps ordinary words', () => {
    expect(maskProfanity('برو جنده')).toBe('برو ****');
    expect(maskProfanity('کیییر')).toBe('*****');
    expect(maskProfanity('مادر‌جنده')).toBe('*********');
    expect(maskProfanity('گاییدمت')).toBe('*******');
    expect(maskProfanity('you are KIR!')).toBe('you are ***!');
    expect(maskProfanity('كسكش')).toBe('****');
    expect(maskProfanity('هیچ کس کسب و کار کسی را نمی‌داند')).toBe('هیچ کس کسب و کار کسی را نمی‌داند');
    expect(maskProfanity('bazi kon, che kar koni')).toBe('bazi kon, che kar koni');
    expect(maskProfanity('اکنون کونگ‌فو')).toBe('اکنون کونگ‌فو');
  });
});
