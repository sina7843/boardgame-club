import { appendFileSync, mkdirSync } from 'node:fs';
import { expect, type Browser, type Page } from '@playwright/test';

let seq = 0;
/** Unique mobile per call within a run (per-mobile resend limits are real). */
export const freshMobile = () => `0916${String(Date.now() % 1_000_000).padStart(6, '0')}${seq++ % 10}`.slice(0, 11);

export async function signIn(page: Page, displayName: string, next = '/'): Promise<string> {
  const mobile = freshMobile();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('شماره موبایل').fill(mobile);
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  await page.getByRole('group', { name: 'کد تأیید' }).getByRole('textbox').first().fill('123456');
  await expect(page.getByRole('heading', { name: 'خوش آمدید' })).toBeVisible();
  await page.getByLabel('نام نمایشی').fill(displayName);
  await page.getByRole('button', { name: 'ذخیره و ادامه' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return mobile;
}

/** A separate browser context = an independent client with its own session cookie. */
export async function newPage(browser: Browser, viewport: { width: number; height: number } | null) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1440, height: 900 }, locale: 'fa-IR', timezoneId: 'Asia/Tehran', reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:5173' });
  await ctx.addInitScript(() => { try { localStorage.setItem('bg.undoMs', '0'); } catch { /* storage unavailable */ } });
  const page = await ctx.newPage();
  if (process.env.MOTION_PROBE) await probeMotion(page);
  return page;
}

/**
 * MOTION_PROBE=1 (or a file path): every page plays with motion on and, when it closes, appends a `MOTION <path> <kind>` line per animation it starts —
 * a per-flow inventory of the top-layer motions (fly/die/exit) and in-place animation classes that actually ran.
 */
async function probeMotion(page: Page) {
  await recordMotion(page);
  const file = process.env.MOTION_PROBE === '1' ? 'test-results/motion-probe.log' : process.env.MOTION_PROBE!;
  mkdirSync('test-results', { recursive: true });
  let path = '';
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) path = new URL(f.url()).pathname; });
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('__motion ')) appendFileSync(file, `MOTION ${path} ${t.slice(9)}\n`);
  });
}

export async function player(browser: Browser, viewport: { width: number; height: number } | null, name: string) {
  // newPage: moves are sent at once in E2E (no undo window; the undo test turns it back on per page).
  const page = await newPage(browser, viewport);
  await signIn(page, name);
  return page;
}

export const shot = (name: string, project: string) => `docs/evidence/phase-01/${project}-${name}.png`;

/** Close level-up / achievement celebrations, which open after leaving a table (e.g. after a finished tutorial). */
export async function dismissCelebrations(page: Page) {
  const dialog = page.locator('dialog.celebrate');
  for (let i = 0; i < 5; i++) {
    if (!(await dialog.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false))) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

export interface MotionEntry { ghost: 'fly' | 'die' | 'exit' | null; flip: string | null; cls: string }

/**
 * Turn motion on for this page (the suite runs with reduced motion) and record every Web Animation it starts.
 * Call before the first navigation. Top-layer animations carry `ghost`: 'fly' (a card or piece crossing zones),
 * 'die' (a thrown die) or 'exit' (a card leaving to an anchor).
 */
export async function recordMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const log: unknown[] = [];
    (window as unknown as { __motion: unknown[] }).__motion = log;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const entry = { ghost: this.getAttribute('data-motion-ghost'), flip: this.getAttribute('data-flip'), cls: (this.getAttribute('class') ?? '').slice(0, 80) };
      log.push(entry);
      console.debug(`__motion ${entry.ghost ?? (entry.flip ? 'flip-inplace' : 'other')}`);
      return animate.apply(this, args);
    };
  });
}

/** Animations recorded since the last call (the log is drained). */
export const motionLog = (page: Page): Promise<MotionEntry[]> =>
  page.evaluate(() => (window as unknown as { __motion: MotionEntry[] }).__motion.splice(0));
