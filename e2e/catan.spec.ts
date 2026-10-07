import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// Catan end to end: three independent clients set up a live table on the beginners' map, place both settlements and
// roads through the real UI (select → «ثبت»), then play regular turns (roll, discard / robber / steal on a 7, end turn).
// A full game to 10 points takes far too long for a browser run; the rules to the end are covered by engine tests.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const shot = (project: string, name: string) => `docs/evidence/catan/${project}-${name}.png`;
const TURNS = 8;

async function startTable(host: Page, guests: Page[]) {
  await host.goto('/games/catan/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('group', { name: 'نقشه' }).getByText('نقشه مبتدی دفترچه').click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of guests) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(host.getByText('بازیکنان (۳ از ۳)')).toBeVisible();
  await expect(host.getByText('نقشه: نقشه مبتدی دفترچه')).toBeVisible(); // chosen variant shown before ready
  for (const p of [host, ...guests]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

/** One move for this page if it has one; returns what it did (null = nothing to do). */
async function move(p: Page): Promise<string | null> {
  const discard = p.getByRole('region', { name: /دور ریختن/ });
  if (await discard.count()) {
    const submit = discard.getByRole('button', { name: /^دور ریختن/ });
    for (const more of await discard.getByRole('button', { name: /^بیشتر/ }).all()) {
      while (await submit.isDisabled() && await more.isEnabled()) await more.click();
    }
    await submit.click();
    return 'discard';
  }
  for (const [target, confirm] of [['.ct-vertex.ct-target', 'ساخت آبادی'], ['.ct-edge.ct-target', 'ساخت جاده'], ['.ct-hex.ct-target', 'بردن راهزن']] as const) {
    const t = p.locator(target);
    if (await t.count()) {
      await t.first().click({ timeout: 5000 });
      await p.getByRole('button', { name: confirm, exact: true }).click();
      return confirm;
    }
  }
  const steal = p.getByRole('region', { name: 'دزدی' }).getByRole('button');
  if (await steal.count()) { await steal.first().click(); return 'steal'; }
  const roll = p.getByRole('button', { name: 'ریختن تاس' });
  if (await roll.count()) { await roll.click(); return 'roll'; }
  const end = p.getByRole('button', { name: 'پایان نوبت' });
  if (await end.count() && await end.isEnabled()) { await end.click(); return 'end'; }
  return null;
}

const lastLog = (p: Page) => p.locator('.ct-log li').first().textContent();

test('three players set up Catan and play regular turns', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  const [a] = pages as [Page, Page, Page];
  await startTable(a, pages.slice(1));
  await expect(a.locator('.ct-board')).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  let ends = 0, placements = 0;
  const seen = new Set<string>();
  for (let i = 0; i < 400 && ends < TURNS; i++) {
    let acted = false;
    for (const p of pages) {
      const before = await lastLog(p);
      const did = await move(p);
      if (!did) continue;
      acted = true;
      seen.add(did);
      if (did === 'end') ends += 1;
      if (did === 'ساخت آبادی' || did === 'ساخت جاده') placements += 1;
      if (placements === 12 && did === 'ساخت جاده') for (const [k, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `setup-${k}`), fullPage: true });
      await expect.poll(async () => (await lastLog(p)) !== before, { timeout: 10_000 }).toBe(true);
      break;
    }
    if (!acted) await a.waitForTimeout(200);
  }
  expect(placements).toBeGreaterThanOrEqual(12); // both set-up rounds for three players
  expect(ends).toBe(TURNS);
  expect(seen.has('roll')).toBe(true);

  // Hidden information: each client shows only its own resource cards; others are counts.
  for (const p of pages) {
    await expect(p.locator('.ct-hand .ct-cards')).toHaveCount(1);
    await expect(p.locator('.ct-player__counts').first()).toContainText('کارت منبع');
  }
  for (const [k, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `turns-${k}`), fullPage: true });
  test.info().annotations.push({ type: 'moves', description: [...seen].join(',') });
  for (const p of pages) await p.context().close();
});
