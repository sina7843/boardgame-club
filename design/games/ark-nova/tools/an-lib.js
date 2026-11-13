// Shared pieces for the Ark Nova artboards: measured board geometry (tools/gridcrop.py on art/boards/*.webp, checked
// for all 10 maps with tools/check-maps.py), the engine mock (work/mock.json from work/engine/mock2.mjs), language
// helpers and image helpers. Board positions are source-image pixels; on screen they become percentages of the board
// (left = x/W, top = y/H, translate(-50%,-50%)).
const fs = require('fs');
const path = require('path');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../work/mock.json'), 'utf8'));
const CELLS = JSON.parse(fs.readFileSync(path.join(__dirname, '../work/building-cells.json'), 'utf8'));
const V = M.view;

// ---------- zoo map (every map is 2000 x 1041, same hex grid) ----------
const MAP_W = 2000, MAP_H = 1041;
const HEX = { x0: 327, dx: 100.6, y0: 132.3, dy: 57.75, r: 66.9 };
const hexXY = (cell) => { const [x, y] = cell.split('_').map(Number); return [HEX.x0 + HEX.dx * x, HEX.y0 + HEX.dy * y]; };
const LEFT_XY = [383, 457, 530, 605, 707, 780, 855].map((y) => [133, y]); // 7 left-edge bonus spaces (player cubes)
const WORKER_XY = [[70, 290], [128, 290], [187, 290]]; // unhired association workers (hired left to right)
const PARTNER_XY = [[1335, 440], [1335, 345], [1335, 215], [1335, 115]]; // partner zoo slots 1..4
const UNI_XY = [[1335, 815], [1335, 710], [1335, 600]]; // university slots 1..3
const CLIP_X = [227, 617, 1000, 1390, 1780]; // action card slots 1..5 (clips on the bottom strip)
const ACT = { w: 330, top: 985 }; // action card width and top edge in map units (cards hang below the map)

// ---------- main board 3000 x 814 ----------
const MB_W = 3000, MB_H = 814;
const appealXY = (v) => (v <= 51 ? [180 + 53 * v, 735] : v <= 60 ? [2915, 610 - 52.5 * (v - 52)] : [2883 - 53 * (v - 61), 75]);
const cpTarget = (c) => (c <= 10 ? 114 - 2 * c : 94 - 3 * (c - 10));
// conservation counters sit on the green tab under/over the appeal boxes that their target number covers
const cpXY = (c) => {
  if (c <= 0) return [55, 100];
  const T = cpTarget(c), vals = c <= 10 ? [T, T + 1] : [T, T + 1, T + 2];
  const ps = vals.map(appealXY);
  const x = ps.reduce((a, p) => a + p[0], 0) / ps.length, y = ps.reduce((a, p) => a + p[1], 0) / ps.length;
  if (T >= 61) return [x, 118];
  if (T >= 52) return [2858, y];
  return [x, 672];
};
const REP_X = [430, 610, 845, 985, 1180, 1270, 1365, 1555, 1650, 1740, 1950, 2040, 2128, 2312, 2400, 2490];
const repXY = (r) => [REP_X[Math.max(0, Math.min(15, r))] - (r > 0 ? 42 : 0), 300];
const breakXY = (brk, max) => [1760 + (max - brk) * 58.7, 200];
const FOLDER_X = [528, 903, 1278, 1654, 2034, 2415];
const FOLDER = { y: 487, w: 178 };
const DECK_XY = [172, 485], DISCARD_XY = [2665, 485];
const BONUS_XY = { 5: [[515, 192], [640, 192]], 8: [[840, 192], [960, 192]] };

// ---------- association board 3000 x 1346 ----------
const AB_W = 3000, AB_H = 1346;
const TASK_XY = { rep: [680, 970], zoo: [1360, 1030], uni: [2275, 1030], project: [2815, 1030] };
const ZOO_XY = { europe: [1338, 475], asia: [1700, 475], americas: [1025, 625], africa: [1350, 750], australia: [1675, 750] };
const UNI_AB = { hand: [2325, 500], science: [2088, 800], rep: [2463, 800] };
const DONATE_XY = [[338, 518], [112, 670], [338, 670], [112, 805], [338, 805], [112, 945], [338, 945], [275, 1080]];
// project card: the 3 support levels sit on the shields along the bottom edge
const LEVEL_XY = [[0.24, 0.86], [0.5, 0.86], [0.76, 0.86]];

