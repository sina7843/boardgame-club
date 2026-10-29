// Design-QA setup (states): a finished game, a table with chat between two players, and a spectator account.
// Appends screen-id keys to design/qa/tables.json ({ url, storage }), read by e2e/design-qa.spec.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { signIn } from './helpers.ts';
test.skip(!process.env.BGV_QA_SETUP, 'design-QA setup: run with BGV_QA_SETUP=1 (see design/qa/README.md)');

const HDR = { origin: 'http://127.0.0.1:5173' };
const OUT = 'design/qa/app';
type Entry = { url: string; storage: string };

async function account(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: 'http://127.0.0.1:5173' });
  const page = await ctx.newPage();
  await signIn(page, name);
  return { ctx, page };
}
const post = (p: Page, url: string, data: unknown) => p.request.post(url, { headers: HDR, data });

test('qa state tables', async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  const tables: Record<string, Entry> = JSON.parse(readFileSync('design/qa/tables.json', 'utf8'));
  const save = async (ctx: BrowserContext, key: string) => { const storage = `${OUT}/.storage-${key}.json`; await ctx.storageState({ path: storage }); return storage; };

  // Finished game: chess against a bot, resigned at once.
  const f = await account(browser, 'مینا');
  const bot = await post(f.page, '/api/tables/bot', { gameId: 'chess', level: 'easy', playerCount: 2 });
  expect(bot.status()).toBe(201);
  const fid = (await bot.json()).id as string;
  const snap = await (await f.page.request.get(`/api/tables/${fid}`)).json();
  const res = await post(f.page, `/api/tables/${fid}/commands`, { commandId: randomUUID(), expectedRevision: snap.game.revision, action: { type: 'resign' } });
  expect(res.status()).toBe(200);
  const fin = { url: `/tables/${fid}`, storage: await save(f.ctx, 'finished') };
  for (const k of ['Table-Result-Mobile', 'Table-Result-Desktop']) tables[k] = fin;
  await f.ctx.close();

  // Chat table: two players, a few messages each; a spectator watches it.
  const a = await account(browser, 'مینا');
  const b = await account(browser, 'نیلوفر');
  const t = await post(a.page, '/api/tables', { gameId: 'chess', pace: 'live', turnSeconds: 60, visibility: 'public', competition: 'friendly', capacity: 2, reminders: false });
  expect(t.status()).toBe(201);
  const id = (await t.json()).id as string;
  await post(b.page, `/api/tables/${id}/join`, {});
  for (const p of [a, b]) await post(p.page, `/api/tables/${id}/ready`, { ready: true });
  for (const [p, body] of [[b, 'سلام! آماده‌ای؟'], [a, 'آره، شروع کنیم 🎲'], [b, 'قول می‌دم آسون نگیرم 😄'], [a, 'منم همین‌طور!']] as const) await post(p.page, `/api/tables/${id}/chat`, { body });
  const chat = { url: `/tables/${id}`, storage: await save(a.ctx, 'chat') };
  for (const k of ['Chat-Docked-Desktop', 'Chat-Sheet-Mobile', 'Chat-Sheet-Mobile-Dark', 'Msg-Menu-Others-Mobile', 'Msg-Menu-Mine-Mobile', 'Mention-Compose-Mobile', 'Hud-Bubbles-Mobile']) tables[k] = chat;
  const c = await account(browser, 'آرش');
  const spec = { url: `/tables/${id}`, storage: await save(c.ctx, 'spectator') };
  for (const k of ['Table-Spectator-Mobile', 'Chat-Spectator-Mobile']) tables[k] = spec;
  for (const x of [a, b, c]) await x.ctx.close();

  // Connection screens reuse the six-player uno table of the first setup.
  if (tables.uno) for (const k of ['Table-ConnectionLost-Mobile', 'Table-OpponentOffline-Mobile']) tables[k] = tables.uno;
  writeFileSync('design/qa/tables.json', JSON.stringify(tables));
  console.log('QA_TABLES2', Object.keys(tables).length);
});
