import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «کودتا» end to end: the tutorial (income, Duke block, Contessa bluff, exchange, caught bluff, failed challenge)
// and a three-player game through actions, challenges, blocks, lost influence and exchanges until one courtier is left.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/coup/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: a full two-player game of claims, blocks, bluffs and challenges', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/coup');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const steps = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];
  for (const step of steps) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`))).toBeVisible();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-start'), fullPage: true });
    if (step === '۶') {
      // Exchange: the options are [Duke, Ambassador, Duke, Duke]; keep the two drawn Dukes.
      await p.locator('.cp-ex__card').nth(0).click();
      await p.locator('.cp-ex__card').nth(2).click();
      await p.screenshot({ path: shot(info.project.name, 'tutorial-exchange'), fullPage: true });
      await p.getByRole('button', { name: /^نگه داشتن/ }).click();
    } else {
      await p.locator('.cp .cp-hint').click();
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function turn(p: Page, n: number): Promise<boolean> {
  const lose = p.locator('.cp-lose:not([disabled])');
  if (await lose.count()) { await lose.nth(n % (await lose.count())).click(); return true; }
  const ex = p.locator('.cp-ex__card');
  if (await ex.count()) {
    const keep = await p.locator('.cp-me__cards .cp-card:not(.cp-card--lost)').count();
    for (let i = 0; i < keep; i++) await ex.nth(i).click();
    await p.getByRole('button', { name: /^نگه داشتن/ }).click();
    return true;
  }
  const challenge = p.locator('.cp-resp__btn--challenge:not([disabled])');
  const block = p.locator('.cp-resp__btn--block:not([disabled])');
  const pass = p.locator('.cp-resp__btn--pass:not([disabled])');
  if (await challenge.count() && n % 3 === 0) { await challenge.click(); return true; }
  if (await block.count() && n % 4 === 1) { await block.first().click(); return true; }
  if (await pass.count()) { await pass.click(); return true; }
  const acts = p.locator('.cp-act:not([disabled])');
  const k = await acts.count();
  if (!k) return false;
  // Aggressive courtiers keep the game short: coup when possible, else assassinate/steal/tax, sometimes exchange.
  const prefer = ['coup', 'assassinate', n % 5 === 0 ? 'exchange' : 'steal', 'tax'];
  let pickd = acts.nth((n * 7) % k);
  for (const a of prefer) { const b = p.locator(`.cp-act--${a}:not([disabled])`); if (await b.count()) { pickd = b; break; } }
  const cls = (await pickd.getAttribute('class')) ?? '';
  await pickd.click();
  if (/cp-act--(coup|assassinate|steal)/.test(cls)) {
    const aim = p.locator('.cp-pl__aim');
    if (await aim.first().waitFor({ timeout: 1500 }).then(() => true, () => false)) await aim.nth(n % (await aim.count())).click();
  }
  return true;
}

test('three players play «کودتا» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [host] = pages as [Page, Page, Page];
  await host.goto('/games/coup/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.cp__court')).toBeVisible();

  let shots = 0;
  for (let n = 0; n < 800; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const sig = async () => `${await p.locator('.cp').getAttribute('data-seq')}|${await p.locator('.cp').getAttribute('data-phase')}|${await p.locator('.cp-resp, .cp-lose, .cp-ex').count()}`;
      const before = await sig();
      const phase = await p.locator('.cp').getAttribute('data-phase');
      if (!(await turn(p, n))) continue;
      await expect.poll(sig, { timeout: 10_000 }).not.toBe(before);
      if (shots < 3 && (phase === 'respond' || phase === 'lose' || n === 6)) {
        shots++;
        for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid${shots}-${i}`), fullPage: true });
      }
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('instant keep (no undo): kept exchange cards fly into the hand while the keep is in flight, the rest back to the deck, and the exchange ends with the answer', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/coup');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۸`))).toBeVisible();
    await p.locator('.cp .cp-hint').click();
  }
  await expect(p.getByText(/آموزش: مرحله ۶ از ۸/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.locator('.cp-ex__card').nth(0).click();
  await p.locator('.cp-ex__card').nth(2).click();
  await p.waitForTimeout(800);
  // Keeping is sent at once despite the window (no undo); hold its answer so the in-flight preview can be seen.
  let answered = false;
  await p.route('**/api/tables/*/commands', async (route) => {
    if (route.request().method() === 'POST') { await new Promise((ok) => setTimeout(ok, 1500)); answered = true; }
    await route.continue();
  });
  await motionLog(p);
  await p.getByRole('button', { name: /^نگه داشتن/ }).click();
  await expect(p.locator('.cp-ex')).toHaveCount(0);
  await expect(p.locator('.cp-me__cards [data-flip="ex-0"]')).toBeVisible();
  await expect(p.locator('.cp-me__cards [data-flip="ex-2"]')).toBeVisible();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  expect(answered).toBe(false);
  await p.waitForTimeout(700);
  const kinds = (await motionLog(p)).map((m) => m.ghost);
  expect(kinds).toContain('fly');
  expect(kinds).toContain('exit');
  // After the answer the tutorial moves on and the exchange stays closed.
  await expect(p.getByText(/آموزش: مرحله ۷ از ۸/)).toBeVisible({ timeout: 10_000 });
  await expect(p.locator('.cp-ex')).toHaveCount(0);
  await p.context().close();
});
