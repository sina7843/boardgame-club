import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «لوبیاکاری» end to end: the tutorial (plant twice, flip, trade for a wanted bean, end trade, plant, harvest to make room) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/bohnanza/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: plant, flip, trade, settle, harvest', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/bohnanza');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`));
    await expect(label).toBeVisible();
    if (step === '۴') {
      // The trade asks for a bean: the face-up card is hinted, the wanted bean chip is picked by name.
      await p.locator('.bn__market .bn-hint').click();
      await p.locator('.bn__offer .bn-chip--bean', { hasText: 'آبی' }).click();
      await p.screenshot({ path: shot(info.project.name, 'tutorial-trade'), fullPage: true });
    }
    // Harvesting is not hinted by the renderer: press the red field's harvest link.
    if (step === '۷') await p.locator('.bn-fields--mine').getByRole('button', { name: 'برداشت (۳ سکه)' }).click();
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.bn .bn-hint:not([disabled])').first();
      if (!(await h.count())) break;
      // Wait for the server's result (the move preview shows at once, so hints alone do not tell it arrived).
      const seq = await p.locator('.bn').getAttribute('data-seq');
      await h.click();
      await expect(p.locator('.bn')).not.toHaveAttribute('data-seq', seq ?? '');
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

test('undo window: the planted card flies from the hand to the field at once, and undo flies it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/bohnanza');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const hand = p.locator('.bn__hand .bn-card');
  const field = p.locator('.bn-fields--mine .bn-field').first().locator('.bn-card__count');
  const n = await hand.count();
  await expect(field).toHaveText('۳');
  await p.locator('.bn .bn-hint:not([disabled])').first().click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(hand).toHaveCount(n - 1);
  await expect(field).toHaveText('۴');
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(hand).toHaveCount(n);
  await expect(field).toHaveText('۳');
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
