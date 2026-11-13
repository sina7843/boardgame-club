// Group A game module: Go (repo games/go: 9×9 default, komi 7.5, area scoring, positional superko, black first).
// Board index = y * size + x, y 0 = top row as black sees it. Coordinates A–J (no I), rows 1–9 bottom-up.
import { tbl } from './_ui.mjs';
export default function (H) {
  const bd = (L) => L.map(([a, b]) => [a, b.replace(/«([A-Za-z0-9<>+\-:. ]+)»/g, '«<bdi dir="ltr">$1</bdi>»')]);
  const { img, fa, ic, esc, ART } = H;
  const N = 9, KOMI = 7.5;
  const COLS = 'ABCDEFGHJ';
  const name = (i) => COLS[i % N] + (N - Math.floor(i / N));
  const nb = (i) => { const x = i % N, y = Math.floor(i / N), o = []; if (x > 0) o.push(i - 1); if (x < N - 1) o.push(i + 1); if (y > 0) o.push(i - N); if (y < N - 1) o.push(i + N); return o; };
  const group = (b, i) => { const c = b[i], st = [], lib = new Set(), seen = new Set([i]), q = [i]; while (q.length) { const j = q.pop(); st.push(j); for (const n of nb(j)) { if (b[n] === null) lib.add(n); else if (b[n] === c && !seen.has(n)) { seen.add(n); q.push(n); } } } return { st, lib }; };
  const hash = (b) => b.map((s) => s ?? '.').join('');
  const other = (c) => (c === 'b' ? 'w' : 'b');
  // same as repo rules.ts play(): capture, suicide, positional superko
  function play(b0, at, c, seen) {
    if (b0[at] !== null) return null;
    const b = b0.slice(); b[at] = c; const cap = [];
    for (const n of nb(at)) if (b[n] === other(c)) { const g = group(b, n); if (!g.lib.size) for (const s of g.st) { b[s] = null; cap.push(s); } }
    if (!group(b, at).lib.size) return null;
    if (seen.has(hash(b))) return null;
    return { b, cap };
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  const isEye = (b, i, c) => nb(i).every((n) => b[n] === c);
  // light heuristic policy so the playout looks like a real game: local play, captures, saving ataris, no first line early
  function choose(st, R) {
    let best = null, bs = -1e9;
    for (let i = 0; i < N * N; i++) {
      if (st.b[i] !== null || isEye(st.b, i, st.turn)) continue;
      const r = play(st.b, i, st.turn, st.seen); if (!r) continue;
      const x = i % N, y = Math.floor(i / N), edge = Math.min(x, y, N - 1 - x, N - 1 - y);
      let sc = R() * 3 + r.cap.length * 9;
      let dmin = 99; st.b.forEach((p, j) => { if (p) dmin = Math.min(dmin, Math.abs((j % N) - x) + Math.abs(Math.floor(j / N) - y)); });
      if (st.ply < 10) sc += (edge === 2 ? 4 : edge === 3 ? 2 : -3) + (dmin >= 4 ? 4 : dmin >= 3 ? 2 : 0);
      else sc += dmin === 1 ? 1.5 : dmin === 2 ? 2 : dmin === 3 ? 0.5 : -1;
      if (edge === 0) sc -= st.ply < 30 ? 4 : 1;
      for (const n of nb(i)) if (r.b[n] === other(st.turn) && group(r.b, n).lib.size === 1) sc += 3; // atari
      if (group(r.b, i).lib.size === 1) sc -= 6; // self-atari
      for (const n of nb(i)) if (st.b[n] === st.turn && group(st.b, n).lib.size === 1) sc += 5; // save
      if (sc > bs) { bs = sc; best = { at: i, ...r }; }
    }
    return best;
  }
  let po = null;
  for (let seed = 1; seed < 3000 && !po; seed++) {
    const R = rng(seed);
    const st = { b: Array(N * N).fill(null), turn: 'b', seen: new Set(), ply: 0, caps: { b: 0, w: 0 }, hist: [], last: null };
    st.seen.add(hash(st.b));
    for (; st.ply < 64;) {
      const m = choose(st, R); if (!m) break;
      st.caps[st.turn] += m.cap.length; st.b = m.b; st.seen.add(hash(st.b));
      st.hist.push({ san: name(m.at) }); st.last = m; st.turn = other(st.turn); st.ply++;
      // stop on a ko: black just took one stone and white may not retake at once
      if (st.ply >= 36 && st.turn === 'w' && m.cap.length === 1 && !play(st.b, m.cap[0], 'w', st.seen) && play(st.b, m.cap[0], 'w', new Set())?.cap.length === 1 && st.caps.b >= 2 && st.caps.w >= 2) { po = st; break; }
    }
  }
  const s = po;
  const ko = s.last.cap[0];
  const ghost = choose({ ...s, ply: 99 }, rng(5)).at;
  const stones = (c) => s.b.filter((x) => x === c).length;

  const css = `
.go-board{align-self:center}
.go-board .ga-grid{inset:8.58% 8.57% 8.58% 8.70%}
.go-pt{position:relative;display:grid;place-items:center;min-inline-size:0;min-block-size:0}
.go-pt>img{position:absolute;inset:2%;inline-size:96%;block-size:96%;object-fit:contain}
.go-pt>.go-st{filter:drop-shadow(0 2px 1.5px rgba(0,0,0,.45))}
.go-pt>.go-ghost{opacity:.5;filter:none}
.go-pt>.go-mk{inset:22%;inline-size:56%;block-size:56%;z-index:2}
.go-pt>.go-ko{inset:28%;inline-size:44%;block-size:44%;z-index:2}
.go-pt.is-ko::before{content:"";position:absolute;inset:24%;border-radius:4px;background:rgba(250,245,236,.55);box-shadow:0 0 0 2px rgba(176,48,40,.55)}
.go-pt>.go-st.is-dead{opacity:.42}
.go-pt>.go-tr{inset:29%;inline-size:42%;block-size:42%;z-index:2;filter:drop-shadow(0 0 1px rgba(0,0,0,.7))}
.cx-phone .cx-ms__m:nth-last-child(n+9){display:none}
.go-acc{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.7;color:var(--text);background:rgba(76,140,90,.14);border-radius:var(--radius-sm);padding:8px 10px;margin-block:10px}
.go-acc .bgv-icon{flex:none;color:#3F8A55;margin-block-start:3px}
.go-pts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.go-pts>div{display:grid;gap:2px;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:10px 12px}
.go-pts span{font-size:13px;color:var(--text-muted)}
.go-pts b{font-size:22px;font-weight:900;color:var(--heading)}
.go-pts b small{font-size:13px;font-weight:700;color:var(--text-muted);margin-inline-start:6px}
.go-pts img{inline-size:18px;block-size:18px;vertical-align:-3px;margin-inline-end:6px}
`;

  // board size n (9 / 13 / 19): art and grid inset measured on the BGA gobans (first line minus half a step)
  const GB = { 9: { art: 'go-board-9', inset: '8.58% 8.57% 8.58% 8.70%' }, 13: { art: 'go-board-13c', inset: '8.33% 8.50% 8.23% 8.32%' }, 19: { art: 'go-board-19', inset: '4.36% 4.49% 4.55% 4.36%' } };
  const COLS19 = 'ABCDEFGHJKLMNOPQRST';
  const nameN = (i, n) => COLS19[i % n] + (n - Math.floor(i / n));
  // o: last, ko, ghost, dead (Set: stones marked dead), terr (Map index → 'b' | 'w')
  function boardHtml(g, st, o = {}) {
    const n = st.n ?? N; const cells = [];
    for (let i = 0; i < n * n; i++) {
      const p = st.b[i]; let inner = ''; const dead = o.dead?.has(i);
      if (p) inner += `<img class="go-st${dead ? ' is-dead' : ''}" src="${ART[p === 'b' ? 'go-black' : 'go-white']}" alt="${p === 'b' ? 'سنگ سیاه' : 'سنگ سفید'} ${nameN(i, n)}${dead ? '، مرده' : ''}">`;
      if (o.terr?.has(i)) inner += `<img class="go-tr" src="${ART[o.terr.get(i) === 'b' ? 'go-terr-black' : 'go-terr-white']}" alt="">`;
      if (i === o.ghost) inner += `<img class="go-st go-ghost" src="${ART['go-white']}" alt="">`;
      if (o.last === i) inner += `<img class="go-mk" src="${ART['go-last']}" alt="حرکت آخر">`;
      if (o.ko === i) inner += `<img class="go-ko" src="${ART['go-ko']}" alt="کو: فعلاً ممنوع">`;
      cells.push(`<span class="go-pt${o.ko === i ? ' is-ko' : ''}">${inner}</span>`);
    }
    return `<div class="ga-board go-board" style="--img:url(${ART[GB[n].art]});--n:${n};${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="صفحهٔ گو ${fa(n)}×${fa(n)}"><div class="ga-grid" style="inset:${GB[n].inset}">${cells.join('')}</div></div>`;
  }

  // me = white (second player), opponent = black
  const note = (st, who) => {
    const caps = st.s.caps ?? { b: 0, w: 0 };
    const k = who === 'me' ? caps.w : caps.b; const c = who === 'me' ? 'go-black' : 'go-white';
    return `<span class="ga-mini" aria-label="${fa(k)} سنگ اسیر">${Array.from({ length: Math.min(k, 6) }, () => img(c)).join('')}<b>${fa(k)} اسیر</b></span>`;
  };
  const kfa = (v) => fa(String(v));

  // ---- §4–§5 counting: hand-built finished 9×9 game (rows top → bottom); one dead stone on each side ----
  const ROWS = ['....bw...', '....bw..w', '...bbw...', '...bwww.b', '..bbw....', '...bww...', '...bbww..', '...wbbw..', '.....bw..'];
  const fb = ROWS.join('').split('').map((x) => (x === '.' ? null : x));
  const DEAD = new Set([3 * 9 + 8, 7 * 9 + 3]); // black on J6 inside white's area, white on D2 inside black's
  const alive = fb.map((p, i) => (DEAD.has(i) ? null : p));
  const nbN = (i, n) => { const x = i % n, y = Math.floor(i / n), o = []; if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1); if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n); return o; };
  const terr = new Map(); const seenT = new Set();
  for (let i = 0; i < 81; i++) {
    if (alive[i] || seenT.has(i)) continue;
    const reg = [], by = new Set(), q = [i]; seenT.add(i);
    while (q.length) { const j = q.pop(); reg.push(j); for (const k of nbN(j, 9)) { if (alive[k]) by.add(alive[k]); else if (!seenT.has(k)) { seenT.add(k); q.push(k); } } }
    if (by.size === 1) { const c = [...by][0]; for (const j of reg) terr.set(j, c); }
  }
  const cnt = (c) => ({ st: alive.filter((x) => x === c).length, tr: [...terr.values()].filter((x) => x === c).length });
  const SB = cnt('b'), SW = cnt('w'); const totB = SB.st + SB.tr, totW = SW.st + SW.tr + KOMI;
  if (!(totW > totB)) throw new Error('go mock: white should win ' + totB + ' ' + totW);
  const stonesOf = (c) => fb.map((p, i) => (p === c ? i : -1)).filter((i) => i >= 0);
  const bl = stonesOf('b'), wh = stonesOf('w'); const histEnd = [];
  for (let k = 0; k < Math.max(bl.length, wh.length); k++) { histEnd.push({ san: bl[k] !== undefined ? name(bl[k]) : 'pass' }); histEnd.push({ san: wh[k] !== undefined ? name(wh[k]) : 'pass' }); }
  histEnd.push({ san: 'pass' }, { san: 'pass' });
  const endCaps = { b: 2, w: 3 };
  const scoreCard = (accepted) => `<section class="cx-card"><h3>شمارش</h3><div class="go-pts"><div><span>${img('go-black')}نیلوفر</span><b>${kfa(totB)}</b><span>سنگ ${fa(SB.st)} + قلمرو ${fa(SB.tr)}</span></div><div><span>${img('go-white')}شما</span><b>${kfa(totW)}</b><span>سنگ ${fa(SW.st)} + قلمرو ${fa(SW.tr)} + کومی ${kfa(KOMI)}</span></div></div>${accepted ? `<div class="go-acc">${ic('check')}<span><b>نیلوفر قبول کرد.</b> اگر شما هم قبول کنید بازی تمام می‌شود.</span></div>` : ''}<div class="ga-rule">${ic('info')}<span>روی هر گروه بزنید تا مرده یا زنده شود؛ هر کلیک فقط همان رشتهٔ سنگ را عوض می‌کند. با هر تغییر، قبولِ هر دو نفر پاک می‌شود. «ادامهٔ بازی» شمارش را لغو می‌کند و نوبت به حریف شما می‌رسد.</span></div></section>`;

  // ---- §6–§7 larger boards on phone: openings replayed from a move list ----
  function opening(n, moves) {
    const b = Array(n * n).fill(null); const hist = [];
    moves.forEach(([x, y], k) => { const i = y * n + x; if (b[i]) throw new Error('go opening: occupied'); b[i] = k % 2 ? 'w' : 'b'; hist.push({ san: nameN(i, n) }); });
    return { b, hist, n, last: moves.at(-1)[1] * n + moves.at(-1)[0], caps: { b: 0, w: 0 } };
  }
  const o13 = opening(13, [[3, 9], [9, 3], [9, 9], [3, 3], [2, 5], [5, 2], [10, 6], [6, 10], [9, 11], [8, 2], [3, 11], [10, 4], [7, 9]]);
  const o19 = opening(19, [[15, 3], [3, 15], [15, 15], [3, 3], [16, 9], [13, 16], [9, 16], [16, 13], [14, 14], [5, 2], [2, 5], [9, 3], [12, 2], [3, 9], [13, 4], [6, 16], [16, 16]]);

  return {
    slug: 'Go', fa: 'گو', latin: 'Go', meta: ['زنده', '۹×۹', 'رتبه‌ای'], sideFa: ['سیاه', 'سفید'], notation: 'ستون A تا J (بدون I)، ردیف ۱ تا ۹',
    boardHtml, css, note,
    railCard: () => `<section class="cx-card"><div class="go-pts"><div><span>کومی سفید</span><b>${fa(KOMI)}</b></div><div><span>سنگ روی صفحه</span><b>${img('go-black')}${fa(stones('b'))}<small>${img('go-white')}${fa(stones('w'))}</small></b></div></div><div class="ga-rule">${ic('info')}<span><b>کو:</b> سنگی که همین الان گرفته شد را نمی‌شود فوراً پس گرفت؛ نقطه‌اش ضربدر دارد. اول جای دیگری بازی کنید. دو پاس پشت سر هم بازی را به شمارش می‌برد.</span></div></section>`,
    dockItems: [['more', 'گزینه‌ها'], ['next', 'پاس'], ['flag', 'تسلیم'], ['list', 'قوانین']],
    actions: `<div class="cx-actions">${H.btn('پاس', 'secondary', 'next')}${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    turnSub: 'کو و پاس',
    diffs: bd([
      ['صفحه', 'گوبان ۹×۹ (پیش‌فرض موتور) از بستهٔ آماده (BGA)؛ فقط بخش بازی و نوار مختصات بریده شده. ۱۳×۱۳ و ۱۹×۱۹ در گوشی (§۶ و §۷). سنگ‌ها روی تقاطع خط‌ها می‌نشینند، نه داخل خانه'],
      ['حرکت', 'روی هر تقاطع خالی بزنید؛ سنگ کم‌رنگ پیش‌نمایش جای نشانگر است. نقطهٔ کو با مربع توخالی قرمز (هم‌رنگ و هم‌ضخامت حلقهٔ حرکت آخر) قفل است و حلقهٔ قرمز حرکت آخر را نشان می‌دهد'],
      ['کنار اسم و ستون', 'به جای مهره‌های گرفته‌شده، شمار سنگ‌های اسیر حریف. در ستون کنار: کارت کومی (۷٫۵ برای سفید) و شمار سنگ‌های روی صفحه، با یادآوری قانون کو و پاس'],
      ['دکمه‌ها', 'به جای «مساوی»، «پاس»؛ گو پیشنهاد مساوی ندارد. بعد از دو پاس مرحلهٔ شمارش می‌آید (§۴): سنگ مرده کم‌رنگ، قلمرو با مربع کوچک هم‌رنگ، «قبول» و «ادامهٔ بازی»'],
      ['ثبت حرکت', 'مختصات تقاطع مثل «E5» و «pass»؛ ردیف‌ها از پایین شمرده می‌شوند و حرف I نداریم'],
      ['پایان', 'شمارش منطقه‌ای: سنگ زنده + قلمرو، به‌علاوهٔ کومی برای سفید؛ اسیرها جدا شمرده نمی‌شوند (§۵). وقت نوبت که تمام شود پاس خودکار است'],
    ]),
    st: {
      s, hist: s.hist, turnMe: true, clocks: { me: '4:12', opp: '3:40' },
      status: `<b>نوبت شماست.</b> سیاه با ${s.hist.at(-1).san} یک سنگ گرفت و ${name(ko)} کو است؛ اول جای دیگری بازی کنید.`,
      pstatus: `<b>نوبت شما.</b> ${name(ko)} کو است، جای دیگری بازی کنید.`,
      bo: { last: s.last.at, ko, ghost },
    },
    phases: [
      { shotTitle: 'شمارش', turnSub: 'بعد از دو پاس: سنگ مرده، قلمرو، قبول', st: { s: { b: fb, caps: endCaps }, hist: histEnd, turnMe: true, clocks: { me: '1:50', opp: '1:21' }, bo: { dead: DEAD, terr },
          status: `<b>شمارش.</b> هر دو پاس دادید. سنگ ${name(3 * 9 + 8)} سیاه و ${name(7 * 9 + 3)} سفید مرده علامت خورده‌اند. نیلوفر قبول کرد؛ نوبت قبول شماست.`,
          pstatus: '<b>شمارش.</b> نیلوفر قبول کرد؛ قبول یا ادامه' },
        railCard: () => scoreCard(true),
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('قبول', 'primary', 'check')}${H.btn('ادامهٔ بازی', 'secondary', 'repeat')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['check', 'قبول'], ['repeat', 'ادامهٔ بازی'], ['list', 'قوانین']],
        phone: true },
      { shotTitle: 'پایان بازی', turnSub: 'سنگ + قلمرو + کومی', st: { s: { b: alive, caps: { b: endCaps.b + 1, w: endCaps.w + 1 } }, hist: histEnd, turnMe: false, clocks: { me: '1:44', opp: '1:21' }, bo: { terr },
          status: `<b>بازی تمام شد.</b> شما با ${kfa(totW)} در برابر ${kfa(totB)} بردید.`, pstatus: `<b>شما بردید،</b> ${kfa(totW)} در برابر ${kfa(totB)}` },
        railCard: () => scoreCard(false),
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('بازی دوباره', 'primary', 'repeat')}${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        overlay: () => H.modal(`شما بردید با ${kfa(totW - totB)} امتیاز`, `<p>هر دو نفر شمارش را قبول کردید. سنگ‌های مرده برداشته شدند و شمارش منطقه‌ای است: سنگ زنده به‌علاوهٔ نقطه‌های خالی محصور.</p>${tbl(['بازیکن', 'سنگ', 'قلمرو', 'کومی', 'جمع'], [{ c: ['شما (سفید)', fa(SW.st), fa(SW.tr), kfa(KOMI), kfa(totW)], win: true }, { c: ['نیلوفر (سیاه)', fa(SB.st), fa(SB.tr), '۰', kfa(totB)] }])}<p class="cx-note">اسیرها جدا شمرده نمی‌شوند. کومی نیم دارد، پس مساوی پیش نمی‌آید.</p>`, `${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
      { shotTitle: 'صفحهٔ ۱۳×۱۳ در گوشی', turnSub: 'همان قوانین، صفحهٔ بزرگ‌تر', meta: ['زنده', '۱۳×۱۳', 'رتبه‌ای'], phone: true, phoneOnly: true,
        st: { s: o13, hist: o13.hist, turnMe: true, clocks: { me: '9:20', opp: '9:05' }, bo: { last: o13.last }, status: '', pstatus: '<b>نوبت شما.</b> صفحهٔ ۱۳×۱۳' } },
      { shotTitle: 'صفحهٔ ۱۹×۱۹ در گوشی', turnSub: 'تقاطع‌ها ریزند: اول پیش‌نمایش، بعد گذاشتن', meta: ['زنده', '۱۹×۱۹', 'رتبه‌ای'], phone: true, phoneOnly: true,
        st: { s: o19, hist: o19.hist, turnMe: true, clocks: { me: '18:40', opp: '18:12' }, bo: { last: o19.last, ghost: 12 * 19 + 12 }, status: '', pstatus: '<b>نوبت شما.</b> سنگ کم‌رنگ پیش‌نمایش است؛ دوباره بزنید تا گذاشته شود' } },
    ],
  };
}
