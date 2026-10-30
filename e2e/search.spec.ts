import { expect, test } from '@playwright/test';

test('header search closes on an outside click; Enter opens the match (desktop) and the phone keyboard key works too', async ({ page }, info) => {
  const phone = (info.project.use.viewport?.width ?? 1440) < 900;
  if (phone) {
    await page.goto('/search');
    await page.getByRole('combobox').fill('آزول');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/games(\/azul$|\?q=)/); // one match opens it; otherwise the filtered games page
    await page.goto('/search');
    await page.getByRole('button', { name: 'بستن جست‌وجو' }).click();
    await expect(page).toHaveURL(/\/$/); // opened directly: closing goes home, not off the site
    return;
  }
  await page.goto('/');
  const box = page.locator('.bgv-siteheader');
  await box.getByRole('combobox').click();
  await expect(box.locator('.bgv-sitesearch__pop')).toBeVisible();
  await page.locator('main').click({ position: { x: 20, y: 300 } });
  await expect(box.locator('.bgv-sitesearch__pop')).toBeHidden();
  await box.getByRole('combobox').fill('آزول');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games(\/azul$|\?q=)/); // one match opens it; otherwise the filtered games page
  await expect(box.locator('.bgv-sitesearch__pop')).toBeHidden();
});
