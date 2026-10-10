import { expect, test, type Page, type Route } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «شهر تاس» end to end: the tutorial (two dice, radio reroll, income, doubles turn, keep, last landmark) and a full two-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/machi-koro/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: two dice, reroll, build, doubles, keep, the shopping mall', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/machi-koro');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`))).toBeVisible();
    if (step === '۳') await p.screenshot({ path: shot(info.project.name, 'tutorial-build'), fullPage: true });
    // Step 5 keeps the roll (the keep button has no hint style); every other step clicks the highlighted control.
    if (step === '۵') await p.getByRole('button', { name: 'همین را نگه دار' }).click();
    else await p.locator('button.mk-hint').first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const phase = await p.locator('.mk').getAttribute('data-phase');
  const rollBtns = p.getByRole('button', { name: /^(ریختن|دوباره)/ });
  const keep = p.getByRole('button', { name: 'همین را نگه دار' });
  if (await keep.count()) { await keep.click(); return true; }
  if (await rollBtns.count()) { await rollBtns.last().click(); return true; }
  const tv = p.locator('.mk__bar button').filter({ hasText: /^از/ });
  if (phase === 'tv' && await tv.count()) { await tv.first().click(); return true; }
  const no = p.getByRole('button', { name: 'نه', exact: true });
  if (await no.count()) { await no.click(); return true; }
  const lm = p.locator('.mk__bar button:not([disabled])').filter({ hasText: /ایستگاه|مرکز خرید|شهربازی|برج رادیو/ });
  if (await lm.count()) { await lm.first().click(); return true; }
  const buy = p.locator('.mk-buy:not([disabled])');
  if (n % 2 && await buy.count()) { await buy.nth(n % (await buy.count())).click(); return true; }
  const pass = p.getByRole('button', { name: 'چیزی نمی‌سازم' });
  if (await pass.count()) { await pass.click(); return true; }
  return false;
}

test('two mayors play «شهر تاس» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/machi-koro/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite); await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.mk__dice')).toBeVisible();

  for (let n = 0; n < 700; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      if (!(await p.locator('.mk-pl--me.mk-pl--turn').count())) continue;
      const before = await p.locator('.mk').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.mk').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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

test('instant roll (no undo) tumbles with no pips while in flight and the result is thrown as dice; a build shows at once in its undo window', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/machi-koro');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۶/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const tumbling = p.locator('.mk__dice .bg-tumble');
  // The roll is sent at once despite the window; hold its answer so the in-flight tumble can be seen.
  const delay = async (route: Route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); };
  await p.route('**/api/tables/*/commands', delay);
  await p.locator('button.mk-hint').first().click();
  await expect(tumbling).toHaveCount(2);
  await expect(undo).toHaveCount(0);
  expect(await tumbling.locator('circle').evaluateAll((cs) => cs.every((c) => getComputedStyle(c).visibility === 'hidden'))).toBe(true);
  await expect(p.locator('.mk__sum')).toHaveCount(0);
  await expect(p.getByText(/آموزش: مرحله ۲ از ۶/)).toBeVisible({ timeout: 10_000 });
  await expect(tumbling).toHaveCount(0);
  await expect(p.locator('.mk__dice .bg-roll')).toHaveCount(2);
  await p.waitForTimeout(1200);
  expect((await motionLog(p)).some((x) => x.ghost === 'die')).toBe(true);
  await p.unroute('**/api/tables/*/commands', delay);
  // Step 2 rerolls; step 3 builds a ranch: the third ranch shows in my street during the undo window, undo removes it.
  await p.locator('button.mk-hint').first().click();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۶/)).toBeVisible({ timeout: 10_000 });
  const ranch = p.locator('.mk-pl--me [data-flip$="-ranch"] .mk-card__count');
  await expect(ranch).toHaveText('×۲');
  await p.locator('button.mk-hint').first().click();
  await expect(undo).toBeVisible();
  await expect(ranch).toHaveText('×۳');
  await undo.click();
  await expect(ranch).toHaveText('×۲');
  await p.context().close();
});
