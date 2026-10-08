import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «بلوف حشره‌ها» end to end: the tutorial (a caught bluff, then the truth that sinks the rival) and a full
// three-player game with gives, calls, peeks and passes until someone has four of a kind.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/cockroach-poker/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: bluff, then the truth', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/cockroach-poker');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۲`))).toBeVisible();
    await p.locator('.cr-pick.cr-hint').click();
    await p.locator('.cr-target.cr-hint').click();
    await p.locator('.cr-claim.cr-hint').click();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-truth'), fullPage: true });
    await p.getByRole('button', { name: 'دادن کارت' }).click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const giveBtn = p.getByRole('button', { name: 'دادن کارت' });
  const passBtn = p.getByRole('button', { name: 'رد کردن کارت' });
  const yes = p.getByRole('button', { name: 'راست می‌گوید' });
  const peek = p.getByRole('button', { name: 'نگاه کن و رد کن' });
  if (await yes.count()) {
    if (await peek.count() && n % 5 === 1) { await peek.click(); return true; }
    await (n % 2 ? yes : p.getByRole('button', { name: 'دروغ می‌گوید' })).click();
    return true;
  }
  if (!(await giveBtn.count()) && !(await passBtn.count())) return false;
  const picks = p.locator('button.cr-pick');
  if (await picks.count()) await picks.nth(n % (await picks.count())).click();
  const targets = p.locator('.cr-target');
  await targets.nth(n % (await targets.count())).click();
  await p.locator('.cr-claim').nth(n % 8).click();
  await (await giveBtn.count() ? giveBtn : passBtn).click();
  return true;
}

test('three players play «بلوف حشره‌ها» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/cockroach-poker/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cr__players')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cr').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.cr').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
