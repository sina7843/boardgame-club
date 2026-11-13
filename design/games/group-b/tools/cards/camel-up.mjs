// Camel Up / شترسواری on the shared table frame (group B). Rules as the repo engine (first edition, 5 camels, 16 spaces):
// a turn is one of: take the top leg-bet card of a camel (5/3/2), place your desert tile (oasis +1 / mirage −1; not on
// space 1, not under camels, not on or next to another player's tile), take a die from the pyramid (+1 coin, that camel
// moves 1–3), or secretly bet a camel card on the overall winner or loser. Everyone starts with 3 coins.
// The ready-made racecourse has the opening position printed on it (blue on 1; white/yellow/green stacked on 2, green on
// top; orange on 3; leg 1, no die out of the pyramid). So the mock is leg 1 before the first roll:
//   round 1: Reza took blue 5 · Sara laid an oasis on 5 · Niloufar took green 5 · you took green 3;
//   round 2: Reza took orange 5 · Sara bet secretly on the overall winner · Niloufar laid a mirage on 11 · now you.
// Top cards: blue 3, green 2, orange 3, yellow 5, white 5. Legal desert spaces for you: 7, 8, 9, 13–16.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const FA = { blue: 'آبی', green: 'سبز', orange: 'نارنجی', yellow: 'زرد', white: 'سفید' };
  // racecourse 772×447: 6×4 tiles, col pitch 123.6 from x 18 (w 119), row pitch 104.3 from y 17 (h 98)
  const cr = (sp) => sp <= 6 ? [sp - 1, 3] : sp === 7 ? [5, 2] : sp === 8 ? [5, 1] : sp <= 14 ? [14 - sp, 0] : sp === 15 ? [0, 1] : [0, 2];
  const rect = (sp) => { const [c, r] = cr(sp); return `left:${((18 + c * 123.6) / 7.72).toFixed(3)}%;top:${((17 + r * 104.3) / 4.47).toFixed(3)}%;inline-size:${(119 / 7.72).toFixed(3)}%;block-size:${(98 / 4.47).toFixed(3)}%`; };
  const desert = (sp, oasis, seat, who) => `<span class="cu-d" style="${rect(sp)}">${img(oasis ? 'camel-up-oasis' : 'camel-up-mirage', `${oasis ? 'واحه' : 'سراب'} ${who} روی خانهٔ ${fa(sp)}`)}<i class="bgv-avatar bgv-avatar--sm seat-${seat}">${who[0]}</i></span>`;
  const legal = [7, 8, 9, 13, 14, 15, 16];
  const board = (ph) => `<div class="cu-board${ph ? ' cu-board--ph' : ''}">${img('camel-up-board', 'مسیر مسابقه: آبی روی ۱، سفید و زرد و سبز روی هم در ۲، نارنجی روی ۳')}
${legal.map((sp) => `<i class="cu-ok" style="${rect(sp)}"></i>`).join('')}${desert(5, true, 4, 'سارا')}${desert(11, false, 2, 'نیلوفر')}
<span class="cu-lead" style="${rect(3)}">اول</span><span class="cu-pyr">${fa(5)} تاس در هرم</span></div>`;
  const tops = [['blue', 3, 2], ['green', 2, 1], ['orange', 3, 2], ['yellow', 5, 3], ['white', 5, 3]];
  const leg = (ph) => `<div class="cu-legs" role="group" aria-label="شرط مرحله">${tops.map(([c, v, n]) => `<button type="button" class="cu-leg${c === 'orange' ? ' is-hint' : ''}">${img(`camel-up-bet-${c}-${v}`, `شرط مرحله ${FA[c]}، ${fa(v)} سکه`)}<small>${fa(n)} مانده</small></button>`).join('')}</div>`;
  const coin = (n) => `<span class="cu-coin">${img('camel-up-coin', '')}<b>${fa(n)}</b></span>`;
  const mini = (arr) => `<span class="cu-mini">${arr.map((a) => img(a, '')).join('')}</span>`;
  const above = (ph) => ph
    ? `<div class="cu-ctl cu-ctl--ph">${leg(true)}<div class="cu-acts"><button type="button" class="cu-act">${img('camel-up-oasis', '')}<b>کاشی</b></button><button type="button" class="cu-act">${img('camel-up-pyramid', '')}<b>تاس از هرم</b></button><button type="button" class="cu-act">${img('camel-up-camel-green', '')}<b>شرط نهایی</b></button></div></div>`
    : `<div class="cu-ctl"><section><h4>شرط مرحله</h4>${leg(false)}</section>
<section><h4>کاشی بیابان</h4><div class="cu-tile"><button type="button" class="cu-act">${img('camel-up-oasis', 'واحه')}<b>واحه</b></button><button type="button" class="cu-act">${img('camel-up-mirage', 'سراب')}<b>سراب</b></button></div></section>
<section><h4>تاس از هرم</h4><button type="button" class="cu-act cu-act--pyr">${img('camel-up-pyramid', 'هرم')}<b>+${fa(1)} سکه</b></button></section>
<section><h4>شرط نهایی</h4><div class="cu-fin"><button type="button" class="cu-act">${ic('trophy')}<b>برنده</b></button><button type="button" class="cu-act">${ic('flag')}<b>بازنده</b></button></div></section></div>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  // empty racecourse (printed camels removed) + camel pieces stacked bottom → top
  const stackOn = (sp, list) => `<span class="cu-st" style="${rect(sp)}">${list.map((c, k) => `<span class="cu-cm" style="--k:${k}">${img(`camel-up-camel-${c}`, `شتر ${FA[c]} روی خانهٔ ${fa(sp)}`)}</span>`).join('')}</span>`;
  const okAt = (list) => list.map((sp) => `<i class="cu-ok" style="${rect(sp)}"></i>`).join('');
  const boardE = (o) => (ph) => `<div class="cu-board${ph ? ' cu-board--ph' : ''}">${img('camel-up-board-empty', 'مسیر مسابقه')}
