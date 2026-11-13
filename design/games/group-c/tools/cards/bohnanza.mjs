// Bohnanza on the card-table frame (repo engine: 2–5 players, 150 beans of ten types, fixed hand order, 2 fields + a 3rd for 3 coins).
// Moment: your turn, step 2 (trading). Chili and red are face up; you offer Sara the red + the stink from your hand for one blue.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const NAME = { blue: 'آبی', soy: 'سویا', wax: 'مومی', stink: 'بدبو', garden: 'باغی', coffee: 'قهوه‌ای', chili: 'فلفلی', red: 'قرمز', green: 'سبز' };
  const b = (k, cls = '') => img(`bohnanza-${k}`, `لوبیای ${NAME[k]}`, cls);
  const mini = (k, n) => `<span class="bn-f">${b(k)}<b>${fa(n)}</b></span>`;
  const hc = (n) => `<span class="bn-h">${img('bohnanza-deck', 'کارت دست')}<b>${fa(n)}</b></span>`;
  const coins = (n) => `<span class="bn-c" aria-label="${fa(n)} سکه">${img('bohnanza-thaler', '')}${fa(n)}</span>`;
  const hand = ['wax', 'stink', 'garden', 'coffee', 'chili'].map((k) => ({ art: `bohnanza-${k}`, alt: `لوبیای ${NAME[k]}`, sel: k === 'stink' }));
  const field = (k, n, note, cls = '') => `<div class="bn-field ${cls}">${img('bohnanza-field', 'مزرعه')}<div class="bn-stack">${Array.from({ length: n }, () => b(k)).join('')}</div><span class="bn-field__n">${fa(n)} ${NAME[k]}</span><small>${note}</small></div>`;
  const offer = (to, seat, give, want, st, cls) => `<li class="${cls}"><i style="background:var(--seat-${seat})"></i><span class="bn-to">${to}</span><span class="bn-give">${give}</span>${ic('repeat')}<span class="bn-want">${want}</span><span class="gc-tag${cls === 'is-wait' ? '' : ' gc-tag--soft'}">${st}</span></li>`;
  const table = (ph) => `<div class="bn-board">
<div class="bn-top">${ph ? '' : `<div class="gc-pile" style="--pw:58px">${img('bohnanza-deck', 'دسته')}<span><b>${fa(84)}</b> کارت</span></div>`}<div class="bn-up" aria-label="دو کارت رو شده">${b('chili')}<span class="bn-inoffer">${b('red')}<em>در پیشنهاد</em></span></div>
<ul class="bn-offers" aria-label="پیشنهادها">${offer('سارا', 4, `${b('red')}${b('stink')}`, `${b('blue')}`, 'منتظر جواب', 'is-wait')}${ph ? '' : offer('رضا', 6, `${b('chili')}`, '<span class="bn-gift">بخشش</span>', 'رد کرد', 'is-no')}</ul></div>
<div class="bn-fields">${field('blue', 3, `${fa(4)} تا: ${fa(1)} سکه`)}${field('soy', 2, `برداشت: ${fa(1)} سکه`)}<div class="bn-field is-buy"><span>${ic('zap')}مزرعهٔ سوم<br><small>${fa(3)} سکه</small></span></div></div></div>`;
  const above = (ph) => `<div class="bn-above${ph ? ' bn-above--ph' : ''}"><ol class="bn-steps"><li>کاشتن</li><li class="is-now">معامله</li><li>کاشتن و کشیدن</li></ol><div class="bn-btns">${btn(ph ? 'پیشنهاد' : 'پیشنهاد تازه', 'secondary', 'hand')}${btn('پایان معامله', 'primary', 'check')}</div></div>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const offerIn = (from, seat, give, want, st, cls, acts = '') => `<li class="${cls}"><i style="background:var(--seat-${seat})"></i><span class="bn-to">${from}</span><span class="bn-give">${give}</span>${ic('repeat')}<span class="bn-want">${want}</span>${acts || `<span class="gc-tag gc-tag--soft">${st}</span>`}</li>`;
  const small = (t, k) => `<button type="button" class="bn-sb${k ? ' is-p' : ''}">${t}</button>`;
  const fieldsMe = (third) => `<div class="bn-fields">${field('blue', 3, `${fa(4)} تا: ${fa(1)} سکه`)}${field('soy', 2, `برداشت: ${fa(1)} سکه`)}${third ?? `<div class="bn-field is-buy"><span>${ic('zap')}مزرعهٔ سوم<br><small>${fa(3)} سکه</small></span></div>`}</div>`;
  // §4 counter-offers from the others to the turn player; the turn player picks one
  const table4 = (ph) => `<div class="bn-board">
