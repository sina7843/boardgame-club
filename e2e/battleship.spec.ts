import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «نبرد دریایی» end to end: the tutorial (hit, then sink) and a full two-player game from fleet placement.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'battleship';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: hit and sink', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۲`));
    await expect(label).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-hit'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.bs .bs-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.bs .bs-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.bs');
  const confirm = game.getByRole('button', { name: 'تأیید چیدمان' });
  if (await confirm.count()) {
    await game.getByRole('button', { name: 'چیدمان تصادفی' }).click();
    await confirm.click();
    return true;
  }
  const cells = game.locator('.bs-chart--enemy button.bs-cell');
  const k = await cells.count();
  if (!k) return false;
  await cells.nth((n * 37) % k).click();
  return true;
}

test('two players play to the result', async ({ browser }, info) => {
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
  await expect(host.locator('.bs-seas')).toBeVisible();

  for (let n = 0; n < 2000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.bs').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.bs').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 0 || n === 40) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `${n ? 'mid' : 'place'}-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
