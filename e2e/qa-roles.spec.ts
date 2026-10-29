// Design-QA setup: a moderator and an admin account (role granted in the dev database) for the /mod and /admin screens.
// Then: BGV_QA_MODERATOR_STORAGE=design/qa/app/.storage-moderator.json BGV_QA_ADMIN_STORAGE=design/qa/app/.storage-admin.json
import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { signIn } from './helpers.ts';
test.skip(!process.env.BGV_QA_SETUP, 'design-QA setup: run with BGV_QA_SETUP=1 (see design/qa/README.md)');

for (const role of ['moderator', 'admin'] as const) {
  test(`qa ${role}`, async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: 'http://127.0.0.1:5173' });
    const page = await ctx.newPage();
    const mobile = await signIn(page, role === 'admin' ? 'مدیر' : 'ناظر');
    const tail = mobile.replace(/\D/g, '').slice(-10);
    const sql = `insert into user_roles (user_id, role) select user_id, '${role}' from user_private where mobile like '%${tail}' on conflict do nothing`;
    execSync(`docker exec boardgame-dev-postgres-1 psql -U boardgame -d boardgame -c "${sql}"`, { stdio: 'pipe' });
    await page.goto(role === 'admin' ? '/admin' : '/mod');
    await expect(page.locator('main, #main').first()).toBeVisible();
    await ctx.storageState({ path: `design/qa/app/.storage-${role}.json` });
    await ctx.close();
  });
}
