import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { newPage, player, signIn } from './helpers.ts';

// Release-candidate checks (phase 04). Runs in every project (360 / 768 / 1440 / 1920).
// Real iOS Safari / Android Chrome are NOT covered here — viewport emulation is not a device test.
const DIR = 'docs/evidence/phase-04';
mkdirSync(`${DIR}/screenshots`, { recursive: true });
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
const shot = (project: string, name: string) => `${DIR}/screenshots/${project}-${name}.png`;

async function audit(page: Page, name: string, project: string, found: object[]) {
  await expect(page.locator('main h1, main .state__title').first()).toBeVisible();
  // Bounded: a realtime socket can keep the network from ever going idle.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const v of r.violations) found.push({ page: name, id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target });
  await page.screenshot({ path: shot(project, name), fullPage: true });
}

test('accessibility (axe WCAG 2.1 AA) and screenshot inventory', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const project = info.project.name;
  const found: object[] = [];
  const page = await newPage(browser, info.project.use.viewport ?? null);
  for (const [route, name] of [['/', 'guest-home'], ['/games', 'catalog'], ['/games/line-three', 'game-detail'], ['/login', 'login'], ['/ranking', 'ranking'], ['/plans', 'plans'], ['/nope', 'not-found']] as const) {
    await page.goto(route);
    await audit(page, name, project, found);
  }
  await signIn(page, `QA${Date.now() % 100000}`);
  for (const [route, name] of [['/', 'dashboard'], ['/play', 'quick-match'], ['/tables', 'open-tables'], ['/games/sealed-bids/new', 'create-table'],
    ['/friends', 'friends'], ['/messages', 'messages'], ['/groups', 'groups'], ['/clubs', 'clubs'], ['/progress', 'progress'], ['/support', 'support'],
    ['/settings', 'settings'], ['/more', 'more'], ['/mod', 'mod-denied'], ['/admin', 'admin-denied']] as const) {
    await page.goto(route);
    await audit(page, name, project, found);
  }
  writeFileSync(`${DIR}/a11y-${project}.json`, JSON.stringify(found, null, 1));
  const blocking = found.filter((v) => ['serious', 'critical'].includes((v as { impact: string }).impact));
  expect(blocking, JSON.stringify(blocking, null, 1)).toEqual([]);
  await page.context().close();
});

test('keyboard: skip to content, visible focus, no trap in the shell', async ({ browser }, info) => {
  const page = await newPage(browser, info.project.use.viewport ?? null);
  await page.goto('/games');
  await page.keyboard.press('Tab');
  const first = page.locator(':focus');
  await expect(first).toBeVisible();
  // Focus indicator is drawn (outline or box-shadow), not suppressed.
  const ring = await first.evaluate((el) => { const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; });
  expect(ring).toBe(true);
  const seen = new Set<string>();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? ''));
  }
  expect(seen.size).toBeGreaterThan(5); // focus moves through distinct controls
  await page.context().close();
});

test('admin and moderator areas refuse a normal player (UI and API)', async ({ browser }, info) => {
  const page = await player(browser, info.project.use.viewport ?? null, 'Normal');
  await page.goto('/admin');
  await expect(page.getByText('دسترسی ندارید')).toBeVisible();
  for (const path of ['/api/admin/plans', '/api/admin/missions', '/api/mod/audit', '/api/mod/reports']) {
    expect((await page.request.get(path)).status(), path).toBe(403);
  }
  await page.context().close();
});

test('three-player sealed bids: each client sees only its own sealed value', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  test.setTimeout(180_000);
  const vp = info.project.use.viewport ?? null;
  const [a, b, c] = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار'), await player(browser, vp, 'Cyrus')];
  await a.goto('/games/sealed-bids/new');
  await a.getByLabel('تعداد بازیکن').selectOption('3');
  await a.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await a.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  for (const p of [b, c]) { await p.goto(invite); await p.getByRole('button', { name: 'پیوستن به میز' }).click(); }
  await expect(a.getByText('بازیکنان (۳ از ۳)')).toBeVisible();
  for (const p of [a, b, c]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  const tableId = a.url().split('/tables/')[1]!.split('?')[0]!;

  const plan = [[5, 1, 2], [1, 5, 3], [2, 3, 5], [3, 2, 4], [4, 4, 1]];
  for (const [round, tokens] of plan.entries()) {
    for (const [i, p] of [a, b, c].entries()) {
      // Bids are simultaneous: a click made before another player's push arrives is rejected as STALE_REVISION and,
      // by protocol, never resubmitted automatically — the player sees the fresh state and seals again, as here.
      const sealed = async () => {
        const v = (await (await p.request.get(`/api/tables/${tableId}`)).json()).game.view;
        return v.myBid !== null || v.round > round + 1 || v.outcome !== null;
      };
      for (let attempt = 0; ; attempt++) {
        await expect(p.getByText('پیشنهاد پنهان خود را ثبت کنید')).toBeVisible();
        await p.getByRole('button', { name: `ژتون ${tokens[i]!.toLocaleString('fa-IR')}`, exact: true }).click();
        if (await expect.poll(sealed, { timeout: 5000 }).toBe(true).then(() => true, () => false)) break;
        expect(attempt, 'bid still not accepted after re-sealing').toBeLessThan(2);
        test.info().annotations.push({ type: 'stale-resubmit', description: `round ${round + 1}, client ${i}` });
      }
      if (round === 0 && i === 0) {
        await expect(a.getByText('پیشنهاد مهرشده شما')).toBeVisible();
        await expect(b.getByText('✓ مهر شد')).toBeVisible();
        // What the server actually sends to B and C: A's value appears nowhere, only "submitted".
        for (const other of [b, c]) {
          const view = (await (await other.request.get(`/api/tables/${tableId}`)).json()).game.view;
          expect(view.myBid).toBeNull();
          expect(Object.keys(view)).not.toContain('pending');
          expect(Object.keys(view)).not.toContain('hands');
          expect(view.submitted.filter(Boolean)).toHaveLength(1);
        }
        for (const [n, p2] of [['own', a], ['opponent', b]] as const) await p2.screenshot({ path: shot(info.project.name, `sealed3-${n}`), fullPage: true });
      }
    }
  }
  for (const p of [a, b, c]) await expect(p.getByRole('heading', { name: /بردید|باختید|مساوی/ })).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, 'sealed3-result'), fullPage: true });
  for (const p of [a, b, c]) await p.context().close();
});

