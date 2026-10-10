import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «غول‌های شهر» end to end: the tutorial (roll, keep, resolve, Tokyo, sweep, buy the winning card) and a full three-player brawl.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/king-of-tokyo/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: roll, keep and reroll, resolve, enter Tokyo, sweep, buy', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/king-of-tokyo');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`))).toBeVisible();
    if (step === '۲') for (const i of [0, 1, 2]) await p.locator('.kt button.kt-keep').nth(i).click(); // keep the claw and both 3s
    if (step === '۴') { await p.getByRole('button', { name: /^کارت‌های تازه/ }).click(); continue; } // the sweep button has no hint
    if (step === '۵') await p.screenshot({ path: shot(info.project.name, 'tutorial-buy'), fullPage: true });
    await p.locator('.kt button.kt-hint').first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const stay = p.getByRole('button', { name: 'می‌مانم' });
  if (await stay.count()) { await (n % 4 ? stay : p.getByRole('button', { name: /^از شهر بیرون/ })).click(); return true; }
  const roll = p.getByRole('button', { name: /^(بریز|دوباره بریز)/ });
  const resolve = p.getByRole('button', { name: 'همین‌ها' });
  if (await resolve.count()) { await resolve.click(); return true; }
  if (await roll.count()) { await roll.click(); return true; }
  const buy = p.locator('.kt .kt-buy:not([disabled])');
  if (await buy.count()) { await buy.first().click(); return true; }
  const end = p.locator('.kt__bar').getByRole('button', { name: 'پایان نوبت' });
  if (await end.count()) { await end.click(); return true; }
  return false;
}

test('three monsters play «غول‌های شهر» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/king-of-tokyo/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.kt__arena')).toBeVisible();

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.kt').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.kt').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 18) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('instant roll: no undo, the dice tumble with no faces while the roll is in flight, then the result is thrown as dice', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/king-of-tokyo');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  // The roll is sent at once (no undo window); hold its answer so the in-flight tumble can be seen.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  await motionLog(p);
  const roll = p.locator('.kt button.kt-hint').first();
  const tumbling = p.locator('.kt__dice .bg-tumble');
  await roll.click();
  await expect(tumbling).toHaveCount(6);
  await expect(p.locator('.kt__dice .bg-roll')).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  // No value before the server rolls: every glyph is hidden and no face colour is shown.
  expect(await tumbling.locator('[data-pip]').evaluateAll((gs) => gs.every((g) => getComputedStyle(g).visibility === 'hidden'))).toBe(true);
  expect(await tumbling.evaluateAll((ds) => ds.every((d) => !/kt-f--/.test(d.className)))).toBe(true);
  await expect(p.locator('.kt__dice .bg-roll')).toHaveCount(6, { timeout: 10_000 });
  await expect(tumbling).toHaveCount(0);
  await p.waitForTimeout(1200);
  expect((await motionLog(p)).some((x) => x.ghost === 'die')).toBe(true);
  await p.context().close();
});
