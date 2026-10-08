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
  return ctx.newPage();
}

export async function player(browser: Browser, viewport: { width: number; height: number } | null, name: string) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1440, height: 900 }, locale: 'fa-IR', timezoneId: 'Asia/Tehran', reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:5173' });
  // Moves are sent at once in E2E (no 2 s undo window); the undo test turns it back on per page.
  await ctx.addInitScript(() => { try { localStorage.setItem('bg.undoMs', '0'); } catch { /* storage unavailable */ } });
  const page = await ctx.newPage();
  await signIn(page, name);
  return page;
}

export const shot = (name: string, project: string) => `docs/evidence/phase-01/${project}-${name}.png`;
