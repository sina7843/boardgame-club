// Design-QA setup: one signed-in QA account per table screen (a player may sit at one live table), each with a live
// table: against bots where the game has them, otherwise a table filled by extra accounts. Writes design/qa/tables.json
// ({ key: { url, storage } }) for e2e/design-qa.spec.ts (BGV_QA_REUSE=1 BGV_QA_TABLES="$(cat design/qa/tables.json)").
import { writeFileSync, mkdirSync } from 'node:fs';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { signIn } from './helpers.ts';
test.skip(!process.env.BGV_QA_SETUP, 'design-QA setup: run with BGV_QA_SETUP=1 (see design/qa/README.md)');

const HDR = { origin: 'http://127.0.0.1:5173' };
const OUT = 'design/qa/app';
const BOT_GAMES: [string, number][] = [['chess', 2], ['uno', 6], ['sushi-go', 4], ['ludo', 4], ['backgammon', 2]];
const HUMAN_GAMES: [string, number][] = [['catan', 4], ['hanabi', 4], ['coup', 4]];

async function account(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ locale: 'fa-IR', timezoneId: 'Asia/Tehran', baseURL: 'http://127.0.0.1:5173' });
  const page = await ctx.newPage();
  await signIn(page, name);
  return { ctx, page };
}

test('qa tables', async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const tables: Record<string, { url: string; storage: string }> = {};
  const keep = async (key: string, host: { ctx: BrowserContext }, id: string) => {
    const storage = `${OUT}/.storage-${key.replace(/\W+/g, '_')}.json`;
    await host.ctx.storageState({ path: storage });
    tables[key] = { url: `/tables/${id}`, storage };
  };
  const post = (p: Page, url: string, data: unknown) => p.request.post(url, { headers: HDR, data });

  for (const [gameId, playerCount] of BOT_GAMES) {
    const a = await account(browser, 'مینا');
    const r = await post(a.page, '/api/tables/bot', { gameId, level: 'easy', playerCount });
    if (r.status() === 201) await keep(gameId, a, (await r.json()).id); else console.log('bot table failed', gameId, r.status());
    await a.ctx.close();
  }
  for (const [gameId, n] of HUMAN_GAMES) {
    const host = await account(browser, 'مینا');
    const r = await post(host.page, '/api/tables', { gameId, pace: 'live', turnSeconds: 60, visibility: 'public', competition: 'friendly', capacity: n, reminders: false });
    if (r.status() !== 201) { console.log('table failed', gameId, r.status(), (await r.text()).slice(0, 160)); await host.ctx.close(); continue; }
    const id = (await r.json()).id as string;
    const guests: { ctx: BrowserContext; page: Page }[] = [];
    for (let i = 1; i < n; i++) {
      const g = await account(browser, ['نیلوفر', 'سارا', 'آرش'][i - 1] ?? `بازیکن ${i}`);
      await post(g.page, `/api/tables/${id}/join`, {});
      guests.push(g);
    }
    for (const p of [host, ...guests]) await post(p.page, `/api/tables/${id}/ready`, { ready: true });
    await keep(gameId, host, id);
    for (const g of [host, ...guests]) await g.ctx.close();
  }
  // The waiting lobby: a public table nobody has joined.
  const lobby = await account(browser, 'مینا');
  const o = await post(lobby.page, '/api/tables', { gameId: 'azul', pace: 'turn', turnSeconds: 86400, visibility: 'public', competition: 'friendly', capacity: 4, reminders: false });
  if (o.status() === 201) await keep('lobby (waiting)', lobby, (await o.json()).id); else console.log('lobby failed', o.status(), (await o.text()).slice(0, 160));
  await lobby.ctx.close();
  writeFileSync('design/qa/tables.json', JSON.stringify(tables));
  console.log('QA_TABLES', JSON.stringify(Object.keys(tables)));
  expect(Object.keys(tables).length).toBeGreaterThan(5);
});
