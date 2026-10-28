// BGV design QA — captures every implemented screen at the reference widths and themes, and audits the live DOM
// against the design system. Run through `/bgv-qa` (Claude Code) or directly:
//   pnpm exec playwright test e2e/design-qa.spec.ts --project=desktop-1440
//   then: node scripts/ds-qa-report.mjs
// Output: design/qa/app/<screen>@<width>.png + design/qa/app/audit.json
// Only reads design/reference/screens.json + design/ds.config.json. Never edit those to make QA pass.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { test, type Browser, type Page } from '@playwright/test';
import { signIn } from './helpers.ts';

type Screen = { id: string; page: string; title: string; route: string | null; kind: string; state: string; theme: 'light' | 'dark'; responsive: boolean; viewports: number[]; reference: string[]; capture: string; supersededBy?: string };
const SCREENS: { screens: Screen[] } = JSON.parse(readFileSync('design/reference/screens.json', 'utf8'));
const CFG = JSON.parse(readFileSync('design/ds.config.json', 'utf8'));
const QA = CFG.qa ?? {};
const OUT = 'design/qa/app';
mkdirSync(OUT, { recursive: true });
const AUDIT_FILE = `${OUT}/audit.json`;
const audit: Record<string, unknown> = existsSync(AUDIT_FILE) ? JSON.parse(readFileSync(AUDIT_FILE, 'utf8')) : {};
const save = () => writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 1));

// Optional: live table URLs for table screens, e.g. BGV_QA_TABLES='{"catan":"/tables/abc","uno":"/tables/def"}'.
// Without it, table screens are reported as "needs-flow" and the QA agent captures them with a game flow (see /bgv-qa).
const TABLES: Record<string, string> = process.env.BGV_QA_TABLES ? JSON.parse(process.env.BGV_QA_TABLES) : {};
const ONLY = process.env.BGV_QA_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);

// Literal colours/radii the design system itself uses (bundle.css) are part of the DS, so they are allowed too.
const BUNDLE = [QA.dsBundle, 'packages/ui/src/bgv/bundle.css', 'design/system/components/bundle.css'].find((f) => f && existsSync(f));
const BUNDLE_CSS = BUNDLE ? readFileSync(BUNDLE, 'utf8') : '';
const DS_COLORS = [...new Set(BUNDLE_CSS.match(/#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)/g) ?? [])];
const DS_RADII = [...new Set([...BUNDLE_CSS.matchAll(/border-radius:\s*([^;}]+)/g)].flatMap((m) => (m[1] ?? '').trim().split(/\s+/)).filter((v) => /^\d+(\.\d+)?px$/.test(v)))];

let storage: string | undefined;
async function session(browser: Browser) {
  if (storage) return storage;
  const ctx = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: QA.baseURL });
  const page = await ctx.newPage();
  await signIn(page, 'مینا');
  storage = `${OUT}/.storage.json`;
  await ctx.storageState({ path: storage });
  await ctx.close();
  return storage;
}

async function resolveRoute(page: Page, route: string, s: Screen): Promise<string | null> {
  if (s.kind === 'table') {
    const game = (s.state.split(',')[0] ?? '').trim();
    return TABLES[game] ?? null;
  }
  if (!route.includes(':')) return route;
  const rule: string | undefined = QA.params?.[route];
  if (!rule) return null;
  if (!rule.startsWith('@firstLink:')) return route.replace(/:[a-z]+/i, rule);
  const [, list, prefix] = rule.split(':');
  if (!list || !prefix) return null;
  await page.goto(list);
  const href = await page.locator(`a[href^="${prefix}"]`).first().getAttribute('href').catch(() => null);
  return href;
}

