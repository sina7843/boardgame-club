import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «چکرز» end to end: two clients play through the board (tap a ringed piece, then highlighted squares) until the game
// ends; plus the interactive tutorial (quiet move, forced double jump, crowning, king's backward double jump).
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/checkers/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

async function move(p: Page): Promise<boolean> {
  const next = p.locator('.ck-sq--next');
  if (await next.count()) { await next.first().click(); return true; }
  const src = p.locator('.ck-sq--movable');
  if (await src.count()) { await src.first().click(); return true; }
  return false;
}

test('interactive tutorial: quiet move, forced double jump, crowning, the king backward double jump', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/checkers');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const [step, next] of [['۱', '۲'], ['۲', '۳'], ['۳', '۴'], ['۴', null]] as const) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-2'), fullPage: true });
    // The hinted square is the piece, then each landing square of the expected path.
    const done = () => (next ? p.getByText(new RegExp(`آموزش: مرحله ${next} از ۴`)) : p.getByRole('heading', { name: 'آموزش کامل شد' }));
    for (let k = 0; k < 4 && !(await done().count()); k++) {
      const hint = p.locator('.ck-sq--hint');
      if (await hint.count()) await hint.first().click();
      await p.waitForTimeout(150);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('two players play «چکرز» to the result through the board', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/checkers/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ck-board')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  let n = 0;
  for (; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ck').getAttribute('data-moves');
      if (!(await move(p))) continue;
      acted = true;
      await expect.poll(async () => (await p.locator('.ck-sq--next').count()) > 0 || (await p.locator('.ck').getAttribute('data-moves')) !== before, { timeout: 10_000 }).toBe(true);
      if (n === 30) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