<div class="bn-top">${ph ? '' : `<div class="gc-pile" style="--pw:58px">${img('bohnanza-deck', 'دسته')}<span><b>${fa(84)}</b> کارت</span></div>`}<div class="bn-up" aria-label="دو کارت رو شده">${b('chili')}${b('red')}</div>
<ul class="bn-offers" aria-label="پیشنهادهای رسیده">${offerIn('نیلوفر', 2, b('coffee'), `${b('red')}`, '', 'is-wait', `<span class="bn-acts">${small('قبول', true)}${small('رد')}</span>`)}${offerIn('سارا', 4, `${b('blue')}`, `${b('red')}${b('stink')}`, '', 'is-wait', `<span class="bn-acts">${small('قبول', true)}${small('رد')}</span>`)}${ph ? '' : offerIn('رضا', 6, '<span class="bn-gift">هیچ</span>', `${b('chili')}`, 'منتظر تأیید رضا', 'is-no')}</ul></div>
${fieldsMe()}</div>`;
  // §5 someone else's turn: you can offer to Sara or say «done»
  const table5 = (ph) => `<div class="bn-board">
<div class="bn-top">${ph ? '' : `<div class="gc-pile" style="--pw:58px">${img('bohnanza-deck', 'دسته')}<span><b>${fa(80)}</b> کارت</span></div>`}<div class="bn-up" aria-label="کارت‌های رو شدهٔ سارا">${b('garden')}${b('wax')}</div>
<ul class="bn-offers" aria-label="پیشنهادها">${offerIn('شما', 1, b('wax'), `${b('garden')}`, 'منتظر سارا', 'is-wait')}${ph ? '' : offerIn('رضا', 6, '', '', 'تمام', 'is-no').replace('<span class="bn-give"></span>' + ic('repeat') + '<span class="bn-want"></span>', '<span class="bn-gift">دیگر پیشنهادی ندارد</span>')}</ul></div>
${fieldsMe()}</div>`;
  const reshuffle = (ph) => modal('دسته تمام شد: بُر خوردن دورریز', `<div class="bn-rs">${img('bohnanza-deck', 'دستهٔ تازه')}<div><p>کارت‌های دورریز بُر خوردند و دستهٔ تازه شدند. دسته در کل ${fa(3)} بار دور می‌زند؛ وقتی برای بار سوم تمام شود بازی تمام است.</p><div class="gc-pills"><span class="bgv-chip">دور دسته: ${fa(2)} از ${fa(3)}</span><span class="bgv-chip">دستهٔ تازه: ${fa(61)} کارت</span><span class="bgv-chip">دورریز: ${fa(0)}</span></div></div></div>`, `${btn('ادامه', 'primary', 'check')}`);
  const ending = (ph) => modal('پایان بازی', `<p>دسته برای بار سوم تمام شد. همهٔ مزرعه‌ها خودکار برداشت شدند و سکه‌هایشان حساب شد.</p>
