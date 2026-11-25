import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readPrefs } from '../src/lib/prefs.tsx';
import { renderTerm, termText } from '../src/lib/terms.tsx';

const wp = { fa: 'جانمایی کارگر', bg: 'Worker Placement' };
describe('game terms', () => {
  it('defaults to Persian and ignores junk', () => {
    expect(readPrefs(null).terms).toBe('fa');
    expect(readPrefs('{"terms":"en"}').terms).toBe('fa');
    expect(readPrefs('{"terms":"fa-bg"}').terms).toBe('fa-bg');
  });
  it('picks the word per language and isolates Latin in bdi', () => {
    expect(termText(wp, 'fa')).toBe('جانمایی کارگر');
    expect(termText(wp, 'fa-bg')).toBe('Worker Placement');
    expect(renderToStaticMarkup(<>{renderTerm(wp, 'fa-bg')}</>)).toBe('<bdi>Worker Placement</bdi>');
    expect(renderToStaticMarkup(<>{renderTerm(wp, 'fa')}</>)).toBe('جانمایی کارگر');
  });
});
