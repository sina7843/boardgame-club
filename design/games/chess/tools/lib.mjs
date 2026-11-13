// Shared parts for the chess canvas boards. Positions come from the repo engine copy (correct SAN, captures, checks).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const R = await import(pathToFileURL('E:/AI/Claude/bgv-chess/engine/src/rules.ts'));
const ART = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/chess/images';
export const SETS = ['classic', 'flat', 'walnut', 'clay', 'persian', 'glass', 'neon'];
export const TOKENS = JSON.parse(readFileSync(`${ART}/../boards/board-tokens.json`, 'utf8'));

// ---------- digits / text ----------
const FA = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, '٫');
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- pieces: one CSS class per piece, background = the ready-made flat SVG (no invented art) ----------
const svgUri = (file) => {
  let s = readFileSync(file, 'utf8');
  s = s.replace(/<title>.*?<\/title>/s, '').replace(/\s(role|data-[a-z-]+)="[^"]*"/g, '').replace(/width="160" height="160" /, '');
  return `url("data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}")`;
};
export const BLOB = JSON.parse(readFileSync('E:/AI/Claude/bgv-chess/canvas2/blob-map.json', 'utf8'));
const pieceUrl = (set, c, t, blob) => blob ? `url("/_blob/${BLOB[`${set}-${c}-${t}`]}")` : set === 'classic' ? `url("/canvas2/assets/classic/classic-${c}-${t}.webp")` : svgUri(`${ART}/pieces/${set}/${c}-${t}.svg`);
export function pieceCss(set = 'flat', prefix = 'pc', blob = false) {
  let css = '';
  for (const c of 'wb') for (const t of 'kqrbnp') css += `.${prefix}-${c}${t}{background-image:${pieceUrl(set, c, t, blob)}}\n`;
  return css;
}
export const kingUri = (set, c = 'w', t = 'k', blob = false) => pieceUrl(set, c, t, blob);
export function setCss(blob) { return SETS.map((s) => `.st-${s}-k{background-image:${pieceUrl(s, 'w', 'k', blob)}}.st-${s}-n{background-image:${pieceUrl(s, 'b', 'n', blob)}}`).join('\n'); }
export const pc = (p, cls = '') => p ? `<i class="pc pc-${p[0]}${p[1].toLowerCase()}${cls ? ' ' + cls : ''}" aria-hidden="true"></i>` : '';

// ---------- game helpers (engine) ----------
export function playLine(fen, ucis) {
  let pos = R.fromFen(fen ?? R.START_FEN);
  const hist = [];
  for (const u of ucis) {
    const from = R.sqIndex(u.slice(0, 2)), to = R.sqIndex(u.slice(2, 4)), promo = u[4]?.toUpperCase();
    const legal = R.legalMoves(pos);
    const m = legal.find((x) => x.from === from && x.to === to && (x.promo ?? undefined) === (promo ?? undefined));
    if (!m) throw new Error(`illegal ${u} in ${JSON.stringify(hist.map((h) => h.san))}`);
    hist.push({ san: R.san(pos, m, legal), from: u.slice(0, 2), to: u.slice(2, 4), color: pos.turn });
    pos = R.makeMove(pos, m);
  }
  return { pos, hist };
}
export const legalFrom = (pos, sq) => R.legalMoves(pos).filter((m) => R.sqName(m.from) === sq);
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
/** Pieces of colour `c` that the OTHER side has captured (missing from the start set), sorted P,N,B,R,Q. */
export function capturedOf(board, c) {
  const START = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const out = [];
  for (const t of ['P', 'N', 'B', 'R', 'Q']) {
    const n = board.filter((x) => x === c + t).length;
    for (let i = 0; i < START[t] - n; i++) out.push(c + t);
  }
  return out;
}
export const material = (board, c) => board.filter((p) => p && p[0] === c).reduce((n, p) => n + VAL[p[1]], 0);

// ---------- board ----------
/**
 * opts: flip (black at bottom), last [from,to], sel, dots [sq], caps [sq], check sq, pre [sq], hover sq,
 * promo {sq, color} (promotion column), coords (default true), cls, label.
 */
