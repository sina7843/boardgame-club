import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «اونیتاما» end to end: tutorial (capture by card, card swap, master to the temple) and a full duel through board taps.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/onitama/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: capture by card, take the side card, reach the temple', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/onitama');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`))).toBeVisible();
    await p.locator('.oni-sq--hint').click(); // the piece
    await p.locator('.oni-sq--hint').click(); // its target
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const pass = p.getByRole('button', { name: /^عوض کردن/ });
  if (await pass.count()) { await pass.first().click(); return true; }
  const src = p.locator('.oni-sq--src');
  if (!(await src.count())) return false;
  await src.nth(n % (await src.count())).click();
  const tg = p.locator('.oni-target');
  if (!(await tg.count())) return false;
  await tg.nth(n % (await tg.count())).click({ force: true });
  const pick = p.locator('.oni__choice').getByRole('button');
  if (await pick.count()) await pick.first().click();
  return true;
}

test('two players duel to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/onitama/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.oni-board')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.oni').getAttribute('data-turn');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.oni').getAttribute('data-turn'), { timeout: 10_000 }).not.toBe(before);
      if (n === 6) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
