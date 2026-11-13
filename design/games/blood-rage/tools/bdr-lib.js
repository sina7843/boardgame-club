// Shared pieces for the Blood Rage artboards: content (work/content.json from gen-data.js), the checked mock
// (work/mock.json from mock.js), language helpers and art tracking. Map positions are 0..1600 units of the BGA board;
// on screen they become percentages (left = x/16 %, top = y/16 %, translate(-50%,-50%)).
const fs = require('fs');
const path = require('path');
const FA = require('./bdr-fa');
const W = path.join(__dirname, '..', 'work');
const C = JSON.parse(fs.readFileSync(path.join(W, 'content.json'), 'utf8'));
const M = JSON.parse(fs.readFileSync(path.join(W, 'mock.json'), 'utf8'));
const CARD = Object.fromEntries(C.cards.map((c) => [c.num, c]));
const CLAN = Object.fromEntries(C.clans.map((c) => [c.id, c]));
const ME = 0;
const SEATS = [
  { fa: 'مینا', en: 'Mina', league: ['gold', 'طلا', 'Gold'] },
  { fa: 'نیلوفر', en: 'Niloufar', league: ['diamond', 'الماس', 'Diamond'] },
  { fa: 'آرش', en: 'Arash', league: ['silver', 'نقره', 'Silver'] },
  { fa: 'سارا', en: 'Sara', league: ['platinum', 'پلاتین', 'Platinum'] },
  { fa: 'کیان', en: 'Kian', league: ['bronze', 'برنز', 'Bronze'] }
];
const pct = (v) => +(v / 16).toFixed(3) + '%';
const at = (x, y) => `left:${pct(x)};top:${pct(y)}`;
const slug = (seat, s = M) => CLAN[s.clans[seat]].slug;
const statVal = (s, seat, k) => C.statTracks[k][s.stats[seat][k]];
const STAT_MAX = { rage: 12, axe: 8, horn: 10 };
const isBoard = (w) => /^(village|yggdrasil|fjord)/.test(w);
const onBoard = (s, seat) => s.figures.filter((f) => f.seat === seat && isBoard(f.where)).length;
const inZone = (s, seat, zone) => s.figures.filter((f) => f.seat === seat && f.where === zone);

// figure strength with the upgrades of the mock (ENGINE.md §4 has the full rule list)
function figStr(s, f) {
  const u = s.upgrades[f.seat];
  if (f.kind === 'monster') return CARD[f.monster].value;
  if (f.kind === 'leader') return u.leader ? CARD[u.leader].value : 3;
  if (f.kind === 'ship') return u.ship ? CARD[u.ship].value : 2;
  return u.warrior ? CARD[u.warrior].value : 1;
}
// token art of a figure: the upgraded token when its slot holds a card (BGA shows the upgraded portrait)
function figArt(s, f) {
  const cl = slug(f.seat, s);
  const u = s.upgrades[f.seat];
  const card = f.kind === 'monster' ? f.monster : u[f.kind];
  if (!card) return `${cl}-${f.kind}-token`;
  return `${cl}-${CARD[BASE_OF[card] || card].art}-token`;
}
// 5th-player copies of troop upgrades use the base copy's token art
const BASE_OF = { 108: 23, 109: 24, 110: 25, 116: 57, 117: 58, 118: 59, 124: 91, 125: 92, 126: 93 };

// ---------- language ----------
function L(lang) {
  const fa = lang === 'fa';
  const t = (a, b) => (fa ? a : b);
  const d = (v) => (fa ? String(v).replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[c]).replace(/-/g, '−') : String(v).replace(/-/g, '−'));
  const sd = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d(Math.abs(v));
  const prov = (p) => (fa ? FA.PROVINCE[p] : FA.PROVINCE_EN[p]);
  const region = (r) => (fa ? FA.REGION[r] : FA.REGION_EN[r]);
  const clan = (id) => (fa ? FA.CLAN[id] : FA.CLAN_EN[id]);
  const name = (k) => (fa ? SEATS[k].fa : SEATS[k].en);
  const fig = (k) => (fa ? FA.FIGURE[k] : FA.FIGURE_EN[k]);
  const stat = (k) => (fa ? FA.STAT[k] : FA.STAT_EN[k]);
  const act = (k) => (fa ? FA.ACTION[k] : FA.ACTION_EN[k]);
  const phase = (k) => (fa ? FA.PHASE[k] : FA.PHASE_EN[k]);
  const type = (k) => (fa ? FA.TYPE[k] : FA.TYPE_EN[k]);
  const card = (n) => (fa ? CARD[n].titleFa : CARD[n].titleEn);
  const reward = (k) => (fa ? FA.PILLAGE[k] : FA.PILLAGE_EN[k]);
  const figName = (s, f) => (f.kind === 'monster' ? card(f.monster) : fig(f.kind));
  return { fa, t, d, sd, prov, region, clan, name, fig, stat, act, phase, type, card, reward, figName, dir: fa ? 'rtl' : 'ltr', lang };
}

// ---------- art ----------
const A = '../assets/games/blood-rage/';
const used = new Set();
const IMG = (name, attrs = '') => { used.add(name); return `<img src="${A}${name}.webp" ${attrs}>`; };
const URL = (name) => { used.add(name); return `${A}${name}.webp`; };

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
  history: sv('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />'),
  cards: sv('<rect x="3" y="5" width="12" height="16" rx="2" /> <path d="M9 3h10a2 2 0 0 1 2 2v12" />'),
  eye: sv('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /> <circle cx="12" cy="12" r="3" />'),
  chevD: sv('<path d="m6 9 6 6 6-6" />'),
  chevU: sv('<path d="m18 15-6-6-6 6" />'),
  list: sv('<path d="M3 12h.01" /> <path d="M3 18h.01" /> <path d="M3 6h.01" /> <path d="M8 12h13" /> <path d="M8 18h13" /> <path d="M8 6h13" />'),
  map: sv('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /> <path d="M15 5.764v15" /> <path d="M9 3.236v15" />'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <path d="M16 3.13a4 4 0 0 1 0 7.75" />')
};

module.exports = { FA, C, M, CARD, CLAN, ME, SEATS, pct, at, slug, statVal, STAT_MAX, isBoard, onBoard, inZone, figStr, figArt, L, A, used, IMG, URL, ICONS };
