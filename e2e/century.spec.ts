import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «راه ادویه» end to end: the tutorial (spice card, rest, repeated trade, upgrade, market card, the last order) and a full two-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/century/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: spices, rest, trade, upgrade, hire, the order', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/century');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۶`))).toBeVisible();
  await step('۱');
  await p.locator('.ct .ct-slot.ct-hint').click(); // spice card: plays on tap
  await step('۲');
  await p.locator('.ct .ct-hint', { hasText: 'استراحت' }).click();
  await step('۳');
  await p.locator('.ct .ct-slot.ct-hint').click(); // trade card: choose the count
  await p.locator('.ct__tool').getByRole('button', { name: '+', exact: true }).click();
  await p.getByRole('button', { name: 'معاوضه', exact: true }).click();
  await step('۴');
  await p.locator('.ct .ct-slot.ct-hint').click(); // upgrade card: raise two saffron
  for (let k = 0; k < 2; k++) await p.getByRole('button', { name: 'ارتقای زعفران' }).click();
  await p.getByRole('button', { name: 'ارتقا', exact: true }).click();
  await step('۵');
  await p.getByRole('button', { name: 'استخدام تاجر ۳' }).click();
  await step('۶');
  await p.screenshot({ path: shot(info.project.name, 'tutorial-claim'), fullPage: true });
  await p.locator('.ct .ct-slot.ct-hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const discard = p.getByRole('button', { name: /^کنار گذاشتن/ });
  if (await discard.count()) { await discard.click(); return true; }
  const claim = p.locator('.ct__orders .ct-slot--can:not([disabled])');
  if (await claim.count()) { await claim.first().click(); return true; }
  const hand = p.locator('.ct__hand .ct-slot--can:not([disabled])');
  const rest = p.getByRole('button', { name: /^استراحت/ });
  const market = p.locator('.ct__market .ct-slot--can:not([disabled])');
  if (n % 5 === 0 && await market.count()) { await market.first().click(); return true; }
  if (await hand.count()) {
    await hand.nth(n % (await hand.count())).click();
    const trade = p.getByRole('button', { name: 'معاوضه', exact: true });
    const up = p.getByRole('button', { name: 'ارتقا', exact: true });
    if (await trade.count()) { await trade.click(); return true; }
    if (await up.count()) { await p.locator('.ct-cube--btn:not([disabled])').first().click(); await up.click(); return true; }
    return true; // spice cards send on tap
  }
  if (await rest.count()) { await rest.click(); return true; }
  if (await market.count()) { await market.first().click(); return true; }
  return false;
}

test('two caravans play «راه ادویه» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/century/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite); await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ct__orders')).toBeVisible();

  for (let n = 0; n < 500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ct').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.ct').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 20) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the played card flies to the played pile at once, and undo flies it back to the hand', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/century');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const card = p.locator('.ct__hand .ct-slot.ct-hint');
  const id = await card.getAttribute('data-flip');
  const inHand = p.locator(`.ct__hand [data-flip="${id}"]`), played = p.locator(`.ct__played [data-flip="${id}"]`);
  await motionLog(p);
  await card.click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(played).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(inHand).toBeVisible();
  await expect(played).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
