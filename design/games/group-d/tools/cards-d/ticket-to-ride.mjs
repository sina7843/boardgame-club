// Ticket to Ride on the group D frame (repo engine: 2–5 players, maps USA | Europe | Iran). This board: USA (site renderer map with Persian names).
// Route geometry (slot transforms in the map's SVG viewBox -40 -40 1080 735) from tools/cards-d/ttr-usa.json (made by ttr_geo.py).
// Players: you blue (seat 1), Niloufar yellow (seat 2), Reza green (seat 6). You are building St. Louis–Pittsburgh (5 green) with 4 green + 1 locomotive.
import { readFileSync } from 'node:fs';
const GEO = JSON.parse(readFileSync(new URL('./ttr-usa.json', import.meta.url), 'utf8'));
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const [VX, VY, VW, VHt] = GEO.viewBox;
  const R = GEO.routes;
  const P = (x, y) => `left:${((x - VX) / VW * 100).toFixed(2)}%;top:${((y - VY) / VHt * 100).toFixed(2)}%`;
  const CARD = { 0: 'لوکوموتیو', 1: 'صورتی', 2: 'سفید', 3: 'آبی', 4: 'زرد', 5: 'نارنجی', 6: 'مشکی', 7: 'قرمز', 8: 'سبز' };
  const PTS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };
  const wagons = (i, p, cls = '') => R[i].slots.map(([x, y, a, w]) => `<img class="tt-w${cls}" style="${P(x, y)};width:${(w * 1.12 / VW * 100).toFixed(2)}%;height:${(13 / VHt * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${a}deg)" src="${H.ART['ttr-wagon-' + p]}" alt="">`).join('');
  const BAND = { b: '#2f6fd0', y: '#f0c92a', g: '#3d9a4a' };
  const band = (i, p) => R[i].slots.map(([x, y, a, w]) => `<i class="tt-band" style="${P(x, y)};width:${((w + 4) / VW * 100).toFixed(2)}%;height:${(17 / VHt * 100).toFixed(2)}%;background:${BAND[p]};transform:translate(-50%,-50%) rotate(${a}deg)"></i>`).join('');
  const hi = (i, cls) => R[i].slots.map(([x, y, a, w]) => `<i class="tt-hi ${cls}" style="${P(x, y)};width:${((w + 3) / VW * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${a}deg)"></i>`).join('');
  const CLAIM = { b: [31, 52, 50, 54], y: [7, 12, 15, 44], g: [80, 85, 90, 98] };
  const map = (o, w) => {
    let h = `<div class="tt-map" style="--bw:${w}px" role="img" aria-label="نقشهٔ آمریکای شمالی">${img('ttr-map', '')}`;
    for (const [p, list] of Object.entries(o.claim ?? CLAIM)) for (const i of list) h += band(i, p);
    for (const [p, list] of Object.entries(o.claim ?? CLAIM)) for (const i of list) h += wagons(i, p);
    for (const i of o.can ?? []) h += hi(i, 'is-can');
    for (const [i, cls] of o.hi ?? []) h += hi(i, cls);
    if (o.ghost) h += wagons(o.ghost.i, o.ghost.p, ' is-ghost');
    return h + '</div>';
  };
  const win = (o, ph) => ph ? `<div class="tt-win">${`<div class="tt-pan">${map(o, 820)}</div>`}<span class="tt-zoom">${ic('search')}کل نقشه</span></div>` : map(o, 692);
  const tc = (c, cls = '', n) => `<span class="tt-c${cls}">${img('ttr-card-' + c, CARD[c])}${n ? `<b>${fa(n)}</b>` : ''}</span>`;
  const MARKET = [3, 0, 4, 8, 7];
  const market = (o, ph) => `<div class="tt-mkt" role="group" aria-label="بازار کارت قطار"><span class="tt-deck">${img('ttr-back', 'دستهٔ کارت')}<b>${fa(o.deck ?? 54)}</b></span>${(o.market ?? MARKET).map((c, k) => tc(c, (o.mOff ?? []).includes(k) ? ' is-off' : (o.mSel === k ? ' is-sel' : ''))).join('')}${ph ? '' : `<span class="tt-tdeck"><small>بلیت</small><b>${fa(o.tdeck ?? 21)}</b></span>`}</div>`;
  const table = (o) => (ph) => `${win(o, ph)}${market(o, ph)}`;
  const HAND = [[0, 2], [8, 4], [6, 1], [7, 3], [2, 2], [5, 1], [1, 2]];
  const hand = (sel = {}) => `<div class="tt-hand" aria-label="کارت‌های قطار شما">${HAND.map(([c, n]) => tc(c, sel[c] ? ' is-sel' : '', n)).join('')}</div>`;
  const ticket = (t, st) => `<span class="tt-t${st ? ' is-' + st : ''}">${img('ttr-ticket-' + t, '')}${st === 'done' ? `<b>${ic('check')}</b>` : ''}</span>`;
  const above = (o) => (ph) => `<div class="tt-me${ph ? ' tt-me--ph' : ''}">${o.acts ? `<div class="tt-acts">${o.acts(ph)}</div>` : ''}<div class="tt-row">${hand(o.sel)}${ph ? '' : `<div class="tt-tix" aria-label="بلیت‌های شما">${ticket('16')}${ticket('01', 'done')}</div>`}</div></div>`;
  const opps = (turn, o = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:10', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${fa(o.n ?? 24)} امتیاز</span><span class="tt-sm">واگن ${fa(o.nw ?? 31)}</span><span class="tt-sm">بلیت ${fa(3)}</span>` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '0:55', turn: turn === 6, meta: `<span class="gc-tag gc-tag--soft">${fa(o.r ?? 27)} امتیاز</span><span class="tt-sm">واگن ${fa(o.rw ?? 33)}</span><span class="tt-sm">بلیت ${fa(2)}</span>` },
  ];
  const rail = `<section class="cx-card"><h3>امتیاز مسیرها</h3><div class="tt-pts">${Object.entries(PTS).map(([l, p]) => `<span><b>${fa(l)}</b> واگن<small>${fa(p)}</small></span>`).join('')}</div><div class="ga-rule">${ic('info')}<span>در هر نوبت فقط یکی از سه کار: دو کارت قطار بکشید، یک مسیر بسازید، یا بلیت بکشید. لوکوموتیو جای هر رنگی را می‌گیرد. بلندترین مسیر پیوسته ${fa(10)} امتیاز دارد.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const pick = (ts, keep, note) => `<div class="tt-pick">${ts.map(([t, on]) => `<button type="button" class="tt-pk${on ? ' is-on' : ''}" aria-pressed="${on}">${img('ttr-ticket-' + t, '')}<i>${on ? ic('check') : ''}</i></button>`).join('')}</div><p class="cx-note">${note}</p>`;
  const can1 = [92, 69, 89, 61];
  const pay = (ph) => `<div class="tt-pay"><span><small>سنت‌لوئیس ← پیتسبورگ</small><b>${fa(5)} واگن سبز، ${fa(10)}+ امتیاز</b></span><span class="tt-paycards">${tc(8, ' is-sel', 4)}${tc(0, ' is-sel', 1)}</span>${btn('ساختن', 'primary', 'check')}${ph ? '' : btn('لغو', 'secondary', 'x')}</div>`;
  return {
    slug: 'TicketToRide', fa: 'تیکت تو راید', latin: 'Ticket to Ride', meta: ['زنده', '۳ نفر', 'نقشهٔ آمریکا'],
    opps: opps(1),
    me: { cards: [], clock: '1:20', turn: true, note: `<span class="cx-note">${fa(19)} امتیاز${'<span class="bgv-sep"></span>'}واگن ${fa(33)}</span>`, above: above({ acts: pay, sel: { 8: 1, 0: 1 } }) },
    table: table({ hi: [[70, 'is-pick']], can: can1, ghost: { i: 70, p: 'b' } }),
    status: `<b>نوبت شماست.</b> مسیر سنت‌لوئیس ← پیتسبورگ (${fa(5)} سبز) را انتخاب کردید. با ${fa(4)} کارت سبز و ${fa(1)} لوکوموتیو می‌پردازید و ${fa(10)} امتیاز می‌گیرید؛ بلیت دنور ← پیتسبورگ هم کامل می‌شود.`,
    pstatus: `<b>ساختن مسیر.</b> ${fa(4)} سبز و ${fa(1)} لوکوموتیو، ${fa(10)}+ امتیاز.`,
    railCard: rail, logNote: `نوبت ${fa(14)}`,
    log: [[2, 'نیلوفر مسیر دولوث–شیکاگو را ساخت: ۴+'], [6, 'رضا ۲ کارت کشید: ۱ آبی رو و ۱ از دسته'], [1, 'نوبت شما']],
    dockItems: [['list', 'رویدادها'], ['search', 'نقشه'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی: انتخاب بلیت', turnSub: 'دست‌کم ۲ از ۳ (هم‌زمان)',
        table: table({ claim: {} }), opps: opps(0, { n: 0, r: 0, nw: 45, rw: 45 }),
        me: { clock: '', turn: true, note: `<span class="cx-note">${fa(0)} امتیاز<span class="bgv-sep"></span>واگن ${fa(45)}</span>`, above: above({}) },
        overlay: () => modal('بلیت‌های مقصد', pick([['16', true], ['01', true], ['23', false]], 2, 'دست‌کم ۲ بلیت را نگه دارید. بلیت کامل‌شده امتیازش را می‌دهد و بلیت ناقص همان‌قدر امتیاز کم می‌کند.'), btn('نگه داشتن ۲ بلیت', 'primary', 'check')),
        status: '<b>بازی شروع شد.</b> هر کس ۴ کارت قطار و ۳ بلیت دارد؛ هم‌زمان بلیت‌هایتان را انتخاب کنید.',
        log: [[1, 'بازی شروع شد'], [2, 'نیلوفر بلیت‌هایش را انتخاب کرد']],
      },
      {
        shotTitle: 'کشیدن کارت دوم', turnSub: 'لوکوموتیو رو مجاز نیست',
        table: table({ market: [4, 0, 4, 8, 7], mOff: [1], deck: 53 }),
        me: { above: above({ acts: (ph) => `<span class="tt-msg">${ic('info')}کارت دوم را بکشید؛ لوکوموتیو رو فقط به‌عنوان تنها کارت نوبت برداشته می‌شود.</span>` }) },
        status: `<b>کارت اول: آبی رو.</b> حالا یک کارت دیگر از بازار یا دسته بکشید. لوکوموتیو رو خاکستری است، و ساختن مسیر و کشیدن بلیت در این نوبت دیگر ممکن نیست.`,
        log: [[1, 'شما ۱ آبی رو برداشتید'], [1, 'یک کارت تازه رو شد: زرد']],
      },
      {
        shotTitle: 'کشیدن بلیت', turnSub: 'دست‌کم ۱ از ۳',
        table: table({ tdeck: 18 }),
        overlay: () => modal('بلیت تازه', pick([['11', true], ['00', false], ['20', false]], 1, 'دست‌کم یک بلیت را نگه دارید؛ بقیه زیر دستهٔ بلیت برمی‌گردند.'), `${btn('نگه داشتن ۱ بلیت', 'primary', 'check')}`),
        status: '<b>بلیت کشیدید.</b> سه بلیت تازه؛ دست‌کم یکی را نگه دارید.',
        log: [[1, 'شما ۳ بلیت کشیدید']],
      },
      {
        shotTitle: 'نوبت حریف و دور آخر', turnSub: 'رضا ۲ واگن دارد',
        opps: opps(6, { rw: 2, r: 71 }),
        table: table({ claim: { ...CLAIM, b: [...CLAIM.b, 70], g: [...CLAIM.g, 64] }, hi: [[64, 'is-new']] }),
        me: { turn: false, above: above({ acts: () => `<span class="tt-warn">${ic('clock')}دور آخر: رضا ${fa(2)} واگن دارد؛ هر نفر یک نوبت دیگر دارد</span>` }) },
        status: '<b>نوبت رضا است.</b> رضا مسیر نیواورلئان ← آتلانتا را ساخت و ۲ واگن برایش ماند، پس دور آخر شروع شد: شما و نیلوفر هر کدام یک نوبت دیگر دارید.',
        log: [[1, 'شما مسیر سنت‌لوئیس–پیتسبورگ را ساختید: ۱۰+'], [6, 'رضا مسیر نیواورلئان–آتلانتا را ساخت: ۷+'], [6, 'دور آخر']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'بلیت‌ها و بلندترین مسیر',
        opps: opps(0, { n: 88, r: 79, rw: 0 }),
        table: table({ claim: { ...CLAIM, b: [...CLAIM.b, 70, 57], g: [...CLAIM.g, 64] }, hi: [[31, 'is-ok'], [52, 'is-ok'], [70, 'is-ok']] }),
        me: { turn: false, clock: '', above: above({}), note: `<span class="cx-note">${fa(96)} امتیاز</span>` },
        overlay: () => modal('شما با ۹۶ امتیاز بردید', tbl(['بازیکن', 'مسیرها', 'بلیت کامل', 'بلیت ناقص', 'بلندترین', 'جمع'], [{ c: ['شما', fa(62), `${fa(24)}+`, '—', `${fa(10)}+`, fa(96)], win: true }, { c: ['نیلوفر', fa(58), `${fa(35)}+`, `${fa(-5)}`, '—', fa(88)] }, { c: ['رضا', fa(61), `${fa(26)}+`, `${fa(-8)}`, '—', fa(79)] }]) + `<p class="cx-note">${img('ttr-bonus', '')}بلندترین مسیر پیوسته: شما با ${fa(17)} واگن. تساوی: بیشترین بلیت کامل، بعد کارت بلندترین مسیر.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        status: '<b>بازی تمام شد.</b> بلیت‌ها رو شدند و مسیرهای کامل‌شده سبز شدند.',
        log: [[1, 'دنور–پیتسبورگ کامل: ۱۱+'], [2, 'یک بلیت نیلوفر ناقص ماند: ۵−'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:8px}
.tt-map{position:relative;inline-size:var(--bw);direction:ltr;flex:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 20px -12px rgba(0,0,0,.7)}
.tt-map>img:first-child{display:block;inline-size:100%;block-size:auto}
.tt-w{position:absolute;object-fit:fill;filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 2px 2px rgba(0,0,0,.7))}
.tt-w.is-ghost{opacity:.75;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px var(--felt-gold))}
.tt-band{position:absolute;border-radius:3px;box-shadow:0 0 0 1.5px #fff,0 2px 3px rgba(0,0,0,.5)}
.tt-hi{position:absolute;aspect-ratio:2.2;border-radius:3px;box-sizing:border-box}
.tt-hi.is-can{border:2px solid rgba(232,166,66,.95);background:rgba(232,166,66,.25);box-shadow:0 0 6px 1px rgba(232,166,66,.6)}
.tt-hi.is-pick{border:2px solid var(--felt-gold);box-shadow:0 0 0 2px rgba(232,166,66,.45),0 0 8px 2px rgba(232,166,66,.6)}
.tt-hi.is-new{box-shadow:0 0 0 2px #FAF5EC,0 0 8px 3px rgba(250,245,236,.7)}
.tt-hi.is-ok{box-shadow:0 0 0 2px #3BB273,0 0 8px 3px rgba(59,178,115,.75)}
.tt-win{position:relative;inline-size:370px;block-size:290px;overflow:hidden;border-radius:8px;flex:none}
.tt-pan{position:absolute;left:-372px;top:-170px}
.tt-zoom{position:absolute;inset-block-end:8px;inset-inline-start:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(8,20,28,.75);color:#FAF5EC;font-size:12px}.tt-zoom .bgv-icon{inline-size:14px;block-size:14px}
.tt-mkt{display:flex;align-items:center;gap:8px;direction:ltr}
.tt-c{position:relative;display:block}.tt-c img{display:block;inline-size:76px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 6px 10px -5px rgba(0,0,0,.6)}
.tt-c b{position:absolute;inset-block-start:-7px;inset-inline-end:-7px;min-inline-size:22px;block-size:22px;border-radius:11px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:12.5px;box-shadow:0 0 0 2px #FAF5EC}
.tt-c.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}.tt-c.is-off img{filter:grayscale(1) brightness(.6)}
.tt-deck{position:relative;display:block}.tt-deck img{display:block;block-size:49px;inline-size:auto;border-radius:4px;transform:rotate(90deg);margin-inline:12px}.tt-deck b,.tt-tdeck b{position:absolute;inset-block-end:-6px;inset-inline-end:-4px;min-inline-size:22px;block-size:20px;border-radius:10px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:12px}
.tt-tdeck{position:relative;display:grid;place-items:center;inline-size:62px;block-size:44px;border-radius:5px;background:#E9DCC0;color:#4A3519;font-size:12px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.tt-me{display:grid;gap:8px;justify-items:center;inline-size:100%;margin-block-start:6px}
.tt-sm{white-space:nowrap}.gc-seat__meta .gc-tag{white-space:nowrap}
.tt-acts{display:flex;justify-content:center}
.tt-pay{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:var(--radius-md);background:rgba(8,20,28,.35);color:var(--felt-ink)}.tt-pay>span:first-child{display:grid;font-size:13px}.tt-pay small{color:var(--felt-muted);font-size:12px}
.tt-paycards{display:flex;gap:8px;direction:ltr}.tt-paycards img{inline-size:58px}
.tt-row{display:flex;gap:14px;align-items:center}
.tt-hand{display:flex;gap:7px;direction:ltr}.tt-hand .tt-c img{inline-size:62px}
.tt-tix{display:grid;gap:4px}.tt-t{position:relative;display:block}.tt-t img{display:block;inline-size:150px;border-radius:4px}.tt-t.is-done img{opacity:.75}.tt-t b{position:absolute;inset-block-start:4px;inset-inline-start:4px;inline-size:20px;block-size:20px;border-radius:50%;display:grid;place-items:center;background:#3BB273;color:#fff}.tt-t b .bgv-icon{inline-size:13px;block-size:13px}
.tt-msg,.tt-warn{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(8,20,28,.35);color:var(--felt-ink);font-size:13.5px}.tt-warn{background:rgba(232,166,66,.2);color:#FFE2A8}
.tt-pts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.tt-pts span{display:grid;justify-items:center;padding:6px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:12.5px}.tt-pts small{font-size:15px;font-weight:800;color:var(--heading)}
.tt-pick{display:grid;gap:8px}.tt-pk{all:unset;cursor:pointer;position:relative;display:block;border-radius:6px}.tt-pk img{display:block;inline-size:100%;max-inline-size:320px;border-radius:6px}.tt-pk.is-on{box-shadow:0 0 0 3px #E8A642}.tt-pk:not(.is-on) img{opacity:.6}.tt-pk i{position:absolute;inset-block-start:8px;inset-inline-start:8px;inline-size:24px;block-size:24px;border-radius:50%;display:grid;place-items:center;background:#E8A642;color:#142B3B}.tt-pk:not(.is-on) i{background:rgba(0,0,0,.25)}
.gd-modal .cx-note img{inline-size:60px;vertical-align:middle;margin-inline-end:8px;border-radius:3px}
.cx-phone .gc-table{gap:6px}
.tt-me--ph .tt-hand .tt-c img{inline-size:42px}.tt-me--ph .tt-hand{gap:5px}.cx-phone .tt-mkt .tt-c img{inline-size:52px}.cx-phone .tt-deck img{block-size:36px}
.tt-me--ph .tt-pay{gap:6px;padding:5px 8px;flex-wrap:wrap;justify-content:center}.tt-me--ph .tt-paycards img{inline-size:42px}.tt-me--ph .tt-msg,.tt-me--ph .tt-warn{font-size:12.5px;margin-inline:10px}`,
    shotTitle: 'نوبت شما', turnSub: 'ساختن مسیر و پرداخت',
    diffs: [
      ['چیدمان', 'مثل BGA: نقشه وسط و زیرش بازار (دستهٔ کارت، ۵ کارت رو، دستهٔ بلیت با عدد). دست شما دسته‌دسته با عدد، و بلیت‌هایتان کنارش (بلیت کامل تیک سبز دارد)'],
      ['ساختن مسیر', 'مسیرهایی که با دستتان ساختنی‌اند خط‌چین طلایی دارند؛ مسیر انتخاب‌شده پررنگ و پیش‌نمایش واگن‌ها رویش. نوار پرداخت رنگ و تعداد لوکوموتیو و امتیاز را نشان می‌دهد'],
      ['کشیدن کارت', 'کارت دوم: لوکوموتیو رو خاکستری و بقیهٔ کارها غیرفعال (§۵)'],
      ['بلیت', 'شروع بازی دست‌کم ۲ از ۳ (§۴)، در بازی دست‌کم ۱ از ۳ (§۶)'],
      ['دور آخر و پایان', 'نوار هشدار دور آخر وقتی کسی ۲ واگن یا کمتر دارد (§۷)؛ جدول پایانی با بلیت‌ها و جایزهٔ بلندترین مسیر (§۸). گوشی بخشی از نقشه را بزرگ نشان می‌دهد با «کل نقشه»'],
      ['قوانین', 'مثل موتور: ۲ تا ۵ نفر، سه نقشه (آمریکا، اروپا، ایران)؛ امتیاز بلیت‌ها در موتور از کوتاه‌ترین مسیر ساخته می‌شود و با کارت چاپی فرق دارد (در RULES.md)'],
    ],
  };
}