${okAt(o.ok ?? [])}${(o.tiles ?? []).map(([sp, oa, seat, who]) => desert(sp, oa, seat, who)).join('')}${Object.entries(o.st).map(([sp, l]) => stackOn(+sp, l)).join('')}
${o.mark ? `<span class="cu-mk" style="${rect(o.mark[0])}"><em>${o.mark[1]}</em></span>` : ''}<span class="cu-legno">${o.leg}</span><span class="cu-pyr">${o.pyr}</span></div>`;
  const ST3 = { 4: ['blue'], 6: ['white', 'yellow'], 7: ['orange'], 8: ['green'] };
  const T3 = [[5, true, 4, 'سارا'], [10, true, 1, 'شما'], [13, false, 2, 'نیلوفر']];
  const camCard = (c, used, sel) => `<button type="button" class="cu-cc${used ? ' is-used' : ''}${sel ? ' is-sel' : ''}"${used ? ' disabled' : ''}>${img(`camel-up-camel-${c}`, `کارت شتر ${FA[c]}`)}<small>${used ? 'روی بازنده' : FA[c]}</small></button>`;
  const finalPick = (ph) => modal('شرط نهایی: برندهٔ کل مسابقه', `<p>یکی از کارت‌های شترتان را پنهانی روی دستهٔ «برنده» بگذارید. هر شتر را فقط یک بار می‌شود شرط بست؛ کارت آبی را قبلاً روی «بازنده» گذاشته‌اید.</p><div class="cu-ccs">${camCard('orange')}${camCard('green', false, true)}${camCard('yellow')}${camCard('white')}${camCard('blue', true)}</div><p class="cx-note">زودتر شرط ببندید سود بیشتری دارد: اولین شرط درست ${fa(8)}، بعد ${fa(5)}، ${fa(3)}، ${fa(2)} و ${fa(1)} سکه؛ هر شرط غلط ${fa(1)} سکه جریمه.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('شرط روی سبز', 'primary', 'check')}`);
  const legEnd = (ph) => modal('پایان مرحلهٔ ۲', `<p>پنجمین تاس از هرم درآمد. سبز اول و نارنجی دوم شد.</p>
