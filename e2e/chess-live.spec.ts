import { expect, test, type Browser, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// Chess live-fix platform behaviour (design/games/chess/livefix/CHESS-FIX-SPEC.md, section D): presence, rematch,
// draw-decline notice, premove latency and optimistic moves. Needs the dev stack (api, web, worker, migrated DB).
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.skip(({ isMobile }) => isMobile, 'one viewport is enough for platform behaviour');

const square = (p: Page, name: string) => p.locator(`.ch-board button[aria-label^="${name}،"]`);
async function move(p: Page, from: string, to: string) {
  await square(p, from).click();
  await expect(square(p, to)).toHaveAttribute('aria-label', /حرکت به اینجا|زدن/);
  await square(p, to).click();
}

/** Friend table with the host as White: the invited friend joining starts it (U3, no «آماده‌ام»). */
async function startGame(browser: Browser, vp: { width: number; height: number } | null) {
  const [white, black] = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  await white.goto('/games/chess/new');
  await white.getByRole('radiogroup', { name: 'نوع بازی' }).getByRole('radio', { name: 'با دوست' }).click();
  await white.getByRole('radiogroup', { name: 'رنگ شما' }).getByRole('radio', { name: 'سفید' }).click();
  await white.getByRole('button', { name: 'بازی کن' }).click();
  const invite = (await white.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await black.goto(invite);
  await black.getByRole('button', { name: 'پیوستن به میز' }).click();
  await expect(white.locator('.ch-board')).toBeVisible();
  await expect(black.locator('.ch-board')).toBeVisible();
  return { white, black };
}
const closeAll = async (...ps: Page[]) => { for (const p of ps) await p.context().close(); };

test('presence: a connected opponent is never «قطع»; a real network loss shows it after about 5 s', async ({ browser }, info) => {
  const { white, black } = await startGame(browser, info.project.use.viewport ?? null);
  await move(white, 'e2', 'e4');
  await move(black, 'e7', 'e5');
  await white.waitForTimeout(7000); // longer than the 5 s rule; black is connected the whole time
  await expect(white.getByText('قطع', { exact: true })).toHaveCount(0);
  await black.context().setOffline(true); // closes the WebSocket for real
  await expect(white.getByText('قطع', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await black.context().setOffline(false);
  await expect(white.getByText('قطع', { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await closeAll(white, black);
});

test('rematch: the other side sees «قبول / رد»; accepting opens a new game at /t/<code> with colours swapped', async ({ browser }, info) => {
  const { white, black } = await startGame(browser, info.project.use.viewport ?? null);
  await move(white, 'f2', 'f3'); await move(black, 'e7', 'e5'); await move(white, 'g2', 'g4'); await move(black, 'd8', 'h4'); // fool's mate
  await white.getByRole('button', { name: 'بازی دوباره' }).first().click();
  await expect(black.getByRole('button', { name: 'قبول' })).toBeVisible({ timeout: 8000 });
  await expect(black.getByRole('button', { name: 'رد' }).first()).toBeVisible();
  await black.getByRole('button', { name: 'قبول' }).click();
  // New table: Black of the first game is White now (a1 bottom-left); White is Black (h8 bottom-left).
  await expect(black.locator('.ch-row').last().locator('button').first()).toHaveAttribute('aria-label', /^a1،/, { timeout: 15_000 });
  await expect(white.locator('.ch-row').last().locator('button').first()).toHaveAttribute('aria-label', /^h8،/, { timeout: 15_000 });
  await expect(black).toHaveURL(/\/t\/[A-Z0-9]{6,8}/);
  await closeAll(white, black);
});

test('declined draw offer: the offerer gets «… پیشنهاد مساوی را رد کرد»; a new offer is possible at once', async ({ browser }, info) => {
  const { white, black } = await startGame(browser, info.project.use.viewport ?? null);
  await move(white, 'e2', 'e4'); await move(black, 'e7', 'e5');
  await white.getByRole('button', { name: /^مساوی/ }).first().click();
  await black.getByRole('button', { name: 'رد', exact: true }).click();
  await expect(white.getByText(/پیشنهاد مساوی را رد کرد/).first()).toBeVisible({ timeout: 8000 });
  await expect(white.getByRole('button', { name: /^مساوی/ }).first()).toBeEnabled();
  await closeAll(white, black);
});

test('premove is sent right after the opponent move arrives, not after an undo window', async ({ browser }, info) => {
  const { white, black } = await startGame(browser, info.project.use.viewport ?? null);
  await black.evaluate(() => localStorage.setItem('bg.undoMs', '500')); // E2E turns the undo window off by default; chess must ignore it
  await move(white, 'e2', 'e4');
  await expect(black.locator('.ch-moves')).toContainText('e4');
  await move(black, 'e7', 'e5');
  let whiteAnswered = 0, blackPosted = 0;
  white.on('response', (r) => { if (/\/commands$/.test(r.url()) && r.request().method() === 'POST') whiteAnswered = Date.now(); });
  black.on('request', (r) => { if (/\/commands$/.test(r.url()) && r.method() === 'POST') blackPosted = Date.now(); });
  await square(black, 'g8').click(); await square(black, 'f6').click(); // premove while White is thinking
  await move(white, 'g1', 'f3');
  await expect.poll(() => blackPosted, { timeout: 5000 }).toBeGreaterThan(whiteAnswered - 1);
  // Page-side arrival time is not observable from outside; the undo window alone would add 500 ms, so 350 ms proves it is skipped.
  expect(blackPosted - whiteAnswered).toBeLessThan(350);
  await expect(black.locator('.ch-moves')).toContainText('Nf6');
  await closeAll(white, black);
});

test('own move shows before the server answers and rolls back when the server refuses', async ({ browser }, info) => {
  const { white, black } = await startGame(browser, info.project.use.viewport ?? null);
  await white.route('**/api/tables/*/commands', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ errorCode: 'STALE_REVISION', messageFa: 'حرکت پذیرفته نشد.' }) });
  });
  await square(white, 'e2').click();
  await square(white, 'e4').click();
  await expect(square(white, 'e4')).toHaveAttribute('aria-label', /سرباز سفید/, { timeout: 700 }); // shown before the answer
  await expect(square(white, 'e2')).toHaveAttribute('aria-label', /سرباز سفید/, { timeout: 6000 }); // rolled back
  await closeAll(white, black);
});
