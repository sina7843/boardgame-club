import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «قلعه‌سازان» end to end: the tutorial (road follower, closed road, city + surrounded monastery, final scoring) and a
// full two-player game.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/carcassonne/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: road, city, monastery, final scoring', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/carcassonne');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    for (let i = 0; i < 4 && (await p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`)).count()); i++) {
      const h = p.locator('.cc button.cc-hint:not([disabled])').first();
      // After the last click the step text lingers while the move is on its way; wait for the next hint instead.
      if (!(await h.waitFor({ timeout: 3000 }).then(() => true, () => false))) break;
      await h.click({ timeout: 3000 }).catch(() => {});
      if (step === '۴' && i === 1) await p.screenshot({ path: shot(info.project.name, 'tutorial-follower'), fullPage: true });
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const spots = p.locator('.cc-spot:not([disabled])');
  const k = await spots.count();
  if (!k) return false;
  await spots.nth(n % k).click();
  const chips = p.locator('.cc__follow .cc-chip:not([disabled])');
  if (n % 3 === 0 && (await chips.count()) > 1) await chips.nth(1).click();
  await p.getByRole('button', { name: 'گذاشتن کاشی' }).click();
  return true;
}

test('two players play «قلعه‌سازان» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/carcassonne/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite); await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cc__map')).toBeVisible();

  for (let n = 0; n < 300; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.cc').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.cc').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 30) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the placed tile flies from the dock to the map at once, and undo flies it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/carcassonne');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const onMap = p.locator('.cc__map [data-flip^="drawn-"]');
  const inDock = p.locator('.cc__drawn [data-flip^="drawn-"]');
  await motionLog(p);
  for (let i = 0; i < 4 && !(await undo.count()); i++) await p.locator('.cc button.cc-hint:not([disabled])').first().click();
  await expect(undo).toBeVisible();
  await expect(onMap).toHaveCount(1);
  await expect(inDock).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(inDock).toBeVisible();
  await expect(onMap).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
