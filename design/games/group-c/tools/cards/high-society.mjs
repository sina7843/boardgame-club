// High Society on the card-table frame (repo engine: 3–5 players + unofficial 2p; 16 status cards, 11 money cards each).
// Moment: the third red card (prestige) is up; Niloufar 8, Reza passed, Sara 10; you are raising with 4 + 8 = 12.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const st = (c, alt = '', cls = '') => img(`high-society-${c}`, alt, cls);
  const note = (v) => img(`high-society-money-${v}`, `اسکناس ${fa(v)}`);
  const won = (cs) => `<span class="hs-mini">${cs.map(([c, a]) => st(c, a)).join('')}</span>`;
  const notes = (n) => `<span class="hs-cnt">${fa(n)} اسکناس</span>`;
  const hand = [1, 2, 3, 4, 8, 10, 15, 20, 25].map((v) => ({ art: `high-society-money-${v}`, alt: `اسکناس ${fa(v)}`, sel: v === 4 || v === 8 }));
  const bidRow = (who, seat, cells, tag = '', cls = '') => `<li class="${cls}"><i style="background:var(--seat-${seat})"></i><span class="hs-who">${who}</span><span class="hs-notes">${cells}</span>${tag}</li>`;
  const bids = (ph) => `<ul class="hs-bids" aria-label="پیشنهادهای این مزایده">
${bidRow('سارا', 4, note(10), `<b class="hs-sum">${fa(10)}</b><span class="gc-tag">بالاترین</span>`, 'is-high')}
${bidRow('نیلوفر', 2, note(8), `<b class="hs-sum">${fa(8)}</b>`)}
${bidRow('رضا', 6, '', '<span class="gc-tag gc-tag--soft">کنار کشید</span>', 'is-pass')}
${bidRow('شما', 1, `${note(4)}${note(8)}`, `<b class="hs-sum">${fa(12)}</b>${ph ? '' : '<span class="hs-pend">انتخاب‌شده</span>'}`, 'is-me')}</ul>`;
  const reds = `<div class="hs-red" aria-label="کارت‌های قاب‌قرمز: ${fa(3)} از ${fa(4)}">
<div class="hs-red__slots">${st('prestige', 'افتخار (نیلوفر)')}${st('scandal', 'رسوایی (رضا)')}${st('prestige', 'افتخار (در مزایده)', 'is-now')}<span class="hs-red__empty">${fa(4)}</span></div>
<span><b>قاب قرمز: ${fa(3)} از ${fa(4)}</b>؛ چهارمی بازی را تمام می‌کند</span></div>`;
  const table = (ph) => `${ph ? '' : `<div class="hs-deck" aria-label="دستهٔ کارت‌های اعتبار"><b>${fa(7)}</b><span>کارت مانده</span></div>`}
<div class="hs-lot"><div class="hs-easel">${st('prestige', 'در مزایده: افتخار')}</div><span>در مزایده: <b>افتخار</b> (امتیاز ×${fa(2)})${ph ? `، دسته: ${fa(7)}` : ''}</span></div>
<div class="hs-side">${reds}${bids(ph)}</div>`;
  const bidbar = (ph) => `<div class="hs-bidbar${ph ? ' hs-bidbar--ph' : ''}"><span class="hs-bidbar__sum">پیشنهاد شما: <b>${fa(4)} + ${fa(8)} = ${fa(12)}</b>${ph ? '' : `<small>باید بیشتر از ${fa(10)} باشد</small>`}</span>${btn(`پیشنهاد ${fa(12)}`, 'primary', 'check')}${btn('کنار می‌کشم', 'secondary', 'x')}</div>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const badTable = (ph) => `${ph ? '' : `<div class="hs-deck"><b>${fa(6)}</b><span>کارت مانده</span></div>`}
