// Writes the handoff data files: layout.json, data/{scenes,time-controls,board-tokens,art-index}.json, reference/screens.json
// node --experimental-strip-types gen-handoff-data.mjs <design/games/chess dir>
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { R, TOKENS, SETS } from './lib.mjs';
import { S } from './scenes.mjs';

const OUT = process.argv[2];
mkdirSync(`${OUT}/data`, { recursive: true }); mkdirSync(`${OUT}/reference`, { recursive: true });
const J = (p, o) => writeFileSync(`${OUT}/${p}`, JSON.stringify(o, null, 1) + '\n');

function toFen(pos) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p[0] === 'w' ? p[1] : p[1].toLowerCase();
    }
    rows.push(row + (empty || ''));
  }
  const c = pos.castling;
  const cast = (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '') || '-';
  return `${rows.join('/')} ${pos.turn} ${cast} ${pos.ep === null ? '-' : R.sqName(pos.ep)} ${pos.halfmove} ${pos.fullmove}`;
}

const START = {
  main: null, mainB: null, check: null, ep: null, pre: null, rep: null,
  promo: '8/8/4P1k1/8/8/5K2/r7/8 w - - 0 50', low: '2r3k1/5pp1/7p/8/8/6PP/5PK1/3R4 w - - 0 36',
  draw: '3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 30', mate: '6k1/p2r1ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 30',
};
const USED = {
  main: ['D02-turn', 'D08-resign', 'D10-reconnect', 'D12-spectator', 'D13-dark', 'P03', 'P09', 'P12', 'P13', 'P15', 'P17'],
  mainB: ['D11-opp-offline', 'P14'], check: ['D03-check', 'P04'], promo: ['D04-promotion', 'P05'], pre: ['D05-premove', 'P06'],
  low: ['D06-lowtime', 'P07', 'P18'], draw: ['D07-draw-offer', 'P08'], mate: ['D09-game-over', 'P10'], rep: ['P11'], ep: ['D14-en-passant', 'P19'],
};
const highlights = {
  main: { selected: 'b3', note: 'Qb3 selected: dots on its legal targets, ring on b7 (capture), hover frame on b7' },
  check: { selected: 'c1', note: 'in check from Bb4: Bc1 may only go to d2' },
  promo: { selected: 'e7', note: 'promotion column on e8: Q, N, R, B, ✕' },
  pre: { premove: ['f6', 'h5'], note: 'you are Black; premove Nf6-h5 queued during White\'s turn' },
  ep: { selected: 'e5', ring: ['d5'], note: 'en passant: e5xd6, the d5 pawn is removed (ring)' },
};
const scenes = {};
for (const [k, sc] of Object.entries(S)) {
  const sel = highlights[k]?.selected;
  scenes[k] = {
    startFen: START[k] ?? R.START_FEN,
    san: sc.hist.map((h) => h.san), uci: sc.hist.map((h) => h.from + h.to),
    fen: toFen(sc.pos), lastMove: sc.last, inCheck: sc.inCheck, checkSquare: sc.check,
    capturedByWhite: sc.capsW, capturedByBlack: sc.capsB, materialLead: { w: sc.leadW, b: sc.leadB },
    ...(sel ? { selected: sel, legalTargets: sc.legal(sel) } : {}),
    ...(highlights[k] ?? {}), usedOn: USED[k] ?? [],
  };
}
J('data/scenes.json', { note: 'Every position on the artboards, played through games/chess/src/rules.ts (commit ad371d9). Rebuild: tools/build.mjs.', scenes });

J('data/time-controls.json', {
  note: 'Owner decision 2026-11-07: main row 1/3/5/10 min without increment; increments only under «زمان‌های بیشتر» (friend games and tournaments). Class = FIDE estimate base + 60 × increment (repo clockClass).',
  main: [
    { value: '1+0', fa: '۱ دقیقه', class: 'bullet', classFa: 'بولت', quickPairing: true },
    { value: '3+0', fa: '۳ دقیقه', class: 'blitz', classFa: 'بلیتس', quickPairing: true },
    { value: '5+0', fa: '۵ دقیقه', class: 'blitz', classFa: 'بلیتس', quickPairing: true, default: true },
    { value: '10+0', fa: '۱۰ دقیقه', class: 'rapid', classFa: 'رپید', quickPairing: true },
  ],
  more: [
    { value: '1+1', fa: '۱ + ۱', class: 'bullet', classFa: 'بولت', quickPairing: false, note: 'not in definition.ts yet: add it' },
    { value: '3+2', fa: '۳ + ۲', class: 'blitz', classFa: 'بلیتس', quickPairing: false },
    { value: '5+3', fa: '۵ + ۳', class: 'blitz', classFa: 'بلیتس', quickPairing: false },
    { value: '10+5', fa: '۱۰ + ۵', class: 'rapid', classFa: 'رپید', quickPairing: false },
  ],
  adminOnly: ['2+1', '15+10', '30+0', '45+15', '60+30', '90+30', '5/4+0 (Armageddon)'],
  competition: { labelFa: 'نوع رقابت', options: [{ value: 'friendly', fa: 'دوستانه' }, { value: 'ranked', fa: 'رتبه‌دار' }], source: 'apps/web/src/pages/QuickMatch.tsx (existing control and wording)' },
});

