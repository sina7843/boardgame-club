// The Crew: Mission Deep Sea on the card-table frame (cooperative trick-taking; same trick core as Planet Nine).
// Engine: tasks are conditions with a difficulty (1–3); they are revealed until the sum reaches the mission target
// (3/5/7/9/11), then drafted from the commander. Mock: 4 players, target 7 → firstTrick (1) + noNines (2) +
// lastTrick (2) + tricksExact n=1 (3) = 8. Owners: Niloufar «first trick» (done), you «no 9», Reza «last trick»,
// Sara «exactly 1 trick». Reza holds submarine 4 → commander. Trick 1 won by Niloufar, trick 2 by Reza → he leads
// trick 3: yellow 9, Sara yellow 4, now you (8 cards: y3 y7 p2 p8 b1 b6 g5 sub2). Following yellow keeps the 9 away
// from you; the submarine would win it and fail your task. Niloufar communicated green 9 as her only green.
// Printed task art matching each engine condition: 21 first trick, 14 no 9, 24 last trick, 28 exactly 1 trick.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const SF = { p: 'صورتی', b: 'آبی', g: 'سبز', y: 'زرد', r: 'زیردریایی' };
  const c = (id) => `crew-deep-sea-${id}`;
  const alt = (id) => `${SF[id[0]]} ${fa(Number(id.slice(1)))}`;
  const radio = (state) => img(`crew-deep-sea-radio-${state}`, state === 'used' ? 'ارتباط استفاده شده' : 'ارتباط در دسترس', 'cw-radio');
  const task = (n, label, owner, seat, diff, o = {}) => `<span class="cw-task${seat === 1 ? ' is-mine' : ''}${o.done ? ' is-done' : ''}"><span class="cw-task__c">${img(c(`task-${n}`), label)}<b class="ds-diff" aria-label="سختی ${fa(diff)}">${fa(diff)}</b>${o.done ? `<span class="ds-done">${ic('check')}</span>` : ''}</span><small><i style="background:var(--seat-${seat})"></i>${owner}</small><em>${label}</em></span>`;
  const played = (id, who, seat, o = {}) => `<span class="cw-play${o.warn ? ' is-warn' : ''}">${id ? img(c(id), alt(id)) : '<span class="cw-slot">شما</span>'}<small><i style="background:var(--seat-${seat})"></i>${who}${o.lead ? '<span class="bgv-sep"></span>شروع' : ''}</small></span>`;
  const hand = ['y3', 'y7', 'p2', 'p8', 'b1', 'b6', 'g5', 'r2'].map((id) => ({ art: c(id), alt: alt(id), sel: id === 'y3', ok: id === 'y7', dim: id[0] !== 'y' }));
  const { modal } = H;
  const freeT = (n, label, diff, o = {}) => `<span class="cw-task${o.sel ? ' is-mine' : ''}${o.taken ? ' is-taken' : ''}"><span class="cw-task__c">${img(c(`task-${n}`), label)}<b class="ds-diff" aria-label="سختی ${fa(diff)}">${fa(diff)}</b></span><small>${o.taken ? `<i style="background:var(--seat-${o.taken[1]})"></i>${o.taken[0]}` : o.sel ? 'انتخاب شما' : 'آزاد'}</small><em>${label}</em></span>`;
  const tasksNow = `${task(21, 'دست اول را ببرد', 'نیلوفر', 2, 1, { done: true })}${task(14, 'هیچ ۹ نبرد', 'شما', 1, 2)}${task(24, 'دست آخر را ببرد', 'رضا', 6, 2)}${task(28, 'دقیقاً ۱ دست ببرد', 'سارا', 4, 3)}`;
  const draft = (ph) => `<div class="cw-board"><div class="ds-head"><span>وظیفه‌های رو شده</span><b>جمع سختی ${fa(8)}</b><span>هدف ${fa(7)}</span></div>
<div class="cw-tasks">${freeT(24, 'دست آخر را ببرد', 2, { taken: ['رضا', 6] })}${freeT(14, 'هیچ ۹ نبرد', 2, { sel: true })}${freeT(21, 'دست اول را ببرد', 1)}${freeT(28, 'دقیقاً ۱ دست ببرد', 3)}</div>
<p class="ds-hint">${ph ? 'نوبت شما: یک وظیفه' : 'وظیفه‌ها رو شدند تا جمع سختی به ۷ رسید (۸ شد). رضا (فرمانده) اول برداشت؛ حالا شما، بعد نیلوفر و سارا'}</p></div>`;
  const handIds = ['y3', 'y7', 'p2', 'p8', 'b1', 'b6', 'g5', 'r2'];
  const lab = { y3: 'پایین‌ترین', y7: 'بالاترین', p2: 'پایین‌ترین', p8: 'بالاترین', b1: 'پایین‌ترین', b6: 'بالاترین', g5: 'تنها', r2: 'زیردریایی نه' };
  const comm = (ph) => modal('ارتباط: یک کارت را نشان دهید', `<p>یک بار در ماموریت، پیش از شروع یک دست، یک کارت رنگی را رو کنید؛ نشان رادیو می‌گوید بالاترین، پایین‌ترین یا تنها کارت آن رنگ است. زیردریایی را نمی‌شود نشان داد.</p><div class="cw-comms">${handIds.map((id) => `<button type="button" class="cw-cm${id === 'g5' ? ' is-sel' : ''}"${id[0] === 'r' ? ' disabled' : ''}>${img(c(id), alt(id))}<small>${lab[id]}</small></button>`).join('')}</div>`, `${btn('لغو', 'secondary', 'x')}${btn('نشان دادن سبز ۵: تنها', 'primary', 'zap')}`);
  const distress = (ph) => modal('علامت خطر', `<p>پیش از اولین دست، هر نفر <b>یک کارت</b> (نه زیردریایی) به همسایه‌اش در یک جهت می‌دهد. فرمانده جهت را <b>به راست</b> گذاشت: شما به سارا می‌دهید و از نیلوفر می‌گیرید.</p><div class="cw-comms">${handIds.map((id) => `<button type="button" class="cw-cm${id === 'p8' ? ' is-sel' : ''}"${id[0] === 'r' ? ' disabled' : ''}>${img(c(id), alt(id))}</button>`).join('')}</div>`, `${btn('دادن صورتی ۸ به سارا', 'primary', 'check')}`);
  const win = (ph) => modal('ماموریت موفق شد', `<p>همهٔ وظیفه‌ها انجام شد.</p><table class="gd-score"><thead><tr><th>وظیفه</th><th class="n">صاحب</th><th class="n">سختی</th><th class="n">وضع</th></tr></thead><tbody><tr class="is-win"><td>دست اول را ببرد</td><td class="n">نیلوفر</td><td class="n">${fa(1)}</td><td class="n">دست ${fa(1)}</td></tr><tr class="is-win"><td>هیچ ۹ نبرد</td><td class="n">شما</td><td class="n">${fa(2)}</td><td class="n">تا آخر</td></tr><tr class="is-win"><td>دقیقاً ۱ دست ببرد</td><td class="n">سارا</td><td class="n">${fa(3)}</td><td class="n">دست ${fa(6)}</td></tr><tr class="is-win"><td>دست آخر را ببرد</td><td class="n">رضا</td><td class="n">${fa(2)}</td><td class="n">دست ${fa(10)}</td></tr></tbody></table>`, `${btn('ترک میز', 'secondary', 'flag')}${btn('ماموریت بعد: سختی ۹', 'primary', 'next')}`);
  const fail = (ph) => modal('ماموریت شکست خورد', `<p>وظیفهٔ <b>شما</b> «هیچ ۹ نبرد» بود، ولی در دست ${fa(3)} زیردریایی شما زرد ۹ را برد. ماموریت همان لحظه برای همه تمام شد.</p>`, `${btn('ترک میز', 'secondary', 'flag')}${btn('دوباره همین ماموریت', 'primary', 'repeat')}`);  return {
    slug: 'CrewDeepSea', fa: 'کرو: اعماق دریا', latin: 'The Crew: Deep Sea', meta: ['زنده', '۴ نفر', 'همکاری', 'سختی ۷'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `<span class="cw-comm">${img(c('g9'), 'سبز ۹')}<b>تنها</b></span><span>برده ${fa(1)}</span>${radio('used')}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `<span>${fa(7)} کارت<span class="bgv-sep"></span>برده ${fa(1)}</span><span class="gc-tag">فرمانده</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `<span>${fa(7)} کارت<span class="bgv-sep"></span>برده ${fa(0)}</span>${radio('available')}` },
    ],
    me: { cards: hand, clock: '0:39', turn: true, note: `${fa(8)} کارت<span class="bgv-sep"></span>برده ${fa(0)}<span class="bgv-sep"></span>ارتباط در دسترس` },
    cardW: 66, phoneCardW: 40, cardRatio: 1.57,
    table: (ph) => `<div class="cw-board">
<div class="ds-head"><span>وظیفه‌ها</span><b>سختی ${fa(8)}</b><span>هدف ماموریت ${fa(7)}</span></div>
<div class="cw-tasks" aria-label="وظیفه‌ها">${task(21, 'دست اول را ببرد', 'نیلوفر', 2, 1, { done: true })}${task(14, 'هیچ ۹ نبرد', 'شما', 1, 2)}${task(24, 'دست آخر را ببرد', 'رضا', 6, 2)}${task(28, 'دقیقاً ۱ دست ببرد', 'سارا', 4, 3)}</div>
<div class="cw-trick" aria-label="دست سوم">${played('y9', 'رضا', 6, { lead: true, warn: true })}${played('y4', 'سارا', 4)}${played(null, 'شما', 1)}</div></div>`,
    status: '<b>بازی گروهی؛ نوبت شماست.</b> رضا زرد ۹ زده و وظیفهٔ شما «هیچ ۹ نبرید» است. زرد بازی کنید تا ۹ به شما نرسد؛ زیردریایی آن را برای شما می‌برد.',
    pstatus: '<b>نوبت شما.</b> زرد بزنید؛ ۹ را نبرید.',
    railCard: `<section class="cx-card"><h3>وظیفه‌ها<span class="bgv-sep"></span>سختی ${fa(8)}</h3><div class="cw-list">
<p><span class="cw-dot" style="background:var(--seat-2)"></span><b>نیلوفر: دست اول</b><small>انجام شد</small></p>
<p><span class="cw-dot" style="background:var(--seat-1)"></span><b>شما: هیچ ۹ نبرید</b><small>تا آخر</small></p>
<p><span class="cw-dot" style="background:var(--seat-6)"></span><b>رضا: دست آخر</b><small>باز</small></p>
<p><span class="cw-dot" style="background:var(--seat-4)"></span><b>سارا: دقیقاً ۱ دست</b><small>باز</small></p></div>
<div class="ga-rule">${ic('info')}<span>وظیفه‌ها آن‌قدر رو می‌شوند که جمع سختی‌شان به هدف برسد، بعد از فرمانده به ترتیب انتخاب می‌شوند. هر وظیفه‌ای شکست بخورد، ماموریت برای همه شکست می‌خورد.</span></div></section>`,
    logNote: 'دست ۳ از ۱۰',
    log: [[2, 'نیلوفر دست اول را برد؛ وظیفه‌اش انجام شد'], [2, 'نیلوفر نشان داد: سبز ۹ تنها سبز اوست'], [6, 'رضا دست ۲ را برد'], [6, 'رضا زرد ۹ را شروع کرد'], [4, 'سارا زرد ۴'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ارتباط (بین دو دست)', 'secondary', 'zap', ' disabled')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('flag', 'ترک میز', 'secondary')}</div>`,
    dockItems: [['zap', 'ارتباط'], ['list', 'وظیفه‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    chat: [['sys', 'ماموریت با سختی ۷ شروع شد. ۴ نفر سر میزند'], ['sys', 'در کرو حرف زدن دربارهٔ کارت‌ها ممنوع است؛ فقط ارتباط رسمی']],
    phases: [
      {
        shotTitle: 'انتخاب وظیفه', turnSub: 'سختی هر وظیفه و جمع؛ فرمانده اول، بعد ساعتگرد', table: draft,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: false, dim: false })), note: `دست تازه` },
        status: '<b>انتخاب وظیفه‌ها.</b> چهار وظیفه با جمع سختی ۸ رو شد. رضا فرمانده است و «دست آخر» را برداشت؛ نوبت شماست.',
        pstatus: '<b>نوبت شما.</b> یک وظیفه بردارید.',
        log: [[6, 'رضا زیردریایی ۴ دارد و فرمانده است'], [6, 'رضا «دست آخر را ببرد» را برداشت'], [1, 'نوبت شما']],
        phone: true,
      },
      {
        shotTitle: 'ارتباط', turnSub: 'انتخاب کارت و نشان بالاترین / پایین‌ترین / تنها', overlay: comm,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${tasksNow}</div></div>`,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: h.alt === alt('g5'), dim: false })) },
        status: '<b>بین دو دست.</b> نوبت ارتباط شماست: سبز ۵ تنها سبز دست شماست.',
        log: [[6, 'رضا دست ۲ را برد'], [1, 'شما ارتباط را باز کردید']],
      },
      {
        shotTitle: 'علامت خطر', turnSub: 'یک کارت به همسایه، همه در یک جهت', overlay: distress,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${tasksNow}</div></div>`,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: h.alt === alt('p8'), dim: false })) },
        status: '<b>علامت خطر.</b> یک کارت غیرزیردریایی را به سارا بدهید.',
        log: [[6, 'رضا علامت خطر داد: به راست'], [1, 'شما یک کارت انتخاب می‌کنید']],
      },
      {
        shotTitle: 'پایان ماموریت', turnSub: 'موفق و جزئیات وظیفه‌ها', overlay: win,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${tasksNow}</div></div>`,
        me: { cards: [], turn: false, clock: '' }, railCard: '',
        status: '<b>ماموریت موفق شد.</b>',
        log: [[6, 'رضا دست آخر را برد'], [1, 'همهٔ وظیفه‌ها انجام شد']],
      },
      {
        shotTitle: 'شکست ماموریت', turnSub: 'کدام وظیفه و کدام دست', phone: true, phoneOnly: true, overlay: fail,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${task(14, 'هیچ ۹ نبرد', 'شما', 1, 2)}</div></div>`,
        me: { cards: [], turn: false, clock: '' },
        pstatus: '<b>شکست.</b> زرد ۹ را بردید.', status: '',
      },
    ],    css: `.gc-card{margin-inline-start:calc(var(--cw) * -.2)}.gc-card:first-child{margin-inline-start:0}
.bgv-composer{display:none}
.cw-radio{inline-size:20px;block-size:20px}
.gc-seat__meta>span{white-space:nowrap}.gc-seat__meta .gc-tag{block-size:20px;font-size:11.5px;padding-inline:7px;white-space:nowrap}
.cw-comm{display:inline-flex;align-items:center;gap:4px}.cw-comm img{inline-size:16px;border-radius:2px;box-shadow:0 0 0 2px #2E8B57}.cw-comm b{font-size:11px;color:var(--felt-ink)}
.cw-board{display:grid;gap:14px;justify-items:center}
.ds-head{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--felt-muted)}.ds-head b{padding:2px 10px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13px}
.cw-tasks{display:flex;gap:14px;padding:10px 14px;border-radius:12px;background:rgba(8,20,28,.3)}
.cw-task{display:grid;justify-items:center;gap:3px;font-size:11.5px;color:var(--felt-muted);inline-size:96px;text-align:center}
.cw-task__c{position:relative}.cw-task__c>img{display:block;inline-size:64px;border-radius:6px;box-shadow:0 6px 10px -6px rgba(0,0,0,.7)}
.ds-diff{position:absolute;inset-block-start:-8px;inset-inline-end:-10px;display:grid;place-items:center;inline-size:24px;block-size:24px;border-radius:50%;background:#0E3B5C;color:#FAF5EC;font-size:13px;box-shadow:0 0 0 2px #7FD1E8}
.ds-done{position:absolute;inset:0;display:grid;place-items:center;border-radius:6px;background:rgba(46,139,87,.55);color:#fff}.ds-done .bgv-icon{inline-size:30px;block-size:30px}
.cw-task small{display:flex;align-items:center;gap:4px;font-weight:700;color:var(--felt-ink)}.cw-task small i{inline-size:8px;block-size:8px;border-radius:50%}
.cw-task em{font-style:normal;font-size:11px;line-height:1.4}
.cw-task.is-mine .cw-task__c>img{box-shadow:0 0 0 3px var(--felt-gold)}.cw-task.is-mine small{color:var(--felt-gold)}
.cw-trick{display:flex;gap:16px;align-items:flex-end}
.cw-play{display:grid;justify-items:center;gap:6px;font-size:12px;color:var(--felt-muted)}.cw-play img{display:block;inline-size:84px;border-radius:7px;box-shadow:0 10px 16px -8px rgba(0,0,0,.7)}
.cw-play small{display:flex;align-items:center;gap:4px}.cw-play small i{inline-size:8px;block-size:8px;border-radius:50%}
.cw-play.is-warn img{box-shadow:0 0 0 3px #F0AAA3,0 10px 16px -8px rgba(0,0,0,.7)}
.cw-slot{display:grid;place-items:center;inline-size:84px;block-size:132px;border-radius:7px;outline:2px dashed var(--felt-gold);outline-offset:-2px;color:var(--felt-gold);font-size:13px;font-weight:700}
.cw-list{display:grid;gap:6px}.cw-list p{margin:0;display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text)}.cw-list small{margin-inline-start:auto;color:var(--text-muted);font-size:12px}
.cw-dot{inline-size:10px;block-size:10px;border-radius:50%}
.cx-phone .cw-board{gap:8px}.cx-phone .cw-tasks{gap:4px;padding:6px}.cx-phone .cw-task{inline-size:78px}.cx-phone .cw-task__c>img{inline-size:40px}.cx-phone .ds-diff{inline-size:18px;block-size:18px;font-size:10.5px;inset-inline-end:-7px;inset-block-start:-6px}.cx-phone .cw-task em{font-size:9.5px}.cx-phone .cw-task small{font-size:10px}
.cx-phone .cw-trick{gap:8px}.cx-phone .cw-play img{inline-size:52px}.cx-phone .cw-slot{inline-size:52px;block-size:82px;font-size:11px}.cx-phone .cw-play small{font-size:10px}.cx-phone .ds-head{font-size:11px}
.cx-phone .gc-card{margin-inline-start:-3px}.cx-phone .gc-card:first-child{margin-inline-start:0}
.ds-hint{margin:0;color:var(--felt-muted);font-size:12.5px;text-align:center;max-inline-size:520px}
.cw-task.is-taken{opacity:.6}
.cw-comms{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.cw-cm{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:3px;padding:4px;border-radius:8px;font-size:11px;font-weight:700;color:var(--heading)}
.cw-cm img{inline-size:50px;border-radius:5px;display:block}.cw-cm.is-sel{background:var(--felt-gold);color:#142B3B}.cw-cm:disabled{opacity:.4}
.cx-phone .cw-cm img{inline-size:36px}`,
    shotTitle: 'نوبت شما', turnSub: 'وظیفه‌ای با سختی',
    diffs: [
      ['وظیفه‌های شرطی', 'به جای کارت‌های وظیفهٔ رنگی، کارت‌های شرط اعماق دریا؛ روی هر کدام عدد سختی، زیرش صاحبش و ترجمهٔ کوتاه شرط (تصویر کارت‌ها انگلیسی است). بالای ردیف جمع سختی کنار هدف ماموریت'],
      ['وضع وظیفه', 'وظیفهٔ انجام‌شده تیک سبز می‌گیرد؛ وظیفه‌هایی مثل «هیچ ۹ نبرید» تا آخر بازی باز می‌مانند. ستون کنار وضع همه را می‌گوید'],
      ['دست جاری', 'کارتی که برای وظیفهٔ شما خطرناک است (اینجا ۹) حاشیهٔ قرمز می‌گیرد؛ کارت‌های مجاز دست بالا آمده‌اند و زیردریایی‌ها برگ برنده‌اند'],
      ['ارتباط', 'مثل سیارهٔ نهم: یک بار در ماموریت، بین دو دست، با «بالاترین / پایین‌ترین / تنها»؛ نشان رادیو سبز یا قرمز روی چیپ'],
      ['تفاوت با موتور', 'موتور مجموعه‌ای از شرط‌ها را با سختی ثابت ۱ تا ۳ دارد، نه فهرست چاپی کارت‌ها؛ فقط کارت‌هایی نشان داده شده‌اند که متنشان با شرط موتور یکی است'],
      ['قوانین', 'مثل موتور: ۳ تا ۵ نفر، هدف سختی ۳، ۵، ۷، ۹ یا ۱۱؛ گفت‌وگو در طول ماموریت بسته است'],
    ],
  };
}
