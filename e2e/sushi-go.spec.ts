import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «سوشی گردان» end to end: the tutorial (wasabi, nigiri, hand passing, chopsticks, tempura, maki, pudding) and a full three-player game of three rounds.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/sushi-go/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: wasabi, squid, chopsticks, tempura, maki, puddings', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/sushi-go');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۷`))).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-pass'), fullPage: true });
    if (step === '۴') {
      // Chopsticks: switch to two-card mode, then tap both highlighted tempura.
      await p.locator('.sg-chop').click();
      await p.locator('.sg-pick.sg-hint').first().click();
      await p.locator('.sg-pick.sg-hint').nth(1).click();
    } else await p.locator('.sg-pick.sg-hint').first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const chop = p.locator('.sg-chop');
  const picks = p.locator('.sg-pick:not([disabled])');
  const k = await picks.count();
  if (!k) return false;
  if (k >= 2 && await chop.count() && n % 2) {
    await chop.click();
    await picks.nth(0).click();
    await picks.nth(1).click();
    return true;
  }
  await picks.nth(n % k).click();
  return true;
}

test('three players play «سوشی گردان» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/sushi-go/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sg-belt')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const sig = async () => `${await p.locator('.sg').getAttribute('data-seq')}|${await p.locator('.sg-pick:not([disabled])').count()}`;
      const before = await sig();
      if (!(await turn(p, n))) continue;
      await expect.poll(sig, { timeout: 10_000 }).not.toBe(before);
      acted = true;
    }
    if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
