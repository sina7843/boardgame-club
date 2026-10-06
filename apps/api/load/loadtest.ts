// Load profile for the real stack (through the reverse proxy): two game types, hidden + public state,
// concurrent simultaneous commands, duplicate resends, reconnects and an optional worker restart.
// Uses only public HTTP/Socket.IO endpoints and the development OTP fixture, so it cannot run against production.
//   node apps/api/load/loadtest.ts  (env: BASE, L3_TABLES, SB_TABLES, DURATION_S, RECONNECT_PCT, DUP_PCT,
//                                    THINK_MS, OTP_CODE, METRICS_TOKEN, RESTART_WORKER=<container name>)
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { io, type Socket } from 'socket.io-client';

const env = process.env;
const BASE = env.BASE ?? 'http://127.0.0.1:18080';
const L3 = Number(env.L3_TABLES ?? 20);
const SB = Number(env.SB_TABLES ?? 10);
const DURATION = Number(env.DURATION_S ?? 60) * 1000;
const RECONNECT_PCT = Number(env.RECONNECT_PCT ?? 2);
const DUP_PCT = Number(env.DUP_PCT ?? 3);
const THINK_MS = Number(env.THINK_MS ?? 150);
const TURN_SECONDS = Number(env.TURN_SECONDS ?? 60);
const CODE = env.OTP_CODE ?? '123456';
const H = { origin: BASE, 'content-type': 'application/json' };

type User = { cookie: string; id: string };
type Snap = { table: { status: string; mySeat: number | null; inviteCode: string | null }; game: { revision: number; view: Record<string, unknown>; legalActions: { type: string; cell?: number; token?: number }[] } | null };

const lat: number[] = [];
const outcomes: Record<string, number> = {};
const failures: string[] = [];
let accepted = 0, gamesFinished = 0, gamesStalled = 0, reconnects = 0, hiddenViolations = 0, hiddenChecks = 0;
const count = (k: string) => { outcomes[k] = (outcomes[k] ?? 0) + 1; };

