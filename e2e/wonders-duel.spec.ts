import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «شگفتی‌ها: دوئل» end to end: the tutorial (chain, trade, science pair, wonder, sale, final scoring) and a full game from the wonder draft.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/wonders-duel/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: chain, trade, science pair, wonder, sell, military and final scoring', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/wonders-duel');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`));
    await expect(label).toBeVisible();
    if (step === '۳') await p.screenshot({ path: shot(info.project.name, 'tutorial-progress'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.wd .wd-hint:not([disabled])').first();
      if (!(await h.count())) {
        // The wonder buttons carry no hint class: step 4 builds the only affordable wonder.
        const w = p.locator('.wd-acts').getByRole('button', { name: /^بنای/ });
        if (await w.count()) await w.first().click();
        break;
      }
      await h.click();
      await expect(p.locator('.wd .wd-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: the built card flies to the city at once, and undo flies it back to the pyramid', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/wonders-duel');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const slot = p.locator('.wd-pyr .wd-hint').first();
  const id = await slot.getAttribute('data-flip');
  await slot.click();
  await motionLog(p);
  await p.locator('.wd-acts .wd-hint').click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(p.locator(`.wd-city [data-flip="${id}"]`)).toHaveCount(1);
  await expect(p.locator(`.wd-pyr [data-flip="${id}"]`)).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(p.locator(`.wd-pyr [data-flip="${id}"]`)).toHaveCount(1);
  await expect(p.locator(`.wd-city [data-flip="${id}"]`)).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
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
