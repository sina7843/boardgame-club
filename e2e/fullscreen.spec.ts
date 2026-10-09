import { expect, test } from '@playwright/test';
import { player } from './helpers.ts';

// The table's full-screen button with and without the Fullscreen API (iPhone Safari has none): the whole game goes full
// screen (or fills the window), the board is brought into view, and the board has no separate full-screen button.
for (const mode of ['native', 'no-api'] as const) {
  test(`fullscreen ${mode}`, async ({ browser }, info) => {
    test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name));
    const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
    if (mode === 'no-api') await p.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined }); });
    await p.goto('/games/catan');
    await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
    await expect(p.locator('.zb')).toBeVisible();
    await expect(p.locator('.zb__controls').getByRole('button', { name: /تمام‌صفحه/ })).toHaveCount(0);
    await p.getByRole('button', { name: 'تمام‌صفحه', exact: true }).click();
    if (mode === 'native') await expect.poll(() => p.evaluate(() => document.fullscreenElement?.classList.contains('game') ?? false)).toBe(true);
    else await expect(p.locator('.game.game--max')).toBeVisible();
    await expect(p.locator('.zb svg').first()).toBeInViewport();
    await p.screenshot({ path: `docs/evidence/fullscreen/${info.project.name}-${mode}.png` });
    await p.getByRole('button', { name: 'خروج از تمام‌صفحه' }).click();
    if (mode === 'native') await expect.poll(() => p.evaluate(() => document.fullscreenElement)).toBeNull();
    else await expect(p.locator('.game--max')).toHaveCount(0);
    await p.context().close();
  });
}
