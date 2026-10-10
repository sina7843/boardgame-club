import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «سیرک» end to end: the tutorial (turn the hand over, show, Scout & Show with a flipped card, beat a run with a set)
// and a full three-player game of three rounds with shows, scouts and Scout & Show.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/scout/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: a full round from turning the hand over to emptying it', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/scout');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = async (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۵`))).toBeVisible();
  const show = async (from: number, count: number) => {
    await p.locator('.sc-pick').nth(from).click();
    if (count > 1) await p.locator('.sc-pick').nth(from + count - 1).click();
    await p.getByRole('button', { name: /^نمایش/ }).click();
  };
  await step('۱');
  await p.screenshot({ path: shot(info.project.name, 'tutorial-orient'), fullPage: true });
  await p.getByRole('button', { name: 'برگرداندن دست' }).click();
  await step('۲');
  await show(0, 2);
  await step('۳');
  await p.getByRole('button', { name: 'دیدبانی کارت اول' }).click();
  await p.getByRole('button', { name: /^برگرداندن کارت/ }).click();
  await p.getByLabel('دیدبانی و نمایش').check();
  await p.locator('.sc-gap').nth(2).click();
  await step('۴');
  await show(0, 3);
  await step('۵');
  await show(0, 3);
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: a shown run flies to the ring at once, and undo flies it back to the hand', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/scout');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await p.getByRole('button', { name: 'برگرداندن دست' }).click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۵/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const id = await p.locator('.sc-pick .sc-card').first().getAttribute('data-flip');
  const inHand = p.locator(`.sc__hand [data-flip="${id}"]`);
  const inRing = p.locator(`.sc__ring [data-flip="${id}"]`);
  await p.locator('.sc-pick').nth(0).click();
  await p.locator('.sc-pick').nth(1).click();
  await p.getByRole('button', { name: /^نمایش/ }).click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(inRing).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(inHand).toBeVisible();
  await expect(inRing).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const keep = p.getByRole('button', { name: 'همین‌طور' });
  if (await keep.count()) { await keep.click(); return true; }
  const shows = (await p.locator('.sc__hand--play').getAttribute('data-shows').catch(() => null)) ?? '';
  const ends = p.locator('.sc-end');
  if (await ends.count() && (n % 3 === 2 || !shows)) {
    await ends.first().click();
    await p.locator('.sc-gap').nth(n % (await p.locator('.sc-gap').count())).click();
    return true;
  }
  if (!shows) return false;
  const opts = shows.split(' ').map((x) => x.split(':').map(Number) as [number, number]).sort((a, b) => b[1] - a[1]);
  const [from, count] = opts[0]!;
  await p.locator('.sc-pick').nth(from).click();
  if (count > 1) await p.locator('.sc-pick').nth(from + count - 1).click();
  await p.getByRole('button', { name: /^نمایش/ }).click();
  return true;
}

test('three players play «سیرک» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/scout/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sc__players')).toBeVisible();

  for (let n = 0; n < 500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.sc').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.sc').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 10) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