// ---------- BGA layout pieces (measured from the live BGA DOM, 2026-10-30; art: flat-rebuild-work/boards/sources) ----------
// Zoo map shown like BGA: notebook + bonus column | hexes | partner/university column (the printed rules text and the
// building legend are cropped away); the bottom paper strip with the 5 clips becomes the action-card band.
const MAPC = { w: 1405, h: 905 };
const STRIP = { y: 905, h: 136 };
// reputation-track.webp 2752x95: slot centres as a fraction of the width (rep 0-1 share the first, wide slot)
const repX = (r) => (r <= 1 ? 0.081 : r === 2 ? 0.2025 : r === 3 ? 0.2835 : 0.351 + 0.054 * (Math.min(15, r) - 4));
const REP_BONUS = { 5: 'upgrade-card', 8: 'add-worker', 10: 'upgrade-card', 11: 'conservation', 12: 'xtoken', 13: 'take-in-range', 14: 'conservation', 15: 'xtoken' };
// conservation-track.webp 3188x330: 11 slots (0..10 CP), counters on the top of the slot
const cpX = (c) => 0.0461 + 0.09077 * Math.min(10, Math.max(0, c));
const CP_TILE = { 5: [[0.446, 0.6933], [0.5553, 0.6933]], 8: [[0.718, 0.6933], [0.8273, 0.6933]] };
// BGA association board (base game) association-board.webp 3335x986
const BAB_W = 3335, BAB_H = 986;
const BAB_ZOO = { americas: [1083, 361], europe: [1444, 181], asia: [1847, 181], africa: [1444, 556], australia: [1847, 556] };
const BAB_UNI = { hand: [2639, 208], science: [2319, 569], rep: [2750, 569] };
const BAB_TASK = { rep: [714, 764], zoo: [1486, 866], uni: [2533, 866], project: [3158, 764] };
const BAB_HOT = { rep: [714, 490, 290, 880], zoo: [1486, 470, 1140, 900], uni: [2533, 470, 820, 900], project: [3158, 490, 290, 880] };
const BAB_DONATE = [[375, 222], [125, 361], [375, 361], [125, 542], [375, 542], [125, 694], [375, 694], [300, 895]];
const FOLDER_CITY = ['San Diego, USA', 'Frankfurt, GER', 'Johannesburg, SA', 'Sao Paulo, BR', 'Okinawa, JP', 'Sydney, AUS'];

// ---------- art names ----------
const BONUS_FILE = { rep2: 'bonus-two-reputation', money10: 'bonus-ten-money', enc3: 'bonus-enclosure-three', mult: 'bonus-multiplier', x3: 'bonus-three-x', card3: 'bonus-snap-three-cards', uni: 'bonus-university', partner: 'bonus-partner-zoo', sponsor: 'bonus-sponsor' };
const UNI_FILE = { science: 'university-research', rep: 'university-reputation', hand: 'university-hand-size' };
const KIND_FILE = { kiosk: 'special-buildings/kiosk', pavilion: 'special-buildings/pavilion', pz: 'special-buildings/petting-zoo', rh: 'special-buildings/reptile-house', ba: 'special-buildings/large-bird-aviary' };
const cardFile = (id) => (id >= 401 ? 'cards-animal' : id >= 201 ? 'cards-sponsor' : id >= 113 ? 'cards-conservation' : id >= 101 ? 'cards-base-project' : 'cards-final-scoring') + '/card-' + String(id).padStart(3, '0');
const UNIQUE_FILE = { 243: 'meerkat-den', 244: 'penguin-pool', 245: 'aquarium', 246: 'cable-car', 247: 'baboon-rock', 248: 'rhesus-monkey-park', 249: 'barred-owl-hut', 250: 'sea-turtle-tank', 251: 'polar-bear-exhibit', 252: 'spotted-hyena-compound', 253: 'okapi-stable', 254: 'zoo-school', 255: 'adventure-playground', 256: 'water-playground', 257: 'side-entrance' };
const bldFile = (b) => (/^e\d$/.test(b.kind) ? `enclosures/enclosure-${b.kind[1]}-${b.full ? 'occupied' : 'empty'}` : b.kind[0] === 'u' ? `unique-buildings/unique-${UNIQUE_FILE[b.kind.slice(1)]}` : KIND_FILE[b.kind]);
const actFile = (k, up) => `cards-action/action-${k}-${up ? 2 : 1}`;

// Fit a building image onto its engine cells: rotation k x 30 deg (+ mirror) of the image's own hex cells.
const SCALE = HEX.r / 135; // map units per image pixel (the art uses R = 135 px)
function fitBuilding(file, cells) {
  const C = CELLS[file];
  const t = cells.map(hexXY);
  const tc = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length];
  for (let deg = 0; deg < 360; deg += 30) for (const mx of [1, -1]) {
    const a = deg * Math.PI / 180;
    const w = C.cells.map(([x, y]) => { x *= mx; return [SCALE * (x * Math.cos(a) - y * Math.sin(a)), SCALE * (x * Math.sin(a) + y * Math.cos(a))]; });
    if (w.length !== t.length) continue;
    const wc = [w.reduce((s, p) => s + p[0], 0) / w.length, w.reduce((s, p) => s + p[1], 0) / w.length];
    const T = [tc[0] - wc[0], tc[1] - wc[1]];
    if (w.every(([x, y]) => t.some(([u, v]) => Math.hypot(x + T[0] - u, y + T[1] - v) < 18))) return { x: T[0], y: T[1], deg, mx, w: C.w * SCALE };
  }
  throw new Error('no fit for ' + file + ' ' + cells.join(','));
}

