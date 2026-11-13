// For Sale on the card-table frame (repo engine; 4 players: 28 properties, 28 cheques, 7 + 7 rounds, 18 coins each).
// Moment: selling phase, round 3 of 7. Cheques 14, 9, 6, 0 are up; Niloufar and Reza have put a property face down.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const coin = (n) => `<span class="fs-coin">${img('for-sale-coin', 'سکه')}<b>${fa(n)}</b></span>`;
  const chq = (v) => img(`for-sale-cheque-${String(v).padStart(2, '0')}`, v ? `چک ${fa(v)} هزار` : 'چک صفر');
  const hand = [3, 11, 17, 24, 29].map((v) => ({ art: `for-sale-property-${String(v).padStart(2, '0')}`, alt: `ملک ${fa(v)}`, sel: v === 24 }));
  const picked = (ok) => `<span class="gc-tag${ok ? '' : ' gc-tag--soft'}">${ok ? 'گذاشت' : 'در فکر…'}</span>`;
  const slot = (who, seat, back, cls = '') => `<div class="fs-slot ${cls}">${back ? img('for-sale-property-back', `ملک پشت‌وروی ${who}`) : `<span class="fs-slot__empty">؟</span>`}<span><i style="background:var(--seat-${seat})"></i>${who}</span></div>`;
  const ranks = ['بزرگ‌ترین ملک', 'دومی', 'سومی', 'کوچک‌ترین'];
  const table = (ph) => `${ph ? '' : `<div class="gc-pile" style="--pw:92px">${img('for-sale-currency-back', 'دستهٔ چک')}<span><b>${fa(16)}</b> چک مانده</span></div>`}
<div class="fs-board"><div class="fs-cheques" aria-label="چک‌های این دور">${[14, 9, 6, 0].map((v, k) => `<figure>${chq(v)}<figcaption>${ranks[k]}</figcaption></figure>`).join('')}</div>
<div class="fs-slots" aria-label="ملک‌های گذاشته‌شده">${slot('نیلوفر', 2, true)}${slot('رضا', 6, true)}${slot('سارا', 4, false)}${slot('شما', 1, false, 'is-me')}</div>
<p class="fs-hint">${ph ? `<bdi>دور ${fa(3)} از ${fa(7)}</bdi>، <bdi>${fa(16)} چک مانده</bdi>` : 'ملک‌ها تا انتخاب آخرین نفر پشت‌ورو می‌مانند'}</p></div>`;
  const bar = (ph) => `<div class="fs-bar${ph ? ' fs-bar--ph' : ''}"><span>${ph ? '' : 'انتخاب شما: '}<b>ملک ${fa(24)}</b></span>${btn('بگذار برای فروش', 'primary', 'check')}</div>`;
  const { modal } = H;
  const prop = (v, alt) => img(`for-sale-property-${String(v).padStart(2, '0')}`, alt ?? `ملک ${fa(v)}`);
  const bidRow = (who, seat, bid, st, cls = '') => `<li class="${cls}"><i style="background:var(--seat-${seat})"></i><b>${who}</b><span>${bid}</span><em>${st}</em></li>`;
  // buying phase (round 5 of 7): 4 up, Reza already passed (took 5, got 1 back); top bid Sara 6
  const buyTable = (o) => (ph) => `${ph ? '' : `<div class="gc-pile" style="--pw:92px">${img('for-sale-property-back', 'دستهٔ ملک')}<span><b>${fa(8)}</b> ملک مانده</span></div>`}
<div class="fs-board"><div class="fs-props" aria-label="ملک‌های این دور">${[[27, 'گران‌ترین'], [21, ''], [13, 'ارزان‌ترینِ مانده'], [5, 'رضا برداشت']].map(([v, t]) => `<figure class="${v === 5 ? 'is-gone' : v === 13 ? 'is-next' : ''}">${prop(v)}<figcaption>${t}</figcaption></figure>`).join('')}</div>
<ul class="fs-bids" aria-label="پیشنهادها">${bidRow('سارا', 4, `${fa(6)} سکه`, 'بالاترین', 'is-top')}${bidRow('نیلوفر', 2, `${fa(4)} سکه`, 'در مزایده')}${bidRow('شما', 1, `${fa(o.mine)} سکه`, 'نوبت شما', 'is-me')}${bidRow('رضا', 6, '—', 'کنار کشید: ملک ۵', 'is-out')}</ul></div>`;
  const bidBar = (o) => (ph) => `<div class="fs-bid${ph ? ' fs-bid--ph' : ''}">${o.can ? `<span class="fs-step"><button type="button" aria-label="کم کردن">−</button><b>${fa(7)}</b><button type="button" aria-label="زیاد کردن">+</button></span><span class="fs-lim">${ph ? `${fa(7)} تا ${fa(o.coins)}` : `کمترین ${fa(7)}، بیشترین ${fa(o.coins)} (سکه‌های شما)`}</span>${btn(ph ? 'پیشنهاد' : `پیشنهاد ${fa(7)} سکه`, 'primary', 'check')}` : `<span class="fs-lim">${ph ? 'سکه برای بیشتر از ۶ ندارید' : `برای بیشتر از ${fa(6)} سکه ندارید`}</span>${btn('پیشنهاد', 'primary', 'check', ' disabled')}`}${btn('کنار می‌کشم', 'secondary', 'x')}<small class="fs-prev">ملک ${fa(13)} را برمی‌دارید و ${fa(Math.floor(o.mine / 2))} سکه پس می‌گیرید</small></div>`;
  const revealT = (ph) => `${ph ? '' : `<div class="gc-pile" style="--pw:92px">${img('for-sale-currency-back', 'دستهٔ چک')}<span><b>${fa(16)}</b> چک مانده</span></div>`}
<div class="fs-board"><div class="fs-rev">${[[14, 26, 'نیلوفر', 2], [9, 24, 'شما', 1], [6, 12, 'رضا', 6], [0, 8, 'سارا', 4]].map(([c, p, who, seat]) => `<figure>${chq(c)}${prop(p)}<figcaption><i style="background:var(--seat-${seat})"></i>${who}</figcaption></figure>`).join('')}</div><p class="fs-hint">ملک‌ها رو شدند؛ هر ملک چک هم‌رتبه‌اش را می‌گیرد</p></div>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ending = (ph) => modal('پایان بازی', `<p>همهٔ چک‌ها فروخته شد. امتیاز هر نفر جمع چک‌ها به‌اضافهٔ سکه‌های مانده است.</p>
${tbl(['رتبه', 'بازیکن', 'چک‌ها', 'سکه', 'جمع'], [
      { c: [fa(1), 'نیلوفر', fa(55), fa(7), fa(62)], win: true },
      { c: [fa(2), 'شما', fa(58), fa(4), fa(62)] },
      { c: [fa(3), 'رضا', fa(48), fa(3), fa(51)] },
      { c: [fa(4), 'سارا', fa(43), fa(1), fa(44)] },
    ])}<p class="cx-note">شما و نیلوفر هر دو ${fa(62)} امتیاز دارید؛ در تساوی سکهٔ مانده بیشتر می‌برد و اگر باز هم مساوی بود بالاترین کارت ملک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const buyOpps = (sara) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: `${backs('for-sale-property-back', 4, 1)}${coin(10)}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `${backs('for-sale-property-back', 5, 1)}${coin(12)}<span class="gc-tag gc-tag--soft">کنار کشید</span>` },
    { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: `${backs('for-sale-property-back', 4, 1)}${coin(sara)}<span class="gc-tag">${fa(6)}</span>` },
  ];  return {
    slug: 'ForSale', fa: 'حراجی', latin: 'For Sale', meta: ['زنده', '۴ نفر', 'مرحلهٔ فروش'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: `${backs('for-sale-property-back', 5, 1)}${coin(3)}${picked(true)}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `${backs('for-sale-property-back', 5, 1)}${coin(8)}${picked(true)}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:24', turn: true, meta: `${backs('for-sale-property-back', 5, 1)}${coin(1)}${picked(false)}` },
    ],
    me: { cards: hand, clock: '0:21', turn: true, note: coin(5), above: (ph) => bar(ph) },
    cardW: 96, phoneCardW: 62, cardRatio: 1.55,
    table,
    status: `<b>همه هم‌زمان انتخاب می‌کنند.</b> یک ملک برای فروش بگذارید؛ بزرگ‌ترین ملک چک ${fa(14)} را می‌گیرد و کوچک‌ترین چک صفر را.`,
    pstatus: '<b>انتخاب هم‌زمان.</b> یک ملک برای فروش بگذارید.',
    railCard: `<section class="cx-card"><h3>دارایی شما</h3><div class="fs-mine">${chq(12)}${chq(2)}<span class="fs-mine__coins">${img('for-sale-coin', 'سکه')}<b>${fa(5)}</b><small>سکه</small></span></div><div class="gc-pills"><span class="bgv-chip">امتیاز تا الان: ${fa(19)}</span><span class="bgv-chip">دور ${fa(3)} از ${fa(7)}</span></div><div class="ga-rule">${ic('info')}<span>ملک‌های بزرگ را برای دورهایی نگه دارید که چک بزرگ آمده. چک و ملک دیگران تا آخر بازی پنهان است؛ فقط تعدادشان پیداست.</span></div></section>`,
    logNote: `فروش، دور ${fa(3)}`,
    log: [[4, 'دور ۲: سارا با ۲۸ چک ۱۳ گرفت'], [1, 'شما با ۲۲ چک ۱۲ گرفتید'], [6, 'رضا با ۱۵ چک ۷ و نیلوفر با ۹ چک صفر'], [2, 'دور ۳: نیلوفر ملکش را گذاشت'], [6, 'رضا ملکش را گذاشت'], [1, 'منتظر شما و سارا']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['eye', 'دارایی'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'مرحلهٔ خرید', turnSub: 'پیشنهاد نوبتی یا کنار کشیدن', meta: ['زنده', '۴ نفر', 'خرید، دور ۵ از ۷'], phone: true,
        opps: buyOpps(4), table: buyTable({ mine: 3 }),
        me: { cards: [3, 11, 17, 24].map((v) => ({ art: `for-sale-property-${String(v).padStart(2, '0')}`, alt: `ملک ${fa(v)}` })), note: coin(9), above: bidBar({ can: true, coins: 9, mine: 3 }) },
        status: '<b>مرحلهٔ خرید، نوبت شما.</b> بالاترین پیشنهاد ۶ سکهٔ ساراست. دست‌کم ۷ پیشنهاد بدهید یا کنار بکشید: ارزان‌ترین ملک مانده (۱۳) را برمی‌دارید و نصف پیشنهادتان برمی‌گردد.',
        pstatus: '<b>نوبت شما.</b> ۷ سکه یا بیشتر، یا کنار بکشید.',
        railCard: `<section class="cx-card"><h3>این دور<span class="bgv-spacer"></span><span class="cx-note">خرید ${fa(5)} از ${fa(7)}</span></h3><div class="ga-rule">${ic('info')}<span>پیشنهاد تازه جای پیشنهاد قبلی‌تان را می‌گیرد. هر کس کنار بکشد ارزان‌ترین ملک مانده را برمی‌دارد و نصف پیشنهادش (رو به پایین) پس می‌گیرد؛ آخرین نفر کل پیشنهادش را می‌دهد و گران‌ترین ملک را برمی‌دارد.</span></div></section>`,
        log: [[6, 'رضا ۲ سکه گفت'], [4, 'سارا ۶ سکه گفت'], [2, 'نیلوفر ۴ سکه گفت'], [6, 'رضا کنار کشید: ملک ۵، ۱ سکه پس گرفت'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'سکه کافی نیست', turnSub: 'فقط «کنار می‌کشم»', meta: ['زنده', '۴ نفر', 'خرید، دور ۶ از ۷'], phone: true, phoneOnly: true,
        opps: buyOpps(2), table: buyTable({ mine: 4 }),
        me: { cards: [3, 11, 17, 24].map((v) => ({ art: `for-sale-property-${String(v).padStart(2, '0')}`, alt: `ملک ${fa(v)}` })), note: coin(5), above: bidBar({ can: false, coins: 5, mine: 4 }) },
        pstatus: '<b>نوبت شما.</b> سکه برای پیشنهاد بالاتر ندارید؛ باید کنار بکشید.', status: '',
      },
      {
        shotTitle: 'رو شدن ملک‌ها', turnSub: 'هر ملک کنار چک هم‌رتبه‌اش',
        table: revealT,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '', meta: `${backs('for-sale-property-back', 4, 1)}${coin(3)}<span class="gc-tag">${fa(14)}</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '', meta: `${backs('for-sale-property-back', 4, 1)}${coin(8)}<span class="gc-tag gc-tag--soft">${fa(6)}</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '', meta: `${backs('for-sale-property-back', 4, 1)}${coin(1)}<span class="gc-tag gc-tag--soft">${fa(0)}</span>` },
        ],
        me: { turn: false, cards: hand.filter((c) => !c.sel), above: () => '' },
        status: '<b>همه ملکشان را گذاشتند.</b> نیلوفر با ۲۶ چک ۱۴ را گرفت، شما با ۲۴ چک ۹، رضا با ۱۲ چک ۶ و سارا با ۸ چک صفر.',
        log: [[4, 'سارا ملکش را گذاشت'], [1, 'شما ملک ۲۴ را گذاشتید'], [1, 'ملک‌ها رو شد: شما چک ۹ گرفتید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'چک‌ها، سکه‌ها و تساوی', meta: ['تمام شد', '۴ نفر', 'فروش، دور ۷ از ۷'],
        table: (ph) => `<div class="fs-board"><div class="fs-cheques">${[12, 2, 9, 14, 6, 9, 6].map((v) => `<figure>${chq(v)}</figure>`).join('')}</div></div>`, overlay: ending,
        me: { turn: false, clock: '', cards: [], above: () => '', note: coin(4) },
        railCard: '',
        status: '<b>بازی تمام شد.</b> شما و نیلوفر هر دو ۶۲ امتیاز دارید؛ نیلوفر با سکهٔ بیشتر برد.',
        log: [[1, 'دور آخر فروش: شما چک ۱۴ گرفتید'], [2, 'نیلوفر چک ۱۵ گرفت'], [2, 'نیلوفر با تساوی‌شکن برد']],
      },
    ],    css: `.fs-coin{display:inline-flex;align-items:center;gap:3px;color:var(--felt-ink)}.fs-coin img{inline-size:16px;block-size:16px}.fs-coin b{font-weight:700}
