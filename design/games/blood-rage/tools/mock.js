// The mock table every artboard draws: 4 players, Age 2, Action phase, Mina (seat 0, Raven) to act. Written in the
// exact state shape of ENGINE.md §2 so the dev team can use it as a fixture; check() enforces the rulebook limits
// (villages, horns, rage, monsters, card ages) so the mock cannot show an illegal table. node mock.js
const fs = require('fs');
const path = require('path');
const W = path.join(__dirname, '..', 'work');
const C = JSON.parse(fs.readFileSync(path.join(W, 'content.json'), 'utf8'));
const CARD = Object.fromEntries(C.cards.map((c) => [c.num, c]));
const PROV = C.provinces;
const slotsOf = (p) => PROV[p].villages;

// ---- seats: clockwise; BGA clan ids (1 wolf, 2 serpent, 3 raven, 4 bear, 5 ram)
const clans = [3, 1, 4, 2];
const S = {
  v: 1, players: 4, clans, age: 2, phase: 'action', first: 1, turn: 0,
  ragnarok: [4, 2, 8], // Age 1 Muspelheim (done), Age 2 Elvagar (doom now), Age 3 Gimle
  destroyed: [6, 4], // Utgard at setup (4 players: 1 province), Muspelheim in Ragnarök of Age 1
  pillage: { 0: { reward: 'yggdrasil', pillaged: false }, 1: { reward: 'axe', pillaged: false }, 2: { reward: 'rage', pillaged: false }, 3: { reward: 'glory', pillaged: false }, 4: { reward: 'rage', pillaged: false }, 5: { reward: 'horn', pillaged: false }, 6: { reward: 'axe', pillaged: false }, 7: { reward: 'rage', pillaged: false }, 8: { reward: 'horn', pillaged: true, by: 1 } },
  stats: [{ rage: 1, axe: 0, horn: 1 }, { rage: 0, axe: 2, horn: 1 }, { rage: 2, axe: 0, horn: 0 }, { rage: 1, axe: 1, horn: 2 }],
  rage: [4, 2, 5, 0],
  glory: [21, 27, 14, 19],
  upgrades: [
    { leader: null, warrior: 23, ship: 58, monster: [26, null], clan: [33, null, null] },
    { leader: 25, warrior: null, ship: null, monster: [28, null], clan: [30, 64, null] },
    { leader: null, warrior: 57, ship: null, monster: [27, null], clan: [31, null, null] },
    { leader: null, warrior: null, ship: 24, monster: [60, null], clan: [34, null, null] }
  ],
  hands: [[44, 39, 63, 61, 13], [42, 45, 49], [36, 37, 65, 47, 3], [38, 52, 11, 67]],
  quests: [[48], [51, 56], [], [53]],
  passed: [false, false, false, false],
  figures: [],
  battle: null, pending: null,
  discardPublic: [10, 12, 40], // battle cards a winner discarded this game (face up, BGA «discard» button)
  log: [],
  outcome: null
};
// ---- figures: every figure of every clan; where = reserve | village:<slot> | yggdrasil | fjord:<id> | valhalla | box
let id = 0;
const fig = (seat, kind, where, monster = null) => S.figures.push({ id: `f${id++}`, seat, kind, monster, where });
const place = {
  0: { leader: ['yggdrasil'], warrior: [`village:${slotsOf(3)[0]}`, `village:${slotsOf(3)[1]}`, 'valhalla'], ship: ['fjord:0'], monster: { 26: 'reserve' } },
  1: { leader: [`village:${slotsOf(8)[0]}`], warrior: [`village:${slotsOf(8)[1]}`, `village:${slotsOf(1)[0]}`, 'yggdrasil', 'valhalla'], ship: ['fjord:3'], monster: { 28: 'reserve' } },
  2: { leader: ['yggdrasil'], warrior: [`village:${slotsOf(3)[2]}`, `village:${slotsOf(2)[0]}`], ship: ['reserve'], monster: { 27: `village:${slotsOf(3)[3]}` } },
  3: { leader: [`village:${slotsOf(7)[0]}`], warrior: [`village:${slotsOf(5)[0]}`, `village:${slotsOf(5)[1]}`, `village:${slotsOf(7)[1]}`], ship: ['fjord:1'], monster: { 60: `village:${slotsOf(2)[1]}` } }
};
for (let seat = 0; seat < 4; seat++) {
  const p = place[seat];
  fig(seat, 'leader', p.leader[0]);
  for (let w = 0; w < 8; w++) fig(seat, 'warrior', p.warrior[w] || 'reserve');
  fig(seat, 'ship', p.ship[0]);
  for (const [m, where] of Object.entries(p.monster)) fig(seat, 'monster', where, Number(m));
}
S.log = [
  { seat: 1, type: 'pillage', province: 8, textFa: 'نیلوفر گیمله را بی‌نبرد غارت کرد: شاخ ۴ → ۵', textEn: 'Niloufar pillaged Gimle unopposed: Horns 4 → 5' },
  { seat: 2, type: 'invade', province: 2, textFa: 'آرش با جنگجو به الواگار یورش برد (۲ خشم)', textEn: 'Arash invaded Elvagar with a warrior (2 rage)' },
  { seat: 3, type: 'upgrade', card: 60, textFa: 'سارا والکیری را ارتقا داد و با آن به الواگار یورش برد', textEn: 'Sara upgraded Valkyrie and invaded Elvagar with it' },
  { seat: 0, type: 'upgrade', card: 58, textFa: 'مینا اژدهاهای آتش را روی کشتی گذاشت (۲ خشم)', textEn: 'Mina put Fire Dragons on her ship (2 rage)' },
  { seat: 1, type: 'quest', textFa: 'نیلوفر به یک مأموریت متعهد شد', textEn: 'Niloufar committed to a quest' },
  { seat: 2, type: 'march', from: 0, to: 3, textFa: 'آرش از ایگدراسیل به آنگربودا لشکر کشید (۱ خشم)', textEn: 'Arash marched from Yggdrasil to Angerboda (1 rage)' },
  { seat: 3, type: 'invade', province: 7, textFa: 'سارا با جنگجو به آندلانگ یورش برد؛ خشمش تمام شد', textEn: 'Sara invaded Andlang with a warrior; she is out of rage' }
];