${tbl(['بازیکن', 'شرط مرحله', 'هرم', 'کاشی', 'این مرحله', 'جمع'], [
      { c: ['شما', `سبز ${fa(5)}+، نارنجی ${fa(1)}+`, `${fa(1)}+`, fa(0), `${fa(7)}+`, fa(16)], win: true },
      { c: ['نیلوفر', `سبز ${fa(3)}+`, fa(0), `${fa(1)}+`, `${fa(4)}+`, fa(11)] },
      { c: ['سارا', `زرد ${fa(1)}−`, `${fa(2)}+`, `${fa(1)}+`, `${fa(2)}+`, fa(10)] },
      { c: ['رضا', `آبی ${fa(1)}−`, `${fa(2)}+`, fa(0), `${fa(1)}+`, fa(7)] },
    ])}<p class="cx-note">کارت‌های شرط مرحله و کاشی‌های بیابان به جایشان برمی‌گردند و هر ${fa(5)} تاس به هرم. مرحلهٔ ۳ را نفر بعد از کسی که آخرین تاس را برداشت شروع می‌کند.</p>`, `${btn('مرحلهٔ بعد', 'primary', 'next')}`);
  const pile = (title, rows) => `<div class="cu-pile"><h4>${title}</h4><ol>${rows.map(([who, c, v, ok]) => `<li class="${ok ? 'is-ok' : 'is-no'}">${img(`camel-up-camel-${c}`, `شتر ${FA[c]}`)}<span>${who}</span><b>${v}</b></li>`).join('')}</ol></div>`;
  const ending = (ph) => modal('پایان مسابقه: سبز از خط گذشت', `<p>بعد از حساب مرحلهٔ آخر، شرط‌های نهایی به ترتیبی که بسته شده بودند رو می‌شوند. سبز برنده و آبی آخر شد.</p>
