import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «کریپتید» end to end: the two-player teaching tutorial through the highlighted hints, and a full three-player game
// (opening cubes, searches, refutations and penalty cubes through the real UI: choose → cell → «ثبت») to the result.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/cryptid/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: question, forced cube, refuted search, yes answer, successful search', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/cryptid');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText('در فاصلهٔ ۱ خانه از جنگل', { exact: true })).toBeVisible();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`))).toBeVisible();
    const mode = p.locator('button.cr-mode.cr-hint');
    if (await mode.count()) await mode.click();
    const target = p.locator('button.cr-target.cr-hint');
    if (await target.count()) await target.click();
    await p.locator('.cr-cell.cr-hint').click();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-ask'), fullPage: true });
    await p.locator('button.cr-confirm.cr-hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: the cube is on the map at once, and undo takes it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await p.goto('/games/cryptid');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  // Step 1 (a question: its answer comes from the opponent's secret clue, so nothing is previewed) is sent at once.
  await expect(p.getByText(/آموزش: مرحله ۱ از ۶/)).toBeVisible();
  await p.locator('button.cr-mode.cr-hint').click();
  await p.locator('.cr-cell.cr-hint').click();
  await p.locator('button.cr-confirm.cr-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۶/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const cell = p.locator('.cr-cell.cr-hint');
  const label = await cell.getAttribute('aria-label');
  await cell.click();
  await p.locator('button.cr-confirm.cr-hint').click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  const placed = p.locator(`.cr-cell[aria-label="${label}، مکعب شما"]`);
  await expect(placed).toHaveCount(1);
  await expect(placed.locator('g.cr-pop .cr-cube')).toHaveCount(1);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(placed).toHaveCount(0);
  await expect(p.locator(`.cr-cell[aria-label="${label}"] .cr-cube`)).toHaveCount(0);
  await p.context().close();
});

/** One move for this page if it is their turn: an owed cube, otherwise a search. */
async function turn(p: Page, n: number): Promise<boolean> {
  const searchBtn = p.getByRole('button', { name: 'جست‌وجو', exact: true });
  const owesCube = await p.getByText('خانهٔ مکعب را روی نقشه انتخاب کنید.').count();
  if (!owesCube) {
    if (!(await searchBtn.count()) || await searchBtn.isDisabled()) return false;
    await searchBtn.click();
  }
  const cells = p.locator('.cr-cell.cr-target-cell');
  const k = await cells.count();
  if (!k) return false;
  // Keyboard pick (the cells are focusable buttons): robust against the zoom controls overlaying the map corner.
  await cells.nth((n * 7) % k).focus();
  await p.keyboard.press('Enter');
  await p.locator('button.cr-confirm').click();
  return true;
}

test('three players play «کریپتید» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/cryptid/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cr-board')).toBeVisible();
  for (const p of pages) await expect(p.getByRole('region', { name: 'سرنخ مخفی شما' })).toBeVisible();
  // Structure colour is not told by hue alone: green (▲) and blue (●) stone + shack carry a shape mark (standard mode: 4).
  await expect(host.locator('.cr-board .cr-mark')).toHaveCount(4);

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cr').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.cr').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
