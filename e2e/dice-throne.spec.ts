import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «نبرد تاس» end to end: the tutorial (roll, keep, attack) and a full duel from the hero pick.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'dice-throne';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: roll, keep, attack', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`));
    await expect(label).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-keep'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.dt .dt-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.dt .dt-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page): Promise<boolean> {
  const game = p.locator('.dt');
  const hero = game.locator('button.dt-hero:not([disabled])');
  if (await hero.count()) { await hero.first().click(); return true; }
  const defend = game.getByRole('button', { name: /^دفاع/ });
  if (await defend.count()) { await defend.click(); return true; }
  const roll = game.getByRole('button', { name: /^ریختن (تاس‌ها|دوباره)$/ });
  const attack = game.locator('button.dt-ab--can:not([disabled])');
  if (await roll.count() && !(await attack.count() && (await game.locator('.dt-rolls').textContent())?.startsWith('۱'))) { await roll.click(); return true; }
  if (await attack.count()) { await attack.last().click(); return true; }
  const pass = game.getByRole('button', { name: 'بدون حمله' });
  if (await pass.count()) { await pass.click(); return true; }
  return false;
}

test('two players duel to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto(`/games/${GAME}/new`);
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.dt-banner').first()).toBeVisible();

  for (let n = 0; n < 2000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.dt').getAttribute('data-seq');
      if (!(await turn(p))) continue;
      await expect.poll(() => p.locator('.dt').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