// ---- derived values (ENGINE.md §3 helpers, kept tiny here)
const statVal = (seat, k) => C.statTracks[k][S.stats[seat][k]];
const onBoard = (seat) => S.figures.filter((f) => f.seat === seat && /^(village|yggdrasil|fjord)/.test(f.where)).length;
function check() {
  const err = (m) => { throw new Error('mock: ' + m); };
  const used = new Map();
  for (const f of S.figures) {
    if (f.where.startsWith('village:')) {
      const slot = Number(f.where.split(':')[1]);
      if (used.has(slot)) err('two figures in village ' + slot);
      used.set(slot, f);
      const prov = C.slots[slot].province;
      if (S.destroyed.includes(prov)) err('figure in destroyed province ' + prov);
      if (f.kind === 'ship') err('ship in a village');
    }
    if (f.where.startsWith('fjord:') && f.kind !== 'ship' && !(f.kind === 'monster' && f.monster === 28)) err('non-ship in fjord');
  }
  for (let s = 0; s < S.players; s++) {
    if (onBoard(s) > statVal(s, 'horn')) err(`seat ${s} has ${onBoard(s)} figures on board, horns ${statVal(s, 'horn')}`);
    if (S.rage[s] > statVal(s, 'rage')) err(`seat ${s} rage above stat`);
    for (const n of [...S.hands[s], ...S.quests[s]]) if (CARD[n].age > S.age) err('card from a later age ' + n);
    for (const n of S.quests[s]) if (CARD[n].type !== 'quest') err('non-quest committed ' + n);
    const u = S.upgrades[s];
    for (const [slot, n] of [['leader', u.leader], ['warrior', u.warrior], ['ship', u.ship], ...u.monster.map((n) => ['monster', n]), ...u.clan.map((n) => ['clan', n])]) if (n && CARD[n].type !== slot) err(`card ${n} in ${slot} slot`);
    const mons = S.figures.filter((f) => f.seat === s && f.kind === 'monster');
    if (mons.length > 2) err('more than 2 monsters');
    for (const m of mons) if (!u.monster.includes(m.monster)) err('monster figure without its card');
  }
  const all = [...S.hands.flat(), ...S.quests.flat(), ...S.upgrades.flatMap((u) => [u.leader, u.warrior, u.ship, ...u.monster, ...u.clan]).filter(Boolean), ...S.discardPublic];
  if (new Set(all).size !== all.length) err('a card is in two places');
  for (const n of all) if (CARD[n].minPlayers > S.players) err('card ' + n + ' is not in a 4-player deck');
}
check();
fs.writeFileSync(path.join(W, 'mock.json'), JSON.stringify(S, null, 1));
console.log('mock ok: figures', S.figures.length, 'on board', [0, 1, 2, 3].map(onBoard).join('/'), 'horns', [0, 1, 2, 3].map((s) => statVal(s, 'horn')).join('/'));
