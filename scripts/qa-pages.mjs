// Boardgameverse page check: axe (WCAG 2.2 AA) + the design-system rules.
// Usage: node qa-pages.mjs <url> [<url> …] [--widths=390,1000,1440] [--dark] [--out=report.json]
// Needs: npm i -D playwright axe-core   (and: npx playwright install chromium)
import { chromium } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const args = process.argv.slice(2);
const urls = args.filter(a => !a.startsWith('--'));
const opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const widths = (opt('widths') || '390,1000,1440').split(',').map(Number);
const dark = args.includes('--dark');
if (!urls.length) { console.error('usage: node qa-pages.mjs <url> [...] [--widths=390,1000,1440] [--dark] [--out=report.json]'); process.exit(2); }

// colours that may be solid amber, and where (see 02-DECISIONS.md, 2.4)
const AMBER = ['rgb(232, 166, 66)', 'rgb(216, 148, 47)'];
const AMBER_OK = '.bgv-btn--primary, .bgv-siteheader__quick, .bgv-dock__item.is-active, .bgv-coin, .bgv-coinchip, .bgv-turn--mine, .bgv-badge--turn, .bgv-toast--turn, .bgv-notif__icon--turn, .bgv-critbar';
const NAMES = ['حریف‌یابی', 'یه میز پیدا کن', 'اشتراک ویژه', 'فروشگاه ظاهر'];

const browser = await chromium.launch();
const report = []; let failures = 0;
for (const url of urls) for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })));
  const rules = await page.evaluate(({ AMBER, AMBER_OK, NAMES, phone }) => {
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const name = el => (String(el.className).split(' ')[0] || el.tagName.toLowerCase());
    const out = { blur: [], amber: [], amberActions: 0, small: [], latin: [], names: [], hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, dockActive: null };
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el)) continue; const s = getComputedStyle(el);
      if (s.boxShadow !== 'none' && s.boxShadow.split(/,(?![^(]*\))/).some(p => { const n = p.replace(/rgba?\([^)]*\)|#[0-9a-f]+/gi, '').trim().split(/\s+/).filter(x => /px$/.test(x)).map(parseFloat); return n.length >= 3 && n[2] > 0; }) && !el.closest('.bgv-gamecard__box')) out.blur.push(name(el));
      if (AMBER.includes(s.backgroundColor)) { if (el.matches(AMBER_OK)) { if (el.matches('.bgv-btn--primary') && !el.matches('.bgv-siteheader__quick')) out.amberActions++; } else out.amber.push(name(el)); }
    }
    if (phone) for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, [role=button], [role=tab], [role=switch]')) {
      if (!vis(el) || (el.tagName === 'A' && getComputedStyle(el).display === 'inline')) continue;
      const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 24) out.small.push(name(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) { const p = n.parentElement; if (!p || !vis(p) || p.closest('[dir=ltr], .bgv-latin, kbd, code, [lang=en], script, style')) continue;
      if (/[0-9]/.test(n.nodeValue)) out.latin.push(n.nodeValue.trim().slice(0, 30));
      if (/[0-9۰-۹]\s*·|·\s*[0-9۰-۹]/.test(n.nodeValue)) out.latin.push('«·» next to a number: ' + n.nodeValue.trim().slice(0, 30)); }
    const text = document.body.innerText; out.names = NAMES.filter(w => text.includes(w));
    const dock = [...document.querySelectorAll('.bgv-dock')].find(vis); if (dock) out.dockActive = dock.querySelectorAll('.bgv-dock__item.is-active').length;
    for (const k of ['blur', 'amber', 'small', 'latin']) out[k] = [...new Set(out[k])].slice(0, 10);
    return out;
  }, { AMBER, AMBER_OK, NAMES, phone: w < 900 });
  const problems = [];
  if (errors.length) problems.push('JS errors: ' + errors.slice(0, 3).join(' | '));
  if (axe.length) problems.push('axe: ' + axe.map(v => `${v.id}×${v.nodes}`).join(', '));
  if (rules.hscroll) problems.push('horizontal scroll');
  if (rules.blur.length) problems.push('blurred shadow: ' + rules.blur.join(', '));
  if (rules.amber.length) problems.push('solid amber on a non-action: ' + rules.amber.join(', '));
  if (rules.amberActions > 1) problems.push(`${rules.amberActions} amber primary actions in the page (max 1; the header «بازی سریع» is not counted)`);
  if (rules.small.length) problems.push('touch target < 24px: ' + rules.small.join(', '));
  if (rules.latin.length) problems.push('Latin digits or «·» next to a number: ' + rules.latin.join(' | '));
  if (rules.names.length) problems.push('old names: ' + rules.names.join(', '));
  if (rules.dockActive !== null && rules.dockActive > 1) problems.push(`dock has ${rules.dockActive} active items`);
  failures += problems.length ? 1 : 0;
  console.log(`${problems.length ? '✗' : '✓'} ${url} @${w}${dark ? ' dark' : ''}`); problems.forEach(p => console.log('   - ' + p));
  report.push({ url, width: w, dark, errors, axe, ...rules, problems });
  await page.close();
}
await browser.close();
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(report, null, 1));
process.exit(failures ? 1 : 0);
