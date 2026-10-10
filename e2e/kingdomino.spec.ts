import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «قلمرو» end to end: the tutorial (the last two rounds: placing, rotating, picking ahead) and a full three-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/kingdomino/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: place, rotate, pick the next domino, confirm', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/kingdomino');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    while (await p.locator('.kd-rot.kd-hint').count()) await p.locator('.kd-rot').click();
    await p.locator('.kd-slot.kd-hint').click();
    // The first two steps also pick the next round's domino (highlighted in the next line).
    if (await p.locator('button.kd-pick.kd-hint').count()) await p.locator('button.kd-pick.kd-hint').click();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-place'), fullPage: true });
    await p.getByRole('button', { name: 'تأیید' }).click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page): Promise<boolean> {
  const free = p.locator('button.kd-dom--free');
  const confirm = p.getByRole('button', { name: /^(تأیید|دور انداختن)$/ });
  if (!(await confirm.count())) {
    if (await free.count()) { await free.first().click(); return true; }
    return false;
  }
  if ((await confirm.textContent())?.includes('تأیید')) {
    for (let i = 0; i < 4 && !(await p.locator('[data-ok]').count()); i++) await p.locator('.kd-rot').click();
    await p.locator('[data-ok]').first().click();
  }
  if (await free.count()) await free.first().click();
  await confirm.click();
  return true;
}

test('three players play «قلمرو» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/kingdomino/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.kd__lines')).toBeVisible();

  for (let n = 0; n < 200; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.kd').getAttribute('data-seq');
      if (!(await turn(p))) continue;
      await expect.poll(() => p.locator('.kd').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('undo window: the placed domino lands in your kingdom at once, and undo lifts it back to the line', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/kingdomino');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۴/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const filled = p.locator('.kd-kingdom--big [data-flip]');
  const before = await filled.count();
  await p.locator('.kd-slot.kd-hint').click();
  await p.locator('button.kd-pick.kd-hint').click();
  await motionLog(p);
  await p.getByRole('button', { name: 'تأیید' }).click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(filled).toHaveCount(before + 2);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(filled).toHaveCount(before);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.context().close();
});
