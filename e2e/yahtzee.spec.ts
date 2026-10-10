import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «یاتزی» end to end: the tutorial (holds, extra Yahtzee + joker, upper bonus) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/yahtzee/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: holds, an extra Yahtzee with the joker rule and the upper bonus', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/yahtzee');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const steps = ['۱', '۲', '۳', '۴', '۵', '۶', '۷'];
  for (const step of steps) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۷`))).toBeVisible();
    const before = await p.locator('.yz').getAttribute('data-seq');
    // Toggle every hinted die, then the hinted roll button; or pick the hinted box, then confirm.
    while (await p.locator('button.yz-keep.yz-hint').count()) await p.locator('button.yz-keep.yz-hint').first().click();
    if (await p.locator('button.yz-opt.yz-hint').count()) {
      await p.locator('button.yz-opt.yz-hint').click();
      if (step === '۴') await p.screenshot({ path: shot(info.project.name, 'tutorial-joker'), fullPage: true });
      await p.locator('button.yz-submit.yz-hint').click();
    } else {
      await p.locator('button.yz-hint').click();
    }
    if (step !== '۷') await expect.poll(() => p.locator('.yz').getAttribute('data-seq')).not.toBe(before);
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('instant roll: no undo, the dice tumble with hidden pips while the roll is in flight, then the result is thrown as dice', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/yahtzee');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  // The roll is sent at once (no undo window); hold its answer so the in-flight tumble can be seen.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  await motionLog(p);
  const tumbling = p.locator('.yz__felt .bg-tumble');
  await p.locator('button.yz-hint').click();
  await expect(tumbling).toHaveCount(5);
  await expect(p.locator('.yz__felt .bg-roll')).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  expect(await tumbling.locator('circle').evaluateAll((cs) => cs.every((c) => getComputedStyle(c).visibility === 'hidden'))).toBe(true);
  await expect(p.locator('.yz__felt .bg-roll')).toHaveCount(5, { timeout: 10_000 });
  await expect(tumbling).toHaveCount(0);
  await p.waitForTimeout(1500);
  expect((await motionLog(p)).some((x) => x.ghost === 'die')).toBe(true);
  await p.context().close();
});

/** One action for this page if it is its turn: roll (keeping some dice) or write a box. */
async function turn(p: Page, n: number): Promise<boolean> {
  const opts = p.locator('button.yz-opt:not([disabled])');
  const roll = p.getByRole('button', { name: /بریز/ });
  const k = await opts.count();
  const canRoll = await roll.count();
  if (!k && !canRoll) return false;
  if (k && (!canRoll || n % 2 === 0)) {
    await opts.nth(n % k).click();
    await p.locator('button.yz-submit').click();
    return true;
  }
  const dice = p.locator('button.yz-keep:not([disabled])');
  const d = await dice.count();
  if (d) await dice.nth(n % d).click();
  await roll.click();
  return true;
}

test('three players play «یاتزی» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/yahtzee/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.yz__sheet')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.yz').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.yz').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 30) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
