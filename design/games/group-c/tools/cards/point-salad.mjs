// Point Salad on the card-table frame (repo engine: 2–6 players, 4p = 72 cards, three piles rule-side up + 2 veggies each).
// Moment: mid game. You take carrot + cabbage: ties Reza on carrots (shared «most carrot» 10) and feeds «+3 per cabbage».
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const VEG = [['tomato', 'گوجه'], ['lettuce', 'کاهو'], ['carrot', 'هویج'], ['cabbage', 'کلم'], ['pepper', 'فلفل'], ['onion', 'پیاز']];
  const FA = Object.fromEntries(VEG);
  const sym = (v) => img(`point-salad-sym-${v}`, FA[v]);
  const veg = (v, sel) => `<span class="ps-veg${sel ? ' is-sel' : ''}">${img(`point-salad-${v}`, FA[v])}${sel ? `<i>${ic('check')}</i>` : ''}</span>`;
  const counts = { me: [1, 0, 3, 2, 1, 0], nil: [2, 2, 2, 0, 1, 1], reza: [0, 1, 4, 1, 0, 2], sara: [3, 0, 0, 2, 2, 0] };
  const RULES = { 'cabbage-rule-03': 'بیشترین هویج: ۱۰ امتیاز', 'carrot-rule-08': 'هر کلم +۳، هر گوجه −۲', 'lettuce-rule-14': 'هر هویج و گوجه: ۵ امتیاز', 'onion-rule-03': 'بیشترین گوجه: ۱۰ امتیاز', 'carrot-rule-02': 'کلم زوج ۷، فرد ۳', 'lettuce-rule-04': 'کمترین فلفل: ۷ امتیاز' };
  const rule = (r) => img(`point-salad-${r}`, `دستور: ${RULES[r]}`);
  const col = (r, n, a, b, sa, sb) => `<div class="ps-col"><div class="ps-pile">${rule(r)}<span>${fa(n)} کارت</span></div>${veg(a, sa)}${veg(b, sb)}</div>`;
  const table = (ph) => `<div class="ps-market" aria-label="بازار">${col('onion-rule-03', 9, 'carrot', 'tomato', true, false)}${col('carrot-rule-02', 9, 'cabbage', 'pepper', true, false)}${col('lettuce-rule-04', 8, 'lettuce', 'onion', false, false)}</div>`;
  const mine = (ph) => `<div class="ps-mine" aria-label="سبزی‌های شما">${VEG.map(([v], k) => `<span class="${counts.me[k] ? '' : 'is-zero'}${v === 'carrot' || v === 'cabbage' ? ' is-up' : ''}">${sym(v)}<b>${fa(counts.me[k])}</b></span>`).join('')}</div>`;
  const above = (ph) => `<div class="ps-above${ph ? ' ps-above--ph' : ''}">${mine(ph)}<div class="ps-acts"><span>${ph ? '' : 'دو سبزی: '}<b>هویج و کلم</b><small>امتیاز شما ${fa(9)} ← ${fa(22)}</small></span>${btn('برداشتن', 'primary', 'check')}${btn(ph ? 'برگرداندن' : 'برگرداندن دستور', 'secondary', 'flip')}</div></div>`;
  const opp = (n, rules, score) => `<span class="ps-n">${fa(rules)} دستور</span><span class="ps-n">${fa(n)} سبزی</span><span class="gc-tag gc-tag--soft">${fa(score)}</span>`;
  const row = (who, arr) => `<tr><th>${who}</th>${arr.map((n, k) => `<td class="${n === Math.max(...Object.values(counts).map((a) => a[k])) && n ? 'is-most' : ''}">${fa(n)}</td>`).join('')}</tr>`;
  const { modal } = H;
  const recipe = (ph) => modal('دستور: بیشترین هویج', `<div class="ps-rc">${rule('cabbage-rule-03')}<div><p><b>بیشترین هویج: ${fa(10)} امتیاز</b></p><p>آخر بازی اگر از همه بیشتر هویج داشته باشید ${fa(10)} امتیاز می‌گیرید؛ اگر با کسی مساوی باشید هر دو ${fa(10)} می‌گیرید.</p><p class="cx-note">الان: شما ${fa(3)}، رضا ${fa(4)}. پشت این کارت کلم است.</p></div></div>`, `${btn('برگرداندن به کلم', 'secondary', 'flip')}${btn('بستن', 'primary', 'check')}`);
  const emptyCol = `<div class="ps-col"><div class="ps-pile ps-pile--empty"><span class="ps-empty">دسته خالی</span><span>${fa(0)} کارت</span></div>${veg('lettuce', false)}<span class="ps-veg ps-veg--empty">جای خالی</span></div>`;
  const emptyT = (ph) => `<div class="ps-market" aria-label="بازار">${col('onion-rule-03', 6, 'carrot', 'tomato', false, false)}${col('carrot-rule-02', 3, 'cabbage', 'pepper', false, false)}${emptyCol}</div><p class="ps-hint">${ph ? 'دستهٔ سوم تمام شد' : 'دستهٔ سوم تمام شد؛ جای خالی بازار از ته بزرگ‌ترین دسته پر می‌شود'}</p>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ending = (ph) => modal('پایان بازی', `<p>بازار و دسته‌ها تمام شد. هر دستور جدا حساب شد؛ «بیشترین» و «کمترین» با مقایسهٔ همهٔ بازیکنان.</p>
