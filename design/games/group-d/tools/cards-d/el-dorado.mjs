// The Quest for El Dorado («معبد الدورادو») on the group D frame. Repo engine: 2–4 players, one fixed 11×6 hex map (odd-r rows, row 0 =
// start at the bottom, row 10 = El Dorado at the top), 19 card types, whole market buyable (E1), no blockades or caves (E2, E3).
// No BGA version exists; layout follows the physical game: the map on one side, the market and your hand on the other.
// Art = the site's ready-to-use renders at native size or exactly ½: map 372×553 (1×), cards 108×142 (hand 1×, market ½ = 54×71),
// explorer pawns 44×44 (½ = 22). Hex centres measured on the map image: x = 36 + 54.5·col (+27.25 on odd rows), y = 37 + 48.1·(10 − row).
// Distances to El Dorado are computed here with the engine's neighbour rule (rules.ts neighbours/DIST).
// Mock: 4 players, order مینا → نیلوفر → رضا → سارا, نیلوفر started. Pawns: you red, نیلوفر blue, رضا yellow, سارا purple.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['ed-' + n];
  const ROWS = ['s  s  s  s  m  m', 'g1 g1 b1 g1 y1 g1', 'g1 y1 b1 b1 g2 g1', 'm  g2 r1 b1 g1 y1', 'g1 g1 y2 m  b2 g1', 'c1 g2 g1 y1 b1 g2', 'g1 c1 g2 y1 g2 b1', 'm  g3 b2 b2 y2 g1', 'g1 y1 g1 m  g2 c2', 'g2 g1 r1 y3 g1 g1', 'm  E  E  E  E  m'];
  const MAP = ROWS.flatMap((r) => r.trim().split(/\s+/).map((t) => ({ k: t[0], n: +(t.slice(1) || 0) })));
  const at = (r, c) => r * 6 + c;
  const nb = (i) => { const r = Math.floor(i / 6), c = i % 6, odd = r % 2; const ds = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]; return ds.map(([a, b]) => [r + a, c + b]).filter(([y, x]) => y >= 0 && y < 11 && x >= 0 && x < 6).map(([y, x]) => y * 6 + x).filter((j) => MAP[j].k !== 'm'); };
  const DIST = (() => { const d = MAP.map((h) => (h.k === 'E' ? 0 : Infinity)); const q = MAP.map((_, i) => i).filter((i) => d[i] === 0); while (q.length) { const i = q.shift(); for (const j of nb(i)) if (d[j] === Infinity) { d[j] = d[i] + 1; q.push(j); } } return d; })();
  const xy = (i) => { const r = Math.floor(i / 6), c = i % 6; return [36 + 54.5 * c + (r % 2 ? 27.25 : 0), 37 + 48.1 * (10 - r)]; };
  const T = { explorer: ['کاوشگر', 'g', 1, 0], sailor: ['ملوان', 'b', 1, 0], traveller: ['مسافر', 'y', 1, 0], scout: ['پیشاهنگ', 'g', 2, 1], trailblazer: ['راه‌گشا', 'g', 3, 3], pioneer: ['پیشگام', 'g', 5, 5], machete: ['قمهٔ بزرگ', 'g', 6, 3], captain: ['ناخدا', 'b', 3, 2], photographer: ['عکاس', 'y', 2, 2], journalist: ['روزنامه‌نگار', 'y', 3, 3], chest: ['صندوق گنج', 'y', 4, 3], millionaire: ['ثروتمند', 'y', 4, 5], jack: ['همه‌کاره', 'any', 1, 2], adventurer: ['ماجراجو', 'any', 2, 4], plane: ['هواپیمای ملخی', 'any', 4, 4], cartographer: ['نقشه‌کش', 'g', 0, 4], compass: ['قطب‌نما', 'g', 0, 2], scientist: ['دانشمند', 'g', 0, 4], native: ['راهنمای بومی', 'g', 0, 5] };
  const MARKET = Object.keys(T).filter((k) => T[k][3] > 0);
  const SN = { g: 'سبز', b: 'آبی', y: 'زرد' };
  const coin = (k) => (T[k][1] === 'y' ? T[k][2] : 0.5);
  const half = (v) => (v % 1 ? (v - 0.5 ? `${fa(v - 0.5)} و نیم` : 'نیم') : fa(v));
  const im = (n, alt = '', cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${A(n)}" alt="${alt}">`;
  const alt = (k) => `${T[k][0]}${T[k][2] ? `، ${fa(T[k][2])} ${T[k][1] === 'any' ? 'هر نماد' : SN[T[k][1]]}` : ''}، قیمت ${fa(T[k][3])}`;
  const NM = { 1: 'شما', 2: 'نیلوفر', 6: 'رضا', 4: 'سارا' };
  const PAWN = { 1: 0, 2: 1, 6: 2, 4: 3 };
  // map: m = { pos:{seat:hex}, hi:[hex], tap: hex, path:[hexes], arrived:[seats] }
  const hexPts = ([x, y]) => [[x, y - 32], [x + 27, y - 16], [x + 27, y + 16], [x, y + 32], [x - 27, y + 16], [x - 27, y - 16]].map((p) => p.join(',')).join(' ');
  const mapView = (m, ph) => { const [, py] = xy(m.pos[1]); const off = Math.max(0, Math.min(553 - 250, Math.round(py - 125 - (m.phShift ?? 0)))); return `<div class="ed-map${ph ? ' ed-map--ph' : ''}"><div class="ed-mapi" style="${ph ? `transform:translateY(-${off}px)` : ''}">${im('map', 'نقشهٔ سفر')}<svg viewBox="0 0 372 553" aria-hidden="true">${(m.hi ?? []).map((h) => `<polygon class="ed-hi" points="${hexPts(xy(h))}"/>`).join('')}${m.tap !== undefined ? `<polygon class="ed-tap" points="${hexPts(xy(m.tap))}"/>` : ''}${m.path ? `<polyline class="ed-path" points="${m.path.map((h) => xy(h).join(',')).join(' ')}"/>` : ''}</svg>${Object.entries(m.pos).map(([s, h]) => { const [x, y] = xy(h); return `<img class="ed-pawn${+s === 1 ? ' is-me' : ''}" style="left:${((x - 11) / 3.72).toFixed(2)}%;top:${((y - 11) / 5.53).toFixed(2)}%" src="${A('pawn-' + PAWN[s])}" alt="${NM[s]}">`; }).join('')}</div></div>`; };
  const mcard = (k, n, o = {}) => `<span class="ed-mc${o.ok ? ' is-ok' : ''}${o.no ? ' is-no' : ''}${o.sel ? ' is-sel' : ''}">${im(k, alt(k))}<b>${fa(n)}</b></span>`;
  const MK0 = Object.fromEntries(MARKET.map((k) => [k, 3]));
  const market = (mk, o = {}) => `<div class="ed-mk${o.off ? ' is-off' : ''}"><small>${o.off ? 'این نوبت خرید کردید' : 'بازار'}</small><div class="ed-mkg">${MARKET.map((k) => mcard(k, mk[k], o.coins !== undefined ? { ok: T[k][3] <= o.coins && o.sel !== k, no: T[k][3] > o.coins, sel: o.sel === k } : {})).join('')}</div></div>`;
  const hcard = (k, o = {}) => `<span class="ed-hc${o.sel ? ' is-sel' : ''}${o.ok ? ' is-ok' : ''}${o.act ? ' is-act' : ''}${o.dim ? ' is-dim' : ''}">${im(k, alt(k))}${o.tag ? `<em>${o.tag}</em>` : ''}</span>`;
  const handRow = (list) => `<div class="ed-hand">${list.map((x) => (Array.isArray(x) ? hcard(x[0], x[1]) : hcard(x))).join('')}</div>`;
  const stats = (s) => `<div class="ed-stats"><span class="bgv-chip">${s.arr ? 'رسیدید' : `فاصله تا الدورادو: ${fa(DIST[s.pos])}`}</span><span>دسته ${fa(s.deck)}</span><span>دورریخته ${fa(s.disc)}</span></div>`;
  // st: { pos, hi, tap, path, mk, mkO, hand, deck, disc, banner, phMarket, phShift }
  const table = (st) => (ph) => `${st.banner ? `<div class="ed-banner">${ic(st.bannerIc ?? 'flag')}<span>${st.banner}</span></div>` : ''}<div class="ed-row">${ph && st.phMarket ? '' : mapView(st, ph)}<div class="ed-side">${stats({ pos: st.pos[1], deck: st.deck, disc: st.disc, arr: st.meArr })}${ph && !st.phMarket ? '' : market(st.mk ?? MK0, st.mkO)}<div class="ed-hw"><small>دست شما</small>${handRow(st.hand)}</div></div></div>`;
  const above = (acts) => (ph) => acts ? `<div class="ed-acts">${acts(ph)}</div>` : '';
  const seatMeta = (s, pos, cards, arrived) => `<img class="ed-sp" src="${A('pawn-' + PAWN[s])}" alt="">${arrived ? '<span class="gc-tag">رسید</span>' : `<span class="gc-tag gc-tag--soft">${fa(DIST[pos])} خانه</span>`}<span>کارت ${fa(cards)}</span>`;
  const opps = (pos, turn, arr = []) => [2, 6, 4].map((s) => ({ name: NM[s], av: NM[s][0], seat: s, clock: ({ 2: '1:25', 6: '1:05', 4: '1:40' })[s], turn: turn === s, meta: seatMeta(s, pos[s], ({ 2: 13, 6: 11, 4: 14 })[s], arr.includes(s)) }));
  const note = (pos, arr) => `<span class="cx-note">${arr ? 'رسیدید' : `${fa(DIST[pos])} خانه تا الدورادو`}</span>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rail = (round) => `<section class="cx-card"><h3>دور ${fa(round)}</h3><div class="gc-pills"><span class="bgv-chip">شروع‌کننده: نیلوفر</span><span class="bgv-chip">دست: ${fa(4)} کارت</span></div><div class="ga-rule">${ic('info')}<span>هر کارت نمادی دارد: سبز برای جنگل، آبی برای آب، زرد برای روستا. قدرت یک کارت را می‌شود در چند خانهٔ پشت‌سرهم همان رنگ خرج کرد. آوار یعنی دور ریختن کارت و اردوگاه یعنی حذف کارت. هر نوبت یک خرید؛ هر کارت غیر زرد نیم سکه است.</span></div></section>`;

  // ---------- state ----------
  const P1 = { 1: at(5, 4), 2: at(7, 4), 6: at(3, 3), 4: at(8, 1) };
  const nbr = (i, k, n) => nb(i).filter((j) => MAP[j].k === k && MAP[j].n <= n && !Object.values(P1).includes(j));
  const HI1 = nbr(at(5, 4), 'b', 2);
  const chk = (c, m) => { if (!c) throw new Error('el-dorado mock: ' + m); };
  chk(nb(at(5, 3)).includes(at(5, 4)) && MAP[at(5, 4)].k === 'b' && HI1.includes(at(6, 5)) && HI1.includes(at(4, 4)), 'main move');
  chk(nb(at(7, 5)).includes(at(8, 5)) && MAP[at(8, 5)].k === 'c' && MAP[at(8, 5)].n === 2, 'camp');
  chk(nb(at(7, 4)).includes(at(8, 4)) && nb(at(8, 4)).includes(at(9, 3)) && MAP[at(9, 3)].k === 'y' && MAP[at(9, 3)].n === 3, 'nil path');
  chk(nb(at(8, 5)).includes(at(9, 4)) && nb(at(9, 4)).includes(at(10, 4)) && nb(at(8, 1)).includes(at(9, 1)) && nb(at(9, 1)).includes(at(10, 1)), 'final paths');
  const pay = ['traveller', 'photographer', 'sailor'];
  chk(pay.reduce((a, k) => a + coin(k), 0) === 3.5, 'coins');
  const MK1 = { ...MK0, scout: 2, captain: 1, photographer: 2, journalist: 2, trailblazer: 2, jack: 2, compass: 2 };
  const LOG = [[4, 'سارا با پیشگام سه خانه جلو رفت'], [1, 'نوبت شما'], [1, 'ناخدا: یک خانهٔ آبی']];
  const P11 = { 1: at(8, 5), 2: at(9, 3), 6: at(6, 2), 4: at(10, 1) };

  const jokerM = (ph) => modal('نماد را انتخاب کنید', `<div class="ed-mrow">${hcard('jack', { sel: true })}<div><p>همه‌کاره یک قدرت هر نمادی دارد. برای این حرکت کدام نماد باشد؟</p><div class="ed-syms"><button type="button" class="is-on">سبز</button><button type="button">آبی</button><button type="button">زرد</button></div><p class="cx-note">خانهٔ انتخاب‌شده جنگل یک‌امتیازی است، پس سبز.</p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('تأیید', 'primary', 'check')}`);
  const campM = (ph) => modal(`اردوگاه: ${fa(2)} کارت را برای همیشه حذف کنید`, `<p>برای رفتن به این اردوگاه باید دو کارت از دستتان را از بازی بیرون ببرید. کارت‌های ضعیف را بدهید تا دسته‌تان سبک‌تر شود.</p><div class="ed-pick">${hcard('traveller', { sel: true })}${hcard('explorer')}${hcard('sailor', { sel: true })}${hcard('scientist')}</div><p class="ed-line"><span class="ed-pill">${fa(2)} از ${fa(2)}</span><span class="cx-note">مسافر و ملوان انتخاب شده‌اند.</span></p>`, `${btn('لغو', 'secondary', 'x')}${btn('تأیید', 'primary', 'check')}`);
  const sciM = (ph) => modal('یک کارت را حذف کنید؟', `<p>دانشمند یک کارت کشید (ناخدا). حالا می‌توانید یک کارت از دستتان را برای همیشه حذف کنید؛ اختیاری است.</p><div class="ed-pick">${hcard('explorer', { sel: true })}${hcard('captain')}</div>`, `${btn('حذف نکن', 'secondary', 'x')}${btn('حذف کاوشگر', 'primary', 'check')}`);
  const endTurnM = (ph) => modal('کدام کارت‌ها را دور می‌ریزید؟', `<p>کارتی که در دست می‌ماند برای نوبت بعد نگه داشته می‌شود؛ هر کدام را بزنید دور ریخته می‌شود. بعد دستتان تا ${fa(4)} کارت پر می‌شود.</p><div class="ed-pick">${hcard('explorer')}</div><p class="cx-note">هیچ کارتی انتخاب نشده؛ کاوشگر می‌ماند.</p>`, `${btn('پایان نوبت', 'primary', 'check')}`);
  const endM = (ph) => modal('شما و سارا به الدورادو رسیدید', `<p>سارا اول رسید و دور تا نوبت شما ادامه پیدا کرد. شما هم رسیدید، پس مشترک اول شدید.</p>${tbl(['بازیکن', 'رتبه', 'وضعیت'], [{ c: [`${ic('trophy')} شما`, fa(1), 'رسید'], win: true }, { c: [`${ic('trophy')} سارا`, fa(1), 'رسید'], win: true }, { c: ['نیلوفر', fa(3), `${fa(DIST[P11[2]])} خانه فاصله`] }, { c: ['رضا', fa(4), `${fa(DIST[P11[6]])} خانه فاصله`] }])}<p class="cx-note">موتور همهٔ رسیده‌ها را مشترک اول می‌کند؛ تساوی‌شکن موانع در بازی چاپی هنوز نیست.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'ElDorado', fa: 'معبد الدورادو', latin: 'The Quest for El Dorado', meta: ['زنده', '۴ نفر', 'دور ۶'],
    opps: opps(P1, 0),
    me: { cards: [], clock: '1:08', turn: true, note: note(P1[1]), above: above((ph) => `<span class="ed-pill ed-pill--felt">قدرت مانده: ${fa(2)} (آبی)</span>${btn(ph ? 'خرید' : 'رفتن به خرید', 'secondary', 'download')}${btn('پایان نوبت', 'secondary', 'check')}`) },
    table: table({ pos: P1, hi: HI1, path: [at(5, 3), at(5, 4)], mk: MK1, hand: [['captain', { act: true, tag: `${fa(2)} مانده` }], 'scout', 'traveller', 'explorer'], deck: 5, disc: 3 }),
    status: `<b>نوبت شماست.</b> ناخدا (${fa(3)} آبی) را بازی کردید و یک خانهٔ آب جلو رفتید؛ ${fa(2)} قدرت آبی مانده. خانه‌های روشن با همین کارت قابل ادامه‌اند. کارت دیگری را بزنید تا خانه‌های آن کارت روشن شود.`,
    pstatus: `<b>قدرت مانده: ${fa(2)} آبی.</b> خانه‌های روشن را بزنید.`,
    railCard: rail(6), logNote: `دور ${fa(6)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'بازار'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'مهره‌ها در خانه‌های شروع',
        meta: ['زنده', '۴ نفر', 'دور ۱'],
        opps: opps({ 2: at(0, 1), 6: at(0, 2), 4: at(0, 3) }, 2).map((o) => ({ ...o, meta: o.meta.replace(/کارت [۰-۹]+/, `کارت ${fa(8)}`) })),
        me: { turn: false, clock: '1:30', note: note(at(0, 0)), above: above(null) },
        table: table({ pos: { 1: at(0, 0), 2: at(0, 1), 6: at(0, 2), 4: at(0, 3) }, mk: MK0, hand: ['explorer', 'explorer', 'traveller', 'sailor'], deck: 4, disc: 0 }),
        railCard: rail(1),
        status: `<b>بازی شروع شد.</b> هر نفر دستهٔ ${fa(8)} کارتی دارد (${fa(3)} کاوشگر، ${fa(1)} ملوان، ${fa(4)} مسافر) و ${fa(4)} کارت در دست. از هر کارت بازار ${fa(3)} عدد هست. نیلوفر شروع می‌کند؛ اولین کسی که به یکی از چهار خانهٔ الدورادو برسد دور آخر را شروع می‌کند.`,
        log: [[1, 'بازی با ۴ نفر شروع شد'], [2, 'نیلوفر شروع می‌کند']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'کارت همه‌کاره', turnSub: 'انتخاب نماد',
        meta: ['زنده', '۴ نفر', 'دور ۷'],
        opps: opps({ ...P1, 1: at(6, 5) }, 0),
        me: { note: note(at(6, 5)), above: above(null) },
        table: table({ pos: { ...P1, 1: at(6, 5) }, hi: [at(7, 5), at(5, 4)], tap: at(7, 5), mk: MK1, hand: [['jack', { sel: true }], 'explorer', 'traveller', 'photographer'], deck: 4, disc: 4 }),
        overlay: jokerM, railCard: rail(7),
        status: `<b>همه‌کاره:</b> این کارت یک قدرت هر نمادی دارد. خانهٔ جنگل جلو را زدید؛ قبل از حرکت پنجرهٔ انتخاب نماد باز می‌شود.`,
        log: [[1, 'شما ناخدا را تا آخر خرج کردید'], [2, 'نیلوفر عکاس خرید'], [1, 'همه‌کاره انتخاب شد']], logNote: `دور ${fa(7)}`,
      },
      {
        shotTitle: 'اردوگاه', turnSub: 'حذف ۲ کارت برای ورود',
        meta: ['زنده', '۴ نفر', 'دور ۸'],
        opps: opps({ ...P1, 1: at(7, 5) }, 0),
        me: { note: note(at(7, 5)), above: above(null) },
        table: table({ pos: { ...P1, 1: at(7, 5) }, tap: at(8, 5), mk: MK1, hand: [['traveller', { sel: true }], 'explorer', ['sailor', { sel: true }], 'scientist'], deck: 3, disc: 5, phShift: -40 }),
        overlay: campM, railCard: rail(8),
        status: `<b>اردوگاه:</b> خانهٔ قرمز با عدد ${fa(2)} را زدید. برای رفتن به آن باید ${fa(2)} کارت از دست را برای همیشه حذف کنید (آوار خاکستری فقط دور ریختن می‌خواهد).`,
        pstatus: `<b>اردوگاه.</b> ${fa(2)} کارت حذف کنید.`,
        log: [[2, 'نیلوفر دو خانه جلو رفت'], [1, 'شما اردوگاه را زدید'], [1, 'دو کارت برای حذف']], logNote: `دور ${fa(8)}`,
        phone: true,
      },
      {
        shotTitle: 'کارت اکشن', turnSub: 'دانشمند: کشیدن و حذف',
        meta: ['زنده', '۴ نفر', 'دور ۸'],
        opps: opps({ ...P1, 1: at(8, 5) }, 0),
        me: { note: note(at(8, 5)), above: above((ph) => btn('بازی دانشمند (+۱ کارت)', 'secondary', 'hand')) },
        table: table({ pos: { ...P1, 1: at(8, 5) }, mk: MK1, hand: [['explorer', { sel: true }], 'captain'], deck: 2, disc: 5 }),
        overlay: sciM, railCard: rail(8),
        status: `<b>دانشمند:</b> با دکمهٔ «بازی» یک کارت کشید و حالا می‌توانید یک کارت را حذف کنید. نقشه‌کش و قطب‌نما هم همین دکمه را دارند (${fa(2)} و ${fa(3)} کارت).`,
        log: [[1, 'شما مسافر و ملوان را حذف کردید'], [1, 'شما به اردوگاه رفتید'], [1, 'دانشمند: ناخدا کشیدید']], logNote: `دور ${fa(8)}`,
      },
      {
        shotTitle: 'خرید', turnSub: 'پرداخت با کارت‌های دست',
        meta: ['زنده', '۴ نفر', 'دور ۹'],
        opps: opps({ ...P1, 1: at(8, 5) }, 0),
        me: { note: note(at(8, 5)), above: above((ph) => `<span class="ed-pill ed-pill--felt">${half(3.5)} سکه</span>${btn(ph ? 'خرید' : `خرید راه‌گشا (${fa(3)})`, 'primary', 'check')}`) },
        table: table({ pos: { ...P1, 1: at(8, 5) }, mk: MK1, mkO: { coins: 3.5, sel: 'trailblazer' }, hand: [['traveller', { sel: true, tag: fa(1) }], ['photographer', { sel: true, tag: fa(2) }], 'explorer', ['sailor', { sel: true, tag: 'نیم' }]], deck: 6, disc: 0, phMarket: true }),
        railCard: rail(9),
        status: `<b>خرید:</b> مسافر، عکاس و ملوان را برای پرداخت زدید: ${fa(1)} و ${fa(2)} و نیم، روی هم ${half(3.5)} سکه. کارت‌هایی که قیمتشان پوشش داده می‌شود سبزند؛ راه‌گشا انتخاب شده و به دورریخته‌تان می‌رود.`,
        pstatus: `<b>${half(3.5)} سکه.</b> راه‌گشا، ${fa(3)}.`,
        log: [[4, 'سارا یک خانه جلو رفت'], [1, 'نوبت شما'], [1, 'پرداخت: ۳ و نیم سکه']], logNote: `دور ${fa(9)}`,
        phone: true,
      },
      {
        shotTitle: 'پایان نوبت', turnSub: 'دور ریختن کارت‌های مانده',
        meta: ['زنده', '۴ نفر', 'دور ۹'],
        opps: opps({ ...P1, 1: at(8, 5) }, 0),
        me: { note: note(at(8, 5)), above: above(null) },
        table: table({ pos: { ...P1, 1: at(8, 5) }, mk: { ...MK1, trailblazer: 1 }, mkO: { off: true }, hand: ['explorer'], deck: 6, disc: 4 }),
        overlay: endTurnM, railCard: rail(9),
        status: `<b>پایان نوبت.</b> خرید کردید و بازار تا نوبت بعد غیرفعال است. کاوشگر در دست مانده؛ اگر نخواهید آن را نگه دارید، انتخابش کنید تا دور ریخته شود.`,
        log: [[1, 'شما راه‌گشا خریدید'], [1, 'بازار تا نوبت بعد بسته شد'], [1, 'پایان نوبت']], logNote: `دور ${fa(9)}`,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'مسیر نیلوفر',
        meta: ['زنده', '۴ نفر', 'دور ۱۰'],
        opps: opps({ ...P1, 2: at(9, 3) }, 2),
        me: { turn: false, note: note(at(8, 5)), above: above(null) },
        table: table({ pos: { ...P1, 1: at(8, 5), 2: at(9, 3) }, path: [at(7, 4), at(8, 4), at(9, 3)], mk: { ...MK1, trailblazer: 1, captain: 0 }, hand: ['explorer', 'trailblazer', 'scout', 'traveller'], deck: 2, disc: 0 }),
        railCard: rail(10),
        status: `<b>نوبت نیلوفر است.</b> با پیشگام به جنگل دوامتیازی رفت و با ثروتمند به روستای سه‌امتیازی؛ مسیرش خط‌چین است. بعد آخرین ناخدای بازار را خرید.`,
        pstatus: `<b>نوبت نیلوفر.</b> دو خانه جلو رفت.`,
        log: [[2, 'نیلوفر با پیشگام و ثروتمند دو خانه رفت'], [2, 'نیلوفر ناخدا خرید'], [2, 'ناخدا در بازار تمام شد']], logNote: `دور ${fa(10)}`,
        phone: true,
      },
      {
        shotTitle: 'رسیدن به الدورادو', turnSub: 'دور آخر',
        meta: ['زنده', '۴ نفر', 'دور آخر'],
        opps: opps(P11, 0, [4]),
        me: { clock: '1:00', note: note(P11[1]), above: above((ph) => btn('پایان نوبت', 'secondary', 'check')) },
        table: table({ banner: 'سارا به الدورادو رسید؛ این دور آخر است', pos: P11, hi: [at(9, 4)], mk: { ...MK1, trailblazer: 1, captain: 0 }, hand: ['trailblazer', 'scout', 'explorer', 'traveller'], deck: 3, disc: 2 }),
        railCard: rail(11),
        status: `<b>سارا به الدورادو رسید.</b> چون نیلوفر شروع کرده، دور با نوبت شما تمام می‌شود. با راه‌گشا می‌توانید دو خانه بروید: جنگل جلو و بعد الدورادو.`,
        log: [[4, 'سارا به الدورادو رسید'], [4, 'دور آخر'], [1, 'نوبت آخر شما']], logNote: `دور ${fa(11)}`,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'رتبه‌ها',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: opps({ ...P11 }, 0, [4]).map((o) => ({ ...o, clock: '' })),
        me: { turn: false, clock: '', note: note(at(10, 4), true), above: above(null) },
        table: table({ pos: { ...P11, 1: at(10, 4) }, path: [at(8, 5), at(9, 4), at(10, 4)], mk: { ...MK1, trailblazer: 1, captain: 0 }, hand: ['scout', 'explorer', 'traveller'], deck: 3, disc: 3, meArr: true }),
        overlay: endM, railCard: rail(11),
        status: `<b>بازی تمام شد.</b> شما و سارا به الدورادو رسیدید و مشترک اول شدید.`,
        log: [[1, 'شما با راه‌گشا دو خانه رفتید'], [1, 'شما به الدورادو رسیدید'], [1, 'شما و سارا مشترک اول']], logNote: `دور ${fa(11)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:8px}
