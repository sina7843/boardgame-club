import { expect, test, type Page, type Route } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «پایگاه فضایی» end to end: the tutorial (roll, sum, buy) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'space-base';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: roll, sum, buy', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`));
    await expect(label).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-choose'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.sb .sb-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.sb .sb-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page): Promise<boolean> {
  const game = p.locator('.sb');
  const roll = game.getByRole('button', { name: 'ریختن تاس‌ها' });
  if (await roll.count()) { await roll.click(); return true; }
  const choose = game.locator('.sb-console').getByRole('button', { name: /^بخش/ });
  if (await choose.count()) { await choose.last().click(); return true; }
  const pass = game.getByRole('button', { name: 'پایان نوبت بدون خرید' });
  if (!(await pass.count())) return false;
  const buy = game.locator('.sb-pick--can:not([disabled])');
  if (await buy.count()) { await buy.last().click(); return true; }
  await pass.click();
  return true;
}

test('three players play to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto(`/games/${GAME}/new`);
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sb-console')).toBeVisible();

  for (let n = 0; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.sb').getAttribute('data-seq');
      if (!(await turn(p))) continue;
      await expect.poll(() => p.locator('.sb').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 40) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

// The undo window is re-armed before each move: a dev-server reload re-runs the init script that sets it to 0.
const slow = (p: Page) => p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));

test('instant roll (no undo) tumbles with no pips while in flight, the result is thrown, and a bought ship flies to its bay at once in its undo window', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto(`/games/${GAME}`);
  await slow(p);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible({ timeout: 25_000 });
  await p.waitForTimeout(800);
  await motionLog(p);
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const tumbling = p.locator('.sb-dice .bg-tumble');
  const hint = p.locator('.sb .sb-hint:not([disabled])').first();
  // The roll is sent at once despite the window; hold its answer so the in-flight tumble can be seen.
  const delay = async (route: Route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); };
  await p.route('**/api/tables/*/commands', delay);
  await slow(p);
  await hint.click();
  await expect(tumbling).toHaveCount(2);
  await expect(undo).toHaveCount(0);
  expect(await tumbling.locator('[data-pip]').evaluateAll((ps) => ps.every((x) => getComputedStyle(x).visibility === 'hidden'))).toBe(true);
  await expect(p.getByText(/آموزش: مرحله ۲ از ۳/)).toBeVisible({ timeout: 25_000 });
  await expect(tumbling).toHaveCount(0);
  await expect(p.locator('.sb-dice .bg-roll')).toHaveCount(2);
  await p.waitForTimeout(1200);
  expect((await motionLog(p)).some((m) => m.ghost === 'die')).toBe(true);
  await p.unroute('**/api/tables/*/commands', delay);
  await slow(p);
  await hint.click();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۳/)).toBeVisible({ timeout: 25_000 });
  const ship = await p.locator('.sb-yard .sb-hint').getAttribute('data-flip');
  const inYard = p.locator(`.sb-yard [data-flip="${ship}"]`);
  const inBay = p.locator(`.sb-me [data-flip="${ship}"]`);
  await p.waitForTimeout(800);
  await motionLog(p);
  await slow(p);
  await inYard.click();
  await expect(undo).toBeVisible();
  await expect(inBay).toBeVisible();
  await expect(inYard).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(inYard).toBeVisible();
  await expect(inBay).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
