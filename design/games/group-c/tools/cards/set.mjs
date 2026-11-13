// Set on the card-table frame (repo engine: 2–8 players, live only, 81 cards, 12 on the table, first valid claim wins, −1 for a wrong claim).
// Table: two disjoint sets (73-36-2 diamonds, 57-49-14 waves). You have picked the diamonds; Reza is locked after a wrong claim.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const TABLE = [73, 57, 36, 49, 44, 2, 59, 45, 21, 14, 63, 7];
  const PICK = [73, 36, 2];
  const id = (n) => `set-${String(n).padStart(2, '0')}`;
  const cell = (n) => `<span class="st-c${PICK.includes(n) ? ' is-sel' : ''}">${img(id(n), 'کارت ست')}</span>`;
  const score = (n, sets, wrong) => `<span class="st-sc">${fa(n)} امتیاز</span><span class="st-n">${fa(sets)} ست${wrong ? `، ${fa(wrong)} اشتباه` : ''}</span>`;
  const table = (ph) => `<div class="st-board"><div class="st-top">${ph ? '' : `<span class="st-deck">${img('set-deck', 'دسته')}<b>${fa(21)}</b> کارت در دسته</span>`}<span class="st-timer">${ic('clock')}مهلت میز <b>۰:۴۲</b></span></div>
<div class="st-grid" aria-label="۱۲ کارت روی میز">${TABLE.map(cell).join('')}</div></div>`;
  const above = (ph) => `<div class="st-above${ph ? ' st-above--ph' : ''}"><span class="st-pick">${PICK.map((n) => img(id(n), 'انتخاب شما')).join('')}<small>${ph ? '' : 'سه کارت انتخاب شد'}</small></span>${btn('پاک کردن', 'secondary', 'x')}${btn('ست!', 'primary', 'zap')}</div>`;
  const { modal } = H;
  const T12 = [73, 57, 36, 49, 44, 59, 45, 21, 63, 7, 1, 5];
  const EXTRA = [2, 10, 23];
  const cellX = (n, cls = '') => `<span class="st-c${cls ? ' ' + cls : ''}">${img(id(n), 'کارت ست')}</span>`;
  const extraT = (ph) => `<div class="st-board"><div class="st-top">${ph ? '' : `<span class="st-deck">${img('set-deck', 'دسته')}<b>${fa(9)}</b> کارت در دسته</span>`}<span class="st-timer st-timer--x">${ic('info')}در ۱۲ کارت ستی نبود؛ <b>۳ کارت اضافه</b></span></div>
<div class="st-grid st-grid--15" aria-label="۱۵ کارت روی میز">${T12.map((n) => cellX(n)).join('')}${EXTRA.map((n) => cellX(n, 'is-new')).join('')}</div><p class="st-hint">${ph ? 'بعد از ست بعدی میز به ۱۲ برمی‌گردد' : 'کارت‌های تازه حاشیهٔ طلایی دارند. بعد از ست بعدی جای خالی پر نمی‌شود و میز به ۱۲ کارت برمی‌گردد؛ اگر باز هم ستی نبود، ۱۸ کارت'}</p></div>`;
  const toT = (ph) => `<div class="st-board"><div class="st-top"><span class="st-timer st-timer--out">${ic('clock')}مهلت میز <b>۰:۰۰</b></span></div><div class="st-grid">${[73, 57, 36, 49, 44, 2, 59, 45, 21, 14, 63, 7].map((n) => cellX(n, [57, 49, 14].includes(n) ? 'is-gone' : '')).join('')}</div></div>`;
  const timeout = (ph) => modal('مهلت میز تمام شد', `<p>در مهلت میز کسی ست اعلام نکرد. یکی از ست‌های روی میز بی‌امتیاز کنار رفت و سه کارت تازه آمد:</p><div class="st-gone">${[57, 49, 14].map((n) => img(id(n), 'کارت ست کنار رفته')).join('')}</div><p class="cx-note">این سه کارت موج یک ست بودند؛ کسی امتیاز نگرفت.</p>`, `${btn('ادامه', 'primary', 'check')}`);
  const ending = (ph) => modal('پایان بازی', `<p>دسته تمام شد و روی میز ستی نمانده است.</p><table class="gd-score"><thead><tr><th>رتبه</th><th>بازیکن</th><th class="n">ست</th><th class="n">اشتباه</th><th class="n">امتیاز</th></tr></thead><tbody>${[[1, 'شما', 9, 0, 9, true], [2, 'نیلوفر', 8, 0, 8], [3, 'سارا', 5, 1, 4], [4, 'کیان', 3, 0, 3], [5, 'رضا', 2, 2, 0]].map(([r, n, s, w, p, win]) => `<tr${win ? ' class="is-win"' : ''}><td>${fa(r)}</td><td>${n}</td><td class="n">${fa(s)}</td><td class="n">${fa(w)}</td><td class="n">${fa(p)}</td></tr>`).join('')}</tbody></table><p class="cx-note">امتیاز = ست‌ها منهای اعلام‌های اشتباه.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Set', fa: 'ست', latin: 'Set', meta: ['زنده', '۵ نفر', 'هم‌زمان'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, meta: score(5, 5, 0) },
      { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `<span class="st-sc">${fa(1)} امتیاز</span><span class="gc-tag gc-tag--soft">قفل</span>` },
      { name: 'سارا', av: 'س', seat: 4, meta: score(3, 3, 0) },
      { name: 'کیان', av: 'ک', seat: 8, meta: score(2, 2, 0) },
    ],
    me: { cards: [], turn: true, note: `<span class="cx-note">${fa(4)} امتیاز، ${fa(4)} ست</span>`, above },
    table,
    status: '<b>همه هم‌زمان می‌گردند.</b> سه لوزی انتخاب کردید: تعداد، رنگ و پرشدگی همه متفاوت، شکل همه یکسان؛ «ست!» را بزنید. اولین اعلام درست می‌برد.',
    pstatus: '<b>هم‌زمان.</b> سه کارت را انتخاب کنید و «ست!» بزنید.',
    railCard: `<section class="cx-card"><h3>امتیازها</h3><ol class="st-board-list"><li><i style="background:var(--seat-2)"></i>نیلوفر<b>${fa(5)}</b></li><li class="is-me"><i style="background:var(--seat-1)"></i>شما<b>${fa(4)}</b></li><li><i style="background:var(--seat-4)"></i>سارا<b>${fa(3)}</b></li><li><i style="background:var(--seat-8)"></i>کیان<b>${fa(2)}</b></li><li class="is-lock"><i style="background:var(--seat-6)"></i>رضا<small>قفل تا ست بعدی</small><b>${fa(1)}</b></li></ol><div class="ga-rule">${ic('info')}<span>در هر ویژگی (تعداد، شکل، رنگ، پرشدگی) سه کارت یا همه یکسان‌اند یا همه متفاوت. اعلام اشتباه ${fa(1)} امتیاز کم می‌کند و تا ست بعدی قفلتان می‌کند.</span></div></section>`,
    logNote: `${fa(16)} ست تا حالا`,
    log: [[2, 'نیلوفر یک ست پیدا کرد (+۱)'], [4, 'سارا یک ست پیدا کرد (+۱)'], [6, 'رضا اعلام اشتباه کرد (−۱) و تا ست بعدی قفل است'], [1, 'سه کارت تازه از دسته آمد']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'ست چیست؟', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['trophy', 'امتیازها'], ['chat', 'گفت‌وگو'], ['list', 'ست چیست؟']],
    phases: [
      {
        shotTitle: 'کارت‌های اضافه', turnSub: 'ستی نیست؛ ۱۵ کارت، بعد برگشت به ۱۲', table: extraT, phone: true,
        me: { above: () => '' },
        status: '<b>در ۱۲ کارت ستی نبود.</b> سه کارت تازه آمد و حالا ۱۵ کارت روی میز است. پیدا کنید؛ بعد از ست بعدی میز دوباره ۱۲ کارتی می‌شود.',
        pstatus: '<b>۱۵ کارت.</b> ستی در ۱۲ کارت نبود.',
        log: [[2, 'نیلوفر یک ست پیدا کرد (+۱)'], [1, 'در ۱۲ کارت ستی نیست'], [1, 'سه کارت اضافه آمد']],
      },
      {
        shotTitle: 'مهلت تمام شد', turnSub: 'ستی که بی‌امتیاز کنار رفت', table: toT, overlay: timeout,
        me: { above: () => '' },
        status: '<b>مهلت میز تمام شد.</b> یک ست بی‌امتیاز کنار رفت.',
        log: [[1, 'مهلت میز تمام شد'], [1, 'ست موج‌ها کنار رفت']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیازها', overlay: ending, meta: ['تمام شد', '۵ نفر', 'هم‌زمان'],
        table: (ph) => `<div class="st-board"><div class="st-grid">${[73, 57, 36, 49, 44, 59].map((n) => cellX(n)).join('')}</div></div>`,
        me: { turn: false, above: () => '', note: `<span class="cx-note">${fa(9)} امتیاز</span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۹ امتیاز بردید.',
        log: [[1, 'آخرین ست را شما پیدا کردید'], [1, 'شما بردید']],
      },
    ],    css: `.st-sc{font-weight:700;color:var(--felt-ink);white-space:nowrap}.st-n{white-space:nowrap}
.gc-seat .gc-tag{white-space:nowrap}
.gc-opps{max-inline-size:none}.gc-seat{min-inline-size:150px;flex-basis:150px}
.st-board{display:grid;justify-items:center;gap:12px}
.st-top{display:flex;align-items:center;gap:24px;color:var(--felt-muted);font-size:13px}
.st-deck{display:inline-flex;align-items:center;gap:6px}.st-deck img{inline-size:30px}.st-deck b{color:var(--felt-ink)}
.st-timer{display:inline-flex;align-items:center;gap:6px}.st-timer .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold)}.st-timer b{color:var(--felt-ink)}
.st-grid--15{grid-template-columns:repeat(5,104px)!important}.st-grid--15 .st-c img{inline-size:104px}
.st-c.is-new img{box-shadow:0 0 0 3px var(--felt-gold)}.st-c.is-gone img{opacity:.4;outline:3px solid #F0AAA3;outline-offset:-1px;border-radius:8px}
.st-timer--x{color:var(--felt-gold)}.st-timer--out b{color:#F0AAA3}
.st-hint{margin:0;color:var(--felt-muted);font-size:12.5px;text-align:center;max-inline-size:560px}
.st-gone{display:flex;gap:10px;justify-content:center}.st-gone img{inline-size:96px;border-radius:8px}
.cx-phone .st-grid--15{grid-template-columns:repeat(5,64px)!important}.cx-phone .st-grid--15 .st-c img{inline-size:64px}.cx-phone .st-gone img{inline-size:70px}.st-grid{display:grid;grid-template-columns:repeat(4,128px);gap:10px 14px}
.st-c{display:block;border-radius:10px}
.st-c img{display:block;inline-size:128px}
.st-c.is-sel{transform:translateY(-4px)}
.st-c.is-sel img{filter:drop-shadow(0 0 0 #000) drop-shadow(0 0 2px #FAF5EC) drop-shadow(0 0 2px #FAF5EC) drop-shadow(0 0 5px #E8A642) drop-shadow(0 0 6px #E8A642)}
.st-above{display:flex;align-items:center;justify-content:center;gap:10px;inline-size:100%;margin-block:6px}
.st-pick{display:inline-flex;align-items:center;gap:4px;margin-inline-end:8px;color:var(--felt-muted);font-size:12.5px}.st-pick img{inline-size:34px}.st-pick small{margin-inline-start:6px}
.st-above .bgv-btn--primary{min-inline-size:120px;font-size:16px}
.st-above--ph{padding-inline:10px;box-sizing:border-box;gap:6px;margin-block:2px}.st-above--ph .st-pick{flex:1;margin:0}.st-above--ph .st-pick img{inline-size:28px}.st-above--ph .bgv-btn--primary{min-inline-size:0}
.st-board-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.st-board-list li{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text)}
.st-board-list li i{inline-size:10px;block-size:10px;border-radius:50%}
.st-board-list li b{margin-inline-start:auto;color:var(--heading);font-size:15px}
.st-board-list li.is-me{font-weight:700;color:var(--heading)}
.st-board-list li.is-lock{color:var(--text-muted)}.st-board-list li small{font-size:12px}
.cx-phone .gc-seat{min-inline-size:132px}
.cx-phone .st-board{gap:6px}
.cx-phone .st-grid{grid-template-columns:repeat(4,86px);gap:6px}
.cx-phone .st-c img{inline-size:86px}
.cx-phone .st-top{font-size:12px}`,
    shotTitle: 'پیدا کردن ست', turnSub: 'بازی هم‌زمان، بی‌نوبت',
    diffs: [
      ['چیدمان', 'دست ندارد: وسط میز شبکهٔ ۱۲ کارتی (۴ × ۳؛ وقتی ستی نباشد ۱۵ و ۱۸ کارت) بزرگ‌تر از بقیهٔ بازی‌ها، بالایش دسته و مهلت میز. پایین فقط نوار انتخاب شما و دکمهٔ «ست!»'],
      ['هم‌زمان', 'نوبت و ساعت هر نفر نیست؛ فقط یک مهلت برای کل میز که بعد از هر ست از نو شروع می‌شود. روی صندلی‌ها امتیاز و تعداد ست هر نفر'],
      ['انتخاب و اعلام', 'با زدن روی کارت‌ها تا سه کارت انتخاب می‌شود (هالهٔ طلایی) و کوچکشان کنار دکمه می‌آید؛ «ست!» بزرگ و طلایی است و «پاک کردن» انتخاب را خالی می‌کند'],
      ['اعلام اشتباه', 'صندلی کسی که اشتباه اعلام کرده کم‌رنگ با برچسب «قفل» تا ست بعدی؛ در رویدادها هم برای همه اعلام می‌شود. اعلامی که دیر برسد بی‌جریمه رد می‌شود'],
      ['امتیازها', 'کارت ستون کنار جدول امتیاز همه به ترتیب است (جای «کارت دست» بقیهٔ بازی‌ها)؛ برای ۸ نفر هم جا دارد. در گوشی نوار حریف‌ها افقی می‌لغزد'],
      ['قوانین', '۲ تا ۸ نفر و فقط زنده، مثل موتور؛ هر ست ۱ امتیاز، هر اعلام اشتباه −۱. پایان وقتی دسته تمام شده و ستی روی میز نیست'],
    ],
  };
}