${tbl(['رتبه', 'بازیکن', 'سکه پیش از پایان', 'برداشت پایانی', 'جمع'], [
      { c: [fa(1), 'شما', fa(12), `${fa(2)}+`, fa(14)], win: true },
      { c: [fa(2), 'رضا', fa(11), `${fa(1)}+`, fa(12)] },
      { c: [fa(3), 'نیلوفر', fa(10), `${fa(2)}+`, fa(12)] },
      { c: [fa(4), 'سارا', fa(9), fa(0), fa(9)] },
    ])}<p class="cx-note">رضا و نیلوفر هر دو ${fa(12)} سکه دارند؛ در تساوی کسی بالاتر است که در ترتیب نوبت دیرتر از نفر اول بازی می‌کند، یعنی رضا.</p>`,
    `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Bohnanza', fa: 'جالیز', latin: 'Bohnanza', meta: ['زنده', '۴ نفر', 'دور دسته: ۱ از ۳'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${hc(6)}${mini('coffee', 5)}${mini('green', 2)}${coins(4)}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${hc(4)}${mini('wax', 3)}${mini('coffee', 2)}${coins(7)}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:20', turn: true, meta: `${hc(5)}${mini('stink', 2)}${mini('red', 1)}${coins(3)}` },
    ],
    me: { cards: hand, clock: '1:12', turn: true, note: `<span class="cx-note">${coins(5)}</span>`, above },
    cardW: 84, phoneCardW: 54, cardRatio: 1.405,
    table,
    status: '<b>نوبت شماست: معامله.</b> به سارا پیشنهاد دادید: قرمزِ رو شده و بدبوی دستتان در برابر یک آبی. تا جواب بدهد می‌توانید پیشنهاد دیگری بدهید.',
    pstatus: '<b>معامله.</b> منتظر جواب سارا به پیشنهادتان.',
    railCard: `<section class="cx-card"><h3>ترتیب دست شما</h3><p class="bn-order"><span>اول دست: <b>مومی</b></span><span>بعدی: <b>بدبو</b></span></p><div class="ga-rule">${ic('info')}<span>ترتیب دست عوض نمی‌شود و نوبت بعد باید مومی را بکارید؛ ولی مزرعه‌ای برایش ندارید. بخشیدن یا معاملهٔ کارت‌های مزاحم دست همین حالا کمکتان می‌کند.</span></div><div class="gc-pills"><span class="bgv-chip">سکه: ${fa(5)}</span><span class="bgv-chip">دورریز: ${fa(12)}</span></div></section>`,
    logNote: 'نوبت شما',
    log: [[1, 'شما آبی کاشتید (مزرعهٔ آبی: ۳)'], [1, 'فلفلی و قرمز رو شد'], [6, 'رضا بخشش فلفلی را رد کرد'], [1, 'به سارا پیشنهاد دادید: قرمز و بدبو در برابر آبی']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'جدول سکه', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['hand', 'پیشنهادها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'پیشنهادهای رسیده', turnSub: 'بقیه به بازیکن نوبت پیشنهاد می‌دهند؛ انتخاب با شماست', table: table4,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${hc(6)}${mini('coffee', 5)}${mini('green', 2)}${coins(4)}<span class="gc-tag">پیشنهاد داد</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${hc(4)}${mini('wax', 3)}${mini('coffee', 2)}${coins(7)}` },
          { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `${hc(5)}${mini('stink', 2)}${mini('red', 1)}${coins(3)}<span class="gc-tag">پیشنهاد داد</span>` },
        ],
        me: { cards: hand.map((c) => ({ ...c, sel: false })) },
        status: '<b>نوبت شماست: معامله.</b> نیلوفر یک قهوه‌ای برای قرمزِ رو شده و سارا یک آبی برای قرمز و بدبو پیشنهاد داده‌اند. هر کدام را بخواهید قبول کنید؛ تصمیم آخر با شماست.',
        pstatus: '<b>دو پیشنهاد رسیده.</b> یکی را قبول کنید.',
        log: [[1, 'فلفلی و قرمز رو شد'], [2, 'نیلوفر پیشنهاد داد: قهوه‌ای در برابر قرمز'], [4, 'سارا پیشنهاد داد: آبی در برابر قرمز و بدبو'], [6, 'رضا فلفلی را مجانی می‌خواهد']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'پیشنهاد به بازیکن نوبت یا «تمام»', table: table5,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${hc(6)}${mini('coffee', 6)}${mini('green', 2)}${coins(4)}<span class="gc-tag gc-tag--soft">تمام</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${hc(4)}${mini('wax', 3)}${mini('coffee', 2)}${coins(7)}<span class="gc-tag gc-tag--soft">تمام</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:44', turn: true, meta: `${hc(4)}${mini('stink', 2)}${mini('garden', 1)}${coins(3)}` },
        ],
        me: { turn: false, clock: '1:12', cards: [{ art: 'bohnanza-wax', alt: 'لوبیای مومی', sel: true }, { art: 'bohnanza-garden', alt: 'لوبیای باغی' }, { art: 'bohnanza-coffee', alt: 'لوبیای قهوه‌ای' }, { art: 'bohnanza-chili', alt: 'لوبیای فلفلی' }, { art: 'bohnanza-red', alt: 'لوبیای قرمز' }],
          above: (ph) => `<div class="bn-above${ph ? ' bn-above--ph' : ''}"><span class="bn-wait">نوبت سارا: معامله</span><div class="bn-btns">${btn(ph ? 'پیشنهاد' : 'پیشنهاد به سارا', 'secondary', 'hand')}${btn(ph ? 'تمام' : 'تمام، پیشنهادی ندارم', 'primary', 'check')}</div></div>` },
        status: '<b>نوبت ساراست.</b> باغی و مومی رو شده. مومی دستتان را برای باغی پیشنهاد داده‌اید. اگر پیشنهاد دیگری ندارید «تمام» بزنید؛ وقتی همه «تمام» بزنند معامله تمام می‌شود.',
        pstatus: '<b>نوبت سارا.</b> پیشنهاد بدهید یا «تمام».',
        log: [[4, 'سارا باغی و مومی را رو کرد'], [2, 'نیلوفر: تمام'], [6, 'رضا: تمام'], [1, 'شما مومی را برای باغی پیشنهاد دادید']],
        phone: true,
      },
      {
        shotTitle: 'بُر خوردن دورریز', turnSub: 'دور دسته ۲ از ۳', meta: ['زنده', '۴ نفر', 'دور دسته: ۲ از ۳'],
        overlay: reshuffle, me: { cards: hand.map((c) => ({ ...c, sel: false })), above: () => '' },
        status: '<b>دسته تمام شد و دورریز بُر خورد.</b> این دور دوم دسته است؛ بعد از دور سوم بازی تمام می‌شود.',
        log: [[1, 'شما آخرین کارت‌های دسته را کشیدید'], [1, 'دورریز بُر خورد: دور دوم دسته']],
      },
      {
        shotTitle: 'میز سه‌نفره', turnSub: 'هر نفر از اول سه مزرعه دارد؛ خرید مزرعه نیست',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${hc(6)}${mini('coffee', 5)}${mini('green', 2)}${mini('red', 1)}${coins(4)}` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${hc(4)}${mini('wax', 3)}${mini('coffee', 2)}${mini('soy', 1)}${coins(7)}` },
        ],
        meta: ['زنده', '۳ نفر', 'دور دسته: ۱ از ۳'],
        table: (ph) => `<div class="bn-board"><div class="bn-top">${ph ? '' : `<div class="gc-pile" style="--pw:58px">${img('bohnanza-deck', 'دسته')}<span><b>${fa(98)}</b> کارت</span></div>`}<div class="bn-up" aria-label="دو کارت رو شده">${b('chili')}${b('red')}</div></div>${fieldsMe(field('stink', 2, `${fa(5)} تا: ${fa(2)} سکه`))}</div>`,
        me: { cards: hand.map((c) => ({ ...c, sel: false })), above },
        status: '<b>میز سه‌نفره.</b> هر نفر از اول سه مزرعه دارد و مزرعهٔ سوم خریدنی نیست. باقی قانون‌ها مثل میز چهارنفره است.',
        pstatus: '<b>سه‌نفره:</b> سه مزرعه از اول.',
        log: [[1, 'شما آبی کاشتید'], [1, 'فلفلی و قرمز رو شد']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'برداشت خودکار، سکه‌ها و تساوی', meta: ['تمام شد', '۴ نفر', 'دور دسته: ۳ از ۳'],
        overlay: ending, me: { cards: [], turn: false, clock: '', above: () => '', note: `<span class="cx-note">${coins(14)}</span>` },
        table: (ph) => `<div class="bn-board">${fieldsMe('')}</div>`,
        railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۱۴ سکه بردید.',
        log: [[4, 'سارا آخرین کارت دسته را کشید'], [1, 'مزرعه‌ها برداشت شد'], [1, 'شما بردید']],
      },
    ],    css: `.bn-f,.bn-h{display:inline-flex;align-items:center;gap:2px}.bn-f img,.bn-h img{inline-size:15px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.4)}.bn-f b,.bn-h b{color:var(--felt-ink);font-weight:700}
.bn-c{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;color:var(--felt-ink);font-weight:700}.bn-c img{inline-size:24px;block-size:24px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.cx-note .bn-c{color:inherit}
.gc-seat .gc-tag{white-space:nowrap}
.bn-board{display:grid;justify-items:center;gap:16px;inline-size:100%}
.bn-top{display:flex;align-items:center;gap:20px}
.bn-up{display:flex;gap:10px}
.bn-up img{display:block;inline-size:86px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 10px 14px -8px rgba(0,0,0,.6)}
.bn-inoffer{position:relative;display:block}.bn-inoffer img{opacity:.55;box-shadow:0 0 0 2px var(--felt-gold),0 10px 14px -8px rgba(0,0,0,.6)}
.bn-inoffer em{position:absolute;inset-inline:-6px;inset-block-start:40%;text-align:center;font-style:normal;font-size:11px;font-weight:700;padding:2px 4px;border-radius:6px;background:var(--felt-gold);color:#142B3B}
.bn-offers{list-style:none;margin:0;padding:0;display:grid;gap:6px;min-inline-size:300px}
.bn-offers li{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(250,245,236,.07);color:var(--felt-ink);font-size:13px}
.bn-offers li.is-wait{box-shadow:inset 0 0 0 1.5px var(--felt-gold)}
.bn-offers li.is-no{opacity:.6}
.bn-offers li>i{inline-size:8px;block-size:8px;border-radius:50%}
.bn-to{font-weight:700;inline-size:44px}
.bn-give,.bn-want{display:inline-flex;gap:3px}.bn-give img,.bn-want img{inline-size:30px;border-radius:3px}
.bn-offers .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-muted)}
.bn-gift{font-size:12px;color:var(--felt-muted)}
.bn-offers .gc-tag{margin-inline-start:auto}
.bn-fields{display:flex;gap:16px;align-items:flex-start}
.bn-field{position:relative;display:grid;justify-items:center;gap:2px;inline-size:126px;color:var(--felt-ink);font-size:12.5px}
.bn-field>img{inline-size:126px;display:block;border-radius:8px}
.bn-stack{position:absolute;inset-block-start:24px;inset-inline:0;display:grid;justify-items:center}
.bn-stack img{inline-size:76px;border-radius:5px;box-shadow:0 2px 3px rgba(0,0,0,.5);margin-block-start:-90px}
.bn-stack img:first-child{margin-block-start:0}
.bn-field__n{font-weight:700;margin-block-start:4px}
.bn-field small{color:var(--felt-muted);font-size:11.5px}
.bn-field.is-buy{block-size:177px;border-radius:8px;border:1.5px dashed rgba(250,245,236,.3);display:grid;place-items:center;text-align:center;color:var(--felt-muted);box-sizing:border-box}
.bn-field.is-buy .bgv-icon{display:block;margin:0 auto 4px;color:var(--felt-gold)}
.bn-above{display:flex;align-items:center;justify-content:center;gap:16px;inline-size:100%;margin-block-end:4px}
.bn-steps{display:flex;gap:4px;margin:0;padding:0;list-style:none;counter-reset:s}
.bn-steps li{counter-increment:s;display:inline-flex;align-items:center;gap:5px;block-size:28px;padding-inline:10px;border-radius:999px;background:rgba(250,245,236,.08);color:var(--felt-muted);font-size:12.5px}
.bn-steps li::before{content:counter(s,persian);font-weight:700}
.bn-steps li.is-now{background:var(--felt-gold);color:#142B3B;font-weight:700}
.bn-btns{display:flex;gap:8px}
.bn-above--ph{flex-direction:column;gap:6px;padding-inline:10px;box-sizing:border-box}
.bn-above--ph .bn-btns{inline-size:100%}.bn-above--ph .bn-btns .bgv-btn{flex:1}
.bn-order{margin:0;display:flex;gap:16px;font-size:14px;color:var(--text)}.bn-order b{color:var(--heading)}
.cx-phone .bn-board{gap:8px;padding-inline:10px;box-sizing:border-box}
.cx-phone .bn-top{gap:10px}
.cx-phone .bn-up img{inline-size:46px}
.cx-phone .bn-offers{min-inline-size:0;flex:1}.cx-phone .bn-offers li{flex-wrap:wrap;gap:5px;padding:5px 8px;font-size:12px}.cx-phone .bn-give img,.cx-phone .bn-want img{inline-size:22px}
.cx-phone .bn-fields{gap:8px}.cx-phone .bn-field{inline-size:84px;font-size:11.5px}.cx-phone .bn-field>img{inline-size:84px}
.cx-phone .bn-stack{inset-block-start:20px}.cx-phone .bn-stack img{inline-size:54px;margin-block-start:-64px}.cx-phone .bn-stack img:first-child{margin-block-start:0}
.cx-phone .bn-field.is-buy{block-size:118px;font-size:11px}
.cx-phone .gc-seat__meta .bn-h{display:none}
.bn-acts{display:inline-flex;gap:4px;margin-inline-start:auto}
.bn-sb{all:unset;box-sizing:border-box;cursor:pointer;block-size:28px;padding-inline:10px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(250,245,236,.14);color:var(--felt-ink)}
.bn-sb.is-p{background:var(--felt-gold);color:#142B3B}
.bn-wait{font-size:13.5px;color:var(--felt-muted);font-weight:700}
.bn-rs{display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:start}.bn-rs>img{inline-size:100%;border-radius:6px}.bn-rs>div{display:grid;gap:10px}`,
    shotTitle: 'مرحلهٔ معامله', turnSub: 'پیشنهاد به حریف',
    diffs: [
      ['چیدمان', 'وسط میز بالا دو کارت رو شده و فهرست پیشنهادهای این نوبت، پایین مزرعه‌های شما با لوبیاهای کاشته و جای مزرعهٔ سوم. مزرعه‌های حریف‌ها کوچک روی صندلی‌شان (نوع و تعداد) با سکه'],
      ['ترتیب ثابت دست', 'دست شما بادبزن است ولی جابه‌جا نمی‌شود؛ کارت اول (سمت چپ) همانی است که نوبت بعد باید کاشته شود و در کارت ستون کنار اسمش آمده. کارت‌های تازه به ته دست (سمت راست) اضافه می‌شوند'],
      ['معامله', 'فقط بازیکن نوبت پیشنهاد می‌دهد: کارت‌های رو شده یا هر کارت دست (اینجا بدبو بالا آمده) در برابر نوع لوبیایی که از حریف می‌خواهد. پیشنهادها فهرست می‌شوند با وضعیت «منتظر جواب»، «پذیرفت» یا «رد کرد»؛ پیشنهاد بی‌عوض «بخشش» است'],
      ['طرف مقابل', 'برای حریفی که پیشنهاد گرفته، همین فهرست با دکمه‌های «قبول» و «رد» در بالای دستش می‌آید و ساعتش می‌چرخد (اینجا سارا)'],
      ['مراحل نوبت', 'سه مرحله بالای دست: کاشتن، معامله، کاشتن و کشیدن؛ «پایان معامله» کارت‌های رو شدهٔ باقی را به شما می‌دهد. برداشت مزرعه با زدن روی مزرعه و پیش‌نمایش سکه زیر آن'],
      ['قوانین', '۲ تا ۵ نفر؛ دسته مثل دفترچه سه بار دور می‌زند و شمارنده‌اش در نوار بالاست (موتور فعلاً یک بار؛ کارش در RULES.md آمده). سکه با تالر نسخهٔ Amigo و عدد کنارش نشان داده می‌شود (تالر با GPT ساخته و با عکس قطعهٔ واقعی مقایسه شد؛ نقاشی وسطش تقریبی است چون تنها عکس مرجع تار بود)'],
    ],
  };
}
