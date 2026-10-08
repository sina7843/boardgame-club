import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «کاوشگران» end to end: the tutorial (finish an expedition, draw the last card) and a full one-round two-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/lost-cities/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: play the 9, draw the last card', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/lost-cities');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۲/)).toBeVisible();
  await p.locator('.lc-pick.lc-hint').click();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-play'), fullPage: true });
  await p.getByRole('button', { name: /^روی سفر/ }).click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۲/)).toBeVisible();
  await p.locator('.lc-deck.lc-hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const deck = p.locator('.lc-deck--can:not([disabled])');
  if (await deck.count()) {
    const piles = p.locator('.lc-pile--can:not([disabled])');
    if (n % 5 === 0 && await piles.count()) await piles.first().click(); else await deck.click();
    return true;
  }
  const picks = p.locator('.lc-pick:not([disabled])');
  const k = await picks.count();
  if (!k) return false;
  const live = p.locator('.lc-pick:not([disabled]):not(.lc-pick--dead)');
  const target = (await live.count()) && n % 3 ? live.nth(n % (await live.count())) : picks.nth(n % k);
  await target.click();
  const play = p.getByRole('button', { name: /^روی سفر/ });
  if (await play.isEnabled() && n % 4) await play.click(); else await p.getByRole('button', { name: 'دور بینداز' }).click();
  return true;
}

test('two explorers play «کاوشگران» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/lost-cities/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByText('یک دست', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite); await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.lc__board')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.lc').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.lc').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
