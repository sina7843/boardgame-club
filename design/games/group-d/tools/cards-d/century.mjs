// Century: Spice Road («جاده ابریشم») on the group D frame. Repo engine: 2–5 players, explicit 36-merchant / 36-order set (art = the site's
// ready-to-use card renders, shown at native size, never upscaled). Layout like BGA-style tables: order row with gold/silver piles on the first
// two, merchant row with costs 0–5 and spices left on cards, your caravan (10 slots) and hand below.
// Mock: 3 players (game ends with the 6th order), turn order نیلوفر → رضا → شما. Card effects and order needs are the real data
// (ready to use/data/asset-manifest.json); every caravan below follows from the previous one by the shown action.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART[n];
  const SP = ['y', 'r', 'g', 'b'];
  const SN = { y: 'زردچوبه', r: 'زعفران', g: 'هل', b: 'دارچین' };
  const M = { 0: ['spice', { y: 2 }], 1: ['up', 2], 5: ['spice', { y: 1, g: 1 }], 9: ['spice', { r: 1, g: 1 }], 12: ['spice', { y: 2, r: 2 }], 14: ['up', 3], 17: ['trade', { y: 3 }, { r: 1, g: 1 }], 20: ['trade', { y: 5 }, { b: 2 }], 21: ['trade', { r: 1 }, { y: 3 }], 26: ['trade', { g: 1 }, { r: 2 }], 27: ['trade', { g: 1 }, { y: 2, r: 1 }], 31: ['trade', { b: 2 }, { g: 3 }], 34: ['trade', { y: 1, g: 1 }, { r: 1, b: 1 }] };
  const O = { 3: [{ r: 2, g: 1 }, 7], 7: [{ y: 2, g: 2 }, 8], 9: [{ y: 1, r: 2, b: 1 }, 9], 13: [{ r: 2, g: 1, b: 1 }, 11], 16: [{ g: 2, b: 2 }, 14], 21: [{ y: 2, r: 1, g: 2 }, 10], 24: [{ y: 1, r: 3, g: 1 }, 10], 28: [{ y: 1, g: 1, b: 3 }, 16], 30: [{ r: 3, g: 2 }, 12], 33: [{ r: 1, g: 2, b: 2 }, 16], 35: [{ g: 2, b: 3 }, 18] };
  const spl = (o) => SP.filter((s) => o[s]).map((s) => `${fa(o[s])} ${SN[s]}`).join('، ');
  const mAlt = (id) => { const m = M[id]; return m[0] === 'spice' ? `تاجر ادویه: ${spl(m[1])}` : m[0] === 'up' ? `تاجر ارتقا: ${fa(m[1])} پله` : `تاجر معاوضه: ${spl(m[1])} به ${spl(m[2])}`; };
  const oAlt = (id) => `سفارش ${fa(O[id][1])} امتیازی: ${spl(O[id][0])}`;
  const tot = (c) => SP.reduce((a, s) => a + (c[s] ?? 0), 0);
  const has = (c, need) => SP.every((s) => (c[s] ?? 0) >= (need[s] ?? 0));
  const sub = (c, d, k = 1) => Object.fromEntries(SP.map((s) => [s, (c[s] ?? 0) - k * (d[s] ?? 0)]));
  const add = (c, d, k = 1) => sub(c, d, -k);
  const eq = (a, b) => SP.every((s) => (a[s] ?? 0) === (b[s] ?? 0));
  const chk = (a, b, what) => { if (!eq(a, b)) throw new Error('century: inconsistent ' + what + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); return b; };

  // caravan: 10 slots on the empty-caravan art (156×68), cubes in spice order; extra cubes beyond 10 sit outside in red
  const caravan = (c, o = {}) => {
    const cubes = SP.flatMap((s) => Array(c[s] ?? 0).fill(s));
    const slot = (i) => `left:${6 + (i % 5) * 29.6}px;top:${6 + Math.floor(i / 5) * 30}px`;
    const marks = o.mark ?? {}; const seen = {};
    const cell = (s, i) => { seen[s] = (seen[s] ?? 0) + 1; const isNew = marks[s] && seen[s] > (c[s] - marks[s]); const isSel = o.sel?.[s] && seen[s] > (c[s] - o.sel[s]); return `<img class="ct-cube${isNew ? ' is-new' : ''}${isSel ? ' is-sel' : ''}" style="${i < 10 ? slot(i) : `left:${162 + (i - 10) * 26}px;top:22px`}" src="${A('century-cube-' + s)}" alt="">`; };
    return `<div class="ct-car${cubes.length > 10 ? ' is-over' : ''}" role="img" aria-label="کاروان: ${spl(c) || 'خالی'}"><img src="${A('century-caravan')}" alt="">${cubes.map(cell).join('')}</div>`;
  };
  const counts = (c) => `<div class="ct-cnt">${SP.map((s) => `<span><img src="${A('century-spice-' + s)}" alt="${SN[s]}">${fa(c[s] ?? 0)}</span>`).join('')}<b>${fa(tot(c))} از ${fa(10)}</b></div>`;
  const mcard = (id, o = {}) => `<span class="ct-c${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}${o.dim ? ' is-dim' : ''}"><img src="${A('century-m' + id)}" alt="${mAlt(id)}">${o.cubes ? `<span class="ct-on">${SP.flatMap((s) => Array(o.cubes[s] ?? 0).fill(s)).map((s) => `<img src="${A('century-cube-' + s)}" alt="${SN[s]}">`).join('')}</span>` : ''}${o.plus ? `<span class="ct-plus">${o.plus}</span>` : ''}</span>`;
  const ocard = (id, o = {}) => `<span class="ct-c ct-oc${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}"><img src="${A('century-o' + id)}" alt="${oAlt(id)}">${o.coin ? `<span class="ct-coin"><img src="${A('century-' + o.coin)}" alt="${o.coin === 'gold' ? 'طلا' : 'نقره'}"><b>${fa(o.n)}</b></span>` : ''}</span>`;
  // rows: { orders:[ids], ok:[ids], sel, gold, silver, merch:[ids], cubes:{pos:{}}, msel, mplus:{pos:'+'} }
  const rows = (r, ph) => `<div class="ct-rows${ph ? ' ct-rows--ph' : ''}"><div class="ct-row" aria-label="سفارش‌ها">${r.orders.map((id, i) => ocard(id, { ok: r.ok?.includes(id), sel: r.sel === id, coin: i === 0 && r.gold ? 'gold' : i === 1 && r.silver ? 'silver' : (i === 0 && r.silver ? 'silver' : null), n: i === 0 ? (r.gold || r.silver) : r.silver })).join('')}</div><div class="ct-row ct-row--m" aria-label="تاجرها">${r.merch.map((id, i) => `<div class="ct-slot">${mcard(id, { cubes: r.cubes?.[i], sel: r.msel === i, dim: r.off, plus: r.mplus?.[i] })}<small>${fa(i)}</small></div>`).join('')}</div></div>`;
  const panel = (p) => `<figure class="ct-opp"><figcaption><i style="background:var(--seat-${p.seat})"></i>${p.name}<span>${fa(p.won)} سفارش</span></figcaption><div class="ct-oc2">${SP.map((s) => `<span><img src="${A('century-cube-' + s)}" alt="${SN[s]}">${fa(p.car[s] ?? 0)}</span>`).join('')}</div><div class="ct-om"><span>دست ${fa(p.hand)}</span><span>بازی‌شده ${fa(p.played)}</span>${p.gold ? `<span><img src="${A('century-gold')}" alt="طلا">${fa(p.gold)}</span>` : ''}${p.silver ? `<span><img src="${A('century-silver')}" alt="نقره">${fa(p.silver)}</span>` : ''}</div></figure>`;

  // ---------- state ----------
  const CAR = { y: 4, r: 2, g: 1, b: 1 };
  const ROWS = { orders: [9, 7, 21, 13, 28], gold: 5, silver: 5, merch: [20, 12, 31, 14, 5, 34], cubes: { 0: { y: 2 }, 1: { y: 1 }, 3: { r: 1 } } };
  const OK1 = Object.keys(O).map(Number).filter((id) => ROWS.orders.includes(id) && has(CAR, O[id][0]));
  const NIL = { name: 'نیلوفر', seat: 2, won: 1, car: { y: 2, r: 1, g: 2, b: 1 }, hand: 5, played: 1, gold: 1, silver: 0 };
  const REZ = { name: 'رضا', seat: 6, won: 1, car: { y: 5, r: 2 }, hand: 6, played: 3, gold: 0, silver: 0 };
  // derived caravans (checked)
  const C_SPICE = chk(add(CAR, M[9][1]), { y: 4, r: 3, g: 2, b: 1 }, 'spice');
  const C_UP = chk({ y: 3, r: 2, g: 2, b: 1 }, { y: CAR.y - 1, r: CAR.r + 1 - 1, g: CAR.g + 1, b: CAR.b }, 'upgrade');
  const C_TRADE = chk(add(sub(CAR, M[21][1], 2), M[21][2], 2), { y: 10, r: 0, g: 1, b: 1 }, 'trade');
  const C_BUY = chk(add(sub(CAR, { y: 3 }), { r: 1 }), { y: 1, r: 3, g: 1, b: 1 }, 'buy');
  const C_ORDER = chk(sub(CAR, O[9][0]), { y: 3, r: 0, g: 1, b: 0 }, 'order');
  const C_DISC = chk(sub(C_TRADE, { y: 2 }), { y: 8, r: 0, g: 1, b: 1 }, 'discard');
  const HAND = [1, 17, 9, 21];
  const above = (o) => (ph) => `<div class="ct-me${ph ? ' ct-me--ph' : ''}">${o.acts ? `<div class="ct-acts">${o.acts(ph)}</div>` : ''}<div class="ct-mine"><div class="ct-cw">${caravan(o.car, o.co)}${counts(o.car)}</div><div class="ct-hand" aria-label="دست شما"><small>دست</small><div>${o.hand.map((id) => mcard(id, { ok: o.ok?.includes(id), sel: o.hsel === id })).join('')}</div></div>${ph ? '' : `<div class="ct-played"><small>بازی‌شده ${fa(o.played.length)}</small><div>${o.played.map((id) => mcard(id, { dim: true })).join('')}</div></div><div class="ct-won"><small>سفارش ${fa(o.won.length)}</small><div>${o.won.map((id) => `<img src="${A('century-o' + id)}" alt="${oAlt(id)}">`).join('')}</div>${o.coins ?? ''}</div>`}</div></div>`;
  const coins = (g, s) => `<span class="ct-mc">${g ? `<span><img src="${A('century-gold')}" alt="طلا">${fa(g)}</span>` : ''}${s ? `<span><img src="${A('century-silver')}" alt="نقره">${fa(s)}</span>` : ''}</span>`;
  const ME = { car: CAR, hand: HAND, played: [0, 26], won: [3], coins: coins(0, 1) };
  const score = (won, g, s, c) => won.reduce((a, id) => a + O[id][1], 0) + 3 * g + s + c.r + c.g + c.b;
  const seatMeta = (p) => `<span class="gc-tag gc-tag--soft">${fa(p.won)} سفارش</span><span>کاروان ${fa(tot(p.car))}</span><span>دست ${fa(p.hand)}</span>`;
  const opps = (turn, n = NIL, r = REZ) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:55', turn: turn === 2, meta: seatMeta(n) },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:30', turn: turn === 6, meta: seatMeta(r) },
  ];
  const table = (o = {}) => (ph) => `${o.banner ? `<div class="ct-banner">${ic('flag')}<span>${o.banner}</span></div>` : ''}${rows(o.rows ?? { ...ROWS, ok: OK1 }, ph)}${ph ? '' : `<div class="ct-opps">${panel(o.nil ?? NIL)}${panel(o.rez ?? REZ)}</div>`}`;
  const note = (s) => `<span class="cx-note">${fa(s)} امتیاز</span>`;
  const rail = `<section class="cx-card"><h3>دور ${fa(6)}</h3><div class="gc-pills"><span class="bgv-chip">پایان: سفارش ششم</span><span class="bgv-chip">نفر اول: نیلوفر</span></div><div class="ga-rule">${ic('info')}<span>در هر نوبت یک کار: کارتی از دست بازی کنید، تاجری بخرید (روی هر کارت قبل از آن یک ادویه بگذارید)، سفارشی بگیرید یا استراحت کنید و کارت‌های بازی‌شده را برگردانید. کاروان بیشتر از ${fa(10)} ادویه جا ندارد.</span></div></section>`;
  const tbl = (head, rws) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rws.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const flow = (a, b) => `<div class="ct-flow">${caravan(a)}<span>${ic('chevdown')}</span>${caravan(b)}</div>`;
  const upM = () => modal('ارتقا: ۲ پله', `<p>روی هر ادویه بزنید تا یک پله بالا برود: زردچوبه به زعفران، زعفران به هل، هل به دارچین. دو ارتقا را می‌شود روی یک ادویه هم زد.</p>${flow(CAR, C_UP)}<p class="ct-mline"><span class="gc-tag">${fa(2)} از ${fa(2)} ارتقا</span><span>زردچوبه ← زعفران، زعفران ← هل</span></p>`, `${btn('از نو', 'secondary', 'undo')}${btn('تأیید', 'primary', 'check')}`);
  const tradeM = () => modal('معاوضه: ۱ زعفران ← ۳ زردچوبه', `<p>هر بار یک زعفران می‌دهید و سه زردچوبه می‌گیرید. شما ${fa(2)} زعفران دارید، پس حداکثر دو بار.</p><div class="ct-times"><button type="button" class="ct-step" aria-label="کمتر">−</button><b>${fa(2)} بار</b><button type="button" class="ct-step" aria-label="بیشتر" disabled>+</button></div>${flow(CAR, C_TRADE)}<p class="ct-warn">${ic('info')}کاروان ${fa(12)} ادویه می‌شود؛ بعد از معاوضه ${fa(2)} ادویه دور می‌ریزید.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('معاوضه', 'primary', 'check')}`);
  const buyM = () => modal('خرید تاجر شمارهٔ ۳', `<div class="ct-mrow">${mcard(14, { sel: true, cubes: { r: 1 } })}<div><p>روی هر یک از سه کارت قبلی یک ادویه بگذارید. زعفرانی که روی این کارت است مال شما می‌شود.</p><div class="ct-pay">${[20, 12, 31].map((id, i) => `<div>${mcard(id, { cubes: ROWS.cubes[i], plus: '+' })}<span><img src="${A('century-cube-y')}" alt="زردچوبه">${SN.y}</span></div>`).join('')}</div></div></div>${flow(CAR, C_BUY)}`, `${btn('لغو', 'secondary', 'x')}${btn('خرید', 'primary', 'check')}`);
  const orderM = () => modal('گرفتن سفارش ۹ امتیازی', `<div class="ct-mrow">${ocard(9, { sel: true, coin: 'gold', n: 5 })}<div><p>یک زردچوبه، دو زعفران و یک دارچین می‌دهید. چون سفارش اول ردیف است، یک سکهٔ طلا (${fa(3)} امتیاز) هم می‌گیرید.</p><p class="ct-mline"><span class="gc-tag">${fa(9)}+ امتیاز</span><span class="gc-tag">طلا ${fa(3)}+</span></p></div></div>${flow(CAR, C_ORDER)}`, `${btn('لغو', 'secondary', 'x')}${btn('گرفتن', 'primary', 'check')}`);
  // late game: me before last turn (orders 3, 9, 13, 16; gold 2, silver 1), order 30 claimable
  const LATE_CAR = { y: 2, r: 4, g: 3, b: 0 };
  const LATE_ROWS = { orders: [24, 30, 33, 35, 28], gold: 1, silver: 2, merch: [27, 12, 31, 5, 34, 20], cubes: { 0: { y: 1 }, 2: { y: 1 } }, ok: [24, 30].filter((id) => has(LATE_CAR, O[id][0])), off: true };
  const END_CAR = chk(sub(LATE_CAR, O[30][0]), { y: 2, r: 1, g: 1, b: 0 }, 'end');
  const ME_END = score([3, 9, 13, 16, 30], 2, 1, END_CAR);
  const REZ_END = 56 + 3 + 1 + 2, NIL_END = 50 + 3 + 2 + 2;
  if (ME_END !== REZ_END) throw new Error('century: tie expected ' + ME_END);
  const endM = () => modal('پایان بازی', `<p>نیلوفر ششمین سفارش را گرفت و دور تا نوبت شما ادامه پیدا کرد. شما با سفارش ${fa(12)} امتیازی با رضا مساوی شدید.</p>${tbl(['بازیکن', 'سفارش‌ها', 'طلا ×۳', 'نقره', 'ادویهٔ غیر زرد', 'جمع'], [{ c: [`${ic('trophy')} شما`, fa(53), fa(6), fa(1), fa(2), fa(ME_END)], win: true }, { c: ['رضا', fa(56), fa(3), fa(1), fa(2), fa(REZ_END)] }, { c: ['نیلوفر', fa(50), fa(3), fa(2), fa(2), fa(NIL_END)] }])}<p class="cx-note">تساوی: کسی که دیرتر در ترتیب نوبت است برنده است؛ شما بعد از رضا بازی می‌کنید.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const LOG = [[2, 'نیلوفر تاجر شمارهٔ ۱ را خرید'], [6, 'رضا کارت ادویه بازی کرد'], [1, 'نوبت شما']];

  return {
    slug: 'Century', fa: 'جاده ابریشم', latin: 'Century', meta: ['زنده', '۳ نفر', 'دور ۶'],
    opps: opps(1),
    me: { cards: [], clock: '1:12', turn: true, note: note(score([3], 0, 1, CAR)), above: above({ ...ME, ok: HAND, acts: (ph) => btn(ph ? 'استراحت' : `استراحت (${fa(2)} کارت برمی‌گردد)`, 'secondary', 'undo') }) },
    table: table(),
    status: `<b>نوبت شماست.</b> یک کار: کارت بازی کنید، تاجر بخرید، سفارش بگیرید یا استراحت کنید. همهٔ کارت‌های دستتان قابل بازی‌اند و سفارش‌های ${fa(9)} و ${fa(11)} امتیازی (حلقهٔ سبز) را همین حالا می‌توانید بگیرید.`,
    pstatus: `<b>نوبت شما.</b> دو سفارش گرفتنی است (سبز).`,
    railCard: rail, logNote: `دور ${fa(6)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'بازیکنان'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'دو کارت آغازین و کاروان اول',
        opps: opps(2, { ...NIL, won: 0, car: { y: 3 }, hand: 2, played: 0, gold: 0 }, { ...REZ, won: 0, car: { y: 4 }, hand: 2, played: 0 }),
        me: { turn: false, clock: '2:00', note: note(0), above: above({ car: { y: 4 }, hand: [0, 1], played: [], won: [] }) },
        table: table({ rows: { ...ROWS, gold: 6, silver: 6, cubes: {} }, nil: { ...NIL, won: 0, car: { y: 3 }, hand: 2, played: 0, gold: 0 }, rez: { ...REZ, won: 0, car: { y: 4 }, hand: 2, played: 0 } }),
        status: `<b>بازی شروع شد.</b> همه دو کارت آغازین دارند: ${fa(2)} زردچوبه و ارتقای دوپله. نیلوفر نفر اول است و ${fa(3)} زردچوبه گرفت؛ رضا و شما ${fa(4)} تا. روی دو سفارش اول ${fa(6)} سکهٔ طلا و ${fa(6)} نقره است.`,
        log: [[1, 'بازی با ۳ نفر شروع شد'], [2, 'نوبت نیلوفر']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'بازی کارت ادویه', turnSub: 'ادویه‌ها به کاروان می‌روند',
        me: { above: above({ ...ME, car: C_SPICE, co: { mark: { r: 1, g: 1 } }, hand: [1, 17, 21], played: [0, 26, 9] }) },
        status: `<b>کارت ادویه بازی شد:</b> یک زعفران و یک هل به کاروان آمد (با قاب طلایی). کاروان پر شد: ${fa(10)} از ${fa(10)}. کارت به ردیف بازی‌شده رفت تا با استراحت برگردد.`,
        pstatus: `<b>ادویه آمد:</b> ${fa(10)} از ${fa(10)}.`,
        log: [[6, 'رضا کارت ادویه بازی کرد'], [1, 'شما یک زعفران و یک هل گرفتید']],
        phone: true,
      },
      {
        shotTitle: 'بازی کارت ارتقا', turnSub: 'دو پله ارتقا روی کاروان',
        me: { above: above({ ...ME, hsel: 1 }) }, overlay: upM,
        status: `<b>ارتقا:</b> دو بار روی ادویه‌ها بزنید. انتخاب فعلی یک زردچوبه را زعفران و یک زعفران را هل می‌کند. با یک ارتقا هم می‌شود تأیید کرد.`,
        log: [[6, 'رضا کارت ادویه بازی کرد'], [1, 'شما کارت ارتقا را زدید']],
      },
      {
        shotTitle: 'بازی کارت معاوضه', turnSub: 'چند بار و پیش‌نمایش کاروان',
        me: { above: above({ ...ME, hsel: 21 }) }, overlay: tradeM,
        status: `<b>معاوضه:</b> یک زعفران به سه زردچوبه، دو بار. کاروان ${fa(12)} ادویه می‌شود و بعدش باید ${fa(2)} تا دور بریزید.`,
        log: [[6, 'رضا کارت ادویه بازی کرد'], [1, 'شما کارت معاوضه را زدید']],
        phone: true,
      },
      {
        shotTitle: 'خرید تاجر', turnSub: 'یک ادویه روی هر کارت قبلی',
        table: table({ rows: { ...ROWS, msel: 3, mplus: { 0: '+', 1: '+', 2: '+' } } }), overlay: buyM,
        status: `<b>خرید تاجر شمارهٔ ${fa(3)}:</b> روی کارت‌های ${fa(0)}، ${fa(1)} و ${fa(2)} هرکدام یک زردچوبه می‌گذارید و زعفرانِ روی کارت ${fa(3)} را برمی‌دارید. کارت تازه به دستتان می‌آید.`,
        log: [[6, 'رضا کارت ادویه بازی کرد'], [1, 'شما تاجر شمارهٔ ۳ را زدید']],
      },
      {
        shotTitle: 'گرفتن سفارش', turnSub: 'پرداخت ادویه و سکهٔ طلا',
        table: table({ rows: { ...ROWS, sel: 9 } }), overlay: orderM,
        status: `<b>گرفتن سفارش:</b> چهار ادویه می‌دهید، ${fa(9)} امتیاز و یک سکهٔ طلا می‌گیرید. سفارش‌های بعدی یک خانه جلو می‌آیند و سکه‌های نقره هم با آن‌ها جابه‌جا می‌شوند.`,
        log: [[6, 'رضا کارت ادویه بازی کرد'], [1, 'شما سفارش ۹ امتیازی را زدید']],
      },
      {
        shotTitle: 'دور ریختن', turnSub: 'بیشتر از ۱۰ ادویه',
        me: { above: above({ ...ME, car: C_TRADE, co: { sel: { y: 2 } }, hand: [1, 17, 9], played: [0, 26, 21], acts: (ph) => `<span class="gc-tag">${fa(2)} از ${fa(2)}</span>${btn(ph ? 'دور بریز' : 'دور ریختن', 'primary', 'x')}` }) },
        status: `<b>${fa(2)} ادویه دور بریزید.</b> بعد از معاوضه ${fa(12)} ادویه دارید و کاروان ${fa(10)} جا دارد. دو زردچوبه انتخاب شده است (قاب قرمز)؛ بعدش ${fa(10)} می‌مانَد: ${spl(C_DISC)}.`,
        pstatus: `<b>${fa(2)} ادویه دور بریزید.</b> دو زردچوبه انتخاب شده است.`,
        log: [[1, 'شما زعفران را دو بار معاوضه کردید'], [1, 'باید ۲ ادویه دور بریزید']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف و دور آخر', turnSub: 'منتظر رضا؛ نیلوفر ششمین سفارش را گرفت',
        meta: ['زنده', '۳ نفر', 'دور آخر'],
        opps: opps(6, { ...NIL, won: 6, car: { y: 3, r: 1, b: 1 }, hand: 7, played: 2, gold: 1, silver: 2 }, { ...REZ, won: 5, car: { y: 1, r: 2, g: 1, b: 1 }, hand: 8, played: 4, gold: 1, silver: 1 }),
        me: { turn: false, clock: '0:44', note: note(score([3, 9, 13, 16], 2, 1, LATE_CAR)), above: above({ car: LATE_CAR, hand: [1, 17, 9, 21, 27], played: [0], won: [3, 9, 13, 16], coins: coins(2, 1) }) },
        table: table({ rows: LATE_ROWS, banner: 'دور آخر: نیلوفر ششمین سفارش را گرفت. بازی بعد از نوبت شما تمام می‌شود.', nil: { ...NIL, won: 6, car: { y: 3, r: 1, b: 1 }, hand: 7, played: 2, gold: 1, silver: 2 }, rez: { ...REZ, won: 5, car: { y: 1, r: 2, g: 1, b: 1 }, hand: 8, played: 4, gold: 1, silver: 1 } }),
        status: `<b>نوبت رضاست.</b> کارت معاوضه را دو بار بازی کرد و هنوز فکر می‌کند. نیلوفر ششمین سفارش را گرفت، پس رضا و بعد شما یک نوبت دیگر دارید. سفارش ${fa(12)} امتیازی برای شما گرفتنی است.`,
        pstatus: `<b>دور آخر.</b> نوبت رضا؛ بعد از شما بازی تمام می‌شود.`,
        log: [[2, 'نیلوفر ششمین سفارش را گرفت'], [6, 'رضا کارت معاوضه را ۲ بار بازی کرد'], [6, 'نوبت رضا']], logNote: 'دور آخر',
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و تساوی',
        meta: ['تمام‌شده', '۳ نفر'], opps: opps(0, { ...NIL, won: 6, car: { y: 3, r: 1, b: 1 }, hand: 7, played: 2 }, { ...REZ, won: 5, car: { y: 1, r: 2, g: 1, b: 1 }, hand: 8, played: 4 }),
        me: { turn: false, clock: '', note: note(ME_END), above: above({ car: END_CAR, hand: [1, 17, 9, 21, 27], played: [0], won: [3, 9, 13, 16, 30], coins: coins(2, 1) }) },
        table: table({ rows: { ...LATE_ROWS, orders: [24, 33, 35, 28, 21], ok: [] } }), overlay: endM,
        status: `<b>بازی تمام شد.</b> شما و رضا ${fa(ME_END)} امتیاز دارید و شما چون دیرتر در ترتیب نوبتید بردید.`,
        log: [[6, 'رضا سفارش گرفت'], [1, 'شما سفارش ۱۲ امتیازی را گرفتید'], [1, 'شما بردید']], logNote: 'پایان',
      },
    ],
    css: `.gc-table{flex-direction:column;gap:12px}
.ct-rows{display:grid;gap:12px;justify-items:center}
.ct-row{display:flex;gap:10px;align-items:flex-end;direction:ltr}
.ct-c{position:relative;display:inline-block;flex:none}
.ct-c>img{display:block;border-radius:8px;box-shadow:0 2px 0 rgba(0,0,0,.25),0 8px 12px -8px rgba(0,0,0,.6)}
.ct-c.is-ok>img{box-shadow:0 0 0 3px #5FBF7A,0 8px 12px -8px rgba(0,0,0,.6)}
.ct-c.is-sel{transform:translateY(-6px)}
.ct-c.is-sel>img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 14px -8px rgba(0,0,0,.7)}
.ct-c.is-dim>img{filter:saturate(.6) brightness(.82)}
.ct-coin{position:absolute;inset-block-start:-12px;inset-inline-start:50%;transform:translateX(-50%);display:flex;align-items:center;gap:2px}
.ct-coin img{inline-size:30px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.ct-coin b{font-size:12px;color:#FAF5EC;background:#142B3B;border-radius:999px;padding:0 6px}
.ct-slot{display:grid;justify-items:center;gap:3px}
.ct-slot small{font-size:12px;color:var(--felt-muted)}
.ct-on{position:absolute;inset-block-start:4px;inset-inline:0;display:flex;justify-content:center;gap:1px}
.ct-on img{inline-size:13px}
.ct-plus{position:absolute;inset-block-end:-8px;inset-inline-end:-6px;inline-size:20px;block-size:20px;border-radius:50%;display:grid;place-items:center;background:var(--felt-gold);color:#142B3B;font-weight:800;font-size:14px}
.ct-opps{display:flex;gap:12px}
.ct-opp{margin:0;display:grid;gap:5px;padding:8px 10px;border-radius:12px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink);inline-size:220px;box-sizing:border-box}
.ct-opp figcaption{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700}
.ct-opp figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.ct-opp figcaption span{margin-inline-start:auto;color:var(--felt-gold);font-size:12.5px}
.ct-oc2,.ct-om{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--felt-muted)}
.ct-oc2 span,.ct-om span{display:inline-flex;align-items:center;gap:3px}
.ct-oc2 img{inline-size:14px}.ct-om img{inline-size:18px}
.ct-car{position:relative;inline-size:156px;block-size:68px;flex:none}
.ct-car>img:first-child{display:block}
.ct-cube{position:absolute;inline-size:22px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.ct-cube.is-new{outline:2px solid var(--felt-gold);outline-offset:1px;border-radius:3px}
.ct-cube.is-sel{outline:2px solid #E0505C;outline-offset:1px;border-radius:3px;opacity:.75}
.ct-car.is-over{margin-inline-end:56px}
.ct-cnt{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--felt-ink);direction:rtl}
.ct-cnt span{display:inline-flex;align-items:center;gap:2px}
.ct-cnt img{inline-size:20px}
.ct-cnt b{color:var(--felt-muted);font-weight:400}
.ct-me{display:grid;justify-items:center;gap:8px;inline-size:100%}
.ct-acts{display:flex;gap:8px;align-items:center}
.ct-mine{display:flex;gap:14px;align-items:flex-end;justify-content:center;direction:ltr}
.ct-cw{display:grid;gap:4px;justify-items:center}
.ct-hand,.ct-played,.ct-won{display:grid;gap:4px;justify-items:start}
.ct-mine small{font-size:12px;color:var(--felt-muted);direction:rtl}
.ct-hand>div,.ct-played>div{display:flex;gap:6px;align-items:flex-end}
.ct-hand .ct-c.is-ok>img{box-shadow:0 0 0 2px rgba(250,245,236,.85),0 8px 12px -8px rgba(0,0,0,.6)}
.ct-played>div{gap:0}.ct-played .ct-c+.ct-c{margin-inline-start:-34px}
.ct-won>div{display:flex}.ct-won>div img{inline-size:44px;border-radius:5px;margin-inline-start:-26px;box-shadow:0 1px 3px rgba(0,0,0,.5)}.ct-won>div img:first-child{margin-inline-start:0}
.ct-mc{display:flex;gap:8px;font-size:12.5px;color:var(--felt-ink)}.ct-mc span{display:inline-flex;align-items:center;gap:3px}.ct-mc img{inline-size:22px}
.ct-banner{display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.ct-flow{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;border-radius:10px;background:#1E3646;direction:ltr}
.ct-flow>span .bgv-icon{transform:rotate(-90deg);color:#FAF5EC}
.ct-mline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ct-mrow{display:flex;gap:14px;align-items:flex-start}.ct-mrow>div{display:grid;gap:10px}
.ct-pay{display:flex;gap:10px;direction:ltr}.ct-pay>div{display:grid;justify-items:center;gap:4px;font-size:12px}.ct-pay span{display:inline-flex;gap:3px;align-items:center}
.ct-times{display:flex;align-items:center;justify-content:center;gap:14px}
.ct-times b{font-size:16px;color:var(--heading)}
.ct-step{inline-size:36px;block-size:36px;border-radius:10px;border:1px solid var(--border);background:var(--surface-sunken);color:var(--heading);font-size:20px;cursor:pointer}
.ct-step:disabled{opacity:.4}
.ct-warn{display:flex;align-items:center;gap:6px;color:var(--danger)}
.cx-phone .gc-table{gap:6px}
.ct-rows--ph{gap:8px}
.ct-rows--ph .ct-row{gap:4px}
.ct-rows--ph .ct-oc>img{block-size:46px;inline-size:auto}
.ct-rows--ph .ct-slot .ct-c>img{block-size:56px;inline-size:auto}
.ct-rows--ph .ct-on img{inline-size:10px}
.ct-rows--ph .ct-coin img{inline-size:24px}
.cx-phone .ct-banner{font-size:12px;padding:4px 10px;margin-inline:10px}
.ct-me--ph .ct-mine{gap:8px;padding-inline:8px}
.ct-me--ph .ct-car{transform:scale(.82);transform-origin:center bottom;margin-block-start:-12px}
.ct-me--ph .ct-hand .ct-c>img{block-size:56px;inline-size:auto}
.ct-me--ph .ct-hand>div{gap:4px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب کار؛ سفارش گرفتنی سبز است',
    diffs: [
      ['چیدمان', 'ردیف پنج سفارش با کپهٔ طلا و نقره روی دو تای اول، ردیف شش تاجر با شمارهٔ هزینه و ادویه‌هایی که رویشان مانده، خلاصهٔ کاروان و دست هر حریف کنارشان؛ پایین کاروان ده‌خانه‌ای، دست، کارت‌های بازی‌شده و سفارش‌های شما'],
      ['آرت', 'کارت‌ها همان طرح‌های آماده و فعلی سایت‌اند و به اندازهٔ اصلی‌شان نشان داده می‌شوند؛ روی گوشی فقط کوچک‌تر می‌شوند'],
      ['کارت‌ها', 'ادویه مستقیم به کاروان می‌رود (§۵)؛ ارتقا و معاوضه پنجرهٔ خودشان را با پیش‌نمایش کاروان قبل و بعد دارند (§۶، §۷)'],
      ['خرید و سفارش', 'خرید تاجر جای ادویه روی کارت‌های قبلی را با «+» نشان می‌دهد (§۸) و گرفتن سفارش پرداخت و سکه را (§۹). اگر کاروان از ۱۰ بگذرد، مرحلهٔ دور ریختن می‌آید (§۱۰)'],
      ['پایان', 'نوار «دور آخر» بعد از ششمین سفارش (سه‌نفره) و جدول پایانی با سفارش‌ها، طلا، نقره و ادویه‌های غیر زرد؛ در تساوی کسی که دیرتر بازی می‌کند می‌برد (§۱۱، §۱۲)'],
      ['قوانین', 'مثل موتور: ۲ تا ۵ نفر؛ با ۴ و ۵ نفر پنجمین سفارش پایان را اعلام می‌کند. کاروان‌های آغازین ۳، ۴، ۴، ۳+۱ و ۳+۱'],
    ],
  };
}
