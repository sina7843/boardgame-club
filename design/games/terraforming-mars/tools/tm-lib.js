// Shared pieces for the Terraforming Mars artboards: measured board geometry, mock data (checked with core.ts in
// mock-state.mjs), language helpers and the HTML of each table part. Positions are source-image pixels; on screen they
// become percentages of the board (left = x/W, top = y/H, translate(-50%,-50%)).
const fs = require('fs');
const path = require('path');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../work/mock.json'), 'utf8'));

// ---------- geometry (measured with tools/gridcrop.py on art/boards/*.webp) ----------
const BW = 1024, BH = 870; // board-tharsis
const PW = 889, PH = 653; // player-board
const hex = (id) => {
  if (id === '01') return [155, 360]; // Ganymede Colony (off map)
  if (id === '02') return [175, 148]; // Phobos Space Haven (off map)
  const s = M.spaces.find((x) => x.id === id);
  return [246 + 33.4 * Math.abs(s.row - 4) + 66.8 * s.col, 201 + 58 * s.row];
};
const trPos = (v) => {
  v = ((v % 100) + 100) % 100;
  if (v === 0) return [32, 842];
  if (v <= 24) return [32, 810 - (v - 1) * 32.52];
  if (v <= 50) return [32 + (v - 25) * 38.44, 28];
  if (v <= 74) return [993, 60 + (v - 51) * 32.6];
  return [993 - (v - 75) * 38.44, 842];
};
const oxyPos = (v) => { const a = (-42.7 + 6 * v) * Math.PI / 180; return [514 + 340 * Math.sin(a), 448 - 340 * Math.cos(a)]; };
const tempPos = (t) => (t <= -30 ? [905, 660] : [905, 612 - (t + 28) / 2 * 25]);
const MILESTONE_XY = [[110, 786], [196, 786], [284, 786], [371, 786], [460, 786]];
const AWARD_XY = [[570, 782], [655, 782], [741, 782], [828, 782], [914, 782]];
const SP_Y = [510, 542, 575, 607, 639, 674]; // standard projects rows, x centre 148, 146 x 30
const PROD = { // player board production track: value -> centre
  mc: (v) => (v < 0 ? [164 + 33.4 * (6 + v), 252] : v <= 5 ? [164 + 33.4 * v, 287] : [164 + 33.4 * (v - 5), 322]),
  steel: (v) => (v <= 5 ? [402 + 33.9 * v, 256] : [402 + 33.9 * (v - 5), 290]),
  titanium: (v) => (v <= 5 ? [640 + 33.8 * v, 256] : [640 + 33.8 * (v - 5), 290]),
  plants: (v) => (v <= 5 ? [92.5 + 33.5 * v, 391] : [92.5 + 33.5 * (v - 5), 427.5]),
  energy: (v) => (v <= 5 ? [363.5 + 33.3 * v, 391] : [363.5 + 33.3 * (v - 5), 427.5]),
  heat: (v) => (v <= 5 ? [625 + 33 * v, 391] : [625 + 33 * (v - 5), 427.5])
};
const COUNT_XY = { mc: [255, 172], steel: [540, 158], titanium: [778, 158], plants: [228, 568], energy: [493, 575], heat: [771, 568] };
const RES = ['mc', 'steel', 'titanium', 'plants', 'energy', 'heat'];
const RES_ICON = { mc: 'mc', steel: 'steel', titanium: 'titanium', plants: 'plant', energy: 'energy', heat: 'heat' };
const RES_FA = { mc: 'مگاکردیت', steel: 'فولاد', titanium: 'تیتانیوم', plants: 'گیاه', energy: 'انرژی', heat: 'گرما' };
const RES_EN = { mc: 'M€', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy', heat: 'Heat' };
const TAG_FA = { building: 'ساختمان', space: 'فضا', science: 'علم', power: 'انرژی', earth: 'زمین', jovian: 'مشتری', plant: 'گیاه', microbe: 'میکروب', animal: 'جانور', city: 'شهر', event: 'رویداد' };
const TAG_EN = { building: 'Building', space: 'Space', science: 'Science', power: 'Power', earth: 'Earth', jovian: 'Jovian', plant: 'Plant', microbe: 'Microbe', animal: 'Animal', city: 'City', event: 'Event' };
const CORP_FILE = { R00: 'beginner-corporation', R08: 'credicor', R17: 'ecoline', R18: 'helion', R19: 'interplanetary-cinematics', R43: 'inventrix', R24: 'mining-guild', R09: 'phobolog', R31: 'tharsis-republic', R13: 'thorgate', R32: 'united-nations-mars-initiative', R03: 'saturn-systems', R30: 'teractor' };
const COLORS = { red: '#E5483F', green: '#4FBF5A', blue: '#3F8FE5', yellow: '#F0C419', black: '#2B2B2B' };
const SEATS = [
  { fa: 'مینا', en: 'Mina', ini: ['م', 'M'], color: 'red', league: ['gold', 'طلا', 'Gold'] },
  { fa: 'نیلوفر', en: 'Niloufar', ini: ['ن', 'N'], color: 'blue', league: ['diamond', 'الماس', 'Diamond'] },
  { fa: 'آرش', en: 'Arash', ini: ['آ', 'A'], color: 'green', league: ['silver', 'نقره', 'Silver'] },
  { fa: 'سارا', en: 'Sara', ini: ['س', 'S'], color: 'yellow', league: ['platinum', 'پلاتین', 'Platinum'] }
];
// The board is shown without its printed TR frame (like BGA): visible window of the 1024x870 image.
const CROP = { x: 52, y: 48, w: 920, h: 774 };
const TAGS = ['building', 'space', 'science', 'power', 'earth', 'jovian', 'city', 'plant', 'microbe', 'animal', 'event', 'wild'];
const pct = (v, total) => +(v / total * 100).toFixed(3) + '%';
const at = (x, y, W, H) => `left:${pct(x, W)};top:${pct(y, H)}`;

// ---------- language ----------
function L(lang) {
  const fa = lang === 'fa';
  const t = (a, b) => (fa ? a : b);
  const d = (v) => (fa ? String(v).replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[c]).replace(/-/g, '−') : String(v).replace(/-/g, '−'));
  const card = (id) => { const c = M.cards[id]; return fa ? c.nameFa : c.name; };
  const res = (r) => (fa ? RES_FA[r] : RES_EN[r]);
  const tag = (g) => (fa ? TAG_FA[g] : TAG_EN[g]);
  const name = (k) => (fa ? SEATS[k].fa : SEATS[k].en);
  return { fa, t, d, card, res, tag, name, dir: fa ? 'rtl' : 'ltr', lang };
}

const A = '../assets/games/tm/';
const ic = (name, cls = 'tm-ic', alt = '') => `<img class="${cls}" src="${A}${name}.webp" alt="${alt}">`;
const cardImg = (id) => (id.startsWith('R') ? `corp-${CORP_FILE[id]}` : `card-${id}`);
const used = new Set(); // asset names referenced (copied into the canvas build)
const ref = (name) => { used.add(name); return name; };
const IMG = (name, attrs = '') => `<img src="${A}${ref(name)}.webp" ${attrs}>`;

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
  gear: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /> <circle cx="12" cy="12" r="3" /></svg>',
  menu: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16" /> <path d="M4 12h16" /> <path d="M4 18h16" /></svg>',
  pin: '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5" /> <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></svg>'
};

module.exports = { CROP, TAGS, M, BW, BH, PW, PH, hex, trPos, oxyPos, tempPos, MILESTONE_XY, AWARD_XY, SP_Y, PROD, COUNT_XY, RES, RES_ICON, TAG_FA, TAG_EN, CORP_FILE, COLORS, SEATS, pct, at, L, A, ic, cardImg, used, ref, IMG, ICONS };