<div class="hs-lot"><div class="hs-easel hs-easel--bad">${st('faux', 'در مزایده: گاف')}</div><span>کارت بد: <b>گاف</b>${ph ? '' : '؛ اولین کسی که کنار بکشد می‌گیردش'}</span></div>
<div class="hs-side"><ul class="hs-bids" aria-label="پیشنهادها">${bidRow('نیلوفر', 2, note(3), `<b class="hs-sum">${fa(3)}</b>`)}${bidRow('رضا', 6, note(4), `<b class="hs-sum">${fa(4)}</b>`)}${bidRow('سارا', 4, `${note(2)}${note(3)}`, `<b class="hs-sum">${fa(5)}</b><span class="gc-tag">بالاترین</span>`, 'is-high')}${bidRow('شما', 1, note(1), `<b class="hs-sum">${fa(1)}</b>`, 'is-me')}</ul></div>`;
  const badBar = (ph) => `<div class="hs-bidbar${ph ? ' hs-bidbar--ph' : ''}"><span class="hs-bidbar__sum">${ph ? 'گاف را نمی‌خواهید؟ بیشتر بدهید' : 'یا بیشتر از ۵ بدهید تا گاف به دیگری برسد، یا کنار بکشید و گاف را بگیرید'}<small>اگر کنار بکشید ${fa(1)} اسکناستان برمی‌گردد و بقیه پیشنهادشان را می‌پردازند؛ اگر وقتتان تمام شود هم همین می‌شود</small></span>${btn(`پیشنهاد ${fa(6)}`, 'secondary', 'check')}${btn(ph ? 'کنار و گرفتن گاف' : 'کنار می‌کشم و گاف را می‌گیرم', 'primary', 'x')}</div>`;
  const discard = (ph) => modal('گاف: یک کارت تجملی را دور بریزید', `<p>گاف را گرفتید. یکی از کارت‌های تجملی خودتان را انتخاب کنید که دور ریخته شود.</p><div class="hs-pick">${[['l5', 'شامپاین (۵)', true], ['l7', 'پیانو (۷)', false]].map(([c, a, s]) => `<button type="button" class="hs-pc${s ? ' is-sel' : ''}">${st(c, a)}<small>${a}</small></button>`).join('')}</div><p class="cx-note">اگر کارت تجملی نداشتید، اولین کارت تجملی‌ای که بعداً می‌بردید دور ریخته می‌شد.</p>`, `${btn('دور ریختن شامپاین', 'primary', 'check')}`);
  const result = (ph) => modal('نتیجهٔ مزایده', `<div class="hs-res">${st('faux', 'گاف')}<div><p><b>شما</b> اول کنار کشیدید و گاف را گرفتید؛ ${fa(1)} اسکناستان برگشت. <b>شامپاین</b> شما دور ریخته شد.</p><p>نیلوفر ${fa(3)}، رضا ${fa(4)} و سارا ${fa(5)} پرداختند و این پول از بازی بیرون رفت.</p></div></div>`, `${btn('ادامه', 'primary', 'check')}`);
  const ending = (ph) => modal('پایان بازی', `<p>چهارمین کارت قاب‌قرمز رو شد و بازی تمام شد. پول همه رو می‌شود: <b>رضا کم‌پول‌ترین است و کنار می‌رود</b>، هر چقدر منزلت داشته باشد.</p>
