import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «کوریدور» end to end: the tutorial (wall, then the winning step) and a two-player race that mixes walls and steps,
// played through the board (lit tiles, groove crossings).
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/quoridor/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: block with a wall, then step onto the goal row', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/quoridor');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۲/)).toBeVisible();
  await p.locator('.qd-x--hint').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۲/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-2'), fullPage: true });
  await p.locator('.qd-tile--hint').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('two players race to the far edge with walls on the way', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/quoridor/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.qd-board')).toBeVisible();

  let walls = 0;
  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const tiles = p.locator('.qd-tile--lit');
      const wallBtn = p.getByRole('button', { name: /^دیوار/ });
      if (!(await tiles.count()) && !(await wallBtn.count())) continue;
      const before = await p.locator('.qd').getAttribute('data-seq');
      if (walls < 4 && n % 3 === 1 && await wallBtn.isEnabled()) {
        await wallBtn.click();
        if (walls % 2) await p.getByRole('button', { name: '┃ عمودی', exact: true }).click();
        await p.locator('.qd-x--ok').nth(5 + walls * 9).click();
        walls++;
        if (walls === 2) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `walls-${i}`), fullPage: true });
      } else {
        await p.getByRole('button', { name: 'حرکت مهره' }).click();
        // Step along a shortest path (tiles carry their distance to the goal).
        const ds = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-d'))));
        await tiles.nth(ds.indexOf(Math.min(...ds))).click();
      }
      await expect.poll(() => p.locator('.qd').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
