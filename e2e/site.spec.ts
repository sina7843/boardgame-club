import { expect, test } from '@playwright/test';
import { signIn } from './helpers.ts';

test('site pages from the footer, terms accepted at sign-up, account deleted from settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'اطلاعات سایت' }).getByRole('link', { name: 'قوانین و مقررات' }).click();
  await expect(page.getByRole('heading', { name: 'قوانین و مقررات', level: 1 })).toBeVisible();
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: /@/ })).toBeVisible();

  await signIn(page, 'حذف‌شونده'); // accepts the terms dialog
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'قوانین و حریم خصوصی' })).toHaveCount(0);

  await page.goto('/settings');
  await page.getByRole('button', { name: 'حذف حساب' }).click();
  const dialog = page.getByRole('dialog', { name: 'حذف همیشگی حساب' });
  await expect(dialog.getByRole('button', { name: 'حذف همیشگی' })).toBeDisabled();
  await dialog.getByLabel('برای تأیید، کلمهٔ «حذف» را بنویسید').fill('حذف');
  await dialog.getByRole('button', { name: 'حذف همیشگی' }).click();
  await expect(page.getByText('حساب شما حذف شد.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ورود' }).first()).toBeVisible();
});
