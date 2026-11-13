// Group A game module: Onitama (repo games/onitama: 5×5, master + 4 students each, 5 of 16 cards dealt (2 each + 1 beside the
// board), the side card's colour decides who starts, used card goes beside the board and you take the side card; win by
// capturing the enemy master or reaching its temple with your master). Board: index = r * 5 + c, r 0 = red's back row
// (bottom, seat 0), c 0 = red's left. Offsets (dx, dy) are from the owner's side.
import { popCss, pop } from './_ui.mjs';
export default function (H) {
  const bd = (L) => L.map(([a, b]) => [a, b.replace(/«([A-Za-z0-9<>+\-:. ]+)»/g, '«<bdi dir="ltr">$1</bdi>»')]);
  const { img, fa, ic, ART } = H;
  const CARDS = {
    tiger: ['ببر', 'Tiger', 'blue', [[0, 2], [0, -1]]], crab: ['خرچنگ', 'Crab', 'blue', [[-2, 0], [2, 0], [0, 1]]], monkey: ['میمون', 'Monkey', 'blue', [[-1, 1], [1, 1], [-1, -1], [1, -1]]],
    crane: ['درنا', 'Crane', 'blue', [[0, 1], [-1, -1], [1, -1]]], dragon: ['اژدها', 'Dragon', 'red', [[-2, 1], [2, 1], [-1, -1], [1, -1]]], elephant: ['فیل', 'Elephant', 'red', [[-1, 1], [1, 1], [-1, 0], [1, 0]]],
    mantis: ['آخوندک', 'Mantis', 'red', [[-1, 1], [1, 1], [0, -1]]], boar: ['گراز', 'Boar', 'red', [[-1, 0], [1, 0], [0, 1]]], frog: ['قورباغه', 'Frog', 'red', [[-2, 0], [-1, 1], [1, -1]]],
    goose: ['غاز', 'Goose', 'blue', [[-1, 0], [-1, 1], [1, 0], [1, -1]]], horse: ['اسب', 'Horse', 'red', [[-1, 0], [0, 1], [0, -1]]], eel: ['مارماهی', 'Eel', 'blue', [[-1, 1], [-1, -1], [1, 0]]],
    rabbit: ['خرگوش', 'Rabbit', 'blue', [[2, 0], [1, 1], [-1, -1]]], rooster: ['خروس', 'Rooster', 'red', [[1, 0], [1, 1], [-1, 0], [-1, -1]]], ox: ['گاو', 'Ox', 'blue', [[1, 0], [0, 1], [0, -1]]],
    cobra: ['کبرا', 'Cobra', 'red', [[-1, 0], [1, 1], [1, -1]]],
  };
  const IDS = Object.keys(CARDS);
  const mine = (p, seat) => !!p && p[0] === (seat === 0 ? 'r' : 'b');
  const target = (from, seat, [dx, dy]) => { const sg = seat === 0 ? 1 : -1; const r = Math.floor(from / 5) + dy * sg, c = (from % 5) + dx * sg; return r >= 0 && r < 5 && c >= 0 && c < 5 ? r * 5 + c : null; };
  const movesFor = (s, seat) => { const out = []; for (const card of s.hands[seat]) for (let from = 0; from < 25; from++) { if (!mine(s.b[from], seat)) continue; for (const off of CARDS[card][3]) { const to = target(from, seat, off); if (to !== null && !mine(s.b[to], seat)) out.push({ card, from, to }); } } return out; };
  const sqn = (i) => 'abcde'[i % 5] + (Math.floor(i / 5) + 1);
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  let po = null;
  for (let seed = 1; seed < 3000 && !po; seed++) {
    const R = rng(seed); const deck = IDS.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const s = { b: Array(25).fill(null), hands: [deck.slice(0, 2), deck.slice(2, 4)], side: deck[4], cur: 0 };
    for (const c of [0, 1, 3, 4]) { s.b[c] = 'rS'; s.b[20 + c] = 'bS'; } s.b[2] = 'rM'; s.b[22] = 'bM';
    s.cur = CARDS[s.side][2] === 'red' ? 0 : 1;
    if (s.cur !== 1) continue; // blue (opponent) starts, you are red and second
    const hist = []; let last = null, over = false, caps = 0;
    for (let ply = 0; ply < 11; ply++) {
      const L = movesFor(s, s.cur); if (!L.length) { over = true; break; }
      const capt = L.filter((m) => s.b[m.to]);
      const m = capt.length && R() < 0.5 ? capt[Math.floor(R() * capt.length)] : L[Math.floor(R() * L.length)];
      const piece = s.b[m.from], cap = s.b[m.to];
      if (cap) caps++;
      if (cap?.[1] === 'M' || (piece[1] === 'M' && m.to === (s.cur === 0 ? 22 : 2))) { over = true; break; }
      s.b[m.to] = piece; s.b[m.from] = null; const h = s.hands[s.cur]; h[h.indexOf(m.card)] = s.side; s.side = m.card;
      hist.push({ san: `${CARDS[m.card][1]} ${sqn(m.from)}${cap ? 'x' : '-'}${sqn(m.to)}` }); last = m; s.cur = 1 - s.cur;
    }
    if (over || s.cur !== 0 || caps < 2) continue;
    const L = movesFor(s, 0);
    const hits = L.filter((m) => s.b[m.to] && s.b[m.to][1] === 'S');
    if (!hits.length || L.some((m) => s.b[m.to] === 'bM')) continue;
    const pick = hits[0];
    const sameCard = L.filter((m) => m.card === pick.card && m.from === pick.from);
    if (sameCard.length < 2) continue;
    po = { s, hist, last, pick, dots: sameCard.map((m) => m.to), caps: sameCard.filter((m) => s.b[m.to]).map((m) => m.to) };
  }
  const { s, hist, last, pick, dots, caps: capSq } = po;
  const pieceArt = (p) => `onitama-${p[0] === 'r' ? 'red' : 'blue'}-${p[1] === 'M' ? 'master' : 'student'}`;
  const pieceAlt = (p) => `${p[1] === 'M' ? 'استاد' : 'شاگرد'} ${p[0] === 'r' ? 'قرمز' : 'آبی'}`;
  const count = (seat, b = s.b) => b.filter((p) => mine(p, seat)).length;
  const mkB = (m) => { const b = Array(25).fill(null); for (const [k, v] of Object.entries(m)) b[k] = v; return b; };
  // §4 no legal move: all five of your pieces stand on the far row and Elephant / Boar only go forward or sideways
  const nm = { b: mkB({ 20: 'rS', 21: 'rS', 22: 'rS', 23: 'rS', 24: 'rM', 7: 'bM', 12: 'bS', 3: 'bS' }), hands: [['elephant', 'boar'], ['frog', 'mantis']], side: 'cobra', cur: 0 };
  if (movesFor(nm, 0).length) throw new Error('onitama mock: red still has a move');
  // §5 your master one diagonal step from the blue temple (c5); Mantis reaches it
  const tp = { b: mkB({ 16: 'rM', 5: 'rS', 8: 'rS', 13: 'bM', 19: 'bS', 10: 'bS' }), hands: [['mantis', 'cobra'], ['frog', 'monkey']], side: 'rabbit', cur: 0 };
  const tpMoves = movesFor(tp, 0).filter((m) => m.card === 'mantis' && m.from === 16);
  if (!tpMoves.some((m) => m.to === 22) || movesFor(tp, 0).some((m) => tp.b[m.to] === 'bM')) throw new Error('onitama mock: temple');
  const usedCards = [...s.hands[0], ...s.hands[1], s.side];

  const css = `
.oni{display:grid;gap:8px;inline-size:var(--b,572px);direction:ltr;flex:none;align-self:center;--cw:156px;--bd:376px}
.oni-hand{display:flex;gap:10px;justify-content:center;align-items:flex-start}
.oni-card{position:relative;display:grid;gap:3px;justify-items:center;margin:0}
.oni-card img{inline-size:var(--cw);aspect-ratio:471/276;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 14px -8px rgba(0,0,0,.6);display:block}
.oni-hand.is-opp .oni-card img{transform:rotate(180deg)}
.oni-card figcaption{font:700 12.5px/1.3 var(--font-body);color:var(--felt-muted);direction:rtl}
.oni-card.is-sel img{outline:3px solid #E8A642;outline-offset:2px;transform:translateY(-4px)}
.oni-card.is-sel figcaption{color:#F4C27A}
.oni-mid{display:flex;gap:12px;align-items:center;justify-content:center}
.oni-bd{position:relative;inline-size:var(--bd);block-size:var(--bd);background:var(--img) center/100% 100% no-repeat;border-radius:4px;box-shadow:0 4px 0 rgba(0,0,0,.28),0 18px 30px -18px rgba(0,0,0,.6);flex:none}
.oni-bd .ga-grid{inset:3.36% 3.1%}
.oni-bd .ga-cell>img{inline-size:86%;block-size:86%}
.oni-side{display:grid;gap:6px;justify-items:center;inline-size:var(--cw)}
.oni-side .oni-card img{opacity:.92}
.oni-side p{margin:0;font-size:12px;line-height:1.5;color:var(--felt-muted);text-align:center;direction:rtl}
.oni-bd .ga-cell.is-sel::before{background:rgba(232,166,66,.45)}
.oni-bd .ga-cell.is-dot::after{background:rgba(20,43,59,.45);box-shadow:none}
.oni-bd .ga-cell.is-cap::after{content:"";position:absolute;z-index:2;inset:8%;border-radius:50%;border:3px solid #C0392B;background:none}
.oni-bd .ga-cell.is-cap>img{outline:none}
.cx-phone .oni{--cw:104px;--bd:300px;gap:6px}
.cx-phone .oni-hand{gap:8px}
.cx-phone .oni-card figcaption{font-size:11px}
.oni-bd .ga-cell.is-temple::before{content:"";position:absolute;inset:4%;border-radius:6px;background:rgba(232,166,66,.28);box-shadow:inset 0 0 0 3px #E8A642,0 0 14px rgba(232,166,66,.7)}
.oni-tmp{position:absolute;z-index:3;inset-block-end:6%;inset-inline:0;margin-inline:auto;inline-size:max-content;padding:1px 7px;border-radius:999px;background:#8D581A;color:#FFF6E6;font:800 11.5px/1.6 var(--font-body);font-style:normal}
.cx-phone .oni-tmp{font-size:9.5px;padding:0 5px}
.cx-phone .cx-ms__m:nth-last-child(n+3){display:none}
.oni-sep{inline-size:1px;align-self:stretch;background:rgba(250,245,236,.18)}
.oni-lg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.oni-lg>span{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 10px;font-size:12.5px;line-height:1.5;color:var(--text-muted)}
.oni-lg img{grid-row:span 2;inline-size:34px;block-size:34px;object-fit:contain}
.oni-lg b{font-size:15px;color:var(--heading)}
` + popCss;
  const card = (id, o = {}) => `<figure class="oni-card${o.sel ? ' is-sel' : ''}">${img(`onitama-card-${id}`, `کارت ${CARDS[id][0]}`)}<figcaption>${CARDS[id][0]}${o.cap ? `<span class="bgv-sep"></span>${o.cap}` : ''}</figcaption></figure>`;
  function boardHtml(g, st, o = {}) {
    const phone = !!o.b;
    const cells = [];
    for (let r = 4; r >= 0; r--) for (let c = 0; c < 5; c++) {
      const i = r * 5 + c; const cls = ['ga-cell']; const p = st.b[i];
      if (o.last?.includes(i)) cls.push('is-last'); if (o.sel === i) cls.push('is-sel'); if (o.caps?.includes(i)) cls.push('is-cap'); else if (o.dots?.includes(i)) cls.push('is-dot'); if (o.temple === i) cls.push('is-temple');
      cells.push(`<span class="${cls.join(' ')}">${p ? img(pieceArt(p), pieceAlt(p)) : ''}${o.temple === i ? '<i class="oni-tmp">معبد</i>' : ''}</span>`);
    }
    const board = `<div class="oni-bd" style="--img:url(${ART['onitama-board']})" role="grid" aria-label="صفحهٔ اونیتاما ۵×۵"><div class="ga-grid" style="--n:5">${cells.join('')}</div></div>`;
    const side = card(st.side, { cap: 'کنار صفحه' });
    const opp = `<div class="oni-hand is-opp" aria-label="کارت‌های حریف">${st.hands[1].map((id) => card(id)).join('')}</div>`;
    const me = `<div class="oni-hand" aria-label="کارت‌های شما">${st.hands[0].map((id) => card(id, { sel: id === o.card || o.pick })).join('')}${phone ? `<i class="oni-sep"></i>${side}` : ''}</div>`;
    const mid = phone ? `<div class="oni-mid">${board}</div>` : `<div class="oni-mid">${board}<div class="oni-side">${side}<p>بعد از حرکت شما، این کارت مال شما می‌شود و کارتی که بازی کردید اینجا می‌آید.</p></div></div>`;
    return `<div class="oni" style="${o.b ? `--b:${o.b}px;` : ''}">${opp}${mid}${me}</div>`;
  }
  const lgCard = (st, rule) => `<section class="cx-card"><div class="oni-lg"><span>${img('onitama-red-master', 'استاد قرمز')}<b>استاد</b>زدنش یعنی برد</span><span>${img('onitama-red-student', 'شاگرد قرمز')}<b>شاگرد</b>${fa(count(0, st.s.b) - 1)} شاگرد شما، ${fa(count(1, st.s.b) - 1)} شاگرد حریف</span></div><div class="ga-rule">${ic('info')}<span>${rule}</span></div></section>`;
  return {
    slug: 'Onitama', fa: 'اونیتاما', latin: 'Onitama', meta: ['زنده', '۱۰ دقیقه', 'رتبه‌ای'], sideFa: ['آبی', 'قرمز'], notation: 'کارت، خانهٔ مبدأ و مقصد',
    boardHtml, css, cards: usedCards,
    note: (st, who) => { const seat = who === 'me' ? 0 : 1; const lost = 5 - count(seat, st.s.b); return `<span class="ga-mini">${img(seat === 0 ? 'onitama-red-student' : 'onitama-blue-student')}<b>${fa(count(seat, st.s.b))} مهره${lost ? `<span class="bgv-sep"></span>${fa(lost)} از دست رفته` : ''}</b></span>`; },
    railCard: (st) => lgCard(st, 'استاد حریف را بزنید (راه سنگ) یا استاد خودتان را به معبد او، خانهٔ وسط ردیف بالا، برسانید (راه رود). کارتی که بازی می‌کنید کنار صفحه می‌رود و کارت کنار مال شما می‌شود.'),
    noDraw: true,
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    turnSub: 'کارت حرکت',
    diffs: bd([
      ['صفحه', '۵×۵ از بستهٔ آماده (BGA)، بریده‌شده به محدودهٔ بازی؛ معبد آبی بالا و معبد قرمز (شما) پایین. صفحه برای هر بازیکن از سمت خودش دیده می‌شود'],
      ['کارت‌ها', 'دو کارت حریف بالای صفحه (برعکس، رو به او)، دو کارت شما پایین و کارت کنار صفحه کنارش؛ اسم فارسی زیر هر کارت. در گوشی کارت کنار در ردیف شما می‌آید'],
      ['حرکت', 'اول کارت را انتخاب کنید (قاب نارنجی)، بعد مهره را؛ خانه‌های قابل رفتن همان کارت نقطه دارند و زدن مهرهٔ حریف با حلقهٔ قرمز. وقتی استاد شما یک قدم تا معبد حریف است، معبد قاب طلایی و برچسب «معبد» می‌گیرد (§۵)'],
      ['کنار اسم و ستون', 'شمار مهره‌های باقی‌مانده و از دست رفته. در ستون کنار: راهنمای استاد و شاگرد با شمار مهره‌ها و دو راه برد؛ کارت‌ها روی خود میز دیده می‌شوند'],
      ['دکمه‌ها', 'فقط «تسلیم»؛ اونیتاما مساوی ندارد و بازی فقط با گرفتن استاد یا رسیدن استاد به معبد تمام می‌شود. رد نوبت فقط وقتی هیچ حرکتی نیست و باز هم یکی از دو کارت را کنار صفحه می‌فرستید (§۴)'],
      ['ثبت حرکت', 'اسم انگلیسی کارت و خانه‌ها مثل «Tiger c1-c3»، زدن با «x»؛ ستون a تا e از چپ قرمز، ردیف ۱ ردیف قرمز'],
    ]),
    st: {
      s, hist, turnMe: true, clocks: { me: '7:20', opp: '6:48' },
      status: `<b>نوبت شماست.</b> با «${CARDS[pick.card][0]}» ${s.b[pick.from][1] === 'M' ? 'استاد' : 'شاگرد'} ${sqn(pick.from)} را انتخاب کرده‌اید؛ خانهٔ حلقه‌دار یک شاگرد آبی را می‌زند.`,
      pstatus: `<b>نوبت شما.</b> «${CARDS[pick.card][0]}»: یکی از خانه‌های نشان‌دار را بزنید.`,
      bo: { last: [last.from, last.to], sel: pick.from, dots, caps: capSq, card: pick.card },
    },
    phases: [
      { shotTitle: 'حرکتی ندارید', turnSub: 'یکی از دو کارت را کنار صفحه بفرستید', st: { s: nm, hist: [...hist, { san: 'Cobra b2-c2' }], turnMe: true, clocks: { me: '3:10', opp: '2:52' }, bo: { last: [6, 7], pick: true },
          status: '<b>حرکتی ندارید.</b> «فیل» و «گراز» فقط جلو و پهلو می‌روند و همهٔ مهره‌هایتان در ردیف آخرند. نوبت رد می‌شود، اما باید یکی از دو کارت را کنار صفحه بفرستید و «کبرا» را بردارید.',
          pstatus: '<b>حرکتی ندارید.</b> یک کارت را کنار صفحه بفرستید' },
        railCard: (st) => lgCard(st, '<b>رد نوبت:</b> فقط وقتی هیچ مهره‌ای با هیچ‌کدام از دو کارت حرکت مجاز ندارد. باز هم کارت عوض می‌شود: یکی را کنار صفحه می‌گذارید و کارت کنار را برمی‌دارید.'),
        overlay: (ph) => pop('', 'حرکتی ندارید', ph ? 'کدام کارت کنار صفحه برود؟' : 'کدام کارت کنار صفحه برود؟ «کبرا» به جایش مال شما می‌شود.', `${H.btn('فرستادن «گراز»', 'secondary')}${H.btn('فرستادن «فیل»', 'primary')}`),
        phone: true },
      { shotTitle: 'استاد یک قدم تا معبد', turnSub: 'راه رود', st: { s: tp, hist: [...hist, { san: 'Rabbit c2-d3' }], turnMe: true, clocks: { me: '4:02', opp: '3:37' }, bo: { last: [7, 13], sel: 16, card: 'mantis', dots: tpMoves.map((m) => m.to), temple: 22 },
          status: '<b>نوبت شماست.</b> استاد شما با «آخوندک» به معبد آبی (c5) می‌رسد و می‌برید (راه رود).',
          pstatus: '<b>نوبت شما.</b> استاد به معبد c5 برود: برد' },
        railCard: (st) => lgCard(st, '<b>راه رود:</b> اگر استاد خودتان روی معبد حریف (خانهٔ وسط ردیف بالا) برود، همان لحظه می‌برید. معبد وقتی استاد یک قدم با آن فاصله دارد قاب طلایی می‌گیرد.'),
        phone: true },
    ],
  };
}
