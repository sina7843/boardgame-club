// Space Base («اسپیس بیس») on the group D frame. Repo engine: 2–5 players, 12 sectors, shop of 3 levels × 6, 40 VP. The design follows
// the screens in RULES.md, which assume the BGA fixes: every player picks sum or separate dice (E1), credits drop to income after a buy (E2),
// the round is finished after someone reaches 40 (E3). Ships are the real BGA cards (E4: the engine's ship list is generated).
// BGA layout: the 12-sector player board with the station ship in each slot and deployed ships tucked behind it, rotated, showing their red
// reward; the shop rows; the two dice with the choice. Opponents are summarised in their seats (credits, income, VP).
// Art = BGA: player board (3181×647, resized to 1600×325), ship cards (236×532, resized to 118×266), dice and credit/income/VP icons from
// sprites.png. Board slot geometry measured on the board image (x of the 12 slots, 113 px wide on the 1600 px copy).
// Mock: 4 players, order مینا → نیلوفر → رضا → سارا, رضا started. Card rewards below are the BGA values (ready to use/data).
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['sb-' + n];
  // id: [level, sector, cost, blue, red]   rewards: g credits, p VP, i income
  const C = { 150: [0, 1, 0, 'g1', 'g1'], 151: [0, 2, 0, 'g1', 'g1'], 152: [0, 3, 0, 'g1', 'g1'], 153: [0, 4, 0, 'g1', 'g1'], 154: [0, 5, 0, 'g1', 'g1'], 155: [0, 6, 0, 'g1', 'g1'], 156: [0, 7, 0, 'g3', 'g2'], 157: [0, 8, 0, 'g3', 'g2'], 158: [0, 9, 0, 'i1', 'g3'], 159: [0, 10, 0, 'i1', 'g3'], 160: [0, 11, 0, 'i1', 'g4'], 161: [0, 12, 0, 'i1', 'g5'],
    5: [1, 3, 3, 'g2', 'g1'], 42: [1, 7, 3, 'p2', 'g2 p1'], 16: [1, 8, 2, 'g5', 'g3'], 4: [1, 2, 3, 'g2', 'g1'], 38: [1, 3, 2, 'p1', 'g1'], 46: [1, 7, 3, 'g2 i1', 'g3'], 17: [1, 9, 2, 'g6', 'g4'], 33: [1, 10, 3, 'p3', 'p2'], 12: [1, 4, 2, 'g1', 'g1'],
    55: [2, 5, 8, 'g3', 'g2'], 63: [2, 1, 8, 'p2', 'p1'], 70: [2, 8, 8, 'p4', 'p2'], 86: [2, 9, 7, 'g6 i1', 'g2 i1'], 59: [2, 10, 7, 'g9', 'g6'], 81: [2, 3, 8, 'g3', 'p1'],
    104: [3, 3, 12, 'g4', 'g4'], 111: [3, 3, 14, 'p3', 'p2'], 116: [3, 8, 14, 'p6', 'p3'], 101: [3, 12, 14, 'g18', 'g10'], 124: [3, 7, 13, 'g3 i3', 'g3 i2'], 119: [3, 11, 14, 'p8', 'p5'] };
  const rw = (s) => Object.fromEntries(s.split(' ').map((t) => [t[0], +t.slice(1)]));
  const rtxt = (r) => [r.g ? `${fa(r.g)}+ اعتبار` : '', r.i ? `${fa(r.i)}+ درآمد` : '', r.p ? `${fa(r.p)}+ امتیاز` : ''].filter(Boolean).join('، ');
  const alt = (id) => { const [l, s, c] = C[id]; return `${l ? `کشتی سطح ${fa(l)}` : 'کشتی آغازین'}، بخش ${fa(s)}${c ? `، قیمت ${fa(c)}` : ''}`; };
  const im = (n, alt = '', cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${A(n)}" alt="${alt}">`;
  const SX = [52, 172, 292, 413, 563, 684, 805, 927, 1076, 1197, 1318, 1438];
  // board: st = { station:{s:id}, deployed:{s:[ids]}, on:[sectors], gain:{s:text} }
  const START = Object.fromEntries([...Array(12)].map((_, i) => [i + 1, 150 + i]));
  const boardInner = (b, half) => { const maxD = Math.max(0, ...Object.values(b.deployed ?? {}).map((d) => d.length)); const pos = (x) => (half ? ((x / 1600 * 747 - (half === 'R' ? 374 : 0)) / 374 * 100) : x / 16).toFixed(3); return `<div class="sb-bd${half ? ' sb-bd--' + half : ''}" style="--nd:${maxD}">${im('board', '', 'sb-bdi')}${SX.map((x, i) => [x, i]).filter(([, i]) => !half || (half === 'L' ? i < 6 : i >= 6)).map(([x, i]) => { const s = i + 1, id = (b.station ?? {})[s] ?? START[s], dep = (b.deployed ?? {})[s] ?? []; return `<div class="sb-slot${b.on?.includes(s) ? ' is-on' : ''}${b.sel === s ? ' is-sel' : ''}" style="left:${pos(x)}%">${dep.map((d, k) => `<span class="sb-dep" style="--k:${k + 1}">${im('c' + d, alt(d) + '، مستقر')}</span>`).join('')}<span class="sb-st">${im('c' + id, alt(id))}</span>${b.gain?.[s] ? `<em>${b.gain[s]}</em>` : ''}</div>`; }).join('')}</div>`; };
  const board = (b, ph, half) => ph ? `<div class="sb-halves">${(half ? [half] : ['L', 'R']).map((h) => `<div class="sb-half sb-half--${h}">${boardInner(b, h)}</div>`).join('')}</div>` : `<div class="sb-full">${boardInner(b)}</div>`;
  const die = (n) => `<span class="sb-die">${im('die-' + n, fa(n))}</span>`;
  const stat = (k, n, of) => `<span class="sb-st2">${im('ic-' + k)}<b>${fa(n)}</b>${of ? `<small>از ${fa(of)}</small>` : ''}</span>`;
  // dice panel: { d:[a,b], who, choice:'sep'|'sum'|null, prev:{sep,sum}, wait, note }
  const dicePanel = (d, ph) => `<div class="sb-dp${ph ? ' sb-dp--ph' : ''}"><div class="sb-dl">${d.who}</div><div class="sb-dice">${d.d ? die(d.d[0]) + die(d.d[1]) : '<span class="sb-die sb-die--none"></span><span class="sb-die sb-die--none"></span>'}</div>${d.prev ? `<div class="sb-chs"><button type="button" class="sb-ch${d.choice === 'sep' ? ' is-on' : ''}"><b>بخش‌های ${fa(d.d[0])} و ${fa(d.d[1])}</b><small>${d.prev.sep}</small></button><button type="button" class="sb-ch${d.choice === 'sum' ? ' is-on' : ''}"><b>بخش ${fa(d.d[0] + d.d[1])} (جمع)</b><small>${d.prev.sum}</small></button></div>` : ''}${d.note ? `<div class="sb-note">${d.note}</div>` : ''}${d.wait ? `<span class="bgv-chip">${d.wait}</span>` : ''}</div>`;
  const SHOP = [[4, 38, 46, 17, 33, 12], [55, 63, 70, 86, 59, 81], [104, 111, 116, 101, 124, 119]];
  const card = (id, o = {}) => `<span class="sb-c${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}${o.no ? ' is-no' : ''}">${im('c' + id, alt(id))}</span>`;
  const shop = (o = {}, ph) => `<div class="sb-shop${ph ? ' sb-shop--ph' : ''}" aria-label="کارگاه کشتی">${SHOP.map((row, l) => `<div class="sb-srow"><span class="sb-c sb-back">${im('back' + [1, 50, 99][l], `دستهٔ سطح ${fa(l + 1)}`)}</span>${row.map((id) => card(id, o.credits !== undefined ? { ok: C[id][2] <= o.credits && o.sel !== id, no: C[id][2] > o.credits, sel: o.sel === id } : {})).join('')}</div>`).join('')}</div>`;
  const gainTag = (g) => g ? `<span class="gc-tag">${g}</span>` : '';
  const seatMeta = (p) => `<span class="gc-tag gc-tag--soft">${fa(p.vp)} امتیاز</span>${gainTag(p.gain)}<span class="sb-sm">${im('ic-coin')}${fa(p.cr)}</span><span class="sb-sm">${im('ic-income')}${fa(p.inc)}</span>`;
  const NM = { 2: 'نیلوفر', 6: 'رضا', 4: 'سارا' };
  const opps = (st, turn) => [2, 6, 4].map((s) => ({ name: NM[s], av: NM[s][0], seat: s, clock: ({ 2: '1:30', 6: '1:10', 4: '1:45' })[s], turn: turn === s, meta: seatMeta(st[s]) }));
  // table st: { dice, shopO, showShopPh, banner }
  const table = (st) => (ph) => `${st.banner ? `<div class="sb-banner">${ic(st.bannerIc ?? 'flag')}<span>${st.banner}</span></div>` : ''}<div class="sb-row">${dicePanel(st.dice, ph)}${!ph || st.showShopPh ? shop(st.shopO, ph) : ''}</div>`;
  const above = (m) => (ph) => `<div class="sb-me${ph ? ' sb-me--ph' : ''}"><div class="sb-bar">${stat('coin', m.cr)}${stat('income', m.inc)}${stat('vp', m.vp, 40)}${m.acts ? `<span class="sb-acts">${m.acts(ph)}</span>` : ''}</div>${board(m.b, ph, m.half)}</div>`;
  const note = (vp) => `<span class="cx-note">${fa(vp)} از ${fa(40)} امتیاز</span>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rail = (round, first) => `<section class="cx-card"><h3>دور ${fa(round)}</h3><div class="gc-pills"><span class="bgv-chip">هدف: ${fa(40)} امتیاز</span><span class="bgv-chip">شروع‌کننده: ${first}</span></div><div class="ga-rule">${ic('info')}<span>تاس‌انداز دو تاس می‌ریزد و هر کس بخش جمع یا دو بخش جدا را انتخاب می‌کند. تاس‌انداز پاداش آبی کشتی ایستگاه را می‌گیرد و بقیه پاداش قرمز کشتی‌های مستقر را. بعد تاس‌انداز یک کشتی می‌خرد و اعتبارش به اندازهٔ درآمد برمی‌گردد.</span></div></section>`;

  // ---------- state ----------
  const B0 = { station: { 3: 5, 7: 42, 8: 16 }, deployed: { 3: [152], 7: [156], 8: [157] } };
  const B1 = { station: { ...B0.station, 5: 55 }, deployed: { ...B0.deployed, 5: [154] } };
  const ME0 = { cr: 8, inc: 2, vp: 18 };
  const O0 = { 2: { vp: 21, cr: 3, inc: 3 }, 6: { vp: 15, cr: 6, inc: 4 }, 4: { vp: 24, cr: 2, inc: 2 } };
  const sumOf = (ids, side) => ids.reduce((a, id) => { const r = rw(C[id][side === 'b' ? 3 : 4]); return { g: a.g + (r.g ?? 0), p: a.p + (r.p ?? 0), i: a.i + (r.i ?? 0) }; }, { g: 0, p: 0, i: 0 });
  const sep34 = sumOf([5, 153], 'b'), sum7 = sumOf([42], 'b');
  const nilSum8 = sumOf([157], 'r'), nilSep35 = sumOf([152, 154], 'r');
  if (sep34.g !== 3 || sum7.p !== 2 || nilSum8.g !== 2 || nilSep35.g !== 2) throw new Error('space-base rewards');
  const ME6 = { ...ME0, vp: ME0.vp + sum7.p };
  const O6 = { 2: { ...O0[2], cr: 5, gain: `+${fa(2)} اعتبار` }, 6: { ...O0[6], cr: 8, gain: `+${fa(2)} اعتبار` }, 4: { ...O0[4], cr: 7, gain: `+${fa(5)} اعتبار` } };
  const LOG = [[4, 'سارا کشتی سطح ۲ بخش ۱۰ خرید'], [1, 'نوبت شما'], [1, 'تاس‌ها: ۳ و ۴']];

  const buyM = (ph) => modal('خرید این کشتی؟', `<div class="sb-mrow">${card(55, { sel: true })}<div><p>کشتی سطح ${fa(2)} بخش ${fa(5)}، قیمت ${fa(8)}. پاداش آبی: ${rtxt(rw(C[55][3]))}؛ قرمز: ${rtxt(rw(C[55][4]))}.</p><p>این کشتی ایستگاه بخش ${fa(5)} می‌شود و کشتی آغازین آن بخش مستقر می‌شود؛ از این به بعد در نوبت دیگران پاداش قرمزش را می‌گیرید.</p><p class="sb-warn">${ic('info')}<span>بعد از خرید، اعتبار شما به ${fa(2)} (درآمد) برمی‌گردد.</span></p></div></div>`, `${btn('نمی‌خرم', 'secondary', 'x')}${btn('خرید', 'primary', 'check')}`);
  const endM = (ph) => modal('سارا برد', `<p>سارا به ${fa(40)} امتیاز رسید و دور تا نوبت نیلوفر ادامه پیدا کرد. کسی از او جلو نزد.</p>${tbl(['بازیکن', 'امتیاز', 'درآمد', 'اعتبار'], [{ c: [`${ic('trophy')} سارا`, fa(41), fa(4), fa(6)], win: true }, { c: ['شما', fa(39), fa(3), fa(5)] }, { c: ['نیلوفر', fa(33), fa(2), fa(7)] }, { c: ['رضا', fa(29), fa(5), fa(9)] }])}<p class="cx-note">تساوی در امتیاز با دورهای اضافه شکسته می‌شود.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'SpaceBase', fa: 'اسپیس بیس', latin: 'Space Base', meta: ['زنده', '۴ نفر', 'دور ۹'],
    opps: opps(O0, 0),
    me: { cards: [], clock: '0:58', turn: true, note: note(18), above: above({ ...ME0, b: { ...B0, on: [3, 4, 7] } }) },
    table: table({ dice: { who: 'شما تاس ریختید', d: [3, 4], choice: 'sum', prev: { sep: `${fa(sep34.g)}+ اعتبار`, sum: `${fa(sum7.p)}+ امتیاز` }, wait: `منتظر انتخاب ${fa(2)} نفر` } }),
    status: `<b>نوبت شماست.</b> تاس‌ها ${fa(3)} و ${fa(4)} آمد. بخش‌های ${fa(3)} و ${fa(4)} جدا ${fa(3)} اعتبار می‌دهد و بخش ${fa(7)} (جمع) ${fa(2)} امتیاز. هر کس خودش انتخاب می‌کند؛ شما پاداش آبی می‌گیرید و بقیه پاداش قرمز.`,
    pstatus: `<b>نوبت شما.</b> بخش‌های ${fa(3)} و ${fa(4)} یا بخش ${fa(7)}؟`,
    railCard: rail(9, 'رضا'), logNote: `دور ${fa(9)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'کارگاه'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: '۱۲ کشتی آغازین برای هر نفر',
        meta: ['زنده', '۴ نفر', 'دور ۱'],
        opps: opps({ 2: { vp: 0, cr: 6, inc: 0 }, 6: { vp: 0, cr: 3, inc: 0 }, 4: { vp: 0, cr: 4, inc: 0 } }, 6),
        me: { turn: false, clock: '1:30', note: note(0), above: above({ cr: 5, inc: 0, vp: 0, b: {} }) },
        table: table({ dice: { who: 'منتظر ریختن رضا', d: null } }),
        railCard: rail(1, 'رضا'),
        status: `<b>بازی شروع شد.</b> هر صفحه ${fa(12)} بخش با کشتی آغازین دارد و کارگاه از هر سطح ${fa(6)} کشتی رو کرده است. رضا شروع می‌کند؛ اعتبار اول بازی به ترتیب نوبت ${fa(3)}، ${fa(4)}، ${fa(5)} و ${fa(6)} است.`,
        log: [[1, 'بازی با ۴ نفر شروع شد'], [6, 'رضا شروع می‌کند']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'ریختن تاس', turnSub: 'شروع نوبت شما',
        opps: opps(O0, 0),
        me: { clock: '1:00', note: note(18), above: above({ ...ME0, acts: (ph) => btn('ریختن تاس', 'primary', 'repeat'), b: B0 }) },
        table: table({ dice: { who: 'نوبت شما', d: null, note: 'دو تاس بریزید' } }),
        status: `<b>نوبت شماست.</b> دو تاس بریزید. بعد از ریختن، بخش‌های فعال روی صفحهٔ همه روشن می‌شوند.`,
        log: [[4, 'سارا کشتی سطح ۲ بخش ۱۰ خرید'], [4, 'اعتبار سارا به ۲ برگشت'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'دریافت پاداش', turnSub: 'بخش ۷ برای همه',
        opps: opps(O6, 0),
        me: { note: note(20), above: above({ ...ME6, b: { ...B0, on: [7], gain: { 7: `+${fa(2)} امتیاز` } } }) },
        table: table({ dice: { who: 'شما تاس ریختید', d: [3, 4], note: `شما بخش ${fa(7)} را گرفتید. نیلوفر و سارا هم جمع را انتخاب کردند و رضا بخش‌های ${fa(3)} و ${fa(4)} را.` } }),
        status: `<b>پاداش‌ها رسید.</b> کشتی ایستگاه بخش ${fa(7)} پاداش آبی‌اش را داد: ${fa(2)} امتیاز (${fa(20)}). کنار هر بازیکن پاداش قرمزش آمده: نیلوفر ${fa(2)}، رضا ${fa(2)} و سارا ${fa(5)} اعتبار.`,
        pstatus: `<b>${fa(2)}+ امتیاز.</b> حالا نوبت خرید است.`,
        log: [[1, 'شما بخش ۷ را انتخاب کردید: ۲+ امتیاز'], [4, 'سارا ۵ اعتبار گرفت'], [2, 'نیلوفر ۲ اعتبار گرفت']],
        phone: true,
      },
      {
        shotTitle: 'خرید', turnSub: 'فقط تاس‌انداز',
        opps: opps(O6, 0),
        me: { note: note(20), above: above({ ...ME6, half: 'L', b: { ...B0, sel: 5 } }) },
        table: table({ dice: { who: 'شما تاس ریختید', d: [3, 4], choice: 'sum' }, shopO: { credits: 8, sel: 55 }, showShopPh: true }),
        overlay: buyM,
        status: `<b>خرید:</b> ${fa(8)} اعتبار دارید؛ کشتی‌هایی که قیمتشان را دارید سبزند. کشتی سطح ${fa(2)} بخش ${fa(5)} را زدید. می‌توانید نخرید و اعتبار را نگه دارید.`,
        pstatus: `<b>خرید.</b> بخش ${fa(5)}، قیمت ${fa(8)}.`,
        log: [[1, 'شما بخش ۷ را انتخاب کردید: ۲+ امتیاز'], [4, 'سارا ۵ اعتبار گرفت'], [1, 'کشتی بخش ۵ انتخاب شد']],
        phone: true,
      },
      {
        shotTitle: 'نوبت دیگران', turnSub: 'پاداش قرمز شما',
        opps: opps({ 2: { ...O6[2], gain: '' }, 6: { ...O6[6], gain: '' }, 4: { ...O6[4], gain: '' } }, 2),
        me: { turn: false, note: note(20), above: above({ cr: 2 + nilSum8.g, inc: 2, vp: 20, b: { ...B1, on: [8], gain: { 8: `+${fa(2)} اعتبار` } } }) },
        table: table({ dice: { who: 'نیلوفر تاس ریخت', d: [3, 5], choice: 'sum', prev: { sep: `${fa(nilSep35.g)}+ اعتبار`, sum: `${fa(nilSum8.g)}+ اعتبار` }, note: `نیلوفر بخش‌های ${fa(3)} و ${fa(5)} را گرفت.` } }),
        status: `<b>نوبت نیلوفر است.</b> تاس‌ها ${fa(3)} و ${fa(5)}. شما بخش ${fa(8)} (جمع) را انتخاب کردید و کشتی مستقر آنجا ${fa(2)} اعتبار داد. حالا نیلوفر خرید می‌کند.`,
        pstatus: `<b>نوبت نیلوفر.</b> شما ${fa(2)}+ اعتبار گرفتید.`,
        log: [[1, 'شما کشتی بخش ۵ خریدید'], [1, 'اعتبار شما به ۲ برگشت'], [2, 'نیلوفر: ۳ و ۵'], [1, 'شما بخش ۸ را گرفتید: ۲+ اعتبار']],
        phone: true,
      },
      {
        shotTitle: 'دور آخر', turnSub: 'سارا به ۴۰ رسید',
        meta: ['زنده', '۴ نفر', 'دور آخر'],
        opps: opps({ 2: { vp: 31, cr: 4, inc: 2 }, 6: { vp: 27, cr: 5, inc: 5 }, 4: { vp: 40, cr: 3, inc: 4 } }, 0),
        me: { clock: '0:45', note: note(37), above: above({ cr: 5, inc: 3, vp: 37, b: { ...B1, on: [3, 4, 7] } }) },
        table: table({ banner: `سارا به ${fa(40)} رسید؛ دور تا نوبت نیلوفر ادامه دارد`, dice: { who: 'شما تاس ریختید', d: [3, 4], choice: 'sum', prev: { sep: `${fa(3)}+ اعتبار`, sum: `${fa(2)}+ امتیاز` } } }),
        railCard: rail(14, 'رضا'),
        status: `<b>دور آخر.</b> سارا در نوبتش به ${fa(40)} امتیاز رسید. چون رضا شروع کرده، دور تا نوبت نیلوفر ادامه دارد تا همه به یک اندازه نوبت داشته باشند. شما و نیلوفر یک نوبت دیگر دارید.`,
        log: [[4, 'سارا ۴۰ امتیاز گرفت'], [4, 'دور آخر'], [1, 'تاس‌ها: ۳ و ۴']], logNote: `دور ${fa(14)}`,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: opps({ 2: { vp: 33, cr: 7, inc: 2 }, 6: { vp: 29, cr: 9, inc: 5 }, 4: { vp: 41, cr: 6, inc: 4 } }, 0).map((o) => ({ ...o, clock: '' })),
        me: { turn: false, clock: '', note: note(39), above: above({ cr: 5, inc: 3, vp: 39, b: B1 }) },
        table: table({ dice: { who: 'آخرین تاس: نیلوفر', d: [6, 2] } }),
        overlay: endM, railCard: rail(14, 'رضا'),
        status: `<b>بازی تمام شد.</b> سارا با ${fa(41)} امتیاز برد؛ شما با ${fa(39)} دوم شدید.`,
        log: [[1, 'شما بخش ۷ را گرفتید: ۲+ امتیاز'], [2, 'نیلوفر: ۶ و ۲'], [4, 'سارا برد']], logNote: `دور ${fa(14)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.sb-row{display:flex;align-items:center;justify-content:center;gap:14px}
.sb-dp{display:grid;justify-items:center;gap:8px;inline-size:270px;padding:10px 12px;border-radius:14px;background:rgba(6,14,20,.3);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink);box-sizing:border-box}
.sb-dl{font-size:13px;font-weight:700}
.sb-dice{display:flex;gap:10px;direction:ltr}
.sb-die{display:block;inline-size:56px;block-size:56px}
.sb-die img{display:block;inline-size:100%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))}
.sb-die--none{border-radius:10px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.22)}
.sb-chs{display:grid;gap:6px;inline-size:100%}
.sb-ch{all:unset;cursor:pointer;display:grid;gap:1px;padding:7px 12px;border-radius:12px;background:rgba(250,245,236,.08);box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.2);text-align:center}
.sb-ch b{font-size:14px}.sb-ch small{font-size:12.5px;color:var(--felt-muted)}
.sb-ch.is-on{background:var(--felt-gold);color:#142B3B;box-shadow:none}.sb-ch.is-on small{color:#142B3B}
.sb-note{font-size:12.5px;line-height:1.7;color:var(--felt-muted);text-align:center}
.sb-dp .bgv-chip{font-size:12.5px}
.sb-shop{display:grid;gap:6px;direction:ltr}
.sb-srow{display:flex;gap:5px}
.sb-c{display:block;inline-size:52px;flex:none;position:relative}
.sb-c img{display:block;inline-size:100%;border-radius:5px;box-shadow:0 2px 4px rgba(0,0,0,.45)}
.sb-back{margin-inline-end:6px}
.sb-c.is-ok img{box-shadow:0 0 0 2.5px #5FBF7A}
.sb-c.is-sel{transform:translateY(-4px)}.sb-c.is-sel img{box-shadow:0 0 0 2.5px #FAF5EC,0 0 0 5px var(--felt-gold)}
.sb-c.is-no img{filter:grayscale(.8) brightness(.65)}
.sb-banner{display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.sb-me{display:grid;gap:6px;justify-items:center;inline-size:100%}
.sb-bar{display:flex;align-items:center;gap:12px}
.sb-st2{display:inline-flex;align-items:center;gap:4px;color:var(--felt-ink);font-size:14px}
.sb-st2 img{inline-size:22px;block-size:22px}.sb-st2 b{font-size:16px}.sb-st2 small{color:var(--felt-muted);font-size:12px}
.sb-acts{display:flex;gap:8px}
.sb-full{--W:696px;inline-size:var(--W)}
.sb-bd{position:relative;inline-size:var(--W);aspect-ratio:1600/325;margin-block-start:calc(var(--nd) * var(--W) * .0239);direction:ltr}
.sb-bdi{display:block;inline-size:100%;block-size:100%;border-radius:6px;box-shadow:0 8px 16px -8px rgba(0,0,0,.7)}
.sb-slot{position:absolute;top:4.2%;inline-size:7.0625%}
.sb-st,.sb-dep{display:block;inline-size:100%}
.sb-st{position:relative;z-index:2}
.sb-st img,.sb-dep img{display:block;inline-size:100%;border-radius:4px}
.sb-st img{box-shadow:0 2px 4px rgba(0,0,0,.5)}
.sb-dep{position:absolute;top:calc(var(--k) * var(--W) * -.0239);left:0;z-index:1;transform:rotate(180deg)}
.sb-slot.is-on .sb-st img{box-shadow:0 0 0 2.5px var(--felt-gold),0 0 10px 3px rgba(232,166,66,.6)}
.sb-slot.is-sel .sb-st img{box-shadow:0 0 0 2.5px #FAF5EC,0 0 0 5px #5FBF7A}
.sb-slot em{position:absolute;z-index:3;top:38%;inset-inline:-14px;margin-inline:auto;inline-size:max-content;font-style:normal;font-size:11px;font-weight:800;padding:2px 6px;border-radius:999px;background:#5FBF7A;color:#0E2A1A;box-shadow:0 2px 4px rgba(0,0,0,.5);direction:rtl}
.sb-sm{display:inline-flex;align-items:center;gap:2px}.sb-sm img{inline-size:14px;block-size:14px}
.sb-mrow{display:flex;gap:16px;align-items:flex-start}
.sb-mrow .sb-c{inline-size:118px}
.sb-mrow>div{display:grid;gap:10px;flex:1}
.sb-warn{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:var(--surface-sunken);font-weight:700}
.sb-warn .bgv-icon{flex:none;color:var(--link)}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.cx-phone .gc-table{gap:6px}
.cx-phone .sb-row{flex-direction:column;gap:6px}
.sb-dp--ph{inline-size:calc(100% - 16px);display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 8px}
.sb-dp--ph .sb-dl,.sb-dp--ph .sb-note,.sb-dp--ph .bgv-chip{display:none}
.sb-dp--ph .sb-dice{gap:5px}.sb-dp--ph .sb-die{inline-size:40px;block-size:40px}
.sb-dp--ph .sb-chs{display:flex;gap:6px;inline-size:auto}
.sb-dp--ph .sb-ch{padding:5px 9px;white-space:nowrap}.sb-dp--ph .sb-ch b{font-size:12px}.sb-dp--ph .sb-ch small{font-size:11px}
.sb-shop--ph .sb-c{inline-size:40px}.sb-shop--ph .sb-srow{gap:4px}.sb-shop--ph{gap:4px}
.cx-phone .sb-banner{font-size:12px;padding:4px 10px;margin-inline:8px}
.sb-me--ph{gap:4px}
.sb-me--ph .sb-bar{gap:10px}.sb-me--ph .sb-st2{font-size:12.5px}.sb-me--ph .sb-st2 img{inline-size:18px;block-size:18px}
.sb-halves{display:grid;gap:2px;inline-size:374px}
.sb-half{inline-size:374px;direction:ltr}
.sb-half .sb-bd{--W:747px;inline-size:374px;aspect-ratio:auto;block-size:152px}
.sb-half .sb-bdi{object-fit:cover;object-position:0 50%}
.sb-half .sb-bd--R .sb-bdi{object-position:100% 50%}
.sb-half .sb-slot{inline-size:52.7px}
.cx-phone .gc-seat__meta .sb-sm:last-child,.cx-phone .gc-seat__meta .gc-tag:not(.gc-tag--soft){display:none}
.cx-phone .sb-slot em{font-size:10px;padding:1px 5px}
.cx-phone .sb-mrow{flex-direction:column;align-items:center}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب بخش‌ها',
    diffs: [
      ['چیدمان', 'مثل BGA: صفحهٔ ۱۲ بخشی شما پایین، با کشتی ایستگاه در هر بخش و کشتی‌های مستقر پشتش که وارونه‌اند و فقط پاداش قرمزشان پیداست؛ کارگاه سه‌ردیفه با پشت هر دسته و پنل تاس کنارش. اعتبار، درآمد و امتیاز حریف‌ها در کارت صندلی'],
      ['آرت', 'صفحه، کشتی‌ها، تاس‌ها و نشان اعتبار، درآمد و امتیاز همه از BGA است. روی گوشی صفحه مثل BGA دو نیمه می‌شود (بخش‌های ۱ تا ۶ و ۷ تا ۱۲)'],
      ['انتخاب تاس', 'دو دکمه با پیش‌نمایش پاداش خود شما، مثل «بخش‌های ۳ و ۴: ۳+ اعتبار» و «بخش ۷: ۲+ امتیاز»، و شمارندهٔ «منتظر انتخاب ۲ نفر». بخش‌های فعال روی صفحه طلایی می‌شوند و پاداش هر بخش روی همان کشتی می‌آید (§۶)'],
      ['خرید', 'کشتی‌های خریدنی سبز و بقیه خاکستری؛ پنجرهٔ خرید می‌گوید کشتی جای کدام ایستگاه می‌نشیند و هشدار می‌دهد که اعتبار به اندازهٔ درآمد برمی‌گردد (§۷)'],
      ['پایان', 'نوار «دور آخر» وقتی کسی به ۴۰ رسید (§۹) و جدول امتیاز، درآمد و اعتبار (§۱۰)'],
      ['قوانین', 'طرح رفتار BGA را نشان می‌دهد که RULES.md خواسته: انتخاب جدا برای هر نفر (E1)، برگشت اعتبار به درآمد بعد از خرید (E2) و تمام کردن دور بعد از ۴۰ (E3). کشتی‌ها کارت‌های واقعی BGA‌اند و موتور هنوز فهرست ساختگی دارد (E4)'],
    ],
  };
}
