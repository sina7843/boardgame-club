import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «تخته‌نرد» end to end: two clients play a full game through the board itself — tap a checker (or the bar), tap a
// highlighted landing when there are two, bear off on the tray. Each finished turn is one command.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/backgammon/${project}-${name}.png`;

/** One board interaction for this page, if it has one. Returns what it did. */
async function move(p: Page): Promise<string | null> {
  const land = p.locator('.bgm-pt--land, .bgm-tray--land');
  if (await land.count()) { await land.first().click(); return 'land'; }
  const src = p.locator('.bgm-bar--src, .bgm-pt--src');
  if (await src.count()) { await src.first().click(); return 'step'; }
  for (const name of [/^تاس بریز/, /^قبول/]) {
    const b = p.getByRole('button', { name });
    if (await b.count() && await b.isEnabled()) { await b.click(); return 'button'; }
  }
  return null;
}

test('interactive tutorial: blocked point, hit and enter, bear off with doubles to a gammon', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/backgammon');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-1'), fullPage: true });
  // Only the scripted checker is offered at each step; every tap moves at once. Moves per step: 2, 2, 2, then doubles.
  const steps = [2, 2, 2, 4];
  for (const [i, moves] of steps.entries()) {
    for (let k = 0; k < moves; k++) await p.locator('.bgm-pt--src, .bgm-bar--src').first().click();
    if (i + 1 < steps.length) await expect(p.getByText(new RegExp(`آموزش: مرحله ${(i + 2).toLocaleString('fa-IR')} از ۴`))).toBeVisible();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-done'), fullPage: true });
  await p.context().close();
});

test('two players play «تخته‌نرد» to the result through the board', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/backgammon/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.bgm-board')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  let n = 0, turns = 0;
  for (; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.bgm').getAttribute('data-seq');
      const did = await move(p);
      if (!did) continue;
      acted = true;
      // A step that completes the turn sends the play: wait for the next turn to show.
      if (did !== 'land') await expect.poll(async () => (await p.locator('.bgm-pt--src, .bgm-bar--src, .bgm-pt--land').count()) > 0 || (await p.locator('.bgm').getAttribute('data-seq')) !== before, { timeout: 10_000 }).toBe(true);
      if ((await p.locator('.bgm').getAttribute('data-seq')) !== before && ++turns === 6) {
        for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      }
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  test.info().annotations.push({ type: 'interactions', description: String(n) });
  for (const p of pages) await p.context().close();
});
