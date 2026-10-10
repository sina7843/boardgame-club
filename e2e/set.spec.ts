import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «ست» end to end: the tutorial (three claims, a scripted wrong claim, the end of the deck) and a full live game
// where two clients race on the same table.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/set/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

// Card id digits (count, shape, colour, shading); three cards are a set when every digit sums to 0 mod 3.
const digits = (id: number) => [id % 3, Math.floor(id / 3) % 3, Math.floor(id / 9) % 3, Math.floor(id / 27) % 3];
function findSet(cards: number[]): number[] | null {
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) for (let k = j + 1; k < cards.length; k++) {
    const a = digits(cards[i]!), b = digits(cards[j]!), c = digits(cards[k]!);
    if (a.every((v, x) => (v + b[x]! + c[x]!) % 3 === 0)) return [cards[i]!, cards[j]!, cards[k]!];
  }
  return null;
}

test('interactive tutorial: three sets, the opponent’s wrong claim, and the end of the deck', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/set');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۳`))).toBeVisible();
    const hinted = p.locator('.set__board button.set-card.set-hint');
    await expect(hinted).toHaveCount(3);
    for (let i = 0; i < 3; i++) await hinted.nth(i).click();
    if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-pick'), fullPage: true });
    await p.locator('button.set-claim').click();
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

async function claimOne(p: Page): Promise<boolean> {
  const ids = await p.locator('.set__board button.set-card:not([disabled])').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.card)));
  const found = findSet(ids);
  if (!found) return false;
  for (const c of found) await p.locator(`.set__board button.set-card[data-card="${c}"]`).click();
  await p.locator('button.set-claim').click();
  return true;
}

test('two players race through a full game of «ست» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/set/new');
  const live = host.getByText('زنده', { exact: true });
  if (await live.count()) await live.first().click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('2');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.set__board')).toBeVisible();

  let seq: string | null = null;
  for (let n = 0; n < 200; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    const p = pages[n % 2]!;
    // Wait until this client has the latest board pushed, so it never claims from a stale table.
    // (>= rather than ==: an idle timeout may have moved the board on in the meantime.)
    if (seq !== null) await expect.poll(async () => Number(await p.locator('.set').getAttribute('data-seq')), { timeout: 10_000 }).toBeGreaterThanOrEqual(Number(seq));
    const before = await p.locator('.set').getAttribute('data-seq');
    if (!(await claimOne(p))) { await p.waitForTimeout(150); continue; }
    await expect.poll(() => p.locator('.set').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
    seq = await p.locator('.set').getAttribute('data-seq');
    if (n === 8) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});

test('instant claim (no undo): a claimed set flies to my tray while the claim is in flight and stays there after the answer', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/set');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  await p.evaluate(() => localStorage.setItem('bg.undoMs', '4000'));
  await p.waitForTimeout(800);
  const table = p.locator('.set__board button.set-card');
  const tray = p.locator('.set-seat--me .set-mini');
  const n = await table.count();
  const hinted = p.locator('.set__board button.set-card.set-hint');
  for (let i = 0; i < 3; i++) await hinted.nth(i).click();
  // A claim is sent at once despite the window (no undo); hold its answer so the in-flight preview can be seen.
  let answered = false;
  await p.route('**/api/tables/*/commands', async (route) => {
    if (route.request().method() === 'POST') { await new Promise((ok) => setTimeout(ok, 1500)); answered = true; }
    await route.continue();
  });
  await motionLog(p);
  await p.locator('button.set-claim').click();
  await expect(table).toHaveCount(n - 3);
  await expect(tray).toHaveCount(3);
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  expect(answered).toBe(false);
  await p.waitForTimeout(800);
  expect((await motionLog(p)).some((m) => m.ghost === 'fly')).toBe(true);
  // After the answer the set is mine: still in my tray, and the table is refilled to its size.
  await expect(p.getByText(/آموزش: مرحله ۲ از/)).toBeVisible({ timeout: 10_000 });
  await expect(tray).toHaveCount(3);
  await p.context().close();
});
