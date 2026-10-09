import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «کاغذ و دریا» end to end: the tutorial (take, crab duo, boat duo + extra turn, draw two, stop) and a full
// three-player game over several rounds.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/sea-salt-paper/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: the last hand, from crab and boat duos to stop', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/sea-salt-paper');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const step = async (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۸`))).toBeVisible();
  const card = (where: string, id: number) => p.locator(`${where} .sp2-pick:has([data-flip="c-${id}"])`);
  await step('۱');
  await p.locator('.sp2-pile.sp2-hint').click();
  await step('۲');
  await card('.sp2__hand', 0).click();
  await card('.sp2__hand', 1).click();
  await p.getByRole('button', { name: 'خرچنگ‌ها: کپهٔ ۲' }).click();
  await step('۳');
  await card('.sp2__choice', 37).click();
  await step('۴');
  await card('.sp2__hand', 9).click();
  await card('.sp2__hand', 10).click();
  await p.getByRole('button', { name: /^بازی جفت/ }).click();
  await step('۵');
  await p.getByRole('button', { name: 'نوبت اضافه', exact: true }).click();
  await step('۶');
  await p.locator('.sp2-deck.sp2-hint').click();
  await step('۷');
  await card('.sp2__choice', 38).click();
  await p.locator('.sp2-pile').first().click();
  await step('۸');
  await p.screenshot({ path: shot(info.project.name, 'tutorial-stop'), fullPage: true });
  await p.getByRole('button', { name: 'بس!' }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const phase = await p.locator('.sp2').getAttribute('data-phase');
  const deck = p.locator('.sp2-deck:not([disabled])');
  const piles = p.locator('.sp2-pile--can:not([disabled])');
  if (phase === 'draw') {
    if (await deck.count() && (n % 2 || !(await piles.count()))) { await deck.click(); return true; }
    if (await piles.count()) { await piles.first().click(); return true; }
    return false;
  }
  const choice = p.locator('.sp2__choice .sp2-pick:not([disabled])');
  if (phase === 'choose' && await choice.count()) { await choice.first().click(); await p.locator('.sp2-pile--can:not([disabled])').first().click(); return true; }
  if (phase === 'crab' && await choice.count()) { await choice.first().click(); return true; }
  const stop = p.getByRole('button', { name: 'بس!' });
  const last = p.getByRole('button', { name: 'آخرین فرصت' });
  const pass = p.getByRole('button', { name: /^(پایان نوبت|نوبت اضافه)$/ });
  if (await stop.count() && n % 3 !== 1) { await stop.click(); return true; }
  if (await last.count()) { await last.click(); return true; }
  if (await pass.count()) { await pass.click(); return true; }
  return false;
}

test('three players play «کاغذ و دریا» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/sea-salt-paper/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sp2__sea')).toBeVisible();

  for (let n = 0; n < 800; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      if ((await p.locator('.sp2-pl--turn .sp2-pl__name').textContent()) !== 'شما') continue;
      const before = await p.locator('.sp2').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.sp2').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
