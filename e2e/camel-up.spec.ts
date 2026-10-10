import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «مسابقهٔ شترها» end to end: the tutorial (leg bet, overall bet, oasis, last die) and a full three-player race.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/camel-up/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: leg bet, overall bet, oasis, the last pyramid die', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/camel-up');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.locator('.cu-legtile.cu-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۴/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-bet'), fullPage: true });
  await p.locator('.cu-ov .cu-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۴/)).toBeVisible();
  // The desert tile has no hint class: choose the oasis, then space 14.
  await p.getByRole('button', { name: 'واحه +۱' }).click();
  await p.getByRole('button', { name: 'گذاشتن کاشی روی خانهٔ ۱۴' }).click();
  await expect(p.getByText(/آموزش: مرحله ۴ از ۴/)).toBeVisible();
  await p.locator('.cu-rollbtn.cu-hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const roll = p.getByRole('button', { name: /^تاس از هرم/ });
  if (!(await roll.count())) return false;
  const legs = p.locator('.cu-legtile:not([disabled])');
  if (n % 4 === 1 && await legs.count()) { await legs.nth(n % (await legs.count())).click(); return true; }
  if (n % 7 === 3) { const ov = p.locator('.cu-ov button'); if (await ov.count()) { await ov.nth(n % (await ov.count())).click(); return true; } }
  if (n % 9 === 5) {
    await p.getByRole('button', { name: 'واحه +۱' }).click();
    const sp = p.locator('.cu-sp--can');
    if (await sp.count()) { await sp.last().click(); return true; }
  }
  await roll.click();
  return true;
}

test('three players race «مسابقهٔ شترها» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/camel-up/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cu__track')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cu').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.cu').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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

test('undo window: a leg bet flies to your bets at once and back on undo; an instant pyramid roll (no undo) tumbles without pips while in flight, then the result is thrown', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/camel-up');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const chip = p.locator('.cu-pl--me .cu-chip');
  await p.locator('.cu-legtile.cu-hint').click();
  await expect(undo).toBeVisible();
  await expect(chip).toHaveCount(1);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(chip).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  // Through the tutorial with the window on: bet, overall bet, oasis, then the pyramid die.
  await p.locator('.cu-legtile.cu-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۴/)).toBeVisible({ timeout: 10_000 });
  await p.locator('.cu-ov .cu-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۴/)).toBeVisible({ timeout: 10_000 });
  await p.getByRole('button', { name: 'واحه +۱' }).click();
  await p.getByRole('button', { name: 'گذاشتن کاشی روی خانهٔ ۱۴' }).click();
  await expect(p.locator('[data-sp="14"] .cu-tile--oasis')).toBeVisible();
  await expect(p.getByText(/آموزش: مرحله ۴ از ۴/)).toBeVisible({ timeout: 10_000 });
  await p.waitForTimeout(2500);
  // The roll is sent at once despite the window; hold its answer so the in-flight tumble can be seen.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  await motionLog(p);
  await p.locator('.cu-rollbtn.cu-hint').click();
  const pending = p.locator('.cu-die--pending.bg-tumble');
  await expect(pending).toBeVisible();
  await expect(pending.locator('circle')).toHaveCount(0);
  await expect(undo).toHaveCount(0);
  await expect(pending).toHaveCount(0, { timeout: 10_000 });
  await p.waitForTimeout(2500);
  const log = await motionLog(p);
  expect(log.some((m) => m.ghost === 'die')).toBe(true);
  expect(log.some((m) => m.cls.includes('cu-camel'))).toBe(true);
  await p.context().close();
});
