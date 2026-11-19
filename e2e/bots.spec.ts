import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «بازی با ربات»: start from the game page, the bot is labelled as a bot, it answers through the worker, and the
// game reaches a result. Needs the worker (bot turns are worker deadlines).
test.describe.configure({ mode: 'serial', timeout: 180_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/site/bots/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'bot flow runs at 360 and 1440');

/** The offer lives on the create-table page: game page → «میز بساز» → the «تمرین با ربات» mode. */
async function openBotOffer(p: Page, gameId: string) {
  await p.goto(`/games/${gameId}`);
  await p.getByRole('link', { name: 'میز بساز' }).first().click();
  await p.getByRole('radio', { name: /تمرین با ربات/ }).click();
}

/** Every opponent above the board is a bot; on phones each one carries the «ربات» badge. */
async function expectBots(p: Page, bots: number, timeout = 10_000) {
  const top = p.locator('.gf-top');
  await expect(top.locator('.gf-bar, .gf-seat')).toHaveCount(bots, { timeout });
  if ((p.viewportSize()?.width ?? 1440) < 900) await expect(top.getByText('ربات', { exact: true })).toHaveCount(bots, { timeout });
}

test('play «دوز» against a hard bot to the result', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'بازیکن تنها');
  await openBotOffer(p, 'line-three');
  await expect(p.getByText('حریف ربات است و با نشان ربات دیده می‌شود', { exact: false })).toBeVisible();
  await p.getByRole('radio', { name: 'سخت' }).click();
  await p.screenshot({ path: shot(info.project.name, 'offer'), fullPage: true });
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.locator('.lt__board')).toBeVisible();
  await expectBots(p, 1);

  for (let n = 0; n < 12; n++) {
    if (await p.getByRole('heading', { name: RESULT }).count()) break;
    // My turn shows in the status line; otherwise the bot is thinking (it answers within ~2 s).
    if (await p.getByText('حرکت با شماست', { exact: true }).first().isVisible()) await p.getByRole('button', { name: /: خالی$/ }).first().click();
    await p.waitForTimeout(1500);
  }
  await expect(p.getByRole('heading', { name: RESULT })).toBeVisible({ timeout: 15_000 });
  // The bot really played: the game ended on the board, not by a timeout, with its marks on it.
  await expect(p.getByText('علت پایان: اتمام زمان')).toHaveCount(0);
  expect(await p.getByRole('button', { name: /: [XO]$/ }).count()).toBeGreaterThanOrEqual(5);
  await p.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  await p.context().close();
});

test('«مسابقهٔ شترها» with two bots: the bots take their turns between mine (multi-player, hidden bets)', async ({ browser }, info) => {
  only(info.project.name);
  test.setTimeout(240_000);
  const p = await player(browser, info.project.use.viewport ?? null, 'شترسوار');
  await openBotOffer(p, 'camel-up');
  await p.getByRole('radio', { name: 'آسان' }).click();
  await p.getByLabel('تعداد بازیکن (شما و ربات‌ها)').selectOption('3');
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expectBots(p, 2);
  // Four of my turns: each needs both bots to act in between (a full game is covered by the API test).
  const roll = p.getByRole('button', { name: /^تاس از هرم/ });
  for (let mine = 0; mine < 4; mine++) {
    await expect(roll).toBeEnabled({ timeout: 30_000 });
    await roll.click();
    // The roll button lives in the action dock: it goes disabled while sending and leaves the dock once the turn passes.
    await expect.poll(async () => !(await roll.count()) || await roll.isDisabled(), { timeout: 10_000 }).toBe(true);
  }
  await expect(roll).toBeEnabled({ timeout: 30_000 });
  await p.screenshot({ path: shot(info.project.name, 'camel-midgame'), fullPage: true });
  await p.context().close();
});

test('«نه، ممنون!» against a bot: the bot answers each of my moves', async ({ browser }, info) => {
  only(info.project.name);
  test.setTimeout(180_000);
  const p = await player(browser, info.project.use.viewport ?? null, 'بی‌ژتون');
  await openBotOffer(p, 'no-thanks');
  await p.getByRole('radio', { name: 'متوسط' }).click();
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.locator('.nt-card--big')).toBeVisible();
  await expectBots(p, 1);
  // Three of my moves; between them the bot must act (pass or take), which moves the shared sequence on.
  const take = p.locator('.nt-btn--take');
  for (let mine = 0; mine < 3; mine++) {
    await expect(take).toBeVisible({ timeout: 30_000 });
    const before = await p.locator('.nt').getAttribute('data-seq');
    const pass = p.locator('.nt-btn--pass');
    if (await pass.isEnabled()) await pass.click(); else await take.click();
    await expect.poll(() => p.locator('.nt').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
  }
  await expect(take).toBeVisible({ timeout: 30_000 });
  await p.screenshot({ path: shot(info.project.name, 'no-thanks'), fullPage: true });
  await p.context().close();
});
