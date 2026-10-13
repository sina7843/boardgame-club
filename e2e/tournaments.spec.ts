import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { newPage, player, signIn } from './helpers.ts';

// Tournaments end to end: the admin creates one in the panel, two players register from the list, the worker starts it
// at the scheduled time and each player gets a table link. Playing tables out and scoring is covered by the API test.
// Needs the worker.
test.describe.configure({ mode: 'serial', timeout: 360_000 });
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
const grant = (mobile: string, role: string) => execFileSync('node', ['packages/db/src/grant-role.ts', mobile, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });
const shot = (project: string, name: string) => `docs/evidence/tournaments/${project}-${name}.png`;

test('admin creates a tournament, players register, the worker seats them at round one', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'runs at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const title = `جام آزمایشی ${Date.now() % 100000}`;

  const admin = await newPage(browser, vp);
  grant(await signIn(admin, 'مدیر تورنمنت'), 'admin');
  await admin.goto('/admin');
  await admin.getByRole('tab', { name: 'تورنمنت‌ها' }).click();
  const panel = admin.getByRole('tabpanel', { name: 'تورنمنت‌ها' });
  await panel.getByLabel('بازی', { exact: true }).selectOption('line-three');
  await panel.getByLabel('عنوان', { exact: true }).fill(title);
  // Starts in about two minutes (the API needs a minute's notice; the field drops seconds). The browser runs in
  // Asia/Tehran, so the field takes Tehran wall time.
  const tehran = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(Date.now() + 120_000)).replace(' ', 'T');
  await panel.getByLabel('شروع', { exact: true }).fill(tehran);
  await panel.getByLabel('حداقل ثبت‌نام', { exact: true }).fill('2');
  await panel.getByLabel('تعداد دور', { exact: true }).fill('1');
  await panel.getByRole('button', { name: 'ساخت و باز کردن ثبت‌نام' }).click();
  await expect(admin.getByText('تورنمنت ساخته شد', { exact: false })).toBeVisible();
  await admin.screenshot({ path: shot(info.project.name, 'admin'), fullPage: true });

  const players = [await player(browser, vp, 'بازیکن یک'), await player(browser, vp, 'بازیکن دو')];
  for (const p of players) {
    await p.goto('/tournaments');
    await p.getByRole('link', { name: new RegExp(title) }).click();
    await p.getByRole('button', { name: 'ثبت‌نام' }).click();
    await expect(p.getByText('ثبت‌نام کرده‌اید')).toBeVisible();
  }
  await players[0]!.screenshot({ path: shot(info.project.name, 'registered'), fullPage: true });

  // The worker starts round one at the start time; the page polls and shows the table link.
  for (const p of players) await expect(p.getByRole('link', { name: 'میز شما آماده است؛ ورود به میز' })).toBeVisible({ timeout: 150_000 });
  await players[0]!.screenshot({ path: shot(info.project.name, 'round'), fullPage: true });
  await players[0]!.getByRole('link', { name: 'میز شما آماده است؛ ورود به میز' }).click();
  await expect(players[0]!).toHaveURL(/\/tables\//);

  // Both players ready up, the table starts, and a signed-in outsider watches it from the tournament page and the live list.
  const tournamentUrl = players[1]!.url();
  await players[1]!.getByRole('link', { name: 'میز شما آماده است؛ ورود به میز' }).click();
  for (const p of players) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  const watcher = await player(browser, vp, 'تماشاگر تورنمنت');
  await watcher.goto(tournamentUrl);
  await expect(watcher.getByRole('link', { name: 'تماشا' }).first()).toBeVisible({ timeout: 30_000 });
  await watcher.getByRole('link', { name: 'تماشا' }).first().click();
  await expect(watcher.getByText(/تماشاگر ·/)).toBeVisible();
  await expect(watcher.getByRole('button', { name: /گفت‌وگوی میز/ })).toHaveCount(0);
  await watcher.screenshot({ path: shot(info.project.name, 'spectator'), fullPage: true });
  await watcher.goto('/tables');
  await expect(watcher.getByRole('heading', { name: 'در حال بازی؛ تماشا کنید' })).toBeVisible();
  await expect(watcher.getByRole('link', { name: title })).toBeVisible();
  await watcher.screenshot({ path: shot(info.project.name, 'live-list'), fullPage: true });
  await watcher.context().close();

  // Clean up: cancel so a later run does not see this tournament running.
  const list = await (await admin.request.get('/api/tournaments')).json();
  const mine = list.items.find((t: { titleFa: string }) => t.titleFa === title);
  await admin.request.post(`/api/admin/tournaments/${mine.id}/cancel`, { data: { reason: 'پایان آزمون E2E' }, headers: { origin: 'http://127.0.0.1:5173' } });
  for (const p of [admin, ...players]) await p.context().close();
});
