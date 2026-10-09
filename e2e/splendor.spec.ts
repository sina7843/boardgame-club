import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «گوهرفروش» end to end: the tutorial (gems, pair, reserve, return, bonuses, noble, 15) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/splendor/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: three gems, a pair, reserve + gold, the ten-gem limit, bonuses, a noble and 15 prestige', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/splendor');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۶`))).toBeVisible();
  await step('۱');
  for (let i = 0; i < 3; i++) await p.locator('.sp-bankgem.sp-hint').first().click();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-take'), fullPage: true });
  await p.getByRole('button', { name: /^برداشتن/ }).click();
  await step('۲');
  const green = p.locator('.sp-bankgem.sp-hint');
  await green.click();
  await p.locator('.sp-bankgem--on').click();
  await p.getByRole('button', { name: /^برداشتن/ }).click();
  await step('۳');
  await p.locator('.sp__market [data-flip="card-70"]').click();
  await p.getByRole('button', { name: 'رزرو (+طلا)' }).click();
  await step('۴');
  await p.getByRole('button', { name: /^پس دادن الماس/ }).click();
  await p.getByRole('button', { name: 'پس دادن', exact: true }).click();
  await step('۵');
  await p.locator('.sp-slot.sp-hint').click();
  await p.getByRole('button', { name: 'خرید' }).click();
  await step('۶');
  await p.locator('.sp-slot.sp-hint').click();
  await p.getByRole('button', { name: 'خرید' }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const giveBack = p.getByRole('button', { name: 'پس دادن', exact: true });
  if (await giveBack.count()) {
    const toks = p.locator('.sp-col__tok--btn:not([disabled])');
    for (let i = 0; i < 6 && !(await giveBack.isEnabled()); i++) await toks.first().click();
    await giveBack.click();
    return true;
  }
  const buy = p.locator('.sp-slot--buy:not([disabled])');
  if (await buy.count()) { await buy.nth(n % (await buy.count())).click(); await p.getByRole('button', { name: 'خرید' }).click(); return true; }
  const take = p.getByRole('button', { name: /^برداشتن/ });
  if (await take.count()) {
    const gems = p.locator('.sp-bankgem:not([disabled])');
    const k = await gems.count();
    for (let i = 0; i < k && !(await take.isEnabled()); i++) await gems.nth((i + n) % k).click();
    if (await take.isEnabled()) { await take.click(); return true; }
  }
  const deck = p.locator('button.sp-deck:not([disabled])');
  if (await deck.count()) { await deck.first().click(); return true; }
  const pass = p.getByRole('button', { name: 'رد کردن نوبت' });
  if (await pass.count()) { await pass.click(); return true; }
  return false;
}

test('three players play «گوهرفروش» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/splendor/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sp__market')).toBeVisible();

  for (let n = 0; n < 500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      if ((await p.locator('.sp').getAttribute('data-phase')) === 'end') continue;
      const before = await p.locator('.sp').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.sp').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
