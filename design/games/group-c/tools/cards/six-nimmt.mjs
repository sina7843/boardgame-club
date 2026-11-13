// 6 nimmt! on the card-table frame (as the repo engine: 104 cards, 10 each, 4 rows, 6th card takes the row, 66 ends).
// Mock: 4 players, round 2, turn 4. Rows: A 12 18 25 33 41 (10 heads) · B 47 52 (2) · C 64 66 70 79 (10) · D 86 91 98 (3)
// = 14 cards (4 starters + 12 placed − 2 Sara took earlier this round, hidden). Revealed this turn: you 7, Niloufar 44,
// Reza 58, Sara 99. 7 is below every row → phase takeRow: you choose a row. Taking B (2 heads) leaves 41 as the
// highest end below 44, so 44 becomes the 6th card of row A and Niloufar takes 10. Your hand: 6 cards left.
// Totals after round 1: you 9, Niloufar 14, Reza 4, Sara 11.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const bh = (c) => (c === 55 ? 7 : c % 11 === 0 ? 5 : c % 10 === 0 ? 3 : c % 5 === 0 ? 2 : 1);
  const card = (n) => `six-nimmt-${String(n).padStart(3, '0')}`;
  const ROWS = [[12, 18, 25, 33, 41], [47, 52], [64, 66, 70, 79], [86, 91, 98]];
  const heads = (r) => r.reduce((a, c) => a + bh(c), 0);
  const row = (r, k) => `<div class="sn-row${k === 1 ? ' is-sel' : ''}${r.length === 5 ? ' is-full' : ''}" role="button" aria-label="ردیف ${fa(k + 1)}، ${fa(heads(r))} سر گاو">
<span class="sn-row__h"><b>${fa(heads(r))}</b><small>سر گاو</small></span>
<span class="sn-row__c">${Array.from({ length: 6 }, (_, i) => i < r.length ? `<span class="sn-c">${img(card(r[i]), fa(r[i]))}</span>` : `<span class="sn-c sn-slot">${img(i === 5 ? 'six-nimmt-last-slot' : 'six-nimmt-row-slot', i === 5 ? 'خانهٔ ششم' : '')}</span>`).join('')}</span>
${k === 1 ? `<span class="sn-pick">${img('six-nimmt-row-indicator', '')}برمی‌دارم</span>` : ''}</div>`;
  const reveal = (seat, name, n, me) => `<span class="sn-rv${me ? ' is-me' : ''}"><span class="sn-c">${img(card(n), fa(n))}</span><small><i style="background:var(--seat-${seat})"></i>${name}</small></span>`;
  const meta = (n, total) => `<span class="sn-mini">${img(card(n), fa(n))}</span><span>کارت این نوبت</span><span class="gc-tag gc-tag--soft">${fa(total)} سر</span>`;
  const myHand = [3, 29, 50, 61, 83, 102].map((n) => ({ art: card(n), alt: fa(n), dim: true }));
  const { modal } = H;
  const rowX = (r, k, o = {}) => `<div class="sn-row${r.length === 5 ? ' is-full' : ''}${o.taken ? ' is-taken' : ''}" aria-label="ردیف ${fa(k + 1)}، ${fa(heads(r))} سر گاو">
<span class="sn-row__h"><b>${fa(heads(r))}</b><small>سر گاو</small></span>
<span class="sn-row__c">${Array.from({ length: 6 }, (_, i) => i < r.length ? `<span class="sn-c${(o.fresh ?? []).includes(r[i]) ? ' is-fresh' : ''}">${img(card(r[i]), fa(r[i]))}</span>` : `<span class="sn-c sn-slot">${img(i === 5 ? 'six-nimmt-last-slot' : 'six-nimmt-row-slot', '')}</span>`).join('')}</span>${o.tag ? `<span class="sn-pick sn-pick--soft">${o.tag}</span>` : ''}</div>`;
  const R2 = [[44, 58], [7], [64, 66, 70, 79], [86, 91, 98, 99]];
  const chooseT = (ph) => `<div class="sn-board"><div class="sn-rows">${R2.map((r, k) => rowX(r, k)).join('')}</div><div class="sn-reveal"><small class="sn-reveal__t">انتخاب‌ها</small>${[['نیلوفر', 2, true], ['رضا', 6, true], ['سارا', 4, false], ['شما', 1, false]].map(([n, s, ok]) => `<span class="sn-rv"><span class="sn-c">${ok ? img('six-nimmt-row-slot', 'کارت انتخاب‌شده، پشت‌ورو') : '<span class="sn-wait">؟</span>'}</span><small><i style="background:var(--seat-${s})"></i>${n}</small></span>`).join('')}</div></div>`;
  const step = (n, i, seat, name, res) => `<span class="sn-rv sn-step"><b class="sn-ord">${fa(i)}</b><span class="sn-c">${img(card(n), fa(n))}</span><small><i style="background:var(--seat-${seat})"></i>${name}</small><em>${res}</em></span>`;
  const resolveT = (ph) => `<div class="sn-board"><div class="sn-rows">${rowX([44, 58, 61], 0, { fresh: [61] })}${rowX([7, 45], 1, { fresh: [45] })}${rowX([64, 66, 70, 79], 2)}${rowX([101], 3, { fresh: [101], tag: 'سارا برداشت' })}</div>
<div class="sn-reveal"><small class="sn-reveal__t">به ترتیب</small>${step(45, 1, 2, 'نیلوفر', 'ردیف ۲')}${step(61, 2, 1, 'شما', 'ردیف ۱')}${step(100, 3, 6, 'رضا', 'ردیف ۴، پنجمی')}${step(101, 4, 4, 'سارا', 'ششمی: ۱۱ سر')}</div></div>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const roundEnd = (ph) => modal('پایان دور ۲', `<p>همهٔ ده کارت بازی شد. سر گاوهای کارت‌هایی که هر کس برداشته به جمعش اضافه می‌شود.</p>${tbl(['بازیکن', 'این دور', 'جمع'], [{ c: ['رضا', `${fa(9)}+`, fa(13)], win: true }, { c: ['شما', `${fa(6)}+`, fa(15)] }, { c: ['سارا', `${fa(15)}+`, fa(26)] }, { c: ['نیلوفر', `${fa(13)}+`, fa(27)] }])}<p class="cx-note">کسی به ${fa(66)} نرسیده؛ دور ۳ با ده کارت تازه.</p>`, `${btn('دور بعد', 'primary', 'next')}`);
  const gameEnd = (ph) => modal('پایان بازی', `<p>سارا به ${fa(68)} سر گاو رسید و بازی تمام شد. کمترین سر گاو می‌برد.</p>${tbl(['رتبه', 'بازیکن', 'سر گاو'], [{ c: [fa(1), 'رضا', fa(41)], win: true }, { c: [fa(2), 'شما', fa(47)] }, { c: [fa(3), 'نیلوفر', fa(59)] }, { c: [fa(4), 'سارا', fa(68)] }])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const meta2 = (total, tag) => `<span>${tag}</span><span class="gc-tag gc-tag--soft">${fa(total)} سر</span>`;  return {
    slug: 'SixNimmt', fa: 'شیش قلو', latin: '6 nimmt!', meta: ['زنده', '۴ نفر', 'دور ۲', 'تا ۶۶ سر گاو'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: meta(44, 14) },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: meta(58, 4) },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: meta(99, 11) },
    ],
    me: { cards: myHand, clock: '0:18', turn: true, note: `${fa(6)} کارت<span class="bgv-sep"></span>جمع ${fa(9)} سر گاو` },
    cardW: 66, phoneCardW: 46, cardRatio: 1.545,
    table: (ph) => `<div class="sn-board"><div class="sn-rows">${ROWS.map(row).join('')}</div>
<div class="sn-reveal" aria-label="کارت‌های رو شدهٔ این نوبت، از کوچک به بزرگ"><small class="sn-reveal__t">این نوبت</small>${reveal(1, 'شما', 7, true)}${reveal(2, 'نیلوفر', 44)}${reveal(6, 'رضا', 58)}${reveal(4, 'سارا', 99)}</div></div>`,
    status: '<b>یک ردیف بردارید.</b> کارت ۷ شما از آخر همهٔ ردیف‌ها کوچک‌تر است. ردیفی را که برمی‌دارید انتخاب کنید؛ ۷ جای آن ردیف را می‌گیرد.',
    pstatus: '<b>یک ردیف بردارید.</b> ۷ از همه کوچک‌تر است.',
    railCard: `<section class="cx-card"><h3>کدام ردیف؟</h3><div class="gc-pills"><span class="bgv-chip">ردیف ۱: ${fa(10)} سر</span><span class="bgv-chip is-on">ردیف ۲: ${fa(2)} سر</span><span class="bgv-chip">ردیف ۳: ${fa(10)} سر</span><span class="bgv-chip">ردیف ۴: ${fa(3)} سر</span></div><div class="ga-rule">${ic('info')}<span>بعد از شما ۴۴ نیلوفر می‌آید. اگر ردیف ۲ را بردارید، ۴۴ ششمین کارت ردیف ۱ می‌شود و او ۱۰ سر گاو می‌گیرد.</span></div></section>`,
    logNote: 'دور ۲، نوبت ۴',
    log: [[1, 'همه کارتشان را انتخاب کردند'], [1, 'کارت‌ها رو شد: ۷، ۴۴، ۵۸، ۹۹'], [1, '۷ شما از همهٔ ردیف‌ها کوچک‌تر است'], [1, 'منتظر انتخاب ردیف شما']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${btn('برداشتن ردیف ۲', 'primary', 'check')}${btn('ترک', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
    dockItems: [['check', 'برداشتن'], ['list', 'رویدادها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'انتخاب کارت', turnSub: 'هم‌زمان؛ بعد از انتخاب عوض نمی‌شود', table: chooseT, phone: true,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: meta2(24, 'انتخاب کرد') },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: meta2(4, 'انتخاب کرد') },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:30', turn: true, meta: meta2(11, 'در فکر') },
        ],
        me: { cards: [3, 29, 50, 61, 83, 102].map((n) => ({ art: card(n), alt: fa(n), ok: true, sel: n === 61 })), above: (ph) => `<div class="sn-choose${ph ? ' sn-choose--ph' : ''}"><span>کارت انتخابی: <b>${fa(61)}</b>${ph ? '' : '<small>بعد از انتخاب عوض نمی‌شود؛ وقتی همه انتخاب کنند کارت‌ها با هم رو می‌شوند</small>'}</span>${btn(`انتخاب ${fa(61)}`, 'primary', 'check')}</div>`, note: `${fa(6)} کارت<span class="bgv-sep"></span>جمع ${fa(11)} سر گاو` },
        actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
        railCard: '',
        status: '<b>نوبت ۵: همه هم‌زمان یک کارت انتخاب می‌کنند.</b> نیلوفر و رضا انتخاب کرده‌اند. کارتتان را بزنید و «انتخاب» را بزنید.',
        pstatus: '<b>انتخاب هم‌زمان.</b> یک کارت.',
        log: [[1, 'شما ردیف ۲ را برداشتید (۲ سر)'], [2, 'نیلوفر با ۴۴ ردیف ۱ را برداشت (۱۰ سر)'], [1, 'نوبت ۵: انتخاب کارت']],
      },
      {
        shotTitle: 'رو شدن و چیدن', turnSub: 'از کوچک به بزرگ؛ چه کسی کدام ردیف را برداشت', table: resolveT,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '', meta: meta(45, 24) },
          { name: 'رضا', av: 'ر', seat: 6, clock: '', meta: meta(100, 4) },
          { name: 'سارا', av: 'س', seat: 4, clock: '', meta: meta(101, 22) },
        ],
        me: { turn: false, cards: [3, 29, 50, 83, 102].map((n) => ({ art: card(n), alt: fa(n), dim: true })), note: `${fa(5)} کارت<span class="bgv-sep"></span>جمع ${fa(11)} سر گاو` },
        actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
        railCard: '',
        status: '<b>کارت‌ها رو شد و به ترتیب چیده شد.</b> ۴۵ به ردیف ۲، ۶۱ به ردیف ۱ و ۱۰۰ پنجمین کارت ردیف ۴ شد؛ ۱۰۱ سارا ششمی بود و او ردیف ۴ را با ۱۱ سر گاو برداشت.',
        pstatus: '<b>سارا ردیف ۴ را برداشت</b> (۱۱ سر).',
        log: [[2, '۴۵ نیلوفر: ردیف ۲'], [1, '۶۱ شما: ردیف ۱'], [6, '۱۰۰ رضا: ردیف ۴'], [4, '۱۰۱ سارا ششمی بود؛ ردیف ۴ را برداشت (۱۱ سر)']],
      },
      {
        shotTitle: 'پایان دور', turnSub: 'سر گاوهای این دور', overlay: roundEnd,
        table: (ph) => `<div class="sn-board"><div class="sn-rows">${R2.map((r, k) => rowX(r, k)).join('')}</div></div>`,
        me: { turn: false, clock: '', cards: [] }, railCard: '',
        actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
        status: '<b>دور ۲ تمام شد.</b> شما ۶ سر گرفتید؛ جمع ۱۵.',
        log: [[1, 'دهمین کارت بازی شد'], [1, 'دور ۲: شما ۶ سر گاو']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'کسی به ۶۶ رسید', phone: true, phoneOnly: true, overlay: gameEnd, meta: ['تمام شد', '۴ نفر', 'دور ۵', 'تا ۶۶ سر گاو'],
        table: (ph) => `<div class="sn-board"></div>`,
        me: { turn: false, clock: '', cards: [] },
        pstatus: '<b>بازی تمام شد.</b> رضا با ۴۱ سر برد.', status: '',
      },
    ],    css: `.gc-card{margin-inline-start:calc(var(--cw) * -.22)}
.gc-card img{border-radius:5px}
.sn-mini img{inline-size:16px;border-radius:2px;display:block;box-shadow:0 1px 2px rgba(0,0,0,.4)}
.gc-seat__meta .gc-tag{block-size:20px;font-size:11.5px;padding-inline:7px;white-space:nowrap}
.gc-seat__meta>span{white-space:nowrap}
.sn-board{display:flex;gap:18px;align-items:center}
.sn-rows{display:grid;gap:8px}
.sn-row{position:relative;display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:10px;background:rgba(8,20,28,.28);box-shadow:inset 0 0 0 1px rgba(250,245,236,.1);cursor:pointer}
.sn-row.is-sel{background:rgba(232,166,66,.16);box-shadow:inset 0 0 0 2px var(--felt-gold)}
.sn-row__h{display:grid;justify-items:center;inline-size:46px;line-height:1.2;color:var(--felt-muted)}.sn-row__h b{font-size:20px;color:#F0AAA3}.sn-row__h small{font-size:10.5px}
.sn-row__c{direction:ltr;display:flex;gap:5px}
.sn-c img{display:block;inline-size:58px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.sn-slot img{opacity:.5;box-shadow:inset 0 0 0 1px rgba(250,245,236,.2)}
.sn-row.is-full .sn-slot img{opacity:1;outline:2px dashed #F0AAA3;outline-offset:-2px}
.sn-pick{position:absolute;inset-inline-end:-86px;display:flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;color:var(--felt-gold);white-space:nowrap}.sn-pick img{inline-size:20px;transform:scaleX(-1)}
.sn-row.is-taken{box-shadow:inset 0 0 0 2px #F0AAA3}.sn-pick--soft{background:#F0AAA3!important;color:#142B3B}
.sn-c.is-fresh img{box-shadow:0 0 0 2px var(--felt-gold)}
.sn-wait{display:grid;place-items:center;inline-size:46px;block-size:71px;border-radius:5px;border:1.5px dashed rgba(250,245,236,.35);color:var(--felt-muted)}
.sn-step{position:relative}.sn-ord{position:absolute;inset-block-start:-6px;inset-inline-start:-8px;display:grid;place-items:center;inline-size:18px;block-size:18px;border-radius:50%;background:var(--felt-gold);color:#142B3B;font-size:11px}
.sn-step em{font-style:normal;font-size:10.5px;color:var(--felt-gold);white-space:nowrap}
.sn-choose{display:flex;align-items:center;justify-content:center;gap:12px;inline-size:100%;color:var(--felt-ink);font-size:14px}.sn-choose>span{display:grid}.sn-choose small{font-size:12px;color:var(--felt-muted)}
.sn-choose--ph{padding-inline:10px;box-sizing:border-box;justify-content:space-between}
.cx-phone .sn-wait{inline-size:28px;block-size:43px}.cx-phone .sn-step em{font-size:8.5px}.sn-reveal{display:grid;gap:6px;justify-items:center;padding:8px 10px;border-radius:10px;background:rgba(8,20,28,.28);margin-inline-start:70px}
.sn-reveal__t{font-size:11.5px;color:var(--felt-muted)}
.sn-rv{display:grid;justify-items:center;gap:2px}.sn-rv .sn-c img{inline-size:46px}.sn-rv small{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--felt-muted)}.sn-rv small i{inline-size:8px;block-size:8px;border-radius:50%}
.sn-rv.is-me .sn-c img{box-shadow:0 0 0 3px var(--felt-gold)}.sn-rv.is-me small{color:var(--felt-gold);font-weight:700}
.bgv-chip.is-on{background:var(--felt-gold);color:#142B3B}
.cx-phone .sn-board{gap:6px}.cx-phone .sn-rows{gap:5px}.cx-phone .sn-row{gap:4px;padding:3px 4px}.cx-phone .sn-row__h{inline-size:26px}.cx-phone .sn-row__h b{font-size:15px}.cx-phone .sn-row__h small{display:none}
.cx-phone .sn-row__c{gap:3px}.cx-phone .sn-c img{inline-size:34px;border-radius:3px}.cx-phone .sn-pick{display:none}
.cx-phone .sn-reveal{margin:0;padding:4px;gap:3px}.cx-phone .sn-rv .sn-c img{inline-size:28px}.cx-phone .sn-rv small{font-size:9.5px}.cx-phone .sn-reveal__t{display:none}
.cx-phone .gc-card{margin-inline-start:calc(var(--cw) * -.3)}.cx-phone .gc-card:first-child,.gc-card:first-child{margin-inline-start:0}`,
    shotTitle: 'برداشتن ردیف', turnSub: 'کارت شما از همه کوچک‌تر است',
    diffs: [
      ['چیدمان', 'وسط میز چهار ردیف شش‌خانه‌ای (از چپ به راست، صعودی)؛ خانهٔ ششم با نشان گاو قرمز. کنار هر ردیف جمع سر گاوهایش'],
      ['انتخاب هم‌زمان', 'در مرحلهٔ انتخاب همه با هم یک کارت از دست برمی‌دارند؛ روی چیپ حریف فقط «انتخاب کرد» دیده می‌شود. بعد همه رو می‌شوند و ستون «این نوبت» از کوچک به بزرگ می‌چیند'],
      ['برداشتن ردیف', 'اگر کارت شما از آخر همهٔ ردیف‌ها کوچک‌تر باشد، ردیف‌ها قابل انتخاب می‌شوند و دست شما تا انتخاب کم‌رنگ می‌ماند'],
      ['ردیف پر', 'ردیفی که پنج کارت دارد خانهٔ ششمش خط‌چین قرمز می‌گیرد تا خطر دیده شود'],
      ['امتیاز', 'جمع سر گاوهای دورهای قبل روی چیپ‌ها؛ چیزی که در همین دور برداشته‌اند تا پایان دور پنهان است (مثل موتور)'],
      ['قوانین', 'مثل موتور: ۲ تا ۱۰ نفر، ۱۰ کارت برای هر نفر، بازی تا ۶۶ سر گاو (یا گزینهٔ یک دور)؛ کمترین سر گاو برنده است'],
    ],
  };
}
