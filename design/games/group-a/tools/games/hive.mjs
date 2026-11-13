// Group A: Hive. Rules = repo games/hive/src/rules.ts (base game: Q, 2S, 2B, 3G, 3A; white first; queen by 4th turn;
// One Hive + Freedom to Move; surround the enemy queen). No board: tiles on an open, zoomable surface.
import { popCss, say } from './_ui.mjs';
export default function (H) {
  const { img, fa, ic, esc } = H;

  // ---------- engine (port of rules.ts; pieces carry a notation id) ----------
  const START = { Q: 1, S: 2, B: 2, G: 3, A: 3 };
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const key = ([q, r]) => `${q},${r}`;
  const parse = (k) => k.split(',').map(Number);
  const around = ([q, r]) => DIRS.map(([a, b]) => [q + a, r + b]);
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const top = (st, h) => st[key(h)]?.at(-1);
  const height = (st, h) => st[key(h)]?.length ?? 0;
  const occ = (st, h) => height(st, h) > 0;
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  function commons(a, b) { const nb = around(b).map(key); return around(a).filter((h) => nb.includes(key(h))); }
  function slides(st, a, b) { if (occ(st, b)) return false; const [c1, c2] = commons(a, b); return occ(st, c1) !== occ(st, c2); }
  function oneHiveWithout(st, h) {
    if (height(st, h) > 1) return true;
    const cells = Object.keys(st).filter((k) => k !== key(h)); if (!cells.length) return true;
    const seen = new Set([cells[0]]); const qu = [cells[0]];
    while (qu.length) { const k = qu.shift(); for (const n of around(parse(k))) { const nk = key(n); if (nk !== key(h) && st[nk] && !seen.has(nk)) { seen.add(nk); qu.push(nk); } } }
    return seen.size === cells.length;
  }
  const without = (st, h) => { const c = { ...st }; const s = c[key(h)].slice(0, -1); if (s.length) c[key(h)] = s; else delete c[key(h)]; return c; };
  function destinations(stacks, from) {
    const piece = top(stacks, from); if (!piece || !oneHiveWithout(stacks, from)) return [];
    const st = without(stacks, from);
    const touches = (h) => around(h).some((n) => occ(st, n));
    const out = new Map(); const add = (h) => { if (!same(h, from) && touches(h)) out.set(key(h), h); };
    if (piece.t === 'Q') for (const n of around(from)) if (slides(st, from, n)) add(n);
    if (piece.t === 'B') for (const n of around(from)) {
      const [c1, c2] = commons(from, n); const h1 = height(st, from), h2 = height(st, n);
      if (h1 === 0 && h2 === 0) { if (slides(st, from, n)) add(n); continue; }
      if (Math.min(height(st, c1), height(st, c2)) > Math.max(h1, h2)) continue; add(n);
    }
    if (piece.t === 'G') for (const [dq, dr] of DIRS) { let h = [from[0] + dq, from[1] + dr]; if (!occ(st, h)) continue; while (occ(st, h)) h = [h[0] + dq, h[1] + dr]; add(h); }
    if (piece.t === 'A') { const seen = new Set([key(from)]); const qu = [from]; while (qu.length) { const h = qu.shift(); for (const n of around(h)) { if (seen.has(key(n)) || !slides(st, h, n)) continue; seen.add(key(n)); qu.push(n); add(n); } } }
    if (piece.t === 'S') { const walk = (h, path) => { if (path.length === 4) { add(h); return; } for (const n of around(h)) if (!path.includes(key(n)) && slides(st, h, n)) walk(n, [...path, key(n)]); }; walk(from, [key(from)]); }
    return [...out.values()];
  }
  function placements(s, c) {
    const cells = Object.keys(s.stacks); if (!cells.length) return [[0, 0]];
    const em = new Map(); for (const k of cells) for (const n of around(parse(k))) if (!occ(s.stacks, n)) em.set(key(n), n);
    if (s.placed[c] === 0 && cells.length === 1) return [...em.values()];
    return [...em.values()].filter((h) => { const t = around(h).map((n) => top(s.stacks, n)).filter(Boolean); return t.some((p) => p.c === c) && t.every((p) => p.c === c); });
  }
  const queenPlaced = (s, c) => s.reserve[c].Q === 0;
  const mustQ = (s, c) => !queenPlaced(s, c) && s.placed[c] === 3;
  function legal(s) {
    const c = s.turn, out = []; const spots = placements(s, c);
    for (const b of Object.keys(s.reserve[c])) if (s.reserve[c][b] > 0 && (!mustQ(s, c) || b === 'Q')) for (const to of spots) out.push({ type: 'place', bug: b, to });
    if (queenPlaced(s, c)) for (const k of Object.keys(s.stacks)) { const f = parse(k); if (top(s.stacks, f).c !== c) continue; for (const to of destinations(s.stacks, f)) out.push({ type: 'move', from: f, to }); }
    return out;
  }
  const surroundCount = (s, c) => { const q = Object.entries(s.stacks).find(([, st]) => st.some((p) => p.c === c && p.t === 'Q')); return q ? around(parse(q[0])).filter((n) => occ(s.stacks, n)).length : 0; };
  const pid = (p) => `${p.c}${p.t}${p.t === 'Q' ? '' : p.n}`;
  // BoardSpace notation: piece, then a neighbour with a side mark (-, /, \) before (W, SW, NW) or after (E, NE, SE) it
  function ref(stacks, to, moving) {
    if (occ(stacks, to)) return pid(top(stacks, to));
    for (let d = 0; d < 6; d++) {
      const n = [to[0] - DIRS[d][0], to[1] - DIRS[d][1]]; const p = top(stacks, n);
      if (!p || p === moving) continue;
      const id = pid(p); // dest = n + DIRS[d]
      return [`${id}-`, `${id}/`, `\\${id}`, `-${id}`, `/${id}`, `${id}\\`][d];
    }
    return '';
  }
  function play(s, a) {
    const st = { ...s.stacks }; const c = s.turn; let san;
    if (a.type === 'place') {
      const n = START[a.bug] - s.reserve[c][a.bug] + 1; const p = { c, t: a.bug, n };
      san = `${pid(p)}${Object.keys(st).length ? ' ' + ref(st, a.to, p) : ''}`;
      st[key(a.to)] = [...(st[key(a.to)] ?? []), p];
      s = { ...s, stacks: st, reserve: { ...s.reserve, [c]: { ...s.reserve[c], [a.bug]: s.reserve[c][a.bug] - 1 } }, placed: { ...s.placed, [c]: s.placed[c] + 1 } };
    } else {
      const p = top(st, a.from); const rest = st[key(a.from)].slice(0, -1);
      if (rest.length) st[key(a.from)] = rest; else delete st[key(a.from)];
      san = `${pid(p)} ${ref(st, a.to, p)}`;
      st[key(a.to)] = [...(st[key(a.to)] ?? []), p];
      s = { ...s, stacks: st };
    }
    return { s: { ...s, turn: other(c), turnNo: s.turnNo + 1 }, san };
  }
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  // playout policy: queen on turn 2–3, mostly placements early, then pressure on the enemy queen; never finish the game
  function pickMove(L, s, R) {
    const c = s.turn; const mine = s.placed[c];
    const score = (a) => {
      const n = play(s, a).s; let v = R() * 3;
      if (surroundCount(n, other(c)) >= 6 || surroundCount(n, c) >= 6) return -999;
      v += surroundCount(n, other(c)) * 2.2 - surroundCount(n, c) * 2.6;
      if (a.type === 'place' && a.bug === 'Q' && mine >= 1) v += 6;
      if (a.type === 'place' && mine < 6) v += 1.5;
      if (a.type === 'place' && a.bug === 'B' && mine < 4) v -= 2;
      return v;
    };
    let best = null, bv = -1e9; for (const a of L) { const v = score(a); if (v > bv) { bv = v; best = a; } }
    return best;
  }
  function run(seed, plies) {
    const R = rng(seed); let s = { stacks: {}, turn: 'w', turnNo: 0, placed: { w: 0, b: 0 }, reserve: { w: { ...START }, b: { ...START } } };
    const hist = []; let last = null;
    for (let k = 0; k < plies; k++) {
      const L = legal(s); if (!L.length) return null;
      const a = pickMove(L, s, R); const r = play(s, a); s = r.s; hist.push({ san: r.san }); last = a;
    }
    return { s, hist, last };
  }

  // a mid-game moment: black (you) to move, a black spider / grasshopper / beetle selected with 3 to 6 targets
  let po = null, sel = null, dots = null;
  for (let seed = 1; seed < 500 && !po; seed++) for (const n of [19, 21, 23]) {
    const p = run(seed, n); if (!p || p.s.turn !== 'b') continue;
    const sw = surroundCount(p.s, 'w'), sb = surroundCount(p.s, 'b');
    if (sw < 3 || sw > 4 || sb < 2 || sb > 4 || Object.keys(p.s.stacks).length < 13) continue;
    if (!Object.values(p.s.stacks).some((x) => x.length > 1)) continue; // show a beetle stack
    const mine = Object.keys(p.s.stacks).map(parse).filter((h) => { const t = top(p.s.stacks, h); return t.c === 'b' && (t.t === 'S' || t.t === 'G' || t.t === 'B'); });
    for (const h of mine) { const d = destinations(p.s.stacks, h); if (d.length >= 3 && d.length <= 6) { po = p; sel = h; dots = d; break; } }
    if (po) break;
  }
  if (!po) throw new Error('hive: no position found');
  const S = po.s;
  const fresh = () => ({ stacks: {}, turn: 'w', turnNo: 0, placed: { w: 0, b: 0 }, reserve: { w: { ...START }, b: { ...START } } });
  // §4 your 4th turn without the queen: you held her back, now only she may be placed
  let pq = null;
  for (let seed = 1; seed < 500 && !pq; seed++) {
    const R = rng(seed); let s = fresh(); const hist = []; let last = null;
    for (let k = 0; k < 7; k++) { let L = legal(s); if (s.turn === 'b') L = L.filter((a) => a.bug !== 'Q'); const a = pickMove(L, s, R); const r = play(s, a); s = r.s; hist.push({ san: r.san }); last = a; }
    if (s.turn === 'b' && s.placed.b === 3 && s.reserve.b.Q === 1 && s.reserve.w.Q === 0) pq = { s, hist, last };
  }
  if (!pq) throw new Error('hive: no queen-turn position');
  const qSpots = placements(pq.s, 'b');
  // §5 Niloufar has no legal move: the engine passes for her and it is your turn again
  let pp = null;
  for (let seed = 790; seed < 4000 && !pp; seed++) {
    const R = rng(seed); let s = fresh(); const hist = []; let last = null;
    for (let k = 0; k < 44; k++) {
      const L = legal(s);
      if (!L.length) { if (s.turn === 'w' && k >= 20) pp = { s: { ...s, turn: 'b' }, hist: [...hist, { san: 'pass' }], last }; break; }
      const a = pickMove(L, s, R); const r = play(s, a); s = r.s; hist.push({ san: r.san }); last = a;
      if (surroundCount(s, 'w') >= 6 || surroundCount(s, 'b') >= 6) break;
    }
  }
  if (!pp) throw new Error('hive: no pass position');

  // ---------- surface render: pointy-top hexes, tiles 130 px with a 75 px flat-to-flat hex ----------
  const BUG = { Q: 'queen', S: 'spider', B: 'beetle', G: 'grasshopper', A: 'ant' };
  const BUGFA = { Q: 'ملکه زنبور', S: 'عنکبوت', B: 'سوسک', G: 'ملخ', A: 'مورچه' };
  const tileName = (p) => `hive-${p.c === 'w' ? 'white' : 'black'}-${BUG[p.t]}`;
  const xy = ([q, r]) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];
  const lastOf = (r) => ({ last: r.last?.to, from: r.last?.type === 'move' ? r.last.from : null });
  function boardHtml(g, s, o = {}) {
    const S = s; const lastTo = o.last, lastFrom = o.from;
    const B = o.b ?? 572;
    const cells = [...Object.keys(S.stacks).map(parse), ...(o.dots ?? []), ...(lastFrom ? [lastFrom] : [])];
    const pts = cells.map(xy); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const unit = Math.min((B * 0.86) / (x1 - x0 + Math.sqrt(3)), (B * 0.8) / (y1 - y0 + 2), B / 9.5); // px per hex radius
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const at = (h) => { const [x, y] = xy(h); return [B / 2 + (x - cx) * unit, B / 2 + (y - cy) * unit]; };
    const flat = Math.sqrt(3) * unit; const tile = (flat * 130) / 75 * 0.985;
    const pos = (h, lift = 0) => { const [x, y] = at(h); return `left:${(x).toFixed(1)}px;top:${(y - lift).toFixed(1)}px`; };
    const parts = [];
    if (lastFrom) parts.push(`<span class="hv-at hv-from" style="${pos(lastFrom)}"></span>`);
    for (const [k, stack] of Object.entries(S.stacks)) {
      const h = parse(k);
      stack.forEach((p, lv) => {
        const isTop = lv === stack.length - 1; const cls = ['hv-at', 'hv-tile'];
        if (isTop && o.sel && same(o.sel, h)) cls.push('is-sel');
        if (isTop && lastTo && same(lastTo, h)) cls.push('is-last');
        parts.push(`<span class="${cls.join(' ')}" style="${pos(h, lv * unit * 0.16)};z-index:${2 + lv}">${img(tileName(p), `${BUGFA[p.t]} ${p.c === 'w' ? 'سفید' : 'سیاه'}`)}${isTop && o.sel && same(o.sel, h) ? `<i class="hv-mk">${img('hive-selected-placement', '')}</i>` : ''}${isTop && stack.length > 1 ? `<b class="hv-h" aria-label="ستون ${fa(stack.length)} تایی">${fa(stack.length)}</b>` : ''}</span>`);
      });
    }
    for (const d of o.dots ?? []) parts.push(`<span class="hv-at hv-dot${occ(S.stacks, d) ? ' is-on' : ''}" style="${pos(d, occ(S.stacks, d) ? height(S.stacks, d) * unit * 0.16 : 0)}"><i class="hv-mk">${img('hive-possible-placement', 'خانهٔ مجاز')}</i></span>`);
    return `<div class="hv-surface" style="--b:${B}px;--tile:${tile.toFixed(1)}px;--flat:${flat.toFixed(1)}px" role="img" aria-label="میز هایو؛ ${fa(Object.keys(S.stacks).length)} خانه"><div class="hv-layer">${parts.join('')}</div>
<div class="hv-zoom" dir="ltr"><button type="button" aria-label="بزرگ‌نمایی">+</button><span>۱۰۰٪</span><button type="button" aria-label="کوچک‌نمایی">−</button><button type="button" aria-label="وسط‌چین">${ic('search')}</button></div></div>`;
  }

  const left = (c, s = S) => Object.values(s.reserve[c]).reduce((a, n) => a + n, 0);
  const reserveRow = (c, o = {}, s = S) => `<div class="hv-res${o.sm ? ' hv-res--sm' : ''}">${Object.keys(START).map((b) => { const n = s.reserve[c][b]; return `<span class="hv-res__i${n ? '' : ' is-out'}${o.only && b !== o.only ? ' is-off' : ''}${o.only === b ? ' is-pick' : ''}">${img(`hive-${c === 'w' ? 'white' : 'black'}-${BUG[b]}-icon`, BUGFA[b])}<b>${fa(n)}</b></span>`; }).join('')}</div>`;
  const css = `
.hv-surface{position:relative;inline-size:var(--b);block-size:var(--b);flex:none;border-radius:18px;direction:ltr;overflow:hidden;
 background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.07),rgba(255,255,255,0) 70%),radial-gradient(rgba(255,255,255,.10) 1.2px,transparent 1.4px) 0 0/22px 22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.hv-layer{position:absolute;inset:0}
.hv-at{position:absolute;inline-size:var(--tile);block-size:var(--tile);transform:translate(-50%,-50%);display:grid;place-items:center}
.hv-at>img{grid-area:1/1;inline-size:100%;block-size:100%;filter:drop-shadow(0 3px 2px rgba(0,0,0,.35))}
.hv-mk{grid-area:1/1;display:grid;place-items:center;inline-size:100%;block-size:100%;z-index:1}
.hv-mk img{inline-size:calc(var(--flat) * 1.04);block-size:auto;transform:rotate(30deg)}
.hv-dot{z-index:9}
.hv-dot .hv-mk img{opacity:.95;filter:drop-shadow(0 0 3px rgba(23,200,255,.55))}
.hv-dot.is-on .hv-mk img{filter:brightness(1.5) drop-shadow(0 0 1.5px #17C8FF) drop-shadow(0 0 5px #17C8FF)}
.hv-dot.is-on::after{content:"";grid-area:1/1;inline-size:calc(var(--flat) * .9);aspect-ratio:.866;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:rgba(23,200,255,.22)}
.hv-tile.is-sel>img{filter:brightness(1.12) drop-shadow(0 0 6px rgba(23,200,255,.8))}
.hv-tile.is-sel{z-index:8!important}
.hv-tile.is-last::before,.hv-from::before{content:"";grid-area:1/1;inline-size:calc(var(--flat) * 1.12);aspect-ratio:0.866;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:#E8A642;margin-block-start:-2px}
.hv-from::before{opacity:.45;inline-size:calc(var(--flat) * .9)}
.hv-h{position:absolute;inset-block-start:12%;inset-inline-end:16%;z-index:2;min-inline-size:20px;block-size:20px;border-radius:10px;background:#142B3B;color:#fff;font:800 12px/20px var(--font);text-align:center;box-shadow:0 0 0 2px #fff}
.hv-zoom{position:absolute;inset-block-end:10px;inset-inline-end:10px;display:flex;align-items:center;gap:2px;padding:3px;border-radius:12px;background:rgba(10,24,34,.55);color:#fff;font-size:12.5px}
.hv-zoom button{inline-size:30px;block-size:30px;border:0;border-radius:9px;background:transparent;color:inherit;font:700 18px/1 var(--font-latin);display:grid;place-items:center}
.hv-zoom button .bgv-icon{inline-size:17px;block-size:17px}
.hv-zoom span{padding-inline:4px;min-inline-size:36px;text-align:center}
.hv-res{display:flex;gap:8px;flex-wrap:wrap}
.hv-res__i{position:relative;display:grid;place-items:center}
.hv-res__i img{inline-size:40px;block-size:40px}
.hv-res__i b{position:absolute;inset-block-end:-4px;inset-inline-start:-4px;min-inline-size:19px;block-size:19px;border-radius:10px;background:var(--surface,#fff);color:var(--heading);font-size:12px;line-height:19px;text-align:center;box-shadow:0 0 0 1.5px var(--border,#ccd)}
.hv-res__i.is-out img{opacity:.3;filter:grayscale(1)}
.hv-res__i.is-out b{color:var(--text-muted)}
.hv-rrow{display:flex;align-items:center;gap:10px;margin-block-end:6px}
.hv-reslab{display:grid;gap:0;inline-size:70px;flex:none;font-size:13px;color:var(--text-muted)}
.hv-reslab b{color:var(--heading);font-size:20px;font-weight:900;line-height:1.2}
.hv-rrow .hv-res{gap:6px}
.hv-rrow .hv-res__i img{inline-size:32px;block-size:32px}
.hv-pres{display:flex;align-items:center;justify-content:center;gap:10px;padding:2px 10px;color:var(--felt-muted);font-size:12.5px}
.hv-res--sm .hv-res__i img{inline-size:32px;block-size:32px}
.hv-res--sm .hv-res__i b{background:var(--felt);color:var(--felt-ink);box-shadow:0 0 0 1.5px var(--felt-muted)}
.hv-res__i.is-off img{opacity:.28;filter:grayscale(1)}.hv-res__i.is-off b{color:var(--text-muted)}
.hv-res__i.is-pick img{border-radius:8px;box-shadow:0 0 0 3px #17C8FF,0 0 10px rgba(23,200,255,.7)}
.cx-phone .cx-ms__m:nth-last-child(n+5){display:none}
.cx-phone .hv-surface{border-radius:0;margin-inline:auto}
.cx-phone .hv-zoom{inset-block-end:6px;inset-inline-end:6px}
` + popCss;
  const sw = surroundCount(S, 'w'), sb = surroundCount(S, 'b');
  const resCard = (st, rule) => `<section class="cx-card"><div class="hv-rrow"><span class="hv-reslab"><span>ذخیرهٔ شما</span><b>${fa(left('b', st.s))}</b></span>${reserveRow('b', { only: st.bo.only }, st.s)}</div><div class="hv-rrow"><span class="hv-reslab"><span>نیلوفر</span><b>${fa(left('w', st.s))}</b></span>${reserveRow('w', {}, st.s)}</div><div class="ga-rule">${ic('info')}<span>${rule}</span></div></section>`;
  return {
    slug: 'Hive', fa: 'کندو', latin: 'Hive', meta: ['زنده', '۱۰ دقیقه', 'رتبه‌ای'], sideFa: ['سفید', 'سیاه'], notation: 'نشانه‌گذاری BoardSpace',
    boardHtml, css,
    actions: `<div class="cx-actions">${H.btn('مساوی', 'secondary', 'hand')}${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    
    feltExtra: (st, isPhone) => (isPhone ? `<div class="hv-pres" aria-label="ذخیرهٔ شما"><span>ذخیرهٔ شما</span>${reserveRow('b', { sm: true, only: st.bo.only }, st.s)}</div>` : ''),
    note: (st, who) => { const c = who === 'me' ? 'b' : 'w'; const n = left(c, st.s); const q = st.s.reserve[c].Q === 0; return `<span>${n ? `${fa(n)} مهره در ذخیره` : 'ذخیره خالی'}<span class="bgv-sep"></span>${q ? `ملکه‌${who === 'me' ? 'تان' : 'اش'} ${fa(surroundCount(st.s, c))} طرف بسته` : 'ملکه هنوز در ذخیره'}</span>`; },
    railCard: (st) => resCard(st, '<b>ملکه تا نوبت چهارم.</b> تا نیاید، حرکت ممنوع.'),
    turnSub: 'مهرهٔ انتخاب‌شده و خانه‌های مجاز',
    diffs: [
      ['صفحه', 'صفحه ندارد: کاشی‌های شش‌ضلعی روی سطح باز میز کنار هم «کندو» می‌سازند. سطح بزرگ‌نمایی و جابه‌جایی دارد (دکمه‌های + و − و وسط‌چین در گوشه، کشیدن با انگشت یا موس)'],
      ['حرکت', 'کاشی را بزنید (قاب آبی دوخطی)، خانه‌های مجاز با قاب آبی نقطه‌چین روشن می‌شوند. برای گذاشتن مهرهٔ تازه، آیکون آن را از ذخیره بزنید و بعد یکی از خانه‌های مجاز را'],
      ['ذخیره', 'به جای مهره‌های گرفته‌شده: ذخیرهٔ هر دو بازیکن در ستون کنار با شمار هر حشره؛ در گوشی ذخیرهٔ خودتان زیر میز. زیر اسم‌ها تعداد مهره‌های ذخیره و تعداد طرف‌های بستهٔ ملکه'],
      ['ستون‌ها', 'سوسک روی مهره‌ها می‌رود؛ ستون با کمی جابه‌جایی رو به بالا و یک نشان عددی دیده می‌شود'],
      ['ثبت حرکت', 'نشانه‌گذاری BoardSpace: نام مهره و جای آن نسبت به یک مهرهٔ همسایه، مثل «bA2 wQ\\» یا «wG1 -bS1»؛ سوسک روی مهره: «bB1 wQ»'],
      ['پایان', 'محاصرهٔ شش‌طرفهٔ ملکهٔ حریف (با مهرهٔ هر رنگی). دکمهٔ «مساوی» با پیشنهاد و پذیرش برمی‌گردد (§۶؛ موتور باید اضافه کند، E1)؛ محاصرهٔ هر دو ملکه با هم یعنی مساوی؛ موتور بعد از ۳۰۰ نوبت مساوی اعلام می‌کند و بی‌حرکتی خودکار نوبت را رد می‌کند (§۵)'],
    ],
    st: {
      s: S, hist: po.hist, turnMe: true, clocks: { me: '7:05', opp: '6:31' },
      status: `<b>نوبت شماست.</b> ${BUGFA[top(S.stacks, sel).t]} انتخاب شده؛ ${fa(dots.length)} خانهٔ مجاز دارد. ملکهٔ سفید از ${fa(sw)} طرف بسته است.`,
      pstatus: `<b>نوبت شما.</b> ${BUGFA[top(S.stacks, sel).t]}: ${fa(dots.length)} خانهٔ مجاز`,
      bo: { sel, dots, ...lastOf(po) },
    },
    phases: [
      { shotTitle: 'ملکه را همین حالا بگذارید', turnSub: 'نوبت چهارم شما', st: { s: pq.s, hist: pq.hist, turnMe: true, clocks: { me: '9:02', opp: '8:47' }, bo: { dots: qSpots, only: 'Q', ...lastOf(pq) },
          status: `<b>نوبت چهارم شماست.</b> ملکه هنوز در ذخیره است، پس فقط ملکه را می‌توانید بگذارید؛ ${fa(qSpots.length)} خانهٔ مجاز روشن است.`,
          pstatus: '<b>نوبت چهارم.</b> فقط ملکه را بگذارید' },
        railCard: (st) => resCard(st, '<b>ملکه را همین حالا بگذارید.</b> تا نوبت چهارم هر بازیکن باید ملکه‌اش روی میز باشد. بقیهٔ مهره‌ها این نوبت خاموش‌اند و تا ملکه نیاید هیچ مهره‌ای حرکت نمی‌کند.'),
        phone: true },
      { shotTitle: 'نیلوفر حرکتی نداشت', turnSub: 'نوبت خودکار رد شد', st: { s: pp.s, hist: pp.hist, turnMe: true, clocks: { me: '4:40', opp: '4:58' }, bo: { ...lastOf(pp) },
          status: '<b>دوباره نوبت شماست.</b> نیلوفر هیچ حرکت یا جای گذاشتن مجازی نداشت و نوبتش خودکار رد شد.',
          pstatus: '<b>دوباره نوبت شما.</b> نیلوفر حرکتی نداشت' },
        railCard: (st) => resCard(st, '<b>رد نوبت خودکار است.</b> وقتی بازیکن نه مهره‌ای را می‌تواند حرکت دهد و نه جایی برای گذاشتن دارد، نوبتش رد می‌شود. دو رد پشت هم یعنی مساوی.'),
        ...say(img('hive-white-queen-icon', 'ملکهٔ سفید'), 'نیلوفر حرکتی نداشت', 'هیچ مهرهٔ نیلوفر حرکت مجاز نداشت و جایی هم برای گذاشتن نبود؛ نوبتش خودکار رد شد و دوباره نوبت شماست.', 'نوبتش رد شد؛ دوباره نوبت شماست.'),
        phone: true },
      { shotTitle: 'پیشنهاد مساوی', turnSub: 'قبول یا رد (با E1)', st: { s: S, hist: po.hist, turnMe: true, clocks: { me: '7:05', opp: '6:31' }, bo: { ...lastOf(po) },
          status: '<b>نیلوفر مساوی پیشنهاد داد.</b> قبول کنید، بازی مساوی تمام می‌شود؛ رد کنید یا حرکت کنید، بازی ادامه دارد.',
          pstatus: '<b>نیلوفر مساوی پیشنهاد داد.</b> قبول یا رد' },
        actions: `<div class="cx-actions">${H.btn('مساوی', 'secondary', 'hand', ' disabled')}${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
        ...say(H.ic('hand'), 'نیلوفر مساوی پیشنهاد داد', 'قبول کنید تا بازی مساوی تمام شود. اگر رد کنید یا حرکت کنید، پیشنهاد کنار می‌رود.', 'قبول: بازی مساوی تمام می‌شود.', `${H.btn('رد', 'leave', 'x')}${H.btn('قبول مساوی', 'primary', 'check')}`),
        phone: true },
    ],
  };
}
