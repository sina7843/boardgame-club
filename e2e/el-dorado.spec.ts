import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «راه الدورادو» end to end: the tutorial (water, split jungle points, buy, refill, rubble, arrive, end of round) and a full three-player race.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const GAME = 'el-dorado';
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/${GAME}/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: water, jungle, buy, rubble, arrive', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto(`/games/${GAME}`);
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`));
    await expect(label).toBeVisible();
    if (step === '۲') await p.screenshot({ path: shot(info.project.name, 'tutorial-move'), fullPage: true });
    // Rubble is paid with cards: mark the first hand card (the sailor) «برای آوار» before the hex lights up.
    if (step === '۶') await p.locator('.ed-me .ed-mini', { hasText: 'برای آوار' }).first().click();
    for (let i = 0; i < 3 && (await label.count()); i++) {
      const h = p.locator('.ed .ed-hint:not([disabled])').first();
      if (!(await h.count())) break;
      await h.click();
      // A click either selects a card (label stays) or sends the step's move (label goes); wait briefly to tell which.
      await expect.poll(() => label.count(), { timeout: 1500 }).toBe(0).catch(() => undefined);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

const BUY = ['پیشگام', 'راه‌گشا', 'ماجراجو', 'ناخدا', 'پیشاهنگ', 'همه‌کاره'];
/** Clicks a lit hex in a higher row than the pawn (rows grow toward El Dorado); false when none. */
async function advance(p: Page, row: number) {
  const lit = p.locator('.ed .ed-hex--can');
  for (let i = 0; i < await lit.count(); i++) {
    const hex = Number(await lit.nth(i).getAttribute('data-hex'));
    if (Math.floor(hex / 6) > row) { await lit.nth(i).click(); return true; }
  }
  return false;
}

async function turn(p: Page, n: number): Promise<boolean> {
  const game = p.locator('.ed');
  const end = game.getByRole('button', { name: 'پایان نوبت', exact: true });
  if (!(await end.count())) return false;
  const seat = await p.locator('.ed-crew__p').evaluateAll((els) => els.findIndex((e) => e.classList.contains('is-now')));
  const row = Math.floor(Number(await game.locator(`circle[data-seat="${seat}"]`).getAttribute('data-hex')) / 6);
  if (await advance(p, row)) return true;
  const cards = game.locator('.ed-hand .ed-pick:not([disabled])');
  for (let i = 0; i < await cards.count(); i++) {
    await cards.nth(i).click();
    if (await advance(p, row)) return true;
    await cards.nth(i).click();
  }
  if (n % 2 === 0) for (const name of BUY) {
    const buy = game.locator('.ed-buy.is-can:not([disabled])').filter({ hasText: name });
    if (await buy.count()) { await buy.first().click(); return true; }
  }
  const dump = game.getByRole('button', { name: 'پایان نوبت و دور ریختن دست' });
  await (await dump.count() ? dump : end).click();
  return true;
}

test('three players race to the result', async ({ browser }, info) => {
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
  await expect(host.locator('.ed-board')).toBeVisible();

  for (let n = 0; n < 4000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ed').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.ed').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
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
