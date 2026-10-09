import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

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