/** Runs in the page: compares the live DOM with the design system. */
function domAudit(opts: { gameArt: string; minEdgeGap: number; dsColors: string[]; dsRadii: string[] }) {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const probe = document.createElement('div'); document.body.appendChild(probe);
  const norm = (v: string) => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const allowedColor = new Set<string>(['rgba(0, 0, 0, 0)']);
  const allowedRadius = new Set<string>(['0px', '50%', '9999px', '999px']);
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of Array.from(rules)) {
      const st = (r as CSSStyleRule).style; if (!st) continue;
      for (let i = 0; i < st.length; i++) {
        const name = st[i]; if (!name || !name.startsWith('--')) continue;
        const val = cs.getPropertyValue(name).trim(); if (!val) continue;
        if (name.startsWith('--radius')) allowedRadius.add(val);
        else if (/^(#|rgb|hsl)/.test(val)) allowedColor.add(norm(val));
      }
    }
  }
  // Chromium also enumerates custom properties on the computed style (works even when a stylesheet is not readable).
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i]; if (!name || !name.startsWith('--')) continue;
    const val = cs.getPropertyValue(name).trim(); if (!val) continue;
    if (name.startsWith('--radius')) allowedRadius.add(val);
    else if (/^(#|rgb|hsl)/.test(val)) allowedColor.add(norm(val));
  }
  for (const c of opts.dsColors) allowedColor.add(norm(c));
  for (const r of opts.dsRadii) allowedRadius.add(r);
  probe.remove();
  const inArt = (el: Element) => !!el.closest(opts.gameArt);
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const framed = (s: CSSStyleDeclaration) => s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0 || s.backgroundImage !== 'none';
  const offColors: Record<string, number> = {}; const offRadii: Record<string, number> = {}; const fonts: Record<string, number> = {};
  const overflow: string[] = []; const touching: string[] = []; const latinDigits: string[] = []; let bgv = 0; let total = 0; let middot = 0;
  const label = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} «${(el.textContent || '').trim().slice(0, 30)}»`;
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (!visible(el) || inArt(el) || el.closest('svg') && el.tagName !== 'svg') continue;
    total++; if (typeof el.className === 'string' && /\bbgv-/.test(el.className)) bgv++;
    const s = getComputedStyle(el);
    const check = (v: string) => { if (v && !v.startsWith('rgba(0, 0, 0, 0)') && !allowedColor.has(v)) offColors[v] = (offColors[v] || 0) + 1; };
    if ((el.textContent || '').trim()) check(s.color);
    check(s.backgroundColor);
    if (parseFloat(s.borderTopWidth) > 0) check(s.borderTopColor);
    for (const rad of [s.borderTopLeftRadius, s.borderTopRightRadius]) if (rad && !allowedRadius.has(rad) && !/%$/.test(rad) && parseFloat(rad) < 900) offRadii[rad] = (offRadii[rad] || 0) + 1;
    const p = el.parentElement;
    if (p && !inArt(p)) {
      const ps = getComputedStyle(p); const r = el.getBoundingClientRect(); const pr = p.getBoundingClientRect();
      const clips = ps.overflow !== 'visible' || ps.overflowX !== 'visible';
      if (!clips && framed(ps) && s.position !== 'absolute' && s.position !== 'fixed' && (r.left < pr.left - 1 || r.right > pr.right + 1 || r.bottom > pr.bottom + 1) && overflow.length < 40) overflow.push(label(el));
    }
    // text touching the edge of its framed box (owner rule: ≥12px padding in tiles, never touching)
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim());
    if (direct) {
      const fam = (s.fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim(); fonts[fam] = (fonts[fam] || 0) + 1;
      let box: Element | null = el; let bs = s;
      while (box && !framed(bs)) { box = box.parentElement; if (box) bs = getComputedStyle(box); }
      if (box && box !== document.body && !(box === el && (el.getBoundingClientRect().height <= 32 || bs.borderTopLeftRadius === '50%'))) {
        const range = document.createRange(); range.selectNodeContents(el); const tr = range.getBoundingClientRect(); const br = box.getBoundingClientRect();
        const gap = br.height > 40 ? Math.min(tr.left - br.left, br.right - tr.right, tr.top - br.top, br.bottom - tr.bottom) : Math.min(tr.left - br.left, br.right - tr.right);
        if (gap < opts.minEdgeGap && br.width > tr.width + 2 && touching.length < 40) touching.push(`${label(el)} gap ${gap.toFixed(1)}px`);
      }
      const t = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent || '').join('');
      if (/[0-9]/.test(t) && getComputedStyle(el).direction === 'rtl' && !el.closest('[dir="ltr"], .t-latin, code, kbd, .bgv-num--signed') && latinDigits.length < 40) latinDigits.push(label(el));
      if (/[·•]/.test(t)) middot++;
    }
  }
  const se = document.scrollingElement!;
  return {
    hScroll: se.scrollWidth - se.clientWidth,
    dsCoverage: total ? +(bgv / total).toFixed(3) : 0,
    shell: { app: !!document.querySelector('.bgv-app'), siteheader: !!document.querySelector('.bgv-siteheader'), sidebar: !!document.querySelector('.bgv-sidebar'), topbar: !!document.querySelector('.bgv-topbar'), dock: !!document.querySelector('.bgv-dock'), tablescreen: !!document.querySelector('.bgv-tablescreen') },
    theme: root.dataset.theme ?? 'system',
    offTokenColors: offColors, offTokenRadii: offRadii, fonts, overflow, touching, latinDigits, middot
  };
}

for (const s of SCREENS.screens) {
  if (ONLY && !ONLY.includes(s.id) && !ONLY.includes(s.page)) continue;
  test(`design-qa ${s.page}/${s.id}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const entry: Record<string, unknown> = { id: s.id, page: s.page, route: s.route, kind: s.kind, capture: s.capture, theme: s.theme, shots: [] };
    audit[s.id] = entry;
    if (s.supersededBy) { entry.status = 'superseded'; entry.supersededBy = s.supersededBy; save(); test.skip(true, `${s.id}: superseded by ${s.supersededBy}`); return; }
    if (!s.route || s.capture === 'manual') { entry.status = s.kind === 'spec' ? 'spec-only' : 'manual'; save(); test.skip(true, `${s.id}: ${entry.status}`); return; }
    if (QA.roles?.[s.route] && !process.env[`BGV_QA_${String(QA.roles[s.route]).toUpperCase()}_STORAGE`]) { entry.status = `needs-role:${QA.roles[s.route]}`; save(); test.skip(true, entry.status as string); return; }
    const state = QA.roles?.[s.route] ? process.env[`BGV_QA_${String(QA.roles[s.route]).toUpperCase()}_STORAGE`] : s.route === '/login' ? undefined : await session(browser);
    for (const w of s.viewports) {
      const h = s.responsive ? 900 : 844;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'fa-IR', timezoneId: 'Asia/Tehran', reducedMotion: 'reduce', baseURL: QA.baseURL, storageState: state, hasTouch: w < 900 });
      await ctx.addInitScript((theme) => { try { localStorage.setItem('bg.prefs', JSON.stringify({ theme, motion: 'reduce', muted: true, undo: 'off' })); } catch { /* storage blocked */ } }, s.theme);
      const page = await ctx.newPage();
      const url = await resolveRoute(page, s.route, s);
      if (!url) { entry.status = s.kind === 'table' ? 'needs-flow' : 'needs-data'; await ctx.close().catch(() => {}); break; }
      await page.goto(url);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);
      const file = `${OUT}/${s.id}@${w}.png`;
      await page.screenshot({ path: file, fullPage: s.responsive });
      const dom = await page.evaluate(domAudit, { gameArt: QA.gameArtSelector ?? '.bgv-felt__stage, [data-game-art]', minEdgeGap: QA.thresholds?.minEdgeGapPx ?? 6, dsColors: DS_COLORS, dsRadii: DS_RADII });
      (entry.shots as unknown[]).push({ width: w, file: file.replace('design/', ''), url, ...dom });
      entry.status = 'captured';
      await ctx.close().catch(() => {});
    }
    save();
  });
}
