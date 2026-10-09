import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «هم‌فکر» end to end: the tutorial (one teaching level: plays, a teammate's mistake, a throwing star) and a full
// three-player cooperative game: the lowest card is played each time, with a couple of deliberate mistakes and a
// throwing star, until the team wins or runs out of lives.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/the-mind/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: plays, a mistake, a throwing star', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/the-mind');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۴`))).toBeVisible();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial'), fullPage: true });
    // Step 3 proposes the throwing star (the star button carries no hint highlight).
    if (step === '۳') await p.locator('button.tm-star').click();
    else await p.locator('.tm-play.tm-hint').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('three players play «هم‌فکر» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/the-mind/new');
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.tm__center')).toBeVisible();

  let mistakes = 0;
  let starred = false;
  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    const lows = await Promise.all(pages.map(async (p) => {
      const b = p.locator('.tm-play:not([disabled])');
      return (await b.count()) ? Number(await b.getAttribute('data-card')) : Infinity;
    }));
    if (lows.every((x) => x === Infinity)) { await host.waitForTimeout(100); continue; }
    const before = await host.locator('.tm').getAttribute('data-seq');
    if (!starred && n === 8 && lows.every((x) => x !== Infinity)) {
      starred = true;
      for (const p of pages) await p.locator('.tm-star').click();
    } else {
      const finite = lows.filter((x) => x !== Infinity);
      const pick = mistakes < 2 && n % 9 === 4 && finite.length > 1 ? Math.max(...finite) : Math.min(...finite);
      if (pick !== Math.min(...finite)) mistakes++;
      await pages[lows.indexOf(pick)]!.locator('.tm-play').click();
    }
    await expect.poll(() => host.locator('.tm').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
    if (n === 9 || (n > 4 && mistakes === 1 && n % 9 === 4)) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid${n}-${i}`), fullPage: true });
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
