import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// «املاک» end to end: two clients play a 20-round game (net-worth finish) through the real UI: roll, buy when affordable,
// build when offered, pass in auctions, mortgage to cover debts, end turns. One trade is offered and rejected.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/amlak/${project}-${name}.png`;

async function click(p: Page, target: ReturnType<Page['locator']>) {
  const sent = p.waitForResponse((r) => r.url().includes('/commands') && r.request().method() === 'POST', { timeout: 10_000 });
  await target.click();
  expect((await (await sent).json()).status).toBe('accepted');
}
const enabled = async (l: ReturnType<Page['locator']>) => (await l.count()) > 0 && (await l.first().isEnabled());

async function decide(p: Page, n: number): Promise<ReturnType<Page['locator']> | null> {
  const panel = p.locator('.am-panel--decide');
  if (!(await panel.count())) return null;
  const btn = (name: RegExp) => panel.getByRole('button', { name });
  for (const name of [/^رد$/, /^تاس بریز/, /^خرید به/, /^نمی‌خرم/, /^کنار می‌کشم/]) {
    const b = btn(name);
    if (await enabled(b)) return b.first();
  }
  const mortgage = panel.getByRole('button', { name: /^رهن|^فروش ساختمان/ });
  if (await enabled(mortgage)) return mortgage.first();
  if (await enabled(btn(/^اعلام ورشکستگی/))) return btn(/^اعلام ورشکستگی/).first();
  const build = p.locator('details.am-panel').getByRole('button', { name: /^ساخت/ });
  if (n % 2 === 0 && await enabled(build)) return build.first();
  if (await enabled(btn(/^پایان نوبت/))) return btn(/^پایان نوبت/).first();
  return null;
}

test('two players play «املاک» for 20 rounds to the result', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/amlak/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'پایان بازی' }).getByText('۲۰ دور، بیشترین دارایی').click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.amb')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'start'), fullPage: true });

  let offered = false;
  let n = 0;
  for (; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      // Once someone owns property, open the trade composer and send a small offer (the other side rejects it).
      if (!offered && n > 30 && await p.getByText('پیشنهاد معامله', { exact: true }).count() && await p.locator('.am-manage li').count()) {
        await p.getByText('پیشنهاد معامله', { exact: true }).click();
        await p.locator('.am-tradeside').first().locator('input[type=checkbox]').first().check();
        await p.screenshot({ path: shot(info.project.name, 'trade'), fullPage: true });
        await click(p, p.getByRole('button', { name: 'ارسال پیشنهاد' }));
        offered = true; acted = true; break;
      }
      const target = await decide(p, n);
      if (target) { await click(p, target); acted = true; break; }
    }
    if (!acted) await host.waitForTimeout(100);
    if (n === 40) for (const [i, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  expect(offered).toBe(true);
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  test.info().annotations.push({ type: 'clicks', description: String(n) });
  for (const p of pages) await p.context().close();
});

test('instant roll: no undo, the dice tumble without pips while the roll is in flight; the result is thrown and the token walks', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await recordMotion(p);
  await p.goto('/games/amlak');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
  // The roll is sent at once (no undo window); hold its answer so the in-flight tumble can be seen.
  await p.route('**/api/tables/*/commands', async (route) => { if (route.request().method() === 'POST') await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
  const roll = p.locator('.am-panel--decide').getByRole('button', { name: /^تاس بریز/ });
  const tumbling = p.locator('.amb-die.bg-tumble');
  await motionLog(p);
  await roll.click();
  await expect(tumbling).toHaveCount(2);
  await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0);
  expect(await tumbling.locator('circle').evaluateAll((cs) => cs.every((c) => getComputedStyle(c).visibility === 'hidden'))).toBe(true);
  await expect(p.locator('.amb-die.bg-roll')).toHaveCount(2, { timeout: 15_000 });
  await expect(tumbling).toHaveCount(0);
  await p.waitForTimeout(1500);
  const log = await motionLog(p);
  expect(log.some((m) => m.ghost === 'die')).toBe(true);
  expect(log.some((m) => m.cls.includes('amb-pawn'))).toBe(true);
  await p.context().close();
});
