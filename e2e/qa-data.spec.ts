// Design-QA setup: gives the QA account (design/qa/app/.storage.json, BGV_QA_REUSE=1) a friend, a direct conversation
// with messages and a group, so the profile, DM and group screens have data.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { signIn } from './helpers.ts';
test.skip(!process.env.BGV_QA_SETUP, 'design-QA setup: run with BGV_QA_SETUP=1 (see design/qa/README.md)');

const HDR = { origin: 'http://127.0.0.1:5173' };

test('qa social data', async ({ browser }) => {
  test.setTimeout(120_000);
  const base = { locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: 'http://127.0.0.1:5173' };
  if (!existsSync('design/qa/app/.storage.json')) {
    const c = await browser.newContext(base);
    await signIn(await c.newPage(), 'مینا');
    await c.storageState({ path: 'design/qa/app/.storage.json' });
    await c.close();
  }
  const a = await browser.newContext({ ...base, storageState: 'design/qa/app/.storage.json' });
  const b = await browser.newContext(base);
  const bp = await b.newPage();
  await signIn(bp, 'نیلوفر');
  const meA = await (await a.request.get('/api/me')).json();
  const meB = await (await b.request.get('/api/me')).json();
  const post = (ctx: typeof a, url: string, data: unknown) => ctx.request.post(url, { headers: HDR, data });
  await post(a, '/api/friends/requests', { userId: meB.id });
  await post(b, `/api/friends/requests/${meA.id}/accept`, {});
  const dm = await post(a, '/api/conversations/direct', { userId: meB.id });
  expect(dm.status()).toBe(200);
  const id = (await dm.json()).id as string;
  for (const [ctx, body] of [[a, 'سلام نیلوفر! امشب کاتان؟'], [b, 'سلام! آره، ساعت ۹ میز می‌سازم.'], [a, 'عالیه، منم میام 🎲']] as const) {
    await post(ctx, `/api/conversations/${id}/messages`, { body });
  }
  const g = await post(a, '/api/groups', { name: 'دوستان بردگیم' });
  expect(g.status()).toBe(201);
  const gid = (await g.json()).id as string;
  await post(a, `/api/groups/${gid}/invites`, { userId: meB.id });
  await post(b, `/api/groups/${gid}/accept`, {});
  await a.close(); await b.close();
});
