import { expect, test, type Page, type TestInfo, type Browser, type Route } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// Snakes and Ladders (3 players) and Ludo (2 players) played to the result through the real UI: roll, and in Ludo
// tap a movable piece. Each click waits for the server to accept the command.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;

async function table(browser: Browser, info: TestInfo, gameId: string, n: number): Promise<Page[]> {
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')].slice(0, n);
  const host = pages[0]!;
  await host.goto(`/games/${gameId}/new`);
  await host.getByText('زنده', { exact: true }).click();
  const count = host.getByLabel('تعداد بازیکن');
  if (await count.count()) await count.first().selectOption(String(n));
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of pages.slice(1)) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(host.getByText(`بازیکنان (${n.toLocaleString('fa-IR')} از ${n.toLocaleString('fa-IR')})`)).toBeVisible();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  return pages;
}

/** Click once and wait for the command to be accepted. */
async function click(p: Page, target: ReturnType<Page['locator']>) {
  const sent = p.waitForResponse((r) => r.url().includes('/commands') && r.request().method() === 'POST', { timeout: 10_000 });
  await target.click();
  expect((await (await sent).json()).status).toBe('accepted');
}

async function playOut(pages: Page[], info: TestInfo, tag: string, root: string, decide: (p: Page) => Promise<ReturnType<Page['locator']> | null>) {
  const shot = (name: string) => `docs/evidence/race/${info.project.name}-${tag}-${name}.png`;
  await expect(pages[0]!.locator(root)).toBeVisible();
  await pages[0]!.screenshot({ path: shot('start'), fullPage: true });
  let n = 0;
  for (; n < 2000; n++) {
    if (await pages[0]!.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const target = await decide(p);
      if (target) { await click(p, target); acted = true; break; }
    }
    if (!acted) await pages[0]!.waitForTimeout(100);
    if (n === 12) for (const [i, p] of pages.entries()) await p.screenshot({ path: shot(`mid-${i}`), fullPage: true });
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await pages[0]!.screenshot({ path: shot('result'), fullPage: true });
  test.info().annotations.push({ type: `${tag} clicks`, description: String(n) });
  for (const p of pages) await p.context().close();
}

const only = (info: TestInfo) => test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
const enabled = async (l: ReturnType<Page['locator']>) => (await l.count()) > 0 && (await l.first().isEnabled());

test('three players race to 100 in Snakes and Ladders', async ({ browser }, info) => {
  only(info);
  const pages = await table(browser, info, 'snakes-ladders', 3);
  await playOut(pages, info, 'snakes', '.sl-board', async (p) => {
    const roll = p.locator('.sl').getByRole('button', { name: 'تاس بریز' });
    return (await enabled(roll)) ? roll.first() : null;
  });
});

test('two players play Ludo until all four pieces of one player are home', async ({ browser }, info) => {
  only(info);
  const pages = await table(browser, info, 'ludo', 2);
  await playOut(pages, info, 'ludo', '.ld-board', async (p) => {
    const move = p.locator('.ld-choices button');
    if (await enabled(move)) return move.first();
    const roll = p.locator('.ld').getByRole('button', { name: 'تاس بریز' });
    return (await enabled(roll)) ? roll.first() : null;
  });
});

test('ludo: an instant roll (no undo) tumbles without pips while in flight until the result; a queued move walks the piece and undo walks it back', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/ludo');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const roll = p.locator('.ld').getByRole('button', { name: 'تاس بریز' });
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const tumble = p.locator('.ld-die.bg-tumble');
  // The roll is sent at once despite the window (no undo); hold its answer so the in-flight tumble can be seen.
  const delay = async (route: Route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); };
  await p.route('**/api/tables/*/commands', delay);
  await roll.click();
  await expect(tumble).toBeVisible();
  await expect(p.locator('.ld-die circle')).toHaveCount(0);
  await expect(undo).toHaveCount(0);
  // Pips only once the server answered, then the die is thrown on the top layer and the piece walks.
  await expect(p.getByRole('img', { name: 'تاس: ۶' })).toBeVisible({ timeout: 10_000 });
  await expect(tumble).toHaveCount(0);
  await p.unroute('**/api/tables/*/commands', delay);
  await p.waitForTimeout(1500);
  let log = await motionLog(p);
  expect(log.some((m) => m.ghost === 'die')).toBe(true);
  expect(log.some((m) => m.cls.includes('ld-piece'))).toBe(true);
  await roll.click();
  await expect(p.getByRole('img', { name: 'تاس: ۵' })).toBeVisible({ timeout: 10_000 });
  await p.waitForTimeout(1200);
  // Queued move: the piece walks to its target at once; undo walks it back.
  const piece = p.locator('[data-pawn="0-3"]');
  const home = await piece.boundingBox();
  await motionLog(p);
  await p.locator('.ld-choices button').filter({ hasText: 'مهره ۴' }).click();
  await expect(undo).toBeVisible();
  await expect.poll(async () => Math.round((await piece.boundingBox())!.x - home!.x), { timeout: 3000 }).not.toBe(0);
  log = await motionLog(p);
  expect(log.some((m) => m.cls.includes('ld-piece'))).toBe(true);
  await undo.click();
  await expect.poll(async () => Math.abs((await piece.boundingBox())!.x - home!.x) + Math.abs((await piece.boundingBox())!.y - home!.y), { timeout: 4000 }).toBeLessThan(2);
  expect((await motionLog(p)).some((m) => m.cls.includes('ld-piece'))).toBe(true);
  await p.context().close();
});

test('snakes: an instant roll (no undo) tumbles without pips while in flight, then is thrown and the token walks and climbs', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/snakes-ladders');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const roll = p.locator('.sl').getByRole('button', { name: 'تاس بریز' });
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  const tumble = p.locator('.sl-die.bg-tumble');
  // The roll is sent at once despite the window (no undo); hold its answer so the in-flight tumble can be seen.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  // 5 from 66 → 71, ladder to 91. Pips only once the server answered; the die is thrown, the token walks.
  await roll.click();
  await expect(tumble).toBeVisible();
  await expect(p.locator('.sl-die circle')).toHaveCount(0);
  await expect(undo).toHaveCount(0);
  // The tutorial opponent answers at once, so check the result on the board rather than on the die.
  await expect(p.getByRole('img', { name: /نوآموز روی خانه ۹۱/ })).toBeVisible({ timeout: 10_000 });
  await expect(p.locator('.sl-die circle')).not.toHaveCount(0);
  await p.waitForTimeout(1500);
  const log = await motionLog(p);
  expect(log.some((m) => m.ghost === 'die')).toBe(true);
  expect(log.some((m) => m.cls.includes('sl-walk'))).toBe(true);
  await p.context().close();
});
