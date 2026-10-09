import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// UNO end to end: three independent clients play one full hand through the real UI (live, one-hand variant).
// Moves are chosen like a casual player: first playable card, otherwise draw. Hidden hands are checked in the UI.
test.describe.configure({ mode: 'serial', timeout: 300_000 });
const shot = (project: string, name: string) => `docs/evidence/uno/${project}-${name}.png`;

async function startTable(host: Page, guests: Page[]) {
  await host.goto('/games/uno/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('3');
  await host.getByRole('group', { name: 'طول مسابقه' }).getByText('یک دست').click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const g of guests) { await g.goto(invite); await g.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(host.getByText('بازیکنان (۳ از ۳)')).toBeVisible();
  await expect(host.getByText('طول مسابقه: یک دست')).toBeVisible(); // chosen variant shown before ready
  for (const p of [host, ...guests]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

const myTurn = async (p: Page) => (await p.locator('.uno-hand .uno-card--playable').count()) > 0
  || (await p.locator('.uno-pile--draw:not([aria-disabled])').count()) > 0
  || (await p.getByRole('button', { name: 'پذیرفتن و کشیدن ۴ کارت' }).count()) > 0
  || (await p.locator('.uno-colors').count()) > 0;

async function takeTurn(p: Page) {
  const accept = p.getByRole('button', { name: 'پذیرفتن و کشیدن ۴ کارت' });
  if (await accept.count()) return accept.click();
  if (await p.locator('.uno-colors').count()) return p.locator('.uno-color').first().click();
  const uno = p.locator('.uno-call');
  if (await uno.count()) await uno.click();
  const card = p.locator('.uno-hand .uno-card--playable').first();
  if (await card.count()) {
    await card.click();
    if (await p.locator('.uno-colors').count()) return p.locator('.uno-color').first().click();
    return p.locator('.uno-hand .uno-card--selected').click();
  }
  await p.locator('.uno-pile--draw').click();
  const keep = p.getByRole('button', { name: 'نگه‌داشتن و پایان نوبت' });
  await keep.or(p.locator('.uno-pile--draw[aria-disabled]')).first().waitFor();
  if (await keep.count()) {
    const drawn = p.locator('.uno-hand .uno-card--playable').first();
    if (await drawn.count()) {
      await drawn.click();
      if (await p.locator('.uno-colors').count()) return p.locator('.uno-color').first().click();
      return p.locator('.uno-hand .uno-card--selected').click();
    }
    return keep.click();
  }
}

test('three players play a full UNO hand to the result', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const [a, b, c] = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  await startTable(a, [b, c]);
  await expect(a.locator('.uno-table')).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  // Hidden information: each client shows its own 7 cards and only counts for the others.
  for (const p of [a, b, c]) {
    expect(await p.locator('.uno-hand .uno-card').count()).toBeGreaterThanOrEqual(7);
    await expect(p.locator('.uno-rail .uno-card')).toHaveCount(0);
  }

  const pages = [a, b, c];
  let turns = 0;
  for (; turns < 300; turns++) {
    if (await a.getByRole('heading', { name: /بردید|باختید|مساوی/ }).count()) break;
    let mover: Page | null = null;
    for (const p of pages) if (await myTurn(p)) { mover = p; break; }
    if (!mover) { await a.waitForTimeout(150); continue; }
    const before = await mover.locator('.uno-log li').first().textContent();
    await takeTurn(mover);
    if (turns === 4) for (const [i, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
    await expect.poll(async () => (await mover!.locator('.uno-log li').first().textContent()) !== before || (await a.getByRole('heading', { name: /بردید|باختید|مساوی/ }).count()) > 0, { timeout: 10_000 }).toBe(true);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: /بردید|باختید|مساوی/ })).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  test.info().annotations.push({ type: 'turns', description: String(turns) });
  for (const p of pages) await p.context().close();
});

test('undo window: the played card flies to the pile at once, and undo flies it back to the hand', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/uno');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  await motionLog(p);
  const inHand = p.locator('.uno-hand [data-flip="c-r7a"]');
  const onPile = p.locator('.uno-pile--discard [data-flip="c-r7a"]');
  await inHand.click();
  await inHand.click();
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toBeVisible();
  await expect(onPile).toBeVisible();
  await expect(inHand).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(inHand).toBeVisible();
  await expect(onPile).toHaveCount(0);
  await p.waitForTimeout(700);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  await p.context().close();
});
