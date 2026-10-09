import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «آرک نوا» end to end: the tutorial (Build → a 1-space enclosure by the water → Animals → a turtle → Association → the
// Reptiles project → the left-edge conservation token, tracks cross, learner wins) by following the highlighted hints,
// and a full two-player game to the result where both clients answer every prompt through the real UI.
test.describe.configure({ mode: 'serial', timeout: 3_600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/ark-nova/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const STEPS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷'];

test('interactive tutorial: build by the water, play a turtle, support a project and cross the tracks', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/ark-nova');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const done = p.getByRole('heading', { name: 'آموزش کامل شد' });
  for (const [i, n] of STEPS.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۷`))).toBeVisible();
    const next = i + 1 < STEPS.length ? p.getByText(new RegExp(`آموزش: مرحله ${STEPS[i + 1]} از ۷`)) : done;
    for (let k = 0; k < 10 && !(await next.count()); k++) {
      const hint = p.locator('.an .an-hint:not([disabled])').first();
      if (await hint.count()) await hint.click();
      if (i === 1 && k === 0) await p.screenshot({ path: shot(info.project.name, 'tutorial-build'), fullPage: true });
      await p.waitForTimeout(250);
    }
  }
  await expect(done).toBeVisible();
  await p.context().close();
});

/**
 * One decision for this client, if it has one (same policy as the engine and API tests): decision n takes the
 * (7n mod k)-th non-X choice, the minimum number of cards, and skips optional prompts every 3rd time.
 */
async function act(p: Page, n: number): Promise<boolean> {
  const draft = p.locator('[data-act="draft-cards"] button.an-card');
  if (await draft.count()) {
    for (let i = 0; i < 4; i++) await draft.nth(i).click();
    await p.locator('[data-act="draft"]').click();
    return true;
  }
  const panel = p.locator('.an-prompt');
  if (!(await panel.count())) return false;
  const skip = p.locator('[data-act="skip"]');
  const canSkip = (await skip.count()) > 0;
  const opts = p.locator('.an-options .an-opt');
  if (await opts.count()) {
    const real = p.locator('.an-options .an-opt:not([data-x])');
    const k = await real.count();
    if (canSkip && (n % 3 === 0 || !k)) { await skip.click(); return true; }
    await (k ? real.nth((7 * n) % k) : opts.first()).click();
    return true;
  }
  const pick = p.locator('[data-act="pick"]');
  if (await pick.count()) {
    if (canSkip && n % 3 === 0) { await skip.click(); return true; }
    const min = Number(await pick.getAttribute('data-min'));
    const cards = pick.locator('button.an-card');
    for (let i = 0; i < min; i++) await cards.nth(i).click();
    await p.locator('[data-act="submit"]').click();
    return true;
  }
  const places = p.locator('[data-act="placements"]');
  if (await places.count()) {
    if (canSkip && n % 3 === 0) { await skip.click(); return true; }
    const k = (await places.locator('option').count()) - 1;
    await places.selectOption({ index: 1 + ((7 * n) % k) });
    await p.locator('[data-act="place"]').click();
    return true;
  }
  return false;
}

test('two players build their zoos to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/ark-nova/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.an')).toBeVisible();

  let n = 0;
  for (let round = 0; round < 6000; round++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.an').getAttribute('data-seq');
      if (!(await act(p, n))) continue;
      n += 1;
      await expect.poll(() => p.locator('.an').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 40) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await expect(host.locator('.an-result')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