test('turn-based: the waiting player returns through «نوبت من» and moves', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const a = await player(browser, vp, 'Host');
  const b = await player(browser, vp, 'مهمان');
  await a.goto('/games/line-three/new');
  await a.getByText('نوبتی', { exact: true }).click();
  await a.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await a.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await b.goto(invite);
  await b.getByRole('button', { name: 'پیوستن به میز' }).click();
  await b.getByRole('button', { name: 'آماده‌ام' }).click();
  await a.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(a.locator('.lt__board')).toBeVisible();
  // Whoever must wait leaves the table; after the other moves, the dashboard lists the table under «نوبت من».
  const turnOf = async () => (await a.getByText('نوبت شماست').isVisible()) ? 'a' : (await b.getByText('نوبت شماست').isVisible()) ? 'b' : null;
  await expect.poll(turnOf).not.toBeNull();
  const [mover, waiter] = (await turnOf()) === 'a' ? [a, b] : [b, a];
  await waiter.goto('/');
  await mover.locator('.lt__cell').nth(4).click();
  const panel = waiter.locator('section[aria-labelledby="my-turn-h"]');
  await expect(panel.getByRole('link').first()).toBeVisible({ timeout: 15_000 });
  await waiter.screenshot({ path: shot(info.project.name, 'my-turn-dashboard'), fullPage: true });
  await panel.getByRole('link').first().click();
  await expect(waiter.getByText('نوبت شماست')).toBeVisible();
  await waiter.locator('.lt__cell').nth(0).click();
  await expect(mover.locator('.lt__cell').nth(0)).not.toHaveText('');
  await a.context().close(); await b.context().close();
});

test('admin chooses a game\'s modes and rule variants; players only see what is offered', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'admin flow runs at 360 and 1440');
  const vp = info.project.use.viewport ?? null;
  const admin = await newPage(browser, vp);
  const mobile = await signIn(admin, `Admin${Date.now() % 100000}`);
  execFileSync('node', ['packages/db/src/grant-role.ts', mobile, 'admin'], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });
  const original = (await (await admin.request.get('/api/admin/games/line-three/settings')).json()).current;
  try {
    await admin.goto('/admin');
    const panel = admin.locator('section[aria-labelledby="game-settings-h"]');
    await panel.getByLabel('بازی', { exact: true }).selectOption('line-three');
    await panel.getByRole('group', { name: 'حالت بازی' }).getByText('زنده').click();
    const variant = panel.getByRole('region', { name: 'شروع‌کننده' });
    await variant.getByRole('group', { name: 'گزینه‌های مجاز' }).getByText('تصادفی').click();
    await variant.getByLabel('میزبان می‌تواند انتخاب کند').click();
    await panel.getByLabel('علت تغییر (در سابقه ثبت می‌شود)').fill('آزمون مرورگر تنظیمات');
    await panel.screenshot({ path: shot(info.project.name, 'admin-game-settings') });
    await panel.getByRole('button', { name: 'ذخیره تنظیمات' }).click();
    await expect(admin.getByText('تنظیمات بازی ذخیره شد')).toBeVisible();

    const player = await newPage(browser, vp);
    await signIn(player, `Host${Date.now() % 100000}`);
    await player.goto('/games/line-three/new');
    await expect(player.getByText('حالت بازی: نوبتی')).toBeVisible();
    await expect(player.getByRole('radio', { name: 'زنده' })).toHaveCount(0);
    await expect(player.getByText('شروع‌کننده: میزبان (صندلی اول) (تعیین‌شده برای این بازی)')).toBeVisible();
    await player.screenshot({ path: shot(info.project.name, 'create-table-restricted'), fullPage: true });
    await player.context().close();
  } finally {
    await admin.request.put('/api/admin/games/line-three/settings', { data: { ...original, reason: 'بازگرداندن پس از آزمون' }, headers: { origin: 'http://127.0.0.1:5173' } });
    await admin.context().close();
  }
});
