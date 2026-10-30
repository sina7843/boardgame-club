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
