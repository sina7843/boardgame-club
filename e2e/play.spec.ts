import { expect, test, type Page } from '@playwright/test';
import { player, shot } from './helpers.ts';

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
    await mover.locator('.lt__cell').nth(cell).click();
    if (cell === 1) await mover.screenshot({ path: shot(`${label}-selecting`, project), fullPage: true });
    await mover.getByRole('button', { name: 'ثبت حرکت' }).click();
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
      await p.getByRole('button', { name: /^مهر و ثبت/ }).click();
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

test('interactive tutorial: guided moves against the scripted opponent', async ({ browser }, info) => {
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/line-three');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۳/)).toBeVisible();
  await p.screenshot({ path: shot('tutorial-step1', info.project.name), fullPage: true });
  for (const cell of [4, 2, 6]) {
    await p.locator('.lt__cell').nth(cell).click();
    await p.getByRole('button', { name: 'ثبت حرکت' }).click();
    await expect(p.locator('.lt__cell').nth(cell)).toHaveText('X');
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.screenshot({ path: shot('tutorial-done', info.project.name), fullPage: true });
  await p.goto('/');
  await expect(p.getByRole('heading', { name: 'نوبت من' })).toBeVisible();
  await p.context().close();
});
