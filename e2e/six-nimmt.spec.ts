import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «گاو شش» end to end: the tutorial (safe card, sixth card, play order, forced row choice, round scoring) and a
// one-round game for three players choosing at the same time, with row choices through the board.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/six-nimmt/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: play cards, then take a row', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/six-nimmt');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`))).toBeVisible();
    if (step === '۴') {
      await p.screenshot({ path: shot(info.project.name, 'tutorial-take'), fullPage: true });
      await p.locator('.sn-row--hint').click();
    } else await p.locator('.sn-card--hint:not([data-motion-ghost])').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo window: a taken row flies to my reveal at once, and undo puts it back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/six-nimmt');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۵`))).toBeVisible();
    await p.locator('.sn-card--hint:not([data-motion-ghost])').click();
  }
  await expect(p.getByText(/آموزش: مرحله ۴ از ۵/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(1500);
  await motionLog(p);
  const id = await p.locator('.sn-row--hint [data-flip]').first().getAttribute('data-flip');
  const inRow = p.locator(`.sn__rows [data-flip="${id}"]`);
  const took = p.locator(`.sn-rev__took [data-flip="${id}"]`);
  await p.locator('.sn-row--hint').click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(took).toBeVisible();
  await expect(inRow).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(inRow).toBeVisible();
  await expect(took).toHaveCount(0);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});

test('three players play one round at the same time', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/six-nimmt/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByText('یک دست', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.sn__rows')).toBeVisible();

  for (let n = 0; n < 200; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const rowBtn = p.locator('button.sn-row--take');
      const card = p.locator('.sn__hand button.sn-card');
      const target = (await rowBtn.count()) ? rowBtn.first() : (await card.count()) ? card.nth(n % (await card.count())) : null;
      if (!target) continue;
      const sig = async () => `${await p.locator('.sn').getAttribute('data-seq')}|${await p.locator('.sn').getAttribute('data-phase')}|${await p.locator('.sn').getAttribute('data-chosen')}`;
      const before = await sig();
      await target.click();
      await expect.poll(sig, { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
