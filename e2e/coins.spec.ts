import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// Coin wallet: balance chip in the shell, earning rules, saving progress, spending coins on premium days.
test.describe.configure({ timeout: 90_000 });
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
/** Test-only credit straight into the ledger (earning itself is covered by the API suite). */
const credit = (mobile: string, amount: number) => execFileSync('node', ['--input-type=module', '-e', `
  import postgres from 'postgres';
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  await sql\`insert into coin_ledger (user_id, amount, rule_id, reason, source_key)
    select user_id, \${${amount}}, 'e2e', 'اعتبار آزمایشی', 'e2e:' || gen_random_uuid() from user_private where mobile = \${'${mobile}'}\`;
  await sql.end();`], { cwd: 'packages/db', env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });

test('wallet shows balance and rules; coins buy premium days', async ({ browser }, info) => {
  const p = await newPage(browser, info.project.use.viewport ?? null);
  const mobile = await signIn(p, `Sekke${Math.random().toString(36).slice(2, 6)}`, '/coins');
  await p.goto('/coins');
  // Coins-Desktop / Wallet-Mobile: the balance hero (the page title sits in the phone top bar).
  await expect(p.getByRole('region', { name: 'موجودی من' })).toBeVisible();
  await expect(p.getByRole('heading', { name: 'راه‌های گرفتن سکه' })).toBeVisible();
  await expect(p.getByRole('button', { name: '۲۰۰ سکه کم دارید' })).toBeDisabled();
  await p.screenshot({ path: `docs/evidence/site/coins/${info.project.name}-empty.png`, fullPage: true });

  credit(mobile, 1250);
  await p.reload();
  await expect(p.getByRole('region', { name: 'موجودی من' })).toContainText('۱٬۲۵۰');
  await p.getByRole('button', { name: 'خرید با سکه' }).first().click();
  await expect(p.getByText(/پریمیوم شما تا .* فعال است/)).toBeVisible();
  await expect(p.locator('#main').getByText('۱٬۰۵۰')).toBeVisible();
  await expect(p.getByText('خرید «یک روز پریمیوم».')).toBeVisible();
  await p.screenshot({ path: `docs/evidence/site/coins/${info.project.name}-spent.png`, fullPage: true });
  await p.goto('/plans');
  await expect(p.getByText('پریمیوم فعال')).toBeVisible();
});
