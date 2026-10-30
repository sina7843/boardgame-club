import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// Admin «میزها»: every table with its status; a table the admin just made shows up under «در انتظار بازیکن».
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
const grant = (mobile: string, role: string) => execFileSync('node', ['packages/db/src/grant-role.ts', mobile, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });

test.describe.configure({ timeout: 90_000 });
test('admin sees all tables with their status and filters them', async ({ browser }, info) => {
  const admin = await newPage(browser, info.project.use.viewport ?? null);
  const name = `مدیر میز ${Math.random().toString(36).slice(2, 6)}`;
  grant(await signIn(admin, name), 'admin');
  await admin.goto('/games/line-three/new');
  await admin.getByRole('button', { name: 'ساخت میز' }).first().click();
  await expect(admin.getByRole('textbox', { name: 'لینک دعوت' })).toBeVisible();

  await admin.goto('/admin?tab=tables');
  const list = admin.locator('.ac-tbllist');
  await admin.getByRole('searchbox', { name: 'جست‌وجوی بازیکن' }).fill(name);
  await admin.keyboard.press('Enter');
  const row = list.locator('.ac-tblrow').first();
  await expect(row).toContainText('در انتظار بازیکن');
  await expect(row).toContainText(name);
  await admin.getByRole('button', { name: /^تمام‌شده/ }).click();
  await expect(admin.getByText('میزی پیدا نشد')).toBeVisible();
  await admin.screenshot({ path: `test-results/admin-tables-${info.project.name}.png`, fullPage: true });
});

test('admin watches a private table silently: the players see no spectator', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'one width is enough for the access check');
  const vp = info.project.use.viewport ?? null;
  const a = await newPage(browser, vp); await signIn(a, `میزبان ${Math.random().toString(36).slice(2, 6)}`);
  const b = await newPage(browser, vp); await signIn(b, `مهمان ${Math.random().toString(36).slice(2, 6)}`);
  await a.goto('/games/line-three/new');
  await a.getByRole('button', { name: 'ساخت میز' }).first().click();
  const invite = (await a.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await b.goto(invite);
  await b.getByRole('button', { name: 'پیوستن به میز' }).click();
  await a.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(a.locator('.lt__board')).toBeVisible();
  const tableUrl = new URL(a.url()).pathname;

  const admin = await newPage(browser, vp);
  grant(await signIn(admin, `مدیر ناظر ${Math.random().toString(36).slice(2, 6)}`), 'admin');
  await admin.goto(tableUrl);
  await expect(admin.locator('.lt__board')).toBeVisible();
  await expect(admin.getByText('شما تماشاگرید')).toBeVisible();
  await a.reload();
  await expect(a.locator('.lt__board')).toBeVisible();
  await expect(a.getByText(/تماشاگر/)).toHaveCount(0);
});
