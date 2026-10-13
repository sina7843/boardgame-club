import { expect, test } from '@playwright/test';

test('encyclopedia: list, filter by mechanic, open a game entry', async ({ page }, info) => {
  await page.goto('/wiki');
  await expect(page.getByRole('heading', { name: 'دانشنامهٔ بازی‌ها', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /کاتان/ })).toBeVisible();

  await page.getByLabel('سازوکار').selectOption({ label: 'مبادله' });
  await expect(page.getByRole('link', { name: /کاتان/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /شطرنج/ })).toHaveCount(0);
  await page.screenshot({ path: `docs/evidence/site/wiki/${info.project.name}-list.png`, fullPage: true });

  // Painted cover at rest; the BGG box photo fades in on hover (pointer devices only).
  if (!info.project.use.hasTouch) {
    const box = page.getByRole('link', { name: /کاتان/ }).locator('.game-cover--box');
    await expect(box).toHaveCSS('opacity', '0');
    await page.getByRole('link', { name: /کاتان/ }).hover();
    await expect(box).toHaveCSS('opacity', '1');
    expect(await box.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  }

  await page.getByRole('link', { name: /کاتان/ }).click();
  await expect(page).toHaveURL(/\/games\/catan#wiki$/);
  // Game page cover flips by tap too, for touch screens.
  const flip = page.getByRole('button', { name: 'نمایش جعبهٔ اصلی بازی' });
  await flip.click();
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await expect(flip.locator('.game-cover--box')).toHaveCSS('opacity', '1');
  await flip.screenshot({ path: `docs/evidence/site/wiki/${info.project.name}-box.png` });
  const wiki = page.locator('#wiki');
  await expect(wiki.getByRole('heading', { name: 'دانشنامه' })).toBeVisible();
  await expect(wiki.getByText('Klaus Teuber')).toBeVisible();
  await expect(wiki.getByRole('link', { name: 'BoardGameGeek' })).toHaveAttribute('href', 'https://boardgamegeek.com/boardgame/13');
  await wiki.screenshot({ path: `docs/evidence/site/wiki/${info.project.name}-catan.png` });

  // Mechanic chips link back into the filtered encyclopedia.
  await wiki.getByRole('link', { name: 'مبادله' }).click();
  await expect(page).toHaveURL(/\/wiki\?mechanic=2008$/);
});
