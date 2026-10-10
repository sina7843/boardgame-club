import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// Ticket to Ride end to end: three independent clients start a live table on a chosen map, keep their destination
// tickets at the same time, then play turns through the UI: claim a highlighted route when one is affordable (tap it
// → «ساخت مسیر»), otherwise draw from the deck. A full game to the last round is engine-tested (random games).
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const shot = (project: string, map: string, name: string) => `docs/evidence/ticket-to-ride/${project}-${map}-${name}.png`;
const MAPS: Record<string, { label: string; project: string }> = {
  iran: { label: 'ایران', project: 'mobile-360' },
  europe: { label: 'اروپا', project: 'desktop-1440' },
  usa: { label: 'آمریکای شمالی (کلاسیک)', project: 'desktop-1440' }
};
const CLAIMS = 3;

async function startTable(host: Page, guests: Page[], mapLabel: string) {
  await host.goto('/games/ticket-to-ride/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByText(mapLabel, { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of guests) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(host.getByText('بازیکنان (۳ از ۳)')).toBeVisible();
  for (const p of [host, ...guests]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

const button = (p: Page, name: string | RegExp) => p.getByRole('button', { name, exact: typeof name === 'string' });
const enabled = async (p: Page, name: string | RegExp) => (await button(p, name).count()) > 0 && await button(p, name).first().isEnabled();

/** One command for this page if it has one; returns what it did. */
async function move(p: Page): Promise<string | null> {
  if (await enabled(p, /^نگه داشتن/)) { await button(p, /^نگه داشتن/).click(); return 'keep'; }
  const route = p.locator('.ttr-map .ttr-route--can');
  if (await route.count()) {
    await route.first().click();
    await expect(button(p, 'ساخت مسیر')).toBeEnabled();
    await button(p, 'ساخت مسیر').click();
    return 'claim';
  }
  if (await enabled(p, /^کشیدن از دسته بسته/)) { await button(p, /^کشیدن از دسته بسته/).click(); return 'draw'; }
  return null;
}

for (const [map, cfg] of Object.entries(MAPS)) {
  test(`three players keep tickets and build routes on the ${map} map`, async ({ browser }, info) => {
    test.skip(info.project.name !== cfg.project, `the ${map} map runs at ${cfg.project}`);
    const vp = info.project.use.viewport ?? null;
    const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
    const [a] = pages as [Page, Page, Page];
    await startTable(a, pages.slice(1), cfg.label);
    await expect(a.locator('.ttr-map')).toBeVisible();
    await expect(a.getByRole('group', { name: new RegExp(`نقشه ${cfg.label.split(' ')[0]}`) }).first()).toBeVisible();
    await a.screenshot({ path: shot(info.project.name, map, 'tickets'), fullPage: true });

    let claims = 0, keeps = 0;
    for (let i = 0; i < 400 && claims < CLAIMS; i++) {
      let acted = false;
      for (const p of pages) {
        const sent = p.waitForResponse((r) => r.url().includes('/commands') && r.request().method() === 'POST', { timeout: 10_000 }).catch(() => null);
        const did = await move(p);
        if (!did) continue;
        expect((await sent)?.ok(), `${did} sent`).toBe(true);
        await p.waitForTimeout(250); // let the pushed snapshot render before the next look
        acted = true;
        if (did === 'keep') keeps += 1;
        if (did === 'claim') claims += 1;
        break;
      }
      if (!acted) await a.waitForTimeout(200);
    }
    expect(keeps).toBe(3);
    expect(claims).toBe(CLAIMS);
    // Hidden information: other hands and tickets are counts only.
    for (const p of pages) await expect(p.locator('.ttr-players')).toBeVisible();
    await expect(a.locator('.ttr-route--owned')).toHaveCount(CLAIMS);
    for (const [k, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, map, `play-${k}`), fullPage: true });
    for (const p of pages) await p.context().close();
  });
}

test('undo window: a face-up card flies to the hand at once, and undo puts it back in the row', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/ticket-to-ride');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.locator('.ttr-ticket--pick').nth(2).click();
  await p.locator('.ttr-hintbtn').click();
  await expect(p.getByText(/آموزش: مرحله ۲ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const locos = p.locator('.ttr-handcard').filter({ hasText: 'لوکوموتیو' }).locator('.ttr-handcard__n');
  const before = await locos.textContent();
  const slot = p.locator('.ttr-cards > li').nth(2);
  await slot.locator('button.ttr-hintbtn').click();
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(slot.locator('.ttr-card--empty')).toBeVisible();
  await expect(locos).not.toHaveText(before!);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(slot.locator('button.ttr-hintbtn')).toBeVisible();
  await expect(locos).toHaveText(before!);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.context().close();
});
