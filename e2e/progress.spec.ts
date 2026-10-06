import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// DRAGON-03: game result → server-derived progression; dev checkout → server-verified entitlement.
test.describe.configure({ mode: 'serial', timeout: 120_000 });
const shot = (name: string, project: string) => `docs/evidence/phase-03/${project}-${name}.png`;
const uniq = () => Math.random().toString(36).slice(2, 7);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
const grant = (mobile: string, role: string) => execFileSync('node', ['packages/db/src/grant-role.ts', mobile, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });

async function queueRanked(p: Page) {
  await p.goto('/play');
  await p.getByLabel('بازی', { exact: true }).selectOption({ label: 'سه‌خطی' });
  await p.locator('form').getByText('نوبتی', { exact: true }).click();
  await p.locator('form').getByText('رتبه‌دار', { exact: true }).click();
  await p.getByRole('button', { name: 'شروع جست‌وجو' }).click();
}

test('ranked game result feeds rating, XP, missions and the result screen', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const a = await newPage(browser, vp);
  const b = await newPage(browser, vp);
  await signIn(a, `Rana${uniq()}`);
  await signIn(b, `Bahar${uniq()}`);
  await queueRanked(a);
  await queueRanked(b);
  for (const p of [a, b]) {
    await expect(p.getByText('حریف پیدا شد!')).toBeVisible({ timeout: 15_000 });
    await p.getByRole('button', { name: 'رفتن به میز و اعلام آمادگی' }).click();
    await p.getByRole('button', { name: 'آماده‌ام' }).click();
  }
  await expect(a.locator('.lt__board')).toBeVisible();
  const myTurn = (p: Page) => p.getByText(/نوبت شماست/).isVisible();
  for (const cell of [0, 3, 1, 4, 2]) {
    let mover: Page | null = null;
    for (let i = 0; i < 60 && !mover; i++) { if (await myTurn(a)) mover = a; else if (await myTurn(b)) mover = b; else await a.waitForTimeout(150); }
    await mover!.locator('.lt__cell').nth(cell).click();
    await mover!.getByRole('button', { name: 'ثبت حرکت' }).click();
    await expect(mover!.locator('.lt__cell').nth(cell)).not.toHaveText('');
  }
  // After the game (never during it): rating change and XP with reasons, computed by the worker.
  await expect(a.getByText(/امتیاز رتبه‌دار: ۱٬?۵۰۰ →/)).toBeVisible({ timeout: 20_000 });
  await expect(a.getByText(/XP: بازی کامل شد/)).toBeVisible();
  await a.screenshot({ path: shot('01-result-rewards', info.project.name), fullPage: true });

  await a.goto('/progress');
  await expect(a.getByRole('heading', { name: 'سطح حساب' })).toBeVisible();
  await expect(a.getByText(/موقت \(۱ بازی\)/)).toBeVisible();
  await expect(a.getByText('سه میز کامل').first()).toBeVisible();
  await a.screenshot({ path: shot('02-progress', info.project.name), fullPage: true });
  await a.goto('/ranking');
  await expect(a.getByRole('heading', { name: 'رتبه‌بندی و لیگ' })).toBeVisible();
  await expect(a.getByText(/تحلیل روند هفتگی و مقایسه فصل‌ها بخشی از/)).toBeVisible();
  await a.screenshot({ path: shot('03-ranking', info.project.name), fullPage: true });
  await a.context().close(); await b.context().close();
});

test('development checkout: labelled fake gateway, server verification activates premium; a failed payment does not', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const admin = await newPage(browser, vp);
  grant(await signIn(admin, `Admin${uniq()}`), 'admin');
  // Admin sets a test price (pricing is a product decision; this is a labelled development value).
  const plans = await (await admin.request.get('/api/admin/plans')).json();
  const monthly = plans.items.find((p: { key: string }) => p.key === 'premium-monthly');
  const r = await admin.request.patch(`/api/admin/plans/${monthly.id}`, { data: { priceAmount: 990_000, active: true, reason: 'قیمت آزمایشی E2E' }, headers: { origin: 'http://127.0.0.1:5173' } });
  expect(r.status()).toBe(204);

  const u = await newPage(browser, vp);
  await signIn(u, `Payam${uniq()}`);
  await u.goto('/plans');
  await expect(u.getByText('حالت توسعه: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود.')).toBeVisible();
  await u.screenshot({ path: shot('04-plans', info.project.name), fullPage: true });

  // Failed attempt first: nothing is activated.
  await u.getByRole('region', { name: 'پریمیوم ماهانه' }).getByRole('button', { name: 'خرید' }).click();
  await expect(u.getByText(/درگاه آزمایشی توسعه/)).toBeVisible();
  await u.screenshot({ path: shot('05-dev-gateway', info.project.name), fullPage: true });
  await u.getByRole('button', { name: 'انصراف / ناموفق' }).click();
  await expect(u.getByText('ناموفق')).toBeVisible();
  await expect(u.getByText(/اشتراکی فعال نشد/)).toBeVisible();

  // Successful attempt: the callback triggers server-side verification.
  await u.goto('/plans');
  await u.getByRole('region', { name: 'پریمیوم ماهانه' }).getByRole('button', { name: 'خرید' }).click();
  await u.getByRole('button', { name: 'پرداخت موفق' }).click();
  await expect(u.getByText('تأییدشده')).toBeVisible();
  await expect(u.getByText('پرداخت روی سرور تأیید شد و اشتراک شما فعال است.')).toBeVisible();
  await u.screenshot({ path: shot('06-payment-verified', info.project.name), fullPage: true });
  await u.goto('/plans');
  await expect(u.getByText('پریمیوم فعال')).toBeVisible();
  await expect(u.getByRole('table', { name: 'سابقه پرداخت' }).getByText('ناموفق')).toBeVisible();
  await u.screenshot({ path: shot('07-plans-active', info.project.name), fullPage: true });
  await u.goto('/ranking');
  await expect(u.getByText(/تحلیل روند هفتگی و مقایسه فصل‌ها بخشی از/)).toHaveCount(0);
  await admin.request.patch(`/api/admin/plans/${monthly.id}`, { data: { active: false, reason: 'پایان آزمون E2E' }, headers: { origin: 'http://127.0.0.1:5173' } });
  await admin.context().close(); await u.context().close();
});
