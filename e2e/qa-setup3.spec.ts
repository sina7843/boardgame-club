// Design-QA setup (data): moderator and admin accounts, a group with a friend, and the public-profile/group screens
// mapped to an account that has friends. Run after qa-setup2; appends to design/qa/tables.json and writes
// design/qa/app/.storage-{moderator,admin}.json (pass them as BGV_QA_MODERATOR_STORAGE / BGV_QA_ADMIN_STORAGE).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, type Browser } from '@playwright/test';
import { signIn } from './helpers.ts';
test.skip(!process.env.BGV_QA_SETUP, 'design-QA setup: run with BGV_QA_SETUP=1');

const OUT = 'design/qa/app';
const HDR = { origin: 'http://127.0.0.1:5173' };
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
type Entry = { url: string; storage: string };

async function roleAccount(browser: Browser, name: string, role: string) {
  const ctx = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: 'http://127.0.0.1:5173' });
  const page = await ctx.newPage();
  const mobile = await signIn(page, name);
  execFileSync('node', ['packages/db/src/grant-role.ts', mobile, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });
  await ctx.storageState({ path: `${OUT}/.storage-${role}.json` });
  await ctx.close();
}

test('qa data', async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const tables: Record<string, Entry> = JSON.parse(readFileSync('design/qa/tables.json', 'utf8'));
  await roleAccount(browser, 'ناظر سایت', 'moderator');
  await roleAccount(browser, 'مدیر سایت', 'admin');

  // The chat account (مینا) is friends with the spectator (آرش) after the DM step; give it a group with him.
  const chat = tables['Chat-Docked-Desktop']!;
  const spec = tables['Table-Spectator-Mobile']!;
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', storageState: chat.storage });
  const c = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', storageState: spec.storage });
  const cid = (await (await c.request.get('/api/me')).json()).id as string;
  const g = await a.request.post('/api/groups', { headers: HDR, data: { name: 'جمع کاتانی‌ها' } });
  expect(g.status()).toBe(201);
  const gid = (await g.json()).id as string;
  expect((await a.request.post(`/api/groups/${gid}/invites`, { headers: HDR, data: { userId: cid } })).status()).toBe(200);
  expect((await c.request.post(`/api/groups/${gid}/accept`, { headers: HDR })).status()).toBe(200);
  for (const k of ['Group-Desktop', 'Profile-Public-Desktop', 'Profile-Public-Mobile', 'Profile-Public-Mobile-Dark']) tables[k] = chat;
  await a.close(); await c.close();
  writeFileSync('design/qa/tables.json', JSON.stringify(tables));
});
