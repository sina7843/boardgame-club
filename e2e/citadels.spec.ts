import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «ارگ‌ها» end to end: the tutorial (income choice, warlord, the eighth district, end) and a full three-player game (two characters each).
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/citadels/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: income choice, keep, build, warlord, eighth district, end', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/citadels');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const hint = p.locator('button.ct2-hint');
  // The renderer highlights gold, build and end; "two cards", keep and destroy use their own buttons.
  const clicks = [
    p.getByRole('button', { name: 'دو کارت' }),
    p.locator('.ct2__bar .ct2-pick'),
    hint, hint, hint,
    p.getByRole('button', { name: /تخریب زندان/ }),
    hint, hint
  ];
  const fa = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];
  for (const [i, target] of clicks.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${fa[i]} از ۸`))).toBeVisible();
    if (i === 6) await p.screenshot({ path: shot(info.project.name, 'tutorial-build'), fullPage: true });
    await target.first().click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const pool = p.locator('.ct2__pool .ct2-pick');
  if (await pool.count()) { await pool.nth(n % (await pool.count())).click(); return true; }
  const gold = p.getByRole('button', { name: '۲ طلا', exact: true });
  if (await gold.count()) { await (n % 5 === 0 ? p.getByRole('button', { name: 'دو کارت' }) : gold).click(); return true; }
  const keep = p.locator('.ct2__bar .ct2-pick');
  if (await keep.count()) { await keep.first().click(); return true; }
  const build = p.locator('.ct2__hand .ct2-pick--can:not([disabled])');
  if (await build.count() && n % 4 !== 0) { await build.first().click(); return true; }
  const end = p.locator('.ct2__me').getByRole('button', { name: 'پایان نوبت' });
  if (await end.count()) { await end.click(); return true; }
  return false;
}

test('three players play «ارگ‌ها» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/citadels/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ct2__track')).toBeVisible();

  for (let n = 0; n < 900; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ct2').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.ct2').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 25) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
