import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «نامه عاشقانه» end to end: the tutorial (Countess, Handmaid, Priest, Prince) and a short three-player game: tap a card,
// pick a target, guess for the Guard.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/love-letter/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: Countess rule, Handmaid protection, Priest, Prince on the Princess', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/love-letter');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  // Steps 1–2 (Countess, Baron with no target) are a single card tap; steps 3–4 (Priest, Prince) also pick the target.
  for (const step of ['۱', '۲', '۳', '۴']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    if (step === '۴') {
      await expect(p.locator('.ll__seen')).toContainText('شاهزاده‌خانم');
      await p.screenshot({ path: shot(info.project.name, 'tutorial-seen'), fullPage: true });
    }
    await p.locator('.ll .ll-card--hint').click();
    if (step === '۳' || step === '۴') await p.locator('.ll .ll-target--hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const cards = p.locator('.ll .ll__hand button.ll-card:not([disabled])');
  if (!(await cards.count())) return false;
  await cards.nth(n % (await cards.count())).click();
  const targets = p.locator('.ll .ll-pl button');
  if (await targets.count()) await targets.nth(n % (await targets.count())).click();
  const guesses = p.locator('.ll .ll-guess');
  if (await guesses.count()) await guesses.nth(n % 7).click();
  return true;
}

test('three players play a short game of «نامه عاشقانه»', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/love-letter/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByText('کوتاه (۳ نشان)', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ll__players')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ll').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.ll').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 8) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the played card flies to my discards at once, and undo flies it back to the hand', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/love-letter');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const card = p.locator('.ll .ll__hand .ll-card--hint');
  const id = await card.getAttribute('data-flip');
  const inHand = p.locator(`.ll .ll__hand [data-flip="${id}"]`), discarded = p.locator(`.ll .ll-pl__discards [data-flip="${id}"]`);
  await motionLog(p);
  await card.click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(discarded).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(inHand).toBeVisible();
  await expect(discarded).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  // Sent for real: once confirmed, the discard keeps the same id (no second flight).
  await card.click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۴/)).toBeVisible({ timeout: 10_000 });
  await expect(discarded).toBeVisible();
  await p.context().close();
});