${tbl(['رتبه', 'بازیکن', 'پول مانده', 'تجملی', 'افتخار / رسوایی', 'منزلت'], [
      { c: [fa(1), 'شما', fa(46), `${fa(7)}+${fa(4)} = ${fa(11)}`, `افتخار ×${fa(2)}`, fa(22)], win: true },
      { c: [fa(2), 'نیلوفر', fa(38), `${fa(3)}+${fa(8)} = ${fa(11)}`, `افتخار ×${fa(2)}`, fa(22)] },
      { c: [fa(3), 'سارا', fa(52), `${fa(6)}+${fa(1)}+${fa(10)}، از مد افتاده ${fa(5)}−`, '—', fa(12)] },
      { c: ['—', 'رضا', fa(31), `${fa(9)}`, `رسوایی ÷${fa(2)}`, 'کنار رفت'] },
    ])}<p class="cx-note">شما و نیلوفر هر دو ${fa(22)} منزلت دارید؛ در تساوی پول بیشتر می‌برد (${fa(46)} در برابر ${fa(38)}).</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'HighSociety', fa: 'طبقه اشرافی', latin: 'High Society', meta: ['زنده', '۴ نفر', '۴۵ ثانیه هر نوبت'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${won([['prestige', 'افتخار'], ['l3', 'دستکش']])}${notes(7)}<span class="gc-tag gc-tag--soft">${fa(8)}</span>` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:45', meta: `${won([['l9', 'قایق'], ['scandal', 'رسوایی']])}${notes(9)}<span class="gc-tag gc-tag--soft">کنار کشید</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${won([['l6', 'تابلو'], ['l1', 'گلاب‌پاش']])}${notes(8)}<span class="gc-tag">${fa(10)}</span>` },
    ],
    me: { cards: hand, clock: '0:31', turn: true, note: `<span class="cx-note">${fa(9)} اسکناس، ${fa(88)}</span>`, above: (ph) => bidbar(ph) },
    cardW: 84, phoneCardW: 50, cardRatio: 0.7,
    table,
    status: `<b>نوبت شماست.</b> سارا ${fa(10)} داده؛ با اسکناس‌هایتان بیشتر بدهید یا کنار بکشید. افتخار سومین کارت قاب‌قرمز است.`,
    pstatus: `<b>نوبت شما.</b> بیشتر از ${fa(10)} بدهید یا کنار بکشید.`,
    railCard: `<section class="cx-card"><h3>مجموعهٔ شما</h3><div class="hs-mine">${st('l5', 'شامپاین')}${st('l7', 'پیانو')}</div><div class="gc-pills"><span class="bgv-chip">منزلت: ${fa(12)}</span><span class="bgv-chip">پول در دست: ${fa(88)}</span><span class="bgv-chip">خرج‌شده: ${fa(18)}</span></div><div class="ga-rule">${ic('info')}<span>آخر بازی کم‌پول‌ترین بازیکن کنار می‌رود، هر چقدر هم منزلت داشته باشد. خرج‌ها پیداست: نیلوفر ${fa(28)}، رضا ${fa(22)}، سارا ${fa(16)}.</span></div></section>`,
    logNote: `کارت ${fa(9)} از ${fa(16)}`,
    log: [[2, 'نیلوفر «دستکش» (۳) را با ۳ برد'], [2, '«افتخار» رو شد؛ نیلوفر ۸ پیشنهاد داد'], [6, 'رضا کنار کشید و پولش برگشت'], [4, 'سارا ۱۰ پیشنهاد داد'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['eye', 'مجموعه‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'مزایدهٔ کارت بد', turnSub: 'اولین کسی که کنار بکشد کارت را می‌گیرد', phone: true,
        table: badTable,
        me: { cards: hand.map((h) => ({ ...h, sel: false })), above: badBar },
        status: '<b>کارت بد: گاف.</b> مزایده برعکس است؛ اولین کسی که کنار بکشد گاف را می‌گیرد و پولش برمی‌گردد، بقیه پیشنهادشان را می‌پردازند.',
        pstatus: '<b>گاف در مزایده.</b> بیشتر بدهید یا بگیریدش.',
        log: [[4, '«گاف» رو شد'], [2, 'نیلوفر ۳ داد'], [6, 'رضا ۴ داد'], [4, 'سارا ۵ داد'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'انتخاب کارت برای دور ریختن', turnSub: 'گاف: یک تجملی به انتخاب خودتان', overlay: discard,
        table: (ph) => `<div class="hs-lot"><div class="hs-easel hs-easel--bad">${st('faux', 'گاف')}</div></div>`,
        me: { cards: hand.map((h) => ({ ...h, sel: false })), above: () => '' },
        status: '<b>گاف را گرفتید.</b> یکی از کارت‌های تجملی‌تان را برای دور ریختن انتخاب کنید.',
        log: [[1, 'شما کنار کشیدید و گاف را گرفتید']],
      },
      {
        shotTitle: 'نتیجهٔ مزایده', turnSub: 'چه کسی برد، چه پرداخت، چه دور ریخته شد', phone: true, phoneOnly: true, overlay: result,
        table: (ph) => `<div class="hs-lot"><div class="hs-easel hs-easel--bad">${st('faux', 'گاف')}</div></div>`,
        me: { turn: false, cards: hand.map((h) => ({ ...h, sel: false })), above: () => '' },
        pstatus: '<b>مزایده تمام شد.</b> گاف به شما رسید.', status: '',
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'کم‌پول‌ترین کنار می‌رود؛ منزلت و تساوی', overlay: ending,
        table: (ph) => `<div class="hs-red"><div class="hs-red__slots">${st('prestige', 'افتخار')}${st('scandal', 'رسوایی')}${st('prestige', 'افتخار')}${st('passe', 'از مد افتاده', 'is-now')}</div></div>`,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `${won([['prestige', 'افتخار'], ['l3', 'دستکش'], ['l8', 'کالسکه']])}<span class="gc-tag gc-tag--soft">${fa(38)}</span>` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${won([['l9', 'قایق'], ['scandal', 'رسوایی']])}<span class="gc-tag gc-tag--soft">کنار رفت</span>` },
          { name: 'سارا', av: 'س', seat: 4, meta: `${won([['l6', 'تابلو'], ['l1', 'گلاب‌پاش'], ['l10', 'جواهر'], ['passe', 'از مد افتاده']])}<span class="gc-tag gc-tag--soft">${fa(52)}</span>` },
        ],
        me: { cards: [], turn: false, clock: '', above: () => '', note: `<span class="cx-note">${fa(46)} پول</span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> رضا کم‌پول‌ترین بود و کنار رفت؛ شما با تساوی‌شکن پول بردید.',
        log: [[4, 'سارا «از مد افتاده» را گرفت'], [1, 'چهارمین کارت قاب‌قرمز: پایان'], [1, 'شما بردید']],
      },
    ],    css: `.hs-mini{display:inline-flex}.hs-mini img{inline-size:17px;border-radius:2px;margin-inline-start:-5px;box-shadow:0 1px 2px rgba(0,0,0,.45)}.hs-mini img:first-child{margin-inline-start:0}
.hs-cnt{white-space:nowrap}
.hs-deck{display:grid;justify-items:center;align-content:center;gap:2px;inline-size:84px;block-size:112px;border-radius:8px;box-shadow:inset 0 0 0 2px rgba(250,245,236,.22);color:var(--felt-muted);font-size:12.5px}.hs-deck b{font-size:28px;color:var(--felt-ink)}
.hs-lot{display:grid;justify-items:center;gap:10px;color:var(--felt-muted);font-size:13.5px}.hs-lot b{color:var(--felt-ink)}
.hs-easel{padding:12px 14px 16px;border-radius:12px;background:radial-gradient(ellipse at 50% 30%,rgba(232,166,66,.28),rgba(232,166,66,.04) 70%);box-shadow:inset 0 0 0 1.5px rgba(232,166,66,.55)}
.hs-easel img{display:block;inline-size:196px;border-radius:8px;box-shadow:0 14px 24px -12px rgba(0,0,0,.8)}
.hs-side{display:grid;gap:18px;inline-size:300px}
.hs-red{display:grid;gap:6px;color:var(--felt-muted);font-size:12.5px}.hs-red b{color:#F4B9B2}
.hs-red__slots{display:flex;gap:6px;align-items:center}
.hs-red__slots img,.hs-red__empty{inline-size:50px;block-size:66px;border-radius:4px;box-sizing:border-box}
.hs-red__slots img{box-shadow:0 2px 4px rgba(0,0,0,.45);filter:saturate(.7) brightness(.8)}
.hs-red__slots img.is-now{filter:none;box-shadow:0 0 0 2px var(--felt-gold),0 2px 4px rgba(0,0,0,.45)}
.hs-red__empty{display:grid;place-items:center;border:1.5px dashed rgba(240,170,163,.7);color:#F0AAA3;font-weight:700;font-size:15px}
.hs-bids{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.hs-bids li{display:flex;align-items:center;gap:8px;min-block-size:42px;padding:3px 10px;border-radius:8px;background:rgba(250,245,236,.06);color:var(--felt-ink);font-size:13.5px}
.hs-bids li>i{flex:none;inline-size:9px;block-size:9px;border-radius:50%}
.hs-bids li.is-high{box-shadow:inset 0 0 0 1.5px var(--felt-gold)}
.hs-bids li.is-pass{color:var(--felt-muted)}
.hs-bids li.is-me{background:rgba(232,166,66,.14);outline:1.5px dashed var(--felt-gold);outline-offset:-1.5px}
.hs-who{inline-size:48px;font-weight:700}
.hs-notes{display:inline-flex;gap:3px;flex:1}.hs-notes img{inline-size:48px;display:block}
.hs-sum{font-size:15px;min-inline-size:22px;text-align:center}
.hs-pend{font-size:11.5px;color:var(--felt-gold)}
.hs-bidbar{display:flex;align-items:center;gap:10px;inline-size:100%;justify-content:center}
.hs-bidbar__sum{display:grid;color:var(--felt-ink);font-size:14px;margin-inline-end:6px}.hs-bidbar__sum small{color:var(--felt-muted);font-size:12px}
.hs-bidbar--ph{padding-inline:10px;box-sizing:border-box;gap:6px}.hs-bidbar--ph .hs-bidbar__sum{font-size:12.5px;margin:0;flex:1}.hs-bidbar--ph .bgv-btn{padding-inline:10px;font-size:13px}
.hs-mine{display:flex;gap:8px}.hs-mine img{inline-size:64px;border-radius:5px;box-shadow:var(--shadow-card)}
.gc-hand .gc-card img,.gc-hand .gc-card.is-sel img{box-shadow:none;border-radius:0;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.gc-hand .gc-card.is-sel img{filter:drop-shadow(0 0 1.5px #FAF5EC) drop-shadow(0 0 1.5px #FAF5EC) drop-shadow(0 0 4px #E8A642) drop-shadow(0 6px 6px rgba(0,0,0,.5))}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:6px;font-size:11.5px}
.cx-phone .gc-table{flex-wrap:wrap;align-content:center;gap:10px 12px;padding-inline:10px;box-sizing:border-box}
.cx-phone .hs-easel{padding:6px 8px 8px}.cx-phone .hs-easel img{inline-size:120px}
.cx-phone .hs-lot{font-size:12px;gap:6px}
.cx-phone .hs-side{inline-size:auto;flex:1;min-inline-size:0;gap:10px}
.cx-phone .hs-red__slots img,.cx-phone .hs-red__empty{inline-size:30px;block-size:40px}
.cx-phone .hs-red{font-size:11.5px}
.cx-phone .hs-bids li{min-block-size:30px;padding:2px 8px;font-size:12.5px;gap:6px}
.cx-phone .hs-who{inline-size:40px}.cx-phone .hs-notes img{inline-size:30px}
.hs-easel--bad{background:radial-gradient(ellipse at 50% 30%,rgba(240,170,163,.28),rgba(240,170,163,.04) 70%);box-shadow:inset 0 0 0 1.5px rgba(240,170,163,.6)}
.hs-bidbar__sum{max-inline-size:340px}
.hs-pick{display:flex;gap:12px;justify-content:center}.hs-pc{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:4px;padding:6px;border-radius:var(--radius-md);background:var(--surface-sunken);font-size:12.5px;font-weight:700}
.hs-pc img{inline-size:96px;border-radius:6px}.hs-pc.is-sel{box-shadow:inset 0 0 0 3px var(--felt-gold)}
.hs-res{display:flex;gap:12px;align-items:center}.hs-res>img{inline-size:80px;border-radius:6px}.hs-res>div{display:grid;gap:6px}
.cx-phone .hs-pc img{inline-size:70px}.cx-phone .hs-res>img{inline-size:56px}`,
    shotTitle: 'نوبت شما', turnSub: 'پیشنهاد روی کارت افتخار',
    diffs: [
      ['چیدمان', 'وسط میز کارتِ در مزایده روی پایه، کنارش چهار جای کارت قاب‌قرمز و فهرست پیشنهادهای همین مزایده؛ دست شما اسکناس‌هاست، نه کارت'],
      ['پیشنهاد دادن', 'اسکناس‌ها را انتخاب می‌کنید و بالا می‌آیند؛ جمعشان بالای دست با دکمهٔ «پیشنهاد ۱۲» دیده می‌شود. تا جمع از بالاترین پیشنهاد بیشتر نشود دکمه غیرفعال است؛ اسکناس خرد نمی‌شود'],
      ['کنار کشیدن', 'برچسب «کنار کشید» روی صندلی و در فهرست پیشنهادها؛ پولش برگشته. در کارت بد (از مد افتاده، رسوایی، گاف) برعکس است و دکمه می‌شود «کنار می‌کشم و کارت را می‌گیرم»'],
      ['پایان بازی', 'چهار جای قاب‌قرمز (سه افتخار و رسوایی)؛ هر کدام رو شود پر می‌شود. وقتی سه تا پر است یعنی کارت قرمز بعدی بازی را همان لحظه تمام می‌کند'],
      ['پول', 'پول خرج‌شدهٔ همه عمومی است و در کارت ستون کنار جمع زده شده تا معلوم باشد چه کسی در خطر کم‌پول‌ترین شدن است. دستهٔ رونشده فقط عدد است؛ بسته عمداً تصویر پشت کارت ندارد'],
      ['قوانین', '۳ تا ۵ نفر و دونفرهٔ غیررسمی مثل موتور؛ اگر زمان نوبت تمام شود به جای شما کنار کشیده می‌شود'],
    ],
  };
}
