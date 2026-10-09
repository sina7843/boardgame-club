import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «جمجمه» end to end: the tutorial (place, bluff, pass, raise, reveal) and a three-player game through placing, bidding, passing and
// turning discs until someone wins.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/skull/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: place, bluff, pass, lose a disc, raise, reveal', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/skull');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۷`))).toBeVisible();
  const disc = p.locator('.sk-handdisc.sk-hint').first();
  await step('۱'); await disc.click();
  await step('۲'); await disc.click();
  await step('۳'); await p.getByRole('button', { name: 'کنار می‌کشم' }).click();
  await step('۴'); await disc.click();
  await step('۵'); await disc.click();
  await step('۶');
  await p.locator('.sk-num.sk-hint').click();
  await p.getByRole('button', { name: /^پیشنهاد ۳/ }).click();
  await step('۷');
  await p.screenshot({ path: shot(info.project.name, 'tutorial-reveal'), fullPage: true });
  await p.locator('.sk-pl__flip').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const flip = p.locator('.sk-pl__flip');
  if (await flip.count()) { await flip.nth(n % (await flip.count())).click(); return true; }
  const pass = p.getByRole('button', { name: 'کنار می‌کشم' });
  const bid = p.getByRole('button', { name: /^پیشنهاد/ });
  const discs = p.locator('.sk-handdisc:not([disabled])');
  if (await pass.count() && n % 2) { await pass.click(); return true; }
  if (await bid.count() && (n % 4 === 3 || !(await discs.count()))) { await bid.click(); return true; }
  if (await discs.count()) { await discs.nth(n % (await discs.count())).click(); return true; }
  if (await pass.count()) { await pass.click(); return true; }
  return false;
}

test('three players play «جمجمه» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/skull/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sk__table')).toBeVisible();

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.sk').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.sk').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 10) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
