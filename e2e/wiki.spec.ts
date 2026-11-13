import { expect, test } from '@playwright/test';

test('encyclopedia: list, filter by mechanic, open a game entry', async ({ page }, info) => {
  await page.goto('/wiki');
  await expect(page.getByRole('heading', { name: 'دانشنامهٔ بازی‌ها', level: 1 })).toBeVisible();
  // Eight entries at first (Wiki-Desktop), then «نمایش ۸ بازی دیگر».
  await expect(page.getByRole('main').locator('.bgv-gamecard')).toHaveCount(8);
  await expect(page.getByRole('button', { name: /نمایش ۸ بازی دیگر/ })).toBeVisible();

  await page.getByLabel('سازوکار').selectOption({ label: 'مبادله' });
  await expect(page.getByRole('main').getByRole('link', { name: /کاتان/ })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /شطرنج/ })).toHaveCount(0);
  await page.screenshot({ path: `docs/evidence/site/wiki/${info.project.name}-list.png`, fullPage: true });

  // DS v2.4.3: every game image is its box (img.bgv-box), no painted cover.
  const box = page.getByRole('main').getByRole('link', { name: /کاتان/ }).locator('img.bgv-box');
  await expect(box).toHaveAttribute('src', '/covers/box/catan.webp');
  await expect.poll(() => box.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  // DS v2.4: the game page carries no BoardGameGeek data; the entry opens on the encyclopedia page itself.
  await page.getByRole('main').getByRole('link', { name: /کاتان/ }).click();
  await expect(page).toHaveURL(/\/wiki\?game=catan$/);
  const wiki = page.locator('#wiki');
  await expect(wiki.getByRole('heading', { name: 'دانشنامه' })).toBeVisible();
  await expect(wiki.getByText('Klaus Teuber')).toBeVisible();
  await expect(wiki.getByRole('link', { name: 'BoardGameGeek' })).toHaveAttribute('href', 'https://boardgamegeek.com/boardgame/13');
  await wiki.screenshot({ path: `docs/evidence/site/wiki/${info.project.name}-catan.png` });

  // Mechanic chips link back into the filtered encyclopedia.
  await wiki.getByRole('link', { name: 'مبادله' }).click();
  await expect(page).toHaveURL(/\/wiki\?mechanic=2008$/);
});