export function board(boardArr, o = {}) {
  const files = o.flip ? 'hgfedcba' : 'abcdefgh';
  const ranks = o.flip ? '12345678' : '87654321';
  let cells = '';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = files[f] + ranks[r];
    const idx = R.sqIndex(sq);
    const light = (idx % 8 + Math.floor(idx / 8)) % 2 === 1;
    const cl = ['sq', light ? 'l' : 'd'];
    if (o.last?.includes(sq)) cl.push('is-last');
    if (o.sel === sq) cl.push('is-sel');
    if (o.pre?.includes(sq)) cl.push('is-pre');
    if (o.check === sq) cl.push('is-check');
    if (o.hover === sq) cl.push('is-hover');
    if (o.dots?.includes(sq)) cl.push(boardArr[idx] ? 'is-cap' : 'is-dot');
    if (o.ring?.includes(sq)) cl.push('is-cap', 'is-ep');
    let inner = pc(boardArr[idx], o.ghost === sq ? 'is-ghost' : '');
    if (o.coords !== false) {
      if (f === 0) inner += `<b class="co co-r">${ranks[r]}</b>`;
      if (r === 7) inner += `<b class="co co-f">${files[f]}</b>`;
    }
    cells += `<span class="${cl.join(' ')}" data-sq="${sq}">${inner}</span>`;
  }
  let promo = '';
  if (o.promo) {
    const f = files.indexOf(o.promo.sq[0]);
    const c = o.promo.color;
    const list = ['Q', 'N', 'R', 'B'].map((t) => `<button type="button" class="cx-promo__p" aria-label="${{ Q: 'وزیر', N: 'اسب', R: 'رخ', B: 'فیل' }[t]}">${pc(c + t)}</button>`).join('');
    promo = `<div class="cx-promo" style="--f:${f}" role="dialog" aria-label="انتخاب مهرهٔ ارتقا">${list}<button type="button" class="cx-promo__x" aria-label="لغو ارتقا"><svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>`;
  }
  const arrows = (o.arrows ?? []).map(([a, b]) => arrowSvg(a, b, files, ranks)).join('');
  return `<div class="cx-board${o.cls ? ' ' + o.cls : ''}" dir="ltr" role="grid" aria-label="${esc(o.label ?? 'صفحهٔ شطرنج')}">${cells}${arrows ? `<svg class="cx-arrows" viewBox="0 0 800 800" aria-hidden="true">${arrows}</svg>` : ''}${promo}${o.overlay ?? ''}</div>`;
}
function arrowSvg(a, b, files, ranks) {
  const xy = (s) => [files.indexOf(s[0]) * 100 + 50, ranks.indexOf(s[1]) * 100 + 50];
  const [x1, y1] = xy(a), [x2, y2] = xy(b);
  const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1) - 34;
  const ex = x1 + Math.cos(ang) * L, ey = y1 + Math.sin(ang) * L;
  return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke-width="18" stroke-linecap="round"/><polygon points="${x2},${y2} ${ex + Math.cos(ang + Math.PI / 2) * 26},${ey + Math.sin(ang + Math.PI / 2) * 26} ${ex - Math.cos(ang + Math.PI / 2) * 26},${ey - Math.sin(ang + Math.PI / 2) * 26}"/>`;
}

// ---------- icons (lucide, same set the DS uses) ----------
const I = {
  back: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  sound: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  hand: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  flip: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  first: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  last: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  wifioff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  chevdown: '<path d="m6 9 6 6 6-6"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
};
export const ic = (n, cls = '') => `<svg class="bgv-icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
// chess art icons from Games Redesign/chess/images/ui/icons (stroke recoloured by CSS currentColor)
const ART_IC = {
  bullet: 'M17 4C12 4 9 9 9 15V19H25V15C25 9 22 4 17 4ZM9 22H25V27H9ZM4 12H1M4 18H0M5 24H2',
  lightning: 'M18 2L5 18H14L11 30L27 12H18Z',
  stopwatch: 'M12 2H20M16 2V6M25 7L28 4M16 13V19L20 22M28 19A12 12 0 1 1 4 19A12 12 0 1 1 28 19Z',
  crown: 'M4 10L10 16L16 5L22 16L28 10L25 25H7ZM8 29H24',
  flag: 'M8 30V3M8 4C15-1 18 9 27 4V19C18 24 15 14 8 19',
  sun: 'M16 9A7 7 0 1 1 16 23A7 7 0 1 1 16 9ZM16 1V4M16 28V31M1 16H4M28 16H31M5 5L7 7M25 25L27 27M5 27L7 25M25 7L27 5',
};
export const aic = (n, cls = 'cx-aic') => `<svg class="${cls}" viewBox="0 0 34 34" aria-hidden="true"><path d="${ART_IC[n]}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- components ----------
/** Chess clock. state: idle | run | warn | crit | flag | off (disconnected) | pre (not started). */
export function clock(time, state = 'idle', o = {}) {
  const lbl = { idle: 'متوقف', run: 'در حال کم شدن', warn: 'کم‌وقت', crit: 'وقت بحرانی', flag: 'وقت تمام شد', off: 'بازیکن قطع است، ساعت کار می‌کند', pre: 'هنوز شروع نشده' }[state];
  const lead = state === 'flag' ? aic('flag', 'cx-clock__ic') : state === 'off' ? ic('wifioff', 'cx-clock__ic') : (state === 'run' || state === 'warn' || state === 'crit') ? '<i class="cx-clock__tick" aria-hidden="true"></i>' : '';
  return `<span class="cx-clock${o.sm ? ' cx-clock--sm' : ''}" data-state="${state}" role="timer" aria-label="ساعت ${esc(o.who ?? '')}، ${lbl}">${lead}<b class="cx-clock__t">${fa(time)}</b></span>`;
}
/** Player bar: avatar, name, rating, tier, captured pieces + material lead, clock. */
export function pbar(p, o = {}) {
  const capsList = (p.caps ?? []).map((x) => pc(x, 'cx-capt')).join('');
  const caps = capsList ? `<span class="cx-capbox${p.caps[0][0] === 'b' ? ' cx-capbox--b' : ''}">${capsList}</span>` : '';
  const lead = p.lead ? `<b class="cx-lead">+${fa(p.lead)}</b>` : '';
  const tags = (p.tags ?? []).join('');
  return `<div class="cx-pbar${p.you ? ' is-you' : ''}${p.turn ? ' is-turn' : ''}${o.sm ? ' cx-pbar--sm' : ''}">
