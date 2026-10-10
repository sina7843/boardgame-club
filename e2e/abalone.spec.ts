import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «آبالون» end to end: tutorial (sumito pushes, a broadside step, the sixth marble off) and two players exchanging moves through
// the board (select marbles, tap an arrow); the game is resigned after a while since a full game is long.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/abalone/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: sumito 2-1 off the edge, broadside, 3-2 push, the sixth off', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/abalone');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    // Steps move two or three marbles: tap every highlighted marble, then the highlighted arrow.
    for (let k = 0; k < 3 && (await p.locator('.abl-cell--hint').count()); k++) await p.locator('.abl-cell--hint').first().click();
    await p.locator('.abl-arrow--hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: the moved marbles slide at once, and undo slides them back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/abalone');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const boxes = () => p.locator('.abl-m[data-flip]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(), o = e.ownerSVGElement!.getBoundingClientRect(); return `${e.getAttribute('data-flip')}@${Math.round(r.x - o.x)},${Math.round(r.y - o.y)}`; }).sort().join(' '));
  const before = await boxes();
  for (let k = 0; k < 3 && (await p.locator('.abl-cell--hint').count()); k++) await p.locator('.abl-cell--hint').first().click();
  await motionLog(p);
  await p.locator('.abl-arrow--hint').click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await p.waitForTimeout(900);
  expect(await boxes()).not.toBe(before);
  expect((await motionLog(p)).some((m) => m.flip && !m.ghost)).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await p.waitForTimeout(900);
  expect(await boxes()).toBe(before);
  expect((await motionLog(p)).some((m) => m.flip && !m.ghost)).toBe(true);
  await p.context().close();
});

test('two players exchange moves and pushes, then one resigns', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/abalone/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.abl-board')).toBeVisible();

  for (let n = 0; n < 24; n++) {
    let acted = false;
    for (const p of pages) {
      const mine = p.locator('.abl-cell--mine');
      if (!(await mine.count())) continue;
      const before = await p.locator('.abl').getAttribute('data-ply');
      // Select a marble (and sometimes its neighbour), then take the first offered arrow.
      for (let tries = 0; tries < 6; tries++) {
        await mine.nth((n * 5 + tries * 3) % (await mine.count())).click();
        if (await p.locator('.abl-arrow').count()) break;
      }
      await p.locator('.abl-arrow').first().click();
      await expect.poll(() => p.locator('.abl').getAttribute('data-ply'), { timeout: 10_000 }).not.toBe(before);
      if (n === 10) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  // Resign lives in the players-and-rules drawer.
  const resign = guest.getByRole('button', { name: 'انصراف از بازی' });
  if (!(await resign.first().isVisible())) await guest.getByRole('button', { name: 'بازیکنان و قوانین' }).click();
  await resign.filter({ visible: true }).first().click();
  await guest.getByRole('button', { name: 'انصراف قطعی' }).click();
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
