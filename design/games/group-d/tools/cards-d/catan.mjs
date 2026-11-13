// Catan on the group D frame (repo engine: 3–4 players, base game, board option random | beginner). Board = the site renderer's beginner island
// (ready to use/boards/beginner-island.png, robber erased), SVG viewBox -320..320 × -316..316, pointy-top hexes r=60 at row spacing 90.
// Players: you blue (seat 1), Niloufar orange (seat 2), Sara white (seat 4). Mid-game; you rolled 8 and chose «جاده».
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const ROWS = [3, 4, 5, 4, 3];
  const HEX = [['کوهستان', 10], ['مرتع', 2], ['جنگل', 9], ['مزرعه', 12], ['تپه', 6], ['مرتع', 4], ['تپه', 10], ['مزرعه', 9], ['جنگل', 11], ['بیابان', 0], ['جنگل', 3], ['کوهستان', 8], ['جنگل', 8], ['کوهستان', 3], ['مزرعه', 4], ['مرتع', 5], ['تپه', 5], ['مزرعه', 6], ['مرتع', 11]];
  const C = []; ROWS.forEach((n, r) => { for (let i = 0; i < n; i++) C.push([(i - (n - 1) / 2) * 103.923, (r - 2) * 90]); });
  const CORNER = [[0, -60], [51.96, -30], [51.96, 30], [0, 60], [-51.96, 30], [-51.96, -30]];
  // vertex graph
  const V = new Map(); const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  const vtx = (h, c) => { const x = C[h][0] + CORNER[c][0], y = C[h][1] + CORNER[c][1]; const k = key(x, y); if (!V.has(k)) V.set(k, { x, y, n: new Set() }); return k; };
  C.forEach((_, h) => { for (let c = 0; c < 6; c++) { const a = vtx(h, c), b = vtx(h, (c + 1) % 6); V.get(a).n.add(b); V.get(b).n.add(a); } });
  const ek = (a, b) => [a, b].sort().join('|');
  const E = (h, e) => ek(vtx(h, e), vtx(h, (e + 1) % 6));
  const P = (x, y) => `left:${((x + 320) / 640 * 100).toFixed(2)}%;top:${((y + 316) / 632 * 100).toFixed(2)}%`;
  const COL = { b: 'آبی', o: 'نارنجی', w: 'سفید' };
  const BASE = {
    b: { set: [vtx(11, 4), vtx(16, 4)], city: [vtx(4, 0)], road: [E(4, 5), E(4, 0), E(11, 3), E(11, 4), E(16, 3)] },
    o: { set: [vtx(7, 1), vtx(3, 0)], city: [vtx(13, 3)], road: [E(7, 1), E(13, 2), E(3, 5), E(7, 0)] },
    w: { set: [vtx(2, 2), vtx(15, 2)], city: [vtx(10, 0)], road: [E(2, 2), E(15, 3), E(10, 5), E(2, 1)] },
  };
  const occV = (st) => new Map(Object.entries(st).flatMap(([p, s]) => [...s.set, ...s.city].map((v) => [v, p])));
  const occE = (st) => new Set(Object.values(st).flatMap((s) => s.road));
  { // distance rule check on the mock
    const o = occV(BASE); for (const v of o.keys()) for (const n of V.get(v).n) if (o.has(n)) console.warn('catan mock breaks distance rule at', v, n);
  }
  const legalRoads = (st, p) => {
    const ov = occV(st), oe = occE(st), out = [];
    const ends = new Set([...st[p].set, ...st[p].city]); for (const r of st[p].road) for (const v of r.split('|')) if (!ov.has(v) || ov.get(v) === p) ends.add(v);
    for (const v of ends) for (const n of V.get(v).n) { const k = ek(v, n); if (!oe.has(k)) out.push(k); }
    return [...new Set(out)];
  };
  const legalSettle = (st, p, needRoad) => {
    const ov = occV(st), out = [];
    for (const [k, v] of V) { if (ov.has(k) || [...v.n].some((n) => ov.has(n))) continue; if (needRoad && !st[p].road.some((r) => r.split('|').includes(k))) continue; out.push(k); }
    return out;
  };
  const road = (k, p, cls = '') => { const [a, b] = k.split('|').map((x) => V.get(x)); const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; return `<img class="ct-road${cls}" style="${P((a.x + b.x) / 2, (a.y + b.y) / 2)};transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)" src="${H.ART['catan-road-' + p]}" alt="">`; };
  const spot = (k, kind, p, cls = '') => { const v = V.get(k); return `<img class="ct-${kind}${cls}" style="${P(v.x, v.y)}" src="${H.ART[`catan-${kind}-${p}`]}" alt="${kind === 'set' ? 'آبادی' : 'شهر'} ${COL[p]}">`; };
  const dot = (k) => { const v = V.get(k); return `<i class="ct-dot" style="${P(v.x, v.y)}"></i>`; };
  const edgeHi = (k) => { const [a, b] = k.split('|').map((x) => V.get(x)); const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; return `<i class="ct-edge" style="${P((a.x + b.x) / 2, (a.y + b.y) / 2)};transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)"></i>`; };
  const hexHi = (h, cls) => `<i class="ct-hexhi ${cls}" style="${P(C[h][0], C[h][1])}"></i>`;
  // o: { st, roads:[edges to highlight], dots:[vertices], hexes:[[h,cls]], robber:h, ghostRobber:h, ghostRoad:{k,p}, w }
  const board = (o, w) => {
    const st = o.st ?? BASE;
    let h = `<div class="ct-b" style="--bw:${w}px" role="img" aria-label="نقشهٔ کاتان">${img('catan-board', '')}`;
    for (const [hx, cls] of o.hexes ?? []) h += hexHi(hx, cls);
    for (const [p, s] of Object.entries(st)) for (const r of s.road) h += road(r, p);
    for (const k of o.roads ?? []) h += edgeHi(k);
    if (o.ghostRoad) h += road(o.ghostRoad.k, o.ghostRoad.p, ' is-ghost');
    for (const [p, s] of Object.entries(st)) { for (const v of s.set) h += spot(v, 'set', p); for (const v of s.city) h += spot(v, 'city', p); }
    for (const k of o.dots ?? []) h += dot(k);
    if (o.ghostSet) h += spot(o.ghostSet.k, 'set', o.ghostSet.p, ' is-ghost');
    h += `<img class="ct-robber" style="${P(C[o.robber ?? 9][0], C[o.robber ?? 9][1] + 8)}" src="${H.ART['catan-robber']}" alt="دزد">`;
    if (o.ghostRobber != null) h += `<img class="ct-robber is-ghost" style="${P(C[o.ghostRobber][0], C[o.ghostRobber][1] + 8)}" src="${H.ART['catan-robber']}" alt="جای تازهٔ دزد">`;
    return h + '</div>';
  };
  const RES = [['wood', 'چوب'], ['brick', 'آجر'], ['wool', 'پشم'], ['grain', 'گندم'], ['ore', 'سنگ']];
  const RFA = Object.fromEntries(RES);
  const card = (r, n, cls = '') => `<span class="ct-card${cls}" aria-label="${fa(n)} ${RFA[r]}">${img('catan-res-' + r, '')}${n > 1 ? `<b>${fa(n)}</b>` : ''}</span>`;
  const HAND = { wood: 2, brick: 2, wool: 1, grain: 2, ore: 3 };
  const handRow = (hand, sel = {}) => `<div class="ct-hand" aria-label="دست شما">${RES.filter(([r]) => hand[r]).map(([r]) => card(r, hand[r], sel[r] ? ' is-sel' : '')).join('')}<span class="ct-dev" aria-label="کارت‌های توسعهٔ شما">${img('catan-dev-knight', 'شوالیه')}${img('catan-dev-vp', 'امتیاز')}</span></div>`;
  const mini = (r) => `<img class="ct-mini" src="${H.ART['catan-res-' + r]}" alt="${RFA[r]}">`;
  const COST = [['جاده', ['wood', 'brick'], true, 'road'], ['آبادی', ['wood', 'brick', 'wool', 'grain'], true, 'set'], ['شهر', ['grain', 'grain', 'ore', 'ore', 'ore'], true, 'city'], ['کارت توسعه', ['wool', 'grain', 'ore'], true, 'dev']];
  const buildBar = (active, ph) => `<div class="ct-build" role="group" aria-label="ساخت">${COST.map(([l, c, ok, k]) => `<button type="button" class="ct-bb${active === k ? ' is-on' : ''}"${ok ? '' : ' disabled'}><b>${l}</b>${ph ? '' : `<span>${c.map(mini).join('')}</span>`}</button>`).join('')}${ph ? '' : `<button type="button" class="ct-bb ct-bb--alt"><b>معامله</b><span>${ic('repeat')}</span></button>`}</div>`;
  const dice = (a, b) => `<span class="ct-dice" aria-label="تاس ${fa(a + b)}">${img('catan-die-' + a, '')}${img('catan-die-' + b, '')}<b>${fa(a + b)}</b></span>`;
  const side = (o, ph) => ph ? '' : `<aside class="ct-side"><div class="ct-bank"><small>بانک</small>${RES.map(([r]) => `<span>${img('catan-res-' + r, RFA[r])}<b>${fa(o.bank?.[r] ?? { wood: 12, brick: 13, wool: 15, grain: 11, ore: 9 }[r])}</b></span>`).join('')}<span>${img('catan-dev-back', 'دستهٔ توسعه')}<b>${fa(o.devLeft ?? 18)}</b></span></div>${o.dice ? dice(...o.dice) : ''}<div class="ct-awards">${img('catan-award-road', 'بلندترین جاده')}${img('catan-award-army', 'بزرگ‌ترین ارتش')}<small>جاده: هنوز کسی<br>ارتش: نیلوفر</small></div></aside>`;
  const table = (o) => (ph) => `${board(o, ph ? 366 : 486)}${side(o, ph)}`;
  const above = (o) => (ph) => `<div class="ct-me${ph ? ' ct-me--ph' : ''}">${o.bar === false ? '' : `<div class="ct-acts">${o.pre ?? ''}${buildBar(o.active, ph)}${o.post ?? ''}</div>`}${handRow(o.hand ?? HAND, o.sel)}</div>`;
  const opps = (turn, extra = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:30', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${fa(extra.n ?? 6)} امتیاز</span><span>${fa(7)} کارت</span><span>شوالیه ${fa(3)}</span>` },
    { name: 'سارا', av: 'س', seat: 4, clock: '1:10', turn: turn === 4, meta: `<span class="gc-tag gc-tag--soft">${fa(extra.s ?? 5)} امتیاز</span><span>${fa(9)} کارت</span><span>جاده ${fa(5)}</span>` },
  ];
  const rail = `<section class="cx-card"><h3>هزینهٔ ساخت</h3>${img('catan-cost', 'جدول هزینهٔ ساخت')}<div class="ga-rule">${ic('info')}<span>بلندترین جاده (دست‌کم ${fa(5)} قطعه) و بزرگ‌ترین ارتش (دست‌کم ${fa(3)} شوالیه) هر کدام ${fa(2)} امتیاز دارند. اولین کسی که در نوبت خودش به ${fa(10)} امتیاز برسد می‌برد.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const picker = (rows) => `<div class="ct-pick">${rows.map(([lab, cells]) => `<div class="ct-pick__row"><small>${lab}</small>${cells.map(([r, n, sel]) => `<span class="ct-pc${sel ? ' is-sel' : ''}">${img('catan-res-' + r, RFA[r])}<b>${fa(n)}</b></span>`).join('')}</div>`).join('')}</div>`;

  const ST1 = BASE;
  const legal1 = legalRoads(ST1, 'b');
  const setup = { b: { set: [vtx(11, 4)], city: [], road: [E(11, 3)] }, o: { set: [vtx(7, 1), vtx(13, 3)], city: [], road: [E(7, 1), E(13, 2)] }, w: { set: [vtx(2, 2), vtx(15, 2)], city: [], road: [E(2, 2), E(15, 3)] } };
  const setupDots = legalSettle(setup, 'b', false);
  return {
    slug: 'Catan', fa: 'کاتان', latin: 'Catan', meta: ['زنده', '۳ نفر', 'نوبت ۱۲'],
    opps: opps(1),
    me: { cards: [], clock: '1:45', turn: true, note: `<span class="cx-note">${fa(4)} امتیاز</span>`, above: above({ active: 'road', post: btn('پایان نوبت', 'secondary', 'check') }) },
    table: table({ roads: legal1, ghostRoad: { k: legal1[0], p: 'b' }, hexes: [[11, 'is-roll'], [12, 'is-roll']], dice: [4, 4] }),
    status: `<b>نوبت شماست.</b> تاس ${fa(8)} آمد و از کوهستان یک سنگ گرفتید. «جاده» را زدید: ضلع‌های مجاز طلایی‌اند. یک ضلع را بزنید تا جاده ساخته شود (${fa(1)} چوب و ${fa(1)} آجر).`,
    pstatus: `<b>ساخت جاده.</b> یکی از ضلع‌های طلایی را بزنید.`,
    railCard: rail, logNote: `نوبت ${fa(12)}`,
    log: [[4, 'سارا شهر ساخت'], [2, 'نیلوفر ۱ آجر با سارا معامله کرد'], [1, 'تاس شما: ۸'], [1, 'شما ۱ سنگ گرفتید؛ نیلوفر ۱ چوب']],
    dockItems: [['repeat', 'معامله'], ['list', 'رویدادها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'چیدمان آغازین', turnSub: 'آبادی دوم، ترتیب مارپیچ',
        table: table({ st: setup, dots: setupDots, ghostSet: { k: vtx(4, 0), p: 'b' }, devLeft: 25, bank: { wood: 19, brick: 19, wool: 19, grain: 19, ore: 19 } }),
        me: { clock: '0:40', above: above({ bar: false, hand: {} }), note: `<span class="cx-note">${fa(1)} امتیاز</span>` },
        opps: opps(0, { n: 2, s: 2 }),
        status: `<b>آبادی دومتان را بگذارید.</b> ترتیب مارپیچ است: مینا ← نیلوفر ← سارا ← سارا ← نیلوفر ← <b>مینا</b>. تقاطع‌های مجاز نقطهٔ روشن دارند؛ بعد از آن یک جاده کنار همین آبادی می‌گذارید و منابع شش‌ضلعی‌های کنارش را می‌گیرید.`,
        log: [[1, 'آبادی اول شما'], [2, 'نیلوفر دو آبادی گذاشت'], [4, 'سارا دو آبادی گذاشت'], [1, 'آبادی دوم شما']],
      },
      {
        shotTitle: 'پیش از تاس', turnSub: 'انداختن تاس یا بازی شوالیه',
        table: table({}),
        me: { above: above({ bar: false, pre: `<div class="ct-acts">${btn('انداختن تاس', 'primary', 'repeat')}${btn('کارت توسعه', 'secondary', 'list')}</div>` }) },
        status: `<b>نوبت شماست.</b> اول تاس بیندازید. اگر بخواهید، می‌توانید پیش از تاس شوالیه بازی کنید و دزد را جابه‌جا کنید.`,
        log: [[4, 'سارا نوبتش را تمام کرد'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'تاس ۷: دور ریختن', turnSub: 'هر کس بیش از ۷ کارت دارد نصفش را می‌دهد',
        opps: opps(4), table: table({ dice: [3, 4] }),
        me: { turn: false, above: above({ bar: false }) },
        overlay: () => modal('۵ کارت دور بریزید', `<p>سارا ${fa(7)} آورد. شما ${fa(10)} کارت دارید، پس نصفش (${fa(5)} کارت) را به بانک برمی‌گردانید.</p>${picker([['دست شما', [['wood', 2, true], ['brick', 2], ['wool', 1, true], ['grain', 2, true], ['ore', 3, true]]], ['دور ریخته', [['wood', 2], ['wool', 1], ['grain', 1], ['ore', 1]]]])}<p class="cx-note">${fa(5)} از ${fa(5)} انتخاب شده</p>`, btn('دور ریختن', 'primary', 'check')),
        status: `<b>سارا ${fa(7)} آورد.</b> هم‌زمان با بقیه کارت‌هایتان را دور بریزید؛ بعد سارا دزد را جابه‌جا می‌کند.`,
        log: [[4, 'تاس سارا: ۷'], [1, 'شما باید ۵ کارت دور بریزید'], [2, 'نیلوفر دور ریختن ندارد']],
      },
      {
        shotTitle: 'جابه‌جایی دزد', turnSub: 'شوالیه یا تاس ۷: شش‌ضلعی و قربانی',
        table: table({ hexes: [[7, 'is-pick'], [3, 'is-can'], [13, 'is-can'], [17, 'is-can'], [2, 'is-can']], ghostRobber: 7 }),
        me: { above: above({ bar: false, hand: { wood: 2, brick: 2, wool: 1, grain: 2, ore: 3 } }) },
        overlay: (ph) => modal('از چه کسی بدزدید؟', `<p>دزد روی مزرعهٔ ${fa(9)} است. دو حریف کنارش ساختمان دارند؛ یک کارت تصادفی از دست یکی‌شان می‌گیرید.</p><div class="ct-victims"><button type="button" class="ct-vic is-sel"><span class="bgv-avatar bgv-avatar--sm seat-2">ن</span>نیلوفر<small>${fa(7)} کارت</small></button><button type="button" class="ct-vic"><span class="bgv-avatar bgv-avatar--sm seat-4">س</span>سارا<small>${fa(9)} کارت</small></button></div>`, btn('دزدیدن', 'primary', 'hand')),
        status: `<b>شوالیه بازی کردید.</b> دزد را روی یک شش‌ضلعی دیگر بگذارید (حلقه‌دارها ساختمان حریف دارند)؛ آن شش‌ضلعی تا جابه‌جایی بعدی تولید نمی‌کند.`,
        log: [[1, 'شما شوالیه بازی کردید'], [1, 'دزد را روی مزرعهٔ ۹ گذاشتید']],
      },
      {
        shotTitle: 'معامله', turnSub: 'پیشنهاد به بازیکنان و بانک',
        table: table({ dice: [4, 4] }),
        overlay: () => modal('پیشنهاد معامله', `${picker([['می‌دهم', [['wood', 1, true], ['brick', 0], ['wool', 0], ['grain', 0], ['ore', 1, true]]], ['می‌خواهم', [['wood', 0], ['brick', 0], ['wool', 1, true], ['grain', 0], ['ore', 0]]]])}${tbl(['حریف', 'پاسخ', ''], [{ c: ['نیلوفر', '<span class="ct-ok">پذیرفت</span>', btn('معامله با نیلوفر', 'primary', 'check')] }, { c: ['سارا', 'رد کرد', ''] }])}<p class="cx-note">با بانک: ${fa(4)} به ${fa(1)}؛ بندر ۳:۱ شما را ${fa(3)} به ${fa(1)} می‌کند.</p>`, `${btn('بانک ۴:۱', 'secondary', 'repeat')}${btn('لغو پیشنهاد', 'secondary', 'x')}`),
        status: `<b>معامله.</b> پیشنهاد شما: ${fa(1)} چوب و ${fa(1)} سنگ در برابر ${fa(1)} پشم. نیلوفر پذیرفته؛ می‌توانید با او معامله کنید.`,
        log: [[1, 'شما پیشنهاد معامله دادید'], [2, 'نیلوفر پذیرفت'], [4, 'سارا رد کرد']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'پیشنهاد سارا به شما',
        opps: opps(4), table: table({ dice: [5, 1] }),
        me: { turn: false, above: above({ bar: false }) },
        overlay: () => modal('پیشنهاد سارا', `<div class="ct-offer"><span><small>سارا می‌دهد</small>${card('brick', 1)}</span>${ic('repeat')}<span><small>سارا می‌خواهد</small>${card('grain', 1)}</span></div><p class="cx-note">فقط اگر منبع خواسته‌شده را داشته باشید «پذیرفتن» فعال است.</p>`, `${btn('رد کردن', 'secondary', 'x')}${btn('پذیرفتن', 'primary', 'check')}`),
        status: `<b>نوبت سارا است.</b> سارا ${fa(6)} آورد و به همه پیشنهاد معامله داده است. بقیهٔ نقشه تا نوبت شما فقط برای دیدن است.`,
        log: [[4, 'تاس سارا: ۶'], [4, 'سارا ۱ آجر می‌دهد و ۱ گندم می‌خواهد']],
      },
      {
        shotTitle: 'کارت توسعه', turnSub: 'انتخاب و بازی',
        table: table({}),
        overlay: () => modal('کارت‌های توسعهٔ شما', `<div class="ct-devs"><figure>${img('catan-dev-knight', 'شوالیه')}<figcaption>شوالیه</figcaption></figure><figure>${img('catan-dev-plenty', 'سال فراوانی')}<figcaption>سال فراوانی</figcaption></figure><figure class="is-new">${img('catan-dev-roads', 'جاده‌سازی')}<figcaption>جاده‌سازی<small>نوبت بعد</small></figcaption></figure><figure>${img('catan-dev-vp', 'امتیاز')}<figcaption>امتیاز<small>پنهان</small></figcaption></figure></div><p class="cx-note">در هر نوبت فقط یک کارت توسعه بازی می‌شود، و کارتی که همین نوبت خریده‌اید تا نوبت بعد قفل است. کارت امتیاز تا پایان پنهان می‌ماند.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('بازی سال فراوانی', 'primary', 'check')}`),
        status: '<b>کارت توسعه.</b> یکی از کارت‌های آزاد را انتخاب کنید.',
        log: [[1, 'شما یک کارت توسعه خریدید']],
      },
      {
        shotTitle: 'سال فراوانی', turnSub: 'دو منبع از بانک',
        table: table({}),
        overlay: () => modal('سال فراوانی: دو منبع بردارید', `<p>هر دو منبعی که می‌خواهید از بانک برمی‌دارید؛ می‌توانند یکی باشند.</p>${picker([['از بانک', [['wood', 12], ['brick', 13, true], ['wool', 15], ['grain', 11], ['ore', 9, true]]]])}<p class="cx-note">${fa(2)} از ${fa(2)} انتخاب شده: ${fa(1)} آجر و ${fa(1)} سنگ</p>`, `${btn('لغو', 'secondary', 'x')}${btn('برداشتن', 'primary', 'check')}`),
        status: '<b>سال فراوانی.</b> دو منبع از بانک انتخاب کنید؛ اگر بانک از منبعی خالی باشد، آن منبع خاکستری است.',
        log: [[1, 'شما سال فراوانی بازی کردید']],
      },
      {
        shotTitle: 'انحصار', turnSub: 'نام یک منبع',
        table: table({}),
        overlay: () => modal('انحصار: یک منبع را نام ببرید', `<p>همهٔ حریف‌ها هر چه از این منبع دارند به شما می‌دهند.</p>${picker([['منبع', [['wood', 0], ['brick', 0], ['wool', 0], ['grain', 0, true], ['ore', 0]]]])}<p class="cx-note">گندم: نیلوفر و سارا با هم ${fa(3)} کارت می‌دهند (تعداد بعد از تأیید معلوم می‌شود).</p>`, `${btn('لغو', 'secondary', 'x')}${btn('انحصار گندم', 'primary', 'check')}`),
        status: '<b>انحصار.</b> یک منبع را انتخاب کنید؛ همهٔ کارت‌های آن منبع از دست حریف‌ها به دست شما می‌آید.',
        log: [[1, 'شما انحصار بازی کردید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و برنده',
        opps: opps(0, { n: 8, s: 7 }), table: table({}),
        me: { turn: false, clock: '', above: above({ bar: false }), note: `<span class="cx-note">${fa(10)} امتیاز</span>` },
        overlay: () => modal('شما با ۱۰ امتیاز بردید', tbl(['بازیکن', 'آبادی', 'شهر', 'جاده', 'ارتش', 'کارت امتیاز', 'جمع'], [{ c: ['شما', fa(2), `${fa(2)} (${fa(4)})`, fa(2), '—', fa(2), fa(10)], win: true }, { c: ['نیلوفر', fa(2), `${fa(2)} (${fa(4)})`, '—', fa(2), fa(0), fa(8)] }, { c: ['سارا', fa(3), `${fa(2)} (${fa(4)})`, '—', '—', fa(0), fa(7)] }]) + '<p class="cx-note">کارت‌های امتیاز حالا رو می‌شوند.</p>', `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        status: '<b>بازی تمام شد.</b> شما در نوبت خودتان به ۱۰ امتیاز رسیدید.',
        log: [[1, 'شما شهر ساختید'], [1, 'شما بلندترین جاده را گرفتید'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{gap:14px;align-items:center}
.ct-b{position:relative;inline-size:var(--bw);direction:ltr;flex:none}
.ct-b>img:first-child{display:block;inline-size:100%;block-size:auto}
.ct-road{position:absolute;inline-size:7.6%;block-size:1.9%;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.ct-set,.ct-city{position:absolute;inline-size:6.6%;block-size:auto;transform:translate(-50%,-62%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.55))}
.ct-city{inline-size:8%}
.ct-road.is-ghost,.ct-set.is-ghost{opacity:.7;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 2px var(--felt-gold))}
.ct-robber{position:absolute;inline-size:5.6%;block-size:auto;transform:translate(-50%,-78%);filter:drop-shadow(0 3px 3px rgba(0,0,0,.6))}
.ct-robber.is-ghost{filter:drop-shadow(0 0 4px var(--felt-gold)) drop-shadow(0 3px 3px rgba(0,0,0,.6))}
.ct-dot{position:absolute;inline-size:2.6%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:#FAF5EC;box-shadow:0 0 0 2px var(--felt-gold),0 0 6px 2px rgba(232,166,66,.7)}
.ct-edge{position:absolute;inline-size:7.4%;block-size:1.6%;border-radius:4px;background:rgba(232,166,66,.85);box-shadow:0 0 6px 2px rgba(232,166,66,.6)}
.ct-hexhi{position:absolute;inline-size:16.2%;aspect-ratio:.866;transform:translate(-50%,-50%);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.ct-hexhi.is-roll{background:radial-gradient(circle,rgba(255,230,140,.15) 40%,rgba(232,166,66,.75) 100%)}
.ct-hexhi.is-can{background:rgba(250,245,236,.18)}
.ct-hexhi.is-pick{background:rgba(232,166,66,.35)}
.ct-side{display:grid;gap:12px;justify-items:center;inline-size:150px}
.ct-bank{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3)}
.ct-bank small{grid-column:1/-1;color:var(--felt-muted);font-size:12px}
.ct-bank span{position:relative;display:grid;justify-items:center}
.ct-bank img{inline-size:34px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.ct-bank b{font-size:12px;color:var(--felt-ink)}
.ct-dice{display:flex;align-items:center;gap:6px;color:var(--felt-ink)}.ct-dice img{inline-size:36px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}.ct-dice b{font-size:20px;margin-inline-start:4px}
.ct-awards{display:grid;grid-template-columns:1fr 1fr;gap:6px;justify-items:center}.ct-awards img{inline-size:66px;border-radius:4px}.ct-awards small{grid-column:1/-1;font-size:11.5px;line-height:1.6;color:var(--felt-muted);text-align:center}
.ct-me{display:grid;gap:8px;justify-items:center;inline-size:100%}
.ct-acts{display:flex;gap:8px;align-items:stretch;justify-content:center;flex-wrap:wrap}
.ct-build{display:flex;gap:6px}
.ct-bb{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:2px;padding:5px 10px;min-block-size:44px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.ct-bb b{font-size:13px}.ct-bb span{display:flex;gap:1px}.ct-mini{inline-size:13px;border-radius:2px}
.ct-bb.is-on{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.ct-bb--alt span .bgv-icon{inline-size:16px;block-size:16px}
.ct-hand{display:flex;gap:6px;align-items:flex-end;direction:ltr}
.ct-card{position:relative;display:block}.ct-card img{display:block;inline-size:54px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 12px -6px rgba(0,0,0,.6)}
.ct-card b{position:absolute;inset-block-start:-6px;inset-inline-end:-6px;min-inline-size:22px;block-size:22px;border-radius:11px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:12.5px;box-shadow:0 0 0 2px #FAF5EC}
.ct-card.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}
.ct-dev{display:flex;margin-inline-start:12px}.ct-dev img{inline-size:46px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3)}.ct-dev img+img{margin-inline-start:-22px}
.ct-pick{display:grid;gap:10px}.ct-pick__row{display:flex;align-items:center;gap:12px;direction:ltr}.ct-pick__row small{direction:rtl;inline-size:64px;flex:none;margin-inline-end:6px;font-size:12.5px;color:var(--text-muted)}
.ct-pc{position:relative}.ct-pc img{inline-size:46px;border-radius:4px;display:block}.ct-pc b{position:absolute;inset-block-end:-6px;inset-inline-end:-6px;min-inline-size:20px;block-size:20px;border-radius:10px;display:grid;place-items:center;background:var(--surface);color:var(--heading);font-size:12px;box-shadow:0 0 0 1.5px var(--border)}
.ct-pc.is-sel img{box-shadow:0 0 0 3px var(--felt-gold,#E8A642)}
.ct-victims{display:flex;gap:10px}.ct-vic{all:unset;box-sizing:border-box;cursor:pointer;flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;min-block-size:48px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1.5px var(--border)}.ct-vic small{margin-inline-start:auto;color:var(--text-muted)}.ct-vic.is-sel{box-shadow:inset 0 0 0 2px #E8A642;background:rgba(232,166,66,.1)}
.ct-offer{display:flex;align-items:center;justify-content:center;gap:18px}.ct-offer span{display:grid;justify-items:center;gap:6px}.ct-offer small{color:var(--text-muted)}
.ct-ok{color:#2E8B57;font-weight:800}
.ct-devs{display:flex;gap:10px;justify-content:center}.ct-devs figure{margin:0;display:grid;justify-items:center;gap:4px;font-size:12.5px}.ct-devs img{inline-size:74px;border-radius:5px}.ct-devs small{display:block;color:var(--text-muted);font-size:11px}.ct-devs .is-new img{opacity:.55}
.cx-phone .gc-table{gap:0}
.ct-me--ph{gap:6px}.ct-me--ph .ct-bb{padding:5px 8px}.ct-me--ph .ct-card img{inline-size:46px}.ct-me--ph .ct-dev img{inline-size:38px}.ct-me--ph .ct-acts{flex-wrap:nowrap}`,
    shotTitle: 'نوبت شما', turnSub: 'بعد از تاس: ساخت جاده',
    diffs: [
      ['چیدمان', 'مثل BGA: نقشهٔ جزیره وسط، کنارش بانک (پنج منبع و دستهٔ توسعه با عدد مانده)، تاس و دو کارت جایزه. دست شما پایین، دسته‌دسته با عدد'],
      ['ساخت', 'نوار ساخت با هزینهٔ هر دکمه؛ با زدن هر دکمه جاهای مجاز روی نقشه روشن می‌شود (ضلع طلایی برای جاده، نقطه برای آبادی)، و پیش‌نمایش کم‌رنگ قطعه روی جای انتخاب‌شده'],
      ['تاس', 'شش‌ضلعی‌های هم‌عدد تاس حلقهٔ طلایی می‌گیرند؛ تاس ۷ پنجرهٔ دور ریختن هم‌زمان (§۶) و بعد جابه‌جایی دزد و انتخاب قربانی (§۷) دارد'],
      ['معامله', 'پیشنهاد به بازیکنان با جدول پاسخ‌ها، معامله با بانک و بندر (§۸)، و پاسخ به پیشنهاد حریف در نوبت او (§۹)'],
      ['کارت توسعه', 'کارت تازه‌خریده تا نوبت بعد کم‌رنگ و قفل است؛ کارت امتیاز پنهان می‌ماند تا پایان (§۱۰). انتخاب منبع برای سال فراوانی (§۱۱) و انحصار (§۱۲)'],
      ['قوانین', 'مثل موتور: ۳ تا ۴ نفر، بازی پایه، ۱۰ امتیاز در نوبت خودتان؛ نقشهٔ این طرح همان نقشهٔ مبتدی دفترچه است و گزینهٔ «متغیر» همین قاب را با چیدمان دیگر پر می‌کند'],
    ],
  };
}
