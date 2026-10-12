import { expect, test } from '@playwright/test';
import { player } from './helpers.ts';

// «بازی با ربات»: start from the game page, the bot is labelled as a bot, it answers through the worker, and the
// game reaches a result. Needs the worker (bot turns are worker deadlines).
test.describe.configure({ mode: 'serial', timeout: 180_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/bots/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'bot flow runs at 360 and 1440');

test('play «سه‌خطی» against a hard bot to the result', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'بازیکن تنها');
  await p.goto('/games/line-three');
  await expect(p.getByText('حریف ربات است و با نشان 🤖 دیده می‌شود', { exact: false })).toBeVisible();
  await p.getByText('سخت', { exact: true }).click();
  await p.screenshot({ path: shot(info.project.name, 'offer'), fullPage: true });
  await p.getByRole('button', { name: 'بازی با ربات' }).click();
  await expect(p.locator('.lt__board')).toBeVisible();
  await expect(p.getByRole('img', { name: 'نماد 🤖 سیمرغ' }).first()).toBeVisible();

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