<div class="cu-piles">${pile('دستهٔ برنده', [['سارا', 'green', `${fa(8)}+`, true], ['شما', 'green', `${fa(5)}+`, true], ['رضا', 'orange', `${fa(1)}−`, false]])}${pile('دستهٔ بازنده', [['شما', 'blue', `${fa(8)}+`, true], ['نیلوفر', 'white', `${fa(1)}−`, false]])}</div>
${tbl(['رتبه', 'بازیکن', 'پیش از شرط نهایی', 'شرط نهایی', 'جمع'], [
      { c: [fa(1), 'شما', fa(22), `${fa(13)}+`, fa(35)], win: true },
      { c: [fa(2), 'سارا', fa(19), `${fa(8)}+`, fa(27)] },
      { c: [fa(3), 'نیلوفر', fa(18), `${fa(1)}−`, fa(17)] },
      { c: [fa(4), 'رضا', fa(15), `${fa(1)}−`, fa(14)] },
    ])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const OPP3 = [
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:45', meta: `${coin(7)}${mini(['camel-up-bet-orange-5'])}` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${coin(10)}${mini(['camel-up-oasis'])}<span class="gc-tag gc-tag--soft">${fa(2)} شرط نهایی</span>` },
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${coin(11)}${mini(['camel-up-mirage'])}` },
        ];
  const rankRail = (order, leg, n) => `<section class="cx-card"><h3>${leg}<span class="bgv-spacer"></span><span class="cx-note">${n}</span></h3><div class="cu-rank"><span>ترتیب:</span>${order.map((c, k) => `<i title="${FA[c]}">${img(`camel-up-camel-${c}`, `${fa(k + 1)}. ${FA[c]}`)}</i>`).join('')}</div></section>`;  return {
    slug: 'CamelUp', fa: 'شترسواری', latin: 'Camel Up', meta: ['زنده', '۴ نفر', 'مرحلهٔ ۱'],
    opps: [
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:45', meta: `${coin(3)}${mini(['camel-up-bet-blue-5', 'camel-up-bet-orange-5'])}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${coin(3)}${mini(['camel-up-oasis'])}<span class="gc-tag gc-tag--soft">شرط نهایی</span>` },
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${coin(3)}${mini(['camel-up-bet-green-5', 'camel-up-mirage'])}` },
    ],
    me: { cards: [], clock: '0:38', turn: true, note: `<span class="cu-me">${coin(3)}${mini(['camel-up-bet-green-3'])}<span>کاشی بیابان دستتان است</span></span>`, above },
    table: (ph) => board(ph),
    status: '<b>نوبت شماست؛ یکی از چهار کار.</b> هنوز هیچ تاسی از هرم درنیامده و نارنجی اول است. کارت رویی نارنجی ۳ سکه می‌ارزد؛ کاشی بیابان فقط روی خانه‌های خط‌چین می‌نشیند.',
    pstatus: '<b>نوبت شما.</b> شرط مرحله، کاشی بیابان، تاس از هرم یا شرط نهایی.',
    railCard: `<section class="cx-card"><h3>این مرحله<span class="bgv-spacer"></span><span class="cx-note">${fa(5)} تاس در هرم</span></h3><div class="cu-rank"><span>ترتیب:</span>${['orange', 'green', 'yellow', 'white', 'blue'].map((c, k) => `<i title="${FA[c]}">${img(`camel-up-camel-${c}`, `${fa(k + 1)}. ${FA[c]}`)}</i>`).join('')}</div><div class="gc-pills"><span class="bgv-chip">شرط نهایی برنده: ${fa(1)}</span><span class="bgv-chip">بازنده: ${fa(0)}</span></div><div class="ga-rule">${ic('info')}<span>هر تاس هرم ۱ تا ۳ خانه شتر همان رنگ را جلو می‌برد <span class="cu-dice">${img('camel-up-die-blue-1', '۱')}${img('camel-up-die-blue-2', '۲')}${img('camel-up-die-blue-3', '۳')}</span> و شترهای روی پشتش را هم می‌برد. آخر مرحله کارت شتر اول عددش، شتر دوم ۱ سکه و بقیه ۱ سکه جریمه دارند.</span></div></section>`,
    logNote: 'مرحلهٔ ۱',
    log: [[1, 'شما کارت ۳ سبز را برداشتید'], [6, 'رضا کارت ۵ نارنجی را برداشت'], [4, 'سارا مخفیانه شرط نهایی بست'], [2, 'نیلوفر سراب را روی خانهٔ ۱۱ گذاشت'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['trophy', 'شرط‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شرط نهایی', turnSub: 'انتخاب کارت شتر؛ کارت مصرف‌شده خاموش', meta: ['زنده', '۴ نفر', 'مرحلهٔ ۳'],
        table: boardE({ st: ST3, tiles: T3, leg: 'مرحلهٔ ۳', pyr: `${fa(4)} تاس در هرم` }), overlay: finalPick,
        opps: OPP3,
        me: { note: `<span class="cu-me">${coin(16)}${mini(['camel-up-oasis'])}<span>${fa(1)} شرط نهایی</span></span>`, above: () => '' },
        railCard: rankRail(['green', 'orange', 'yellow', 'white', 'blue'], 'مرحلهٔ ۳', `${fa(4)} تاس در هرم`),
        status: '<b>شرط نهایی روی برنده.</b> کارت شتری را که فکر می‌کنید کل مسابقه را می‌برد انتخاب کنید. هیچ‌کس نمی‌بیند روی کدام شتر شرط بسته‌اید.',
        pstatus: '<b>شرط نهایی:</b> یک کارت شتر.',
        log: [[6, 'رضا کارت ۵ نارنجی را برداشت'], [4, 'سارا مخفیانه شرط نهایی بست'], [1, 'شما «شرط نهایی، برنده» را زدید']],
        phone: true,
      },
      {
        shotTitle: 'جابه‌جایی کاشی', turnSub: 'بردن کاشی بیابان به خانهٔ دیگر یا برگرداندنش', meta: ['زنده', '۴ نفر', 'مرحلهٔ ۳'],
        opps: OPP3,
        table: boardE({ st: ST3, tiles: T3, ok: [2, 3, 9, 11, 15, 16], mark: [10, 'کاشی شما'], leg: 'مرحلهٔ ۳', pyr: `${fa(4)} تاس در هرم` }),
        me: { note: `<span class="cu-me">${coin(16)}<span>کاشی شما روی خانهٔ ${fa(10)}</span></span>`, above: (ph) => `<div class="cu-mv${ph ? ' cu-mv--ph' : ''}"><span class="cu-mv__t"><b>کاشی شما روی خانهٔ ${fa(10)}</b><small>${ph ? 'خانهٔ تازه را بزنید یا برش گردانید' : 'روی یک خانهٔ خط‌چین بزنید تا کاشی آنجا برود، یا همین‌جا برش گردانید'}</small></span><button type="button" class="cu-act">${img('camel-up-oasis', '')}<b>واحه</b></button><button type="button" class="cu-act is-on">${img('camel-up-mirage', '')}<b>سراب</b></button>${btn('تأیید', 'primary', 'check')}</div>` },
        railCard: rankRail(['green', 'orange', 'yellow', 'white', 'blue'], 'مرحلهٔ ۳', `${fa(4)} تاس در هرم`),
        status: '<b>کاشی بیابان را جابه‌جا می‌کنید.</b> کاشی‌تان روی خانهٔ ۱۰ است. می‌توانید آن را به یکی از خانه‌های خط‌چین ببرید یا رویش را برگردانید (واحه +۱، سراب −۱). همین یک کار، نوبتتان است.',
        pstatus: '<b>جابه‌جایی کاشی.</b> خانهٔ تازه یا برگرداندن.',
        log: [[6, 'رضا کارت ۵ نارنجی را برداشت'], [1, 'شما کاشی بیابان را انتخاب کردید']],
        phone: true,
      },
      {
        shotTitle: 'پایان مرحله', turnSub: 'سود و زیان هر نفر و برگشتن کارت‌ها', meta: ['زنده', '۴ نفر', 'پایان مرحلهٔ ۲'],
        table: boardE({ st: { 3: ['blue'], 5: ['white', 'yellow'], 6: ['orange'], 7: ['green'] }, tiles: [[9, true, 1, 'شما'], [12, false, 2, 'نیلوفر'], [4, true, 4, 'سارا']], leg: 'مرحلهٔ ۲', pyr: 'هرم خالی شد' }), overlay: legEnd,
        me: { turn: false, note: `<span class="cu-me">${coin(16)}</span>`, above: () => '' },
        railCard: rankRail(['green', 'orange', 'yellow', 'white', 'blue'], 'پایان مرحلهٔ ۲', `${fa(0)} تاس در هرم`),
        status: '<b>مرحلهٔ ۲ تمام شد.</b> شما ۷ سکه گرفتید و ۱۶ سکه دارید.',
        log: [[6, 'رضا آخرین تاس هرم را برداشت: سبز ۲ خانه'], [1, 'حساب مرحله: شما ۷ سکه'], [4, 'مرحلهٔ ۳ با سارا شروع می‌شود']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'رو شدن شرط‌های نهایی و پرداخت‌ها', meta: ['تمام شد', '۴ نفر', 'مرحلهٔ ۵'],
        table: boardE({ st: { 11: ['blue'], 13: ['white'], 14: ['yellow', 'orange'], 16: ['green'] }, mark: [16, 'از خط گذشت'], leg: 'مرحلهٔ ۵', pyr: 'پایان مسابقه' }), overlay: ending,
        me: { turn: false, clock: '', note: `<span class="cu-me">${coin(35)}</span>`, above: () => '' },
        railCard: '',
        status: '<b>مسابقه تمام شد.</b> سبز برد و شما با ۳۵ سکه اول شدید.',
        log: [[2, 'نیلوفر تاس سبز را برداشت: سبز از خط گذشت'], [1, 'شرط‌های نهایی رو شد'], [1, 'شما بردید']],
      },
    ],    css: `.cu-board{position:relative;direction:ltr;inline-size:var(--bw,680px);aspect-ratio:772/447;flex:none;filter:drop-shadow(0 14px 20px rgba(0,0,0,.5))}
.cu-board>img{display:block;inline-size:100%;block-size:100%}
.cu-board--ph{--bw:368px}
.cu-ok,.cu-d,.cu-lead{position:absolute;box-sizing:border-box}
.cu-ok{border:2.5px dashed rgba(20,43,59,.65);border-radius:12px;background:rgba(232,166,66,.14)}
.cu-d{display:flex;align-items:center;justify-content:center;padding-block-start:10%}.cu-d img{inline-size:46%;block-size:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))}
.cu-d .bgv-avatar{position:absolute;inset-block-start:8%;inset-inline-end:8%;inline-size:22px;block-size:22px;font-size:11px}
.cu-lead{display:flex;align-items:flex-end;justify-content:center;padding-block-end:3px}.cu-lead{font-size:0}.cu-lead::before{content:'اول';font-size:11px;font-weight:800;color:#142B3B;background:var(--felt-gold);border-radius:999px;padding:0 8px;line-height:17px;transform:translateY(60%)}
.cu-lead::after{content:'';position:absolute;inset:0;border-radius:12px;box-shadow:inset 0 0 0 2.5px var(--felt-gold)}
.cu-pyr{position:absolute;left:59.5%;top:50.5%;transform:translateX(-50%);padding:2px 10px;border-radius:999px;background:rgba(20,43,59,.82);color:#FAF5EC;font-size:12px;font-weight:700;white-space:nowrap}
.cu-board--ph .cu-pyr{font-size:9.5px;padding:1px 6px}.cu-board--ph .cu-d .bgv-avatar{inline-size:13px;block-size:13px;font-size:7px}.cu-board--ph .cu-ok{border-width:1.5px;border-radius:6px}.cu-board--ph .cu-lead{font-size:8px}.cu-board--ph .cu-lead::after{border-radius:6px;box-shadow:inset 0 0 0 1.5px var(--felt-gold)}
.cu-coin{display:inline-flex;align-items:center;gap:3px}.cu-coin img{inline-size:20px;block-size:auto}.cu-coin b{color:var(--felt-ink);font-size:14px}.cx-pbar .cu-coin b{color:inherit}.cu-board--ph .cu-lead::before{font-size:8px;line-height:12px;padding:0 4px}
.cu-mini{display:inline-flex;gap:3px;align-items:center}.cu-mini img{inline-size:22px;block-size:auto;border-radius:3px}
.cu-me{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.cu-ctl{display:grid;grid-template-columns:auto auto auto auto;justify-content:space-between;gap:10px;inline-size:100%;padding:6px 10px 8px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.cu-ctl section{display:grid;gap:4px;align-content:start}.cu-ctl h4{margin:0;font-size:12px;font-weight:700;color:var(--felt-muted)}
.cu-legs{display:flex;gap:5px}
.cu-leg{all:unset;cursor:pointer;display:grid;justify-items:center;gap:1px}.cu-leg img{inline-size:50px;block-size:auto;filter:drop-shadow(0 3px 2px rgba(0,0,0,.45))}.cu-leg small{font-size:10.5px;color:var(--felt-muted)}
.cu-leg.is-hint img{outline:2.5px solid var(--felt-gold);outline-offset:1px;border-radius:7px}
.cu-act{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;align-content:center;gap:3px;min-inline-size:56px;block-size:62px;padding:4px 8px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23;font-size:12.5px}
.cu-act img{inline-size:34px;block-size:auto}.cu-act .bgv-icon{inline-size:22px;block-size:22px;color:#8D581A}
.cu-act--pyr img{inline-size:40px}
.cu-tile,.cu-fin{display:flex;gap:6px}
.cu-rank{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text-muted)}.cu-rank i{display:inline-flex}.cu-rank img{inline-size:40px;block-size:auto}
.cu-dice{display:inline-flex;gap:2px;vertical-align:middle}.cu-dice img{inline-size:18px;block-size:18px}
.cu-ctl--ph{display:grid;grid-template-columns:1fr;gap:6px;margin-inline:10px;inline-size:auto;padding:6px 8px}
.cu-ctl--ph .cu-legs{justify-content:center}.cu-ctl--ph .cu-leg img{inline-size:44px}
.cu-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cu-acts .cu-act{block-size:40px;grid-auto-flow:column;gap:4px;font-size:12px}.cu-acts .cu-act img{inline-size:20px}
.cu-st{position:absolute;box-sizing:border-box}
.cu-cm{position:absolute;left:50%;bottom:calc(14% + var(--k) * 22%);inline-size:56%;transform:translateX(-50%)}.cu-cm img{display:block;inline-size:100%;block-size:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.cu-mk{position:absolute;box-sizing:border-box;border-radius:12px;box-shadow:inset 0 0 0 3px var(--felt-gold),0 0 12px 2px rgba(232,166,66,.6);display:flex;align-items:flex-end;justify-content:center}
.cu-mk em{font-style:normal;font-size:11px;font-weight:800;color:#142B3B;background:var(--felt-gold);border-radius:999px;padding:0 8px;line-height:17px;transform:translateY(55%);white-space:nowrap}
.cu-legno{position:absolute;left:69.8%;top:43.4%;transform:translate(-50%,-50%);padding:2px 10px;border-radius:999px;background:#C99A57;color:#FFF8EC;font-size:12.5px;font-weight:800;white-space:nowrap}
.cu-board--ph .cu-legno{font-size:8.5px;padding:1px 5px}.cu-board--ph .cu-mk{border-radius:6px}.cu-board--ph .cu-mk em{font-size:8px;line-height:12px;padding:0 4px}
.cu-ccs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.cu-cc{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:4px;inline-size:82px;padding:8px 4px 6px;border-radius:var(--radius-md);background:var(--surface-sunken);font-size:12.5px;font-weight:700;color:var(--heading)}
.cu-cc img{inline-size:56px;block-size:auto}.cu-cc.is-sel{box-shadow:inset 0 0 0 3px var(--felt-gold)}.cu-cc.is-used{opacity:.45;filter:grayscale(.8)}
.cx-phone .cu-cc{inline-size:64px}.cx-phone .cu-cc img{inline-size:42px}
.cu-mv{display:flex;align-items:center;gap:8px;inline-size:100%;padding:6px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.cu-mv__t{display:grid;gap:2px;flex:1;font-size:14px}.cu-mv__t small{font-size:12px;color:var(--felt-muted)}
.cu-mv .cu-act{block-size:54px}.cu-act.is-on{box-shadow:inset 0 0 0 3px var(--felt-gold),0 3px 0 #0D1A23}
.cu-mv--ph{flex-wrap:wrap;margin-inline:10px;inline-size:auto}.cu-mv--ph .cu-mv__t{flex:1 1 100%}.cu-mv--ph .cu-act{block-size:44px;grid-auto-flow:column;flex:1}
.cu-piles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cu-pile{padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken)}.cu-pile h4{margin:0 0 6px;font-size:13.5px;color:var(--heading)}
.cu-pile ol{margin:0;padding:0;list-style:none;display:grid;gap:4px}.cu-pile li{display:flex;align-items:center;gap:6px;font-size:13px}.cu-pile li img{inline-size:28px;block-size:auto}.cu-pile li b{margin-inline-start:auto}
.cu-pile li.is-no{opacity:.65}`,
    shotTitle: 'نوبت شما', turnSub: 'یکی از چهار کار',
    diffs: [
      ['صفحه به جای دست', 'وسط میز مسیر آمادهٔ ۱۶ خانه با هرم وسطش؛ در این صحنه (مرحلهٔ ۱ پیش از اولین تاس) شترهای چاپی همان چیدمان آغازند. برای بقیهٔ حالت‌ها (§۴ به بعد) همان مسیر بی‌شتر چاپی است و شترهای آماده جدا روی خانه‌ها می‌نشینند'],
      ['چهار کار', 'بالای نوار شما چهار بخش کنار هم: کارت‌های رویی شرط مرحله با تعداد باقی‌مانده، کاشی واحه/سراب، تاس از هرم (+۱ سکه) و شرط نهایی برنده/بازنده'],
      ['کاشی بیابان', 'کاشی‌های گذاشته‌شده با آواتار صاحبشان روی خانه؛ خانه‌هایی که کاشی شما مجاز است خط‌چین‌اند (نه خانهٔ ۱، نه زیر شتر، نه کنار کاشی دیگران)'],
      ['ستون کنار', 'ترتیب فعلی شترها با تصویر آماده، تعداد شرط‌های نهایی (پنهان است که روی کدام شتر)، و شیوهٔ حساب مرحله'],
      ['چیپ حریف‌ها', 'سکه و کارت‌های شرط مرحله و کاشی هر نفر؛ تصویر سکهٔ آماده عدد ۱ دارد، پس تعداد کنار آن نوشته می‌شود'],
      ['قوانین', 'مثل موتور: نسخهٔ اول بی‌شتر دیوانه، ۲ تا ۸ نفر، ۳ سکهٔ شروع، شرط نهایی ۸، ۵، ۳، ۲، ۱ و جریمهٔ ۱ سکه'],
    ],
  };
}
