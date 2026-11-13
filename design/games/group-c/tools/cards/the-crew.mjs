// The Crew: The Quest for Planet Nine on the card-table frame (cooperative trick-taking, as the repo engine).
// Mock: 4 players, mission 9 = 4 tasks, order tokens [1, last]: pink 5 (order 1) → you · yellow 9 (last) → Niloufar ·
// green 4 → Reza · blue 7 → Sara. 40 cards / 4 = 10 each; Reza holds rocket 4 → commander, led trick 1.
// Tricks won: Reza 1, Sara 1, Niloufar 1 → trick 4, 7 cards each before it. Niloufar led pink 7, Reza pink 2,
// Sara pink 5 (your task card!). You must follow pink: pink 9 wins it and fulfils task 1. Reza has communicated
// green 9 as his highest green. Your hand: p9 p3 b4 g1 g8 y6 r2.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const SF = { p: 'صورتی', b: 'آبی', g: 'سبز', y: 'زرد', r: 'موشک' };
  const c = (id) => `the-crew-${id}`;
  const alt = (id) => `${SF[id[0]]} ${fa(Number(id.slice(1)))}`;
  const radio = (state) => img(`the-crew-radio-${state}`, state === 'used' ? 'ارتباط استفاده شده' : 'ارتباط در دسترس', 'cw-radio');
  const task = (id, owner, seat, order) => `<span class="cw-task${seat === 1 ? ' is-mine' : ''}"><span class="cw-task__c">${img(c(`task-${id}`), `وظیفه: ${alt(id)}`)}${order ? img(`the-crew-order-${order}`, order === 'last' ? 'آخرین وظیفه' : `ترتیب ${fa(order)}`, 'cw-order') : ''}</span><small><i style="background:var(--seat-${seat})"></i>${owner}</small></span>`;
  const played = (id, who, seat, o = {}) => `<span class="cw-play${o.task ? ' is-task' : ''}${o.lead ? ' is-lead' : ''}">${id ? img(c(id), alt(id)) : '<span class="cw-slot">شما</span>'}<small><i style="background:var(--seat-${seat})"></i>${who}${o.lead ? '<span class="bgv-sep"></span>شروع' : ''}</small></span>`;
  const hand = ['p3', 'p9', 'b4', 'g1', 'g8', 'y6', 'r2'].map((id) => ({ art: c(id), alt: alt(id), sel: id === 'p9', ok: id === 'p3', dim: id[0] !== 'p' }));
  const { modal } = H;
  const freeTask = (id, o = {}) => `<span class="cw-task${o.sel ? ' is-mine' : ''}${o.taken ? ' is-taken' : ''}"><span class="cw-task__c">${img(c(`task-${id}`), `وظیفه: ${alt(id)}`)}${o.order ? img(`the-crew-order-${o.order}`, o.order === 'last' ? 'آخرین وظیفه' : `ترتیب ${fa(o.order)}`, 'cw-order') : ''}</span><small>${o.taken ? `<i style="background:var(--seat-${o.taken[1]})"></i>${o.taken[0]}` : o.sel ? 'انتخاب شما' : 'آزاد'}</small></span>`;
  const draft = (ph) => `<div class="cw-board"><div class="cw-head">${img('the-crew-commander', 'فرمانده', 'cw-cmd')}<span>انتخاب وظیفه‌ها: فرمانده اول، بعد ساعتگرد</span></div>
<div class="cw-tasks" aria-label="وظیفه‌های رو شده">${freeTask('g4', { taken: ['رضا', 6] })}${freeTask('p5', { order: 1, sel: true })}${freeTask('y9', { order: 'last' })}${freeTask('b7')}</div>
<p class="cw-hint">${ph ? 'نوبت شما: یک وظیفه' : 'رضا (فرمانده) سبز ۴ را برداشت؛ نوبت شماست. بعد نیلوفر و سارا'}</p></div>`;
  const handIds = ['p3', 'p9', 'b4', 'g1', 'g8', 'y6', 'r2'];
  const commLabel = { p3: 'پایین‌ترین', p9: 'بالاترین', b4: 'تنها', g1: 'پایین‌ترین', g8: 'بالاترین', y6: 'تنها', r2: 'موشک نه' };
  const comm = (ph) => modal('ارتباط: یک کارت را نشان دهید', `<p>یک بار در این ماموریت، پیش از شروع یک دست، می‌توانید یک کارت رنگی را رو کنید. جای نشان رادیو خودش می‌گوید این کارت بالاترین، پایین‌ترین یا تنها کارت آن رنگ در دست شماست. موشک را نمی‌شود نشان داد.</p><div class="cw-comms">${handIds.map((id) => `<button type="button" class="cw-cm${id === 'b4' ? ' is-sel' : ''}"${id[0] === 'r' ? ' disabled' : ''}>${img(c(id), alt(id))}<small>${commLabel[id]}</small></button>`).join('')}</div>`, `${btn('لغو', 'secondary', 'x')}${btn('نشان دادن آبی ۴: تنها', 'primary', 'zap')}`);
  const distress = (ph) => modal('علامت خطر', `<p>تیم پیش از اولین ارتباط و اولین دست علامت خطر داد: هر نفر <b>یک کارت</b> (نه موشک) به همسایه‌اش در یک جهت می‌دهد. جهت را فرمانده انتخاب کرد: <b>به چپ</b>، یعنی شما به نیلوفر می‌دهید و از سارا می‌گیرید.</p><div class="cw-comms">${handIds.map((id) => `<button type="button" class="cw-cm${id === 'g1' ? ' is-sel' : ''}"${id[0] === 'r' ? ' disabled' : ''}>${img(c(id), alt(id))}</button>`).join('')}</div><p class="cx-note">علامت خطر یک بار در ماموریت است و در جدول ماموریت‌ها ثبت می‌شود.</p>`, `${btn('دادن سبز ۱ به نیلوفر', 'primary', 'check')}`);
  const win = (ph) => modal('ماموریت ۹ موفق شد', `<p>هر چهار وظیفه را صاحبانشان بردند و ترتیب «۱» و «آخر» رعایت شد.</p><table class="gd-score"><thead><tr><th>وظیفه</th><th class="n">صاحب</th><th class="n">دست</th></tr></thead><tbody><tr class="is-win"><td>صورتی ۵ (۱)</td><td class="n">شما</td><td class="n">${fa(4)}</td></tr><tr class="is-win"><td>سبز ۴</td><td class="n">رضا</td><td class="n">${fa(6)}</td></tr><tr class="is-win"><td>آبی ۷</td><td class="n">سارا</td><td class="n">${fa(8)}</td></tr><tr class="is-win"><td>زرد ۹ (آخر)</td><td class="n">نیلوفر</td><td class="n">${fa(9)}</td></tr></tbody></table><p class="cx-note">تلاش‌های این ماموریت: ${fa(2)}. ماموریت ۱۰ آماده است.</p>`, `${btn('ترک میز', 'secondary', 'flag')}${btn('ماموریت بعد', 'primary', 'next')}`);
  const fail = (ph) => modal('ماموریت ۹ شکست خورد', `<p>سبز ۴ وظیفهٔ <b>رضا</b> بود ولی <b>سارا</b> در دست ${fa(5)} آن را برد. ماموریت همان لحظه تمام شد.</p>`, `${btn('ترک میز', 'secondary', 'flag')}${btn('دوباره همین ماموریت', 'primary', 'repeat')}`);  return {
    slug: 'TheCrew', fa: 'کرو: در جستجوی سیارهٔ نهم', latin: 'The Crew', meta: ['زنده', '۴ نفر', 'همکاری', 'ماموریت ۹'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `<span>${fa(6)} کارت<span class="bgv-sep"></span>برده ${fa(1)}</span>${radio('available')}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `<span class="cw-comm">${img(c('g9'), 'سبز ۹')}<b>بالاترین</b></span><span>برده ${fa(1)}</span><span class="gc-tag">فرمانده</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `<span>${fa(6)} کارت<span class="bgv-sep"></span>برده ${fa(1)}</span>${radio('available')}` },
    ],
    me: { cards: hand, clock: '0:44', turn: true, note: `${fa(7)} کارت<span class="bgv-sep"></span>برده ${fa(0)}<span class="bgv-sep"></span>ارتباط در دسترس` },
    cardW: 70, phoneCardW: 44, cardRatio: 1.57,
    table: (ph) => `<div class="cw-board">
<div class="cw-tasks" aria-label="وظیفه‌ها">${task('p5', 'شما', 1, 1)}${task('y9', 'نیلوفر', 2, 'last')}${task('g4', 'رضا', 6)}${task('b7', 'سارا', 4)}</div>
<div class="cw-trick" aria-label="دست چهارم">${played('p7', 'نیلوفر', 2, { lead: true })}${played('p2', 'رضا', 6)}${played('p5', 'سارا', 4, { task: true })}${played(null, 'شما', 1)}</div></div>`,
    status: '<b>بازی گروهی؛ نوبت شماست.</b> صورتی ۵ (وظیفهٔ شمارهٔ ۱ شما) در این دست است. باید صورتی بزنید؛ صورتی ۹ دست را می‌برد و وظیفه انجام می‌شود.',
    pstatus: '<b>نوبت شما.</b> صورتی ۹ وظیفهٔ ۱ را می‌برد.',
    railCard: `<section class="cx-card"><h3>ماموریت ۹</h3><div class="cw-list">
<p><span class="cw-dot" style="background:var(--seat-1)"></span><b>صورتی ۵<span class="bgv-sep"></span>شما</b>${img('the-crew-order-1', 'ترتیب ۱', 'cw-mini')}<small>همین دست</small></p>
<p><span class="cw-dot" style="background:var(--seat-6)"></span><b>سبز ۴<span class="bgv-sep"></span>رضا</b><small>باز</small></p>
<p><span class="cw-dot" style="background:var(--seat-4)"></span><b>آبی ۷<span class="bgv-sep"></span>سارا</b><small>باز</small></p>
<p><span class="cw-dot" style="background:var(--seat-2)"></span><b>زرد ۹<span class="bgv-sep"></span>نیلوفر</b>${img('the-crew-order-last', 'آخر', 'cw-mini')}<small>آخر از همه</small></p></div>
<div class="ga-rule">${ic('info')}<span>هر وظیفه را باید صاحبش ببرد؛ اگر کس دیگری ببرد ماموریت شکست می‌خورد. حرف زدن ممنوع است؛ هر نفر یک بار بین دو دست می‌تواند یک کارت را نشان دهد.</span></div></section>`,
    logNote: 'دست ۴ از ۱۰',
    log: [[2, 'نیلوفر دست ۳ را برد'], [6, 'رضا نشان داد: سبز ۹ بالاترین سبز اوست'], [2, 'نیلوفر صورتی ۷ را شروع کرد'], [6, 'رضا صورتی ۲'], [4, 'سارا صورتی ۵ (وظیفهٔ شما)'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ارتباط (بین دو دست)', 'secondary', 'zap', ' disabled')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('flag', 'ترک میز', 'secondary')}</div>`,
    dockItems: [['zap', 'ارتباط'], ['list', 'وظیفه‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    chat: [['sys', 'ماموریت ۹ شروع شد. ۴ نفر سر میزند'], ['sys', 'در کرو حرف زدن دربارهٔ کارت‌ها ممنوع است؛ فقط ارتباط رسمی']],
    phases: [
      {
        shotTitle: 'انتخاب وظیفه', turnSub: 'فرمانده اول، بعد ساعتگرد', table: draft,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: false, dim: false })), note: `دست تازه` },
        status: '<b>انتخاب وظیفه‌ها.</b> رضا فرمانده است و سبز ۴ را برداشت. نوبت شماست؛ صورتی ۵ نشان «۱» دارد، یعنی باید اول از همه انجام شود.',
        pstatus: '<b>نوبت شما.</b> یک وظیفه بردارید.',
        log: [[6, 'رضا موشک ۴ دارد و فرمانده است'], [6, 'رضا سبز ۴ را برداشت'], [1, 'نوبت شما برای وظیفه']],
        phone: true,
      },
      {
        shotTitle: 'ارتباط', turnSub: 'انتخاب کارت و نشان بالاترین / پایین‌ترین / تنها', overlay: comm,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks" aria-label="وظیفه‌ها">${task('p5', 'شما', 1, 1)}${task('y9', 'نیلوفر', 2, 'last')}${task('g4', 'رضا', 6)}${task('b7', 'سارا', 4)}</div></div>`,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: h.alt === alt('b4'), dim: false })) },
        status: '<b>بین دو دست.</b> نوبت ارتباط شماست: آبی ۴ تنها آبی دست شماست.',
        log: [[2, 'نیلوفر دست ۳ را برد'], [1, 'شما ارتباط را باز کردید']],
      },
      {
        shotTitle: 'علامت خطر', turnSub: 'یک کارت به همسایه، همه در یک جهت', overlay: distress,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks" aria-label="وظیفه‌ها">${task('p5', 'شما', 1, 1)}${task('y9', 'نیلوفر', 2, 'last')}${task('g4', 'رضا', 6)}${task('b7', 'سارا', 4)}</div></div>`,
        me: { cards: hand.map((h) => ({ ...h, ok: false, sel: h.alt === alt('g1'), dim: false })) },
        status: '<b>علامت خطر.</b> یک کارت غیرموشک را به نیلوفر بدهید.',
        log: [[6, 'رضا علامت خطر داد: به چپ'], [1, 'شما یک کارت انتخاب می‌کنید']],
      },
      {
        shotTitle: 'پایان ماموریت', turnSub: 'موفق، و ماموریت بعد', overlay: win,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${task('p5', 'شما', 1, 1)}${task('y9', 'نیلوفر', 2, 'last')}${task('g4', 'رضا', 6)}${task('b7', 'سارا', 4)}</div></div>`,
        me: { cards: [], turn: false, clock: '' }, railCard: '',
        status: '<b>ماموریت ۹ موفق شد.</b>',
        log: [[2, 'نیلوفر زرد ۹ را برد'], [1, 'همهٔ وظیفه‌ها انجام شد']],
      },
      {
        shotTitle: 'شکست ماموریت', turnSub: 'دلیل شکست', phone: true, phoneOnly: true, overlay: fail,
        table: (ph) => `<div class="cw-board"><div class="cw-tasks">${task('p5', 'شما', 1, 1)}${task('g4', 'رضا', 6)}</div></div>`,
        me: { cards: [], turn: false, clock: '' },
        pstatus: '<b>شکست.</b> سبز ۴ را سارا برد.', status: '',
      },
    ],    css: `.gc-card{margin-inline-start:calc(var(--cw) * -.18)}.gc-card:first-child{margin-inline-start:0}
.bgv-composer{display:none}
.cw-radio{inline-size:20px;block-size:20px}
.gc-seat__meta>span{white-space:nowrap}.gc-seat__meta .gc-tag{block-size:20px;font-size:11.5px;padding-inline:7px;white-space:nowrap}
.cw-comm{position:relative;display:inline-flex;align-items:center;gap:4px}.cw-comm img{inline-size:16px;border-radius:2px;box-shadow:0 -3px 0 0 #2E8B57}.cw-comm b{font-size:11px;color:var(--felt-ink)}
.cw-board{display:grid;gap:22px;justify-items:center}
.cw-tasks{display:flex;gap:14px;padding:8px 14px;border-radius:12px;background:rgba(8,20,28,.3)}
.cw-task{display:grid;justify-items:center;gap:4px;font-size:11.5px;color:var(--felt-muted)}
.cw-task__c{position:relative}.cw-task__c>img:first-child{display:block;inline-size:58px;border-radius:5px;box-shadow:0 6px 10px -6px rgba(0,0,0,.7)}
.cw-order{position:absolute;inset-block-start:-8px;inset-inline-end:-10px;inline-size:26px;border-radius:5px;box-shadow:0 0 0 2px var(--felt)}
.cw-task small{display:flex;align-items:center;gap:4px}.cw-task small i{inline-size:8px;block-size:8px;border-radius:50%}
.cw-task.is-mine .cw-task__c>img:first-child{box-shadow:0 0 0 3px var(--felt-gold)}.cw-task.is-mine small{color:var(--felt-gold);font-weight:700}
.cw-trick{display:flex;gap:16px;align-items:flex-end}
.cw-play{display:grid;justify-items:center;gap:6px;font-size:12px;color:var(--felt-muted)}.cw-play img{display:block;inline-size:84px;border-radius:7px;box-shadow:0 10px 16px -8px rgba(0,0,0,.7)}
.cw-play small{display:flex;align-items:center;gap:4px}.cw-play small i{inline-size:8px;block-size:8px;border-radius:50%}
.cw-play.is-task img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.cw-slot{display:grid;place-items:center;inline-size:84px;block-size:132px;border-radius:7px;outline:2px dashed var(--felt-gold);outline-offset:-2px;color:var(--felt-gold);font-size:13px;font-weight:700}
.cw-list{display:grid;gap:6px}.cw-list p{margin:0;display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text)}.cw-list small{margin-inline-start:auto;color:var(--text-muted);font-size:12px}
.cw-dot{inline-size:10px;block-size:10px;border-radius:50%}.cw-mini{inline-size:20px;border-radius:4px}
.cx-phone .cw-board{gap:10px}.cx-phone .cw-tasks{gap:8px;padding:6px 8px}.cx-phone .cw-task__c>img:first-child{inline-size:38px}.cx-phone .cw-order{inline-size:18px;inset-inline-end:-6px;inset-block-start:-5px}.cx-phone .cw-task small{font-size:10px}
.cx-phone .cw-trick{gap:8px}.cx-phone .cw-play img{inline-size:54px}.cx-phone .cw-slot{inline-size:54px;block-size:85px;font-size:11px}.cx-phone .cw-play small{font-size:10px}
.cx-phone .gc-card{margin-inline-start:-4px}.cx-phone .gc-card:first-child{margin-inline-start:0}
.cw-head{display:flex;align-items:center;gap:8px;color:var(--felt-ink);font-size:13.5px;font-weight:700}.cw-cmd{inline-size:34px;border-radius:5px}
.cw-hint{margin:0;color:var(--felt-muted);font-size:12.5px}
.cw-task.is-taken{opacity:.6}
.cw-comms{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.cw-cm{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:3px;padding:4px;border-radius:8px;font-size:11px;font-weight:700;color:var(--heading)}
.cw-cm img{inline-size:52px;border-radius:5px;display:block}.cw-cm.is-sel{background:var(--felt-gold);color:#142B3B}.cw-cm:disabled{opacity:.4}
.cx-phone .cw-cm img{inline-size:38px}.cx-phone .cw-head{font-size:12px}`,
    shotTitle: 'نوبت شما', turnSub: 'بردن دست وظیفه',
    diffs: [
      ['وظیفه‌ها', 'بالای میز کارت‌های وظیفه با نشان ترتیب (۱، ۲، … یا «آخر») و نام صاحبش؛ وظیفهٔ شما حاشیهٔ طلایی دارد. ستون کنار فهرست وظیفه‌ها و وضعشان'],
      ['دست جاری', 'کارت‌های این دست به ترتیب بازی با نام هر نفر؛ کارتی که وظیفه است حلقهٔ طلایی می‌گیرد و جای شما خط‌چین است'],
      ['دست شما', 'باید از خال کارت اول پیروی کنید؛ کارت‌های مجاز بالا آمده‌اند و بقیه کم‌رنگ‌اند. موشک‌ها برگ برنده‌اند'],
      ['ارتباط', 'نشان رادیو روی چیپ هر نفر (سبز یعنی هنوز در دسترس)؛ کارتی که کسی نشان داده با «بالاترین / پایین‌ترین / تنها» کنار اسمش می‌ماند. دکمهٔ ارتباط فقط بین دو دست فعال است'],
      ['فرمانده و گفت‌وگو', 'برچسب «فرمانده» روی دارندهٔ موشک ۴؛ گفت‌وگو در طول ماموریت بسته است چون حرف زدن دربارهٔ کارت‌ها ممنوع است'],
      ['قوانین', 'مثل موتور: ۳ تا ۵ نفر (دونفره فقط آموزش)، ماموریت‌های ۱ تا ۱۰؛ با سه نفر یک کارت رو کنار می‌رود'],
    ],
  };
}