// ---------- seats ----------
const COLORS = { red: '#D7261E', blue: '#1F6FC0', yellow: '#F2C200', black: '#2A2A2A' };
const SEATS = [
  { fa: 'مینا', en: 'Mina', ini: ['م', 'M'], color: 'red', league: ['gold', 'طلا', 'Gold'] },
  { fa: 'نیلوفر', en: 'Niloufar', ini: ['ن', 'N'], color: 'blue', league: ['diamond', 'الماس', 'Diamond'] },
  { fa: 'آرش', en: 'Arash', ini: ['آ', 'A'], color: 'yellow', league: ['silver', 'نقره', 'Silver'] },
  { fa: 'سارا', en: 'Sara', ini: ['س', 'S'], color: 'black', league: ['platinum', 'پلاتین', 'Platinum'] }
];
const pct = (v, total) => +(v / total * 100).toFixed(3) + '%';
const at = (x, y, W, H) => `left:${pct(x, W)};top:${pct(y, H)}`;

// ---------- language ----------
const ICON_ORDER = ['bird', 'predator', 'herbivore', 'primate', 'reptile', 'bear', 'pet', 'africa', 'americas', 'asia', 'australia', 'europe', 'science', 'rock', 'water'];
const ICON_FILE = { bird: 'icon-bird', predator: 'icon-predator', herbivore: 'icon-herbivore', primate: 'icon-primate', reptile: 'icon-reptile', bear: 'icon-bear', pet: 'icon-petting-zoo-animal', africa: 'icon-africa', americas: 'icon-americas', asia: 'icon-asia', australia: 'icon-australia', europe: 'icon-europe', science: 'icon-research', rock: 'icon-rock', water: 'icon-water' };
const ACTIONS = ['animals', 'build', 'cards', 'association', 'sponsors'];
function L(lang) {
  const fa = lang === 'fa';
  const t = (a, b) => (fa ? a : b);
  // engine labels carry Latin digits («6 پول»): the renderer shows Persian digits
  const d = (v) => (fa ? String(v).replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[c]).replace(/-/g, '−') : String(v).replace(/-/g, '−'));
  const card = (id) => (fa ? M.names[id] : M.names[id]);
  const name = (k) => (fa ? SEATS[k].fa : SEATS[k].en);
  const icon = (k) => M.ICON_FA[k] || k;
  const act = (k) => M.ACTION_FA[k];
  return { fa, t, d, card, name, icon, act, dir: fa ? 'rtl' : 'ltr', lang };
}

const A = '../assets/games/ark-nova/';
const used = new Set(); // art referenced (copied into the canvas build / asset store)
const ref = (name) => { used.add(name); return name; };
const src = (name) => A + ref(name).replace(/\//g, '--') + '.webp';
const IMG = (name, attrs = '') => `<img src="${src(name)}" ${attrs}>`;

const ICONS = {
  check: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>',
  undo: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /></svg>',
  x: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
  plus: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /> <path d="M12 5v14" /></svg>',
  minus: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>',
  fit: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>',
  back: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /> <path d="m12 5 7 7-7 7" /></svg>',
  book: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>',
  chat: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>',
  leave: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /> <polyline points="16 17 21 12 16 7" /> <line x1="21" x2="9" y1="12" y2="12" /></svg>',
  more: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1" /> <circle cx="12" cy="5" r="1" /> <circle cx="12" cy="19" r="1" /></svg>',
  hand: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="12" height="16" rx="2" /> <path d="M9 3h10a2 2 0 0 1 2 2v12" /></svg>',
  gear: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>',
  menu: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16" /> <path d="M4 12h16" /> <path d="M4 18h16" /></svg>',
  chev: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>',
  zoom: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>'
};

module.exports = {
  MAPC, STRIP, repX, REP_BONUS, cpX, CP_TILE, BAB_W, BAB_H, BAB_ZOO, BAB_UNI, BAB_TASK, BAB_HOT, BAB_DONATE, FOLDER_CITY,
  M, V, MAP_W, MAP_H, HEX, hexXY, LEFT_XY, WORKER_XY, PARTNER_XY, UNI_XY, CLIP_X, ACT, MB_W, MB_H, appealXY, cpTarget, cpXY, repXY, breakXY,
  FOLDER_X, FOLDER, DECK_XY, DISCARD_XY, BONUS_XY, AB_W, AB_H, TASK_XY, ZOO_XY, UNI_AB, DONATE_XY, LEVEL_XY, BONUS_FILE, UNI_FILE, KIND_FILE,
  cardFile, bldFile, actFile, fitBuilding, COLORS, SEATS, pct, at, ICON_ORDER, ICON_FILE, ACTIONS, L, A, used, ref, src, IMG, ICONS, CELLS
};
