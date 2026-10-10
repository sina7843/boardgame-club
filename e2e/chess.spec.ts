import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// Chess end to end: two clients play Fool's Mate through the real board (tap piece → tap target).
test.describe.configure({ mode: 'serial', timeout: 300_000 });
const shot = (project: string, name: string) => `docs/evidence/chess/${project}-${name}.png`;
const RESULT = /بردید|باختید|مساوی/;
const square = (p: Page, name: string) => p.locator(`.ch-board button[aria-label^="${name}،"]`);

async function move(p: Page, from: string, to: string) {
  await square(p, from).click();
  await expect(square(p, to)).toHaveAttribute('aria-label', /حرکت به اینجا|زدن/);
  await square(p, to).click();
}

test("two players play Fool's Mate to the result; Black sees the board from Black's side", async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const [white, black] = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  await white.goto('/games/chess/new');
  await white.getByText('زنده', { exact: true }).click();
  await white.getByRole('group', { name: 'مهره سفید' }).getByText('میزبان سفید باشد').click();
  await white.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await white.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await black.goto(invite);
  await black.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of [white, black]) await p.getByRole('button', { name: 'آماده‌ام' }).click();

  await expect(white.locator('.ch-board')).toBeVisible();
  // Orientation: White's bottom-left square is a1; Black's is h8.
  await expect(white.locator('.ch-row').last().locator('button').first()).toHaveAttribute('aria-label', /^a1،/);
  await expect(black.locator('.ch-row').last().locator('button').first()).toHaveAttribute('aria-label', /^h8،/);
  await white.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  await move(white, 'f2', 'f3');
  await move(black, 'e7', 'e5');
  await move(white, 'g2', 'g4');
  await square(black, 'd8').click();
  await black.screenshot({ path: shot(info.project.name, 'targets'), fullPage: true });
  await square(black, 'h4').click();

  for (const p of [white, black]) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await expect(black.getByRole('heading', { name: RESULT })).toHaveText(/بردید/);
  await expect(white.locator('.ch-moves')).toContainText('Qh4#');
  await white.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of [white, black]) await p.context().close();
});

test('undo window: castling moves king and rook at once, and undo moves them back', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/chess');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  await move(p, 'e1', 'g1');
  const undo = p.getByRole('button', { name: 'انصراف', exact: true });
  await expect(undo).toBeVisible();
  await expect(square(p, 'g1')).toHaveAttribute('aria-label', /شاه سفید/);
  await expect(square(p, 'f1')).toHaveAttribute('aria-label', /رخ سفید/);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await undo.click();
  await expect(square(p, 'e1')).toHaveAttribute('aria-label', /شاه سفید/);
  await expect(square(p, 'h1')).toHaveAttribute('aria-label', /رخ سفید/);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  // Played for real: the en passant capture leaves the board towards the captured tray.
  await move(p, 'e1', 'g1');
  await expect(p.getByText(/آموزش: مرحله ۲ از/)).toBeVisible({ timeout: 10_000 });
  await move(p, 'e2', 'c4');
  await expect(p.getByText(/آموزش: مرحله ۳ از/)).toBeVisible({ timeout: 10_000 });
  await p.waitForTimeout(1500);
  await motionLog(p);
  await move(p, 'e5', 'd6');
  await expect(square(p, 'd5')).toHaveAttribute('aria-label', /خالی/);
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.context().close();
});
