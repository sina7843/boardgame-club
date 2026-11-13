// Builds work/mock.json (every number on the artboards) from one seeded engine game:
// node --experimental-strip-types --no-warnings mock.mjs <seed>
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const r = await import(pathToFileURL('E:/AI/Claude/bgv-brass/engine/src/rules.ts'));
const seed = process.argv[2];
execFileSync('node', ['--experimental-strip-types', '--no-warnings', 'sim.mjs', seed, '../work/sim-pick.json']);
const { snaps, log } = JSON.parse(fs.readFileSync('../work/sim-pick.json'));
const ZERO = { nextInt: () => 0 };
const view = (s, seat) => r.brassModule.project(structuredClone(s), { kind: 'player', seat });

// what one action consumes and gives (dry run on a copy)
function preview(s, seat, a) {
  const b = structuredClone(s), c = structuredClone(s);
  r.brassModule.apply(c, { kind: 'player', seat }, a, { rng: ZERO });
  const d = { money: c.money[seat] - b.money[seat], spent: c.spent[seat] - b.spent[seat], coalMarket: c.coal - b.coal, ironMarket: c.iron - b.iron,
    income: c.income[seat] - b.income[seat], incomeLevel: r.incomeLevel(c.income[seat]) - r.incomeLevel(b.income[seat]), vp: c.vp[seat] - b.vp[seat], from: [], flipped: [], beerMerchant: [] };
  for (const [loc, row] of Object.entries(b.board)) row.forEach((t, i) => {
    const u = c.board[loc][i];
    if (t && u && u.cubes < t.cubes) d.from.push({ loc, slot: i, owner: t.owner, industry: t.industry, n: t.cubes - u.cubes });
    if (t && u && !t.flipped && u.flipped) d.flipped.push({ loc, slot: i, owner: t.owner, industry: t.industry, level: t.level });
    if (!t && u) d.built = { loc, slot: i, ...u };
  });
  for (const [m, st] of Object.entries(b.merchants)) st.beer.forEach((x, i) => { if (x && !c.merchants[m].beer[i]) d.beerMerchant.push({ merchant: m, space: i }); });
  // market sale on build (coal mine linked to a merchant, iron works)
  if (d.coalMarket > 0 || d.ironMarket > 0) d.soldToMarket = { coal: Math.max(0, d.coalMarket), iron: Math.max(0, d.ironMarket) };
  return d;
}
function hintsWithCost(s, seat) {
  const hand = s.hands[seat];
  return r.legalFor(s, seat).filter((h) => h.type !== 'resign').map((h) => {
    const card = h.type === 'build' ? h.cards[0] : hand[0];
    let a = null;
    if (h.type === 'build') a = { type: 'build', card, industry: h.industry, loc: h.loc, slot: h.slot };
    else if (h.type === 'network') a = { type: 'network', card, links: h.links };
    else if (h.type === 'develop') a = { type: 'develop', card, industries: h.industries };
    else if (h.type === 'sell') a = { type: 'sell', card, sales: [{ loc: h.loc, slot: h.slot, merchant: h.merchant }] };
    else if (h.type === 'scout') a = { type: 'scout', cards: hand.slice(0, 3) };
    else a = { type: h.type, card };
    return { ...h, cost: preview(s, seat, a) };
  });
}
// errors of the actions that are not legal (for disabled buttons): try every kind with a plausible target
function blocked(s, seat) {
  const out = {};
  const hand = s.hands[seat];
  const tryA = (k, a) => { const v = r.brassModule.validate(s, { kind: 'player', seat }, a); if (!v.ok) out[k] = v.errorCode; };
  tryA('loan', { type: 'loan', card: hand[0] });
  tryA('scout', { type: 'scout', cards: hand.slice(0, 3) });
  return out;
}
function eraScore(s) {
  const links = Object.entries(s.links).map(([id, owner]) => ({ id, owner, vp: r.linkNodes(r.LINK.get(id)).reduce((n, x) => n + r.locationLinkVp(s, x), 0) }));
  const tiles = [];
  for (const [loc, row] of Object.entries(s.board)) row.forEach((t, i) => { if (t && t.flipped) tiles.push({ loc, slot: i, owner: t.owner, industry: t.industry, level: t.level, vp: r.tileDef(t.industry, t.level).vp }); });
  const per = Array.from({ length: s.players }, (_, p) => ({ links: links.filter((l) => l.owner === p).reduce((n, l) => n + l.vp, 0), tiles: tiles.filter((t) => t.owner === p).reduce((n, t) => n + t.vp, 0) }));
  const removed = [];
  for (const [loc, row] of Object.entries(s.board)) row.forEach((t, i) => { if (t && t.level === 1) removed.push({ loc, slot: i, owner: t.owner, industry: t.industry, flipped: t.flipped }); });
  const income = s.income.map((x) => r.incomeLevel(x));
  return { links, tiles, per, removed, income };
}
const pack = (s, seat = 0) => ({ state: s, view: view(s, seat), hints: r.currentSeat(s) === seat ? hintsWithCost(s, seat) : [], blocked: r.currentSeat(s) === seat ? blocked(s, seat) : {} });
const cardInfo = r.CARDS.map((c) => ({ id: c.id, kind: c.kind, loc: c.loc, industries: c.industries, minPlayers: c.minPlayers }));
const tut = (() => {
  const s = r.brassModule.setup({ playerCount: 2, rng: ZERO, options: { deal: 'tutorial' } });
  const st = r.brassModule.tutorial.steps;
  r.brassModule.apply(s, { kind: 'player', seat: 0 }, st[0].expected, { rng: ZERO });
  return { ...pack(s), step: 2, steps: st.length, instruction: st[1].instructionFa, expected: st[1].expected, intro: r.brassModule.tutorial.introFa };
})();
const mock = {
  seed: +seed,
  main: pack(snaps.railTurn), start: pack(snaps.canal1),
  eraEnd: { before: pack(snaps.canalLast), after: pack(snaps.railStart), score: eraScore(snaps.canalLast) },
  final: { before: pack(snaps.railLast), after: pack(snaps.final), score: eraScore(snaps.railLast) },
  tutorial: tut,
  cards: cardInfo, tiles: r.TILES, stack: r.STACK, market: r.MARKET, merchantTiles: r.MERCHANT_TILES,
  locations: r.LOCATIONS, links: r.LINKS.map((l) => ({ ...l, id: r.linkId(l) }))
};
mock.final.placements = snaps.final.outcome.placements;
mock.main.log = log.slice(Math.max(0, snaps.railTurnLog - 8), snaps.railTurnLog);
fs.writeFileSync('../work/mock.json', JSON.stringify(mock));
const m = mock.main;
const c = {}; for (const h of m.hints) c[h.type] = (c[h.type] || 0) + 1;
console.log('main', m.state.era, m.state.round, 'hints', c, 'blocked', m.blocked, 'size', Math.round(fs.statSync('../work/mock.json').size / 1024), 'KB');
console.log('eraEnd per', JSON.stringify(mock.eraEnd.score.per), 'removed', mock.eraEnd.score.removed.length, 'final', JSON.stringify(mock.final.placements));
console.log('tutorial', tut.state.era, tut.state.round, tut.hints.filter((h) => h.type === 'sell').length);