<span class="bgv-avatar ${o.sm ? 'bgv-avatar--sm' : ''} seat-${p.seat ?? 1}${p.you ? ' is-you' : ''}">${p.av ?? p.name[0]}</span>
<span class="cx-pbar__id"><span class="cx-pbar__name"><b>${esc(p.name)}</b><span class="cx-rating">${fa(p.rating)}</span>${p.tier ? `<span class="bgv-league bgv-league--${p.tier}">${p.tierFa}</span>` : ''}${tags}</span>
<span class="cx-pbar__caps" aria-label="مهره‌های گرفته‌شده">${caps}${lead}${p.note ? `<span class="cx-pbar__note">${p.note}</span>` : ''}</span></span>
${p.clock ?? ''}</div>`;
}
/** Move list (SAN in Latin, move numbers Persian). cur = ply index highlighted. */
export function moveList(hist, o = {}) {
  let rows = '';
  for (let i = o.from ?? 0; i < hist.length; i += 2) {
    const n = i / 2 + 1;
    const cell = (k) => hist[k] ? `<button type="button" class="cx-ml__m${k === (o.cur ?? hist.length - 1) ? ' is-cur' : ''}${hist[k].pre ? ' is-pre' : ''}" dir="ltr">${hist[k].san}</button>` : '<span></span>';
    rows += `<span class="cx-ml__n">${fa(n)}.</span>${cell(i)}${cell(i + 1)}`;
  }
  return `<div class="cx-ml" role="list" aria-label="حرکت‌ها">${rows}</div>`;
}
export function moveStrip(hist, o = {}) {
  const items = hist.map((h, i) => `${i % 2 === 0 ? `<span class="cx-ms__n">${fa(i / 2 + 1)}.</span>` : ''}<span class="cx-ms__m${i === (o.cur ?? hist.length - 1) ? ' is-cur' : ''}" dir="ltr">${h.san}</span>`).join('');
  return `<div class="cx-ms" dir="ltr" aria-label="حرکت‌ها">${items}</div>`;
}
export const navBtns = () => `<div class="cx-nav" role="group" aria-label="مرور حرکت‌ها"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="اولین حرکت">${ic('last')}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="حرکت قبل">${ic('next')}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="حرکت بعد">${ic('prev')}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="آخرین حرکت">${ic('first')}</button></div>`;

export function gamebar(o = {}) {
  return `<header class="bgv-gamebar"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="بازگشت">${ic('back')}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">شطرنج<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">CHESS</span></span><span class="bgv-gamebar__meta">${(o.meta ?? ['بلیتس ۵ دقیقه', 'رتبه‌دار']).map((m, i) => `<span class="bgv-gamebar__mi${i === 0 ? ' is-first' : ''}">${m}</span>`).join('')}</span></div>${o.extra ?? ''}${o.phone ? '' : `<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="صدا">${ic('sound')}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-iconbtn-count" type="button" aria-label="گفت‌وگوی میز">${ic('chat')}${o.unread ? `<span class="bgv-badge bgv-badge--count">${fa(o.unread)}</span>` : ''}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="گزینه‌های میز">${ic('more')}</button></header>`;
}

/** Wrap a .dc.html board file. */
export function dcFile({ title, w, h, css, body, script = '' }) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../ds/bgv/tokens.css">
<link rel="stylesheet" href="../ds/bgv/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<style>
${css}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
${script}
</script>
</body>
</html>
`;
}
