import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «بنگاه» end to end: the tutorial (two auctions, two sales) and a full three-player game through both phases.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/for-sale/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: bid, pass, win an auction, then two sale rounds', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/for-sale');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`))).toBeVisible();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-bid'), fullPage: true });
    if (step === '۴') await p.screenshot({ path: shot(info.project.name, 'tutorial-sell'), fullPage: true });
    await p.locator('.fs-hint').first().click(); // bid 2, pass, bid 3, sell 29, sell 8
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const sell = p.locator('button.fs-sell:not([disabled])');
  if (await sell.count()) { await sell.nth(n % (await sell.count())).click(); return true; }
  const bid = p.getByRole('button', { name: /^پیشنهاد/ });
  const pass = p.getByRole('button', { name: /^کنار می‌کشم/ });
  if (await bid.count() && n % 3 === 0 && await bid.isEnabled()) { await bid.click(); return true; }
  if (await pass.count() && await pass.isEnabled()) { await pass.click(); return true; }
  return false;
}

test('three players play «بنگاه» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/for-sale/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.fs__market')).toBeVisible();

  const shots = new Set<string>();
  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const sig = async () => `${await p.locator('.fs').getAttribute('data-seq')}|${await p.locator('button.fs-sell, .fs-bid').count()}`;
      const before = await sig();
      const phase = (await p.locator('.fs').getAttribute('data-phase')) ?? '';
      if (!(await turn(p, n))) continue;
      await expect.poll(sig, { timeout: 10_000 }).not.toBe(before);
      if (!shots.has(phase) && n > 4) {
        shots.add(phase);
        for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `${phase}-${i}`), fullPage: true });
      }
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('instant pass (no undo): the cheapest property flies into your hand while the pass is in flight and stays there after the answer', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/for-sale');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۵/)).toBeVisible();
  await p.locator('.fs-hint').first().click(); // bid 2
  await expect(p.getByText(/آموزش: مرحله ۲ از ۵/)).toBeVisible({ timeout: 10_000 });
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(1500);
  // A pass is sent at once despite the window (no undo); hold its answer so the in-flight preview can be seen.
  let answered = false;
  await p.route('**/api/tables/*/commands', async (route) => {
    if (route.request().method() === 'POST') { await new Promise((ok) => setTimeout(ok, 1500)); answered = true; }
    await route.continue();
  });
  await motionLog(p);
  const inHand = p.locator('.fs__hand [data-flip^="p-"]');
  const before = await inHand.count();
  const lowest = await p.locator('.fs__row [data-flip^="p-"]').first().getAttribute('data-flip');
  await p.locator('.fs-hint').first().click(); // pass
  await expect(p.locator(`.fs__hand [data-flip="${lowest}"]`)).toBeVisible();
  await expect(inHand).toHaveCount(before + 1);
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  expect(answered).toBe(false);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  // After the answer the property stays in the hand.
  await expect(p.getByText(/آموزش: مرحله ۳ از ۵/)).toBeVisible({ timeout: 10_000 });
  await expect(p.locator(`.fs__hand [data-flip="${lowest}"]`)).toBeVisible();
  await expect(inHand).toHaveCount(before + 1);
  await p.context().close();
});
