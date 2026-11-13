// Scout on the card-table frame (repo engine: 2–5 players; 4p drops the 9/10 card → 11 cards each; one round per player).
// Moment: round 2. Reza's show is the run 4-5-6; your hand has 7-7-7 side by side — a set of three beats a run of three.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  // Score chips as the printed Oink tokens (value by shape: 1 diamond, 2 five-point, 5 six-point, 10 eight-point, 20 many-point).
  const scoreChips = (n) => { const out = []; for (const v of [20, 10, 5, 2, 1]) while (n >= v) { out.push(v); n -= v; } return out.map((v) => img(`scout-score-${v}`, `${fa(v)} امتیاز`)).join(''); };
  const k = (a, b, u) => `scout-${a}-${b}-up${u}`;
  const c = (a, b, u, cls = '') => img(k(a, b, u), `${fa(u)} (پشتش ${fa(u === a ? b : a)})`, cls);
  const handSpec = [[3, 6, 3], [2, 8, 8], [1, 7, 7], [4, 7, 7], [7, 10, 7], [2, 5, 2], [3, 10, 10], [5, 9, 5], [1, 4, 1]];
  const hand = handSpec.map(([a, b, u], i) => ({ art: k(a, b, u), alt: `${fa(u)} (پشتش ${fa(u === a ? b : a)})`, sel: i >= 2 && i <= 4 }));
  const chip = (n) => `<span class="sc-chip" aria-label="${fa(n)} ژتون دیدبانی">${img('scout-chip', '')}${fa(n)}</span>`;
  const opp = (cards, chips, won) => `${backs('scout-back', cards, 4)}${chip(chips)}<span class="sc-n">برده ${fa(won)}</span>`;
  const end = (inner, label) => `<span class="sc-end">${inner}<em>${label}</em></span>`;
  const table = (ph) => `<div class="sc-board"><div class="sc-owner"><span class="bgv-avatar bgv-avatar--sm seat-6">ر</span><span><b>نمایش رضا</b>: ردیف سه‌تایی</span></div>
<div class="sc-show" aria-label="نمایش وسط میز: ۴، ۵، ۶">${end(c(4, 8, 4), 'دیدبانی')}${c(3, 5, 5)}${end(c(1, 6, 6), 'دیدبانی')}</div>
<p class="sc-hint">${ph ? 'دسته از ردیف هم‌اندازه قوی‌تر است' : 'نمایش با کارت بیشتر قوی‌تر است؛ با تعداد برابر، دسته از ردیف قوی‌تر است'}</p></div>`;
  const act = (l, sub, sel, off) => `<button type="button" class="sc-act${sel ? ' is-sel' : ''}"${off ? ' disabled' : ''}><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  const above = (ph) => `<div class="sc-above${ph ? ' sc-above--ph' : ''}"><div class="sc-acts" role="group" aria-label="کار این نوبت">${act('نمایش', ph ? '' : 'کارت‌های کنار هم', true)}${act('دیدبانی', ph ? '' : 'یک کارت از دو سر')}${act(ph ? 'دیدبانی و نمایش' : 'دیدبانی و نمایش', ph ? '' : 'یک بار در هر دست')}</div><div class="sc-go"><span>${ph ? '' : 'دستهٔ '}<b>${fa(7)} ${fa(7)} ${fa(7)}</b></span>${btn(ph ? 'نمایش' : 'نمایش بده', 'primary', 'check')}</div></div>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const scoutTable = (ph) => `<div class="sc-board"><div class="sc-owner"><span class="bgv-avatar bgv-avatar--sm seat-6">ر</span><span><b>نمایش رضا</b>: حالا ${fa(4)}، ${fa(5)}</span></div>
<div class="sc-show" aria-label="نمایش وسط میز: ۴، ۵">${end(c(4, 8, 4), 'دیدبانی')}${end(c(3, 5, 5), 'سر تازه')}<span class="sc-took">${c(1, 6, 6)}<em>برداشتید</em></span></div>
<p class="sc-hint">${ph ? 'رضا یک ژتون گرفت' : 'رضا صاحب نمایش است و یک ژتون دیدبانی گرفت'}</p></div>`;
  const gap = { html: `<span class="sc-gap">${c(1, 6, 1)}<em>اینجا</em></span>`, alt: 'جای کارت تازه' };
  const scoutHand = [hand[0], hand[1], gap, ...hand.slice(2)].map((h) => (h === gap ? h : { ...h, sel: false }));
  const scoutBar = (ph) => `<div class="sc-above${ph ? ' sc-above--ph' : ''}"><div class="sc-acts" role="group">${act('نمایش')}${act('دیدبانی', ph ? '' : 'یک کارت از دو سر', true)}${act('دیدبانی و نمایش')}</div><div class="sc-go"><span class="sc-or" role="group" aria-label="جهت کارت">${ph ? '' : 'جهت:'}<button type="button" class="sc-o">${c(1, 6, 6)}</button><button type="button" class="sc-o is-sel">${c(1, 6, 1)}</button></span><span>${ph ? '' : 'جای کارت را در دست بزنید'}</span>${btn(ph ? 'بگذار' : 'گذاشتن در دست', 'primary', 'check')}</div></div>`;
  const flip = (ph) => modal('دست ۳: جهت دستتان را انتخاب کنید', `<p>پیش از شروع دست، کل دستتان را می‌توانید یک بار وارونه کنید؛ بعد از آن ترتیب و جهت کارت‌ها ثابت می‌ماند.</p><div class="sc-flip"><button type="button" class="sc-fo is-sel"><b>همین‌طور</b><span dir="ltr">${[3, 8, 7, 7, 7, 2, 10, 5, 1].map((n) => `<i>${fa(n)}</i>`).join('')}</span></button><button type="button" class="sc-fo"><b>وارونه</b><span dir="ltr">${[4, 9, 3, 5, 10, 4, 1, 2, 6].map((n) => `<i>${fa(n)}</i>`).join('')}</span></button></div><p class="cx-note">ردیف دوم همان کارت‌هاست با عدد پشتشان و به ترتیب برعکس.</p>`, `${btn('شروع دست', 'primary', 'check')}`);
  const roundEnd = (ph) => modal('پایان دست ۲', `<p>سارا کارت‌های دستش تمام شد. امتیاز هر نفر: کارت‌های برده + ژتون‌های دیدبانی − کارت‌های مانده در دست.</p>
${tbl(['بازیکن', 'برده', 'ژتون', 'دست', 'این دست', 'جمع'], [
      { c: ['سارا', fa(7), fa(2), fa(0), `${fa(9)}+`, fa(12)], win: true },
      { c: ['شما', fa(8), fa(1), `${fa(2)}−`, `${fa(7)}+`, fa(13)] },
      { c: ['رضا', fa(6), fa(3), `${fa(0)} (معاف)`, `${fa(9)}+`, fa(18)] },
      { c: ['نیلوفر', fa(3), fa(1), `${fa(5)}−`, `${fa(1)}−`, fa(3)] },
    ])}<p class="cx-note">رضا صاحب آخرین نمایش بود، پس کارت‌های مانده در دستش منفی ندارد.</p>`, `${btn('دست بعد', 'primary', 'next')}`);
  const gameEnd = (ph) => modal('پایان بازی', `<p>هر نفر یک بار دست‌دهنده بود و ${fa(4)} دست تمام شد.</p>${tbl(['رتبه', 'بازیکن', 'دست ۱', 'دست ۲', 'دست ۳', 'دست ۴', 'جمع'], [{ c: [fa(1), 'رضا', fa(9), fa(9), fa(5), fa(8), fa(31)], win: true }, { c: [fa(2), 'شما', fa(6), fa(7), fa(10), fa(4), fa(27)] }, { c: [fa(3), 'سارا', fa(3), fa(9), fa(2), fa(6), fa(20)] }, { c: [fa(4), 'نیلوفر', fa(4), `${fa(1)}−`, fa(7), fa(3), fa(13)] }])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Scout', fa: 'اسکات', latin: 'Scout', meta: ['زنده', '۴ نفر', 'دست ۲ از ۴'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: opp(8, 1, 3) },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', meta: `${opp(7, 0, 4)}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: opp(11, 2, 0) },
    ],
    me: { cards: hand, clock: '0:35', turn: true, note: `<span class="cx-note">${fa(9)} کارت، برده ${fa(2)}</span>`, above },
    cardW: 72, phoneCardW: 40, cardRatio: 1.444,
    table,
    status: `<b>نوبت شماست.</b> نمایش وسط ردیف ${fa(4)}، ${fa(5)}، ${fa(6)} است. سه ${fa(7)} کنار هم دارید؛ دستهٔ سه‌تایی از ردیف سه‌تایی قوی‌تر است.`,
    pstatus: `<b>نوبت شما.</b> با سه ${fa(7)} نمایش رضا را ببرید.`,
    railCard: `<section class="cx-card"><h3>دست شما</h3><div class="gc-pills"><span class="bgv-chip">برده: ${fa(2)}</span><span class="bgv-chip">ژتون: ${fa(1)}</span><span class="bgv-chip">دیدبانی و نمایش: هنوز دارید</span></div><div class="ga-rule">${ic('info')}<span>ترتیب کارت‌های دست عوض نمی‌شود؛ فقط کارتی که دیدبانی می‌کنید را هر جا بخواهید می‌گذارید (و می‌توانید وارونه‌اش کنید). هر کارتی که آخر دست در دستتان بماند ${fa(1)} امتیاز منفی است.</span></div></section><section class="cx-card"><h3>امتیاز بعد از دست ${fa(1)}</h3><ul class="sc-scores">${[['شما', 1, 6], ['نیلوفر', 2, 4], ['رضا', 6, 9], ['سارا', 4, 3]].map(([nm, s, v]) => `<li><i style="background:var(--seat-${s})"></i><span>${nm}</span><span class="sc-chips">${scoreChips(v)}</span><b>${fa(v)}</b></li>`).join('')}</ul><p class="sc-legend">${[1, 2, 5, 10, 20].map((v) => `<span>${img(`scout-score-${v}`, '')}${fa(v)}</span>`).join('')}</p></section>`,
    logNote: `دست ${fa(2)}`,
    log: [[2, 'نیلوفر ۳ ۳ را نمایش داد'], [4, 'سارا ۳ را دیدبانی کرد؛ نیلوفر یک ژتون گرفت'], [6, 'رضا با ۴ ۵ ۶ نمایش نیلوفر را برد'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قدرت نمایش‌ها', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['list', 'قوانین'], ['chat', 'گفت‌وگو'], ['flag', 'ترک میز']],
    phases: [
      {
        shotTitle: 'دیدبانی', turnSub: 'کارت سر نمایش، جهت و جای آن در دست', table: scoutTable, phone: true,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: opp(8, 1, 3) },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', meta: opp(7, 1, 4) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: opp(11, 2, 0) },
        ],
        me: { cards: scoutHand, above: scoutBar }, phoneCardW: 34,
        status: '<b>دیدبانی.</b> ۶ را از سر نمایش رضا برداشتید. می‌توانید وارونه‌اش کنید (۱) و هر جای دستتان بگذارید؛ جای خط‌چین نشان می‌دهد کجا می‌نشیند.',
        pstatus: '<b>دیدبانی.</b> جهت و جای کارت.',
        log: [[6, 'رضا با ۴ ۵ ۶ نمایش نیلوفر را برد'], [1, 'شما ۶ را از نمایش رضا برداشتید'], [6, 'رضا یک ژتون دیدبانی گرفت']],
      },
      {
        shotTitle: 'جهت دست', turnSub: 'شروع هر دست: همین‌طور یا وارونه', overlay: flip, meta: ['زنده', '۴ نفر', 'دست ۳ از ۴'],
        table: (ph) => `<div class="sc-board"><p class="sc-hint">نمایش خالی است؛ دست‌دهنده: نیلوفر</p></div>`,
        me: { cards: hand.map((h) => ({ ...h, sel: false })), above: () => '' },
        status: '<b>دست ۳ شروع شد.</b> پیش از اولین نوبت جهت دستتان را انتخاب کنید.',
        log: [[2, 'دست ۳: نیلوفر کارت‌ها را پخش کرد'], [1, 'جهت دستتان را انتخاب کنید']],
      },
      {
        shotTitle: 'پایان دست', turnSub: 'برده + ژتون − دست؛ معافیت صاحب نمایش', overlay: roundEnd,
        table: (ph) => `<div class="sc-board"><div class="sc-owner"><span class="bgv-avatar bgv-avatar--sm seat-6">ر</span><span><b>آخرین نمایش: رضا</b></span></div></div>`,
        me: { turn: false, cards: hand.slice(0, 2).map((h) => ({ ...h, sel: false })), above: () => '' },
        status: '<b>دست ۲ تمام شد.</b> سارا دستش را خالی کرد.',
        log: [[4, 'سارا آخرین کارتش را نمایش داد'], [1, 'شما ۷ امتیاز گرفتید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جمع ۴ دست', overlay: gameEnd, meta: ['تمام شد', '۴ نفر', 'دست ۴ از ۴'],
        table: (ph) => `<div class="sc-board"></div>`,
        me: { turn: false, clock: '', cards: [], above: () => '' }, railCard: '',
        status: '<b>بازی تمام شد.</b> رضا با ۳۱ امتیاز برد؛ شما دوم شدید.',
        log: [[1, 'دست ۴ تمام شد'], [6, 'رضا برد']],
      },
    ],    css: `.gc-hand .gc-card{margin-inline-start:5px}.gc-hand .gc-card:first-child{margin-inline-start:0}
.cx-phone .gc-hand .gc-card{margin-inline-start:2px}
.gc-hand .gc-card img{border-radius:4px}
.sc-n{white-space:nowrap}
.sc-chip{display:inline-flex;align-items:center;gap:3px;color:var(--felt-ink);font-weight:700;white-space:nowrap}.sc-chip img{inline-size:28px;block-size:auto;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}
.gc-seat__meta .gc-backs img{inline-size:16px}
.cx-phone .gc-seat__meta .gc-backs img:nth-child(n+2){display:none}.cx-phone .sc-chip img{inline-size:22px}.cx-phone .gc-seat__meta{gap:4px}
.sc-scores{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.sc-scores li{display:grid;grid-template-columns:10px 1fr auto 28px;align-items:center;gap:8px;font-size:13px;line-height:22px;color:var(--text)}
.sc-scores li>i{inline-size:10px;block-size:10px;border-radius:50%}
.sc-scores b{text-align:end}
.sc-legend{display:flex;justify-content:space-between;margin:6px 0 0;font-size:12.5px;color:var(--text-muted)}.sc-legend span{display:inline-flex;align-items:center;gap:3px}.sc-legend img{inline-size:22px;block-size:22px}
.sc-chips{display:inline-flex;align-items:center;gap:2px}.sc-chips img{inline-size:22px;block-size:22px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.sc-board{display:grid;justify-items:center;gap:14px}
.sc-owner{display:flex;align-items:center;gap:8px;color:var(--felt-ink);font-size:14px}
.sc-show{direction:ltr;display:flex;gap:8px;padding:16px 18px 26px;border-radius:14px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.16)}
.sc-show img{display:block;inline-size:84px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 10px 16px -8px rgba(0,0,0,.6)}
.sc-end{position:relative;display:block}
.sc-end img{box-shadow:0 0 0 2px rgba(232,166,66,.7),0 10px 16px -8px rgba(0,0,0,.6)}
.sc-end em{position:absolute;inset-inline:0;inset-block-end:-20px;text-align:center;font-style:normal;font-size:11.5px;color:var(--felt-gold)}
.sc-hint{margin:0;color:var(--felt-muted);font-size:12.5px;text-align:center}
.sc-above{display:flex;align-items:center;justify-content:center;gap:16px;inline-size:100%;margin-block-end:14px}
.sc-acts{display:flex;gap:6px}
.sc-act{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:1px;padding:5px 12px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.sc-act b{font-size:13.5px}.sc-act small{font-size:10.5px;color:#3A4F5E}
.sc-act.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.sc-go{display:flex;align-items:center;gap:10px;color:var(--felt-ink);font-size:14px}
.sc-above--ph{flex-direction:column;gap:6px;padding-inline:10px;box-sizing:border-box;margin-block-end:10px}
.sc-above--ph .sc-acts{inline-size:100%}.sc-above--ph .sc-act{flex:1;padding:8px 4px}.sc-above--ph .sc-act b{font-size:12.5px}
.sc-above--ph .sc-go{inline-size:100%;justify-content:space-between}
.cx-phone .sc-board{gap:10px}
.cx-phone .sc-show{padding:10px 12px 22px;gap:6px}.cx-phone .sc-show img{inline-size:62px}
.cx-phone .sc-hint{font-size:11.5px}
.sc-took{position:relative;display:block;opacity:.35}.sc-took em{position:absolute;inset-inline:0;inset-block-end:-20px;text-align:center;font-style:normal;font-size:11.5px;color:var(--felt-muted)}
.sc-gap{position:relative;display:block;outline:2px dashed var(--felt-gold);outline-offset:3px;border-radius:4px}.sc-gap em{position:absolute;inset-inline:0;inset-block-start:-22px;text-align:center;font-style:normal;font-size:11px;font-weight:800;color:var(--felt-gold)}
.sc-or{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--felt-muted)}.sc-o{all:unset;cursor:pointer;border-radius:5px;padding:2px}.sc-o img{inline-size:30px;display:block;border-radius:3px}.sc-o.is-sel{background:var(--felt-gold)}
.sc-flip{display:grid;gap:8px}.sc-fo{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:var(--radius-md);background:var(--surface-sunken);font-size:15px}
.sc-fo span{display:flex;gap:8px;font-weight:800;color:var(--heading)}.sc-fo span i{font-style:normal}.sc-fo.is-sel{box-shadow:inset 0 0 0 3px var(--felt-gold)}
.cx-phone .gc-hand{padding-block-start:24px}`,
    shotTitle: 'نوبت شما', turnSub: 'نمایش، دیدبانی یا هر دو',
    diffs: [
      ['چیدمان', 'وسط میز فقط نمایش فعلی با اسم صاحبش؛ دو کارت سرِ نمایش با برچسب «دیدبانی» مشخص‌اند. روی صندلی‌ها تعداد کارت دست، ژتون و کارت‌های برده'],
      ['ترتیب ثابت دست', 'دست شما به‌جای بادبزن هم‌پوشان، کنار هم و کامل دیده می‌شود تا هر دو عدد هر کارت پیدا باشد؛ کشیدن و جابه‌جا کردن کارت‌ها غیرفعال است. فقط کارت دیدبانی‌شده با کشیدن به یک فاصله در دست می‌نشیند'],
      ['سه کار نوبت', 'بالای دست: «نمایش»، «دیدبانی» و «دیدبانی و نمایش» (یک بار در هر دست؛ بعد از استفاده غیرفعال). در حالت نمایش فقط کارت‌های کنار هم انتخاب می‌شوند و نوع نمایش (دسته یا ردیف) کنار دکمه می‌آید'],
      ['جهت دست', 'شروع هر دست یک پنجرهٔ جدا دارد: دست را همین‌طور نگه دارید یا کل دست را برگردانید (هر دو حالت کنار هم نشان داده می‌شود)'],
      ['ژتون و کارت پشت', 'مثل نسخهٔ چاپی Oink: دست حریف‌ها با پشت کارت (تا ۴ کارت و عدد کنارش)، ژتون دیدبانی با تصویر ژتون واقعی و امتیاز هر دست با ژتون‌های امتیاز (۱، ۲، ۵، ۱۰، ۲۰ که ارزششان از شکلشان پیداست؛ عدد کنارشان هم نوشته شده). هر سه با GPT ساخته و با عکس قطعهٔ واقعی مقایسه شدند'],
      ['قوانین', '۲ تا ۵ نفر مثل موتور؛ در چهارنفره کارت ۹/۱۰ کنار می‌رود و هر نفر ۱۱ کارت دارد؛ به تعداد بازیکنان دست بازی می‌شود. تصویر کارت‌ها کوچک (۵۴ پیکسل) است و کمی بزرگ‌نمایی شده'],
    ],
  };
}
