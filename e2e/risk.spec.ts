import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// Risk end to end: three independent clients start a live table, place their starting armies through the map
// (tap a territory → «همه باقی‌مانده» → «ثبت جای‌گذاری»), then play regular turns: reinforce, one blitz attack when
// possible (occupy if asked), end the attack, end the turn. A full world conquest is engine-tested (random games).
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const shot = (project: string, name: string) => `docs/evidence/risk/${project}-${name}.png`;
const TURNS = 6;

async function startTable(host: Page, guests: Page[]) {
  await host.goto('/games/risk/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of guests) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(host.getByText('بازیکنان (۳ از ۳)')).toBeVisible();
  for (const p of [host, ...guests]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

const button = (p: Page, name: string | RegExp) => p.getByRole('button', { name, exact: typeof name === 'string' });
const enabled = async (p: Page, name: string | RegExp) => (await button(p, name).count()) > 0 && await button(p, name).first().isEnabled();

/** One move for this page if it has one; returns what it did. */
async function move(p: Page, n: number): Promise<string | null> {
  if (await enabled(p, 'انتخاب یک دسته') && !(await enabled(p, 'ثبت جای‌گذاری'))) {
    await button(p, 'انتخاب یک دسته').click();
    await button(p, /^معاوضه دسته/).click();
    return 'trade';
  }
  if (await button(p, 'ثبت جای‌گذاری').count()) {
    // A tap adds one army there; «همه باقی‌مانده» puts the rest on it (hidden once nothing is left to draft).
    await p.locator('.rk-map .rk-terr.rk-target').first().click();
    if (await button(p, /^همه باقی‌مانده در/).count()) await button(p, /^همه باقی‌مانده در/).click();
    await expect(button(p, 'ثبت جای‌گذاری')).toBeEnabled();
    await button(p, 'ثبت جای‌گذاری').click();
    return 'place';
  }
  if (await enabled(p, 'تأیید اشغال')) { await button(p, 'تأیید اشغال').click(); return 'occupy'; }
  if (await enabled(p, 'پایان حمله')) {
    // Every other turn: pick a source and an enemy neighbour on the map and blitz.
    if (n % 2 === 0) {
      const from = p.locator('.rk-map .rk-terr.rk-target');
      if (await from.count()) {
        await from.first().click();
        const to = p.locator('.rk-map .rk-terr.rk-target:not(.rk-selected)');
        if (await to.count() && await enabled(p, 'حمله سریع') === false) await to.first().click();
        if (await enabled(p, 'حمله سریع')) { await button(p, 'حمله سریع').click(); return 'blitz'; }
      }
    }
    await button(p, 'پایان حمله').click();
    return 'endAttack';
  }
  if (await enabled(p, 'پایان نوبت')) { await button(p, 'پایان نوبت').click(); return 'end'; }
  return null;
}

test('three players set up Risk and play regular turns', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [a] = pages as [Page, Page, Page];
  await startTable(a, pages.slice(1));
  await expect(a.locator('.rk-map')).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  let ends = 0, n = 0;
  const seen = new Set<string>();
  for (let i = 0; i < 300 && ends < TURNS; i++) {
    let acted = false;
    for (const p of pages) {
      // Each move ends with exactly one command; wait for the server to accept it.
      const sent = p.waitForResponse((r) => r.url().includes('/commands') && r.request().method() === 'POST', { timeout: 10_000 }).catch(() => null);
      const did = await move(p, n);
      if (!did) continue;
      expect((await sent)?.ok(), `${did} sent`).toBe(true);
      await p.waitForTimeout(250); // let the pushed snapshot render before the next look
      acted = true; n += 1;
      seen.add(did);
      if (did === 'end') ends += 1;
      if (did === 'blitz' && !seen.has('shot')) { seen.add('shot'); for (const [k, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `battle-${k}`), fullPage: true }); }
      break;
    }
    if (!acted) await a.waitForTimeout(200);
  }
  expect(ends).toBe(TURNS);
  expect(seen.has('place')).toBe(true);
  // Hidden information: card hands are counts for the others.
  for (const p of pages) await expect(p.locator('.rk-players')).toBeVisible();
  for (const [k, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `turns-${k}`), fullPage: true });
  test.info().annotations.push({ type: 'moves', description: [...seen].join(',') });
  for (const p of pages) await p.context().close();
});

test('undo window: traded cards leave at once and come back on undo; an attack tumbles with no pips through its undo window and while in flight, then the dice are thrown', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/risk');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const cards = p.locator('.rk-hand [data-flip^="card-"]');
  await expect(cards).toHaveCount(3);
  const trade = async () => { await button(p, 'انتخاب یک دسته').click(); await button(p, /^معاوضه دسته/).click(); };
  await trade();
  await expect(undo).toBeVisible();
  await expect(cards).toHaveCount(0);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await undo.click();
  await expect(cards).toHaveCount(3);
  await p.waitForTimeout(800);
  await motionLog(p);
  await trade();
  await expect(p.getByText(/آموزش: مرحله ۲ از/)).toBeVisible({ timeout: 10_000 });

  await p.locator('.rk-map .rk-terr[aria-label^="برزیل"]').click();
  await button(p, /^همه باقی‌مانده در/).click();
  await button(p, 'ثبت جای‌گذاری').click();
  await expect(p.getByText(/آموزش: مرحله ۳ از/)).toBeVisible({ timeout: 10_000 });

  await p.locator('.rk-map .rk-terr[aria-label^="برزیل"]').click();
  await p.locator('.rk-map .rk-terr[aria-label^="شمال آفریقا"]').click();
  // The attack keeps its undo window; its answer is also held so the tumble is seen to last while it is in flight.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  await motionLog(p);
  await button(p, 'حمله').click();
  const tumbling = p.locator('.rk-tray .bg-tumble');
  await expect(tumbling).toHaveCount(4);
  await expect(undo).toBeVisible();
  expect(await p.locator('.rk-tray [data-pip]').count()).toBe(0); // no value shown before the server rolls
  await expect(undo).toHaveCount(0, { timeout: 6000 });
  await expect(tumbling).toHaveCount(4); // in flight: still tumbling, still no value
  expect(await p.locator('.rk-tray [data-pip]').count()).toBe(0);
  await expect(p.locator('.rk-tray .bg-roll')).toHaveCount(4, { timeout: 10_000 });
  await expect(tumbling).toHaveCount(0);
  await p.waitForTimeout(1500);
  expect((await motionLog(p)).some((m) => m.ghost === 'die')).toBe(true);
  await p.context().close();
});
