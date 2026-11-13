// 7 Wonders Duel on the group D frame (repo engine: 2 players, base game, no options). BGA art: military board (rotated to lie across the top),
// Age I buildings, wonders, progress tokens. Mock: Age I, 4 cards taken (you: Lumber Yard, Garrison; Niloufar: Stone Reserve, Quarry). You picked Workshop.
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const NAME = { 1: 'چوب‌بری', 2: 'معدن سنگ', 3: 'گودال رس', 5: 'سنگ‌تراشی', 7: 'شیشه‌گری', 9: 'اصطبل', 10: 'پادگان', 13: 'کتابت‌خانه', 14: 'کارگاه', 17: 'میخانه', 18: 'انبار سنگ', 21: 'تماشاخانه', 22: 'محراب' };
  const WN = { 5: 'آرامگاه', 1: 'اهرام', 2: 'غول رودس', 4: 'معبد آرتمیس', 6: 'کتابخانهٔ بزرگ', 7: 'پیرئوس', 9: 'مجسمهٔ زئوس', 11: 'جادهٔ آپیان', 12: 'سیرک ماکسیموس' };
  const PN = { 1: 'کشاورزی', 5: 'بنایی', 9: 'الهیات', 2: 'معماری', 3: 'اقتصاد', 4: 'قانون', 6: 'ریاضیات', 8: 'استراتژی' };
  // Age I pyramid: rows top→bottom 2,3,4,5,6; odd rows (2nd, 4th) face down. null = taken. 'B' = face down.
  const PYR = [[21, 13], ['B', 'B', 'B'], [9, 17, 7, 2], ['B', 'B', 'B', null, 'B'], [null, 14, 3, null, null, 22]];
  const free = (r, i, p) => r === p.length - 1 ? p[r][i] != null : p[r][i] != null && p[r + 1][i] == null && p[r + 1][i + 1] == null;
  const pyramid = (o, W) => {
    const p = o.pyr ?? PYR, cw = W, ch = Math.round(cw * 1.523), step = Math.round(ch * .46);
    const rows = p.length, wMax = 6 * (cw + 6);
    let h = `<div class="wd-pyr" style="width:${wMax}px;height:${ch + (rows - 1) * step}px" aria-label="کارت‌های عصر ${o.age ?? 'یک'}">`;
    p.forEach((row, r) => row.forEach((c, i) => {
      if (c == null) return;
      const x = (wMax - row.length * (cw + 6)) / 2 + i * (cw + 6), y = r * step;
      const ok = free(r, i, p) && c !== 'B';
      const cls = `wd-c${ok ? ' is-free' : ''}${o.sel === c ? ' is-sel' : ''}`;
      h += `<span class="${cls}" style="left:${x}px;top:${y}px;width:${cw}px">${c === 'B' ? img(o.back ?? 'wd-back1', 'کارت رو به پایین') : img('wd-b' + c, NAME[c])}</span>`;
    }));
    return h + '</div>';
  };
  // military board 1300×367 (rotated); track center x=650, step 63.4 px per space; track y≈190
  const TRACK = (k) => (650 + k * 63.4) / 1300 * 100;
  const board = (o, w) => `<div class="wd-board" style="--bw:${w}px">${img('wd-board', 'نوار نظامی و نشان‌های پیشرفت')}${(o.prog ?? [2, 3, 4, 6, 8]).map((t, i) => t ? `<img class="wd-prog${o.progSel === t ? ' is-sel' : ''}" style="left:${[29.5, 40.5, 51.3, 62, 72.8][i]}%" src="${H.ART['wd-p' + t]}" alt="${PN[t]}">` : '').join('')}${(o.pens ?? [[-1, 5], [-2, 2], [1, 2], [2, 5]]).map(([s, v]) => `<img class="wd-pen" style="left:${{ '-2': 16.2, '-1': 30.4, 1: 69.6, 2: 83.8 }[s]}%" src="${H.ART['wd-pen' + v]}" alt="جریمهٔ ${fa(v)} سکه">`).join('')}<img class="wd-pawn" style="left:${TRACK(o.pawn ?? 1)}%" src="${H.ART['wd-pawn']}" alt="مهرهٔ نظامی"></div>`;
  const COLS = [['brown', '#8a4b22'], ['grey', '#8b8f96'], ['yellow', '#d9a52a'], ['red', '#c0392b'], ['blue', '#2f6fd0'], ['green', '#3d9a4a']];
  const city = (who, cards, coins, sh) => `<div class="wd-city" aria-label="شهر ${who}"><b>${who}</b><span class="wd-coins">${img('wd-coin', 'سکه')}${fa(coins)}</span><div class="wd-stacks">${cards.map((c) => `<span class="wd-mini">${img('wd-b' + c, NAME[c])}</span>`).join('')}</div>${sh ? `<small>${sh}</small>` : ''}</div>`;
  const ME_C = [1, 10], NIL_C = [18, 5];
  const table = (o) => (ph) => `${board(o, ph ? 366 : 640)}<div class="wd-mid">${ph ? '' : city('نیلوفر', o.nilC ?? NIL_C, o.nilCoins ?? 4, 'سنگ ۱ تولیدی')}${pyramid(o, ph ? 40 : 54)}${ph ? '' : city('شما', o.meC ?? ME_C, o.meCoins ?? 5, 'چوب ۱ تولیدی')}</div>`;
  const wonders = (list, ph) => `<div class="wd-wonders">${list.map(([w, built, sel]) => `<span class="wd-w${built ? ' is-built' : ''}${sel ? ' is-sel' : ''}">${img('wd-w' + w, WN[w])}${built ? `<b>${ic('check')}</b>` : ''}</span>`).join('')}</div>`;
  const MYW = [[1, false], [6, false], [5, false], [9, false]];
  const above = (o) => (ph) => `<div class="wd-me${ph ? ' wd-me--ph' : ''}">${o.acts ? `<div class="wd-acts">${o.acts(ph)}</div>` : ''}${o.noW ? '' : wonders(o.w ?? MYW, ph)}</div>`;
  const opps = (turn, o = {}) => [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '2:40', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${img('wd-coin', '')}${fa(o.coins ?? 4)}</span><span class="wd-sm">عجایب ${fa(o.w ?? 0)} از ${fa(4)}</span><span class="wd-sm">علم ${fa(o.sci ?? 0)}</span>` }];
  const rail = `<section class="cx-card"><h3>عصر ${fa(1)}</h3><div class="gc-pills"><span class="bgv-chip">کارت ${fa(16)} از ${fa(20)}</span><span class="bgv-chip">عجایب: ${fa(0)} از ${fa(7)}</span></div><div class="ga-rule">${ic('info')}<span>کارتی را برمی‌دارید که هیچ کارتی رویش نیست. سه راه دارد: ساختن (منبع یا سکه)، فروختن (${fa(2)} سکه + هر کارت زرد شما ${fa(1)} سکه)، یا ساختن یکی از عجایب. منبعی که ندارید را از بانک می‌خرید: ${fa(2)} سکه + تولید همان منبع در شهر حریف.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const choose = (ph) => `<div class="wd-choose"><span class="wd-cost"><small>کارگاه</small><b>${ph ? '' : 'هزینه: '}${fa(1)} پاپیروس ← ${fa(2)} سکه</b></span>${btn(ph ? 'ساختن' : `ساختن (${fa(2)} سکه)`, 'primary', 'check')}${btn(ph ? 'فروش' : `فروش (${fa(2)}+ سکه)`, 'secondary', 'download')}${btn(ph ? 'عجایب' : 'ساختن عجایب', 'secondary', 'trophy')}</div>`;
  const PYR2 = [[21, 13], ['B', 'B', 'B'], [9, 17, 7, 2], ['B', 'B', 'B', null, 'B'], [null, null, 3, null, null, 22]];
  return {
    slug: 'WondersDuel', fa: 'عجایب هفت‌گانه: دوئل', latin: '7 Wonders Duel', meta: ['زنده', '۲ نفر', 'عصر ۱'],
    opps: opps(1),
    me: { cards: [], clock: '2:55', turn: true, note: `<span class="cx-note">${fa(5)} سکه<span class="bgv-sep"></span>علم ${fa(0)}</span>`, above: above({ acts: choose }) },
    table: table({ sel: 14 }),
    status: `<b>نوبت شماست.</b> کارگاه را برداشتید (کارت سبز با نماد علم و ${fa(1)} امتیاز). پاپیروس ندارید، پس ${fa(2)} سکه به بانک می‌دهید؛ یا کارت را بفروشید (${fa(2)} سکه) یا زیر یکی از عجایبتان بگذارید.`,
    pstatus: `<b>کارگاه.</b> ساختن با ${fa(2)} سکه، فروش، یا عجایب.`,
    railCard: rail, logNote: `عصر ${fa(1)}`,
    log: [[1, 'شما چوب‌بری ساختید'], [2, 'نیلوفر انبار سنگ ساخت'], [1, 'شما پادگان ساختید: مهره ۱ خانه جلو رفت'], [2, 'نیلوفر سنگ‌تراشی ساخت']],
    dockItems: [['list', 'رویدادها'], ['trophy', 'عجایب'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'انتخاب عجایب', turnSub: 'پیش از عصر ۱: ۱، ۲، ۱ از چهار کارت',
        table: (ph) => `${board({ pawn: 0 }, ph ? 366 : 640)}<div class="wd-draft">${[[1, true], [2, false], [6, false], [9, false]].map(([w, s]) => `<button type="button" class="wd-w wd-pick${s ? ' is-sel' : ''}">${img('wd-w' + w, WN[w])}<small>${WN[w]}</small></button>`).join('')}</div>`,
        me: { above: above({ w: [], noW: true, acts: (ph) => btn('برداشتن اهرام', 'primary', 'check') }), note: `<span class="cx-note">${fa(7)} سکه</span>` },
        opps: opps(0, { coins: 7 }),
        status: '<b>انتخاب عجایب.</b> از این چهار کارت شما یکی برمی‌دارید، نیلوفر دو تا، و آخری مال شماست. دور دوم برعکس است. هر نفر ۴ عجایب دارد.',
        log: [[1, 'بازی شروع شد: هر نفر ۷ سکه'], [1, 'نوبت شما برای انتخاب عجایب']],
      },
      {
        shotTitle: 'نماد علم دوتایی', turnSub: 'برداشتن نشان پیشرفت',
        table: table({ pyr: PYR2, meC: [1, 10, 14, 13], meCoins: 3, progSel: 6 }),
        me: { above: above({}), note: `<span class="cx-note">${fa(3)} سکه<span class="bgv-sep"></span>علم ${fa(2)}</span>` },
        overlay: () => modal('یک نشان پیشرفت بردارید', `<p>دو نماد علم یکسان (قلم) دارید، پس یکی از نشان‌های پیشرفت روی صفحه مال شماست.</p><div class="wd-progs">${[2, 3, 4, 6, 8].map((t) => `<button type="button" class="wd-pt${t === 6 ? ' is-sel' : ''}">${img('wd-p' + t, PN[t])}<small>${PN[t]}</small></button>`).join('')}</div>`, btn('برداشتن ریاضیات', 'primary', 'check')),
        status: '<b>نماد علم جفت شد.</b> یک نشان پیشرفت بردارید. اگر ۶ نماد علم متفاوت جمع کنید، همان لحظه می‌برید.',
        log: [[1, 'شما کتابت‌خانه ساختید'], [1, 'جفت نماد قلم: نشان پیشرفت']],
      },
      {
        shotTitle: 'ساختن عجایب', turnSub: 'کارت زیر عجایب می‌رود',
        table: table({ sel: 3 }),
        me: { above: above({ w: [[1, false, true], [6, false], [5, false], [9, false]], acts: (ph) => `<span class="wd-cost"><small>اهرام</small><b>${fa(3)} سنگ و ${fa(1)} پاپیروس ← ${fa(9)} سکه کم دارید</b></span>${btn('ساختن اهرام', 'primary', 'check')}` }) },
        status: `<b>ساختن عجایب.</b> گودال رس را برداشتید تا زیر اهرام بگذارید. اهرام ${fa(3)} سنگ و ${fa(1)} پاپیروس می‌خواهد؛ هر منبعی که ندارید از بانک خریده می‌شود و هزینهٔ کل کنار دکمه است. اگر سکه کم باشد دکمه غیرفعال است.`,
        log: [[1, 'شما گودال رس را برداشتید']],
      },
      {
        shotTitle: 'کتابخانهٔ بزرگ', turnSub: 'یک نشان از سه نشان بیرون بازی',
        table: table({}),
        me: { above: above({ w: [[1, false], [6, true], [5, false], [9, false]] }) },
        overlay: () => modal('کتابخانهٔ بزرگ: یک نشان بردارید', `<p>سه نشان پیشرفت از میان نشان‌هایی که بیرون بازی مانده‌اند به‌تصادف رو شد. یکی را برمی‌دارید و دو تای دیگر به جعبه برمی‌گردند.</p><div class="wd-progs">${[1, 5, 9].map((t) => `<button type="button" class="wd-pt${t === 9 ? ' is-sel' : ''}">${img('wd-p' + t, PN[t])}<small>${PN[t]}</small></button>`).join('')}</div>`, btn('برداشتن الهیات', 'primary', 'check')),
        status: '<b>کتابخانهٔ بزرگ را ساختید.</b> از سه نشان پیشرفتی که بیرون بازی بودند یکی را انتخاب کنید.',
        log: [[1, 'شما کتابخانهٔ بزرگ را ساختید']],
      },
      {
        shotTitle: 'آرامگاه', turnSub: 'ساختن رایگان از دورریخته‌ها',
        table: table({}),
        me: { above: above({ w: [[1, false], [6, true], [5, true], [9, false]] }) },
        overlay: () => modal('آرامگاه: یک کارت دورریخته را رایگان بسازید', `<p>همهٔ کارت‌هایی که از اول بازی فروخته یا دور ریخته شده‌اند رو هستند. یکی را بدون پرداخت هزینه در شهرتان بسازید.</p><div class="wd-disc">${[2, 9, 17, 22].map((c) => `<button type="button" class="wd-dc${c === 22 ? ' is-sel' : ''}">${img('wd-b' + c, NAME[c])}<small>${NAME[c]}</small></button>`).join('')}</div>`, btn('ساختن محراب', 'primary', 'check')),
        status: '<b>آرامگاه را ساختید.</b> از دورریخته‌ها یک کارت انتخاب کنید تا رایگان ساخته شود.',
        log: [[1, 'شما آرامگاه را ساختید']],
      },
      {
        shotTitle: 'مجسمهٔ زئوس', turnSub: 'نابودی یک کارت قهوه‌ای حریف',
        table: table({}),
        me: { above: above({ w: [[1, false], [6, true], [5, true], [9, true]] }) },
        overlay: () => modal('مجسمهٔ زئوس: یک کارت قهوه‌ای نیلوفر را نابود کنید', `<p>یکی از کارت‌های قهوه‌ای (مواد خام) شهر نیلوفر به دورریخته‌ها می‌رود. کارت‌های رنگ دیگر انتخاب‌شدنی نیستند.</p><div class="wd-disc">${[[5, true], [18, false]].map(([c, ok]) => `<button type="button" class="wd-dc${ok ? ' is-sel' : ' is-off'}"${ok ? '' : ' disabled'}>${img('wd-b' + c, NAME[c])}<small>${NAME[c]}${ok ? '' : ' (زرد)'}</small></button>`).join('')}</div>`, btn('نابود کردن سنگ‌تراشی', 'primary', 'check')),
        status: '<b>مجسمهٔ زئوس را ساختید.</b> یک کارت قهوه‌ای از شهر نیلوفر را برای نابودی انتخاب کنید. سیرک ماکسیموس همین کار را با کارت خاکستری می‌کند.',
        log: [[1, 'شما مجسمهٔ زئوس را ساختید']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر نیلوفر',
        opps: opps(2),
        table: table({ pyr: PYR2, meC: [1, 10, 14], meCoins: 3 }),
        me: { turn: false, above: above({}), note: `<span class="cx-note">${fa(3)} سکه<span class="bgv-sep"></span>علم ${fa(1)}</span>` },
        status: '<b>نوبت نیلوفر است.</b> کارت‌هایی که آزاد می‌شوند همان لحظه رو می‌شوند. وقتی مهرهٔ نظامی به خانهٔ جریمه برسد، صاحب آن طرف سکه از دست می‌دهد.',
        log: [[1, 'شما کارگاه ساختید'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'پایان عصر', turnSub: 'چه کسی عصر بعد را شروع می‌کند',
        table: (ph) => `${board({ pawn: 2, pens: [[-1, 5], [-2, 2], [2, 5]] }, ph ? 366 : 640)}<div class="wd-mid">${pyramid({ pyr: [[null, null], [null, null, null], [null, null, null, null], [null, null, null, null, null], ['B', 'B', 'B', 'B', 'B', 'B']], back: 'wd-back2', age: 'دو' }, 54)}</div>`,
        me: { above: above({}), note: `<span class="cx-note">${fa(6)} سکه</span>` },
        overlay: () => modal('عصر ۱ تمام شد', `<p>مهرهٔ نظامی سمت نیلوفر است (او ضعیف‌تر است)، پس نیلوفر تصمیم می‌گیرد چه کسی عصر ۲ را شروع کند. کارت‌های عصر ۲ چیده شدند.</p>`, btn('منتظر نیلوفر', 'secondary', 'clock')),
        status: '<b>عصر ۱ تمام شد.</b> عصر ۲ با شکل وارونهٔ هرم چیده شد.',
        log: [[2, 'آخرین کارت عصر ۱ را نیلوفر برداشت'], [1, 'عصر ۲ آماده شد']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیاز غیرنظامی',
        opps: opps(0, { coins: 9, w: 3, sci: 3 }), table: table({ pyr: [[null, null]], pawn: 3 }),
        me: { turn: false, clock: '', above: above({ w: [[1, true], [6, true], [5, true], [9, false]] }), note: `<span class="cx-note">${fa(71)} امتیاز</span>` },
        overlay: () => modal('شما با ۷۱ امتیاز بردید', tbl(['', 'آبی', 'سبز', 'زرد', 'صنف', 'عجایب', 'پیشرفت', 'سکه', 'نظامی', 'جمع'], [{ c: ['شما', fa(21), fa(9), fa(5), fa(6), fa(15), fa(6), fa(3), fa(6), fa(71)], win: true }, { c: ['نیلوفر', fa(18), fa(4), fa(8), fa(7), fa(12), fa(3), fa(3), fa(0), fa(55)] }]) + '<p class="cx-note">سه راه برد: برتری نظامی (مهره به پایتخت حریف برسد)، برتری علمی (۶ نماد متفاوت)، یا امتیاز بیشتر بعد از عصر ۳. تساوی: امتیاز کارت‌های آبی.</p>', `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        status: '<b>بازی تمام شد.</b> عصر ۳ تمام شد و امتیازها شمرده شد.',
        log: [[1, 'عصر ۳ تمام شد'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.wd-board{position:relative;inline-size:var(--bw);flex:none}
.wd-board>img:first-child{display:block;inline-size:100%;block-size:auto;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.wd-prog{position:absolute;top:3.8%;inline-size:7.8%;transform:translateX(-50%);border-radius:50%;clip-path:circle(46%)}
.wd-prog.is-sel{filter:drop-shadow(0 0 4px var(--felt-gold))}
.wd-pen{position:absolute;top:73%;block-size:20%;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center}
.wd-pawn{position:absolute;top:51%;inline-size:9.5%;transform:translate(-50%,-50%);filter:drop-shadow(0 3px 3px rgba(0,0,0,.6))}
.wd-mid{display:flex;align-items:flex-start;gap:16px}
.wd-pyr{position:relative;flex:none}
.wd-c{position:absolute;display:block}.wd-c img{display:block;inline-size:100%;block-size:auto;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.35),0 6px 10px -6px rgba(0,0,0,.6)}
.wd-c:not(.is-free) img{filter:brightness(.82)}
.wd-c.is-free img{box-shadow:0 0 0 2px rgba(232,166,66,.75),0 6px 10px -6px rgba(0,0,0,.6)}
.wd-c.is-sel{transform:translateY(-8px);z-index:3}.wd-c.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.wd-city{display:grid;gap:6px;inline-size:124px;padding:8px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);color:var(--felt-ink);font-size:13px}
.wd-city small{color:var(--felt-muted);font-size:11.5px}
.wd-coins{display:inline-flex;align-items:center;gap:4px;font-weight:800}.wd-coins img,.gc-tag img{inline-size:18px;block-size:18px}
.wd-stacks{display:flex;flex-wrap:wrap;gap:4px}.wd-mini img{display:block;inline-size:36px;border-radius:3px}
.wd-me{display:grid;gap:8px;justify-items:center}
.wd-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.wd-choose{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.wd-cost{display:grid;color:var(--felt-ink);font-size:13px;padding-inline:6px}.wd-cost small{color:var(--felt-muted);font-size:12px}
.wd-wonders{display:flex;gap:8px}
.wd-w{position:relative;display:block}.wd-w img{display:block;inline-size:118px;border-radius:5px;box-shadow:0 4px 8px -4px rgba(0,0,0,.6)}
.wd-w:not(.is-built) img{filter:saturate(.75) brightness(.9)}.wd-w.is-sel img{filter:none;box-shadow:0 0 0 3px var(--felt-gold)}
.wd-w b{position:absolute;inset-block-start:4px;inset-inline-start:4px;inline-size:22px;block-size:22px;border-radius:50%;display:grid;place-items:center;background:#3BB273;color:#fff}.wd-w b .bgv-icon{inline-size:14px;block-size:14px}
.wd-draft{display:flex;gap:12px}.wd-pick{all:unset;cursor:pointer;display:grid;justify-items:center;gap:6px;color:var(--felt-ink);font-size:13px}.wd-pick img{inline-size:150px;filter:none!important}.wd-pick.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}
.wd-disc{display:flex;gap:10px;justify-content:center}.wd-dc{all:unset;cursor:pointer;display:grid;justify-items:center;gap:4px;font-size:12px}.wd-dc img{inline-size:72px;border-radius:4px}.wd-dc.is-sel img{box-shadow:0 0 0 3px #E8A642}.wd-dc.is-off{cursor:default}.wd-dc.is-off img{filter:grayscale(1) brightness(.75)}
.wd-progs{display:flex;gap:8px;justify-content:center}.wd-pt{all:unset;cursor:pointer;display:grid;justify-items:center;gap:4px;font-size:12px}.wd-pt img{inline-size:64px;border-radius:50%;clip-path:circle(46%)}.wd-pt.is-sel img{box-shadow:0 0 0 3px #E8A642;clip-path:none}
.wd-sm{white-space:nowrap}.gc-seat__meta .gc-tag{white-space:nowrap}
.cx-phone .gc-table{gap:6px}.wd-me--ph .wd-w img{inline-size:80px}.wd-me--ph .wd-wonders{gap:5px}.wd-me--ph .wd-choose{gap:5px}.wd-me--ph .wd-cost{display:none}.cx-phone .wd-draft{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cx-phone .wd-pick img{inline-size:150px}`,
    shotTitle: 'نوبت شما', turnSub: 'ساختن، فروش یا عجایب',
    diffs: [
      ['چیدمان', 'مثل BGA: نوار نظامی بالای میز (افقی؛ نشان‌های پیشرفت و جریمه‌ها رویش)، هرم کارت‌های عصر وسط، و شهر هر نفر دو طرف هرم با سکه و منبع تولیدی. عجایب شما پایین'],
      ['کارت آزاد', 'فقط کارتی که هیچ کارتی رویش نیست برداشتنی است و قاب طلایی دارد؛ کارت انتخاب‌شده بالا می‌آید و سه دکمه با هزینهٔ دقیق (شامل خرید منبع از بانک) ظاهر می‌شود'],
      ['عجایب و پیشرفت', 'انتخاب ۴ عجایب پیش از بازی (§۴)، نشان پیشرفت با جفت نماد علم (§۵)، ساختن عجایب با کارت زیرش (§۶)، و پنجرهٔ عجایب ویژه: کتابخانهٔ بزرگ، آرامگاه، مجسمهٔ زئوس (§۷ تا §۹)'],
      ['عصرها', 'پایان هر عصر: نفر ضعیف‌تر از نظر نظامی شروع‌کنندهٔ عصر بعد را انتخاب می‌کند (§۱۱)'],
      ['پایان', 'جدول هشت‌ستونه امتیاز و سه راه برد (§۱۲)'],
      ['قوانین', 'مثل موتور: دونفره، بازی پایه بدون افزونه؛ نام فارسی کارت‌ها فقط برای این طرح است و روی کارت‌ها همان متن چاپی BGA است'],
    ],
  };
}