async function http(method: string, path: string, user?: User, body?: unknown) {
  const res = await fetch(BASE + path, { method, headers: { ...H, ...(user ? { cookie: user.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 160)}`);
  return { res, json: text ? JSON.parse(text) : null };
}

async function login(i: number): Promise<User> {
  const mobile = `0919${String(Date.now() % 1000).padStart(3, '0')}${String(i).padStart(4, '0')}`;
  const { json: ch } = await http('POST', '/api/auth/otp/request', undefined, { mobile });
  const { res } = await http('POST', '/api/auth/otp/verify', undefined, { challengeId: ch.challengeId, code: CODE });
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  const { json: me } = await http('GET', '/api/me', { cookie, id: '' });
  return { cookie, id: me.id };
}

const SB_VIEW_KEYS = 'history,myBid,myHand,outcome,players,prize,resigned,round,scores,seatOrder,submitted';

/** One bot = one socket for one player. Acts whenever the pushed projection offers it a legal action. */
class Bot {
  socket!: Socket;
  last: Snap | null = null;
  busy = false;
  done!: Promise<void>;
  private finish!: () => void;
  readonly user: User;
  readonly tableId: string;
  readonly game: string;
  constructor(user: User, tableId: string, game: string) {
    this.user = user; this.tableId = tableId; this.game = game;
    this.done = new Promise((r) => (this.finish = r));
  }
  connect() {
    this.socket = io(BASE, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { cookie: this.user.cookie, origin: BASE }, reconnection: false });
    this.socket.on('table.snapshot', (s: Snap) => this.onSnap(s));
    this.socket.on('session.ready', () => {
      this.socket.emit('table.subscribe', { tableId: this.tableId, lastRevision: this.last?.game?.revision }, (r: { ok: boolean; snapshot?: Snap }) => r.ok && this.onSnap(r.snapshot!));
    });
  }
  onSnap(s: Snap) {
    if (this.last?.game && s.game && s.game.revision < this.last.game.revision) return;
    this.last = s;
    if (this.game === 'sealed-bids' && s.game) {
      hiddenChecks++;
      if (Object.keys(s.game.view).sort().join(',') !== SB_VIEW_KEYS || 'hands' in s.game.view || 'pending' in s.game.view) hiddenViolations++;
    }
    if (s.table.status === 'finished' || s.table.status === 'aborted') { this.finish(); return; }
    void this.act();
  }
  async act() {
    if (this.busy || !this.last?.game || this.last.table.status !== 'active') return;
    if (!this.last.game.legalActions.some((a) => a.type !== 'resign')) return;
    this.busy = true;
    await new Promise((r) => setTimeout(r, Math.random() * THINK_MS * 2));
    // Like the UI: the command uses the projection shown at "click" time (pushes keep it current while thinking).
    const g = this.last.game;
    const moves = g.legalActions.filter((a) => a.type !== 'resign');
    if (this.closed || this.last.table.status !== 'active' || !moves.length) { this.busy = false; return; }
    const action = moves[Math.floor(Math.random() * moves.length)]!;
    const envelope = { commandId: randomUUID(), tableId: this.tableId, expectedRevision: g.revision, action };
    const send = () => new Promise<{ ok: boolean; status?: string; revision?: number; errorCode?: string; snapshot?: Snap }>((resolve) => {
      const t0 = performance.now();
      this.socket.timeout(10_000).emit('table.command', envelope, (err: Error | null, r: { ok: boolean; status?: string; revision?: number; errorCode?: string; snapshot?: Snap }) => {
        if (!err) lat.push(performance.now() - t0);
        resolve(err ? { ok: false, errorCode: 'CLIENT_TIMEOUT' } : r);
      });
    });
    const r = await send();
    if (this.closed) return;
    // ok:false = transport/validation failure; ok:true carries the receipt (accepted, or rejected with a code).
    const outcome = r.ok && r.status === 'accepted' ? 'accepted' : (r.errorCode ?? 'UNKNOWN');
    count(outcome);
    if (outcome === 'accepted') accepted++;
    if (r.ok && this.socket.connected && r.snapshot?.table.status === 'active' && Math.random() * 100 < DUP_PCT) {
      const d = await send(); // network-retry simulation: same commandId must return the original receipt
      if (this.closed) return;
      count(d.ok && d.status === r.status && d.revision === r.revision ? 'duplicate-same-receipt' : `duplicate-MISMATCH-${d.errorCode ?? d.status}`);
      if (!(d.ok && d.status === r.status && d.revision === r.revision)) failures.push('DUPLICATE_MISMATCH');
    }
    if (!['accepted', 'STALE_REVISION', 'NOT_YOUR_TURN', 'TABLE_NOT_ACTIVE'].includes(outcome)) failures.push(outcome);
    this.busy = false;
    if (r.snapshot) this.onSnap(r.snapshot);
    else if (r.errorCode === 'STALE_REVISION') this.socket.emit('table.subscribe', { tableId: this.tableId }, (x: { ok: boolean; snapshot?: Snap }) => x.ok && this.onSnap(x.snapshot!));
    if (Math.random() * 100 < RECONNECT_PCT) { reconnects++; this.socket.disconnect(); this.connect(); }
    void this.act(); // a newer push may have arrived while this command was in flight
  }
  closed = false;
  close() { this.closed = true; this.socket?.disconnect(); this.finish(); }
}

async function playTable(game: 'line-three' | 'sealed-bids', players: User[], until: number) {
  while (Date.now() < until) {
    const { json: created } = await http('POST', '/api/tables', players[0], { gameId: game, pace: 'live', capacity: players.length, turnSeconds: TURN_SECONDS });
    const { json: v } = await http('GET', `/api/tables/${created.id}`, players[0]);
    for (const p of players.slice(1)) await http('POST', `/api/tables/${created.id}/join`, p, { inviteCode: v.table.inviteCode });
    const bots = players.map((p) => new Bot(p, created.id, game));
    bots.forEach((b) => b.connect());
    await new Promise((r) => setTimeout(r, 300));
    for (const p of players) await http('POST', `/api/tables/${created.id}/ready`, p, { ready: true });
    // Stalled = no revision progress for 20 s (server deadlines are 60 s, bots think ≤ 2×THINK_MS).
    let lastRev = -1, lastChange = Date.now();
    const timer = setInterval(async () => {
      const rev = Math.max(...bots.map((b) => b.last?.game?.revision ?? 0));
      if (rev !== lastRev) { lastRev = rev; lastChange = Date.now(); return; }
      if (Date.now() - lastChange < 20_000) return;
      clearInterval(timer);
      gamesStalled++;
      if (env.DEBUG_STALLS) {
        const server = (await http('GET', `/api/tables/${created.id}`, players[0]).catch(() => ({ json: null }))).json;
        console.log('STALL', game, 'server', server?.table.status, server?.game?.revision, JSON.stringify(server?.game?.pendingSeats),
          bots.map((b) => `seat${b.last?.table.mySeat} rev${b.last?.game?.revision} st=${b.last?.table.status} legal=${b.last?.game?.legalActions.length} busy=${b.busy} conn=${b.socket.connected}`).join(' | '));
      }
      bots.forEach((b) => b.close());
    }, 2000);
    await Promise.all(bots.map((b) => b.done));
    clearInterval(timer);
    bots.forEach((b) => b.close());
    if (bots.every((b) => b.last?.table.status === 'finished')) gamesFinished++;
  }
}

async function serverMetrics() {
  if (!env.METRICS_TOKEN) return '';
  // The production proxy does not route /api/metrics; point METRICS_URL at the API directly (internal network).
  const r = await fetch(env.METRICS_URL ?? `${BASE}/api/metrics`, { headers: { authorization: `Bearer ${env.METRICS_TOKEN}` } });
  return r.ok ? r.text() : '';
}
const pick = (text: string, re: RegExp) => Number(text.match(re)?.[1] ?? NaN);
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]! : NaN; };

const users: User[] = [];
const need = L3 * 2 + SB * 3;
for (let i = 0; i < need; i += 20) users.push(...await Promise.all(Array.from({ length: Math.min(20, need - i) }, (_, k) => login(i + k))));
console.log(`logged in ${users.length} users`);
const before = await serverMetrics();
const started = Date.now();
const until = started + DURATION;
if (env.RESTART_WORKER) setTimeout(() => { try { execFileSync('docker', ['restart', '-t', '20', env.RESTART_WORKER!]); console.log('worker restarted'); } catch (e) { console.log('worker restart failed', String(e)); } }, DURATION / 2);
const tasks: Promise<void>[] = [];
let u = 0;
for (let i = 0; i < L3; i++) tasks.push(playTable('line-three', users.slice(u, u += 2), until).catch((e) => { failures.push(String(e).slice(0, 200)); }));
for (let i = 0; i < SB; i++) tasks.push(playTable('sealed-bids', users.slice(u, u += 3), until).catch((e) => { failures.push(String(e).slice(0, 200)); }));
const peak = setInterval(async () => { const m = await serverMetrics(); const c = pick(m, /bg_socket_connections (\d+)/); if (c > peakConn) peakConn = c; }, 2000);
let peakConn = 0;
await Promise.all(tasks);
clearInterval(peak);
const seconds = (Date.now() - started) / 1000;
const after = await serverMetrics();
const sum = (t: string) => pick(t, /bg_command_duration_ms_sum\{transport="socket"\} ([\d.]+)/);
const cnt = (t: string) => pick(t, /bg_command_duration_ms_count\{transport="socket"\} (\d+)/);
const bucket = (t: string, le: number) => pick(t, new RegExp(`bg_command_duration_ms_bucket\\{transport="socket",le="${le}"\\} (\\d+)`));
const n = cnt(after) - (cnt(before) || 0);
const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
console.log(JSON.stringify({
  host: { cpus: cpus().length, model: cpus()[0]?.model, ramGb: +(totalmem() / 2 ** 30).toFixed(1) },
  profile: { base: BASE, lineThreeTables: L3, sealedBidsTables: SB, players: users.length, durationS: +seconds.toFixed(1), thinkMs: THINK_MS, reconnectPct: RECONNECT_PCT, duplicatePct: DUP_PCT, workerRestart: !!env.RESTART_WORKER },
  results: {
    commands: total, accepted, acceptedPerSec: +(accepted / seconds).toFixed(1), gamesFinished, gamesStalled, reconnects, peakSocketConnections: peakConn,
    outcomes, unexpectedErrors: failures.length, errorRatePct: +((failures.length / Math.max(total, 1)) * 100).toFixed(3), sampleErrors: [...new Set(failures)].slice(0, 5),
    clientRoundTripMs: { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), p99: +pct(lat, 99).toFixed(1), max: +Math.max(...lat).toFixed(1) },
    serverCommandMs: { mean: +((sum(after) - (sum(before) || 0)) / n).toFixed(1), shareUnder50ms: +(((bucket(after, 50) - (bucket(before, 50) || 0)) / n) * 100).toFixed(1), shareUnder250ms: +(((bucket(after, 250) - (bucket(before, 250) || 0)) / n) * 100).toFixed(1) },
    hiddenInfo: { checks: hiddenChecks, violations: hiddenViolations },
    afterRun: { outboxBacklog: pick(after, /bg_outbox_backlog (\d+)/), deadlinesOverdue: pick(after, /bg_deadlines_overdue (\d+)/), moduleFailures: pick(after, /bg_module_failures_total (\d+)/) }
  }
}, null, 1));
process.exit(0);
