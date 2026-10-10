import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «نبرد ستاره‌ها» end to end: the tutorial (buy, end turn, allies, outpost, scrap, final strike) and a full two-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/star-realms/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: buy, end turn, allies, outpost, scrap, final strike', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/star-realms');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const game = p.locator('.sr');
  // Steps the renderer highlights use .sr-hint; buy, end turn and scrap use their own controls.
  const clicks = [
    game.locator('.sr-hint'),
    game.locator('.sr-row .sr-pick--can').first(),
    game.locator('.sr-bar').getByRole('button', { name: 'پایان نوبت' }),
    game.locator('.sr-hint'),
    game.locator('.sr-hint'),
    game.locator('.sr-hint'),
    game.locator('.sr-side--me .sr-bases .sr-mini'),
    game.locator('.sr-hint')
  ];
  const fa = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];
  for (const [i, target] of clicks.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${fa[i]} از ۸`))).toBeVisible();
    if (i === 5) await p.screenshot({ path: shot(info.project.name, 'tutorial-outpost'), fullPage: true });
    await target.first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.sr');
  const end = game.locator('.sr-bar').getByRole('button', { name: 'پایان نوبت' });
  const drop = game.locator('.sr-hand .sr-pick--drop:not([disabled])');
  if (await drop.count()) { await drop.first().click(); return true; }
  if (!(await end.count())) return false;
  const all = game.getByRole('button', { name: 'بازی همه' });
  if (await all.count()) { await all.click(); return true; }
  const base = game.locator('.sr-pick--atk:not([disabled])');
  if (await base.count()) { await base.first().click(); return true; }
  const hit = game.getByRole('button', { name: /^حمله \(/ });
  if (await hit.count()) { await hit.click(); return true; }
  const buy = game.locator('.sr-row .sr-pick--can:not([disabled])');
  const k = await buy.count();
  if (k) { await buy.nth(n % k).click(); return true; }
  await end.click();
  return true;
}

test('two players play «نبرد ستاره‌ها» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/star-realms/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite); await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sr-row')).toBeVisible();

  for (let n = 0; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.sr').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.sr').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 2 || n === 30) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `${n === 2 ? 'draft' : 'mid'}-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: played cards fly from the hand to the fleet at once, and undo flies them back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/star-realms');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۸/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const hand = p.locator('.sr-hand [data-flip]');
  const fleet = p.locator('.sr-fleet [data-flip]');
  const n = await hand.count();
  expect(n).toBeGreaterThan(0);
  await p.locator('.sr .sr-hint').click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(fleet).toHaveCount(n);
  await expect(hand).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(hand).toHaveCount(n);
  await expect(fleet).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
