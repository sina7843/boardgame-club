// Group A: Backgammon. Rules = repo games/backgammon/src/rules.ts (standard 15 checkers, opening roll, use as many dice
// as possible / the larger die, bar entry first, bear-off rules, optional doubling cube, gammons). Seat 0 (you, white
// checkers) moves 23 → 0 with home 0..5; seat 1 (red) moves 0 → 23. Points are shown from your side: point = i + 1.
export default function (H) {
  const { img, fa, ic, esc, btn, ibtn } = H;

  // ---------- engine (port of rules.ts) ----------
  const dir = (seat) => (seat === 0 ? -1 : 1);
  const own = (pts, i, seat) => (seat === 0 ? Math.max(0, pts[i]) : Math.max(0, -pts[i]));
  const opp = (pts, i, seat) => own(pts, i, 1 - seat);
  const inHome = (i, seat) => (seat === 0 ? i <= 5 : i >= 18);
  const pipOf = (i, seat) => (seat === 0 ? i + 1 : 24 - i);
  function startPos() { const pts = Array(24).fill(0); pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5; pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5; return { pts, bar: [0, 0], off: [0, 0] }; }
  const pipCount = (p, seat) => { let n = p.bar[seat] * 25; for (let i = 0; i < 24; i++) n += own(p.pts, i, seat) * pipOf(i, seat); return n; };
  const allHome = (p, seat) => p.bar[seat] === 0 && p.pts.every((_, i) => inHome(i, seat) || own(p.pts, i, seat) === 0);
  function target(p, seat, f, die) {
    if (p.bar[seat] > 0 && f !== 'bar') return null;
    if (f === 'bar') { if (p.bar[seat] === 0) return null; const to = seat === 0 ? 24 - die : die - 1; return opp(p.pts, to, seat) >= 2 ? null : to; }
    if (own(p.pts, f, seat) === 0) return null;
    const to = f + dir(seat) * die;
    if (to >= 0 && to <= 23) return opp(p.pts, to, seat) >= 2 ? null : to;
    if (!allHome(p, seat)) return null;
    if (seat === 0 ? to === -1 : to === 24) return 'off';
    const far = seat === 0 ? [f + 1, 5] : [18, f - 1];
    for (let i = far[0]; i <= far[1]; i++) if (own(p.pts, i, seat) > 0) return null;
    return 'off';
  }
  function step(p, seat, s) {
    const to = target(p, seat, s.from, s.die); const pts = p.pts.slice(); const bar = [...p.bar], off = [...p.off]; const sign = seat === 0 ? 1 : -1;
    if (s.from === 'bar') bar[seat] -= 1; else pts[s.from] -= sign;
    let hit = false;
    if (to === 'off') off[seat] += 1; else { if (opp(pts, to, seat) === 1) { pts[to] = 0; bar[1 - seat] += 1; hit = true; } pts[to] += sign; }
    return { pos: { pts, bar, off }, played: { from: s.from, to, die: s.die, hit } };
  }
  const diceList = (d) => (d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]);
  const sources = (p, seat) => (p.bar[seat] > 0 ? ['bar'] : p.pts.map((_, i) => i).filter((i) => own(p.pts, i, seat) > 0));
  function legalPlays(p, seat, dice) {
    const out = []; const seen = new Set(); let best = 0;
    const walk = (pos, left, path) => {
      let moved = false; const tried = new Set();
      for (let k = 0; k < left.length; k++) {
        const die = left[k]; if (tried.has(die)) continue; tried.add(die);
        for (const f of sources(pos, seat)) { if (target(pos, seat, f, die) === null) continue; moved = true; walk(step(pos, seat, { from: f, die }).pos, [...left.slice(0, k), ...left.slice(k + 1)], [...path, { from: f, die }]); }
      }
      if (!moved && path.length >= best) { if (path.length > best) { best = path.length; out.length = 0; seen.clear(); } const key = path.map((s) => `${s.from}:${s.die}`).join(','); if (!seen.has(key)) { seen.add(key); out.push(path); } }
    };
    walk(p, diceList(dice), []);
    if (best === 1 && dice[0] !== dice[1]) { const hi = Math.max(...dice); if (out.some((pl) => pl[0].die === hi)) return out.filter((pl) => pl[0].die === hi); }
    return best === 0 ? [[]] : out;
  }
  // notation from the mover's side: "24/18 13/11", hits "*", bar / off, repeats "(2)"
  function notate(seat, dice, played) {
    const pt = (x) => (x === 'bar' ? 'bar' : x === 'off' ? 'off' : String(pipOf(x, seat)));
    // one checker moving on in the same turn is chained: bar/22*/21
    const chains = [];
    for (const m of played) { const c = chains.find((x) => x.to === m.from && m.from !== 'bar'); if (c) { c.path.push(`${pt(m.to)}${m.hit ? '*' : ''}`); c.to = m.to; } else chains.push({ to: m.to, path: [pt(m.from), `${pt(m.to)}${m.hit ? '*' : ''}`] }); }
    const parts = chains.map((c) => c.path.join('/'));
    const cnt = new Map(); parts.forEach((x) => cnt.set(x, (cnt.get(x) ?? 0) + 1));
    const body = [...cnt].map(([x, n]) => (n > 1 ? `${x}(${n})` : x)).join(' ');
    return body || '—';
  }
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  function evalPos(p, seat) {
    let v = -pipCount(p, seat) * 0.05 + pipCount(p, 1 - seat) * 0.05 + p.bar[1 - seat] * 3;
    for (let i = 0; i < 24; i++) { const n = own(p.pts, i, seat); if (n === 1) v -= 1.6; if (n >= 2) v += (inHome(i, seat) ? 1.4 : 0.8); }
    return v;
  }
  function run(seed, turns) {
    const R = rng(seed); let p = startPos(); const hist = []; let last = null;
    let a = 0, b = 0; while (a === b) { a = 1 + Math.floor(R() * 6); b = 1 + Math.floor(R() * 6); }
    let seat = a > b ? 0 : 1; let dice = [a, b];
    for (let t = 0; t < turns; t++) {
      if (t > 0) dice = [1 + Math.floor(R() * 6), 1 + Math.floor(R() * 6)];
      const L = legalPlays(p, seat, dice);
      let best = L[0], bv = -1e9;
      for (const pl of L) { let q = p; for (const s of pl) q = step(q, seat, s).pos; const v = evalPos(q, seat) + R() * 1.5; if (v > bv) { bv = v; best = pl; } }
      const played = []; for (const s of best) { const r = step(p, seat, s); p = r.pos; played.push(r.played); }
      hist.push({ san: notate(seat, dice, played) }); last = { seat, played };
      if (p.off[0] || p.off[1]) return null;
      seat = 1 - seat;
    }
    return { p, hist, last, seat, first: hist.length % 2 === 0 ? seat : 1 - seat };
  }

  // moment: red moved first (opening), you (white, seat 0) have just rolled; a red checker sits on the bar, one of your
  // points holds 6+ checkers; the selected checker has 2–3 destinations, one of them a hit
  let po = null, dice = null, selFrom = null, dests = null;
  // you are on the bar (hit on red's last turn): entry first; the bar checker has 2–3 destinations, one of them a hit
  for (const needStack of [true, false]) {
    if (po) break;
    outer: for (let seed = 1; seed < 2500; seed++) for (const n of [11, 13]) {
      const r = run(seed, n); if (!r || r.seat !== 0 || r.first !== 1) continue; // red opened, you to move
      const p = r.p;
      if (p.bar[0] !== 1 || p.bar[1] > 0 || !r.last.played.some((m) => m.hit)) continue;
      if (needStack && !p.pts.some((x) => x >= 6 || x <= -6)) continue;
      const R2 = rng(seed * 7 + n);
      for (let k = 0; k < 6; k++) {
        const d = [1 + Math.floor(R2() * 6), 1 + Math.floor(R2() * 6)]; if (d[0] === d[1]) continue;
        const L = legalPlays(p, 0, d); if (L[0].length < 2) continue;
        const ds = new Set(L.map((pl) => pl[0].die));
        const to = [...ds].map((die) => target(p, 0, 'bar', die)).filter((t) => typeof t === 'number');
        const combos = L.filter((pl) => pl[1] && pl[1].from === target(p, 0, 'bar', pl[0].die)).map((pl) => target(step(p, 0, pl[0]).pos, 0, pl[1].from, pl[1].die)).filter((t) => typeof t === 'number');
        const all = [...new Set([...to, ...combos])];
        const hits = all.filter((t) => p.pts[t] === -1);
        if (all.length >= 2 && all.length <= 3 && hits.length === 1) { po = { ...r, seed, n }; dice = d; selFrom = 'bar'; dests = all; break outer; }
      }
    }
  }
  if (!po) throw new Error('backgammon: no position found');
  const P = po.p;
  const pips = [pipCount(P, 0), pipCount(P, 1)];

  // ---------- board: BGA board-ltr 806×700, content x 40..766 y 40..576; fields x 113..365 / 439..691, rows y 57..560 ----------
  const X = (x) => (((x - 40) / 726) * 100).toFixed(2) + '%';
  const Y = (y) => (((y - 40) / 536) * 100).toFixed(2) + '%';
  const ptX = (i) => { const p = i + 1; if (p <= 6) return 691 - 21 - (p - 1) * 42; if (p <= 12) return 365 - 21 - (p - 7) * 42; if (p <= 18) return 113 + 21 + (p - 13) * 42; return 439 + 21 + (p - 19) * 42; };
  const bottom = (i) => i <= 11;
  const slotY = (i, k) => (bottom(i) ? 560 - 21 - k * 42 : 57 + 21 + k * 42);
  const lastTo = po.last.played.map((m) => m.to).filter((t) => typeof t === 'number');
  // all destinations of one checker this turn (each die, and the dice chained on the same checker)
  function destsFor(p, from, d) {
    const out = new Set();
    for (const pl of legalPlays(p, 0, d)) { let q = p, at = from; for (const s of pl) { if (s.from !== at) break; const to = target(q, 0, s.from, s.die); out.add(to); q = step(q, 0, s).pos; at = to; if (to === 'off') break; } }
    return [...out];
  }
  // s = position {pts, bar, off}; o: dice (white, yours), oppDice (red), sel, dests (point index or 'off'), last, block, cube {v, at: mid|me|opp, offer}
  function boardHtml(g, s, o = {}) {
    const P = s; const dests = o.dests ?? []; const last = new Set(o.last ?? []); const block = new Set(o.block ?? []);
    const ck = (seat) => (seat === 0 ? 'backgammon-checker-white' : 'backgammon-checker-red');
    const parts = [];
    for (let i = 0; i < 24; i++) {
      const n = Math.abs(P.pts[i]); if (!n) continue; const seat = P.pts[i] > 0 ? 0 : 1; const show = Math.min(n, 5);
      for (let k = 0; k < show; k++) {
        const top = k === show - 1; const cls = ['bgm-ck'];
        if (top && i === o.sel) cls.push('is-sel');
        if (top && last.has(i) && seat === 1) cls.push('is-last');
        if (top && ((dests.includes(i) && P.pts[i] === -1) || block.has(i))) cls.push('is-hit');
        parts.push(`<span class="${cls.join(' ')}" style="left:${X(ptX(i))};top:${Y(slotY(i, k))}">${img(ck(seat), seat ? 'مهرهٔ قرمز' : 'مهرهٔ سفید')}${top && n > 5 ? `<b class="bgm-n${seat ? ' is-red' : ''}">${fa(n)}</b>` : ''}</span>`);
      }
    }
    for (const t of dests) {
      if (t === 'off') { parts.push(`<span class="bgm-dot is-off" style="left:${X(728)};top:${Y(557 - P.off[0] * 14 - 64)}" aria-label="بیرون بردن">${img('backgammon-possible', '')}</span>`); continue; }
      const n = Math.abs(P.pts[t]);
      const hit = P.pts[t] === -1; const k = hit ? 0 : Math.min(n, 4);
      parts.push(`<span class="bgm-dot${hit ? ' is-hit' : ''}" style="left:${X(ptX(t))};top:${Y(slotY(t, k))}" aria-label="${hit ? 'زدن مهرهٔ تنها' : 'خانهٔ مجاز'}">${hit ? '' : img('backgammon-possible', '')}</span>`);
    }
    // bar: red (opponent) above the centre, white below
    for (let k = 0; k < P.bar[1]; k++) parts.push(`<span class="bgm-ck is-bar" style="left:${X(402)};top:${Y(250 - k * 42)}">${img(ck(1), 'مهرهٔ قرمز در بار')}</span>`);
    for (let k = 0; k < P.bar[0]; k++) parts.push(`<span class="bgm-ck is-bar${o.sel === 'bar' && k === P.bar[0] - 1 ? ' is-sel' : ''}" style="left:${X(402)};top:${Y(366 + k * 42)}">${img(ck(0), 'مهرهٔ سفید در بار')}</span>`);
    // doubling cube on the bar (centre, or the owner's side), dice in each player's half, point numbers in the middle strips
    const cb = o.cube ?? { v: 1, at: 'mid' };
    const cy = cb.at === 'me' ? 528 : cb.at === 'opp' ? 88 : 308;
    parts.push(`<span class="bgm-cube${cb.offer ? ' is-offer' : ''}" style="left:${X(402)};top:${Y(cy)}">${img(`backgammon-cube-${cb.v}`, `کیوب ${fa(cb.v)}${cb.at === 'mid' ? '، وسط' : cb.at === 'me' ? '، دست شما' : '، دست نیلوفر'}`)}</span>`);
    if (o.dice) parts.push(`<span class="bgm-dice" style="left:${X(565)};top:${Y(308)}">${o.dice.map((v) => img(`backgammon-white-die-${v}`, `تاس ${fa(v)}`)).join('')}</span>`);
    if (o.oppDice) parts.push(`<span class="bgm-dice" style="left:${X(239)};top:${Y(308)}">${o.oppDice.map((v) => img(`backgammon-red-die-${v}`, `تاس قرمز ${fa(v)}`)).join('')}</span>`);
    parts.push(`<span class="bgm-nums" style="left:${X(119)};top:${Y(260)};width:${((567 / 726) * 100).toFixed(2)}%">${img('backgammon-numbers-13to24', '')}</span>`);
    parts.push(`<span class="bgm-nums" style="left:${X(119)};top:${Y(322)};width:${((562 / 726) * 100).toFixed(2)}%">${img('backgammon-numbers-1to12', '')}</span>`);
    // borne-off trays: BGA slab art (one slab per checker) + count
    const slabs = (seat) => Array.from({ length: P.off[seat] }, () => img(seat ? 'backgammon-off-red' : 'backgammon-off-white', '')).join('');
    parts.push(`<span class="bgm-off" style="left:${X(728)};top:${Y(60)}" aria-label="بیرون‌بردهٔ قرمز">${slabs(1)}<b>${fa(P.off[1])}</b></span><span class="bgm-off is-me" style="left:${X(728)};top:${Y(557)}" aria-label="بیرون‌بردهٔ شما">${slabs(0)}<b>${fa(P.off[0])}</b></span>`);
    return `<div class="bgm-board" style="--img:url(${H.ART['backgammon-board']});${o.b ? `--b:${o.b}px;` : ''}" role="img" aria-label="${esc(g.fa)}">${parts.join('')}</div>`;
  }

  const css = `
.bgm-board{position:relative;flex:none;direction:ltr;inline-size:var(--b,572px);block-size:calc(var(--b,572px) * 536 / 726);background:var(--img) no-repeat;background-size:calc(var(--b,572px) * 806 / 726) calc(var(--b,572px) * 700 / 726);background-position:calc(var(--b,572px) * -40 / 726) calc(var(--b,572px) * -40 / 726);border-radius:8px;box-shadow:0 4px 0 rgba(0,0,0,.28),0 18px 30px -18px rgba(0,0,0,.6)}
.bgm-board>span{position:absolute;transform:translate(-50%,-50%)}
.bgm-ck{inline-size:5.8%;aspect-ratio:1;display:grid;place-items:center}
.bgm-ck img{grid-area:1/1;inline-size:100%;block-size:100%;filter:drop-shadow(0 2px 1px rgba(0,0,0,.4))}
.bgm-ck.is-sel::after{content:"";grid-area:1/1;inline-size:112%;block-size:112%;border-radius:50%;box-shadow:0 0 0 3px #E8A642,0 0 12px 2px rgba(232,166,66,.7)}
.bgm-ck.is-last::after{content:"";grid-area:1/1;inline-size:108%;block-size:108%;border-radius:50%;box-shadow:0 0 0 2.5px rgba(232,166,66,.85)}
.bgm-ck.is-hit::after{content:"";grid-area:1/1;inline-size:112%;block-size:112%;border-radius:50%;box-shadow:0 0 0 3px #F0AAA3}
.bgm-n{grid-area:1/1;z-index:1;font:900 15px/1 var(--font);color:#5A1A12}
.bgm-n.is-red{color:#fff}
.bgm-dot{inline-size:3.4%;aspect-ratio:1;display:grid;place-items:center;z-index:3}.bgm-dot img{inline-size:100%;block-size:auto;filter:drop-shadow(0 0 4px rgba(250,245,236,.8))}
.bgm-dot.is-hit{inline-size:6.4%;background:transparent;box-shadow:0 0 0 3px #F0AAA3,0 0 12px rgba(240,170,163,.8);border:2px dashed #fff;box-sizing:border-box}
.bgm-cube{inline-size:6.2%;aspect-ratio:1}.bgm-cube img{inline-size:100%;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.bgm-dice{display:flex;gap:5px;z-index:2}.bgm-dice img{inline-size:calc(var(--b,572px) * 38 / 726);display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.bgm-nums{transform:translate(0,0)!important;opacity:.9}.bgm-nums img{inline-size:100%;display:block}
.bgm-board>.bgm-off{display:flex;flex-direction:column;align-items:center;gap:1px;transform:translate(-50%,0)}.bgm-board>.bgm-off.is-me{flex-direction:column-reverse;transform:translate(-50%,-100%)}.bgm-off img{inline-size:30px;block-size:auto;display:block}.bgm-off b{font:800 13px/1 var(--font-fa);color:#fff;background:rgba(20,43,59,.7);border-radius:999px;padding:4px 7px}
.cx-phone .bgm-board{--b:366px;align-self:center}
.cx-phone .bgm-n{font-size:10px}
.cx-phone .cx-ms__m:nth-last-child(n+4){display:none}
.cx-phone .bgm-off b{font-size:10px;padding:2px 5px}.cx-phone .bgm-off img{inline-size:20px}
.bgm-rd{display:flex;align-items:center;gap:12px}
.bgm-rd__dice{display:flex;gap:6px}.bgm-rd__dice img{inline-size:40px;block-size:40px}
.bgm-rd__t{display:grid;gap:2px;font-size:13px;color:var(--text-muted)}.bgm-rd__t b{font-size:15px;color:var(--heading)}
.bgm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-block:12px}
.bgm-stats span{display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:12.5px;color:var(--text-muted)}
.bgm-stats b{font-size:18px;font-weight:900;color:var(--heading)}
.bgm-stats img{inline-size:28px;block-size:28px}
.bgm-dot.is-off{inline-size:6.4%;border-radius:50%;box-shadow:0 0 0 3px #E8A642,0 0 12px rgba(232,166,66,.8)}.bgm-dot.is-off img{inline-size:60%}
.bgm-cube.is-offer{border-radius:6px;box-shadow:0 0 0 3px #E8A642,0 0 14px 3px rgba(232,166,66,.75)}
.bgm-pop{position:absolute;z-index:4;inset-block-start:50%;inset-inline-start:50%;transform:translate(50%,-50%);display:grid;gap:12px;inline-size:min(430px,calc(100% - 32px));box-sizing:border-box;padding:16px 18px;border-radius:var(--radius-lg,16px);background:var(--surface);color:var(--text);box-shadow:0 24px 48px -16px rgba(0,0,0,.65)}
.bgm-pop.is-flow{position:relative;inset:auto;transform:none;inline-size:var(--b,572px);align-self:center;padding:12px 16px;box-shadow:0 10px 24px -12px rgba(0,0,0,.6)}
.bgm-pop.is-flow .bgm-pop__row{flex-wrap:wrap}.bgm-pop.is-flow .bgm-pop__t{flex:1;min-inline-size:240px}.bgm-pop.is-flow .bgm-pop__acts{margin-block-start:-4px}
.bgm-pop__row{display:flex;align-items:center;gap:14px}
.bgm-pop__art{display:flex;gap:6px;flex:none}.bgm-pop__art img{inline-size:44px;block-size:44px;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
.bgm-pop__t{display:grid;gap:4px;font-size:14px;line-height:1.75}.bgm-pop__t b{font-size:16px;font-weight:800;color:var(--heading)}
.bgm-pop__acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.cx-phone .bgm-pop{padding:12px 14px;gap:10px}.cx-phone .bgm-pop__art img{inline-size:34px;block-size:34px}.cx-phone .bgm-pop__t{font-size:13px;line-height:1.7}.cx-phone .bgm-pop__t b{font-size:14.5px}
.bgm-who{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bgm-who span{display:grid;justify-items:center;gap:6px;padding:10px 6px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:13px;color:var(--text-muted)}
.bgm-who span.is-win{box-shadow:inset 0 0 0 2px #E8A642;color:var(--heading);font-weight:700}
.bgm-who img{inline-size:40px;block-size:40px}
`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, k) => `<th${k ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, k) => `<td${k ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const pop = (art, title, text, acts = '', flow = false) => `<div class="bgm-pop${flow ? ' is-flow' : ''}" role="status"><div class="bgm-pop__row">${art ? `<span class="bgm-pop__art">${art}</span>` : ''}<span class="bgm-pop__t"><b>${title}</b><span>${text}</span></span></div>${acts ? `<div class="bgm-pop__acts">${acts}</div>` : ''}</div>`;
  // desktop: a banner between the board and your bar (dice and board stay visible); phone: a card over the board
  const say = (art, title, textD, textP, actsD = '', actsP = actsD) => ({ feltExtra: (st, ph) => (ph ? '' : pop(art, title, textD, actsD, true)), overlay: (ph) => (ph ? pop(art, title, textP, actsP) : '') });
  const noteOf = (p, s) => `<span>پیپ ${fa(pipCount(p, s))}<span class="bgv-sep"></span>بیرون ${fa(p.off[s])} از ۱۵${p.bar[s] ? `<span class="bgv-sep"></span>${fa(p.bar[s])} در بار` : ''}</span>`;
  const diceCard = (st, rule) => { const d = st.bo.dice; const n = legalPlays(st.s, 0, d).filter((pl) => pl.length).length; return `<section class="cx-card"><div class="bgm-rd"><span class="bgm-rd__dice">${d.map((v) => img(`backgammon-white-die-${v}`, fa(v))).join('')}</span><span class="bgm-rd__t"><b>تاس ${fa(d[0])} و ${fa(d[1])}</b>${n ? `${fa(n)} ترکیب مجاز` : 'هیچ حرکت مجازی نیست'}<span class="bgv-sep"></span>پیپ ${fa(pipCount(st.s, 0))} در برابر ${fa(pipCount(st.s, 1))}</span></div><div class="ga-rule" style="margin-block-start:12px">${ic('info')}<span>${rule}</span></div></section>`; };
  const actions = `<div class="cx-actions">${btn('تاس بریز', 'primary', '', ' disabled')}${btn('دوبل', 'secondary', '', ' disabled')}${btn('تسلیم', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`;
  const hitTo = dests.find((t) => P.pts[t] === -1);
  const pos = (mine, red, bar = [0, 0], off = [0, 0]) => { const pts = Array(24).fill(0); for (const [i, n] of Object.entries(mine)) pts[i] = n; for (const [i, n] of Object.entries(red)) pts[i] = -n; const p = { pts, bar, off }; const c = [0, 1].map((s) => p.bar[s] + p.off[s] + p.pts.reduce((a, _, i) => a + own(pts, i, s), 0)); if (c[0] !== 15 || c[1] !== 15) throw new Error('backgammon mock: ' + c); return p; };

  // §4 opening roll: one die each, you rolled higher and play both numbers
  const openSt = { s: startPos(), hist: [], turnMe: true, clocks: { me: '10:00', opp: '10:00' }, bo: { dice: [5], oppDice: [3] },
    status: '<b>شما شروع می‌کنید.</b> هر نفر یک تاس ریخت: شما ۵، نیلوفر ۳. همین ۵ و ۳ اولین حرکت شماست.',
    pstatus: '<b>شما شروع می‌کنید</b> با ۵ و ۳' };
  // §5 Niloufar doubles before her roll (a later turn of the same game); answer with accept / refuse
  const rOffer = run(po.seed, po.n + 1) ?? po;
  const offerSt = { s: rOffer.p, hist: rOffer.hist, turnMe: true, clocks: { me: '7:55', opp: '8:31' }, bo: { cube: { v: 2, at: 'mid', offer: true } },
    status: '<b>نیلوفر دوبل کرد.</b> پیش از ریختن تاسش کیوب را ۲ کرد. قبول یا رد با شماست.',
    pstatus: '<b>نیلوفر دوبل کرد.</b> قبول یا رد' };
  // §6 you are on the bar and both entry points are closed: the turn passes by itself
  const pNo = pos({ 5: 4, 7: 3, 12: 4, 3: 2, 2: 1 }, { 18: 3, 19: 2, 20: 2, 22: 2, 16: 3, 11: 3 }, [1, 0]);
  const noSt = { s: pNo, hist: [...rOffer.hist, { san: 'bar/20 13/11' }, { san: '—' }], turnMe: false, clocks: { me: '7:02', opp: '7:48' }, bo: { dice: [6, 5], block: [18, 19], cube: { v: 2, at: 'me' } },
    status: '<b>حرکتی نداشتید.</b> با ۶ و ۵ باید در خانهٔ ۱۹ یا ۲۰ وارد می‌شدید که هر دو بسته‌اند. نوبت خودکار به نیلوفر رسید.',
    pstatus: '<b>حرکتی نداشتید،</b> نوبت نیلوفر' };
  // §7 bearing off: all 15 at home, 5 already off; the checker on point 6 can go off with the 6
  const pOff = pos({ 0: 2, 1: 3, 2: 2, 3: 1, 5: 2 }, { 12: 1, 13: 2, 18: 3, 20: 3, 21: 2, 23: 4 }, [0, 0], [5, 0]);
  const offDests = destsFor(pOff, 5, [6, 3]);
  const offSt = { s: pOff, hist: [...noSt.hist, { san: '20/14 19/16' }, { san: '6/off 5/2' }, { san: '14/8 13/12' }, { san: '6/off(2) 4/off(2)' }, { san: '12/7 13/10' }], turnMe: true, clocks: { me: '4:20', opp: '5:06' }, bo: { dice: [6, 3], sel: 5, dests: offDests, cube: { v: 2, at: 'me' } },
    status: '<b>بیرون بردن.</b> همهٔ مهره‌هایتان در خانه‌اند. با ۶ مهرهٔ خانهٔ ۶ بیرون می‌رود؛ با ۳ می‌رود به خانهٔ ۳.',
    pstatus: '<b>بیرون بردن.</b> ۶ بیرون می‌برد، ۳ جابه‌جا' };
  // §8 game over: you bore off all 15, Niloufar none → gammon × cube 2
  const pEnd = pos({}, { 18: 3, 19: 2, 20: 3, 21: 3, 22: 2, 23: 2 }, [0, 0], [15, 0]);
  const endSt = { s: pEnd, hist: [...offSt.hist, { san: '6/off 3/off' }, { san: '10/4 7/3' }, { san: '2/off(2)' }], turnMe: false, clocks: { me: '2:41', opp: '4:12' }, bo: { cube: { v: 2, at: 'me' } },
    status: '<b>بازی تمام شد.</b> شما با مارس بردید: ۲ × کیوب ۲ = ۴ امتیاز.', pstatus: '<b>شما بردید،</b> مارس، ۴ امتیاز' };

  return {
    slug: 'Backgammon', fa: 'تخته‌نرد', latin: 'Backgammon',
    meta: ['زنده', 'با کیوب', 'رتبه‌ای'], sideFa: ['قرمز', 'سفید'], notation: 'مبدأ/مقصد از دید هر بازیکن',
    boardHtml, css, actions, noDraw: true,
    dockItems: [['more', 'گزینه‌ها'], ['repeat', 'تاس بریز'], ['zap', 'دوبل'], ['flag', 'تسلیم']],
    note: (st, who) => noteOf(st.s, who === 'me' ? 0 : 1),
    railCard: (st) => diceCard(st, '<b>اول مهرهٔ بار.</b> تا مهرهٔ زده‌شده وارد نشود هیچ مهرهٔ دیگری حرکت نمی‌کند. هر دو تاس را اگر ممکن است باید بازی کنید.'),
    turnSub: 'تاس ریخته شد، خانه‌های مجاز',
    diffs: [
      ['صفحه', 'تختهٔ ۲۴ خانه با بار و سینی بیرون‌بردن، از بستهٔ آماده (BGA، جهت چپ‌به‌راست: خانهٔ شما پایین سمت راست مثل موتور). عددهای خانه‌ها از دید شما در نوار وسط؛ صفحه پهن است (۷۲۶ در ۵۳۶). بیش از ۵ مهره روی یک خانه: ۵ مهره و عدد کل روی مهرهٔ بالایی؛ مهره‌های زده‌شده روی بار، هر رنگ سمت خودش؛ مهره‌های بیرون‌برده با تصویر برش BGA در سینی کنار صفحه روی هم می‌نشینند'],
      ['تاس و کیوب', 'تاس‌های هر بازیکن در نیمهٔ خودش روی صفحه (شما سفید، نیلوفر قرمز) و درشت‌تر در ستون کنار؛ کیوب دوبل روی بار، وسط یا سمت صاحبش (از §۶ دست شما با عدد ۲). رنگ‌ها: موتور «سفید/سیاه» نوشته، تصویرها سفید و قرمزند؛ اینجا «سفید/قرمز» آمده'],
      ['حرکت', 'مهره را بزنید (حلقهٔ طلایی؛ اگر مهره‌ای در بار دارید فقط همان انتخاب‌شدنی است)؛ مقصدهای هر تاس و جمع دو تاس نشانگر «حرکت مجاز» BGA را دارند و مقصدی که مهرهٔ تنهای حریف را می‌زند حلقهٔ قرمز. حرکت‌ها یکی‌یکی روی صفحه انجام می‌شوند و موتور کل نوبت را با هم می‌گیرد، پس بعد از اولین حرکت «واگرد» لازم است'],
      ['دکمه‌ها', 'به جای مساوی: «تاس بریز» و «دوبل» (فقط پیش از ریختن تاس فعال‌اند؛ اینجا تاس ریخته شده و خاموش‌اند) و «تسلیم». پاسخ به دوبل حریف («قبول» و «رد») جای همین دو دکمه می‌آید (§۵). در گوشی همین‌ها در نوار پایین‌اند'],
      ['ثبت حرکت', 'نوبت به نوبت، حرکت‌ها از دید همان بازیکن، مثل «24/18 13/11»؛ زدن با «*»، ورود از بار «bar/22»، بیرون بردن «6/off»، تکرار «(2)»، نوبت ردشده «—»'],
      ['پایان', 'بیرون بردن هر ۱۵ مهره. مارس ۲ و مارس ترکی ۳ امتیاز (اگر میز روشن کرده باشد)، ضرب در عدد کیوب (§۸)؛ تسلیم یک بازی ساده به عدد کیوب است'],
    ],
    st: {
      s: P, hist: po.hist, turnMe: true, clocks: { me: '8:40', opp: '9:12' },
      status: `<b>نوبت شماست.</b> تاس ${fa(dice[0])} و ${fa(dice[1])}. اول مهرهٔ بار را وارد کنید؛ در خانهٔ ${fa(hitTo + 1)} مهرهٔ تنهای قرمز را می‌زنید.`,
      pstatus: `<b>نوبت شما.</b> اول مهرهٔ بار؛ حلقهٔ قرمز یعنی زدن`,
      bo: { dice, sel: selFrom, dests, last: lastTo },
    },
    phases: [
      { shotTitle: 'تاس شروع', turnSub: 'هر نفر یک تاس؛ عدد بزرگ‌تر شروع می‌کند', st: openSt,
        railCard: () => `<section class="cx-card"><h3>تاس شروع</h3><div class="bgm-who"><span class="is-win">${img('backgammon-white-die-5', 'تاس ۵')}شما ۵</span><span>${img('backgammon-red-die-3', 'تاس قرمز ۳')}نیلوفر ۳</span></div><div class="ga-rule" style="margin-block-start:12px">${ic('info')}<span>عدد بزرگ‌تر شروع می‌کند و همین دو عدد را بازی می‌کند. اگر دو تاس برابر بیاید، هر دو دوباره می‌ریزید.</span></div></section>`,
        ...say(`${img('backgammon-white-die-5', 'تاس ۵')}${img('backgammon-red-die-3', 'تاس قرمز ۳')}`, 'شما ۵، نیلوفر ۳', 'شما شروع می‌کنید و همین ۵ و ۳ اولین حرکت شماست. اگر برابر می‌آمد، دوباره می‌ریختید.', 'شما با ۵ و ۳ شروع می‌کنید.'),
        phone: true },
      { shotTitle: 'نیلوفر دوبل کرد', turnSub: 'قبول یا رد، پیش از تاس او', st: offerSt,
        railCard: (st) => `<section class="cx-card"><div class="bgm-rd"><span class="bgm-rd__dice">${img('backgammon-cube-2', 'کیوب ۲')}</span><span class="bgm-rd__t"><b>پیشنهاد دوبل: ۲ امتیاز</b>پیپ شما ${fa(pipCount(st.s, 0))}، نیلوفر ${fa(pipCount(st.s, 1))}</span></div><div class="ga-rule" style="margin-block-start:12px">${ic('info')}<span><b>قبول:</b> بازی ۲ امتیازی می‌شود و کیوب دست شما می‌آید؛ بعد از این فقط شما می‌توانید آن را ۴ کنید. <b>رد:</b> همین حالا ۱ امتیاز می‌بازید.</span></div></section>`,
        actions: `<div class="cx-actions">${btn('قبول', 'primary', 'check')}${btn('رد', 'leave', 'x')}${btn('تسلیم', 'leave', 'flag', ' disabled')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['check', 'قبول'], ['x', 'رد'], ['flag', 'تسلیم']],
        ...say(img('backgammon-cube-2', 'کیوب ۲'), 'نیلوفر کیوب را ۲ کرد', 'قبول کنید تا بازی ۲ امتیازی شود و کیوب دست شما بیاید. رد کنید، همین حالا ۱ امتیاز می‌بازید.', 'قبول: بازی ۲ امتیازی، کیوب دست شما. رد: ۱ امتیاز می‌بازید.', `${btn('رد، باخت ۱ امتیاز', 'leave', 'x')}${btn('قبول', 'primary', 'check')}`),
        phone: true },
      { shotTitle: 'حرکتی ندارید', turnSub: 'نوبت خودکار رد شد', st: noSt,
        railCard: (st) => diceCard(st, '<b>نوبت رد شد.</b> وقتی هیچ تاسی بازی‌شدنی نیست، نوبت خودکار به حریف می‌رسد. اینجا مهرهٔ بار باید اول وارد شود و خانه‌های ۱۹ و ۲۰ هر کدام دو مهرهٔ قرمز یا بیشتر دارند.'),
        ...say(`${img('backgammon-white-die-6', 'تاس ۶')}${img('backgammon-white-die-5', 'تاس ۵')}`, 'حرکتی ندارید', 'مهرهٔ بار با ۶ و ۵ جایی برای ورود ندارد (خانهٔ ۱۹ و ۲۰ بسته است). نوبت خودکار به نیلوفر رسید.', 'خانهٔ ۱۹ و ۲۰ بسته است. نوبت نیلوفر شد.'), phone: true },
      { shotTitle: 'بیرون بردن', turnSub: 'همهٔ مهره‌ها در خانه؛ مقصد «بیرون» روی سینی', st: offSt,
        railCard: (st) => diceCard(st, `<b>بیرون بردن.</b> فقط وقتی هر ۱۵ مهره در خانهٔ شما (۱ تا ۶) باشند. عدد دقیق مهره را بیرون می‌برد؛ عدد بزرگ‌تر فقط از دورترین خانهٔ پر. تا حالا ${fa(st.s.off[0])} از ۱۵ بیرون رفته‌اند.`),
        phone: true },
      { shotTitle: 'پایان بازی', turnSub: 'نوع برد ضرب در کیوب', st: endSt,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        railCard: () => `<section class="cx-card"><div class="bgm-stats"><span>${img('backgammon-off-white', '')}<b>${fa(15)}</b>بیرون شما</span><span>${img('backgammon-off-red', '')}<b>${fa(0)}</b>بیرون نیلوفر</span><span>${img('backgammon-cube-2', 'کیوب ۲')}<b>×${fa(2)}</b>کیوب</span></div></section>`,
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${btn('بازی دوباره', 'primary', 'repeat')}${btn('بازگشت به لابی', 'secondary', 'back')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        overlay: (ph) => H.modal('شما بردید: مارس', `<p>هر ۱۵ مهره‌تان بیرون رفت و نیلوفر هیچ مهره‌ای بیرون نبرده بود.</p>${tbl(['نوع برد', 'شرط', 'امتیاز'], [{ c: ['ساده', 'بازنده دست‌کم یک مهره بیرون برده', fa(1)] }, { c: ['مارس', 'بازنده هیچ مهره‌ای بیرون نبرده', fa(2)], win: true }, { c: ['مارس ترکی', 'به‌علاوه مهره در بار یا خانهٔ برنده', fa(3)] }])}<p><b>مارس ${fa(2)} × کیوب ${fa(2)} = ${fa(4)} امتیاز</b> برای شما.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
    ],
  };
}
