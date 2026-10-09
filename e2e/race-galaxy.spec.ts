import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «رقابت کهکشانی» end to end: the tutorial (three late rounds: develop, explore, military settle, produce, consume,
// civil settle, end at twelve cards) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'race-galaxy';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: phases, explore, develop, military and civil settle, consume, finish', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۷`));
    await expect(label).toBeVisible();
    if (step === '۵') await p.screenshot({ path: shot(info.project.name, 'tutorial-settle'), fullPage: true });
    // Step 2 keeps the first explored card (drawn cards carry no hint highlight).
    if (step === '۲') { await p.locator('.rg-drawn button').first().click(); continue; }
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.rg .rg-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.rg .rg-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.rg');
  const phase = game.locator('button.rg-phase');
  if (await phase.count()) { await phase.nth([2, 1, 4, 3, 0][n % 5]!).click(); return true; }
  const keep = game.locator('.rg-drawn button');
  if (await keep.count()) { await keep.first().click(); return true; }
  const skip = game.getByRole('button', { name: 'صرف‌نظر' });
  if (!(await skip.count())) return false;
  const can = game.locator('.rg-hand .rg-pick.is-can:not([disabled])');
  if (await can.count()) {
    await can.first().click();
    const place = game.getByRole('button', { name: /^گذاشتن/ });
    const others = game.locator('.rg-hand .rg-pick:not(.is-sel):not([disabled])');
    for (let i = 0; i < await others.count() && !(await place.isEnabled()); i++) await others.nth(i).click();
    if (await place.isEnabled()) { await place.click(); return true; }
  }
  await skip.click();
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
  await expect(host.locator('.rg-phases')).toBeVisible();

  for (let n = 0; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.rg').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.rg').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
