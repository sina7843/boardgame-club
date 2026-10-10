import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «خدمه: اعماق دریا» end to end: the tutorial (draft conditions, tricks, communicate, rocket, last trick) and a full three-player mission.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'crew-deep-sea';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: draft conditions, follow suit, communicate, rocket, last trick', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۷`));
    await expect(label).toBeVisible();
    if (step === '۵') await p.screenshot({ path: shot(info.project.name, 'tutorial-comm'), fullPage: true });
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.cw .cw-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      await expect(p.locator('.cw .cw-hint[disabled]')).toHaveCount(0);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page): Promise<boolean> {
  const game = p.locator('.cw');
  const task = game.locator('button.cw-task--can');
  if (await task.count()) { await task.first().click(); return true; }
  const card = game.locator('.cw-hand .cw-pick--can:not([disabled])');
  if (await card.count()) { await card.last().click(); return true; }
  return false;
}

test('three players fly a mission to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto(`/games/${GAME}/new`);
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cw-tasks')).toBeVisible();

  for (let n = 0; n < 2000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cw').getAttribute('data-seq');
      if (!(await turn(p))) continue;
      await expect.poll(() => p.locator('.cw').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 4) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

// The shared Crew table previews the queued move; the sea edition gets it through the props it passes on.
test('undo window: a played card flies to the trick at once, and undo flies it back to the hand', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۷/)).toBeVisible({ timeout: 25_000 });
  const playHint = p.locator('.cw-hand button.cw-hint:not([disabled])');
  for (let i = 0; i < 6 && !(await playHint.count()); i++) {
    await p.locator('.cw .cw-hint:not([disabled])').first().click();
    await expect(p.locator('.cw .cw-hint[disabled]')).toHaveCount(0);
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(800);
  await motionLog(p);
  const id = await playHint.getAttribute('data-flip');
  const inHand = p.locator(`.cw-hand [data-flip="${id}"]`);
  const inTrick = p.locator(`.cw-trick [data-flip="${id}"]`);
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await playHint.click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(inTrick).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(inHand).toBeVisible();
  await expect(inTrick).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
