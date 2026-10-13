import { expect, test } from '@playwright/test';
import { player } from './helpers.ts';

// «بازی با ربات»: start from the game page, the bot is labelled as a bot, it answers through the worker, and the
// game reaches a result. Needs the worker (bot turns are worker deadlines).
test.describe.configure({ mode: 'serial', timeout: 180_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/site/bots/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'bot flow runs at 360 and 1440');

test('play «سه‌خطی» against a hard bot to the result', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'بازیکن تنها');
  await p.goto('/games/line-three');
  await expect(p.getByText('حریف ربات است و با نشان 🤖 دیده می‌شود', { exact: false })).toBeVisible();
  await p.getByRole('radio', { name: 'سخت' }).click();
  await p.screenshot({ path: shot(info.project.name, 'offer'), fullPage: true });
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.locator('.lt__board')).toBeVisible();
  await expect(p.getByRole('img', { name: /^نماد 🤖 / }).first()).toBeVisible();

  for (let n = 0; n < 12; n++) {
    if (await p.getByRole('heading', { name: RESULT }).count()) break;
    // My turn shows the «tap an empty cell» prompt; otherwise the bot is thinking (it answers within ~2 s).
    if (await p.getByText('یک خانه خالی را بزنید').count()) await p.getByRole('button', { name: /: خالی$/ }).first().click();
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
  await p.goto('/games/camel-up');
  await p.getByRole('radio', { name: 'آسان' }).click();
  await p.getByLabel('تعداد بازیکن (شما و ربات‌ها)').selectOption('3');
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.getByRole('img', { name: /^نماد 🤖 / })).toHaveCount(2, { timeout: 10_000 });
  // Four of my turns: each needs both bots to act in between (a full game is covered by the API test).
  const roll = p.getByRole('button', { name: /^تاس از هرم/ });
  for (let mine = 0; mine < 4; mine++) {
    await expect(roll).toBeEnabled({ timeout: 30_000 });
    await roll.click();
    await expect(roll).toBeDisabled({ timeout: 10_000 });
  }
  await expect(roll).toBeEnabled({ timeout: 30_000 });
  await p.screenshot({ path: shot(info.project.name, 'camel-midgame'), fullPage: true });
  await p.context().close();
});

test('«نه، ممنون!» against a bot: the bot answers each of my moves', async ({ browser }, info) => {
  only(info.project.name);
  test.setTimeout(180_000);
  const p = await player(browser, info.project.use.viewport ?? null, 'بی‌ژتون');
  await p.goto('/games/no-thanks');
  await p.getByRole('radio', { name: 'متوسط' }).click();
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.locator('.nt-card--big')).toBeVisible();
  await expect(p.getByRole('img', { name: /^نماد 🤖 / }).first()).toBeVisible();
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