.ed-row{display:flex;align-items:flex-start;justify-content:center;gap:12px}
.ed-map{position:relative;inline-size:372px;flex:none}
.ed-mapi{position:relative}
.ed-mapi>img:first-child{display:block;inline-size:372px;border-radius:8px;box-shadow:0 8px 18px -8px rgba(0,0,0,.7)}
.ed-mapi svg{position:absolute;inset:0;inline-size:100%;block-size:100%}
.ed-hi{fill:rgba(250,245,236,.28);stroke:#FAF5EC;stroke-width:3}
.ed-tap{fill:rgba(232,166,66,.3);stroke:#E8A642;stroke-width:4}
.ed-path{fill:none;stroke:#FAF5EC;stroke-width:4;stroke-dasharray:7 6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.ed-pawn{position:absolute;inline-size:22px;block-size:22px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.ed-pawn.is-me{outline:2.5px solid #FAF5EC;border-radius:50%}
.ed-side{display:grid;gap:8px;inline-size:310px;align-content:start}
.ed-stats{display:flex;align-items:center;gap:10px;color:var(--felt-ink);font-size:12.5px}
.ed-stats .bgv-chip{font-size:12.5px}
.ed-mk{display:grid;gap:4px;color:var(--felt-muted);font-size:12px}
.ed-mkg{display:grid;grid-template-columns:repeat(5,54px);gap:6px 4px;direction:ltr}
.ed-mc{position:relative;display:block;inline-size:54px}
.ed-mc img{display:block;inline-size:100%;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.ed-mc b{position:absolute;inset-block-start:-5px;inset-inline-end:-5px;min-inline-size:17px;block-size:17px;border-radius:999px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:10.5px;box-shadow:0 0 0 1.5px rgba(250,245,236,.5)}
.ed-mc.is-ok img{box-shadow:0 0 0 2.5px #5FBF7A}
.ed-mc.is-no img{filter:grayscale(.75) brightness(.7)}
.ed-mc.is-sel{transform:translateY(-4px)}.ed-mc.is-sel img{box-shadow:0 0 0 2.5px #FAF5EC,0 0 0 5px var(--felt-gold)}
.ed-mk.is-off .ed-mc img{filter:grayscale(.6) brightness(.6)}
.ed-mk.is-off small{color:var(--felt-gold);font-weight:700}
.ed-hw{display:grid;gap:4px;color:var(--felt-muted);font-size:12px}
.ed-hand{display:flex;direction:ltr;padding-block-start:10px}
.ed-hc{position:relative;display:block;inline-size:108px;flex:none;margin-inline-start:-40px}
.ed-hand .ed-hc:first-child{margin-inline-start:0}
.ed-hc img{display:block;inline-size:100%;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 12px -8px rgba(0,0,0,.6)}
.ed-hc.is-sel{transform:translateY(-10px)}.ed-hc.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.ed-hc.is-act img{box-shadow:0 0 0 3px #2f7de1,0 8px 12px -8px rgba(0,0,0,.6)}
.ed-hc em{position:absolute;inset-block-start:-8px;inset-inline:0;margin-inline:auto;inline-size:max-content;font-style:normal;font-size:11.5px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--felt-gold);color:#142B3B;box-shadow:0 1px 3px rgba(0,0,0,.4);direction:rtl}
.ed-acts{display:flex;align-items:center;justify-content:center;gap:8px}
.ed-pill{display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;background:var(--surface-sunken);color:var(--text);font-size:13px;font-weight:700}
.ed-pill--felt{background:rgba(250,245,236,.12);color:var(--felt-ink)}
.ed-banner{display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.ed-sp{inline-size:14px;block-size:14px}
.ed-mrow{display:flex;gap:16px;align-items:flex-start}
.ed-mrow>div{display:grid;gap:10px;flex:1}
.ed-syms{display:flex;gap:8px}
.ed-syms button{all:unset;cursor:pointer;padding:8px 18px;border-radius:999px;font-size:14px;font-weight:700;box-shadow:inset 0 0 0 1.5px var(--border);color:var(--text)}
.ed-syms button.is-on{background:#3c8a3f;color:#fff;box-shadow:none}
.ed-pick{display:flex;gap:10px;justify-content:center;direction:ltr;padding-block:10px 4px}
.ed-pick .ed-hc{margin:0}
.ed-line{display:flex;align-items:center;gap:10px}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.cx-phone .gc-table{gap:6px}
.cx-phone .ed-row{flex-direction:column;align-items:center;gap:6px}
.ed-map--ph{block-size:250px;overflow:hidden;border-radius:8px}
.cx-phone .ed-side{inline-size:374px;justify-items:center}
.cx-phone .ed-hc{inline-size:108px;margin-inline-start:-36px}
.cx-phone .ed-hw small{display:none}
.cx-phone .ed-hand{padding-block-start:8px}
.cx-phone .ed-banner{font-size:12px;padding:4px 10px;margin-inline:8px}
.cx-phone .ed-acts{gap:6px;padding-inline:8px}
.cx-phone .ed-pick .ed-hc{inline-size:72px}
.cx-phone .ed-mrow{flex-direction:column;align-items:center}`,
    shotTitle: 'نوبت شما', turnSub: 'حرکت با قدرت مانده',
    diffs: [
      ['چیدمان', 'BGA این بازی را ندارد؛ مثل بازی چاپی نقشه یک طرف میز است و بازار ۱۶ کارتی با عدد مانده و دست شما طرف دیگر. فاصلهٔ هر بازیکن تا الدورادو در کارت صندلی‌اش است و رنگ مهره‌اش کنار اسمش'],
      ['آرت', 'نقشه، کارت‌ها و مهره‌ها رندرهای سادهٔ سایت‌اند؛ نقشه و دست به اندازهٔ اصلی و بازار و مهره‌ها دقیقاً نصف، تا بعداً با همان اندازه عوض شوند'],
      ['حرکت', 'کارت در حال خرج قاب آبی و «۲ مانده» دارد و خانه‌هایی که با آن قابل ادامه‌اند روشن‌اند (§۱). همه‌کاره قبل از حرکت پنجرهٔ انتخاب نماد دارد (§۵)؛ آوار و اردوگاه پنجرهٔ انتخاب کارت از دست (§۶)'],
      ['کارت‌ها و خرید', 'کارت‌های اکشن دکمهٔ «بازی» دارند و دانشمند بعدش حذف اختیاری را می‌پرسد (§۷). در خرید، کارت‌های دست با ارزش سکه‌شان انتخاب می‌شوند و جمع «۳ و نیم سکه» کنار دکمه است (§۸)؛ بعد از خرید بازار با «این نوبت خرید کردید» بسته می‌شود (§۹)'],
      ['پایان', 'مسیر حریف خط‌چین (§۱۰)، نوار «دور آخر» و نشان «رسید» (§۱۱)، و جدول رتبه با فاصلهٔ نرسیده‌ها (§۱۲)'],
      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر، یک نقشهٔ ثابت، همهٔ بازار خریدنی (E1)، بی‌مانع و غار (E2، E3)؛ رسیده‌ها مشترک اول‌اند'],
    ],
  };
}
