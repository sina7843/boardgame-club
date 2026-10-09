import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «بازار سبزی» end to end: the tutorial (take a rule, take two vegetables, flip a useless rule) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/point-salad/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: rule, vegetables, flip', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/point-salad');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-rule'), fullPage: true });
  await p.locator('.ps-pile.ps-hint').click();
  for (const step of ['۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`))).toBeVisible();
    // Step 3 flips the «most lettuce» rule first (flipping is not hinted by the renderer).
    if (step === '۳') await p.locator('.ps-pl--me .ps-flip', { hasText: 'بیشترین' }).click();
    await p.locator('.ps-slot.ps-hint').first().click();
    await p.locator('.ps-slot.ps-hint').first().click();
    await p.getByRole('button', { name: /^برداشتن .* سبزی$/ }).click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const piles = p.locator('.ps-pile:not([disabled]):not(.ps-pile--empty)');
  const slots = p.locator('.ps-slot:not([disabled]):not(.ps-slot--empty)');
  const take = p.getByRole('button', { name: /^برداشتن .* سبزی$/ });
  if (!(await piles.count()) && !(await slots.count())) return false;
  if (n % 6 === 3) { const f = p.locator('.ps-flip'); if (await f.count()) await f.first().click(); }
  if ((n % 3 === 0 || !(await slots.count())) && await piles.count()) { await piles.nth(n % (await piles.count())).click(); return true; }
  const k = await slots.count();
  await slots.nth(0).click();
  if (k > 1) await slots.nth(1).click();
  await take.click();
  return true;
}

test('three players play «بازار سبزی» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/point-salad/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ps__market')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ps').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.ps').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 15) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
