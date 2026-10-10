import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «کندو» end to end: tutorial (spider, grasshopper, placement, beetle and ant trap the queen) and two players placing and moving bugs
// through the reserve and the board; the game is resigned after a while since a full game is long.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/hive/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: spider, grasshopper, placement, beetle, ant trap the queen', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/hive');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`))).toBeVisible();
    if (step !== '۳') await p.locator('.hv-cell--hint').click(); // step 3 places a new ant; the others move a piece
    // Step 4: the beetle climbs onto an occupied cell, whose piece is drawn over the target ring.
    await p.locator('.hv-target--hint').click({ force: step === '۴' });
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const reserve = p.locator('.hv-reserve:not(.hv-reserve--small) button.hv-reserve__item:not([disabled])');
  const mine = p.locator('.hv-cell--mine');
  if (!(await reserve.count()) && !(await mine.count())) return false;
  if (await mine.count() && n % 3 === 2) {
    for (let k = 0; k < (await mine.count()); k++) {
      await mine.nth((n + k) % (await mine.count())).click();
      if (await p.locator('.hv-target').count()) { await p.locator('.hv-target').nth(n % (await p.locator('.hv-target').count())).click(); return true; }
    }
  }
  if (!(await reserve.count())) return false;
  await reserve.nth(n % (await reserve.count())).click();
  const spots = p.locator('.hv-target');
  if (!(await spots.count())) return false;
  await spots.nth(n % (await spots.count())).click();
  return true;
}

test('two players place and move bugs, then one resigns', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/hive/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.hv-board')).toBeVisible();

  for (let n = 0; n < 16; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.hv').getAttribute('data-turn');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.hv').getAttribute('data-turn'), { timeout: 10_000 }).not.toBe(before);
      if (n === 10) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  if (!(await host.getByRole('heading', { name: RESULT }).count())) {
    const resign = guest.getByRole('button', { name: 'انصراف از بازی' });
    if (!(await resign.first().isVisible())) await guest.getByRole('button', { name: 'بازیکنان و قوانین' }).click();
    await resign.filter({ visible: true }).first().click();
    await guest.getByRole('button', { name: 'انصراف قطعی' }).click();
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

// The undo window is re-armed before each move: a dev-server reload re-runs the init script that sets it to 0.
const slow = (p: Page) => p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));

test('undo window: a moved bug glides to its target at once, and undo glides it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/hive');
  await slow(p);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۵/)).toBeVisible({ timeout: 25_000 });
  await p.waitForTimeout(800);
  const id = await p.locator('.hv-cell--hint [data-flip]').getAttribute('data-flip');
  const bug = p.locator(`.hv-board [data-flip="${id}"]`);
  // Measured against the board (the page may scroll when the undo bar comes and goes).
  const at = async () => { const b = (await bug.boundingBox())!, o = (await p.locator('.hv-board').boundingBox())!; return { x: b.x + b.width / 2 - o.x, y: b.y + b.height / 2 - o.y }; };
  const away = async (o: { x: number; y: number }) => { const n = await at(); return Math.hypot(n.x - o.x, n.y - o.y); };
  await slow(p);
  await p.locator('.hv-cell--hint').click(); // selecting lights the targets, which refits the view
  await p.waitForTimeout(300);
  const start = await at();
  await motionLog(p);
  await slow(p);
  await p.locator('.hv-target--hint').click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await p.waitForTimeout(1000);
  expect(await away(start)).toBeGreaterThan(20);
  expect((await motionLog(p)).some((m) => m.flip === id)).toBe(true);
  await undo.click();
  await p.waitForTimeout(1000);
  expect(await away(start)).toBeLessThan(3);
  expect((await motionLog(p)).some((m) => m.flip === id)).toBe(true);
  await p.context().close();
});
