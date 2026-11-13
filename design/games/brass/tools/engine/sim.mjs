// Plays seeded 4-player games with the repo engine (copied, unchanged) and writes the mock positions of the artboards:
// node --experimental-strip-types --no-warnings sim.mjs <seed> <out.json>
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const r = await import(pathToFileURL('E:/AI/Claude/bgv-brass/engine/src/rules.ts'));
const [seedArg, out] = process.argv.slice(2);
let seed = +seedArg;
const rng = { nextInt: (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); } };
const rnd = (xs) => xs[rng.nextInt(xs.length)];
const P = { kind: 'player' };
const act = (s, seat, a) => r.brassModule.apply(s, { kind: 'player', seat }, a, { rng });

function value(s, seat) {
  const left = Math.max(1, (s.era === 'canal' ? 16 : 8) - s.round);
  const m = s.money[seat];
  let v = Math.min(m, 35) + 0.25 * Math.max(0, m - 35) + left * 0.9 * r.incomeLevel(s.income[seat]) + 3 * s.vp[seat];
  for (const row of Object.values(s.board)) for (const t of row) if (t && t.owner === seat) { const d = r.tileDef(t.industry, t.level); v += t.flipped ? 2.2 * d.vp + 3 : 0.9 * d.vp + 0.4 * d.income + 2; }
  for (const [id, o] of Object.entries(s.links)) if (o === seat) v += 2 + r.linkNodes(r.LINK.get(id)).reduce((n, x) => n + r.locationLinkVp(s, x), 0) * (s.era === 'rail' ? 1.2 : 0.8);
  return v;
}
function choose(s, seat) {
  const hand = s.hands[seat];
  // the last action of an era is a pass, so the pre-scoring position equals the board that is scored
  if (!s.deck.length && s.hands.every((h, k) => k === seat || !h.length) && hand.length === 1) return { type: 'pass', card: hand[0] };
  const hints = r.legalFor(s, seat);
  const cands = [];
  for (const h of hints) {
    if (h.type === 'resign') continue;
    if (h.type === 'build') cands.push({ type: 'build', card: rnd(h.cards), industry: h.industry, loc: h.loc, slot: h.slot });
    else if (h.type === 'network') cands.push({ type: 'network', card: rnd(hand), links: h.links });
    else if (h.type === 'develop') cands.push({ type: 'develop', card: rnd(hand), industries: h.industries });
    else if (h.type === 'sell') cands.push({ type: 'sell', card: rnd(hand), sales: [{ loc: h.loc, slot: h.slot, merchant: h.merchant }] });
    else if (h.type === 'scout') continue;
    else cands.push({ type: h.type, card: rnd(hand) });
  }
  let best = null, bv = -1e9;
  const base = value(s, seat);
  for (const a of cands) {
    const c = structuredClone(s);
    const save = seed;
    try { r.brassModule.apply(c, { kind: 'player', seat }, a, { rng: { nextInt: () => 0 } }); } catch { continue; }
    seed = save;
    const v = value(c, seat) - base + rng.nextInt(1000) / 250 - (a.type === 'pass' ? 1 : 0);
    if (v > bv) { bv = v; best = a; }
  }
  return best ?? { type: 'pass', card: hand[0] };
}

const s = r.brassModule.setup({ playerCount: 4, rng, options: {} });
const snaps = { setup: structuredClone(s) };
if (r.currentSeat(s) === 0) snaps.canal1 = structuredClone(s);
const log = [];
let steps = 0;
while (!s.outcome && steps < 2000) {
  const seat = r.currentSeat(s);
  const before = structuredClone(s);
  const a = choose(s, seat);
  act(s, seat, a);
  log.push({ seat, a, era: before.era, round: before.round });
  if (before.era === 'canal' && s.era === 'rail') { snaps.canalLast = before; snaps.railStart = structuredClone(s); }
  if (s.outcome) snaps.railLast = before;
  if (s.era === 'rail' && s.round === 4 && s.turn === 0 && !snaps.rail4) snaps.rail4 = structuredClone(s);
  const cur = r.currentSeat(s);
  if (cur === 0 && s.era === 'canal' && s.round === 1 && !snaps.canal1) snaps.canal1 = structuredClone(s);
  if (cur === 0 && s.era === 'rail' && s.round >= 3 && s.round <= 6 && s.actionsLeft === 2) {
    const inds = new Set(Object.values(s.board).flat().filter(Boolean).map((t) => t.industry));
    const sells = r.legalFor(s, 0).filter((h) => h.type === 'sell').length;
    const sc = inds.size + (sells ? 3 : 0) + Object.keys(s.links).length / 4;
    if (!snaps.railTurn || sc > snaps.railTurnScore) { snaps.railTurn = structuredClone(s); snaps.railTurnLog = log.length; snaps.railTurnScore = sc; snaps.railTurnSells = sells; }
  }
  if (s.outcome) snaps.final = structuredClone(s);
  steps++;
}
const vp = s.vp;
console.log('steps', steps, 'vp', vp, 'money', s.money, 'income', s.income.map(r.incomeLevel), 'links', Object.keys(snaps.rail4?.links ?? {}).length);
fs.writeFileSync(out, JSON.stringify({ seed: +seedArg, snaps, log }, null, 0));
