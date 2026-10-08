import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «شگفتی‌ها: دوئل» end to end: the tutorial (science pair, progress token, military win) and a full game from the wonder draft.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/wonders-duel/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: science, progress, military', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/wonders-duel');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`));
    await expect(label).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-progress'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.wd .wd-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.wd .wd-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.wd');
  const draft = game.locator('.wd-draft button.wd-pickw');
  if (await draft.count()) { await draft.nth(n % (await draft.count())).click(); return true; }
  const token = game.locator('button.wd-token');
  if (await token.count()) { await token.first().click(); return true; }
  const choose = game.locator('.wd-acts button.wd-pickw');
  if (await choose.count()) { await choose.first().click(); return true; }
  const slots = game.locator('button.wd-slot');
  const k = await slots.count();
  if (!k) return false;
  await slots.nth(n % k).click();
  const build = game.getByRole('button', { name: /^ساختن \((?!ناتوان)/ });
  const wonder = game.getByRole('button', { name: /^بنای / });
  if (n % 5 === 0 && await wonder.count()) await wonder.first().click();
  else if (await build.count() && await build.isEnabled()) await build.click();
  else await game.getByRole('button', { name: /^فروختن/ }).click();
  return true;
}

test('two players play «شگفتی‌ها: دوئل» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/wonders-duel/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite); await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.wd-track')).toBeVisible();

  for (let n = 0; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.wd').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.wd').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 2 || n === 30) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `${n === 2 ? 'draft' : 'mid'}-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