${tbl(['دستورهای شما', 'وضع', 'امتیاز'], [
      { c: ['بیشترین هویج', `${fa(5)} هویج؛ رضا ${fa(5)} (مساوی)`, fa(10)] },
      { c: ['هر کلم +۳، هر گوجه −۲', `${fa(4)} کلم، ${fa(2)} گوجه`, fa(8)] },
      { c: ['هر هویج و گوجه: ۵', `${fa(2)} جفت`, fa(10)] },
      { c: ['کمترین فلفل: ۷', `${fa(1)} فلفل؛ سارا ${fa(0)}`, fa(0)] },
    ])}
${tbl(['رتبه', 'بازیکن', 'دستورها', 'جمع'], [{ c: [fa(1), 'شما', fa(4), fa(28)], win: true }, { c: [fa(2), 'رضا', fa(3), fa(26)] }, { c: [fa(3), 'نیلوفر', fa(4), fa(21)] }, { c: [fa(4), 'سارا', fa(5), fa(19)] }])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'PointSalad', fa: 'سالاد امتیاز', latin: 'Point Salad', meta: ['زنده', '۴ نفر', '۲۶ کارت در دسته‌ها'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: opp(8, 3, 12) },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', meta: opp(8, 2, 15) },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: opp(7, 4, 11) },
    ],
    me: { cards: ['cabbage-rule-03', 'carrot-rule-08', 'lettuce-rule-14'].map((r) => ({ art: `point-salad-${r}`, alt: `دستور شما: ${RULES[r]}` })), clock: '0:28', turn: true, note: `<span class="cx-note">${fa(9)} امتیاز</span>`, above },
    cardW: 104, phoneCardW: 62, cardRatio: 1.357,
    table,
    status: '<b>نوبت شماست.</b> دو سبزی از بازار بردارید یا یک دستور از بالای دسته‌ها. در همین نوبت می‌توانید یکی از دستورهایتان را به سبزی برگردانید.',
    pstatus: '<b>نوبت شما.</b> دو سبزی یا یک دستور بردارید.',
    railCard: `<section class="cx-card"><h3>سبزی‌های همه</h3><table class="ps-tbl"><thead><tr><th></th>${VEG.map(([v]) => `<th>${sym(v)}</th>`).join('')}</tr></thead><tbody>${row('شما', counts.me)}${row('نیلوفر', counts.nil)}${row('رضا', counts.reza)}${row('سارا', counts.sara)}</tbody></table><div class="ga-rule">${ic('info')}<span>با این هویج با رضا برابر می‌شوید (${fa(4)}) و در تساوی «بیشترین هویج» هر دو ${fa(10)} امتیاز می‌گیرید.</span></div></section>`,
    logNote: `${fa(26)} کارت مانده`,
    log: [[6, 'رضا هویج و پیاز برداشت'], [4, 'سارا دستور «هر کلم +۲» را برداشت'], [2, 'نیلوفر دستور «کلم زوج» را به کاهو برگرداند'], [2, 'نیلوفر گوجه و فلفل برداشت'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین و دستورها', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['eye', 'سبزی‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'متن دستور', turnSub: 'زدن یا لمس طولانی روی کارت دستور', overlay: recipe, phone: true,
        me: { cards: ['cabbage-rule-03', 'carrot-rule-08', 'lettuce-rule-14'].map((r, i) => ({ art: `point-salad-${r}`, alt: `دستور شما: ${RULES[r]}`, sel: i === 0 })) },
        status: '<b>متن دستور.</b> روی هر کارت دستور (دست شما، بازار یا حریف) بزنید یا لمس طولانی کنید تا متن فارسی و وضع فعلی‌اش بیاید.',
        pstatus: '<b>متن دستور</b> با لمس طولانی.',
        log: [[1, 'شما دستور «بیشترین هویج» را باز کردید']],
      },
      {
        shotTitle: 'دستهٔ خالی', turnSub: 'جای خالی بازار و پر شدن از دستهٔ بزرگ‌تر', table: emptyT, meta: ['زنده', '۴ نفر', '۹ کارت در دسته‌ها'],
        status: '<b>دستهٔ سوم تمام شد.</b> جای سبزی بازار که خالی شد از ته بزرگ‌ترین دسته (۶ کارت) پر می‌شود.',
        pstatus: '<b>دستهٔ سوم خالی است.</b>',
        log: [[4, 'سارا آخرین دستور دستهٔ سوم را برداشت'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیاز هر دستور جدا', overlay: ending, meta: ['تمام شد', '۴ نفر', 'بازار خالی'],
        table: (ph) => `<div class="ps-market"></div>`,
        me: { turn: false, clock: '', above: () => '', note: `<span class="cx-note">${fa(28)} امتیاز</span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۲۸ امتیاز بردید.',
        log: [[6, 'رضا آخرین سبزی‌ها را برداشت'], [1, 'شما بردید']],
      },
    ],    css: `.ps-n{white-space:nowrap}
.gc-hand .gc-card{margin-inline-start:10px}.gc-hand .gc-card:first-child{margin-inline-start:0}
.cx-phone .gc-hand .gc-card{margin-inline-start:6px}.cx-phone .gc-hand .gc-card:first-child{margin-inline-start:0}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:7px}
.ps-market{display:flex;gap:26px}
.ps-col{display:grid;justify-items:center;gap:10px}
.ps-rc{display:flex;gap:14px;align-items:flex-start}.ps-rc>img{inline-size:120px;border-radius:8px;box-shadow:0 0 0 3px var(--felt-gold)}.ps-rc>div{display:grid;gap:6px}
.cx-phone .ps-rc>img{inline-size:80px}
.ps-empty{display:grid;place-items:center;inline-size:96px;block-size:130px;border-radius:8px;border:1.5px dashed rgba(250,245,236,.35);color:var(--felt-muted);font-size:12px}
.ps-veg--empty{display:grid;place-items:center;inline-size:80px;block-size:80px;border-radius:8px;border:1.5px dashed var(--felt-gold);color:var(--felt-gold);font-size:11px}
.ps-hint{margin:0;text-align:center;color:var(--felt-muted);font-size:12.5px}
.cx-phone .ps-empty{inline-size:56px;block-size:76px;font-size:10px}.cx-phone .ps-veg--empty{inline-size:48px;block-size:48px;font-size:9.5px}
.ps-pile{display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:12.5px;margin-block-end:4px}
.ps-pile img{inline-size:108px;border-radius:7px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 4px 0 -1px rgba(250,245,236,.25),0 6px 0 -2px rgba(0,0,0,.3),0 14px 18px -10px rgba(0,0,0,.7)}
.ps-veg{position:relative;display:block}
.ps-veg img{display:block;inline-size:82px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 14px -8px rgba(0,0,0,.6)}
.ps-veg.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 16px -8px rgba(0,0,0,.7)}
.ps-veg i{position:absolute;inset-block-start:-8px;inset-inline-end:-8px;inline-size:24px;block-size:24px;border-radius:50%;display:grid;place-items:center;background:var(--felt-gold);color:#142B3B}.ps-veg i .bgv-icon{inline-size:15px;block-size:15px}
.ps-above{display:flex;align-items:center;justify-content:space-between;gap:12px;inline-size:100%;margin-block-end:4px}
.ps-mine{display:flex;gap:4px}
.ps-mine span{display:inline-flex;align-items:center;gap:2px;block-size:32px;padding-inline:5px 8px;border-radius:8px;background:rgba(250,245,236,.08);color:var(--felt-ink);font-size:14px}
.ps-mine span.is-zero{opacity:.45}
.ps-mine span.is-up{box-shadow:inset 0 0 0 1.5px var(--felt-gold)}
.ps-mine img{inline-size:22px;block-size:22px}
.ps-acts{display:flex;align-items:center;gap:8px}
.ps-acts>span{display:grid;color:var(--felt-ink);font-size:13.5px;margin-inline-end:4px}.ps-acts small{color:var(--felt-muted);font-size:12px}
.ps-above--ph{flex-direction:column;align-items:stretch;gap:6px;padding-inline:10px;box-sizing:border-box}
.ps-above--ph .ps-mine{justify-content:center}.ps-above--ph .ps-mine span{block-size:28px;font-size:13px}.ps-above--ph .ps-mine img{inline-size:18px;block-size:18px}
.ps-above--ph .ps-acts>span{flex:1;font-size:12.5px}.ps-above--ph .bgv-btn{padding-inline:10px;font-size:13px}
.ps-tbl{inline-size:100%;border-collapse:collapse;font-size:13.5px;color:var(--text);text-align:center}
.ps-tbl th{padding:4px 2px;font-weight:700;color:var(--heading)}.ps-tbl thead img{inline-size:22px;block-size:22px;vertical-align:middle}
.ps-tbl tbody th{text-align:start;font-size:13px}
.ps-tbl td{padding:4px 2px;border-block-start:1px solid var(--line)}.ps-tbl tbody th{border-block-start:1px solid var(--line)}
.ps-tbl td.is-most{font-weight:700;color:var(--link)}
.cx-phone .ps-market{gap:12px}
.cx-phone .ps-col{gap:5px}.cx-phone .ps-pile{margin:0}
.cx-phone .ps-pile img{inline-size:70px}.cx-phone .ps-veg img{inline-size:52px}
.cx-phone .ps-pile{font-size:11.5px}`,
    shotTitle: 'نوبت شما', turnSub: 'دو سبزی از بازار',
    diffs: [
      ['چیدمان', 'وسط میز بازار: سه دسته با روی دستور به بالا و زیر هر کدام دو سبزی. دست شما پایین در واقع دستورهای جلوی شماست (همه می‌بینند) و سبزی‌هایتان شمرده بالای آن'],
      ['برداشتن', 'دو سبزی را انتخاب می‌کنید (تیک طلایی) یا روی دستور بالای یکی از دسته‌ها می‌زنید؛ بالای دست اثر انتخاب روی امتیاز شما (۹ ← ۲۲) دیده می‌شود'],
      ['برگرداندن دستور', 'دکمهٔ «برگرداندن دستور» یکی از دستورهای شما را انتخابی می‌کند تا به سبزی پشتش تبدیل شود؛ در همان نوبت و فقط یک بار. سبزی به دستور برنمی‌گردد'],
      ['اطلاعات باز', 'همه چیز جز ترتیب دسته‌ها پیداست: روی صندلی تعداد دستور و سبزی و امتیاز هر حریف، و جدول سبزی‌های همه در ستون کنار با پررنگ کردن بیشترین‌ها (برای دستورهای بیشترین و کمترین)'],
      ['تصویر دستورها', 'روی دستورها تصویر اصلی BGA (انگلیسی و نمادین) است؛ موتور دستورهایش را از همان خانواده‌ها می‌سازد ولی کارت به کارت یکی نیست، پس هنگام پیاده‌سازی هر دستور موتور باید به تصویر درستش وصل شود و متن فارسی در راهنما بیاید'],
      ['قوانین', '۲ تا ۶ نفر، از هر سبزی ۳ کارت برای هر نفر (چهارنفره ۷۲ کارت) مثل موتور؛ پایان وقتی همهٔ کارت‌ها برداشته شوند'],
    ],
  };
}
