// Kingdomino («کینگ‌دومینو») on the group D frame. Repo engine: 2–4 players, base game. BGA layout: current line and next line of dominoes
// in the middle (lowest number on top), every kingdom on its 5×5 area with the castle, kings standing on the chosen dominoes.
// Mock: 4 players (48 dominoes, 12 rounds), round 7. Line order this round: سارا (#9, done), شما (#20), نیلوفر (#33), رضا (#41).
// Every kingdom below is built domino by domino from the real BGA 2016 tiles (terrain + crowns from ready to use/data/asset-manifest.json);
// build() throws if a placement breaks the connection rule or the 5×5 limit, and all scores, legal cells and previews are computed, not typed.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART[n];
  const DOM = { 1: 'F0F0', 2: 'F0F0', 3: 'W0W0', 4: 'W0W0', 5: 'W0W0', 7: 'L0L0', 8: 'L0L0', 9: 'L0L0', 10: 'G0G0', 11: 'G0G0', 12: 'S0S0', 13: 'F0W0', 14: 'F0L0', 16: 'F0S0', 19: 'F1W0', 20: 'F1L0', 21: 'F1G0', 23: 'F1M0', 24: 'W1F0', 25: 'W1F0', 26: 'W1F0', 27: 'W1F0', 28: 'W1L0', 29: 'W1G0', 30: 'L1F0', 31: 'L1F0', 33: 'L1W0', 34: 'L1W0', 35: 'L1W0', 36: 'F0G1', 37: 'L0G1', 38: 'F0S1', 39: 'G0S1', 40: 'M1F0', 41: 'F0G2', 42: 'L0G2', 43: 'F0S2', 46: 'S0M2', 48: 'F0M3' };
  const TN = { F: 'گندمزار', W: 'جنگل', L: 'دریاچه', G: 'چمنزار', S: 'باتلاق', M: 'معدن' };
  const halves = (id) => { const s = DOM[id]; return [[s[0], +s[1]], [s[2], +s[3]]]; };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const second = (x, y, r) => (r === 0 ? [x + 1, y] : r === 180 ? [x - 1, y] : r === 90 ? [x, y + 1] : [x, y - 1]);
  const K = (x, y) => `${x},${y}`;
  const ext = (cells) => { const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
  // map: { cells: Map(key -> {t, c}), doms: [[id,x,y,r]] }
  const fits = (map, id, x, y, r) => {
    const [x2, y2] = second(x, y, r), [[a], [b]] = halves(id);
    if (map.cells.has(K(x, y)) || map.cells.has(K(x2, y2))) return false;
    const [x0, x1, y0, y1] = ext([...[...map.cells.keys()].map((k) => k.split(',').map(Number)), [x, y], [x2, y2]]);
    if (x1 - x0 > 4 || y1 - y0 > 4) return false;
    const ok = (cx, cy, t) => D4.some(([dx, dy]) => { const n = map.cells.get(K(cx + dx, cy + dy)); return n && (n.t === 'C' || n.t === t); });
    return ok(x, y, a) || ok(x2, y2, b);
  };
  const build = (doms, who) => {
    const map = { cells: new Map([[K(0, 0), { t: 'C', c: 0 }]]), doms: [] };
    for (const [id, x, y, r] of doms) {
      if (!fits(map, id, x, y, r)) throw new Error(`kingdomino: illegal placement ${who} #${id} at ${x},${y} r${r}`);
      const [x2, y2] = second(x, y, r), [h1, h2] = halves(id);
      map.cells.set(K(x, y), { t: h1[0], c: h1[1] }); map.cells.set(K(x2, y2), { t: h2[0], c: h2[1] }); map.doms.push([id, x, y, r]);
    }
    return map;
  };
  const legal = (map, id) => {
    const out = [];
    for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) for (const r of [0, 90, 180, 270]) if (fits(map, id, x, y, r)) out.push([x, y, r]);
    return out;
  };
  const regions = (map) => {
    const seen = new Set(), out = [];
    for (const [k, v] of map.cells) {
      if (seen.has(k) || v.t === 'C') continue;
      const q = [k], cells = []; seen.add(k); let crowns = 0;
      while (q.length) { const cur = q.pop(); cells.push(cur); crowns += map.cells.get(cur).c; const [cx, cy] = cur.split(',').map(Number); for (const [dx, dy] of D4) { const nk = K(cx + dx, cy + dy), n = map.cells.get(nk); if (n && !seen.has(nk) && n.t === v.t) { seen.add(nk); q.push(nk); } } }
      out.push({ t: v.t, cells, size: cells.length, crowns, pts: cells.length * crowns });
    }
    return out;
  };
  const score = (map) => regions(map).reduce((a, r) => a + r.pts, 0);
  const crowns = (map) => [...map.cells.values()].reduce((a, v) => a + v.c, 0);
  const largest = (map) => Math.max(...regions(map).map((r) => r.size));
  const byTerrain = (map) => { const o = { F: 0, W: 0, L: 0, G: 0, S: 0, M: 0 }; for (const r of regions(map)) o[r.t] += r.pts; return o; };

  // ---------- render ----------
  // o: { s, castle, ghost:[id,x,y,r], legal:[[x,y]], hl:[id] framed domino, labels:true, win:[x0,y0] }
  const kingdom = (map, o) => {
    const keys = [...map.cells.keys()].map((k) => k.split(',').map(Number));
    if (o.ghost) { const [, gx, gy, gr] = o.ghost; keys.push([gx, gy], second(gx, gy, gr)); }
    const [mx0, mx1, my0, my1] = ext(keys);
    const x0 = o.win ? o.win[0] : Math.min(mx0, Math.max(mx1 - 4, -2)), y0 = o.win ? o.win[1] : Math.min(my0, Math.max(my1 - 4, -2));
    const P = (x, y) => `left:calc(var(--s) * ${x - x0});top:calc(var(--s) * ${y - y0})`;
    const dom = (id, x, y, r, cls = '') => {
      const [x2, y2] = second(x, y, r), bx = Math.min(x, x2), by = Math.min(y, y2), bw = Math.abs(x2 - x) + 1, bh = Math.abs(y2 - y) + 1;
      const cx = bx + bw / 2 - 1, cy = by + bh / 2 - 0.5;
      const [[a, ac], [b, bc]] = halves(id);
      return `<img class="kd-d${cls ? ' ' + cls : ''}" style="left:calc(var(--s) * ${cx - x0});top:calc(var(--s) * ${cy - y0});transform:rotate(${r}deg)" src="${A('kingdomino-d' + String(id).padStart(2, '0'))}" alt="دومینوی ${fa(id)}: ${TN[a]}${ac ? ` با ${fa(ac)} تاج` : ''} و ${TN[b]}${bc ? ` با ${fa(bc)} تاج` : ''}">${cls.includes('is-hl') || cls.includes('is-ghost') ? `<i class="kd-box" style="${P(bx, by)};width:calc(var(--s) * ${bw});height:calc(var(--s) * ${bh})"></i>` : ''}`;
    };
    let h = `<div class="kd-k" style="--s:${o.s}px" role="img" aria-label="${o.label ?? 'قلمرو'}"><img class="kd-castle" style="${P(0, 0)}" src="${A('kingdomino-castle-' + o.castle)}" alt="قلعه">`;
    for (const [id, x, y, r] of map.doms) h += dom(id, x, y, r, o.hl === id ? 'is-hl' : '');
    for (const [x, y] of o.legal ?? []) h += `<i class="kd-legal" style="${P(x, y)}"></i>`;
    if (o.ghost) h += dom(...o.ghost, 'is-ghost');
    if (o.labels) for (const rg of regions(map)) if (rg.pts) { const [lx, ly] = rg.cells.map((k) => k.split(',').map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0])[0]; h += `<b class="kd-lab" style="${P(lx, ly)}">${fa(rg.size)}×${fa(rg.crowns)}=${fa(rg.pts)}</b>`; }
    return h + '</div>';
  };
  const king = (c, cls = 'kd-king') => `<img class="${cls}" src="${A('kingdomino-king-' + c)}" alt="شاه ${CN[c]}">`;
  const CN = { blue: 'آبی', orange: 'نارنجی', green: 'سبز', pink: 'صورتی' };
  // line slot: [id, kingColour|null, state] state: free | sel | done | own
  const line = (title, slots, ph, sub) => `<section class="kd-line"><h4>${title}${sub ? `<small>${sub}</small>` : ''}</h4>${slots.map(([id, k, st]) => `<div class="kd-slot${st ? ' is-' + st : ''}"><span class="kd-no">${fa(id)}</span>${st === 'done' ? '<span class="kd-empty">گذاشته شد</span>' : `<img class="kd-ld" src="${A('kingdomino-d' + String(id).padStart(2, '0'))}" alt="دومینوی ${fa(id)}">`}${k ? king(k) : ''}</div>`).join('')}</section>`;

  // ---------- kingdoms ----------
  const MINE6 = [[19, 1, 0, 0], [13, 1, 1, 0], [24, 1, -1, 180], [30, -1, 0, 180], [14, -2, 1, 0], [29, 2, -1, 270]];
  const ME7 = build(MINE6, 'me');
  const PLACE = [20, -2, -1, 0];
  const ME8 = build([...MINE6, PLACE], 'me');
  const MINE11 = [...MINE6, PLACE, [27, 1, -2, 180], [34, -1, -2, 180], [43, 0, 1, 90], [37, -1, 2, 180]];
  const ME_END = build(MINE11, 'me');
  const NIL6 = [[3, 1, 0, 0], [25, 1, 1, 0], [1, 2, 2, 180], [31, -1, 0, 180], [7, -1, 1, 90], [26, 0, -1, 0]];
  const NIL = build(NIL6, 'nil');
  const NIL_PEND = build([...NIL6, [33, -2, 1, 90]], 'nil');
  const REZ = build([[10, 0, 1, 0], [21, 3, 1, 180], [11, 0, 2, 0], [23, 3, 0, 270], [40, 2, -1, 180], [2, 1, 0, 0]], 'rez');
  const SAR = build([[4, -1, 0, 180], [28, -1, -1, 180], [36, 0, 1, 0], [42, 2, 2, 270], [12, 0, -1, 0], [39, 2, 0, 270], [9, -2, -2, 0]], 'sar');
  const LEG = legal(ME7, 20);
  const legalCells = [...new Map(LEG.map(([x, y]) => [K(x, y), [x, y]])).values()];
  const GAIN = score(ME8) - score(ME7);
  if (legal(ME_END, 8).length) throw new Error('kingdomino: #8 should have no legal spot');
  const S = { me: score(ME7), me8: score(ME8), nil: score(NIL), rez: score(REZ), sar: score(SAR), end: score(ME_END) };

  // ---------- table ----------
  const CUR = [[9, null, 'done'], [20, 'blue', 'own'], [33, 'orange'], [41, 'green']];
  const NEXT = [[16, null, 'free'], [27, null, 'free'], [38, null, 'free'], [46, 'pink']];
  const mini = (map, nm, seat, c, sc, hl) => `<figure class="kd-mini"><figcaption>${king(c, 'kd-mk')}${nm}<b>${fa(sc)}</b></figcaption>${kingdom(map, { s: 20, castle: c, hl, label: `قلمرو ${nm}` })}</figure>`;
  const minis = (o = {}) => `<div class="kd-minis">${mini(o.nil ?? NIL, 'نیلوفر', 2, 'orange', o.nilS ?? S.nil, o.nilHl)}${mini(REZ, 'رضا', 6, 'green', S.rez)}${mini(SAR, 'سارا', 4, 'pink', S.sar)}</div>`;
  const table = (o = {}) => (ph) => `<div class="kd-lines${ph ? ' kd-lines--ph' : ''}">${o.lines ? o.lines(ph) : `${line('این دور', o.cur ?? CUR, ph, `دور ${fa(o.round ?? 7)} از ${fa(12)}`)}${line('دور بعد', o.next ?? NEXT, ph, `مانده: ${fa(16)}`)}`}</div>${ph || o.noMinis ? '' : minis(o)}`;
  const seatMeta = (c, sc, cr) => `<img class="kd-sk" src="${A('kingdomino-king-' + c)}" alt=""><span class="gc-tag gc-tag--soft">${fa(sc)} امتیاز</span><span>تاج ${fa(cr)}</span>`;
  const opps = (turn, nilS = S.nil, nilC = crowns(NIL)) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '2:05', turn: turn === 2, meta: seatMeta('orange', nilS, nilC) },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:50', turn: turn === 6, meta: seatMeta('green', S.rez, crowns(REZ)) },
    { name: 'سارا', av: 'س', seat: 4, clock: '1:38', turn: turn === 4, meta: seatMeta('pink', S.sar, crowns(SAR)) },
  ];
  const domImg = (id, cls = 'kd-hold') => `<img class="${cls}" src="${A('kingdomino-d' + String(id).padStart(2, '0'))}" alt="دومینوی ${fa(id)}">`;
  // me.above: kingdom + side panel
  const above = (map, ko, side) => (ph) => `<div class="kd-me${ph ? ' kd-me--ph' : ''}">${side ? `<div class="kd-side">${side(ph)}</div>` : ''}${kingdom(map, { s: ph ? 34 : 50, castle: 'blue', label: 'قلمرو شما', ...ko })}</div>`;
  const placeSide = (ph) => `<div class="kd-hold-w"><small>دومینوی شما</small>${domImg(20)}</div><span class="gc-tag">${fa(GAIN)}+ امتیاز</span><div class="kd-btns">${btn(ph ? 'تأیید' : 'تأیید جا', 'primary', 'check')}${btn('چرخاندن', 'secondary', 'repeat')}</div>`;
  const note = (s) => `<span class="cx-note">${fa(s)} امتیاز</span>`;
  const rail = `<section class="cx-card"><h3>دور ${fa(7)} از ${fa(12)}</h3><div class="gc-pills"><span class="bgv-chip">${A ? `<img src="${A('kingdomino-king-blue')}" alt="">` : ''}شاه شما: آبی</span><span class="bgv-chip">دومینوی مانده: ${fa(16)}</span></div><div class="ga-rule">${ic('info')}<span>دومینو باید دست‌کم با یک نیمه به زمین هم‌جنس یا قلعه بچسبد و قلمرو از ${fa(5)}×${fa(5)} بزرگ‌تر نشود. امتیاز هر منطقه: تعداد خانه × تعداد تاج. ترتیب دور بعد را جای شاه‌ها در ستون دور بعد تعیین می‌کند.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const BT = byTerrain(ME_END);
  const REG = regions(ME_END).filter((r) => r.pts).sort((a, b) => b.pts - a.pts);
  const endRows = [
    { c: ['شما', ...['F', 'W', 'L', 'G', 'S', 'M'].map((t) => fa(BT[t])), fa(S.end), fa(largest(ME_END)), fa(crowns(ME_END))], win: true },
    { c: ['سارا', fa(4), fa(6), fa(6), fa(9), fa(6), fa(0), fa(31), fa(6), fa(10)] },
    { c: ['رضا', fa(9), fa(2), fa(0), fa(12), fa(0), fa(6), fa(29), fa(8), fa(9)] },
    { c: ['نیلوفر', fa(6), fa(12), fa(6), fa(0), fa(0), fa(2), fa(26), fa(6), fa(9)] },
  ];
  const endM = (ph) => modal('پایان بازی', `<p>دور ${fa(12)} تمام شد. منطقه‌های هر قلمرو شمرده شد: خانه × تاج.</p>${tbl(['بازیکن', 'گندم', 'جنگل', 'دریا', 'چمن', 'باتلاق', 'معدن', 'جمع', 'بزرگ‌ترین', 'تاج'], endRows)}<p class="cx-note">تساوی: بزرگ‌ترین منطقه، بعد بیشترین تاج؛ اگر باز مساوی بود، برد مشترک است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const oppsLate = (turn) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: turn === -1 ? '' : '0:35', turn: turn === 2, meta: seatMeta('orange', 26, 9) },
    { name: 'رضا', av: 'ر', seat: 6, clock: turn === -1 ? '' : '0:20', turn: turn === 6, meta: seatMeta('green', 29, 9) },
    { name: 'سارا', av: 'س', seat: 4, clock: turn === -1 ? '' : '0:48', turn: turn === 4, meta: seatMeta('pink', 31, 10) },
  ];
  const LOG = [[4, 'سارا دومینوی ۹ را گذاشت و دومینوی ۴۶ را برداشت'], [1, 'نوبت شما']];

  return {
    slug: 'Kingdomino', fa: 'کینگ‌دومینو', latin: 'Kingdomino', meta: ['زنده', '۴ نفر', 'دور ۷ از ۱۲'],
    opps: opps(1),
    me: { cards: [], clock: '0:55', turn: true, note: note(S.me), above: above(ME7, { legal: legalCells, ghost: [20, ...PLACE.slice(1)] }, placeSide) },
    table: table(),
    status: `<b>نوبت شماست، گام ۱: گذاشتن.</b> دومینوی ${fa(20)} (گندمزار با تاج و دریاچه) زیر شاه شماست. خانه‌های خط‌چین جاهای مجاز نیمهٔ گندمزارند. این جا گندمزار و دریاچه را به منطقه‌های خودشان وصل می‌کند: ${fa(GAIN)}+ امتیاز.`,
    pstatus: `<b>گام ۱: گذاشتن.</b> این جا ${fa(GAIN)}+ امتیاز دارد.`,
    railCard: rail,
    logNote: `دور ${fa(7)}`,
    log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'قلمروها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'دور اول: انتخاب', turnSub: 'شاهتان را روی یک دومینو بگذارید',
        meta: ['زنده', '۴ نفر', 'دور ۱ از ۱۲'],
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: seatMeta('orange', 0, 0) },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: seatMeta('green', 0, 0) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: seatMeta('pink', 0, 0) },
        ],
        me: { clock: '0:30', note: note(0), above: above(build([], 'empty'), {}, (ph) => `<div class="kd-btns">${btn('انتخاب', 'primary', 'check')}</div>`) },
        table: table({ noMinis: true, lines: (ph) => line('دور ۱', [[3, null, 'free'], [10, 'green'], [19, null, 'sel'], [28, null, 'free']], ph, `مانده: ${fa(44)}`) }),
        status: `<b>شاهتان را روی یک دومینو بگذارید.</b> در دور اول ترتیب انتخاب قرعه‌ای است: رضا دومینوی ${fa(10)} را برداشت و حالا نوبت شماست؛ بعد سارا و نیلوفر. شمارهٔ کمتر یعنی دور بعد زودتر می‌گذارید، ولی دومینوهای پرتاج شمارهٔ بزرگ دارند.`,
        pstatus: `<b>دور ۱.</b> یک دومینو انتخاب کنید.`,
        log: [[1, 'بازی با ۴ نفر شروع شد'], [6, 'رضا دومینوی ۱۰ را برداشت'], [1, 'نوبت شما']],
        logNote: `دور ${fa(1)}`,
        phone: true,
      },
      {
        shotTitle: 'گام ۲: انتخاب از دور بعد', turnSub: 'دومینوی دور بعد و جای شما در ترتیب',
        me: { note: note(S.me8), above: above(ME8, { hl: 20 }, (ph) => `<div class="kd-btns">${btn(ph ? 'انتخاب ۲۷' : 'انتخاب دومینوی ۲۷', 'primary', 'check')}</div>`) },
        table: table({ cur: [[9, null, 'done'], [20, null, 'done'], [33, 'orange'], [41, 'green']], next: [[16, null, 'free'], [27, 'blue', 'sel'], [38, null, 'free'], [46, 'pink']] }),
        status: `<b>گام ۲: دومینوی دور بعد را انتخاب کنید.</b> دومینوی ${fa(20)} نشست و امتیازتان ${fa(S.me8)} شد. ${fa(16)}، ${fa(27)} و ${fa(38)} آزادند؛ ${fa(46)} مال ساراست. با ${fa(27)} (جنگل با تاج) دور بعد نفر دوم می‌گذارید.`,
        pstatus: `<b>گام ۲.</b> دومینوی ${fa(27)} انتخاب شده است.`,
        log: [[4, 'سارا دومینوی ۹ را گذاشت و دومینوی ۴۶ را برداشت'], [1, 'شما دومینوی ۲۰ را گذاشتید: ۴+'], [1, 'انتخاب از دور بعد']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر نیلوفر',
        opps: opps(2),
        me: { turn: false, note: note(S.me8), above: above(ME8, {}, null) },
        table: table({ cur: [[9, null, 'done'], [20, null, 'done'], [33, 'orange', 'own'], [41, 'green']], next: [[16, null], [27, 'blue'], [38, null], [46, 'pink']], nil: NIL_PEND, nilHl: 33 }),
        status: `<b>نوبت نیلوفر است.</b> دومینوی ${fa(33)} را در قلمروش گذاشته و هنوز تأیید نکرده (قاب طلایی). بعد از او رضا می‌گذارد. شاه شما روی ${fa(27)} است، پس دور بعد نفر دوم هستید.`,
        pstatus: `<b>نوبت نیلوفر.</b> شاه شما روی ${fa(27)} است.`,
        log: [[4, 'سارا دومینوی ۹ را گذاشت و دومینوی ۴۶ را برداشت'], [1, 'شما دومینوی ۲۰ را گذاشتید و ۲۷ را برداشتید'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'جایی برای دومینو نیست', turnSub: 'دور آخر، کنار گذاشتن',
        meta: ['زنده', '۴ نفر', 'دور ۱۲ از ۱۲'],
        me: { clock: '0:40', note: note(S.end), above: above(ME_END, {}, (ph) => `<div class="kd-hold-w"><small>دومینوی شما</small>${domImg(8)}</div><div class="kd-btns">${btn('کنار گذاشتن', 'primary', 'x')}</div>`) },
        opps: oppsLate(0),
        table: table({ noMinis: true, lines: (ph) => line('دور ۱۲، آخر', [[5, null, 'done'], [8, 'blue', 'own'], [35, 'orange'], [48, 'green']], ph, 'دور بعد ندارد') }),
        status: `<b>جایی برای این دومینو نیست.</b> دومینوی ${fa(8)} دو دریاچه است و دو خانهٔ خالی قلمرو شما فقط به گندمزار، جنگل و باتلاق می‌چسبند. دومینو کنار می‌رود و امتیازی ندارد. دور آخر است، پس انتخاب دور بعد هم ندارید.`,
        pstatus: `<b>جایی نیست.</b> دومینوی ${fa(8)} کنار می‌رود.`,
        log: [[4, 'سارا دومینوی ۵ را گذاشت'], [1, 'دومینوی ۸ جایی در قلمرو شما ندارد']],
        logNote: `دور ${fa(12)}`,
        phone: true,
      },
      {
        shotTitle: 'شمارش منطقه‌ها', turnSub: 'خانه × تاج روی قلمرو',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: oppsLate(-1),
        me: { turn: false, clock: '', note: note(S.end), above: above(ME_END, { labels: true }, (ph) => `<div class="kd-sum">${REG.map((r) => `<span><b>${TN[r.t]}</b>${fa(r.size)} خانه × ${fa(r.crowns)} تاج = ${fa(r.pts)}</span>`).join('')}<span class="kd-sum__t">جمع: ${fa(S.end)}</span></div>`) },
        table: table({ noMinis: true, lines: (ph) => `<p class="kd-done">${ic('trophy')}دور ${fa(12)} تمام شد. منطقه‌های هر قلمرو یکی‌یکی شمرده می‌شوند.</p>` }),
        status: `<b>شمارش امتیاز.</b> هر منطقهٔ پیوسته از یک نوع زمین: تعداد خانه‌ها × تعداد تاج‌ها. منطقهٔ بی‌تاج امتیازی ندارد. قلمرو شما ${fa(S.end)} امتیاز شد.`,
        pstatus: `<b>شمارش امتیاز:</b> ${fa(S.end)} امتیاز.`,
        log: [[6, 'رضا دومینوی ۴۸ را گذاشت'], [1, 'شمارش منطقه‌ها']],
        logNote: `دور ${fa(12)}`,
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و برنده',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: oppsLate(-1),
        me: { turn: false, clock: '', note: note(S.end), above: above(ME_END, { labels: true }, null) },
        table: table({ noMinis: true, lines: () => '' }),
        overlay: endM,
        status: `<b>بازی تمام شد.</b> شما با ${fa(S.end)} امتیاز بردید.`,
        log: [[6, 'رضا دومینوی ۴۸ را گذاشت'], [1, `امتیاز شما: ${fa(S.end)}`], [1, 'شما بردید']],
        logNote: `دور ${fa(12)}`,
      },
    ],
    css: `.gc-table{gap:22px;align-items:center}
.kd-lines{display:flex;gap:34px;direction:ltr;padding-inline-start:22px}
.kd-line{display:grid;gap:8px;align-content:start;--dw:128px}
.kd-line h4{margin:0;display:flex;flex-direction:column;align-items:center;gap:0;font-size:13.5px;color:var(--felt-ink);direction:rtl}
.kd-line h4 small{font-size:11.5px;font-weight:400;color:var(--felt-muted)}
.kd-slot{position:relative;inline-size:var(--dw);block-size:calc(var(--dw) / 2);border-radius:4px}
.kd-ld{display:block;inline-size:100%;block-size:100%;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 12px -8px rgba(0,0,0,.6)}
.kd-no{position:absolute;inset-inline-start:-22px;inset-block-start:50%;transform:translateY(-50%);font-size:11.5px;color:var(--felt-muted);inline-size:18px;text-align:center}
.kd-king{position:absolute;inset-inline-start:calc(var(--dw) * .14);inset-block-start:calc(var(--dw) * -.06);inline-size:calc(var(--dw) * .24);filter:drop-shadow(0 3px 3px rgba(0,0,0,.55))}
.kd-slot.is-free .kd-ld{box-shadow:0 0 0 2px rgba(250,245,236,.75),0 8px 12px -8px rgba(0,0,0,.6)}
.kd-slot.is-sel .kd-ld{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 14px -8px rgba(0,0,0,.7)}
.kd-slot.is-own{box-shadow:0 0 0 3px var(--felt-gold)}
.kd-slot.is-done{box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.2);display:grid;place-items:center}
.kd-empty{font-size:11.5px;color:var(--felt-muted)}
.kd-minis{display:grid;gap:10px}
.kd-mini{margin:0;display:grid;gap:4px;justify-items:start}
.kd-mini figcaption{display:flex;align-items:center;gap:6px;color:var(--felt-ink);font-size:13px;inline-size:100%}
.kd-mini figcaption b{margin-inline-start:auto;color:var(--felt-gold)}
.kd-mk{inline-size:13px}
.kd-k{position:relative;inline-size:calc(var(--s) * 5);block-size:calc(var(--s) * 5);flex:none;border-radius:6px;background-color:rgba(8,18,26,.35);background-image:linear-gradient(rgba(250,245,236,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(250,245,236,.09) 1px,transparent 1px);background-size:var(--s) var(--s);box-shadow:inset 0 0 0 1px rgba(250,245,236,.16);direction:ltr}
.kd-castle{position:absolute;inline-size:var(--s);block-size:var(--s)}
.kd-d{position:absolute;inline-size:calc(var(--s) * 2);block-size:var(--s);box-shadow:0 1px 2px rgba(0,0,0,.4)}
.kd-d.is-ghost{opacity:.92}
.kd-box{position:absolute;box-sizing:border-box;border:3px solid var(--felt-gold);border-radius:3px;box-shadow:0 0 0 3px rgba(232,166,66,.35);pointer-events:none}
.kd-legal{position:absolute;inline-size:calc(var(--s) - 8px);block-size:calc(var(--s) - 8px);margin:4px;box-sizing:border-box;border:2px dashed var(--felt-gold);border-radius:6px;background:rgba(232,166,66,.16)}
.kd-lab{position:absolute;margin:3px;padding:1px 5px;border-radius:999px;background:#142B3B;color:#FAF5EC;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 0 0 1.5px var(--felt-gold);z-index:2}
.kd-me{display:flex;align-items:center;justify-content:center;gap:22px;inline-size:100%}
.kd-side{display:grid;justify-items:center;gap:10px}
.kd-hold-w{display:grid;justify-items:center;gap:4px}
.kd-hold-w small{color:var(--felt-muted);font-size:12.5px}
.kd-hold{inline-size:100px;block-size:50px;border-radius:3px;box-shadow:0 0 0 3px var(--felt-gold),0 8px 12px -6px rgba(0,0,0,.6)}
.kd-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.kd-sk{inline-size:12px}
.kd-sum{display:grid;gap:6px;font-size:13px;color:var(--felt-ink)}
.kd-sum span{display:flex;gap:8px;white-space:nowrap}
.kd-sum b{min-inline-size:54px;color:var(--felt-muted);font-weight:600}
.kd-sum__t{margin-block-start:4px;padding-block-start:6px;border-block-start:1px solid rgba(250,245,236,.2);font-weight:800;color:var(--felt-gold)!important}
.kd-done{margin:0;display:flex;align-items:center;gap:8px;color:var(--felt-ink);font-size:14px}
.kd-done .bgv-icon{color:var(--felt-gold)}
.kd-me--ph .kd-sum{display:none}
.bgv-chip img{inline-size:14px;margin-inline-end:4px}
.cx-phone .gc-table{gap:0}
.kd-lines--ph{gap:30px;padding-inline-start:18px}
.kd-lines--ph .kd-line{--dw:80px;gap:5px}
.kd-lines--ph .kd-line h4{font-size:12px;line-height:1.3}
.kd-lines--ph .kd-line h4 small{font-size:10.5px}
.kd-lines--ph .kd-no{font-size:10.5px;inset-inline-start:-19px}
.kd-lines--ph .kd-empty{font-size:10px}
.kd-me--ph{flex-direction:column;gap:6px}
.kd-me--ph .kd-side{display:flex;align-items:center;gap:8px;padding-inline:10px}
.kd-me--ph .kd-hold-w small{display:none}
.kd-me--ph .kd-hold{inline-size:72px;block-size:36px}`,
    shotTitle: 'نوبت شما', turnSub: 'گام ۱: گذاشتن دومینو در قلمرو',
    diffs: [
      ['چیدمان', 'مثل BGA: ستون «این دور» و «دور بعد» وسط میز (شمارهٔ کمتر بالا)، شاه‌ها روی دومینوها، قلمرو کوچک هر حریف کنار ستون‌ها و قلمرو شما پایین. رنگ شاه‌ها همان چهار رنگ بازی است و کنار نام هر نفر آمده'],
      ['گذاشتن', 'خانه‌های مجاز با خط‌چین طلایی؛ جای پیشنهادی با قاب طلایی و امتیاز تازه («+۴») کنار دومینو. خانه‌ها و امتیازها از روی خود دومینوهای چاپی حساب شده‌اند'],
      ['انتخاب', 'بعد از گذاشتن، دومینوی آزاد دور بعد را برمی‌دارید و جای شاهتان ترتیب دور بعد را تعیین می‌کند (§۵). در دور اول ترتیب قرعه‌ای است (§۴)'],
      ['۲ نفر', 'در بازی دونفره هر نفر دو شاه دارد و همین دو گام برای هر شاه جدا تکرار می‌شود، با برچسب «شاه ۱» و «شاه ۲» روی دکمه‌ها'],
      ['استثنا و پایان', 'اگر دومینو جایی نداشته باشد «کنار گذاشتن» می‌آید (§۷). آخر بازی منطقه‌ها با «خانه × تاج» روی قلمرو شمرده می‌شوند (§۸) و جدول، تساوی را با بزرگ‌ترین منطقه و تاج‌ها نشان می‌دهد (§۹)'],
      ['قوانین', 'مثل BGA و موتور: ۲ تا ۴ نفر، بازی پایه با قلمرو ۵×۵؛ چهارنفره ۱۲ دور با ۴۸ دومینو. آرت نسخهٔ ۲۰۱۶ BGA'],
    ],
  };
}
