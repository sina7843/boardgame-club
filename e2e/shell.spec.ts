import { expect, test } from '@playwright/test';

const shot = (name: string, project: string) => `docs/evidence/phase-00/${project}-${name}.png`;
// Unique mobile per run/project so the per-mobile resend limit never interferes.
const PROJECT_DIGIT: Record<string, string> = { 'mobile-360': '1', 'tablet-768': '2', 'desktop-1440': '3', 'desktop-1920': '4' };
const mobile = (project: string) => `0915${PROJECT_DIGIT[project] ?? '9'}${String(Date.now()).slice(-6)}`;

test('login → catalog → game detail', async ({ page }, info) => {
  const p = info.project.name;

  await page.goto('/games');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('link', { name: 'ورود' }).or(page.getByRole('button', { name: 'ورود / ثبت‌نام' })).first().click();

  await expect(page.getByRole('heading', { name: 'ورود یا ثبت‌نام' })).toBeVisible();
  await page.screenshot({ path: shot('01-login', p), fullPage: true });
  await page.getByLabel('شماره موبایل').fill(mobile(p));
  await page.getByRole('button', { name: 'دریافت کد' }).click();

  await expect(page.getByText('حالت توسعه: پیامکی ارسال نشد')).toBeVisible();
  await page.getByLabel('کد تأیید').fill('123456');
  await page.screenshot({ path: shot('02-otp', p), fullPage: true });
  await page.getByRole('button', { name: 'ورود', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'خوش آمدید' })).toBeVisible();
  await page.getByLabel('نام نمایشی').fill('مهره‌باز');
  await page.getByRole('button', { name: 'ذخیره و ادامه' }).click();

  // Back to the catalog the user came from, signed in.
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole('heading', { name: 'بازی‌ها', level: 1 })).toBeVisible();
  await expect(page.getByText('۲ بازی')).toBeVisible();
  await page.screenshot({ path: shot('03-catalog', p), fullPage: true });

  // Arabic yeh in the query still finds the Persian name (FR-02).
  await page.getByRole('searchbox', { name: 'جست‌وجو' }).fill('مزايده');
  await expect(page.getByText('۱ بازی')).toBeVisible();
  await page.screenshot({ path: shot('04-search', p), fullPage: true });

  await page.getByRole('link', { name: /مزایده سربسته/ }).click();
  await expect(page.getByRole('heading', { name: 'مزایده سربسته', level: 1 })).toBeVisible();
  await expect(page.getByText('بازی آزمایشی').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'ساخت میز' })).toBeVisible();
  await page.screenshot({ path: shot('05-detail', p), fullPage: true });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'سلام، مهره‌باز' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'نوبت من' })).toBeVisible();
  await page.screenshot({ path: shot('06-dashboard', p), fullPage: true });

  await page.goto('/settings');
  await page.getByText('روشن', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: shot('07-settings-light', p), fullPage: true });
  await page.getByText('تیره', { exact: true }).click();

  await page.goto('/admin');
  await expect(page.getByText('دسترسی ندارید')).toBeVisible();
});

test('component showcase renders', async ({ page }, info) => {
  await page.goto('/design');
  await expect(page.getByRole('heading', { name: 'اجزای طراحی' })).toBeVisible();
  await page.screenshot({ path: shot('08-showcase', info.project.name), fullPage: true });
});
