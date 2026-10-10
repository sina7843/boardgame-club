import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «تررافورمینگ مارس» end to end: the tutorial (the last generation: titanium payment, heat → temperature, an aquifer
// ocean, a greenery next to a city, a milestone, the final scoring) by following the highlighted hints, and a full
// two-player game to the result where both clients raise the global parameters through the standard projects.
test.describe.configure({ mode: 'serial', timeout: 2_400_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/terraforming-mars/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const STEPS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];

test('interactive tutorial: titanium, heat, an ocean, a greenery by the city, a milestone and the final score', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/terraforming-mars');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const done = p.getByRole('heading', { name: 'آموزش کامل شد' });
  for (const [i, n] of STEPS.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۸`))).toBeVisible();
    const next = i + 1 < STEPS.length ? p.getByText(new RegExp(`آموزش: مرحله ${STEPS[i + 1]} از ۸`)) : done;
    for (let k = 0; k < 10 && !(await next.count()); k++) {
      const hint = p.locator('.tm .tm-hint:not([disabled])').first();
      if (await hint.count()) await hint.click();
      await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0); // the move left the undo window
      if (i === 3 && k === 0) await p.screenshot({ path: shot(info.project.name, 'tutorial-ocean'), fullPage: true });
      await p.waitForTimeout(250);
    }
  }
  await expect(done).toBeVisible();
  await p.context().close();
});

test('undo window: the played event leaves the hand at once, the ocean appears on its space, and undo brings both back', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/terraforming-mars');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۸/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  const card = p.locator('.tm-hand [data-flip="card-009"]');
  await expect(card).toBeVisible();
  await p.waitForTimeout(800);
  await motionLog(p);
  await card.getByRole('button', { name: 'بازی' }).click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(card).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await undo.click();
  await expect(card).toBeVisible();
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  // Steps 1–3 for real, then the ocean on space 63 is previewed on the map and undone.
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '0'));
  for (const n of ['۲', '۳', '۴']) {
    const step = p.getByText(new RegExp(`آموزش: مرحله ${n} از ۸`));
    for (let k = 0; k < 10 && !(await step.count()); k++) { const h = p.locator('.tm .tm-hint:not([disabled])').first(); if (await h.count()) await h.click(); await p.waitForTimeout(250); }
    await expect(step).toBeVisible();
  }
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  const hex = p.locator('.tm-board [data-space="63"]');
  await expect(hex).toHaveClass(/tm-hex--pick/);
  await hex.click();
  await expect(undo).toBeVisible();
  await expect(hex.locator('image')).toHaveCount(1);
  await undo.click();
  await expect(hex.locator('image')).toHaveCount(0);
  await p.context().close();
});

/** One decision for this client if it has one; returns false when it is not this client's move. */
async function act(p: Page): Promise<boolean> {
  const click = async (sel: string) => {
    const l = p.locator(sel).first();
    if (!(await l.count()) || (await l.isDisabled())) return false;
    await l.click();
    return true;
  };
  // Simultaneous picks: the first corporation without cards, then buy no research cards.
  if (await p.locator('.tm-corps .tm-card').count()) {
    await p.locator('.tm-corps .tm-card').first().click();
    return click('[data-act="corp"]');
  }
  if (await click('[data-act="research"]')) return true;
  if (await p.locator('.tm-pay').count()) return click('[data-act="pay"]');
  // Prompts: skip optional ones, otherwise take the first legal option.
  if (await p.locator('.tm-prompt').count()) {
    if (await click('[data-act="skip"]')) return true;
    if (await click('.tm-hex--pick')) return true;
    if (await click('.tm-offmap button:not([disabled])')) return true;
    if (await click('.tm-prompt .tm-row button')) return true;
    if (await click('.tm-prompt button.tm-card')) return true;
    if (await click('[data-act="amount"]')) return true;
    return click('[data-act="cards"]');
  }
  for (const a of ['firstAction', 'convertHeat', 'convertPlants', 'project-asteroid', 'project-aquifer', 'project-greenery', 'pass']) {
    if (await click(`[data-act="${a}"]`)) return true;
  }
  return false;
}

test('two players terraform Mars to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/terraforming-mars/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.tm-board')).toBeVisible();

  for (let n = 0; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.tm').getAttribute('data-seq');
      if (!(await act(p))) continue;
      // The payment picker is local (no server step); everything else advances the table.
      if (await p.locator('.tm-pay').count()) { acted = true; continue; }
      await expect.poll(() => p.locator('.tm').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 30) for (const [i, q] of pages.entries()) {
        await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
        await q.locator('.tm-players').screenshot({ path: shot(info.project.name, `boards-${i}`) }); // own board + opponents
      }
      acted = true;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await expect(host.locator('.tm-result')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
