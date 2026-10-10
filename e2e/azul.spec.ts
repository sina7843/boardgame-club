import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «آزول» end to end: the tutorial (one full teaching round to the end of the game) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/azul/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: a full teaching round (factory, centre + marker, colour rule, wall scoring)', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/azul');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`))).toBeVisible();
    await p.locator('.az-grp.az-hint').click();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-pick'), fullPage: true });
    await p.locator('button.az-line.az-hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const groups = p.locator('.az-grp:not([disabled])');
  const k = await groups.count();
  if (!k) return false;
  await groups.nth((n * 3) % k).click();
  const lines = p.locator('button.az-line');
  const l = await lines.count();
  if (l) await lines.nth(n % l).click(); else await p.locator('button.az-floor').click();
  return true;
}

test('three players play «کاشی‌کار» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/azul/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.az__market')).toBeVisible();

  for (let n = 0; n < 500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.az').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.az').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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

test('undo window: the taken tiles fly onto the line at once, and undo flies them back to the factory', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/azul');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const id = await p.locator('.az-grp.az-hint [data-flip]').first().getAttribute('data-flip');
  const inMarket = p.locator(`.az__market [data-flip="${id}"]`);
  const onLine = p.locator(`.az-board--me .az-lines [data-flip="${id}"]`);
  await p.locator('.az-grp.az-hint').click();
  await p.locator('button.az-line.az-hint').click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(onLine).toBeVisible();
  await expect(inMarket).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(inMarket).toBeVisible();
  await expect(onLine).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
