import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion, shot } from './helpers.ts';

// Full games between two independent clients (separate browser contexts and sessions), live and turn-based.
test.describe.configure({ mode: 'serial' });
// Runs in the mobile-360 and desktop-1440 projects (see playwright.config.ts testIgnore).

async function createAndStart(host: Page, guest: Page, gameId: string, pace: 'زنده' | 'نوبتی') {
  await host.goto(`/games/${gameId}/new`);
  await host.getByText(pace, { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  await expect(host.getByRole('heading', { name: /بازیکنان/ })).toBeVisible();
  const invite = await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue();
  await guest.goto(invite.replace(/^https?:\/\/[^/]+/, ''));
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  await expect(host.getByText('بازیکنان (۲ از ۲)')).toBeVisible(); // pushed to the host over the socket
  await expect(host.getByText('اتمام زمان:').first()).toBeVisible(); // policies are shown before ready
  await guest.getByRole('button', { name: 'آماده‌ام' }).click();
  await host.getByRole('button', { name: 'آماده‌ام' }).click();
}

const myTurn = (p: Page) => p.getByText(/نوبت شماست|پیشنهاد پنهان خود را ثبت کنید/).isVisible();

async function whoseTurn(a: Page, b: Page): Promise<[Page, Page]> {
  for (let i = 0; i < 40; i++) {
    if (await myTurn(a)) return [a, b];
    if (await myTurn(b)) return [b, a];
    await a.waitForTimeout(150);
  }
  throw new Error('nobody has the turn');
}

async function playLineThree(a: Page, b: Page, project: string, label: string) {
  await expect(a.locator('.lt__board')).toBeVisible();
  const [first] = await whoseTurn(a, b);
  // First mover takes the top row: 0, 1, 2; the opponent plays 3, 4.
  for (const cell of [0, 3, 1, 4, 2]) {
    const [mover, other] = await whoseTurn(a, b);
    await expect(mover.locator('.lt__cell').nth(cell)).not.toHaveAttribute('aria-disabled', 'true');
    await mover.locator('.lt__cell').nth(cell).click();
    if (cell === 1) await mover.screenshot({ path: shot(`${label}-selecting`, project), fullPage: true });
    await expect(other.locator('.lt__cell').nth(cell)).not.toHaveText(''); // opponent sees it via push
  }
  await expect(first.getByRole('heading', { name: 'شما بردید' })).toBeVisible();
  const loser = first === a ? b : a;
  await expect(loser.getByRole('heading', { name: 'این دست را باختید' })).toBeVisible();
  await first.screenshot({ path: shot(`${label}-result-winner`, project), fullPage: true });
  await loser.screenshot({ path: shot(`${label}-result-loser`, project), fullPage: true });
}

async function playSealedBids(a: Page, b: Page, project: string, label: string) {
  const bids = [[5, 1], [1, 5], [2, 3], [3, 2], [4, 4]]; // a, b per round
  for (const [round, [ta, tb]] of bids.entries()) {
    for (const [p, token] of [[a, ta], [b, tb]] as const) {
      await expect(p.getByText('پیشنهاد پنهان خود را ثبت کنید')).toBeVisible();
      await p.getByRole('button', { name: `ژتون ${token!.toLocaleString('fa-IR')}`, exact: true }).click();
      if (p === a) {
        await expect(a.getByText('پیشنهاد مهرشده شما')).toBeVisible();
        // The opponent sees only that A has sealed — never the value.
        await expect(b.getByText('✓ مهر شد')).toBeVisible();
        if (round === 0) {
          await a.screenshot({ path: shot(`${label}-sealed-own`, project), fullPage: true });
          await b.screenshot({ path: shot(`${label}-sealed-opponent`, project), fullPage: true });
        }
      }
    }
  }
  // a: rounds 1 (1pt) + 4 (4pt) = 5; b: rounds 2 + 3 = 5 → shared first place; round 5 tied.
  await expect(a.getByRole('heading', { name: 'مساوی شد' })).toBeVisible();
  await expect(b.getByRole('heading', { name: 'مساوی شد' })).toBeVisible();
  await a.screenshot({ path: shot(`${label}-result`, project), fullPage: true });
}

for (const [pace, paceFa] of [['live', 'زنده'], ['turn', 'نوبتی']] as const) {
  test(`line-three ${pace}: two clients play to the result`, async ({ browser }, info) => {
    const vp = info.project.use.viewport ?? null;
    const a = await player(browser, vp, 'آرش');
    const b = await player(browser, vp, 'Mina');
    await createAndStart(a, b, 'line-three', paceFa);
    await a.screenshot({ path: shot(`line-three-${pace}-start`, info.project.name), fullPage: true });
    await playLineThree(a, b, info.project.name, `line-three-${pace}`);
    await a.context().close(); await b.context().close();
  });

  test(`sealed-bids ${pace}: two clients play five sealed rounds to the result`, async ({ browser }, info) => {
    const vp = info.project.use.viewport ?? null;
    const a = await player(browser, vp, 'سارا');
    const b = await player(browser, vp, 'Kian');
    await createAndStart(a, b, 'sealed-bids', paceFa);
    await playSealedBids(a, b, info.project.name, `sealed-bids-${pace}`);
    await a.context().close(); await b.context().close();
  });
}

test('undo window cancels a tapped move; table chat alerts the other player', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const a = await player(browser, vp, 'نیما');
  const b = await player(browser, vp, 'Sara');
  await createAndStart(a, b, 'line-three', 'زنده');
  await expect(a.locator('.lt__board')).toBeVisible();
  const [mover, other] = await whoseTurn(a, b);
  await mover.evaluate(() => localStorage.setItem('bg.undoMs', '2000'));

  // Tap → held for 2 s with «انصراف» → cancelled: nothing reaches the server.
  await expect(mover.locator('.lt__cell').nth(4)).not.toHaveAttribute('aria-disabled', 'true');
  await mover.locator('.lt__cell').nth(4).click();
  await expect(mover.getByText('حرکت شما تا لحظه‌ای دیگر ثبت می‌شود.')).toBeVisible();
  await mover.screenshot({ path: shot('undo-window', info.project.name), fullPage: true });
  await mover.getByRole('button', { name: 'انصراف', exact: true }).click();
  await mover.waitForTimeout(2500);
  await expect(other.locator('.lt__cell').nth(4)).toHaveText('');
  await expect(mover.getByText('حرکت با شماست')).toBeVisible();

  // Tap and wait: the move is sent when the window ends.
  await expect(mover.locator('.lt__cell').nth(4)).not.toHaveAttribute('aria-disabled', 'true');
  await mover.locator('.lt__cell').nth(4).click();
  await expect(other.locator('.lt__cell').nth(4)).not.toHaveText('', { timeout: 8000 });

  // Chat from the other player → unread badge and toast on the mover's table.
  await other.getByRole('button', { name: 'گفت‌وگوی میز' }).click();
  await other.getByLabel('متن پیام').fill('سلام، بازی خوبی بود');
  await other.getByRole('button', { name: 'ارسال', exact: true }).click();
  await expect(mover.getByRole('button', { name: 'گفت‌وگوی میز، ۱ پیام تازه' })).toBeVisible();
  await expect(mover.getByText(/پیام در میز — (Sara|نیما): سلام، بازی خوبی بود/)).toBeVisible();
  await mover.screenshot({ path: shot('chat-alert', info.project.name), fullPage: true });
  await mover.getByRole('button', { name: 'گفت‌وگوی میز، ۱ پیام تازه' }).click();
  await expect(mover.getByRole('button', { name: 'گفت‌وگوی میز', exact: true })).toBeAttached();

  // Fullscreen from the game bar (the game container, which scrolls itself so the board stays reachable), and back.
  await mover.keyboard.press('Escape'); // close the chat drawer
  await mover.getByRole('button', { name: 'تمام‌صفحه', exact: true }).click();
  await expect.poll(() => mover.evaluate(() => document.fullscreenElement?.classList.contains('game') ?? false)).toBe(true);
  await mover.locator('.game').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(mover.locator('.game__board')).toBeInViewport();
  await mover.screenshot({ path: shot('fullscreen', info.project.name) });
  await mover.getByRole('button', { name: 'خروج از تمام‌صفحه' }).click();
  await expect.poll(() => mover.evaluate(() => document.fullscreenElement)).toBeNull();
  await a.context().close(); await b.context().close();
});

test('interactive tutorial: guided moves against the scripted opponent', async ({ browser }, info) => {
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/line-three');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.screenshot({ path: shot('tutorial-step1', info.project.name), fullPage: true });
  for (const cell of [4, 2, 6]) {
    await expect(p.locator('.lt__cell').nth(cell)).not.toHaveAttribute('aria-disabled', 'true');
    await p.locator('.lt__cell').nth(cell).click();
    await expect(p.locator('.lt__cell').nth(cell)).toHaveText('X');
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.screenshot({ path: shot('tutorial-done', info.project.name), fullPage: true });
  await p.goto('/');
  await expect(p.getByRole('heading', { name: 'نوبت من' })).toBeVisible();
  await p.context().close();
});

test('line-three undo window: the tapped mark lands at once, and undo lifts it out', async ({ browser }, info) => {
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/line-three');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const cell = p.locator('.lt__cell').nth(4);
  await cell.click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(cell).toHaveText('X');
  await expect(cell.locator('.lt__mark.bg-land')).toHaveCount(1);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(cell).toHaveText('');
  await p.waitForTimeout(600);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.context().close();
});

test('sealed-bids undo window: the tapped token is sealed in the envelope at once, and undo returns it', async ({ browser }, info) => {
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/sealed-bids');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const envelope = p.locator('.sb .sb-env');
  await p.getByRole('button', { name: 'ژتون ۱', exact: true }).click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(envelope).toBeVisible();
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(envelope).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'ژتون ۱', exact: true })).toBeEnabled();
  await p.waitForTimeout(900);
  expect((await motionLog(p)).some((m) => m.ghost === 'exit')).toBe(true);
  await p.context().close();
});
