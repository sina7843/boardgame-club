import { expect, test } from '@playwright/test';
import { player } from './helpers.ts';

// Site onboarding: optional welcome tour, a real-action walkthrough, skip, replay hub and contextual hints.
test('welcome tour, verified profile walkthrough, skip and hints', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const page = await player(browser, info.project.use.viewport ?? null, `Guide${Date.now() % 100000}`);
  const card = page.getByRole('dialog');

  // Dashboard invitation (never forced) → guided tour through every step.
  await page.goto('/');
  await page.getByRole('button', { name: 'شروع گشت' }).click();
  await expect(card.getByRole('heading', { name: 'بازی‌ها' })).toBeVisible();
  while (await card.getByRole('button', { name: 'بعدی' }).isVisible()) await card.getByRole('button', { name: 'بعدی' }).click();
  await card.getByRole('button', { name: 'تمام' }).click();
  await expect(page.getByText('آموزش «آشنایی با باشگاه» کامل شد.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'شروع گشت' })).toHaveCount(0);

  // Walkthrough: the customize step only passes once the profile is really saved (server check).
  await page.goto('/guides');
  await page.getByRole('listitem').filter({ hasText: 'پروفایلتان را شخصی کنید' }).getByRole('button', { name: 'شروع' }).click();
  await card.getByRole('button', { name: 'برو' }).click();
  await expect(page).toHaveURL(/\/me\/profile$/);
  await expect(card.getByRole('heading', { name: 'شخصی‌سازی کنید' })).toBeVisible();
  await card.getByRole('button', { name: 'انجام دادم، بررسی کن' }).click();
  await expect(page.getByText('هنوز انجام نشده است', { exact: false })).toBeVisible();
  await page.getByLabel('معرفی کوتاه').fill('عاشق بازی‌های رومیزی');
  await page.getByRole('button', { name: 'ذخیره شخصی‌سازی' }).click();
  await expect(page.getByText('آموزش «پروفایل شما» کامل شد.')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `test-results/onboarding-${info.project.name}-profile.png` });

  // Skip a guide; the replay hub keeps progress and offers it again.
  await page.goto('/guides');
  const social = page.getByRole('listitem').filter({ hasText: 'درخواست دوستی بدهید' });
  await social.getByRole('button', { name: 'رد کردن' }).click();
  await expect(social.getByText('رد شده')).toBeVisible();
  const profile = page.getByRole('listitem').filter({ hasText: 'پروفایلتان را شخصی کنید' });
  await expect(profile.getByText('کامل', { exact: true })).toBeVisible();
  await expect(profile.getByRole('button', { name: 'اجرای دوباره' })).toBeVisible();
  await page.screenshot({ path: `test-results/onboarding-${info.project.name}-guides.png`, fullPage: true });

  // Contextual hint next to a feature.
  await page.goto('/progress');
  await page.getByRole('button', { name: 'راهنما' }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('مأموریت');
});
