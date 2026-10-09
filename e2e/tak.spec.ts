import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «تاک» end to end: tutorial (wall, stack spread, capstone, road) and a full game mixing placements and stack moves through the
// board until a road or the flat count decides.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/tak/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: wall, stack spread, capstone, flattening the wall into a road', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/tak');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const sq = (name: string) => p.locator(`.tak-sq[aria-label^="${name}:"]`);
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await expect(p.getByRole('button', { name: /دیوار/ })).toHaveAttribute('aria-pressed', 'true');
  await p.locator('.tak-sq--hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۴/)).toBeVisible();
  await sq('b1').click();
  await p.getByRole('group', { name: 'تعداد سنگ برای برداشتن' }).getByRole('button', { name: '۲' }).click();
  await sq('c1').click();
  await sq('d1').click();
  await expect(p.getByText(/آموزش: مرحله ۳ از ۴/)).toBeVisible();
  await expect(p.getByRole('button', { name: /سرستون/ })).toHaveAttribute('aria-pressed', 'true');
  await p.locator('.tak-sq--hint').click();
  await expect(p.getByText(/آموزش: مرحله ۴ از ۴/)).toBeVisible();
  await sq('e2').click();
  await sq('e1').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const lit = p.locator('.tak-sq--lit');
  if (!(await lit.count())) return false;
  // Every fourth turn try a stack move (own stack → drop targets until the hand is empty).
  const own = p.locator('.tak-sq--lit[aria-label*="شما"]');
  if (n % 4 === 3 && await own.count()) {
    await own.nth(n % (await own.count())).click();
    for (let k = 0; k < 8; k++) {
      const drop = p.locator('.tak-sq--drop');
      if (!(await drop.count())) break;
      await drop.nth(k % (await drop.count())).click();
    }
    return true;
  }
  const empty = p.locator('.tak-sq--lit[aria-label$="خالی"]');
  if (!(await empty.count())) return false;
  await empty.nth((n * 7) % (await empty.count())).click();
  return true;
}

test('two players play «تاک» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/tak/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.tak-board')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.tak').getAttribute('data-ply');
      if (!(await turn(p, n))) continue;
      await expect.poll(async () => (await p.locator('.tak').getAttribute('data-ply')) !== before || (await p.getByRole('button', { name: 'انصراف', exact: true }).count()) > 0, { timeout: 10_000 }).toBe(true);
      // A move that could not be finished (no drop target) is cancelled and a stone is placed instead.
      if (await p.getByRole('button', { name: 'انصراف', exact: true }).count()) { await p.getByRole('button', { name: 'انصراف', exact: true }).click(); continue; }
      if (n === 14) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
