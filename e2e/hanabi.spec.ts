import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «آتش‌بازی» end to end: the tutorial (clues, plays, a discard and the final round) and a full three-player cooperative game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/hanabi/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: colour and number clues, play, discard, final round', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/hanabi');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۶`))).toBeVisible();
  const clue = async () => { await p.locator('.hb .hb-clueBtn.hb-hint').click(); await p.locator('.hb .hb-cl.hb-hint').click(); };
  const play = async () => { await p.locator('.hb .hb-mine.hb-hint').click(); await p.getByRole('button', { name: 'بازی', exact: true }).click(); };
  await step('۱'); await clue();
  await step('۲'); await play();
  await step('۳'); await play();
  await step('۴');
  await p.locator('.hb .hb-clueBtn.hb-hint').click();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-clue'), fullPage: true });
  await p.locator('.hb .hb-cl.hb-hint').click();
  await step('۵');
  await p.getByRole('button', { name: 'کارت ۱ شما' }).click();
  await p.getByRole('button', { name: 'دور انداختن' }).click();
  await step('۶'); await play();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const mine = p.locator('.hb .hb-mine:not([disabled])');
  if (!(await mine.count())) return false;
  const clue = p.locator('.hb .hb-clueBtn');
  if (n % 3 === 0 && await clue.count()) { await clue.first().click(); await p.locator('.hb .hb-cl').first().click(); return true; }
  await mine.first().click();
  const discard = p.getByRole('button', { name: 'دور انداختن' });
  if (n % 3 === 1 && await discard.isEnabled()) await discard.click(); else await p.getByRole('button', { name: 'بازی', exact: true }).click();
  return true;
}

test('three players play «آتش‌بازی» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/hanabi/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.hb__sky')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.hb').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.hb').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 7) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: my played card leaves the hand face down at once, undo brings it back, then it lands on its firework', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/hanabi');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۶/)).toBeVisible();
  await p.locator('.hb .hb-clueBtn.hb-hint').click(); await p.locator('.hb .hb-cl.hb-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۶/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const hand = p.locator('.hb .hb__hand .hb-mine'), pending = p.locator('.hb .hb__pending .hb-mine--pending');
  const n = await hand.count();
  const play = async () => { await p.locator('.hb .hb-mine.hb-hint').click(); await p.getByRole('button', { name: 'بازی', exact: true }).click(); };
  await motionLog(p);
  await play();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(pending).toBeVisible();
  await expect(hand).toHaveCount(n - 1);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(pending).toHaveCount(0);
  await expect(hand).toHaveCount(n);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await play();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۶/)).toBeVisible({ timeout: 10_000 });
  await expect(pending).toHaveCount(0);
  await expect(hand).toHaveCount(n);
  await p.context().close();
});
