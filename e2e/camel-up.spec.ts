import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «مسابقهٔ شترها» end to end: the tutorial (overall bet, leg bet, last die) and a full three-player race.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/camel-up/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: bets, then the finish', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/camel-up');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۲/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-bet'), fullPage: true });
  await p.locator('.cu-ov .cu-hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۲/)).toBeVisible();
  await p.locator('.cu-legtile.cu-hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const roll = p.getByRole('button', { name: /^تاس از هرم/ });
  if (!(await roll.count())) return false;
  const legs = p.locator('.cu-legtile:not([disabled])');
  if (n % 4 === 1 && await legs.count()) { await legs.nth(n % (await legs.count())).click(); return true; }
  if (n % 7 === 3) { const ov = p.locator('.cu-ov button'); if (await ov.count()) { await ov.nth(n % (await ov.count())).click(); return true; } }
  if (n % 9 === 5) {
    await p.getByRole('button', { name: 'واحه +۱' }).click();
    const sp = p.locator('.cu-sp--can');
    if (await sp.count()) { await sp.last().click(); return true; }
  }
  await roll.click();
  return true;
}

test('three players race «مسابقهٔ شترها» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/camel-up/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cu__track')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cu').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.cu').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