J('data/board-tokens.json', { note: 'Copy of Games Redesign/chess/boards/board-tokens.json. Default: tournament-green.', default: 'tournament-green', themes: TOKENS });

const art = [];
for (const s of SETS) for (const c of 'wb') for (const t of 'kqrbnp') art.push({ set: s, piece: c + t, file: s === 'classic' ? `art/pieces/classic/${c}-${t}.webp` : `art/pieces/${s}/${c}-${t}.svg`, ...(s === 'classic' ? { source512: `art/pieces/classic/png/${c}-${t}.png` } : {}) });
J('data/art-index.json', { note: 'Default set: classic (Games Redesign/chess/pieces/classic, GPT «Classic Flat», approved 2026-11-08). Other sets: Games Redesign/chess/images/pieces (vector). Boards are CSS colours (data/board-tokens.json); board/overlay SVGs in art/boards for reference.', defaultSet: 'classic', pieces: art });

const H = JSON.parse(readFileSync('E:/AI/Claude/bgv-chess/canvas/build/heights.json', 'utf8'));
const boards = JSON.parse(readFileSync('E:/AI/Claude/bgv-chess/canvas/build/boards.json', 'utf8')).boards;
const screens = Object.entries(boards).map(([k, v]) => {
  const id = k.replace('chess/', '').replace('.dc.html', '');
  return { id, title: v.title, width: v.w, height: v.h, img: `reference/img/${id}.jpg`, html: `reference/html/${id}.html`, dc: `reference/dc/${id}.dc.html` };
});
J('reference/screens.json', { canvas: 'https://claude.ai/artifact/NhRomGy1qHDxcE3QoYedhU (page «۱. شطرنج، میز مسابقه»)', screens });

const layout = {
  note: 'Sizes in CSS px at the reference widths. Board grid is always dir=ltr. Desktop frame = DS table frame (rail | felt | chat).',
  desktop: { frame: [1440, 900], columns: { rail: 380, felt: 'minmax(0,1fr)', chat: 340 }, gamebar: 56, board: 688, square: 86, playerBar: 52, feltPadding: [12, 16], gap: 8, breakpoints: { chatToButton: 1199, phone: 899 } },
  phone: { frame: [390, 844], board: 390, square: 48.75, playerBar: 46, dock: { columns: 5, items: ['گزینه‌ها', 'مساوی', 'تسلیم', 'قبلی', 'بعدی'] }, moveStrip: true },
  board: { coordinates: { rank: 'inside left column, top-left of square', file: 'inside bottom row, bottom-right of square', font: 'Manrope 700, 20% of square' },
    overlays: { lastMove: 'rgba(245,230,99,.55)', selected: 'rgba(245,230,99,.72)', legalDot: 'circle 28% of square, rgba(0,0,0,.16)', capture: 'ring 7.5% of square, rgba(0,0,0,.16)', check: 'radial #E5484D .95→0 at 70%', premove: 'rgba(229,72,77,.45)', hover: 'inset white frame 6% of square', arrow: '#F29E2E @ 80%' },
    promotion: 'white column over the target file from the far edge: Q, N, R, B (rows = 1 square each), ✕ half a square; board dimmed rgba(0,0,0,.38)' },
  piece: { set: 'classic', fill: '100% of square (art has its own margins)', capturedIcon: 20, capturedOverlap: -7, capturedChip: 'light chip #E9E4DA only behind BLACK captured pieces' },
  clock: { width: { desktop: 136, phone: 104 }, height: { desktop: 46, phone: 38 }, digits: 'Peyda 900, Persian digits, fixed-width box, no tabular-nums', states: ['pre', 'idle', 'run', 'warn', 'crit', 'flag', 'off'],
    thresholds: { warn: 'max(20% of base, 20 s)', crit: '10 s', tenthsBelow: '10 s' } },
};
J('layout.json', layout);
console.log('data written', Object.keys(scenes).length, 'scenes,', screens.length, 'screens');
