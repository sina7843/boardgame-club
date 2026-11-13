// Group A: Abalone. Rules = repo games/abalone/src/rules.ts (61 cells, standard layout, black first, sumito, six off wins).
export default function (H) {
  const { img, fa, ic, esc } = H;

  // ---------- engine (port of rules.ts) ----------
  const CELLS = [];
  for (let r = -4; r <= 4; r++) for (let q = Math.max(-4, -4 - r); q <= Math.min(4, 4 - r); q++) CELLS.push([q, r]);
  const INDEX = new Map(CELLS.map(([q, r], i) => [`${q},${r}`, i]));
  const cellAt = (q, r) => INDEX.get(`${q},${r}`) ?? null;
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const nb = (i, d) => cellAt(CELLS[i][0] + DIRS[d][0], CELLS[i][1] + DIRS[d][1]);
  const other = (c) => (c === 'b' ? 'w' : 'b');
  const startBoard = () => CELLS.map(([q, r]) => (r >= 3 || (r === 2 && q >= -2 && q <= 0) ? 'b' : r <= -3 || (r === -2 && q >= 0 && q <= 2) ? 'w' : null));
  function lineOf(ms) {
    if (ms.length === 1) return { cells: ms, axis: null };
    for (let axis = 0; axis < 3; axis++) {
      const s = [...ms].sort((a, b) => { const [qa, ra] = CELLS[a], [qb, rb] = CELLS[b]; return (qa - qb) * DIRS[axis][0] + (ra - rb) * DIRS[axis][1] || (qa - qb) || (ra - rb); });
      if (s.every((c, k) => k === 0 || nb(s[k - 1], axis) === c)) return { cells: s, axis };
    }
    return null;
  }
  function tryMove(board, color, ms, d) {
    if (new Set(ms).size !== ms.length || ms.some((m) => board[m] !== color)) return null;
    const line = lineOf(ms); if (!line) return null;
    const inline = line.axis === null || d % 3 === line.axis;
    const b = board.slice();
    if (!inline) {
      const t = line.cells.map((c) => nb(c, d));
      if (t.some((x) => x === null || b[x] !== null)) return null;
      line.cells.forEach((c) => (b[c] = null)); t.forEach((x) => (b[x] = color));
      return { board: b, pushed: [], lost: 0, inline: false, line };
    }
    const lead = line.axis === null ? line.cells[0] : (d === line.axis ? line.cells.at(-1) : line.cells[0]);
    let at = nb(lead, d); const enemy = [];
    while (at !== null && b[at] === other(color)) { enemy.push(at); at = nb(at, d); }
    if (at !== null && b[at] === color) return null;
    if (!enemy.length && at === null) return null;
    if (enemy.length && enemy.length >= ms.length) return null;
    let lost = 0;
    if (enemy.length) { if (at === null) lost = 1; else b[at] = other(color); b[enemy[0]] = null; }
    const tail = line.axis === null ? line.cells[0] : (d === line.axis ? line.cells[0] : line.cells.at(-1));
    b[tail] = null; b[nb(lead, d)] = color;
    return { board: b, pushed: enemy, lost, inline: true, line, lead, tail };
  }
  function legalMoves(board, color) {
    const out = []; const groups = [];
    board.forEach((c, i) => {
      if (c !== color) return; groups.push([i]);
      for (let ax = 0; ax < 3; ax++) { const a = nb(i, ax); if (a === null || board[a] !== color) continue; groups.push([i, a]); const b2 = nb(a, ax); if (b2 !== null && board[b2] === color) groups.push([i, a, b2]); }
    });
    for (const g of groups) for (let d = 0; d < 6; d++) { const r = tryMove(board, color, g, d); if (r) out.push({ marbles: g, dir: d, r }); }
    return out;
  }
  // standard notation: rows A (black's home edge, r = 4) to I, diagonals 1..9 (n = q + 5)
  const nm = (i) => 'abcdefghi'[4 - CELLS[i][1]] + (CELLS[i][0] + 5);
  function san(m) {
    const r = m.r;
    if (r.inline) { const head = nb(r.lead, m.dir); return nm(r.tail) + nm(head); }
    const c = r.line.cells; return nm(c[0]) + nm(c.at(-1)) + nm(nb(c[0], m.dir));
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  const dist = (i) => { const [q, r] = CELLS[i]; return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); };
  function evalMove(m, color, R) {
    const b = m.r.board; let cen = 0, coh = 0;
    b.forEach((c, i) => { if (c !== color) return; cen -= dist(i); for (let d = 0; d < 6; d++) { const n = nb(i, d); if (n !== null && b[n] === color) coh++; } });
    return m.r.lost * 400 + m.r.pushed.length * 25 + cen * 3 + coh + R() * 14;
  }
  function play(seed, plies) {
    const R = rng(seed); let s = { board: startBoard(), turn: 'b', off: { b: 0, w: 0 } }; const hist = []; let last = null;
    for (let k = 0; k < plies; k++) {
      const L = legalMoves(s.board, s.turn);
      let best = null, bv = -1e9; for (const m of L) { const v = evalMove(m, s.turn, R); if (v > bv) { bv = v; best = m; } }
      hist.push({ san: san(best) }); last = best;
      s = { board: best.r.board, turn: other(s.turn), off: { ...s.off, [other(s.turn)]: s.off[other(s.turn)] + best.r.lost } };
    }
    return { s, hist, last };
  }

  // find a mid-game moment: white (you) to move, 3 marbles in line can push 2 (sumito), both sides have lost some
  let po = null, pick = null;
  for (let seed = 1; seed < 600 && !po; seed++) for (const n of [37, 41, 45]) {
    const p = play(seed, n);
    if (p.s.turn !== 'w' || p.s.off.w < 1 || p.s.off.b < 2 || p.s.off.b > 4 || p.s.off.w >= p.s.off.b) continue;
    const L = legalMoves(p.s.board, 'w');
    const m = L.find((x) => x.marbles.length === 3 && x.r.pushed.length === 2 && L.filter((y) => y.marbles.length === 3 && y.marbles.every((c) => x.marbles.includes(c))).length >= 4) ?? null;
    if (m) { po = p; pick = m; break; }
  }
  if (!po) throw new Error('abalone: no position found');
  const S = po.s;
  const group = pick.marbles;
  const groupMoves = legalMoves(S.board, 'w').filter((x) => x.marbles.length === group.length && x.marbles.every((c) => group.includes(c)));

  // ---------- board render (BGA board 705×659: cell (0,0) at 351,330, dx 55, dy 47) ----------
  const W = 705, Hh = 659;
  const pos = (i) => { const [q, r] = CELLS[i]; return [351 + 55 * (q + r / 2), 330 - 47 * r]; };
  const pct = ([x, y]) => `left:${((x / W) * 100).toFixed(2)}%;top:${((y / Hh) * 100).toFixed(2)}%`;
  function boardHtml(g, s, o = {}) {
    const lastSet = new Set(o.last ?? []);
    const marbles = s.board.map((c, i) => {
      if (!c) return lastSet.has(i) ? `<span class="ab-at ab-from" style="${pct(pos(i))}"></span>` : '';
      const cls = ['ab-at', 'ab-m']; if (o.sel?.includes(i)) cls.push('is-sel'); if (o.caps?.includes(i)) cls.push('is-push'); if (lastSet.has(i)) cls.push('is-last');
      return `<span class="${cls.join(' ')}" style="${pct(pos(i))}">${img(c === 'b' ? 'abalone-black-marble' : 'abalone-white-marble', c === 'b' ? 'گوی سیاه' : 'گوی سفید')}${o.sel?.includes(i) ? img('abalone-selected-marble', '') : ''}</span>`;
    }).join('');
    const arrows = (o.arrows ?? []).map((a) => `<span class="ab-at ab-arrow${a.main ? ' is-main' : ''}${a.side ? ' is-side' : ''}" style="${pct(a.xy)};--rot:${a.rot}deg" aria-label="${esc(a.label)}">${img('abalone-move-arrow', '')}</span>`).join('');
    return `<div class="ga-board ab-board" style="--img:url(${H.ART['abalone-board']});${o.b ? `--b:${o.b}px;` : ''}" role="img" aria-label="${esc(g.fa)}"><div class="ab-layer">${marbles}${arrows}</div></div>`;
  }
  // arrows: one per legal direction of the selected group, between the leading marble and its target
  const angle = (d) => { const a = pos(cellAt(0, 0)); const q = DIRS[d]; const t = [351 + 55 * (q[0] + q[1] / 2), 330 - 47 * q[1]]; return (Math.atan2(t[1] - a[1], t[0] - a[0]) * 180) / Math.PI; };
  const arrowsOf = (moves, main) => moves.map((m) => {
    const from = m.r.inline ? m.r.lead : m.r.line.cells[1] ?? m.r.line.cells[0];
    const cs = m.r.inline ? [from] : m.r.line.cells; const a = [cs.reduce((t, c) => t + pos(c)[0], 0) / cs.length, cs.reduce((t, c) => t + pos(c)[1], 0) / cs.length]; const q = DIRS[m.dir]; const step = [55 * (q[0] + q[1] / 2), -47 * q[1]];
    return { xy: [a[0] + step[0] * 0.62, a[1] + step[1] * 0.62], rot: Math.round(angle(m.dir)), main: main && (m === main || (m.marbles.join() === main.marbles.join() && m.dir === main.dir)), side: !m.r.inline, label: m.r.pushed.length ? 'هل دادن' : m.r.inline ? 'حرکت در امتداد خط' : 'حرکت از پهلو' };
  });
  const arrows = arrowsOf(groupMoves, pick);
  let sd = null;
  for (let seed = 1; seed < 600 && !sd; seed++) for (const n of [33, 37, 41]) {
    const p = play(seed, n); if (p.s.turn !== 'w') continue;
    const L = legalMoves(p.s.board, 'w');
    for (const size of [3, 2]) {
      const gs = L.filter((x) => x.marbles.length === size && !x.r.inline);
      for (const m of gs) {
        const same = L.filter((y) => y.marbles.length === size && y.marbles.every((c) => m.marbles.includes(c)));
        if (same.filter((y) => !y.r.inline).length >= 2 && same.some((y) => y.r.inline)) { sd = { p, m, same }; break; }
      }
      if (sd) break;
    }
    if (sd) break;
  }
  if (!sd) throw new Error('abalone: no side-step position');
  const sdArrows = arrowsOf(sd.same, sd.m);
  const sdLast = (() => { const l = sd.p.last; if (!l) return []; return l.r.inline ? [nb(l.r.lead, l.dir)] : l.r.line.cells.map((c) => nb(c, l.dir)); })();
  const lm = po.last; const lastMarks = lm ? (lm.r.inline ? [nb(lm.r.lead, lm.dir)] : lm.r.line.cells.map((c) => nb(c, lm.dir))) : [];

  const mini = (color, n) => `<span class="ga-mini" aria-label="${fa(n)} گوی بیرون‌انداخته از ۶">${Array.from({ length: n }, () => img(`abalone-${color}-marble`)).join('')}<b>${fa(n)} از ۶</b></span>`;
  const offB = S.off.b, offW = S.off.w; // marbles each colour has lost
  const css = `
.ab-board{block-size:calc(var(--b,572px) * 659 / 705);background-size:100% 100%;box-shadow:none;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35));direction:ltr}
.ab-layer{position:absolute;inset:0}
.ab-at{position:absolute;inline-size:6.9%;aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center}
.ab-at>img{grid-area:1/1;inline-size:100%;block-size:100%}
.ab-m>img:first-child{filter:drop-shadow(0 2px 1px rgba(0,0,0,.45))}
.ab-m.is-sel>img:first-child{filter:brightness(1.35) drop-shadow(0 2px 1px rgba(0,0,0,.45))}
.ab-m.is-sel>img+img{inline-size:112%;block-size:112%;filter:drop-shadow(0 0 3px rgba(255,60,60,.6))}
.ab-m.is-last::after,.ab-from::after{content:"";grid-area:1/1;inline-size:112%;block-size:112%;border-radius:50%;box-shadow:0 0 0 3px #E8A642}
.ab-from::after{inline-size:60%;block-size:60%;box-shadow:none;background:rgba(232,166,66,.55)}
.ab-m.is-push::after{content:"";grid-area:1/1;inline-size:118%;block-size:118%;border-radius:50%;border:2.5px dashed #FFB4A8;box-sizing:border-box}
.ab-arrow{inline-size:5.4%;z-index:3}
.ab-arrow>img{transform:rotate(var(--rot));opacity:.8}
.ab-arrow.is-main>img{opacity:1;filter:drop-shadow(0 0 4px rgba(255,255,255,.9))}
.ab-arrow.is-side>img{opacity:1;filter:hue-rotate(95deg) saturate(1.6) drop-shadow(0 0 3px rgba(143,209,158,.9))}
.ab-arrow.is-side.is-main>img{filter:hue-rotate(95deg) saturate(1.8) brightness(1.15) drop-shadow(0 0 5px rgba(255,255,255,.95))}
.cx-phone .cx-ms__m:nth-last-child(n+8){display:none}
.cx-phone .ab-board{--b:366px;align-self:center}
.cx-phone .ab-arrow{inline-size:6.6%}
`;
  const lastFrom = lm ? (lm.r.inline ? [lm.r.tail] : lm.r.line.cells) : [];
  const lastShown = [...lastMarks, ...lastFrom.filter((c) => !S.board[c])];

  const scoreCard = (st, rule) => `<section class="cx-card"><div class="ga-score" aria-label="گوی‌های بیرون‌انداخته"><span class="ga-score__p">${img('abalone-white-marble', 'سفید')}<span>مینا</span><b class="ga-score__n">${fa(st.s.off.b)}</b></span><span class="ga-score__vs">از ۶</span><span class="ga-score__p">${img('abalone-black-marble', 'سیاه')}<span>نیلوفر</span><b class="ga-score__n">${fa(st.s.off.w)}</b></span></div><div class="ga-rule">${ic('info')}<span>${rule}</span></div></section>`;
  return {
    slug: 'Abalone', fa: 'ابلون', latin: 'Abalone', board: 'abalone-board',
    meta: ['زنده', '۱۰ دقیقه', 'رتبه‌ای'], sideFa: ['سیاه', 'سفید'], notation: 'ردیف a تا i، قطر ۱ تا ۹',
    boardHtml, css,
    actions: `<div class="cx-actions">${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`, noDraw: true,
    
    note: (st, who) => (who === 'me' ? mini('black', st.s.off.b) : mini('white', st.s.off.w)),
    railCard: (st) => scoreCard(st, '<b>هل دادن فقط در امتداد خط و با برتری:</b> ۲ در برابر ۱، ۳ در برابر ۱ یا ۲. اولین کسی که ۶ گوی حریف را بیرون بیندازد می‌برد.'),
    turnSub: 'گروه انتخاب‌شده و پیکان‌ها',
    diffs: [
      ['صفحه', 'شش‌ضلعی ۶۱ خانه به جای ۸×۸؛ تصویر صفحه، گوی‌ها، حلقهٔ انتخاب و پیکان از بستهٔ آماده (BGA). صفحه کمی کوتاه‌تر از مربع است (نسبت ۷۰۵ به ۶۵۹)'],
      ['حرکت', 'دو مرحله: ۱ تا ۳ گوی هم‌خط را با زدن انتخاب کنید (حلقهٔ قرمز)، بعد یکی از پیکان‌ها را بزنید. فقط پیکان جهت‌های مجاز نشان داده می‌شود؛ گوی‌های حریف که هل می‌خورند حاشیهٔ قرمز دارند. پیکان حرکت از پهلو (همهٔ گروه با هم یک خانه کنار) سبز است و وسط گروه می‌نشیند (§۴)'],
      ['کنار اسم', `به جای مهره‌های گرفته‌شده، گوی‌هایی که از حریف بیرون انداخته‌اید و «n از ۶»؛ همین امتیاز در ستون کنار درشت آمده`],
      ['ثبت حرکت', 'نشانه‌گذاری استاندارد ابلون: ردیف a تا i (a لبهٔ سیاه) و قطر ۱ تا ۹. حرکت در امتداد خط با خانهٔ گوی آخر و مقصد گوی جلو (مثل c3c6)، حرکت از پهلو با دو سر گروه و مقصد سر اول (مثل c3c5d3)'],
      ['پایان', 'بیرون انداختن ۶ گوی حریف؛ سقف حرکت ندارد (تصمیم مالک). تسلیم و تمام شدن وقت هم بازی را تمام می‌کنند'],
      ['دکمه‌ها', 'موتور پیشنهاد مساوی ندارد، پس دکمهٔ «مساوی» حذف شده و فقط «تسلیم» مانده (در گوشی هم)'],
    ],
    st: {
      s: S, hist: po.hist, turnMe: true, clocks: { me: '6:12', opp: '5:40' },
      status: '<b>نوبت شماست.</b> سه گوی انتخاب شده؛ پیکانی را بزنید. با پیکان روشن دو گوی سیاه هل می‌خورند.',
      pstatus: '<b>نوبت شما.</b> پیکان روشن: هل دادن ۳ در برابر ۲',
      bo: { sel: group, caps: pick.r.pushed, arrows, last: lastShown },
    },
    phases: [
      { shotTitle: 'حرکت از پهلو', turnSub: `گروه ${fa(sd.m.marbles.length)}تایی، پیکان‌های سبز`, st: { s: sd.p.s, hist: sd.p.hist, turnMe: true, clocks: { me: '7:30', opp: '7:02' }, bo: { sel: sd.m.marbles, arrows: sdArrows, last: sdLast },
        status: `<b>نوبت شماست.</b> ${fa(sd.m.marbles.length)} گوی هم‌خط انتخاب شده؛ پیکان‌های سبز کل گروه را با هم یک خانه به کنار می‌برند، پیکان‌های سفید در امتداد خط.`,
        pstatus: '<b>نوبت شما.</b> سبز: حرکت از پهلو، سفید: در امتداد خط' },
        railCard: (st) => scoreCard(st, '<b>حرکت از پهلو:</b> همهٔ گوی‌های گروه با هم یک خانه به یک طرف می‌روند و همهٔ خانه‌های مقصد باید خالی باشند. از پهلو هل دادن ممکن نیست؛ هل فقط در امتداد خط است.'),
        phone: true },
    ],
  };
}
