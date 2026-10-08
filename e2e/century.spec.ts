import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «راه ادویه» end to end: the tutorial (play a spice card, deliver the last order) and a full two-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/century/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: spices, then the order', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/century');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۲/)).toBeVisible();
  await p.locator('.ct-slot.ct-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۲/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-claim'), fullPage: true });
  await p.locator('.ct-slot.ct-hint').click();
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
