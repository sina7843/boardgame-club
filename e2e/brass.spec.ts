import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «برس: بیرمنگام» end to end: the tutorial (rail link to Oxford, two sells with merchant beer, a build, rail-era
// scoring) via the highlighted hints, and a full two-player game (both eras) to the result.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/brass/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: rail link, sell with merchant beer, build, sell, era scoring', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/brass');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`));
    await expect(label).toBeVisible();
    if (step === '۲') {
      await p.screenshot({ path: shot(info.project.name, 'tutorial-sell'), fullPage: true });
      await p.locator('.br-pl--me').screenshot({ path: shot(info.project.name, 'board-own') });
      await p.locator('.br__players .br-pl').first().screenshot({ path: shot(info.project.name, 'board-opponent') });
    }
    // Kind → target → card → «ثبت»: each click reveals the next highlighted control.
    for (let i = 0; i < 6 && (await label.count()); i++) {
      const hint = p.locator('.br .br-hint:not([disabled])').first();
      if (!(await hint.count())) break;
      await hint.click();
      await p.waitForTimeout(150);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: the played card flies to my ledger and the link appears at once; undo brings the card back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/brass');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  const links = p.locator('.br svg [data-flip^="link-"]');
  const linksBefore = await links.count();
  const handCards = p.locator('.br__hand .br-card');
  const cardsBefore = await handCards.count();
  const submit = p.locator('.br__actions').getByRole('button', { name: 'ثبت', exact: true });
  for (let i = 0; i < 6 && !(await submit.isEnabled()); i++) { await p.locator('.br .br-hint:not([disabled])').first().click(); await p.waitForTimeout(150); }
  const played = await p.locator('.br__hand .br-card--on').getAttribute('data-flip');
  await p.waitForTimeout(800);
  await motionLog(p);
  await submit.click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(handCards).toHaveCount(cardsBefore - 1);
  await expect(p.locator(`.br-pl--me [data-flip="${played}"]`)).toBeVisible();
  await expect(links).toHaveCount(linksBefore + 1);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(p.locator(`.br__hand [data-flip="${played}"]`)).toBeVisible();
  await expect(links).toHaveCount(linksBefore);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const kinds = p.locator('.br .br-kinds');
  if (!(await kinds.count())) return false;
  const build = kinds.getByRole('button', { name: 'ساخت صنعت', exact: true });
  if (n % 3 === 0 && (await build.count())) {
    await build.click();
    await p.locator('.br [role="listbox"] .br-target').first().click();
  } else {
    await kinds.getByRole('button', { name: 'رد کردن', exact: true }).click();
  }
  await p.locator('.br .br-card:not([disabled])').first().click();
  await p.locator('.br__actions').getByRole('button', { name: 'ثبت', exact: true }).click();
  return true;
}

test('two players play «برس: بیرمنگام» through both eras to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/brass/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('2');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.br__map')).toBeVisible();

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.br').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.br').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
