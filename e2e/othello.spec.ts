import { expect, test, type Page } from '@playwright/test';
import { player, recordMotion } from './helpers.ts';

// «اتللو» end to end: two clients fill the board by tapping dotted squares until the result; plus the tutorial.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/othello/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: outflank, two lines at once, pass, diagonal', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/othello');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`))).toBeVisible();
    await p.locator('.oth-sq--hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('two players play «اتللو» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/othello/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.oth-board')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  for (let n = 0; n < 200; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const sq = p.locator('.oth-sq--legal');
      if (!(await sq.count())) continue;
      const before = await p.locator('.oth').getAttribute('data-moves');
      // Vary the play a little: corners first when available, otherwise the last offered square.
      await sq.nth(n % 3 === 0 ? 0 : (await sq.count()) - 1).click();
      await expect.poll(() => p.locator('.oth').getAttribute('data-moves'), { timeout: 10_000 }).not.toBe(before);
      if (n === 20) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the disc lands and the line turns over at once, and undo turns it back and lifts the disc', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/othello');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const hint = p.locator('.oth-sq--hint');
  const sq = ((await hint.getAttribute('aria-label')) ?? '').split(':')[0]!;
  const cell = p.locator(`.oth-sq[aria-label^="${sq}:"]`);
  await hint.click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(cell).toHaveAttribute('aria-label', /مهره شما/);
  await expect(p.locator('.oth-flip')).not.toHaveCount(0);
  await expect(p.locator('.oth-sq--legal')).toHaveCount(0);
  await undo.click();
  await expect(cell).toHaveAttribute('aria-label', /می‌توانید بگذارید/);
  await expect(p.locator('.oth-lift')).toHaveCount(1);
  await expect(p.locator('.oth-flip')).not.toHaveCount(0);
  await p.context().close();
});
