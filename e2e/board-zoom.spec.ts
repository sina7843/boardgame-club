import { expect, test } from '@playwright/test';
import { player } from './helpers.ts';

// Board zoom and phone landscape: the Catan tutorial (single player) on a phone held sideways. The island must fit
// the screen height, zoom in/out with the buttons, pan without triggering a move, and a tap on a target still works.
test.describe.configure({ timeout: 120_000 });

test('catan board zooms, pans and fits a landscape phone', async ({ browser }, info) => {
  test.skip(info.project.name !== 'mobile-360', 'one landscape run is enough');
  const p = await player(browser, { width: 780, height: 360 }, 'افقی');
  await p.goto('/games/catan');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const board = p.locator('.ct-board');
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(360);
  await p.screenshot({ path: `docs/evidence/catan/landscape-780x360.png` });

  const zoomed = p.locator('.zb--zoomed');
  await expect(zoomed).toHaveCount(0);
  const zoomIn = p.getByRole('button', { name: 'بزرگ‌نمایی', exact: true });
  await zoomIn.click();
  await expect(zoomed).toHaveCount(1);
  await zoomIn.click();
  await expect.poll(async () => (await board.boundingBox())!.width).toBeGreaterThan(box!.width * 1.8);

  // Drag pans the board and does not trigger a click on whatever is under the finger.
  const vp = (await p.locator('.zb__viewport').boundingBox())!;
  const before = await p.locator('.zb__content').getAttribute('style');
  await p.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2);
  await p.mouse.down();
  await p.mouse.move(vp.x + vp.width / 2 - 80, vp.y + vp.height / 2 - 40, { steps: 6 });
  await p.mouse.up();
  expect(await p.locator('.zb__content').getAttribute('style')).not.toBe(before);
  await p.screenshot({ path: `docs/evidence/catan/landscape-zoomed.png` });

  await p.getByRole('button', { name: 'اندازه اصلی' }).click();
  await expect(zoomed).toHaveCount(0);
  // The tutorial's first step still works after zooming: roll the dice.
  await p.getByRole('button', { name: 'ریختن تاس' }).click();
  await expect(p.locator('.ct-log')).toContainText('تاس ریخت');
  await p.context().close();
});
