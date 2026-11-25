import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { isInternalHeading, publicRules, rulesToc } from '../src/lib/rulesPublic.ts';
import { Markdown } from '../src/games/RulesDoc.tsx';
import { gameSlugs, rulesFiles } from '../scripts/rules.ts';

const files = rulesFiles();
const real = (slug: string) => readFileSync(files.get(slug)!, 'utf8');
/** Slugs that ship without a RULES.md. Empty today; a new game without rules must be listed here on purpose. */
const KNOWN_MISSING: string[] = [];

describe('public rules stripper (real design/games files)', () => {
  it('maps every game slug to a RULES.md, and every RULES.md to a game', () => {
    const slugs = gameSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(68);
    expect(slugs.filter((s) => !files.has(s))).toEqual(KNOWN_MISSING);
    expect([...files.keys()].filter((s) => !slugs.includes(s))).toEqual([]);
  });

  it.each(['ark-nova', 'uno', 'brass', 'azul', 'amlak', 'blood-rage', 'chess'])('%s: keeps the rule sections, drops internal ones and audit columns', (slug) => {
    const src = real(slug);
    const out = publicRules(src);
    expect(out.startsWith('# قوانین')).toBe(true);
    for (const h of ['تفاوت موتور با دفترچه', 'قانون‌هایی که رابط کاربری ندارند', 'مراحلی که بازیکن می‌بیند', 'راهنمای ستون‌ها', 'دفترچهٔ مرجع']) expect(out).not.toContain(h);
    expect(out).not.toMatch(/\.ts:\d|rules\.ts|\| ?قانون ?\||✅|⚠️|❌|🟦|§|`/);
    expect(out).not.toMatch(/^\|/m);
    // Every numbered source section that had a playable rule survives, in order.
    const numbered = src.split('\n').filter((l) => /^## [۰-۹0-9]/.test(l)).map((l) => l.slice(3).trim());
    expect(rulesToc(out).filter((h) => /^[۰-۹0-9]/.test(h))).toEqual(numbered);
    expect(out.split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThan(10);
  });

  it('every real file yields a non-empty public document without internal markers', () => {
    for (const [slug, file] of files) {
      const out = publicRules(readFileSync(file, 'utf8'));
      expect(rulesToc(out).length, slug).toBeGreaterThanOrEqual(5);
      expect(out, slug).not.toMatch(/تفاوت موتور|رابط کاربری ندارند|rules\.ts|✅|❌/);
    }
  });

  it('drops rows the site does not play and audit notes, keeps the rule text', () => {
    const md = ['# قوانین x', '- موتور: games/x', '## ۱. چیدمان', '| # | قانون | دفترچه | موتور | طرح |', '|---|---|---|---|---|',
      '| S1 | هر نفر ۷ کارت (پیش‌فرض BGA) | p.1 | ✅ rules.ts:3 | ✅ |', '| S2 | گونهٔ تیمی | p.2 | ❌ | — |', '| S3 | کد (`NO_MOVE`) و `x` | — | ✅ | — |',
      '## تفاوت‌موتور با دفترچه', '- [ ] E1 secret', '## ۲. پایان', '| # | قانون | دفترچه | موتور | طرح |', '|---|---|---|---|---|', '| G1 | تساوی: موتور قرعه | — | ✅ | — |'].join('\n');
    expect(publicRules(md)).toBe('# قوانین x\n\n## ۱. چیدمان\n\n- هر نفر ۷ کارت\n- کد و x\n\n## ۲. پایان\n\n- تساوی: سایت قرعه\n');
  });

  it('internal heading match survives ZWNJ, spacing and digit variants', () => {
    for (const h of ['تفاوت موتور با دفترچه', 'تفاوت‌موتور  با دفترچه', '۷. تفاوت موتور', 'قانون‌هایی که رابط کاربری ندارند', 'قانون هایی که رابط‌کاربری ندارند', 'مراحلی که بازیکن می‌بیند', 'Engine notes']) expect(isInternalHeading(h), h).toBe(true);
    for (const h of ['۱. چیدمان', '۵. پایان بازی و برنده (تساوی‌شکن)', 'زندان', '۶. موارد خاص و استثناها']) expect(isInternalHeading(h), h).toBe(false);
  });
});

describe('markdown renderer', () => {
  const html = (text: string, p: Partial<Parameters<typeof Markdown>[0]> = {}) => renderToStaticMarkup(<Markdown text={text} {...p} />);

  it('renders headings (shifted, h2 ids), lists, inline marks, tables and quotes', () => {
    const out = html('# T\n\n## ۱. چیدمان\n\nمتن **پررنگ** و *کج* و `code`.\n\n- یک\n- دو\n\n1. اول\n2. دوم\n\n| الف | ب |\n|---|---|\n| ۱ | ۲ |\n\n> نقل', { shift: 1, idPrefix: 'r' });
    expect(out).toContain('<h2>T</h2>');
    expect(out).toContain('<h3 id="r-0">۱. چیدمان</h3>');
    expect(out).toContain('<p>متن <strong>پررنگ</strong> و <em>کج</em> و <code>code</code>.</p>');
    expect(out).toContain('<ul><li>یک</li><li>دو</li></ul>');
    expect(out).toContain('<ol><li>اول</li><li>دوم</li></ol>');
    expect(out).toContain('<th scope="col">الف</th>');
    expect(out).toContain('<td>۲</td>');
    expect(out).toContain('<blockquote><p>نقل</p></blockquote>');
  });

  it('skips the title when asked and keeps Persian digits as written', () => {
    expect(html('# عنوان\n\n۲ تا ۴ نفر', { skipTitle: true })).toBe('<p>۲ تا ۴ نفر</p>');
  });

  it('never injects HTML from the text', () => {
    const out = html('<img src=x onerror=alert(1)>\n\n- <script>alert(1)</script> **<b>x</b>**\n\n## <a href="javascript:alert(1)">h</a>');
    expect(out).not.toMatch(/<img|<script|<a |<b>/);
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(out).toContain('&lt;script&gt;');
  });
});
