import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «قلمرو» end to end: the tutorial (action chain, Militia, treasures, two buys, end) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/dominion/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: action chain, militia, treasures, two buys', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/dominion');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`));
    await expect(label).toBeVisible();
    if (step === '۶') await p.screenshot({ path: shot(info.project.name, 'tutorial-buy'), fullPage: true });
    await p.locator('.dm .dm-hint:not([disabled])').first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

const SIMPLE = /روستا|آهنگری|بازار|سوداگر|خندق|سپاه محلی/;
async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.dm');
  const bar = game.locator('.dm__bar');
  const discard = bar.getByRole('button', { name: /^دور ریختن/ });
  if (await discard.count()) {
    const need = Number((await discard.textContent())!.match(/از (.+)$/)![1]!.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    for (let i = 0; i < need; i++) await game.locator('.dm-hand').nth(i).click();
    await discard.click();
    return true;
  }
  if (!(await bar.getByRole('button', { name: 'پایان نوبت' }).count())) return false;
  const action = game.locator('.dm-hand--can').filter({ hasText: SIMPLE });
  if (await action.count()) { await action.first().click(); return true; }
  const treasures = bar.getByRole('button', { name: 'رو کردن گنج‌ها' });
  if (await treasures.count()) { await treasures.click(); return true; }
  for (const name of ['ایالت', 'طلا', n % 3 ? 'نقره' : 'آهنگری', 'سپاه محلی', 'روستا', 'نقره']) {
    const pile = game.locator('.dm-pile--can').filter({ hasText: name });
    if (await pile.count()) { await pile.first().click(); return true; }
  }
  await bar.getByRole('button', { name: 'پایان نوبت' }).click();
  return true;
}

test('three players play «قلمرو» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/dominion/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.dm__supply')).toBeVisible();

  for (let n = 0; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.dm').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.dm').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 60) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
