// Group A game module: Tak (repo games/tak: 5×5 default = 21 stones + 1 capstone each, white first, first turn places
// the opponent's flat; carry limit = board size; a lone capstone flattens a wall on its last drop; road wins, else top flats).
// Board: index = r * size + c, r 0 = bottom (white's side, rank 1), c 0 = file a. Not flipped for black: Tak has no forward direction.
export default function (H) {
  const bd = (L) => L.map(([a, b]) => [a, b.replace(/«([A-Za-z0-9<>+\-:. ]+)»/g, '«<bdi dir="ltr">$1</bdi>»')]);
  const { img, fa, ic, ART } = H;
  const N = 5, PIECES = { stones: 21, caps: 1 };
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const top = (st) => st[st.length - 1];
  const sqn = (i) => 'abcde'[i % N] + (Math.floor(i / N) + 1);
  const DIRS = { n: [1, 0, '+'], s: [-1, 0, '-'], e: [0, 1, '>'], w: [0, -1, '<'] };
  const step = (i, d) => { const r = Math.floor(i / N) + DIRS[d][0], c = (i % N) + DIRS[d][1]; return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : null; };
  function moveOk(b, color, from, dir, drops) { // = repo moveOk
    const stack = b[from]; const lift = drops.reduce((a, x) => a + x, 0);
    if (!stack.length || top(stack).c !== color || lift > N || lift > stack.length) return false;
    const carried = stack.slice(stack.length - lift); let at = from;
    for (let k = 0; k < drops.length; k++) {
      const nx = step(at, dir); if (nx === null) return false;
      const t = top(b[nx]);
      if (t?.t === 'C') return false;
      if (t?.t === 'S' && !(k === drops.length - 1 && drops[k] === 1 && carried[carried.length - 1].t === 'C')) return false;
      at = nx;
    }
    return true;
  }
  const parts = (n) => (n === 0 ? [[]] : Array.from({ length: n }, (_, k) => k + 1).flatMap((d) => parts(n - d).map((r) => [d, ...r])));
  function allMoves(b, color) {
    const out = [];
    for (let from = 0; from < N * N; from++) { const st = b[from]; if (!st.length || top(st).c !== color) continue;
      for (let lift = 1; lift <= Math.min(st.length, N); lift++) for (const dir of 'nsew') for (const drops of parts(lift)) if (moveOk(b, color, from, dir, drops)) out.push({ t: 'move', from, dir, drops }); }
    return out;
  }
  function road(b, color) {
    const owns = (i) => { const t = top(b[i]); return !!t && t.c === color && t.t !== 'S'; };
    const reach = (starts, goal) => { const seen = new Set(starts.filter(owns)); const q = [...seen]; while (q.length) { const i = q.shift(); if (goal(i)) return true; for (const d of 'nsew') { const j = step(i, d); if (j !== null && owns(j) && !seen.has(j)) { seen.add(j); q.push(j); } } } return false; };
    const ix = [0, 1, 2, 3, 4];
    return reach(ix, (i) => Math.floor(i / N) === N - 1) || reach(ix.map((r) => r * N), (i) => i % N === N - 1);
  }
  const flats = (b) => { const n = { w: 0, b: 0 }; for (const st of b) { const t = top(st); if (t?.t === 'F') n[t.c]++; } return n; };
  function apply(s, a) {
    const b = s.b.map((x) => x.map((y) => ({ ...y }))); const res = { w: { ...s.res.w }, b: { ...s.res.b } }; let san;
    if (a.t === 'place') {
      const color = s.ply < 2 ? other(s.turn) : s.turn;
      if (a.kind === 'C') res[color].caps--; else res[color].stones--;
      b[a.at] = [{ c: color, t: a.kind }]; san = (a.kind === 'F' ? '' : a.kind) + sqn(a.at);
    } else {
      const lift = a.drops.reduce((x, y) => x + y, 0); const carried = b[a.from].splice(b[a.from].length - lift, lift); let at = a.from;
      for (const d of a.drops) { at = step(at, a.dir); const t = top(b[at]); if (t?.t === 'S') t.t = 'F'; b[at].push(...carried.splice(0, d)); }
      san = `${lift > 1 ? lift : ''}${sqn(a.from)}${DIRS[a.dir][2]}${a.drops.length > 1 ? a.drops.join('') : ''}`;
    }
    return { s: { b, res, turn: other(s.turn), ply: s.ply + 1 }, san };
  }
  function legal(s) {
    const out = []; const me = s.ply < 2 ? other(s.turn) : s.turn;
    s.b.forEach((st, i) => { if (st.length) return; if (s.res[me].stones > 0) { out.push({ t: 'place', at: i, kind: 'F' }); if (s.ply >= 2) out.push({ t: 'place', at: i, kind: 'S' }); } if (s.ply >= 2 && s.res[me].caps > 0) out.push({ t: 'place', at: i, kind: 'C' }); });
    if (s.ply >= 2) out.push(...allMoves(s.b, s.turn));
    return out;
  }
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  const pickW = (L, R, s) => { // weighted: mostly flats and moves, a few walls, capstone mid-game
    const w = L.map((m) => (m.t === 'move' ? (m.drops.length > 1 ? 1.2 : 0.6) * (s.b[m.from].length > 1 ? 2 : 1) : m.kind === 'F' ? 1 : m.kind === 'S' ? 0.08 : s.ply > 10 ? 0.1 : 0));
    let t = R() * w.reduce((a, x) => a + x, 0); for (let k = 0; k < L.length; k++) { t -= w[k]; if (t <= 0) return L[k]; } return L[0];
  };
  let po = null;
  for (let seed = 1; seed < 4000 && !po; seed++) {
    const R = rng(seed); let s = { b: Array.from({ length: N * N }, () => []), res: { w: { ...PIECES }, b: { ...PIECES } }, turn: 'w', ply: 0 }; const hist = []; let last = null, dead = false;
    while (s.ply < 23) { const L = legal(s); const m = pickW(L, R, s); const r = apply(s, m); s = r.s; hist.push({ san: r.san }); last = m; if (road(s.b, 'w') || road(s.b, 'b') || s.b.every((x) => x.length)) { dead = true; break; } }
    if (dead || s.turn !== 'b') continue;
    const all = s.b.flat();
    const tall = s.b.map((st, i) => ({ i, st })).filter(({ st }) => st.length >= 3 && top(st).c === 'b' && top(st).t === 'F');
    if (!tall.length || !all.some((x) => x.t === 'S') || !all.some((x) => x.t === 'C' && x.c === 'w') || last.t !== 'move') continue;
    const sel = tall.sort((a, b) => b.st.length - a.st.length)[0].i;
    const mv = allMoves(s.b, 'b').filter((m) => m.from === sel);
    const dirs = new Set(mv.map((m) => m.dir));
    if (dirs.size < 3) continue;
    po = { s, hist, last, sel, mv };
  }
  const { s, hist, last, sel, mv } = po;
  const selH = s.b[sel].length; const lift = Math.min(3, selH);
  const reach = new Set(); for (const m of mv.filter((x) => x.drops.reduce((a, y) => a + y, 0) === lift)) { let at = sel; for (const _ of m.drops) { at = step(at, m.dir); reach.add(at); } }
  const lastSq = (() => { if (last.t === 'place') return [last.at]; const o = [last.from]; let at = last.from; for (const _ of last.drops) { at = step(at, last.dir); o.push(at); } return o; })();
  const f = flats(s.b);

  const css = `
.tak-board{align-self:center}
.tak-board .ga-grid{inset:5.75%}
.tak-sq{position:relative;min-inline-size:0;min-block-size:0;margin:3%;border-radius:8px}
.tak-sq.is-last{box-shadow:inset 0 0 0 3px rgba(232,166,66,.7);background:rgba(232,166,66,.16)}
.tak-sq.is-sel{box-shadow:inset 0 0 0 3px #E8A642;background:rgba(232,166,66,.32)}
.tak-sq.is-dot::after{content:"";position:absolute;z-index:3;inset:40%;border-radius:50%;background:rgba(250,245,236,.7);box-shadow:0 0 0 2px rgba(0,0,0,.2)}
.tak-sq.is-dot.has-st::after{inset:auto 6% 6% auto;inline-size:18%;block-size:18%}
.tak-st{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:contain;filter:drop-shadow(0 2px 1px rgba(0,0,0,.4));transform:translateY(calc(var(--k) * -9%))}
.tak-st.is-lift{transform:translateY(calc(var(--k) * -9% - 16%));filter:drop-shadow(0 8px 4px rgba(0,0,0,.45))}
.tak-h{position:absolute;z-index:4;inset-block-start:4%;inset-inline-start:4%;min-inline-size:22px;block-size:22px;padding-inline:6px;border-radius:11px;background:rgba(20,43,59,.86);color:#FAF5EC;font:800 13px/22px var(--font-latin);text-align:center;box-sizing:border-box}
.cx-phone .tak-h{min-inline-size:16px;block-size:16px;font-size:10px;line-height:16px;border-radius:8px;padding-inline:4px}
.tak-tools{display:flex;gap:10px;align-items:center;justify-content:center;inline-size:var(--b,572px);direction:rtl;flex:none;align-self:center}
.cx-phone .tak-tools{--b:366px;gap:6px}
.tak-seg{display:flex;gap:2px;background:rgba(0,0,0,.22);border-radius:10px;padding:3px;align-items:center}
.tak-seg>span{font-size:13px;color:var(--felt-muted);padding-inline:8px 4px}
.tak-seg button{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--felt-text,#FAF5EC);font:700 13px var(--font-body);border-radius:8px;padding:5px 9px;cursor:pointer}
.tak-seg button img{inline-size:22px;block-size:22px;object-fit:contain}
.tak-seg button.is-on{background:#FAF5EC;color:#142B3B}
.tak-seg button[disabled]{opacity:.4}
.cx-phone .tak-seg button{padding:4px 6px;font-size:12px}
.cx-phone .tak-seg button img{inline-size:16px;block-size:16px}
.cx-phone .tak-seg>span{font-size:12px;padding-inline:4px 2px}
.tak-sq.is-flat{box-shadow:inset 0 0 0 3px #F0AAA3;background:rgba(240,170,163,.22)}
.tak-flat{position:absolute;z-index:4;inset-block-end:4%;inset-inline:0;margin-inline:auto;inline-size:max-content;padding:2px 7px;border-radius:999px;background:#8A2E22;color:#FFF3EF;font:800 11.5px/1.5 var(--font-body);font-style:normal}
.cx-phone .cx-ms__m:nth-last-child(n+9){display:none}
.cx-phone .tak-flat{font-size:9px;padding:1px 4px}
.tak-seg button[disabled] img{filter:grayscale(1)}
.tak-sc{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tak-sc>div{display:grid;gap:4px;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 12px;font-size:13px;color:var(--text-muted)}
.tak-sc b{font-size:22px;font-weight:900;color:var(--heading);display:flex;align-items:center;gap:6px}
.tak-sc img{inline-size:26px;block-size:26px;object-fit:contain}
.tak-res{display:inline-flex;align-items:center;gap:4px}
.tak-res img{inline-size:18px;block-size:18px;object-fit:contain}
.tak-res b{font-size:12.5px;color:var(--felt-muted);font-weight:700}
`;
  const stoneArt = (x) => `tak-${x.c}-${x.t}`;
  // st = { b, res, n? }: n = board size (default 5); o: last, sel, dots (Set), flat (square a lone capstone can flatten), lift
  function boardHtml(g, st, o = {}) {
    const n = st.n ?? N; const cells = [];
    for (let r = n - 1; r >= 0; r--) for (let c = 0; c < n; c++) {
      const i = r * n + c; const stack = st.b[i]; const cls = ['tak-sq'];
      if (o.last?.includes(i)) cls.push('is-last'); if (o.sel === i) cls.push('is-sel'); if (o.dots?.has(i)) cls.push('is-dot'); if (o.flat === i) cls.push('is-flat'); if (stack.length) cls.push('has-st');
      const vis = stack.slice(-4); const lifted = o.sel === i ? (o.lift ?? 0) : 0;
      const imgs = vis.map((x, k) => `<img class="tak-st${k >= vis.length - lifted ? ' is-lift' : ''}" style="--k:${k}" src="${ART[stoneArt(x)]}" alt="${x.c === 'w' ? 'سفید' : 'سیاه'}، ${x.t === 'F' ? 'تخت' : x.t === 'S' ? 'دیوار' : 'سرستون'}">`).join('');
      cells.push(`<span class="${cls.join(' ')}">${imgs}${stack.length > 1 ? `<i class="tak-h" aria-label="ارتفاع ${fa(stack.length)}">${fa(stack.length)}</i>` : ''}${o.flat === i ? '<i class="tak-flat">خواباندن</i>' : ''}</span>`);
    }
    return `<div class="ga-board tak-board" style="--img:url(${ART[`tak-board-${n}`]});--n:${n};${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="صفحهٔ تاک ${fa(n)}×${fa(n)}"><div class="ga-grid">${cells.join('')}</div></div>`;
  }
  // tool bar under the board; t = { color, kinds: on kind, off: [kinds disabled], lift: [height, chosen] | null, hint }
  const tools = (t) => {
    const k = (kind, label) => `<button type="button"${t.kind === kind ? ' class="is-on"' : ''}${t.off?.includes(kind) ? ' disabled' : ''}>${img(`tak-${t.color}-${kind}`)}${label}</button>`;
    return `<div class="tak-tools" role="toolbar" aria-label="نوع سنگ و تعداد برداشتن"><div class="tak-seg" role="group" aria-label="گذاشتن">${k('F', 'تخت')}${k('S', 'دیوار')}${k('C', 'سرستون')}</div>${t.lift ? `<div class="tak-seg" role="group" aria-label="برداشتن از پشته"><span>برداشتن</span>${Array.from({ length: t.lift[0] }, (_, j) => `<button type="button"${j + 1 === t.lift[1] ? ' class="is-on"' : ''}>${fa(j + 1)}</button>`).join('')}</div>` : ''}${t.hint ? `<div class="tak-seg"><span>${t.hint}</span></div>` : ''}</div>`;
  };
  const feltExtra = (st) => tools(st.bo.tools ?? { color: 'b', kind: 'F', lift: [Math.min(selH, N), lift] });
  const resOf = (st, c) => `<span class="tak-res">${img(`tak-${c}-F`)}<b>${fa(st.s.res[c].stones)}</b>${img(`tak-${c}-C`)}<b>${fa(st.s.res[c].caps)}</b></span>`;
  const flatCard = (st, rule) => { const fl = flats(st.s.b); return `<section class="cx-card"><div class="tak-sc"><div>سنگ تخت رو<b>${img('tak-b-F')}${fa(fl.b)}<span style="font-size:14px;color:var(--text-muted)">شما</span></b></div><div>سنگ تخت رو<b>${img('tak-w-F')}${fa(fl.w)}<span style="font-size:14px;color:var(--text-muted)">نیلوفر</span></b></div></div><div class="ga-rule">${ic('info')}<span>${rule}</span></div></section>`; };
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, k) => `<th${k ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, k) => `<td${k ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const STOCK = { 4: { stones: 15, caps: 0 }, 5: { stones: 21, caps: 1 }, 6: { stones: 30, caps: 1 } };
  // hand-built position: rows top (last rank) → bottom, each square 'bF,wS' bottom→top or '.'
  function mk(n, rows) {
    const b = Array.from({ length: n * n }, () => []);
    rows.forEach((row, k) => { const r = n - 1 - k; row.trim().split(/\s+/).forEach((sq, c) => { if (sq !== '.') b[r * n + c] = sq.split(',').map((x) => ({ c: x[0], t: x[1] })); }); });
    const res = {}; for (const c of 'wb') { const all = b.flat().filter((x) => x.c === c); res[c] = { stones: STOCK[n].stones - all.filter((x) => x.t !== 'C').length, caps: STOCK[n].caps - all.filter((x) => x.t === 'C').length }; if (res[c].stones < 0 || res[c].caps < 0) throw new Error('tak mock reserve'); }
    return { b, res, n };
  }
  const sqOf = (n, name) => (Number(name.slice(1)) - 1) * n + 'abcdef'.indexOf(name[0]);
  const roadN = (p, color) => { const n = p.n; const owns = (i) => { const t = top(p.b[i]); return !!t && t.c === color && t.t !== 'S'; }; const nb = (i) => [i + n, i - n, i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < n * n); const reach = (starts, goal) => { const seen = new Set(starts.filter(owns)); const q = [...seen]; while (q.length) { const i = q.shift(); if (goal(i)) return true; for (const j of nb(i)) if (owns(j) && !seen.has(j)) { seen.add(j); q.push(j); } } return false; }; const ix = [...Array(n).keys()]; return reach(ix, (i) => Math.floor(i / n) === n - 1) || reach(ix.map((r) => r * n), (i) => i % n === n - 1); };

  // §4 first turn: Niloufar (white) put one of YOUR flats on c3; now you place one of HER flats
  const p1 = mk(5, ['. . . . .', '. . . . .', '. . bF . .', '. . . . .', '. . . . .']); 
  const empt1 = new Set(p1.b.map((x, i) => (x.length ? -1 : i)).filter((i) => i >= 0));
  // §5 a lone capstone next to a wall: east flattens the white wall on d3
  const p2 = mk(5, ['. wF . bF,wF,bF .', 'wF . wF wF,bF,bF,wF .', 'bF . bC wS .', '. bF bF . wF', 'wF . wC bF .']);
  const c3 = sqOf(5, 'c3');
  // §6 6×6: 30 stones + 1 capstone each, carry limit 6
  const p6 = mk(6, ['. . wF . . .', '. bF wF,bF bS . wF', 'wF bF,bF,wF bC wF,bF . .', '. wS bF wF,wF,bF,bF wC .', '. . bF . wF .', 'bF . . wF . .']);
  const sel6 = sqOf(6, 'd3'), dots6 = new Set(['d4', 'd2', 'd1', 'c3'].map((x) => sqOf(6, x)));
  // §7 4×4 on phone: 15 stones, no capstone
  const p4 = mk(4, ['bF wF . bF', 'wF bF,wF . wF', '. bS bF wF', 'bF . wF .']);
  const hist4 = ['a1', 'd2', 'c1', 'c2', 'b4', 'd4', 'a3', 'b3', 'c3', 'Sb2', 'c3<', 'a4', 'd3'].map((san) => ({ san }));
  // §8 board full, no road: flats are counted (you 11, Niloufar 10)
  const pEnd = mk(5, ['bF wF bF wS bF', 'wF bF wF bF wF', 'bF wF wF,bF,bC wF bF', 'wF bF wS bF,wF,bF wF', 'bF wF bF wF bS']);
  if (roadN(p4, 'w') || roadN(p4, 'b') || roadN(pEnd, 'w') || roadN(pEnd, 'b') || roadN(p2, 'w') || roadN(p2, 'b') || roadN(p6, 'w') || roadN(p6, 'b')) throw new Error('tak mock has a road');
  const fEnd = flats(pEnd.b); const topsOf = (c, k) => pEnd.b.filter((x) => top(x)?.c === c && top(x).t === k).length;
  const pl = (st) => st;
  const sizeRule = `<b>اندازهٔ صفحه را میز انتخاب می‌کند.</b> ۴×۴: ۱۵ سنگ بی‌سرستون؛ ۵×۵: ۲۱ سنگ و ۱ سرستون؛ ۶×۶: ۳۰ سنگ و ۱ سرستون. حد برداشتن همان عرض صفحه است.`;

  return {
    slug: 'Tak', fa: 'تاک', latin: 'Tak', meta: ['زنده', '۵×۵', 'رتبه‌ای'], sideFa: ['سفید', 'سیاه'], notation: 'نشانه‌گذاری PTN',
    boardHtml, feltExtra, css,
    note: (st, who) => resOf(st, who === 'me' ? 'b' : 'w'),
    railCard: (st) => flatCard(st, `<b>جاده</b> دو لبهٔ روبه‌رو را با سنگ تخت یا سرستون خودتان وصل می‌کند. از پشته‌ای که رویش مال شماست تا ${fa(st.s.n ?? N)} سنگ برمی‌دارید و در یک خط، روی هر خانه دست‌کم یکی می‌گذارید. دیوار و سرستون مسدودند؛ فقط سرستون تنها دیوار را می‌خواباند.`),
    noDraw: true,
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    turnSub: 'جابه‌جایی پشته',
    diffs: bd([
      ['صفحه', '۵×۵ (پیش‌فرض موتور: ۲۱ سنگ و ۱ سرستون برای هر نفر) از بستهٔ آماده؛ ۶×۶ در §۶ و ۴×۴ در §۷. صفحه برای سیاه برنمی‌گردد چون تاک جهت جلو ندارد'],
      ['پشته', 'سنگ‌ها روی هم می‌روند؛ چهار سنگ بالایی کمی بالاتر از هم دیده می‌شوند و عدد گوشهٔ خانه ارتفاع کل پشته است. صاحب پشته = صاحب سنگ بالایی'],
      ['حرکت', 'روی خانهٔ خالی سنگ بگذارید (نوع سنگ از نوار زیر صفحه: تخت، دیوار، سرستون) یا پشتهٔ خودتان را انتخاب کنید، تعداد «برداشتن» را بزنید و خانه‌های نقطه‌دار را در یک خط پشت سر هم بزنید. دیواری که سرستون تنها در قدم آخر می‌خواباند نشانهٔ «خواباندن» دارد (§۵)'],
      ['کنار اسم و ستون', 'به جای مهره‌های گرفته‌شده، سنگ و سرستون باقی‌ماندهٔ هر نفر در ذخیره. در ستون کنار: شمار سنگ‌های تخت رو (برای پایان با شمارش) و یادآوری جاده و حد برداشتن'],
      ['دکمه‌ها', 'فقط «تسلیم»؛ موتور پیشنهاد مساوی ندارد. نوار نوع سنگ و برداشتن به میز اضافه شده است؛ در اولین نوبت فقط «تخت» با رنگ حریف روشن است (§۴)'],
      ['ثبت حرکت', 'به روش PTN: «c3» تخت، «Sc3» دیوار، «Cc3» سرستون، «3c3>12» یعنی سه سنگ از c3 به راست، یکی و بعد دو تا'],
    ]),
    st: {
      s, hist, turnMe: true, clocks: { me: '6:05', opp: '5:31' },
      status: `<b>نوبت شماست.</b> پشتهٔ ${fa(selH)}تایی ${sqn(sel)} را برداشتید؛ ${fa(lift)} سنگ را روی خانه‌های نقطه‌دار پخش کنید.`,
      pstatus: `<b>نوبت شما.</b> ${fa(lift)} سنگ از ${sqn(sel)} را پخش کنید.`,
      bo: { last: lastSq, sel, dots: reach, lift },
    },
    phases: [
      { shotTitle: 'اولین نوبت', turnSub: 'یک سنگ تختِ حریف می‌گذارید', st: pl({ s: p1, hist: [{ san: 'c3' }], turnMe: true, clocks: { me: '10:00', opp: '9:52' }, bo: { last: [sqOf(5, 'c3')], dots: empt1, tools: { color: 'w', kind: 'F', off: ['S', 'C'], lift: null, hint: 'اولین نوبت: سنگ نیلوفر' } },
          status: '<b>اولین نوبت شما.</b> نیلوفر یکی از سنگ‌های تخت شما را روی c3 گذاشت. حالا شما یک سنگ تخت سفید (از ذخیرهٔ نیلوفر) روی هر خانهٔ خالی بگذارید.',
          pstatus: '<b>اولین نوبت.</b> یک سنگ تخت سفید بگذارید' }),
        railCard: (st) => flatCard(st, '<b>اولین نوبت هر نفر:</b> یک سنگ تختِ حریف را روی خانهٔ خالی می‌گذارید و از ذخیرهٔ او کم می‌شود. دیوار و سرستون و جابه‌جایی از نوبت دوم آزاد می‌شوند.'),
        phone: true },
      { shotTitle: 'سرستون دیوار را می‌خواباند', turnSub: 'سرستونِ تنها، قدم آخر', st: pl({ s: p2, hist: [...hist.slice(0, 13), { san: 'Cc3' }, { san: 'Sd3' }], turnMe: true, clocks: { me: '5:12', opp: '4:47' }, bo: { last: [sqOf(5, 'd3')], sel: c3, lift: 1, dots: new Set(['c4', 'b3', 'c2'].map((x) => sqOf(5, x))), flat: sqOf(5, 'd3'), tools: { color: 'b', kind: 'F', lift: [1, 1] } },
          status: '<b>نوبت شماست.</b> سرستون c3 تنهاست، پس می‌تواند روی دیوار سفید d3 برود و آن را بخواباند.',
          pstatus: '<b>نوبت شما.</b> سرستون تنها دیوار d3 را می‌خواباند' }),
        railCard: (st) => flatCard(st, '<b>خواباندن دیوار:</b> فقط سرستونی که در قدم آخر تنها روی دیوار می‌رود (دیوار هر رنگی) آن را تخت می‌کند. پشته‌ای که چند سنگ روی دیوار بیندازد یا سنگ بالایش سرستون نباشد نمی‌تواند؛ روی سرستون هیچ‌چیز نمی‌رود.') },
      { shotTitle: 'صفحهٔ ۶×۶', turnSub: '۳۰ سنگ و ۱ سرستون، برداشتن تا ۶', meta: ['زنده', '۶×۶', 'رتبه‌ای'], st: pl({ s: p6, hist: hist.slice(0, 21), turnMe: true, clocks: { me: '8:40', opp: '8:02' }, bo: { sel: sel6, lift: 4, dots: dots6, tools: { color: 'b', kind: 'F', lift: [4, 4] } },
          status: '<b>نوبت شماست.</b> پشتهٔ ۴تایی d3 را برداشتید؛ روی صفحهٔ ۶×۶ هر چهار سنگ را می‌توانید در یک خط پخش کنید.',
          pstatus: '<b>نوبت شما.</b> ۴ سنگ از d3 را پخش کنید' }),
        railCard: (st) => flatCard(st, sizeRule) },
      { shotTitle: 'صفحهٔ ۴×۴ در گوشی', turnSub: '۱۵ سنگ، بدون سرستون', meta: ['زنده', '۴×۴', 'رتبه‌ای'], phone: true, phoneOnly: true,
        st: pl({ s: p4, hist: hist4, turnMe: true, clocks: { me: '4:30', opp: '4:12' }, bo: { dots: new Set(p4.b.map((x, i) => (x.length ? -1 : i)).filter((i) => i >= 0)), tools: { color: 'b', kind: 'F', off: ['C'], lift: null, hint: 'سرستون ندارد' } },
          status: '', pstatus: '<b>نوبت شما.</b> ۴×۴: ۱۵ سنگ، سرستون ندارد' }) },
      { shotTitle: 'پایان با شمارش', turnSub: 'صفحه پر شد، تخت‌های رو شمرده می‌شوند', st: pl({ s: pEnd, hist: [...hist, { san: 'Se1' }, { san: 'Sd5' }, { san: 'a5' }], turnMe: false, clocks: { me: '1:58', opp: '2:20' }, bo: { last: [sqOf(5, 'a5')], tools: { color: 'b', kind: 'F', off: ['F', 'S', 'C'], lift: null } },
          status: `<b>بازی تمام شد.</b> صفحه پر شد و جاده‌ای ساخته نشد؛ شما با ${fa(fEnd.b)} تخت رو در برابر ${fa(fEnd.w)} بردید.`,
          pstatus: `<b>شما بردید،</b> ${fa(fEnd.b)} تخت در برابر ${fa(fEnd.w)}` }),
        railCard: (st) => flatCard(st, 'بی‌جاده، بازی وقتی تمام می‌شود که صفحه پر شود یا یک نفر همهٔ سنگ و سرستونش را گذاشته باشد. فقط سنگ تختِ رو شمرده می‌شود؛ دیوار و سرستون نه.'),
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('بازی دوباره', 'primary', 'repeat')}${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        overlay: () => H.modal('شما بردید: شمارش تخت‌ها', `<p>صفحه پر شد و هیچ‌کس جاده نساخت، پس سنگ‌های تختِ رو شمرده شدند.</p>${tbl(['بازیکن', 'تخت رو', 'دیوار رو', 'سرستون رو'], [{ c: ['شما (سیاه)', fa(fEnd.b), fa(topsOf('b', 'S')), fa(topsOf('b', 'C'))], win: true }, { c: ['نیلوفر (سفید)', fa(fEnd.w), fa(topsOf('w', 'S')), fa(topsOf('w', 'C'))] }])}<p class="cx-note">اگر شمار تخت‌ها برابر بود، بازی مساوی می‌شد.</p>`, `${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
    ],
  };
}
