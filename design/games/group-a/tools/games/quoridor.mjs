// Group A game module: Quoridor (repo games/quoridor, 2-player variant: 9×9, 10 walls each, seat 0 bottom → top row,
// seat 1 top → bottom row; straight jump, diagonal when blocked; a wall may never cut a pawn's last path).
// Cells: index = r * 9 + c, r 0 = bottom. Walls anchored (r, c) 0..7: 'h' between rows r and r+1 over columns c, c+1;
// 'v' between columns c and c+1 over rows r, r+1. The photographic BGA board is in slight perspective, so cell and
// groove positions come from a bilinear map of the measured grid corners (pixels of the 628×603 board image).
export default function (H) {
  const bd = (L) => L.map(([a, b]) => [a, b.replace(/«([A-Za-z0-9<>+\-:. ]+)»/g, '«<bdi dir="ltr">$1</bdi>»')]);
  const { img, fa, ic, ART } = H;
  const N = 9;
  const rc = (i) => [Math.floor(i / N), i % N]; const idx = (r, c) => r * N + c; const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const hasWall = (W, r, c, o) => W.some((w) => w.r === r && w.c === c && w.o === o);
  function blocked(W, r, c, dr, dc) { // = repo blocked()
    if (!inside(r + dr, c + dc)) return true;
    if (dr === 1) return hasWall(W, r, c, 'h') || hasWall(W, r, c - 1, 'h');
    if (dr === -1) return hasWall(W, r - 1, c, 'h') || hasWall(W, r - 1, c - 1, 'h');
    if (dc === 1) return hasWall(W, r, c, 'v') || hasWall(W, r - 1, c, 'v');
    return hasWall(W, r, c - 1, 'v') || hasWall(W, r - 1, c - 1, 'v');
  }
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const goal = (seat, i) => [rc(i)[0] === 8, rc(i)[0] === 0, rc(i)[1] === 8, rc(i)[1] === 0][seat]; // 4 players: seat 2 left → right, seat 3 right → left
  function dist(W, from, seat) { const seen = new Map([[from, 0]]); const q = [from]; while (q.length) { const i = q.shift(); if (goal(seat, i)) return seen.get(i); const [r, c] = rc(i); for (const [dr, dc] of STEPS) { if (blocked(W, r, c, dr, dc)) continue; const j = idx(r + dr, c + dc); if (!seen.has(j)) { seen.set(j, seen.get(i) + 1); q.push(j); } } } return null; }
  function pawnMoves(s, seat) { // = repo pawnMoves()
    const occ = new Set(s.pawns.filter((p, k) => k !== seat && p !== null)); const [r, c] = rc(s.pawns[seat]); const out = new Set();
    for (const [dr, dc] of STEPS) {
      if (blocked(s.walls, r, c, dr, dc)) continue; const n = idx(r + dr, c + dc);
      if (!occ.has(n)) { out.add(n); continue; }
      if (!blocked(s.walls, r + dr, c + dc, dr, dc) && !occ.has(idx(r + 2 * dr, c + 2 * dc))) { out.add(idx(r + 2 * dr, c + 2 * dc)); continue; }
      for (const [sr, sc] of dr === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]) { if (blocked(s.walls, r + dr, c + dc, sr, sc)) continue; const d = idx(r + dr + sr, c + dc + sc); if (!occ.has(d)) out.add(d); }
    }
    return [...out];
  }
  function wallOk(s, w) { // = repo wallOk()
    if (w.r < 0 || w.r > 7 || w.c < 0 || w.c > 7) return false;
    for (const x of s.walls) { if (x.r === w.r && x.c === w.c) return false; if (x.o === w.o && w.o === 'h' && x.r === w.r && Math.abs(x.c - w.c) === 1) return false; if (x.o === w.o && w.o === 'v' && x.c === w.c && Math.abs(x.r - w.r) === 1) return false; }
    const W = [...s.walls, w]; return s.pawns.every((p, k) => p === null || dist(W, p, k) !== null);
  }
  const sqn = (i) => 'abcdefghi'[i % N] + (Math.floor(i / N) + 1);
  const wn = (w) => 'abcdefghi'[w.c] + (w.r + 1) + w.o;
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  const allWalls = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (const o of 'hv') allWalls.push({ r, c, o });
  function bestWall(s, seat) { // wall that slows the opponent most, cheap tie-break on own distance
    let best = null, bs = -1e9; const opp = 1 - seat;
    const d0 = dist(s.walls, s.pawns[opp], opp);
    for (const w of allWalls) { if (!wallOk(s, w)) continue; const W = [...s.walls, w]; const sc = dist(W, s.pawns[opp], opp) - d0 - (dist(W, s.pawns[seat], seat) - dist(s.walls, s.pawns[seat], seat)) * 1.1; if (sc > bs) { bs = sc; best = w; } }
    return { w: best, gain: bs };
  }
  let po = null;
  for (let seed = 1; seed < 500 && !po; seed++) {
    const R = rng(seed);
    const s = { pawns: [idx(0, 4), idx(8, 4)], walls: [], left: [10, 10], cur: 1 }; const hist = []; let last = null, over = false;
    for (let ply = 0; ply < 21; ply++) {
      const seat = s.cur;
      const bw = s.left[seat] > 0 && ply > 3 && R() < 0.45 ? bestWall(s, seat) : null;
      if (bw && bw.w && bw.gain >= 1) { s.walls.push(bw.w); s.left[seat]--; hist.push({ san: wn(bw.w) }); last = { wall: bw.w }; }
      else {
        const mv = pawnMoves(s, seat).map((to) => ({ to, d: dist(s.walls, to, seat) })).sort((a, b) => a.d - b.d || R() - 0.5);
        const m = R() < 0.85 ? mv[0] : mv[Math.floor(R() * mv.length)];
        last = { from: s.pawns[seat], to: m.to }; s.pawns[seat] = m.to; hist.push({ san: sqn(m.to) });
        if (goal(seat, m.to)) { over = true; break; }
      }
      s.cur = 1 - seat;
    }
    if (over || s.cur !== 0) continue;
    const d = [dist(s.walls, s.pawns[0], 0), dist(s.walls, s.pawns[1], 1)];
    if (s.left[0] > 8 || s.left[1] > 8 || s.walls.length < 4 || d[0] < 3 || d[1] < 3 || !last.from) continue;
    const prev = bestWall(s, 0); if (!prev.w || prev.gain < 2) continue;
    po = { s, hist, last, d, prev: prev.w, prevGain: prev.gain };
  }
  const { s, hist, last, d, prev, prevGain } = po;
  const steps = pawnMoves(s, 0);

  // ---- geometry: measured outer grid corners (squares' outer edges + half groove) in board-image px ----
  const IW = 628, IH = 603;
  const TL = [40.7, 26.3], TR = [576.7, 26.3], BL = [33.3, 558.7], BR = [593.3, 558];
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (u, v) => [lerp(lerp(TL[0], TR[0], u), lerp(BL[0], BR[0], u), v), lerp(lerp(TL[1], TR[1], u), lerp(BL[1], BR[1], u), v)];
  const pitchX = (v) => lerp(TR[0] - TL[0], BR[0] - BL[0], v) / N, pitchY = (BL[1] - TL[1]) / N;
  const pct = ([x, y]) => `left:${(x / IW * 100).toFixed(2)}%;top:${(y / IH * 100).toFixed(2)}%`;
  const cellPos = (i) => { const [r, c] = rc(i); const v = (8 - r + 0.5) / N; return { p: P((c + 0.5) / N, v), w: pitchX(v), h: pitchY }; };
  const wallPos = (w) => { const v = (8 - w.r) / N; const p = P((w.c + 1) / N, v); return w.o === 'h' ? { p, w: 2 * pitchX(v) - 14, h: 10 } : { p, w: 10, h: 2 * pitchY - 14 }; };
  const box = (q) => `${pct(q.p)};width:${(q.w / IW * 100).toFixed(2)}%;height:${(q.h / IH * 100).toFixed(2)}%`;

  const css = `
.qd-board{position:relative;inline-size:var(--b,572px);aspect-ratio:628/603;background:var(--img) center/100% 100% no-repeat;flex:none;align-self:center;direction:ltr;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}
.qd-o{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center}
.qd-o>img{inline-size:100%;block-size:100%;object-fit:contain}
.qd-pawn>img{inline-size:72%;block-size:72%;filter:drop-shadow(0 3px 2px rgba(0,0,0,.55))}
.qd-cell.is-dot::after{content:"";inline-size:30%;block-size:30%;border-radius:50%;background:rgba(250,245,236,.7);box-shadow:0 0 0 2px rgba(0,0,0,.25)}
.qd-cell.is-last{box-shadow:inset 0 0 0 3px rgba(232,166,66,.65);border-radius:4px}
.qd-cell.is-from{background:rgba(232,166,66,.22);border-radius:4px}
.qd-cell.is-jump{box-shadow:inset 0 0 0 3px #8FD19E;border-radius:4px}
.qd-goal{position:absolute;border-radius:3px;background:var(--c);box-shadow:0 0 0 1.5px rgba(255,255,255,.65)}
.qd-goal.is-out{background:repeating-linear-gradient(45deg,var(--c) 0 4px,transparent 4px 8px);opacity:.6}
.qd-seg button[disabled]{opacity:.38}
.qd-four{display:grid;gap:6px}
.qd-four>div{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:13px;color:var(--text-muted)}
.qd-four>div b{color:var(--heading);font-size:14px}
.qd-four>div.is-out{opacity:.6}
.qd-four img{inline-size:24px;block-size:24px}
.qd-four i{font-style:normal;justify-self:end}
.cx-phone .cx-ms__m:nth-last-child(n+9){display:none}
.qd-wall>img{filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.qd-wall.is-last{outline:2px solid #E8A642;outline-offset:2px;border-radius:2px}
.qd-wall.is-prev>img{opacity:.6;filter:none}
.qd-wall.is-prev{outline:2px dashed #8FD19E;outline-offset:3px;border-radius:3px}
.qd-tools{display:flex;gap:8px;justify-content:center;align-items:center;flex:none;align-self:center}
.qd-seg{display:flex;gap:2px;background:rgba(0,0,0,.22);border-radius:10px;padding:3px}
.qd-seg button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:#FAF5EC;font:700 13px var(--font-body);border-radius:8px;padding:5px 12px}
.qd-seg button.is-on{background:#FAF5EC;color:#142B3B}
.qd-seg .bgv-icon{inline-size:16px;block-size:16px}
.qd-hint{font-size:13px;color:var(--felt-muted)}
.cx-phone .qd-seg button{padding:4px 9px;font-size:12px}
.cx-phone .qd-hint{display:none}
.qd-race{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.qd-race>div{display:grid;gap:4px;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 12px;font-size:13px;color:var(--text-muted)}
.qd-race b{display:flex;align-items:center;gap:6px;font-size:22px;font-weight:900;color:var(--heading)}
.qd-race b small{font-size:13px;font-weight:700;color:var(--text-muted)}
.qd-race img{inline-size:22px;block-size:22px}
.qd-wl{display:inline-flex;align-items:center;gap:2px}
.qd-wl img{inline-size:4px;block-size:16px}
.qd-wl b{margin-inline-start:6px;font-size:12.5px;color:var(--felt-muted)}
`;
  const PAWN = ['quoridor-pawn-red', 'quoridor-pawn-gold', 'quoridor-pawn-brown', 'quoridor-pawn-green'];
  const WHO = ['شما', 'نیلوفر', 'رضا', 'سارا'];
  const COLOR = ['#C8463A', '#E0A43A', '#8A5A3A', '#4E9A5A'];
  // goal side of each seat as a coloured strip just outside the grid (seat 0 → top edge, 1 → bottom, 2 → right, 3 → left)
  const goalEdges = (st) => st.pawns.map((p, k) => {
    const a = [[TL, TR], [BL, BR], [TR, BR], [TL, BL]][k]; const out = p === null ? ' is-out' : '';
    const [x0, y0] = a[0], [x1, y1] = a[1]; const hz = k < 2; const off = k === 0 ? -9 : k === 1 ? 5 : 0;
    const st2 = hz ? `left:${(x0 / IW * 100).toFixed(2)}%;top:${((y0 + off) / IH * 100).toFixed(2)}%;width:${((x1 - x0) / IW * 100).toFixed(2)}%;height:${(5 / IH * 100).toFixed(2)}%`
      : `left:${(((k === 2 ? Math.max(x0, x1) + 4 : Math.min(x0, x1) - 9)) / IW * 100).toFixed(2)}%;top:${(y0 / IH * 100).toFixed(2)}%;width:${(5 / IW * 100).toFixed(2)}%;height:${((y1 - y0) / IH * 100).toFixed(2)}%`;
    return `<span class="qd-goal${out}" style="${st2};--c:${COLOR[k]}" aria-label="هدف ${WHO[k]}"></span>`;
  });
  function boardHtml(g, st, o = {}) {
    const parts = [];
    for (let i = 0; i < N * N; i++) {
      const cls = ['qd-o', 'qd-cell']; if (o.dots?.includes(i)) cls.push('is-dot'); if (o.jump?.includes(i)) cls.push('is-jump'); if (o.lastTo === i) cls.push('is-last'); if (o.lastFrom === i) cls.push('is-from');
      if (cls.length > 2) { const q = cellPos(i); parts.push(`<span class="${cls.join(' ')}" style="${box({ ...q, w: q.w - 12, h: q.h - 12 })}"></span>`); }
    }
    st.walls.forEach((w) => parts.push(`<span class="qd-o qd-wall${o.lastWall === w ? ' is-last' : ''}" style="${box(wallPos(w))}">${img(w.o === 'h' ? 'quoridor-wall-h' : 'quoridor-wall-v', `دیوار ${wn(w)}`)}</span>`));
    if (o.prev) parts.push(`<span class="qd-o qd-wall is-prev" style="${box(wallPos(o.prev))}">${img(o.prev.o === 'h' ? 'quoridor-wall-h' : 'quoridor-wall-v', `پیش‌نمایش دیوار ${wn(o.prev)}`)}</span>`);
    st.pawns.forEach((p, k) => { if (p === null) return; const q = cellPos(p); parts.push(`<span class="qd-o qd-pawn" style="${box(q)}">${img(PAWN[k], `مهرهٔ ${WHO[k]}`)}</span>`); });
    if (o.goals) parts.push(...goalEdges(st));
    return `<div class="qd-board" style="--img:url(${ART['quoridor-board']});${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="صفحهٔ کوریدور ۹×۹">${parts.join('')}</div>`;
  }
  // tool bar; t = { mode: 'pawn' | 'h' | 'v', noWalls, hint }
  const tools = (t = {}) => { const m = t.mode ?? 'h'; const b = (k, l) => `<button type="button"${m === k ? ' class="is-on"' : ''}${t.noWalls && k !== 'pawn' ? ' disabled' : ''}>${l}</button>`; return `<div class="qd-tools"><div class="qd-seg" role="group" aria-label="نوع حرکت">${b('pawn', 'مهره')}${b('h', 'دیوار افقی')}${b('v', 'دیوار عمودی')}</div><span class="qd-hint">${t.hint ?? 'کلید R: چرخاندن دیوار'}</span></div>`; };
  const feltExtra = (st) => tools(st.bo.tools);
  const wl = (st, k) => { const left = st.s.left[k]; const dk = dist(st.s.walls, st.s.pawns[k], k); return `<span class="qd-wl" aria-label="${fa(left)} دیوار مانده">${Array.from({ length: left }, () => img('quoridor-wall-v')).join('')}<b>${left ? `${fa(left)} دیوار` : 'دیوار تمام شد'}<span class="bgv-sep"></span>${fa(dk)} قدم</b></span>`; };
  const raceCard = (st, rule) => { const D = st.s.pawns.map((p, k) => (p === null ? null : dist(st.s.walls, p, k))); return `<section class="cx-card"><div class="qd-race"><div>تا ردیف آخر<b>${img('quoridor-pawn-red')}${fa(D[0])}<small>قدم، شما</small></b></div><div>تا ردیف اول<b>${img('quoridor-pawn-gold')}${fa(D[1])}<small>قدم، نیلوفر</small></b></div></div><div class="ga-rule">${ic('info')}<span>${rule}</span></div></section>`; };
  const W = (n) => ({ c: 'abcdefghi'.indexOf(n[0]), r: Number(n[1]) - 1, o: n[2] });
  const build = (pawns, walls, left) => { const st = { pawns, walls: [], left }; for (const n of walls) { const w = W(n); if (!wallOk(st, w)) throw new Error('quoridor mock wall ' + n); st.walls.push(w); } return st; };
  const H_ = (L) => L.map((san) => ({ san }));
  // §4 side jump: Niloufar on e6 with her own wall behind her, so you cannot jump straight over
  const sj = build([idx(4, 4), idx(5, 4)], ['c3h', 'b7h', 'g7v', 'c5v', 'g4h', 'e2v', 'd8h', 'e6h'], [7, 5]);
  const sjMoves = pawnMoves(sj, 0); const sjSide = [idx(5, 3), idx(5, 5)];
  if (!sjSide.every((x) => sjMoves.includes(x)) || sjMoves.includes(idx(6, 4))) throw new Error('quoridor mock: side jump');
  const sjHist = H_(['e8', 'e2', 'e7', 'e3', 'e6', 'e4', 'c3h', 'b7h', 'g7v', 'c5v', 'g4h', 'e2v', 'd8h', 'e5', 'e6h']);
  // §5 out of walls: you placed all ten; only pawn moves are left
  let ow = null;
  for (let seed = 1; seed < 400 && !ow; seed++) {
    const R = rng(seed); const st = { pawns: [idx(0, 4), idx(8, 4)], walls: [], left: [10, 10], cur: 1 }; const hist = []; let lastW = null, over = false;
    for (let ply = 0; ply < 40 && !over; ply++) {
      const seat = st.cur;
      const bw = st.left[seat] > 0 && ply > 2 && (seat === 0 || R() < 0.3) ? bestWall(st, seat) : null;
      if (bw && bw.w && bw.gain >= 0) { st.walls.push(bw.w); st.left[seat]--; hist.push({ san: wn(bw.w) }); lastW = bw.w; }
      else { const mv = pawnMoves(st, seat).map((to) => ({ to, d: dist(st.walls, to, seat) })).sort((a, b) => a.d - b.d || R() - 0.5); st.pawns[seat] = mv[0].to; hist.push({ san: sqn(mv[0].to) }); lastW = null; if (goal(seat, mv[0].to)) over = true; }
      st.cur = 1 - seat;
      if (!over && st.left[0] === 0 && st.cur === 0 && st.left[1] >= 3 && hist.at(-1).san.length === 2) { ow = { st, hist }; break; }
    }
  }
  if (!ow) throw new Error('quoridor: no out-of-walls position');
  // §6 four players, 5 walls each: Reza (brown) left the table and his pawn was removed
  const fp = build([idx(3, 4), idx(5, 4), null, idx(4, 5)], ['d4h', 'f5v', 'b6h', 'g3h', 'e6v', 'c2v', 'h6h', 'd7h'], [3, 2, 4, 3]);
  const fpHist = H_(['e2', 'e8', 'b5', 'h5', 'e3', 'e7', 'c5', 'g5', 'd4h', 'f5v', 'b6h', 'g3h', 'e4', 'e6', '—', 'f5']);
  const fourCard = (st) => `<section class="cx-card"><h3>چهار نفر، ۵ دیوار هر کدام</h3><div class="qd-four">${[0, 1, 3, 2].map((k) => { const p = st.s.pawns[k]; const dk = p === null ? null : dist(st.s.walls, p, k); return `<div${p === null ? ' class="is-out"' : ''}>${img(PAWN[k], '')}<span><b>${WHO[k]}</b> ${['هدف بالا', 'هدف پایین', 'هدف راست', 'هدف چپ'][k]}</span><i>${p === null ? 'بیرون رفت' : `${fa(st.s.left[k])} دیوار، ${fa(dk)} قدم`}</i></div>`; }).join('')}</div><div class="ga-rule" style="margin-block-start:10px">${ic('info')}<span>هر کس برای خودش؛ اولین کسی که به ضلع روبه‌رو برسد می‌برد و بقیه با کوتاه‌ترین فاصله رتبه می‌گیرند. مهرهٔ کسی که بیرون برود برداشته می‌شود و نوبتش رد می‌شود.</span></div></section>`;
  const after = d[1] + prevGain;
  return {
    slug: 'Quoridor', fa: 'کوریدور', latin: 'Quoridor', meta: ['زنده', 'دونفره', 'رتبه‌ای'], sideFa: ['زرد', 'قرمز'], notation: 'خانهٔ مقصد؛ دیوار با خانهٔ پایین‌چپ و h/v',
    boardHtml, feltExtra, css,
    note: (st, who) => wl(st, who === 'me' ? 0 : 1),
    railCard: (st) => raceCard(st, 'هر نوبت یا یک قدم یا یک دیوار. دیوار نباید روی دیوار دیگر بیفتد یا آن را قطع کند، و هیچ‌وقت نباید همهٔ راه‌های یک مهره را ببندد؛ جای غیرمجاز پیش‌نمایش نمی‌گیرد.'),
    noDraw: true,
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    turnSub: 'پیش‌نمایش دیوار',
    diffs: bd([
      ['صفحه', 'تختهٔ عکاسی‌شدهٔ BGA (کمی پرسپکتیو) با مهره و دیوار تخت دوبعدی از همان بسته؛ جای خانه‌ها و شیارها از گوشه‌های اندازه‌گیری‌شدهٔ تصویر حساب می‌شود'],
      ['رنگ‌ها', 'شما قرمز (پایین)، حریف طلایی؛ چهارنفره قهوه‌ای و سبز هم دارد (§۶) و ضلع هدف هر نفر نواری به رنگ خودش است. رنگ صندلی‌ها مثل BGA: طلایی/نارنجی، قهوه‌ای، قرمز، سبز (تصمیم مالک ۱۹ آبان؛ موتور امروز رنگ دوم را آبی می‌داند و باید عوض شود)'],
      ['حرکت', 'مهره: خانه‌های نقطه‌دار (قدم و پرش؛ پرش کناری وقتی پشت مهرهٔ حریف دیوار است با قاب سبز، §۴). دیوار: با نشانگر روی شیارها، پیش‌نمایش سبز خط‌چین فقط جای مجاز را نشان می‌دهد؛ نوار زیر صفحه بین مهره و دیوار افقی/عمودی جابه‌جا می‌کند'],
      ['کنار اسم و ستون', 'به جای مهره‌های گرفته‌شده، دیوارهای باقی‌مانده (از ۱۰) و کوتاه‌ترین فاصله تا هدف. در ستون کنار: مسابقهٔ فاصله: قدم‌های باقی‌ماندهٔ هر دو نفر، به‌علاوهٔ قانون بسته نشدن راه'],
      ['دکمه‌ها', 'فقط «تسلیم»؛ موتور مساوی ندارد'],
      ['ثبت حرکت', 'خانهٔ مقصد مثل «e4»؛ دیوار با خانهٔ پایین‌چپش و h یا v مثل «d5h». ستون a تا i از چپ شما، ردیف ۱ ردیف شروع شما'],
    ]),
    st: {
      s, hist, turnMe: true, clocks: { me: '2:58', opp: '3:12' },
      status: `<b>نوبت شماست.</b> دیوار ${wn(prev)} راه نیلوفر را از ${fa(d[1])} به ${fa(after)} قدم می‌رساند؛ یا یکی از خانه‌های نقطه‌دار را بزنید.`,
      pstatus: `<b>نوبت شما.</b> دیوار ${wn(prev)}: راه حریف ${fa(after)} قدم می‌شود.`,
      bo: { dots: steps, lastFrom: last.from, lastTo: last.to, prev },
    },
    phases: [
      { shotTitle: 'پرش کناری', turnSub: 'پشت مهرهٔ حریف دیوار است', st: { s: sj, hist: sjHist, turnMe: true, clocks: { me: '2:20', opp: '2:41' }, bo: { dots: sjMoves, jump: sjSide, lastWall: sj.walls.at(-1), tools: { mode: 'pawn' } },
          status: '<b>نوبت شماست.</b> نیلوفر جلوی شماست و پشتش دیوار است، پس پرش مستقیم نمی‌شود؛ می‌توانید به چپ یا راست او بپرید (قاب سبز).',
          pstatus: '<b>نوبت شما.</b> پرش کناری: d6 یا f6' },
        railCard: (st) => raceCard(st, '<b>پرش:</b> اگر مهرهٔ حریف درست جلوی شماست، از رویش می‌پرید. اگر پشتش دیوار یا لبهٔ صفحه باشد، به خانهٔ چپ یا راست او می‌روید.'),
        phone: true },
      { shotTitle: 'دیوارها تمام شد', turnSub: 'فقط حرکت مهره', st: { s: ow.st, hist: ow.hist, turnMe: true, clocks: { me: '1:35', opp: '2:02' }, bo: { dots: pawnMoves(ow.st, 0), tools: { mode: 'pawn', noWalls: true, hint: 'هر ۱۰ دیوارتان را گذاشته‌اید' } },
          status: `<b>نوبت شماست.</b> هر ۱۰ دیوارتان را گذاشته‌اید؛ از این به بعد فقط مهره را حرکت می‌دهید. نیلوفر هنوز ${fa(ow.st.left[1])} دیوار دارد.`,
          pstatus: '<b>نوبت شما.</b> دیوار ندارید؛ فقط مهره' },
        railCard: (st) => raceCard(st, '<b>دیوار تمام شد.</b> دکمه‌های دیوار خاموش‌اند و هر نوبت باید مهره را یک قدم (یا با پرش) حرکت دهید.'),
        phone: true },
      { shotTitle: 'میز چهارنفره', turnSub: 'چهار رنگ، چهار ضلع هدف؛ رضا بیرون رفت', meta: ['زنده', 'چهارنفره', 'رتبه‌ای'], st: { s: fp, hist: fpHist, turnMe: true, clocks: { me: '2:05', opp: '1:48' }, bo: { dots: pawnMoves(fp, 0), goals: true, tools: { mode: 'pawn', hint: 'هر نفر ۵ دیوار' } },
          status: '<b>نوبت شماست.</b> رضا از بازی بیرون رفت و مهره‌اش برداشته شد؛ نوبت‌ها بین شما، سارا و نیلوفر می‌چرخد.',
          pstatus: '<b>نوبت شما.</b> چهارنفره؛ رضا بیرون رفت' },
        railCard: fourCard,
        phone: true },
    ],
  };
}
