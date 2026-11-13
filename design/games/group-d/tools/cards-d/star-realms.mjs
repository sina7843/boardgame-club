// Star Realms («قلمرو ستارگان») on the group D frame. Repo engine: 2 players, 50 authority, 8 Scouts + 2 Vipers, a generated 65-card trade
// deck in four factions (E1), unlimited Explorers (E2), allies automatic, scrap abilities optional, outposts must fall first.
// BGA layout: opponent's authority, bases and played ships on top; the trade row (Explorer pile, 5 cards, trade deck, scrap heap) in the
// middle; your authority, counters, bases and played ships above your hand.
// Art = the site's ready-to-use renders: cards 149×181 shown at 1× (hand) or exactly ½ = 74.5 px (row, bases, in play, modals) and ¼ on
// phone in-play; faction emblems 160×160 shown at 1/8 = 20 px.
// Mock, turn 7: you 38 authority (16 cards: 8 scouts, 2 vipers, supplybot, battlebot, station, explorer, tradebot, ifighter),
// نیلوفر 31 with Trading Post (outpost 4) and Barter World (4). Start: discard 1 (her frigate). Hand supplybot, battlebot, scout, viper →
// play 3: trade 2+1 = 3, combat 2 + ally 2 + ally 2 = 6 (station is Machine Cult, so both bots ally), scrap 2.
// Scrap station +5 → 11; scrap the viper (hand) and a scout (discard); buy frigate (3). Attack: post 4, barter 4, then her 3 → 28.
// Her turn: cutter + shuttle (both Federation: cutter +4 combat, shuttle +4 authority), 2 vipers, scout → 6 combat on you (38 → 32), she 36.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (k) => H.ART['sr-' + k];
  const T = { scout: ['دیده‌بان', 'none', 0], viper: ['افعی', 'none', 0], explorer: ['کاوشگر', 'none', 2], supplybot: ['ربات تدارکات', 'cult', 3], battlebot: ['رزم‌ربات', 'cult', 2], station: ['ایستگاه نبرد', 'cult', 3], frigate: ['ناوچهٔ امپراتوری', 'emp', 3], ram: ['کوبنده', 'blob', 3], freighter: ['باربر ستاره‌ای', 'fed', 4], mothership: ['ناو مادر', 'blob', 7], flagship: ['ناو پرچم', 'fed', 6], tradepost: ['ایستگاه تجاری', 'fed', 3], barter: ['دنیای داد و ستد', 'fed', 4], cutter: ['ناو کاروان', 'fed', 2], shuttle: ['بلم بازرگانی', 'fed', 1], ifighter: ['جنگندهٔ امپراتوری', 'emp', 1], tradebot: ['ربات تجاری', 'cult', 1], corvette: ['نیزه', 'emp', 2], tradepod: ['غلاف تجاری', 'blob', 2], yacht: ['کشتی سفیر', 'fed', 3], patrol: ['گشت مکانیکی', 'cult', 4], wheel: ['چرخ هیولا', 'blob', 3] };
  const im = (k, alt = '', cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${A(k)}" alt="${alt}">`;
  const alt = (k) => `${T[k][0]}${T[k][2] ? `، قیمت ${fa(T[k][2])}` : ''}`;
  // card o: { ok, sel, no, post, lock, ally, tag, scrap }
  const card = (k, o = {}) => `<span class="sr-c${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}${o.no ? ' is-no' : ''}${o.post ? ' is-post' : ''}${o.lock ? ' is-lock' : ''}">${im(k, alt(k))}${o.ally ? `<i class="sr-ally">${im('f-' + T[k][1])}متحد ✓</i>` : ''}${o.tag ? `<b class="sr-tag">${o.tag}</b>` : ''}${o.scrap ? `<button type="button" class="sr-scrap">نابودی: ${o.scrap}</button>` : ''}</span>`;
  const cards = (list) => list.map((x) => (Array.isArray(x) ? card(x[0], x[1]) : card(x))).join('');
  const auth = (label, n, o = {}) => `<div class="sr-auth${o.hit ? ' is-hit' : ''}"><small>${label}</small><b>${fa(n)}</b>${o.hit ? `<em>−${fa(o.hit)}</em>` : ''}${o.gain ? `<em class="is-gain">+${fa(o.gain)}</em>` : ''}</div>`;
  const piles = (d, x, top) => `<div class="sr-piles"><span>دسته <b>${fa(d)}</b></span><span>${top ? card(top) : '<i class="sr-empty"></i>'}دورریخته <b>${fa(x)}</b></span></div>`;
  const zone = (label, inner, cls = '') => `<div class="sr-zone${cls ? ' ' + cls : ''}"><small>${label}</small><div class="sr-row">${inner}</div></div>`;
  const cnt = (t, c, s) => `<div class="sr-cnt"><span class="is-t">تجارت <b>${fa(t)}</b></span><span class="is-c">نبرد <b>${fa(c)}</b></span>${s !== undefined ? `<span>نابودی <b>${fa(s)}</b></span>` : ''}</div>`;
  // st: { oa, ohit, ogain, obases, oplay, ocnt, opiles:[d,x,top], row:[[k,o]], ex:o, tdeck, heap, banner }
  const table = (st) => (ph) => `${st.banner ? `<div class="sr-banner">${ic(st.bannerIc ?? 'info')}<span>${st.banner}</span></div>` : ''}<div class="sr-oz">${auth('اعتبار نیلوفر', st.oa, { hit: st.ohit, gain: st.ogain })}${st.oplay && !st.obases.length ? '' : zone('پایگاه‌های نیلوفر', st.obases.length ? cards(st.obases) : '<span class="sr-none">پایگاهی ندارد</span>', 'sr-zone--bases')}${st.oplay ? zone('در بازی نیلوفر', cards(st.oplay), 'sr-zone--play') : ''}${st.ocnt ? cnt(...st.ocnt) : ''}${ph || st.oplay ? '' : piles(...st.opiles)}</div><div class="sr-tz"><div class="sr-trow">${card('explorer', st.ex ?? {})}${cards(st.row)}</div><div class="sr-tside"><span class="bgv-chip">دستهٔ تجارت: ${fa(st.tdeck)}</span><span class="bgv-chip">نابودشده‌ها: ${fa(st.heap)}</span>${ph ? '' : '<small>کاوشگر همیشه هست، ۲ تجارت</small>'}</div></div>`;
  // m: { a, hit, gain, t, c, s, bases, play, acts, piles:[d,x,top] }
  const above = (m) => (ph) => `<div class="sr-me${ph ? ' sr-me--ph' : ''}">${auth('اعتبار شما', m.a, { hit: m.hit, gain: m.gain })}<div class="sr-mid"><div class="sr-bar">${m.t !== undefined ? cnt(m.t, m.c, m.s) : ''}${m.acts ? m.acts(ph) : ''}</div><div class="sr-play">${zone('پایگاه‌های شما', m.bases?.length ? cards(m.bases) : '<span class="sr-none">پایگاهی ندارید</span>', 'sr-zone--bases')}${zone('در بازی', m.play?.length ? cards(m.play) : '<span class="sr-none">هنوز کارتی بازی نشده</span>', 'sr-zone--play')}</div></div>${ph ? '' : piles(...(m.piles ?? [6, 5, 'scout']))}</div>`;
  const hand = (list, o = {}) => list.map((k, i) => ({ art: 'sr-' + k, alt: alt(k), ok: o.ok?.includes(i), sel: o.sel?.includes(i), dim: o.dim?.includes(i) }));
  const seatMeta = (a, h, d) => `<span class="gc-tag gc-tag--soft">اعتبار ${fa(a)}</span><span>دست ${fa(h)}</span><span>دسته ${fa(d)}</span>`;
  const opps = (a, h, d, turn, clock = '1:20') => [{ name: 'نیلوفر', av: 'ن', seat: 2, clock, turn, meta: seatMeta(a, h, d) }];
  const note = (a) => `<span class="cx-note">اعتبار ${fa(a)}</span>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rail = (turn, tdeck, heap) => `<section class="cx-card"><h3>نوبت ${fa(turn)}</h3><div class="gc-pills"><span class="bgv-chip">دستهٔ تجارت: ${fa(tdeck)}</span><span class="bgv-chip">نابودشده‌ها: ${fa(heap)}</span></div><div class="ga-rule">${ic('info')}<span>کارت‌ها را بازی کنید، با تجارت بخرید و با نبرد حمله کنید؛ تا حریف پاسگاه دارد، اول باید پاسگاه را بزنید. متحد وقتی فعال می‌شود که کارت دیگری از همان جناح در بازی باشد. اعتبار حریف به صفر برسد، می‌برید.</span></div></section>`;

  // ---------- state ----------
  const ROW = [['frigate'], ['ram'], ['freighter'], ['mothership'], ['flagship']];
  const ROWBUY = [['frigate', { ok: true }], ['ram', { ok: true }], ['freighter', { no: true }], ['mothership', { no: true }], ['flagship', { no: true }]];
  const OB = [['tradepost', { post: true, tag: 'پاسگاه' }], ['barter']];
  const PLAY = [['supplybot', { ally: true }], ['battlebot', { ally: true }], ['scout']];
  const BASE = (o = {}) => [['station', { scrap: `+${fa(5)} نبرد`, ...o }]];
  const BASEO = { oa: 31, obases: OB, opiles: [7, 6, 'frigate'], row: ROW, tdeck: 45, heap: 2 };
  const trade = 2 + 1, combat = 2 + 2 + 2;
  if (trade !== 3 || combat + 5 - 4 - 4 !== 3 || 31 - 3 !== 28 || 38 - (1 + 1 + 4) !== 32 || 28 + 4 + 4 !== 36) throw new Error('star-realms numbers');
  const LOG = [[2, 'نیلوفر ناوچهٔ امپراتوری بازی کرد: یک کارت دور بریزید'], [1, 'شما یک دیده‌بان دور ریختید'], [1, 'شما ربات تدارکات، رزم‌ربات و دیده‌بان بازی کردید'], [1, 'متحد فرقهٔ ماشین: ۴+ نبرد']];

  const discardM = (ph) => modal('یک کارت دور بریزید', `<p>نیلوفر نوبت قبل ناوچهٔ امپراتوری بازی کرد. قبل از هر کاری یک کارت از دستتان دور بریزید.</p><div class="sr-pick">${cards(['supplybot', 'battlebot', ['scout', { sel: true }], 'scout', 'viper'])}</div><p class="cx-note">یک دیده‌بان انتخاب شده است.</p>`, btn('دور ریختن', 'primary', 'check'));
  const scrapSelfM = (ph) => modal('ایستگاه نبرد را نابود می‌کنید؟', `<div class="sr-mrow">${card('station', { sel: true })}<div><p>نابودی: ${fa(5)}+ نبرد. این کارت برای همیشه از بازی بیرون می‌رود و به کپهٔ نابودشده‌ها می‌رود.</p><p class="sr-mline"><span class="sr-pill">نبرد ${fa(6)} ← ${fa(11)}</span></p><p class="cx-note">متحد ربات‌ها همین نوبت گرفته شده و از بین نمی‌رود.</p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('نابود کن', 'primary', 'check')}`);
  const scrapCardM = (ph) => modal('نابود کردن کارت', `<div class="sr-tabs" role="tablist"><button type="button" class="is-on">دست (${fa(1)})</button><button type="button">دورریخته (${fa(5)})</button><span class="sr-pill">${fa(2)} نابودی مانده</span></div><div class="sr-pick">${card('viper', { sel: true })}</div><p>ربات تدارکات و رزم‌ربات هر کدام یک نابودی داده‌اند. کارت ضعیف را از دست یا دورریخته بیرون ببرید تا دسته‌تان قوی‌تر شود.</p>`, `${btn('رد', 'secondary', 'x')}${btn('نابود کن', 'primary', 'check')}`);
  const endWarnM = (ph) => modal(`${fa(3)} نبرد استفاده نشده`, `<p>هر دو پایگاه نیلوفر نابود شد و ${fa(3)} نبرد مانده است. اگر نوبت را تمام کنید، از بین می‌رود.</p>`, `${btn('پایان نوبت', 'secondary', 'check')}${btn(`حمله به حریف (${fa(3)})`, 'primary', 'swords')}`);
  const endM = (ph) => modal('اعتبار نیلوفر به صفر رسید؛ شما بردید', `<p>آخرین حملهٔ شما اعتبار نیلوفر را به صفر رساند و بازی همان لحظه تمام شد.</p>${tbl(['بازیکن', 'اعتبار', 'کارت‌ها', 'پایگاه', 'نابودشده'], [{ c: [`${ic('trophy')} شما`, fa(14), fa(17), fa(1), fa(4)], win: true }, { c: ['نیلوفر', fa(0), fa(21), fa(0), fa(0)] }])}<p class="cx-note">تساوی در این بازی پیش نمی‌آید.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  const meMain = { a: 38, t: 3, c: 6, s: 2, bases: BASE(), play: PLAY, piles: [6, 5, 'scout'] };
  return {
    slug: 'StarRealms', fa: 'قلمرو ستارگان', latin: 'Star Realms', meta: ['زنده', '۲ نفر', 'نوبت ۷'],
    opps: opps(31, 5, 7, false),
    me: { cards: hand(['viper'], { ok: [0] }), clock: '1:12', turn: true, note: note(38), above: above({ ...meMain, acts: (ph) => `${btn(ph ? 'همه' : 'بازی همه', 'secondary', 'next')}${btn(ph ? 'پایان' : 'پایان نوبت', 'secondary', 'check')}` }) },
    cardW: 149, phoneCardW: 74.5, cardRatio: 1.215,
    table: table({ ...BASEO, row: ROWBUY, ex: { ok: true } }),
    status: `<b>نوبت شماست: مرحلهٔ اصلی.</b> سه کارت بازی کردید. ایستگاه نبرد هم از فرقهٔ ماشین است، پس هر دو ربات متحد شدند (${fa(4)}+ نبرد). ${fa(3)} تجارت، ${fa(6)} نبرد و ${fa(2)} نابودی دارید؛ کارت‌های سبز ردیف تجارت خریدنی‌اند.`,
    pstatus: `<b>مرحلهٔ اصلی.</b> تجارت ${fa(3)}، نبرد ${fa(6)}، نابودی ${fa(2)}.`,
    railCard: rail(7, 45, 2), logNote: `نوبت ${fa(7)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'حریف'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'اعتبار ۵۰، نفر اول ۳ کارت',
        meta: ['زنده', '۲ نفر', 'نوبت ۱'],
        opps: opps(50, 3, 7, true, '1:30'),
        me: { turn: false, clock: '1:30', note: note(50), cards: hand(['scout', 'scout', 'viper', 'scout', 'scout']), above: above({ a: 50, bases: [], play: [], piles: [5, 0, null] }) },
        table: table({ oa: 50, obases: [], opiles: [7, 0, null], row: [['corvette'], ['tradepod'], ['yacht'], ['patrol'], ['wheel']], tdeck: 60, heap: 0 }),
        railCard: rail(1, 60, 0),
        status: `<b>بازی شروع شد.</b> هر کدام ${fa(50)} اعتبار و دستهٔ ده‌کارتی (${fa(8)} دیده‌بان و ${fa(2)} افعی) دارید. نیلوفر به قید قرعه نفر اول است و ${fa(3)} کارت کشید؛ شما ${fa(5)} کارت دارید.`,
        log: [[1, 'بازی با ۲ نفر شروع شد'], [2, 'نیلوفر نفر اول است']], logNote: `نوبت ${fa(1)}`,
      },
      {
        shotTitle: 'شروع نوبت', turnSub: 'یک کارت دور بریزید',
        me: { cards: hand(['supplybot', 'battlebot', 'scout', 'scout', 'viper'], { sel: [2] }), note: note(38), above: above({ a: 38, t: 0, c: 0, s: 0, bases: BASE({ scrap: '' }), play: [], piles: [6, 4, 'viper'] }) },
        table: table({ ...BASEO, banner: 'ایستگاه نبرد اثر نوبتی ندارد؛ فقط پاسگاه است و متحد ماشین را فعال می‌کند' }),
        overlay: discardM,
        status: `<b>شروع نوبت شما.</b> اثر پایگاه‌ها خودکار اعمال شد. نیلوفر ناوچهٔ امپراتوری بازی کرده بود، پس اول باید یک کارت دور بریزید.`,
        pstatus: `<b>یک کارت دور بریزید.</b>`,
        log: [[2, 'نیلوفر ناوچهٔ امپراتوری بازی کرد'], [2, 'نیلوفر پایان نوبت'], [1, 'شما باید ۱ کارت دور بریزید']],
        phone: true,
      },
      {
        shotTitle: 'توانایی نابودی', turnSub: 'نابودی ایستگاه نبرد: ۵+ نبرد',
        me: { cards: hand(['viper']), note: note(38), above: above({ ...meMain, bases: BASE({ sel: true }) }) },
        table: table(BASEO),
        overlay: scrapSelfM,
        status: `<b>نابودی:</b> دکمهٔ کوچک «نابودی: ${fa(5)}+ نبرد» روی ایستگاه را زدید. قبل از اجرا تأیید می‌خواهد، چون کارت برای همیشه بیرون می‌رود.`,
        log: [...LOG.slice(1), [1, 'شما نابودی ایستگاه نبرد را زدید']],
      },
      {
        shotTitle: 'نابود کردن کارت', turnSub: 'از دست یا دورریخته',
        me: { cards: hand(['viper'], { sel: [0] }), note: note(38), above: above({ ...meMain, c: 11, bases: [] }) },
        table: table({ ...BASEO, heap: 3 }),
        overlay: scrapCardM,
        status: `<b>نابود کردن کارت:</b> ${fa(2)} نابودی دارید. افعی از دست انتخاب شده؛ بعد از آن یک دیده‌بان را از دورریخته بیرون می‌برید.`,
        pstatus: `<b>${fa(2)} نابودی مانده.</b> افعی از دست.`,
        log: [[1, 'شما ایستگاه نبرد را نابود کردید: ۵+ نبرد'], [1, 'نبرد شما ۱۱ شد'], [1, 'انتخاب کارت برای نابودی']],
        phone: true,
      },
      {
        shotTitle: 'خرید', turnSub: 'کارت‌هایی که تجارتش را دارید روشن‌اند',
        me: { cards: [], note: note(38), above: above({ ...meMain, c: 11, s: 0, bases: [], piles: [6, 4, 'viper'], acts: (ph) => btn(ph ? 'خرید (۳)' : `خرید ناوچهٔ امپراتوری (${fa(3)})`, 'primary', 'check') }) },
        table: table({ ...BASEO, heap: 5, row: [['frigate', { sel: true }], ['ram', { ok: true }], ['freighter', { no: true }], ['mothership', { no: true }], ['flagship', { no: true }]], ex: { ok: true } }),
        status: `<b>خرید:</b> ${fa(3)} تجارت دارید؛ ناوچهٔ امپراتوری، کوبنده و کاوشگر خریدنی‌اند. ناوچه انتخاب شده و بعد از خرید به دورریختهٔ شما می‌رود و جایش از دستهٔ تجارت پر می‌شود.`,
        log: [[1, 'شما افعی را از دست نابود کردید'], [1, 'شما یک دیده‌بان را از دورریخته نابود کردید'], [1, 'ناوچهٔ امپراتوری انتخاب شد']],
      },
      {
        shotTitle: 'حمله', turnSub: 'اول پاسگاه',
        me: { cards: [], note: note(38), above: above({ ...meMain, t: 0, c: 11, s: 0, bases: [], piles: [6, 5, 'frigate'], acts: (ph) => btn(ph ? 'حمله به حریف' : 'حمله به حریف: اول پاسگاه', 'secondary', 'swords').replace('<button', '<button disabled') }) },
        table: table({ ...BASEO, heap: 5, obases: [['tradepost', { post: true, sel: true, tag: 'اول پاسگاه' }], ['barter', { lock: true, tag: 'قفل' }]], row: [['corvette'], ['ram'], ['freighter'], ['mothership'], ['flagship']], tdeck: 44 }),
        status: `<b>حمله: ${fa(11)} نبرد.</b> نیلوفر پاسگاه دارد، پس اول ایستگاه تجاری (دفاع ${fa(4)}) با قاب قرمز هدف است. دنیای داد و ستد و خود نیلوفر بعد از آن قابل حمله‌اند.`,
        pstatus: `<b>${fa(11)} نبرد.</b> اول پاسگاه نیلوفر.`,
        log: [[1, 'شما ناوچهٔ امپراتوری خریدید'], [1, 'نیزه به ردیف تجارت آمد'], [1, 'حمله: اول پاسگاه']],
        phone: true,
      },
      {
        shotTitle: 'پایان نوبت', turnSub: 'هشدار نبرد استفاده‌نشده',
        me: { cards: [], note: note(38), above: above({ ...meMain, t: 0, c: 3, s: 0, bases: [], piles: [6, 5, 'frigate'] }) },
        table: table({ ...BASEO, obases: [], opiles: [7, 8, 'barter'], heap: 5, row: [['corvette'], ['ram'], ['freighter'], ['mothership'], ['flagship']], tdeck: 44 }),
        overlay: endWarnM,
        status: `<b>دو پایگاه نیلوفر نابود شد</b> و به دورریختهٔ خودش رفت. «پایان نوبت» را زدید ولی ${fa(3)} نبرد مانده؛ هشدار می‌دهد که از بین می‌رود.`,
        log: [[1, 'ایستگاه تجاری نیلوفر نابود شد'], [1, 'دنیای داد و ستد نیلوفر نابود شد'], [1, '۳ نبرد استفاده نشده']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'حمله به اعتبار شما',
        opps: opps(36, 0, 2, true),
        me: { turn: false, cards: hand(['scout', 'tradebot', 'scout', 'ifighter', 'scout']), note: note(32), above: above({ a: 32, hit: 6, bases: [], play: [], piles: [1, 10, 'frigate'] }) },
        table: table({ oa: 36, ogain: 8, obases: [], oplay: [['cutter', { ally: true }], ['shuttle', { ally: true }], ['viper'], ['viper'], ['scout']], ocnt: [5, 0], opiles: [2, 8, 'barter'], row: [['corvette'], ['ram'], ['freighter'], ['mothership'], ['flagship']], tdeck: 44, heap: 5 }),
        status: `<b>نوبت نیلوفر است.</b> ناو کاروان و بلم بازرگانی هر دو از فدراسیون‌اند و متحد شدند: ${fa(4)}+ نبرد و ${fa(4)}+ اعتبار. با دو افعی ${fa(6)} نبرد به شما زد (${fa(32)})؛ حالا ${fa(5)} تجارت برای خرید دارد.`,
        log: [[1, 'شما ۳ نبرد به نیلوفر زدید: ۲۸'], [2, 'نیلوفر ناو کاروان و بلم بازرگانی بازی کرد'], [2, '۶ نبرد به شما: ۳۲']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'اعتبار حریف به صفر رسید',
        meta: ['تمام‌شده', '۲ نفر'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: seatMeta(0, 5, 3) }],
        me: { turn: false, clock: '', cards: [], note: note(14), above: above({ a: 14, t: 1, c: 13, bases: [['station']], play: [['frigate', { ally: true }], ['corvette', { ally: true }], ['ram'], ['scout']], piles: [4, 8, 'tradebot'] }) },
        table: table({ oa: 0, ohit: 13, obases: [], opiles: [3, 13, 'cutter'], row: [['yacht'], ['patrol'], ['freighter'], ['wheel'], ['tradepod']], tdeck: 30, heap: 9 }),
        overlay: endM, railCard: rail(12, 30, 9),
        status: `<b>بازی تمام شد.</b> اعتبار نیلوفر به صفر رسید و شما بردید.`,
        log: [[1, 'شما ۱۳ نبرد زدید'], [2, 'اعتبار نیلوفر به صفر رسید'], [1, 'شما بردید']], logNote: `نوبت ${fa(12)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.sr-oz{display:flex;align-items:center;gap:12px;inline-size:100%;justify-content:center}
.sr-tz{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:14px;background:rgba(6,14,20,.3);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)}
.sr-trow{display:flex;gap:7px;direction:ltr}
.sr-trow>.sr-c:first-child{margin-inline-end:10px}
.sr-tside{display:grid;gap:6px;justify-items:start;color:var(--felt-muted);font-size:11.5px}
.sr-tside .bgv-chip{font-size:12.5px}
.sr-c{position:relative;display:block;inline-size:74.5px;flex:none}
.sr-c img{display:block;inline-size:100%;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 6px 10px -6px rgba(0,0,0,.6)}
.sr-c.is-ok img{box-shadow:0 0 0 3px #5FBF7A,0 6px 10px -6px rgba(0,0,0,.6)}
.sr-c.is-sel{transform:translateY(-5px)}.sr-c.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.sr-c.is-no img{filter:grayscale(.7) brightness(.7)}
.sr-c.is-post img{box-shadow:0 0 0 3px #E0505C,0 6px 10px -6px rgba(0,0,0,.6)}
.sr-c.is-post.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px #E0505C}
.sr-c.is-lock img{filter:grayscale(.6) brightness(.65)}
.sr-ally{position:absolute;inset-block-start:-8px;inset-inline:0;margin-inline:auto;inline-size:max-content;display:inline-flex;align-items:center;gap:2px;font-style:normal;font-size:10.5px;font-weight:800;padding:1px 6px 1px 3px;border-radius:999px;background:#5FBF7A;color:#0E2A1A;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.sr-ally img{inline-size:14px;block-size:14px;box-shadow:none;border-radius:50%}
.sr-tag{position:absolute;inset-block-end:-8px;inset-inline:0;margin-inline:auto;inline-size:max-content;max-inline-size:110px;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:999px;background:#E0505C;color:#fff;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.sr-c:not(.is-post) .sr-tag{background:#142B3B}
.sr-scrap{all:unset;cursor:pointer;position:absolute;inset-block-end:-9px;inset-inline:0;margin-inline:auto;inline-size:max-content;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:999px;background:var(--felt-gold);color:#142B3B;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.sr-auth{position:relative;display:grid;justify-items:center;align-content:center;inline-size:84px;block-size:84px;flex:none;border-radius:16px;background:rgba(250,245,236,.08);box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.18);color:var(--felt-ink)}
.sr-auth small{font-size:11px;color:var(--felt-muted)}
.sr-auth b{font-size:30px;line-height:1.1}
.sr-auth em{position:absolute;inset-block-start:-8px;inset-inline-end:-8px;font-style:normal;font-size:13px;font-weight:800;padding:1px 7px;border-radius:999px;background:#E0505C;color:#fff;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.sr-auth em.is-gain{background:#5FBF7A;color:#0E2A1A;inset-inline-end:auto;inset-inline-start:-4px}
.sr-auth.is-hit{box-shadow:inset 0 0 0 2px #E0505C}
.sr-zone{display:grid;gap:4px;justify-items:start;color:var(--felt-muted);font-size:11.5px}
.sr-zone>.sr-row{display:flex;gap:6px;min-block-size:90px;align-items:center;direction:ltr}
.sr-none{font-size:12px;color:var(--felt-muted);direction:rtl}
.sr-piles{display:grid;gap:6px;color:var(--felt-ink);font-size:12.5px}
.sr-piles span{display:flex;align-items:center;gap:6px}
.sr-piles .sr-c{inline-size:37.25px}
.sr-piles .sr-c img{border-radius:3px}
.sr-empty{inline-size:37px;block-size:45px;border-radius:4px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.22)}
.sr-cnt{display:flex;gap:6px}
.sr-cnt span{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:13px}
.sr-cnt b{font-size:15px}
.sr-cnt .is-t b{color:#F2C14E}.sr-cnt .is-c b{color:#F08A8A}
.sr-banner{display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13px;font-weight:700}
.sr-me{display:flex;align-items:center;justify-content:center;gap:12px;inline-size:100%}
.sr-mid{display:grid;gap:6px}
.sr-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sr-play{display:flex;gap:14px}
.sr-pick{display:flex;gap:8px;justify-content:center;direction:ltr;padding-block:8px 4px}
.sr-mrow{display:flex;gap:16px;align-items:flex-start}
.sr-mrow>div{display:grid;gap:10px;flex:1}
.sr-mrow .sr-c{inline-size:149px}
.sr-pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;background:var(--surface-sunken);color:var(--text);font-size:13px;font-weight:700}
.sr-tabs{display:flex;align-items:center;gap:6px}
.sr-tabs button{all:unset;cursor:pointer;padding:6px 14px;border-radius:999px;font-size:13.5px;box-shadow:inset 0 0 0 1px var(--border);color:var(--text)}
.sr-tabs button.is-on{background:var(--heading);color:var(--surface);box-shadow:none;font-weight:700}
.sr-tabs .sr-pill{margin-inline-start:auto}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.cx-phone .gc-table{gap:6px}
.cx-phone .sr-oz{gap:8px;padding-inline:8px;box-sizing:border-box}
.cx-phone .sr-auth{inline-size:58px;block-size:58px;border-radius:12px}.cx-phone .sr-auth b{font-size:21px}.cx-phone .sr-auth small{font-size:9.5px}
.cx-phone .sr-zone>.sr-row{min-block-size:46px;gap:4px}
.cx-phone .sr-zone--play .sr-c,.cx-phone .sr-zone--bases .sr-c{inline-size:37.25px}
.cx-phone .sr-zone .sr-tag,.cx-phone .sr-zone .sr-scrap{font-size:9px;padding:0 4px;max-inline-size:none}
.cx-phone .sr-zone .sr-ally{font-size:0;padding:1px}.cx-phone .sr-zone .sr-ally img{inline-size:12px;block-size:12px}
.cx-phone .sr-tz{gap:8px;padding:6px 8px}
.cx-phone .sr-tz{flex-direction:column;align-items:stretch;inline-size:calc(100% - 16px);box-sizing:border-box;margin-inline:8px}
.cx-phone .sr-trow{gap:5px;overflow-x:auto;scrollbar-width:none;padding-block:6px 2px}
.cx-phone .sr-tside{display:flex;gap:6px;justify-content:center}
.cx-phone .sr-zone>small{display:none}
.cx-phone .sr-trow>.sr-c:first-child{margin:0}
.cx-phone .sr-tside .bgv-chip{font-size:11px}
.cx-phone .sr-cnt span{padding:3px 7px;font-size:11.5px}.cx-phone .sr-cnt b{font-size:13px}
.cx-phone .sr-banner{font-size:11.5px;padding:4px 10px;margin-inline:8px}
.sr-me--ph{gap:8px;padding-inline:8px;box-sizing:border-box}
.sr-me--ph .sr-play{gap:8px}
.sr-me--ph .sr-bar{gap:6px}
.cx-phone .sr-pick .sr-c{inline-size:58px}
.cx-phone .sr-pick{gap:5px}
.cx-phone .sr-mrow{flex-direction:column;align-items:center}
.cx-phone .sr-tabs button{padding:6px 10px;font-size:12.5px}`,
    shotTitle: 'نوبت شما', turnSub: 'مرحلهٔ اصلی با متحد فعال',
    diffs: [
      ['چیدمان', 'مثل BGA: اعتبار، پایگاه‌ها و کارت‌های در بازی نیلوفر بالا؛ ردیف تجارت با دستهٔ کاوشگر، دستهٔ تجارت و کپهٔ نابودشده‌ها وسط؛ اعتبار، شمارنده‌ها، پایگاه‌ها و کارت‌های در بازی شما بالای دستتان'],
      ['آرت', 'کارت‌ها و نشان جناح‌ها همان رندرهای سادهٔ سایت‌اند (کارت ۱۴۹×۱۸۱ در دست به اندازهٔ اصلی و بقیه جاها دقیقاً نصف) و بعداً با همان اندازه عوض می‌شوند'],
      ['شمارنده‌ها', 'تجارت، نبرد و نابودی همیشه کنار شماست. متحد روی کارت با نشان جناح و «متحد ✓» دیده می‌شود (§۱) و توانایی نابودی دکمهٔ کوچک روی کارت دارد که قبل از اجرا تأیید می‌خواهد (§۶)'],
      ['پنجره‌ها', 'دور ریختن اجباری اول نوبت (§۵)، نابود کردن کارت با زبانه‌های دست و دورریخته و شمارندهٔ نابودی مانده (§۷)، و هشدار تجارت یا نبرد استفاده‌نشده موقع پایان نوبت (§۱۰)'],
      ['حمله و خرید', 'کارت‌های خریدنی ردیف سبزند (§۸). پاسگاه حریف قاب قرمز «اول پاسگاه» دارد و تا نابود نشود بقیه قفل‌اند (§۹). ضربه روی اعتبار با «−۶» دیده می‌شود (§۱۱)'],
      ['قوانین', 'مثل موتور: فقط دونفره، اعتبار ۵۰، نفر اول ۳ کارت و نفر دوم ۵؛ ۶۵ کارت تجارت ساختهٔ موتور به جای ۸۰ کارت چاپی (E1) و کاوشگر بی‌پایان (E2)'],
    ],
  };
}
