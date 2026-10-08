import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «اشرافی» end to end: the tutorial (raise with banknotes until the rival drops out) and a full three-player game
// through luxury and disgrace auctions until the fourth red card.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/high-society/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const note = (p: Page, v: number) => p.locator(`.hs-pick:has(.hs-note[data-v="${v}"])`);

test('interactive tutorial: outbid the rival', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/high-society');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۲/)).toBeVisible();
  await note(p, 1).click();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-bid'), fullPage: true });
  await p.getByRole('button', { name: /^پیشنهاد/ }).click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۲/)).toBeVisible();
  await note(p, 3).click();
  await p.getByRole('button', { name: /^پیشنهاد/ }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const pass = p.getByRole('button', { name: /^کنار می‌کشم/ });
  if (!(await pass.count()) || !(await pass.isEnabled())) return false;
  const need = Number((await p.locator('.hs__actions').getAttribute('data-need')) || 0);
  if (need && n % 3 !== 2) {
    const vals = (await p.locator('.hs__fan .hs-note').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-v'))))).sort((a, b) => a - b);
    let sum = 0;
    const pick: number[] = [];
    for (const v of vals) { if (sum >= need) break; pick.push(v); sum += v; }
    if (sum >= need && sum <= need + 12) {
      for (const v of pick) await note(p, v).first().click();
      await p.getByRole('button', { name: /^پیشنهاد/ }).click();
      return true;
    }
  }
  await pass.click();
  return true;
}

test('three players play «اشرافی» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/high-society/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.hs__stage')).toBeVisible();

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.hs').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.hs').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 9) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
