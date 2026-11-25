import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { player } from './helpers.ts';

// Chess new-game form and table labels (design/games/chess D01, D18, D19; CHESS-FIX-SPEC rows 3, U2, U8, U9).
const only = (info: TestInfo) => test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'lobby runs at 360 and 1440');

const mode = (p: Page, name: string) => p.getByRole('radiogroup', { name: 'نوع بازی' }).getByRole('radio', { name }).click();

test('online mode hides increment controls; friend mode shows them; the felt shows the starting position', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'Ava');
  await p.goto('/games/chess/new');
  const group = p.getByRole('group', { name: 'زمان بازی' });
  await expect(group.getByRole('button', { name: '۵ دقیقه' })).toBeVisible();
  for (const inc of ['۳ + ۲', '۵ + ۳', '۱۰ + ۵', '۱ + ۱']) await expect(group.getByRole('button', { name: inc })).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'زمان‌های بیشتر' })).toHaveCount(0);
  await expect(p.getByTestId('chl-board').locator('img')).toHaveCount(32); // U2: all 32 pieces, faded
  await p.screenshot({ path: `design/qa/chess-live/lobby-online-${info.project.name}.png` });

  await mode(p, 'با دوست');
  for (const inc of ['۳ + ۲', '۵ + ۳', '۱۰ + ۵', '۱ + ۱']) await expect(group.getByRole('button', { name: inc })).toBeVisible();
  await p.getByRole('radiogroup', { name: 'رنگ شما' }).getByRole('radio', { name: 'سیاه' }).click();
  await expect(p.getByTestId('chl-board')).toHaveAttribute('data-bottom', 'black'); // the player's colour at the bottom

  await mode(p, 'آنلاین');
  await expect(group.getByRole('button', { name: '۱۰ + ۵' })).toHaveCount(0);
  await p.context().close();
});

test('bot form: three levels with an approximate rating, colour choice, no clock', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'Ava');
  await p.goto('/games/chess/new');
  await mode(p, 'با ربات');
  const levels = p.getByRole('radiogroup', { name: 'سطح ربات' }).getByRole('radio');
  await expect(levels).toHaveCount(3);
  for (const name of ['آسان', 'متوسط', 'سخت']) await expect(levels.filter({ hasText: name })).toContainText('حدود');
  const colors = p.getByRole('radiogroup', { name: 'رنگ شما' }).getByRole('radio');
  await expect(colors).toHaveCount(3);
  for (const name of ['سفید', 'تصادفی', 'سیاه']) await expect(colors.and(p.getByRole('radio', { name }))).toHaveCount(1);
  await expect(p.getByRole('group', { name: 'زمان بازی' })).toHaveCount(0);
  await p.screenshot({ path: `design/qa/chess-live/lobby-bot-${info.project.name}.png` });
  await p.context().close();
});

test('friend invite: the lobby keeps a waiting card with the link and the clock label «رپید ۱۰ + ۵»', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'Ava');
  await p.goto('/games/chess/new');
  await mode(p, 'با دوست');
  await p.getByRole('group', { name: 'زمان بازی' }).getByRole('button', { name: '۱۰ + ۵' }).click();
  await p.getByRole('button', { name: 'بازی کن' }).click();
  await expect(p.getByRole('heading', { name: 'منتظر دوستتان هستیم…' })).toBeVisible();
  await expect(p.getByRole('textbox', { name: 'لینک دعوت' })).toHaveValue(/\/tables\/[0-9a-f-]+\?invite=/); // invite links stay /tables/<id>?invite=… (DECISIONS 2026-11-13)
  await expect(p.getByRole('status').filter({ hasText: 'رپید ۱۰ + ۵' })).toBeVisible();
  await p.screenshot({ path: `design/qa/chess-live/lobby-invite-${info.project.name}.png` });
  await p.getByRole('button', { name: 'لغو دعوت' }).first().click();
  await expect(p.getByRole('heading', { name: 'منتظر دوستتان هستیم…' })).toHaveCount(0);
  await p.context().close();
});

test('a public 10+5 table is labelled «رپید ۱۰ + ۵» on the game page, never «… ثانیه هر نوبت»', async ({ browser }, info) => {
  only(info);
  const p = await player(browser, info.project.use.viewport ?? null, 'Ava');
  const res = await p.request.post('/api/tables', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { gameId: 'chess', pace: 'live', turnSeconds: 60, visibility: 'public', competition: 'friendly', capacity: 2, reminders: false, options: { clock: '10+5' } }
  });
  expect(res.status()).toBe(201);
  await p.goto('/games/chess');
  const tile = p.locator('.gd-open').first();
  await expect(tile).toContainText('رپید ۱۰ + ۵');
  await expect(tile).not.toContainText('هر نوبت');
  await expect(tile).not.toContainText('ثانیه');
  // U7: the page never shows a zero count and the time range comes from the clock choices.
  await expect(p.locator('.gd-stats')).toContainText('۱ تا ۳۰');
  await expect(p.locator('.gd-a')).not.toContainText('۰ میز');
  await p.context().close();
});