.cx-pbar .fs-coin{color:inherit}.cx-pbar .fs-coin img{inline-size:18px;block-size:18px}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:7px;font-size:11.5px}
.fs-board{display:grid;justify-items:center;gap:12px}
.fs-cheques{display:flex;gap:14px}
.fs-cheques figure{margin:0;display:grid;justify-items:center;gap:6px;color:var(--felt-muted);font-size:12px}
.fs-cheques img{inline-size:96px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 12px 18px -10px rgba(0,0,0,.7)}
.fs-cheques figure:first-child img{box-shadow:0 0 0 3px var(--felt-gold),0 12px 18px -10px rgba(0,0,0,.7)}
.fs-slots{display:flex;gap:14px}
.fs-slot{display:grid;justify-items:center;gap:6px;inline-size:96px;color:var(--felt-ink);font-size:12.5px;font-weight:700}
.fs-slot img{inline-size:72px;display:block}
.fs-slot>span:last-child{display:inline-flex;align-items:center;gap:5px}.fs-slot i{inline-size:8px;block-size:8px;border-radius:50%}
.fs-slot__empty{display:grid;place-items:center;inline-size:64px;block-size:98px;margin-block:5px;border-radius:7px;border:1.5px dashed rgba(250,245,236,.35);color:var(--felt-muted);font-size:18px}
.fs-slot.is-me .fs-slot__empty{border-color:var(--felt-gold);color:var(--felt-gold);background:rgba(232,166,66,.1)}
.fs-hint{margin:0;color:var(--felt-muted);font-size:12.5px}
.fs-bar{margin-block-end:16px;display:flex;align-items:center;justify-content:center;gap:14px;inline-size:100%}
.fs-bar>span{display:grid;color:var(--felt-ink);font-size:14px}.fs-bar small{color:var(--felt-muted);font-size:12px}
.fs-bar--ph{margin-block-end:12px;padding-inline:10px;box-sizing:border-box;justify-content:space-between}.fs-bar--ph>span{font-size:13px}
.fs-mine{display:flex;gap:10px;align-items:center}.fs-mine>img{inline-size:58px;border-radius:5px;box-shadow:var(--shadow-card)}
.fs-mine__coins{display:grid;justify-items:center;gap:2px;margin-inline-start:8px;color:var(--heading)}.fs-mine__coins img{inline-size:40px}.fs-mine__coins b{font-size:16px}.fs-mine__coins small{color:var(--text-muted)}
.cx-phone .fs-cheques,.cx-phone .fs-slots{gap:8px}
.cx-phone .fs-cheques img{inline-size:70px}.cx-phone .fs-cheques figure{font-size:10.5px}
.cx-phone .fs-slot{inline-size:72px;font-size:11.5px}.cx-phone .fs-slot img{inline-size:52px}
.cx-phone .fs-slot__empty{inline-size:46px;block-size:70px;margin-block:4px}
.cx-phone .gc-seat__meta .gc-backs{display:none}
.fs-props{display:flex;gap:12px}.fs-props figure{margin:0;display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:11.5px;min-block-size:150px}
.fs-props img{inline-size:84px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 12px 18px -10px rgba(0,0,0,.7)}
.fs-props .is-gone img{opacity:.35}.fs-props .is-next img{box-shadow:0 0 0 3px var(--felt-gold),0 12px 18px -10px rgba(0,0,0,.7)}
.fs-bids{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;inline-size:min(440px,100%)}
.fs-bids li{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:10px;background:rgba(250,245,236,.07);color:var(--felt-ink);font-size:13px}
.fs-bids li i{inline-size:8px;block-size:8px;border-radius:50%}.fs-bids li em{margin-inline-start:auto;font-style:normal;font-size:11.5px;color:var(--felt-muted)}
.fs-bids li.is-top{box-shadow:inset 0 0 0 1.5px var(--felt-gold)}.fs-bids li.is-top em{color:var(--felt-gold);font-weight:700}.fs-bids li.is-out{opacity:.55}.fs-bids li.is-me{background:rgba(232,166,66,.14)}
.fs-bid{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;inline-size:100%;margin-block-end:8px;color:var(--felt-ink)}
.fs-step{display:inline-flex;border-radius:var(--radius-sm);overflow:hidden;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.fs-step button{all:unset;cursor:pointer;inline-size:36px;block-size:38px;display:grid;place-items:center;background:var(--felt-control);color:#142B3B;font-weight:800;font-size:18px}
.fs-step b{display:grid;place-items:center;min-inline-size:44px;background:#FAF5EC;color:#142B3B;font-size:16px}
.fs-lim{font-size:12.5px;color:var(--felt-muted)}
.fs-prev{flex-basis:100%;text-align:center;font-size:12px;color:var(--felt-muted)}
.fs-bid--ph{gap:6px;padding-inline:10px;box-sizing:border-box}
.cx-phone .fs-props{gap:6px}.cx-phone .fs-props img{inline-size:60px}.cx-phone .fs-props figure{min-block-size:0;font-size:10px}
.cx-phone .fs-bids{grid-template-columns:1fr 1fr;gap:4px;padding-inline:8px;box-sizing:border-box}.cx-phone .fs-bids li{font-size:11.5px;padding:4px 6px}.cx-phone .fs-bids li em{display:none}
.fs-rev{display:flex;gap:14px}.fs-rev figure{margin:0;display:grid;justify-items:center;gap:6px;color:var(--felt-ink);font-size:12.5px;font-weight:700}
.fs-rev img:first-child{inline-size:90px;border-radius:6px}.fs-rev img+img{inline-size:72px;border-radius:6px;margin-block-start:-18px;box-shadow:0 8px 14px -6px rgba(0,0,0,.6)}
.fs-rev figcaption{display:inline-flex;align-items:center;gap:5px}.fs-rev i{inline-size:8px;block-size:8px;border-radius:50%}
.cx-phone .fs-rev{gap:8px}.cx-phone .fs-rev img:first-child{inline-size:68px}.cx-phone .fs-rev img+img{inline-size:52px}`,
    shotTitle: 'مرحلهٔ فروش', turnSub: 'انتخاب هم‌زمان ملک',
    diffs: [
      ['چیدمان', 'مرحلهٔ ۲ (فروش): وسط میز چهار چک رو از بزرگ به کوچک، زیرش جای ملکِ پشت‌وروی هر بازیکن؛ دست شما ملک‌هایی است که در مرحلهٔ ۱ خریده‌اید'],
      ['انتخاب هم‌زمان', 'نوبتی نیست و ساعت همه می‌چرخد. روی صندلی‌ها «گذاشت» یا «در فکر…»؛ ملک‌ها تا آخرین انتخاب پشت‌ورو می‌مانند و بعد هر کدام کنار چک هم‌رتبه‌اش رو می‌شود'],
      ['مرحلهٔ ۱ (خرید)', 'در همین قاب: وسط میز به تعداد بازیکن ملک رو با پیشنهاد هر نفر؛ بالای دست «پیشنهاد» با شمارهٔ سکه و «کنار می‌کشم» (ارزان‌ترین ملک را برمی‌دارید و نصف پیشنهاد برمی‌گردد)'],
      ['دارایی', 'سکه و تعداد ملک و چک همه پیداست؛ ملک‌ها و مبلغ چک دیگران پنهان است. چک‌ها و سکه‌های خودتان در کارت ستون کنار با امتیاز تا الان'],
      ['ستون کنار', 'رویدادها نتیجهٔ هر دور فروش (کدام ملک کدام چک را گرفت) و اینکه چه کسی ملکش را گذاشته؛ «مساوی» ندارد'],
      ['قوانین', '۳ تا ۶ نفر؛ از هر دسته در سه‌نفره ۶ کارت و در چهارنفره ۲ کارت کنار می‌رود و پنج و شش‌نفره همه بازی می‌شود (اینجا ۷ دور خرید و ۷ دور فروش). دونفرهٔ غیررسمی موتور ۱۰ کارت کنار می‌گذارد. اگر زمان تمام شود ارزان‌ترین ملکتان گذاشته می‌شود'],
    ],
  };
}
