import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// Avatar builder and profile customization: try on a locked coin item, buy it, save; the avatar shows in the shell
// and on the public profile together with the bio, title and banner.
test.describe.configure({ timeout: 90_000 });
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
/** Test-only credit straight into the ledger (earning is covered by the API suite). */
const credit = (mobile: string, amount: number) => execFileSync('node', ['--input-type=module', '-e', `
  import postgres from 'postgres';
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  await sql\`insert into coin_ledger (user_id, amount, rule_id, reason, source_key)
    select user_id, \${${amount}}, 'e2e', 'اعتبار آزمایشی', 'e2e:' || gen_random_uuid() from user_private where mobile = \${'${mobile}'}\`;
  await sql.end();`], { cwd: 'packages/db', env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });

test('build an avatar, buy a locked item, customize the profile', async ({ browser }, info) => {
  const p = await newPage(browser, info.project.use.viewport ?? null);
  const name = `Avatar${Math.random().toString(36).slice(2, 6)}`;
  const mobile = await signIn(p, name, '/me/avatar');
  await p.goto('/me/avatar');
  await expect(p.getByRole('heading', { name: 'ساخت آواتار', level: 1 })).toBeVisible();

  // Locked coin item: can be tried on, cannot be saved or bought without coins.
  await p.getByRole('radio', { name: /بلند صاف/ }).click();
  await expect(p.getByText('«بلند صاف» قفل است: ۱۰۰ سکه')).toBeVisible();
  await expect(p.getByRole('button', { name: '۱۰۰ سکه کم دارید' })).toBeDisabled();
  await expect(p.getByRole('button', { name: 'ذخیره آواتار' })).toBeDisabled();

  credit(mobile, 300);
  await p.reload();
  await p.getByRole('button', { name: 'رنگ مو' }).click();
  await p.getByRole('radio', { name: /حنایی/ }).click();
  await p.getByRole('button', { name: 'مو', exact: true }).click();
  await p.getByRole('radio', { name: /بلند صاف/ }).click();
  await p.getByRole('button', { name: 'خرید با ۱۰۰ سکه' }).click();
  await expect(p.getByText('«بلند صاف» خریده شد.')).toBeVisible();
  await p.getByRole('button', { name: 'ذخیره آواتار' }).click();
  await expect(p.getByText('آواتار ذخیره شد.')).toBeVisible();
  await expect(p.getByRole('img', { name: `آواتار ${name}` }).first()).toBeVisible(); // shell
  await p.screenshot({ path: `docs/evidence/avatar/${info.project.name}-builder.png`, fullPage: true });

  await p.goto('/settings');
  await p.getByLabel('معرفی کوتاه').fill('عاشق بازی‌های رومیزی');
  await p.getByLabel('لقب').selectOption({ label: 'اهل بازی' });
  await p.getByRole('button', { name: 'دریا', exact: true }).click();
  await p.getByRole('button', { name: 'ذخیره شخصی‌سازی' }).click();
  await expect(p.getByText('پروفایل ذخیره شد.')).toBeVisible();

  const me = await (await p.request.get('/api/me')).json() as { id: string; avatarKey: string };
  expect(me.avatarKey).toMatch(/^v1:.*\.h6\.hc4\./);
  await p.goto(`/users/${me.id}`);
  await expect(p.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(p.getByText('اهل بازی')).toBeVisible();
  await expect(p.getByText('عاشق بازی‌های رومیزی')).toBeVisible();
  await expect(p.getByRole('img', { name: `آواتار ${name}` }).last()).toBeVisible();
  await p.screenshot({ path: `docs/evidence/avatar/${info.project.name}-profile.png`, fullPage: true });
});
