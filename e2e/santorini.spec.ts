import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «سانتورینی» end to end: tutorial (move + build, dome, double threat, climb) and a full game: place workers, then worker → move →
// build through the board until someone climbs to level 3 or is stuck.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/santorini/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: move + build, a dome to block, a double threat, climb', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/santorini');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    for (let k = 0; k < 3; k++) await p.locator('.sto-sq--hint').click();
  }
  await expect(p.getByText(/آموزش: مرحله ۴ از ۴/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-2'), fullPage: true });
  for (let k = 0; k < 2; k++) await p.locator('.sto-sq--hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

/** One whole action for this page (a placement or worker → move → build). */
async function act(p: Page, n: number): Promise<boolean> {
  const stage = await p.locator('.sto').getAttribute('data-stage');
  const lit = p.locator('.sto-sq--lit');
  if (!(await lit.count())) return false;
  if (stage === 'place') { await lit.nth((n * 7) % (await lit.count())).click(); return true; }
  for (let k = 0; k < 3; k++) {
    const l = p.locator('.sto-sq--lit');
    if (!(await l.count())) return true;
    await l.nth((n + k) % (await l.count())).click();
  }
  return true;
}

test('two players build and climb to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/santorini/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sto-board')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.sto').getAttribute('data-turn');
      if (!(await act(p, n))) continue;
      await expect.poll(() => p.locator('.sto').getAttribute('data-turn'), { timeout: 10_000 }).not.toBe(before);
      if (n === 16) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
