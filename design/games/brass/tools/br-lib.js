// Shared pieces for the Brass artboards: measured geometry (geo.js), the engine-checked mock (work/mock.json, made by
// engine/mock.mjs), language helpers and art tracking. Board positions are 0..1000 units of the night board; on screen
// they become percentages (left = x/10 %, top = y/10 %, translate(-50%,-50%)).
const fs = require('fs');
const path = require('path');
const G = require('./geo');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../work/mock.json'), 'utf8'));

const INDUSTRIES = ['cotton', 'manufacturer', 'pottery', 'coal', 'iron', 'brewery'];
const GOODS = ['cotton', 'manufacturer', 'pottery'];
const IND_FA = { cotton: 'کارخانهٔ پنبه', manufacturer: 'تولیدی', pottery: 'سفال‌گری', coal: 'معدن زغال', iron: 'ذوب‌آهن', brewery: 'آبجوسازی' };
const IND_EN = { cotton: 'Cotton Mill', manufacturer: 'Manufacturer', pottery: 'Pottery', coal: 'Coal Mine', iron: 'Iron Works', brewery: 'Brewery' };
const IND_ART = { cotton: 'art-cotton-mill', manufacturer: 'art-manufactured-goods', pottery: 'art-pottery', coal: 'art-coal-mine', iron: 'art-iron-works', brewery: 'art-brewery' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// seat order of the code (0..3) -> piece colour of the publisher set (user choice 2026-10-29)
const COLORS = ['red', 'yellow', 'purple', 'grey'];
const SEATS = [
  { fa: 'مینا', en: 'Mina', ini: ['م', 'M'], league: ['gold', 'طلا', 'Gold'] },
  { fa: 'نیلوفر', en: 'Niloufar', ini: ['ن', 'N'], league: ['diamond', 'الماس', 'Diamond'] },
  { fa: 'آرش', en: 'Arash', ini: ['آ', 'A'], league: ['silver', 'نقره', 'Silver'] },
  { fa: 'سارا', en: 'Sara', ini: ['س', 'S'], league: ['platinum', 'پلاتین', 'Platinum'] }
];
const LOC = Object.fromEntries(M.locations.map((l) => [l.id, l]));
const LINK = Object.fromEntries(M.links.map((l) => [l.id, l]));
const nodes = (id) => [LINK[id].a, LINK[id].b, ...(LINK[id].also || [])];
const tileDef = (ind, lvl) => M.tiles.find((t) => t.industry === ind && t.level === lvl);
const incomeLevel = (space) => (space <= 10 ? space - 10 : space <= 30 ? Math.ceil((space - 10) / 2) : space <= 60 ? 10 + Math.ceil((space - 30) / 3) : Math.min(30, 20 + Math.ceil((space - 60) / 4)));
const buyPrice = (kind, cubes) => (cubes > 0 ? M.market[kind].prices[M.market[kind].prices.length - cubes] : M.market[kind].empty);
const pct = (v) => +(v / 10).toFixed(3) + '%';
const at = (x, y) => `left:${pct(x)};top:${pct(y)}`;

// ---------- language ----------
function L(lang) {
  const fa = lang === 'fa';
  const t = (a, b) => (fa ? a : b);
  const d = (v) => (fa ? String(v).replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[c]).replace(/-/g, '−') : String(v).replace(/-/g, '−'));
  const sd = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d(Math.abs(v)); // signed
  const gbp = (v) => `<span class="br-gbp">${v < 0 ? '−' : ''}£${d(Math.abs(v))}</span>`;
  const loc = (id) => (fa ? LOC[id].nameFa : LOC[id].nameEn);
  const town = (id) => (LOC[id].kind === 'farm' ? t('آبجوسازی روستایی', 'Farm brewery') : loc(id));
  const ind = (x) => (fa ? IND_FA[x] : IND_EN[x]);
  const name = (k) => (fa ? SEATS[k].fa : SEATS[k].en);
  const link = (id) => nodes(id).map(town).join(' ↔ ');
  const card = (id) => {
    if (id === 900) return t('شهر آزاد', 'Wild location');
    if (id === 901) return t('صنعت آزاد', 'Wild industry');
    const c = M.cards[id];
    return c.kind === 'location' ? loc(c.loc) : c.industries.map(ind).join(' / ');
  };
  return { fa, t, d, sd, gbp, loc, town, ind, name, link, card, dir: fa ? 'rtl' : 'ltr', lang };
}

// ---------- art ----------
const A = '../assets/games/brass/';
const used = new Set();
const IMG = (name, attrs = '') => { used.add(name); return `<img src="${A}${name}.webp" ${attrs}>`; };
// industry cards have several printed variants (same rules): the variant is chosen by copy index, art only
const VARIANTS = { 'cotton-manufacturer': [1, 2, 3], coal: [1, 2], iron: [1, 2], brewery: [1, 2, 3], pottery: [0] };
const cardArt = (id) => {
  if (id === 900) return 'card-wild-location';
  if (id === 901) return 'card-wild-industry';
  const c = M.cards[id];
  if (c.kind === 'location') return 'card-' + c.loc;
  const k = c.industries.join('-');
  const same = M.cards.filter((x) => x.kind === 'industry' && x.industries.join('-') === k).map((x) => x.id);
  const v = VARIANTS[k][same.indexOf(id) % VARIANTS[k].length];
  return v ? `card-${k}-${v}` : `card-${k}`;
};
const tileArt = (ind, lvl, seat, side = 'front') => `tile-${ind}-${lvl}-${COLORS[seat]}-${side}`;

const sv = (p) => `<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICONS = {
  check: sv('<path d="M20 6 9 17l-5-5" />'),
  undo: sv('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />'),
  x: sv('<path d="M18 6 6 18" /> <path d="m6 6 12 12" />'),
  plus: sv('<path d="M5 12h14" /> <path d="M12 5v14" />'),
  minus: sv('<path d="M5 12h14" />'),
  fit: sv('<path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" />'),
  back: sv('<path d="M5 12h14" /> <path d="m12 5 7 7-7 7" />'),
  book: sv('<path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />'),
  chat: sv('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />'),
  leave: sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /> <polyline points="16 17 21 12 16 7" /> <line x1="21" x2="9" y1="12" y2="12" />'),
  more: sv('<circle cx="12" cy="12" r="1" /> <circle cx="12" cy="5" r="1" /> <circle cx="12" cy="19" r="1" />'),
  gear: sv('<circle cx="12" cy="12" r="3" /> <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />'),
  menu: sv('<path d="M4 6h16" /> <path d="M4 12h16" /> <path d="M4 18h16" />'),
  map: sv('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /> <path d="M15 5.764v15" /> <path d="M9 3.236v15" />'),
  cards: sv('<rect x="3" y="5" width="12" height="16" rx="2" /> <path d="M9 3h10a2 2 0 0 1 2 2v12" />'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <path d="M16 3.13a4 4 0 0 1 0 7.75" />'),
  factory: sv('<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /> <path d="M17 18h1" /> <path d="M12 18h1" /> <path d="M7 18h1" />'),
  list: sv('<path d="M3 12h.01" /> <path d="M3 18h.01" /> <path d="M3 6h.01" /> <path d="M8 12h13" /> <path d="M8 18h13" /> <path d="M8 6h13" />')
};

module.exports = { G, M, INDUSTRIES, GOODS, IND_FA, IND_EN, IND_ART, ROMAN, COLORS, SEATS, LOC, LINK, nodes, tileDef, incomeLevel, buyPrice, pct, at, L, A, used, IMG, cardArt, tileArt, ICONS };
