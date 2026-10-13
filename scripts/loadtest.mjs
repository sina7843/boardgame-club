// Load test: bot pairs sign in, open private live tables, and play random legal moves over Socket.IO.
// Usage (PowerShell):
//   $env:BASE_URL='https://example.ir'; $env:OTP_CODE='<fixture code>'; $env:PAIRS='50'; node scripts/loadtest.mjs
// Env: BASE_URL, OTP_CODE (required) · PAIRS=10 · GAME=othello · MOVE_DELAY_MS=3000 · DURATION_SEC=300
//      RAMP_SEC=60 · MOBILE_BASE=9990000000 (bot n uses 0 + MOBILE_BASE + n) · METRICS_TOKEN (optional)
// Needs the live site on OTP_PROVIDER=fixture. Sessions are cached in the OS temp dir so reruns skip OTP limits.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { io } = createRequire(new URL('../apps/web/package.json', import.meta.url))('socket.io-client');

const env = process.env;
const BASE = (env.BASE_URL ?? '').replace(/\/$/, '');
const OTP = env.OTP_CODE;
if (!BASE || !OTP) { console.error('BASE_URL and OTP_CODE are required'); process.exit(1); }
const PAIRS = Number(env.PAIRS ?? 10);
const GAME = env.GAME ?? 'othello';
const MOVE_DELAY = Number(env.MOVE_DELAY_MS ?? 3000);
const DURATION = Number(env.DURATION_SEC ?? 300) * 1000;
const RAMP = Number(env.RAMP_SEC ?? 60) * 1000;
const MOBILE_BASE = Number(env.MOBILE_BASE ?? 9990000000);
const ORIGIN = new URL(BASE).origin;
const COOKIE = new URL(BASE).protocol === 'https:' ? '__Host-bg_sid' : 'bg_sid';
const CACHE = join(tmpdir(), `bg-loadtest-${new URL(BASE).host}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.5 + Math.random());
const deadline = Date.now() + RAMP + DURATION;

// ---- stats ----
const stats = { rtt: [], http: [], moves: 0, rejected: 0, games: 0, errors: new Map(), connected: 0, disconnects: 0 };
const err = (code) => stats.errors.set(code, (stats.errors.get(code) ?? 0) + 1);
const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
function report(final = false) {
  const { rtt, http } = stats;
  console.log(`[${new Date().toISOString().slice(11, 19)}] sockets=${stats.connected} moves=${stats.moves} rejected=${stats.rejected} games=${stats.games} `
    + `rtt p50/p95/p99=${pct(rtt, 0.5)}/${pct(rtt, 0.95)}/${pct(rtt, 0.99)}ms http p95=${pct(http, 0.95)}ms disc=${stats.disconnects} `
    + `errors=${JSON.stringify(Object.fromEntries(stats.errors))}`);
  if (!final) { stats.rtt = []; stats.http = []; } // per-interval percentiles
}

// ---- HTTP ----
let sessions = {};
try { sessions = JSON.parse(readFileSync(CACHE, 'utf8')); } catch { /* first run */ }

async function api(method, path, body, cookie) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  stats.http.push(Date.now() - t);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) { const e = new Error(data?.errorCode ?? `HTTP_${res.status}`); e.res = res; e.data = data; throw e; }
  return { data, res };
}

async function login(n) {
  const mobile = `0${MOBILE_BASE + n}`;
  if (sessions[mobile]) {
    try { await api('GET', '/me/tables', null, sessions[mobile]); return sessions[mobile]; } catch { delete sessions[mobile]; }
  }
  const { data: ch } = await api('POST', '/auth/otp/request', { mobile });
  // Bot numbers may belong to real people: never let a real SMS provider text them.
  if (!ch.fixtureDelivery) { console.error('Site sends real SMS (OTP_PROVIDER is not fixture) — aborting.'); process.exit(1); }
  const { res } = await api('POST', '/auth/otp/verify', { challengeId: ch.challengeId, code: OTP });
  const token = /(?:__Host-)?bg_sid=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
  if (!token) throw new Error('NO_SESSION_COOKIE');
  sessions[mobile] = decodeURIComponent(token);
  writeFileSync(CACHE, JSON.stringify(sessions));
  return sessions[mobile];
}

// ---- bot ----
function connect(cookie) {
  const socket = io(ORIGIN, {
    path: '/api/socket.io', transports: ['websocket'], reconnectionDelayMax: 5000,
    extraHeaders: { cookie: `${COOKIE}=${encodeURIComponent(cookie)}`, origin: ORIGIN }
  });
  socket.on('connect', () => stats.connected++);
  socket.on('disconnect', () => { stats.connected--; stats.disconnects++; });
  socket.on('connect_error', (e) => err(`connect:${e.message}`));
  return socket;
}

/** Plays every table this socket is subscribed to: moves whenever the server offers legal actions. */
function player(socket) {
  const busy = new Set();
  const finished = new Map(); // tableId -> resolve
  const onSnapshot = async (snap) => {
    const tableId = snap.table.id;
    if (env.DEBUG) console.log(snap.table.mySeat, snap.table.status, snap.game?.revision, snap.game?.pendingSeats, snap.game?.legalActions?.map((a) => a.type).join(','), snap.game?.result?.reason ?? '');
    if (snap.game?.result || ['finished', 'cancelled'].includes(snap.table.status)) { finished.get(tableId)?.(); return; }
    // Real moves only: resign/draw are always legal and would end games early.
    const moves = (snap.game?.legalActions ?? []).filter((a) => !/resign|draw|concede|abandon/i.test(a.type));
    if (!moves.length || !snap.game.pendingSeats.includes(snap.table.mySeat) || busy.has(tableId)) return;
    busy.add(tableId);
    await sleep(jitter(MOVE_DELAY));
    const action = moves[Math.floor(Math.random() * moves.length)];
    const t = Date.now();
    socket.timeout(15000).emit('table.command', { tableId, commandId: randomUUID(), expectedRevision: snap.game.revision, action }, (timeoutErr, ack) => {
      busy.delete(tableId);
      if (timeoutErr) return err('ack_timeout');
      stats.rtt.push(Date.now() - t);
      if (!ack.ok) return err(ack.errorCode);
      if (ack.status === 'accepted') stats.moves++; else { stats.rejected++; err(`rejected:${ack.errorCode}`); }
      void onSnapshot(ack.snapshot);
    });
  };
  socket.on('table.snapshot', (s) => void onSnapshot(s));
  return {
    play(tableId, inviteCode) {
      return new Promise((resolve) => {
        finished.set(tableId, () => { finished.delete(tableId); resolve(); });
        socket.emit('table.subscribe', { tableId, ...(inviteCode ? { inviteCode } : {}) }, (ack) => {
          if (!ack?.ok) { err(`subscribe:${ack?.errorCode}`); finished.get(tableId)?.(); return; }
          void onSnapshot(ack.snapshot);
        });
      });
    }
  };
}

/** Leftover tables from an interrupted run would block "one live table per user". */
async function cleanup(cookie, bot) {
  const { data } = await api('GET', '/me/tables', null, cookie);
  for (const t of data.items) {
    if (t.status === 'open') await api('POST', `/tables/${t.id}/leave`, null, cookie).catch(() => {});
    if (t.status === 'active' && t.pace === 'live') await bot.play(t.id);
  }
}

async function runPair(i, liveSeconds) {
  await sleep((RAMP / PAIRS) * i);
  let a, b;
  try { a = await login(2 * i); b = await login(2 * i + 1); } catch (e) { err(`login:${e.message}`); return; }
  const sa = connect(a), sb = connect(b);
  const pa = player(sa), pb = player(sb);
  try {
    await Promise.all([cleanup(a, pa), cleanup(b, pb)]);
    while (Date.now() < deadline) {
      try {
        const { data: { id } } = await api('POST', '/tables', { gameId: GAME, pace: 'live', capacity: 2, turnSeconds: liveSeconds, visibility: 'private' }, a);
        const { data: snap } = await api('GET', `/tables/${id}`, null, a);
        await api('POST', `/tables/${id}/join`, { inviteCode: snap.table.inviteCode }, b); // the joiner sits ready
        await api('POST', `/tables/${id}/ready`, { ready: true }, a); // host ready + full table = start
        await Promise.all([pa.play(id), pb.play(id, snap.table.inviteCode)]);
        stats.games++;
      } catch (e) { err(e.message); await sleep(5000); await Promise.all([cleanup(a, pa), cleanup(b, pb)]).catch(() => {}); }
    }
  } finally { sa.close(); sb.close(); }
}

async function scrapeMetrics() {
  if (!env.METRICS_TOKEN) return;
  try {
    const res = await fetch(`${BASE}/api/metrics`, { headers: { authorization: `Bearer ${env.METRICS_TOKEN}` } });
    const lines = (await res.text()).split('\n').filter((l) => /socket_connections|5xx|module_failures|command_duration_ms_(sum|count)|resident_bytes|cpu_seconds/.test(l) && !l.startsWith('#'));
    console.log('  server:', lines.join(' | '));
  } catch (e) { console.log('  server metrics failed:', e.message); }
}

const { data: game } = await api('GET', `/games/${GAME}`);
const liveSeconds = Math.max(...(game.liveSeconds ?? []));
if (!Number.isFinite(liveSeconds)) { console.error(`${GAME} has no live time options`); process.exit(1); }
console.log(`load test: ${PAIRS} pairs (${PAIRS * 2} players) on ${GAME}, ramp ${RAMP / 1000}s, hold ${DURATION / 1000}s, move every ~${MOVE_DELAY}ms`);
const timer = setInterval(() => { report(); void scrapeMetrics(); }, 10_000);
await Promise.all(Array.from({ length: PAIRS }, (_, i) => runPair(i, liveSeconds)));
clearInterval(timer);
report(true);
