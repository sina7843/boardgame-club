// Builds work/content.json: the game data the artboards, the mock and the handoff use. Sources: BGA materials
// (work/geo.json, work/cards.json, copied from `ready to use/data`), the CMON rulebook (adjacency ring, setup numbers)
// and bdr-fa.js (Persian). node gen-data.js
const fs = require('fs');
const path = require('path');
const FA = require('./bdr-fa');
const W = path.join(__dirname, '..', 'work');
const geo = JSON.parse(fs.readFileSync(path.join(W, 'geo.json'), 'utf8'));
const cards = JSON.parse(fs.readFileSync(path.join(W, 'cards.json'), 'utf8'));

const norm = (s) => s.replace(/’/g, "'").replace(/\s+/g, ' ').trim();
const keyOf = (c) => [norm(c.title), c.type, c.type === 'quest' ? '' : c.value].join('|');
// first card carrying each text
const first = {};
for (const c of cards) if (FA.CARD[c.num] !== undefined) first[keyOf(c)] = first[keyOf(c)] ?? c.num;
const faFor = (c) => {
  if (FA.CARD[c.num]) return FA.CARD[c.num];
  if (c.type === 'quest') { // quests share the text of the age-1 quest with the same title
    const base = cards.find((x) => x.type === 'quest' && norm(x.title) === norm(c.title) && FA.CARD[x.num]);
    return base && FA.CARD[base.num];
  }
  const n = first[keyOf(c)];
  return n && FA.CARD[n];
};
const out = [];
for (const c of cards) {
  const fa = faFor(c);
  if (!fa) throw new Error('no Persian text for card ' + c.num + ' ' + c.title);
  out.push({
    num: c.num, age: c.age, minPlayers: c.players === 1 ? 2 : c.players, type: c.type, ruleId: c.rule_id || null,
    value: Number(c.value), afterReveal: c.rule_id === 'after_battle', variable: c.rule_id === 'highest_enemy' || Number(c.value) < 0,
    titleEn: norm(c.title), rulesEn: norm(c.rules), extraEn: norm(c.extra), titleFa: fa[0], rulesFa: fa[1],
    art: c.assetId, back: c.backId, set: c.set
  });
}
// same English rules for every copy that shares a Persian text
const byTitle = {};
for (const c of out) {
  const k = c.titleFa + '|' + c.type + '|' + (c.type === 'quest' ? '' : c.value);
  if (byTitle[k] && byTitle[k] !== c.rulesEn) throw new Error('rules differ for ' + k);
  byTitle[k] = c.rulesEn;
}

// map: 0 = Yggdrasil (adjacent to all), outer ring 1..8 in clockwise order; each outer province borders its two ring
// neighbours (checked on the board art: work/geo-check.jpg; rulebook p.19 confirms Horgr-Andlang are NOT adjacent)
const ring = [1, 2, 3, 4, 5, 6, 7, 8];
const adj = (p) => (p === 0 ? ring : [0, ring[(p + 6) % 8], ring[p % 8]]);
const provinces = geo.provinces.map((p) => ({
  id: p.province, region: p.region, nameEn: FA.PROVINCE_EN[p.province], nameFa: FA.PROVINCE[p.province],
  x: p.x, y: p.y, doomX: p.doom_x, doomY: p.doom_y,
  villages: p.province === 0 ? null : geo.slots.filter((s) => s.province === p.province).map((s) => s.slot),
  adjacent: adj(p.province).sort((a, b) => a - b),
  fjords: geo.fjords.filter((f) => f.province1 === p.province || f.province2 === p.province).map((f) => f.fjord)
}));
const content = {
  source: 'BGA Blood Rage 231218-1618 materials + CMON rulebook BLR001 (2015)',
  mapSize: 1600,
  regions: geo.regions.map((r) => ({ id: r.region, nameEn: FA.REGION_EN[r.region], nameFa: FA.REGION[r.region] })),
  provinces,
  fjords: geo.fjords.map((f) => ({ id: f.fjord, supports: [f.province1, f.province2], x: f.x, y: f.y })),
  slots: geo.slots.map((s) => ({ id: s.slot, province: s.province, x: s.x, y: s.y })),
  clans: Object.values(geo.clans).map((c) => ({ id: c.clan, slug: FA.CLAN_SLUG[c.clan], nameEn: c.title, nameFa: FA.CLAN[c.clan], color: '#' + c.color, color2: '#' + c.color2 })),
  pillageTokens: geo.pillages.map((p) => ({ type: p.type, count: p.nb, rewardFa: FA.PILLAGE[p.type], rewardEn: FA.PILLAGE_EN[p.type] })),
  statTracks: geo.stat, // value per step 0..5; steps 3-4 = +10 glory at game end, step 5 = +20
  legendary: { 3: 10, 4: 10, 5: 20 },
  ragnarokGlory: { 1: 2, 2: 3, 3: 4 },
  destroyedAtStart: { 2: 3, 3: 2, 4: 1, 5: 0 },
  figures: { warriors: 8, leader: 1, ship: 1, maxMonsters: 2, baseStr: { leader: 3, warrior: 1, ship: 2 } },
  cards: out
};
fs.writeFileSync(path.join(W, 'content.json'), JSON.stringify(content, null, 1));
console.log('cards', out.length, 'provinces', provinces.length, 'slots', content.slots.length);
