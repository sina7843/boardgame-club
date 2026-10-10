import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «کاروان» end to end: the tutorial (camels, exchange, sales, ending the round) and a full one-round game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/jaipur/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: camels, exchange, sell three, take silver, sell the pair', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/jaipur');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const at = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۵`))).toBeVisible();
  const sell = async (n: number) => {
    for (let i = 0; i < n; i++) await p.locator('.jp__hand .jp-pick.jp-hint').first().click();
    await p.getByRole('button', { name: /^فروش/ }).click();
  };
  await at('۱');
  await p.getByRole('button', { name: /^همهٔ شترها/ }).click();
  await at('۲');
  // Exchange: both spices from the market, the cloth from the hand plus one camel.
  const spices = p.locator('.jp__carpet .jp-pick').filter({ has: p.locator('.jp-card[aria-label="ادویه"]') });
  await spices.nth(0).click();
  await spices.nth(1).click();
  await p.locator('.jp__hand .jp-pick').filter({ has: p.locator('.jp-card[aria-label="پارچه"]') }).first().click();
  await p.locator('.jp__camgive button').last().click();
  await p.getByRole('button', { name: /^معاوضهٔ/ }).click();
  await at('۳');
  await sell(3);
  await at('۴');
  await p.locator('.jp-pick.jp-hint').click();
  await p.getByRole('button', { name: /^برداشتن/ }).click();
  await at('۵');
  await sell(2);
  await p.screenshot({ path: shot(info.project.name, 'tutorial-sell'), fullPage: true });
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const camels = p.getByRole('button', { name: /^همهٔ شترها/ });
  if (!(await camels.count())) {
    // Not our turn unless a hand/market card is enabled.
    if (!(await p.locator('.jp__hand .jp-pick:not([disabled]), .jp__carpet .jp-pick:not([disabled])').count())) return false;
  }
  const labels = await p.locator('.jp__hand .jp-pick .jp-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const precious = new Set(['الماس', 'طلا', 'نقره']);
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l!, (counts.get(l!) ?? 0) + 1);
  const sellable = [...counts].filter(([l, c]) => c >= (precious.has(l) ? 2 : 1)).sort((a, b) => b[1] - a[1]);
  if (sellable.length && (n % 3 === 0 || labels.length >= 7)) {
    const [l] = sellable[0]!;
    for (let i = 0; i < labels.length; i++) if (labels[i] === l) await p.locator('.jp__hand .jp-pick').nth(i).click();
    await p.getByRole('button', { name: /^فروش/ }).click();
    return true;
  }
  if (await camels.count() && n % 4 === 0) { await camels.click(); return true; }
  const market = p.locator('.jp__carpet .jp-pick:not([disabled])');
  if (labels.length < 7 && await market.count()) {
    await market.nth(n % (await market.count())).click();
    await p.getByRole('button', { name: /^برداشتن/ }).click();
    return true;
  }
  if (await camels.count()) { await camels.click(); return true; }
  return false;
}

test('two traders play «کاروان» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/jaipur/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByText('یک دست', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite); await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.jp__market')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.jp').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.jp').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 14) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the taken card flies from the market into the hand at once, and undo flies it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/jaipur');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const at = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۵`))).toBeVisible();
  await at('۱');
  await p.getByRole('button', { name: /^همهٔ شترها/ }).click();
  await at('۲');
  const spices = p.locator('.jp__carpet .jp-pick').filter({ has: p.locator('.jp-card[aria-label="ادویه"]') });
  await spices.nth(0).click();
  await spices.nth(1).click();
  await p.locator('.jp__hand .jp-pick').filter({ has: p.locator('.jp-card[aria-label="پارچه"]') }).first().click();
  await p.locator('.jp__camgive button').last().click();
  await p.getByRole('button', { name: /^معاوضهٔ/ }).click();
  await at('۳');
  for (let i = 0; i < 3; i++) await p.locator('.jp__hand .jp-pick.jp-hint').first().click();
  await p.getByRole('button', { name: /^فروش/ }).click();
  await at('۴');
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const id = await p.locator('.jp__carpet .jp-pick.jp-hint [data-flip]').getAttribute('data-flip');
  const inMarket = p.locator(`.jp__carpet [data-flip="${id}"]`);
  const inHand = p.locator(`.jp__hand [data-flip="${id}"]`);
  await p.locator('.jp-pick.jp-hint').click();
  await p.getByRole('button', { name: /^برداشتن/ }).click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(inHand).toBeVisible();
  await expect(inMarket).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(inMarket).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
