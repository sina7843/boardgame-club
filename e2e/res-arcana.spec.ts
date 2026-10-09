import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «آرکانا» end to end: the tutorial (play, discard, pass, collect, tap, buy a monument) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'res-arcana';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: play, discard, pass, tap, buy', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`));
    await expect(label).toBeVisible();
    if (step === '۷') await p.screenshot({ path: shot(info.project.name, 'tutorial-buy'), fullPage: true });
    if (step === '۳') {
      // Discarding is not hinted by the renderer: discard the bell for one gold.
      const slot = p.locator('.ra-hand .ra-slot', { hasText: 'ناقوس مردگان' });
      await slot.getByRole('button', { name: 'دور انداختن' }).click();
      await slot.getByRole('button', { name: '۱ طلا' }).click();
    }
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.ra .ra-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.ra .ra-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page): Promise<boolean> {
  const game = p.locator('.ra');
  const pass = game.getByRole('button', { name: /^رد کردن/ });
  if (!(await pass.count())) return false;
  const buy = game.locator('.ra-pick.is-can:not([disabled])');
  if (await buy.count()) { await buy.first().click(); return true; }
  for (const name of ['فعال کردن', 'بازی']) {
    const b = game.locator('.ra-mini:not([disabled])').filter({ hasText: new RegExp(`^${name}$`) });
    if (await b.count()) { await b.first().click(); return true; }
  }
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
  await expect(host.locator('.ra-shelf')).toBeVisible();

  for (let n = 0; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ra').getAttribute('data-seq');
      if (!(await turn(p))) continue;
      await expect.poll(() => p.locator('.ra').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
