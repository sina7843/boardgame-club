import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «لوبیاکاری» end to end: the tutorial (plant, flip, donate, end trade, plant the leftover) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/bohnanza/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: plant, flip, donate, settle', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/bohnanza');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`));
    await expect(label).toBeVisible();
    if (step === '۳') await p.screenshot({ path: shot(info.project.name, 'tutorial-trade'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.bn .bn-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.bn .bn-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.bn');
  const click = async (name: string) => {
    const b = game.getByRole('button', { name, exact: true });
    if (await b.count() && await b.first().isEnabled()) { await b.first().click(); return true; }
    return false;
  };
  if (await click(n % 2 ? 'پذیرفتن' : 'رد کردن') || await click('رد کردن')) return true;
  if (await click('کاشتن اینجا')) return true;
  if (await game.getByText('اول یک مزرعه را برداشت کنید').count()) { const h = game.locator('.bn-fields--mine .bn-link'); if (await h.count()) { await h.first().click(); return true; } }
  if (await click('رو کردن دو کارت')) return true;
  if (n % 4 === 0 && await game.locator('.bn__faceup button.bn-pick').count()) {
    await game.locator('.bn__faceup button.bn-pick').first().click();
    if (n % 8 === 0) await game.getByRole('button', { name: 'قرمز', exact: true }).click();
    return click(n % 8 === 0 ? 'پیشنهاد معامله' : 'بخشیدن');
  }
  return click('پایان معامله');
}

test('three players play «لوبیاکاری» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/bohnanza/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.bn__market')).toBeVisible();

  for (let n = 0; n < 900; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.bn').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.bn').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 40) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
