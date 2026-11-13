// Sea Salt & Paper on the card-table frame (repo engine: 2–4 players, 58 cards, target 30 for four players).
// Moment: you drew two from the deck — keep the third shell, put the crab on a discard pile. Then 11 points: «بس» or «آخرین فرصت».
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const N = { '00': 'پری دریایی', '01': 'خرچنگ', '03': 'خرچنگ', 10: 'قایق', 12: 'قایق', 14: 'قایق', 18: 'ماهی', 19: 'ماهی', 25: 'شناگر', 30: 'کوسه', 35: 'صدف', 36: 'صدف', 39: 'صدف', 45: 'هشت‌پا', 46: 'پنگوئن' };
  const c = (n, cls = '') => img(`sea-salt-paper-${n}`, N[n], cls);
  const duo = (a, b, label) => `<span class="sp-duo" title="${label}">${c(a)}${c(b)}</span>`;
  // printed colour of each card (read from the BGA faces); labelled under the hand cards so mermaids and the colour bonus are readable
  const COL = { '00': ['سفید', '#F3F1EA'], '01': ['سرمه‌ای', '#1F3B73'], '03': ['آبی روشن', '#5FC3D6'], 10: ['سرمه‌ای', '#1F3B73'], 12: ['آبی روشن', '#5FC3D6'], 14: ['سیاه', '#1D1F24'], 18: ['سرمه‌ای', '#1F3B73'], 19: ['سرمه‌ای', '#1F3B73'], 25: ['سرمه‌ای', '#1F3B73'], 30: ['سرمه‌ای', '#1F3B73'], 35: ['سرمه‌ای', '#1F3B73'], 36: ['آبی روشن', '#5FC3D6'], 39: ['سبز', '#7BC67B'], 45: ['خاکستری', '#A3A7A8'], 46: ['بنفش', '#8C6BC8'] };
  const lab = (n) => `<span class="sp-cl">${c(n)}<i style="--c:${COL[n][1]}">${COL[n][0]}</i></span>`;
  const hand = ['01', '35', '39', '00', '46'].map((n) => ({ html: lab(n), alt: N[n] }));
  const table = (ph) => `<div class="sp-board">
<div class="sp-piles"><div class="gc-pile" style="--pw:92px;--ppw:62px">${img('sea-salt-paper-back', 'دسته')}<span><b>${fa(25)}</b> کارت</span></div>
<div class="gc-pile sp-disc is-target" style="--pw:92px;--ppw:62px">${c('14')}<span>کپهٔ ${fa(1)}${ph ? '' : `: <b>${fa(4)}</b>`}</span></div>
<div class="gc-pile sp-disc" style="--pw:92px;--ppw:62px">${c('45')}<span>کپهٔ ${fa(2)}${ph ? '' : `: <b>${fa(3)}</b>`}</span></div></div>
<div class="sp-drawn" aria-label="دو کارتی که کشیدید"><span class="sp-drawn__t">${ph ? 'یکی را نگه دارید' : 'دو کارت کشیدید؛ یکی را نگه دارید'}</span><div><figure class="is-keep">${c('36')}<figcaption>نگه می‌دارید</figcaption></figure><figure class="is-drop">${c('03')}<figcaption>${ph ? 'به کپهٔ ۱' : 'روی کپهٔ ۱ می‌رود'}</figcaption></figure></div></div>
${ph ? '' : `<div class="sp-mine"><span>جفت‌های رو‌شدهٔ شما</span>${duo('10', '12', 'دو قایق')}</div>`}</div>`;
  const above = (ph) => `<div class="sp-above${ph ? ' sp-above--ph' : ''}"><ol class="sp-steps"><li class="is-now">برداشتن</li><li>جفت‌ها</li><li>پایان نوبت</li></ol><div class="sp-btns">${btn('نگه دار', 'primary', 'check')}${btn(ph ? 'کپهٔ ۲' : 'خرچنگ به کپهٔ ۲', 'secondary', 'repeat')}</div></div>`;
  const { modal } = H;
  const pick = (name, seatN, n, off, sel) => `<button type="button" class="sp-op${sel ? ' is-sel' : ''}"${off ? ' disabled' : ''}><i style="background:var(--seat-${seatN})"></i>${name}<small>${off ? 'دست خالی' : `${fa(n)} کارت`}</small></button>`;
  const steal = (ph) => `<div class="sp-above${ph ? ' sp-above--ph' : ''}"><span class="sp-q">${ph ? 'از چه کسی؟' : 'کوسه و شناگر: از دست چه کسی یک کارت تصادفی برمی‌دارید؟'}</span><div class="sp-ops">${pick('نیلوفر', 2, 4)}${pick('رضا', 6, 6, false, true)}${pick('سارا', 4, 0, true)}</div>${btn('بردار', 'primary', 'check')}</div>`;
  const crab = (ph) => modal('خرچنگ‌ها: کپهٔ ۱', `<p>کپهٔ ${fa(1)} را انتخاب کردید. همهٔ کارت‌هایش را <b>فقط شما</b> می‌بینید؛ یکی را بردارید و بقیه به همان ترتیب برمی‌گردند.</p><div class="sp-pile">${['14', '18', '45', '39'].map((n, i) => `<button type="button" class="sp-pc${i === 3 ? ' is-sel' : ''}">${lab(n)}</button>`).join('')}</div>`, `${btn('کپهٔ دیگر', 'secondary', 'repeat')}${btn('برداشتن صدف سبز', 'primary', 'check')}`);
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const handEnd = (ph) => modal('پایان دست ۳: آخرین فرصت موفق بود', `<p>شما «آخرین فرصت» گفتید و بعد از یک نوبت دیگرِ همه، باز بیشترین امتیاز کارت را داشتید: امتیاز کارت‌ها به‌اضافهٔ پاداش رنگ مال شماست و بقیه فقط پاداش رنگ می‌گیرند.</p>
${tbl(['بازیکن', 'امتیاز کارت‌ها', 'پاداش رنگ', 'این دست', 'جمع'], [
      { c: ['شما', fa(13), `${fa(3)} (سرمه‌ای)`, `${fa(16)}+`, fa(30)], win: true },
      { c: ['نیلوفر', `<s>${fa(8)}</s>`, `${fa(3)} (سیاه)`, `${fa(3)}+`, fa(25)] },
      { c: ['سارا', `<s>${fa(11)}</s>`, `${fa(3)} (سرمه‌ای)`, `${fa(3)}+`, fa(20)] },
      { c: ['رضا', `<s>${fa(5)}</s>`, `${fa(2)} (زرد)`, `${fa(2)}+`, fa(11)] },
    ])}<p class="cx-note">با ${fa(30)} امتیاز به هدف ${fa(30)} رسیدید و بازی تمام شد. اگر شکست می‌خوردید فقط پاداش رنگ می‌گرفتید و بقیه امتیاز کارت‌هایشان را. «بس» دست را بی‌نوبت اضافه می‌بندد و همه امتیاز کارت‌هایشان را می‌گیرند؛ اگر دسته تمام شود دست بی‌امتیاز بسته می‌شود.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const mermaids = (ph) => modal('نیلوفر چهار پری دریایی دارد', `<div class="sp-pile">${[0, 1, 2, 3].map(() => c('00')).join('')}</div><p>چهار پری دریایی یعنی <b>برد فوری</b>: بازی همین حالا به نفع نیلوفر تمام شد، بی‌توجه به امتیازها.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'SeaSaltPaper', fa: 'نمک دریایی و کاغذ', latin: 'Sea Salt & Paper', meta: ['زنده', '۴ نفر', 'هدف ۳۰ امتیاز'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${backs('sea-salt-paper-back', 4, 3)}${duo('18', '19', 'دو ماهی')}<span class="gc-tag gc-tag--soft">${fa(22)}</span>` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:45', meta: `${backs('sea-salt-paper-back', 6, 3)}<span class="gc-tag gc-tag--soft">${fa(9)}</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${backs('sea-salt-paper-back', 3, 3)}${duo('25', '30', 'شناگر و کوسه')}<span class="gc-tag gc-tag--soft">${fa(17)}</span>` },
    ],
    me: { cards: hand, clock: '0:33', turn: true, note: `<span class="cx-note">کل: ${fa(14)}</span>`, above },
    cardW: 88, phoneCardW: 60, cardRatio: 1.396,
    table,
    status: '<b>نوبت شماست.</b> دو کارت کشیدید: صدف را نگه دارید و خرچنگ را روی یکی از کپه‌ها بگذارید. بعد با ۱۱ امتیاز می‌توانید «بس» یا «آخرین فرصت» بگویید.',
    pstatus: '<b>نوبت شما.</b> یکی را نگه دارید، دیگری را دور بریزید.',
    railCard: `<section class="cx-card"><h3>امتیاز این دست</h3><ul class="sp-sum"><li><span>صدف × ${fa(3)}</span><b>${fa(6)}</b></li><li><span>پنگوئن</span><b>${fa(1)}</b></li><li><span>جفت قایق (رو‌شده)</span><b>${fa(1)}</b></li><li><span>پری دریایی (سرمه‌ای × ${fa(3)})</span><b>${fa(3)}</b></li><li class="is-total"><span>با صدفی که نگه می‌دارید</span><b>${fa(11)}</b></li></ul><div class="ga-rule">${ic('info')}<span>«بس» دست را همین حالا می‌بندد. «آخرین فرصت» یعنی بقیه یک نوبت دیگر دارند؛ اگر باز هم بیشترین باشید پاداش رنگ هم می‌گیرید، وگرنه فقط پاداش رنگ.</span></div></section>`,
    logNote: `دست ${fa(3)}`,
    log: [[2, 'نیلوفر دو ماهی رو کرد و کارت روی دسته را برداشت'], [6, 'رضا هشت‌پا را از کپهٔ ۲ برداشت'], [4, 'سارا با شناگر و کوسه یک کارت از رضا دزدید'], [1, 'شما دو کارت کشیدید']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${btn('بس', 'secondary', 'pause', ' disabled')}${btn('آخرین فرصت', 'primary', 'zap', ' disabled')}${ibtn('list', 'امتیاز کارت‌ها', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['pause', 'بس'], ['zap', 'آخرین فرصت'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'کوسه و شناگر', turnSub: 'انتخاب حریفی که کارت دارد',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${backs('sea-salt-paper-back', 4, 3)}${duo('18', '19', 'دو ماهی')}<span class="gc-tag gc-tag--soft">${fa(22)}</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:45', meta: `${backs('sea-salt-paper-back', 6, 3)}<span class="gc-tag">هدف</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `<span class="gc-tag gc-tag--soft">دست خالی</span><span class="gc-tag gc-tag--soft">${fa(17)}</span>` },
        ],
        table: (ph) => `<div class="sp-board"><div class="sp-piles"><div class="gc-pile" style="--pw:92px;--ppw:62px">${img('sea-salt-paper-back', 'دسته')}<span><b>${fa(23)}</b> کارت</span></div><div class="gc-pile sp-disc" style="--pw:92px;--ppw:62px">${c('03')}<span>کپهٔ ${fa(1)}</span></div><div class="gc-pile sp-disc" style="--pw:92px;--ppw:62px">${c('45')}<span>کپهٔ ${fa(2)}</span></div></div><div class="sp-mine"><span>جفتی که رو کردید</span>${duo('25', '30', 'شناگر و کوسه')}</div></div>`,
        me: { cards: ['35', '39', '00', '46', '36'].map((n) => ({ html: lab(n), alt: N[n] })), above: steal },
        status: '<b>شناگر و کوسه را رو کردید.</b> از دست یکی از حریف‌ها یک کارت تصادفی برمی‌دارید. سارا کارتی در دست ندارد، پس انتخاب‌شدنی نیست.',
        pstatus: '<b>دزدی.</b> حریف را انتخاب کنید.',
        phone: true,
        log: [[4, 'سارا آخرین کارت دستش را جفت کرد'], [1, 'شما شناگر و کوسه را رو کردید']],
      },
      {
        shotTitle: 'دو خرچنگ', turnSub: 'دیدن یک کپه فقط برای خودتان و برداشتن یک کارت',
        table: (ph) => `<div class="sp-board"><div class="sp-piles"><div class="gc-pile" style="--pw:92px;--ppw:62px">${img('sea-salt-paper-back', 'دسته')}<span><b>${fa(23)}</b> کارت</span></div><div class="gc-pile sp-disc is-target" style="--pw:92px;--ppw:62px">${c('14')}<span>کپهٔ ${fa(1)}: <b>${fa(4)}</b></span></div><div class="gc-pile sp-disc" style="--pw:92px;--ppw:62px">${c('45')}<span>کپهٔ ${fa(2)}</span></div></div><div class="sp-mine"><span>جفتی که رو کردید</span>${duo('01', '03', 'دو خرچنگ')}</div></div>`, overlay: crab,
        me: { cards: ['35', '00', '46', '36'].map((n) => ({ html: lab(n), alt: N[n] })), above: () => '' },
        status: '<b>دو خرچنگ را رو کردید.</b> کپهٔ ۱ را انتخاب کردید؛ کارت‌هایش را فقط شما می‌بینید. یکی را بردارید.',
        log: [[6, 'رضا یک کارت از دسته کشید'], [1, 'شما دو خرچنگ رو کردید و کپهٔ ۱ را نگاه می‌کنید']],
      },
      {
        shotTitle: 'پایان دست', turnSub: 'آخرین فرصت، امتیاز کارت‌ها و پاداش رنگ', meta: ['تمام شد', '۴ نفر', 'هدف ۳۰ امتیاز'],
        table: (ph) => `<div class="sp-board"><div class="sp-piles"><div class="gc-pile" style="--pw:92px;--ppw:62px">${img('sea-salt-paper-back', 'دسته')}<span><b>${fa(19)}</b> کارت</span></div></div></div>`, overlay: handEnd,
        me: { turn: false, clock: '', cards: ['01', '35', '39', '00', '46', '36'].map((n) => ({ html: lab(n), alt: N[n] })), above: () => '', note: `<span class="cx-note">کل: ${fa(30)}</span>` },
        railCard: '',
        status: '<b>آخرین فرصت شما موفق بود.</b> ۱۶ امتیاز گرفتید و با ۳۰ امتیاز بازی را بردید.',
        log: [[1, 'شما «آخرین فرصت» گفتید'], [2, 'نیلوفر نوبت آخرش را بازی کرد'], [4, 'سارا نوبت آخرش را بازی کرد'], [1, 'شما بیشترین امتیاز را داشتید']],
      },
      {
        shotTitle: 'چهار پری دریایی', turnSub: 'برد فوری', phone: true, phoneOnly: true, meta: ['تمام شد', '۴ نفر', 'هدف ۳۰ امتیاز'],
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `<span class="gc-tag">${ic('trophy')}برد فوری</span>` },
          { name: 'رضا', av: 'ر', seat: 6, meta: backs('sea-salt-paper-back', 6, 3) },
          { name: 'سارا', av: 'س', seat: 4, meta: backs('sea-salt-paper-back', 3, 3) },
        ],
        overlay: mermaids, me: { turn: false, clock: '', above: () => '' },
        pstatus: '<b>نیلوفر برد.</b> چهار پری دریایی.', status: '',
      },
    ],    css: `.sp-duo{display:inline-flex}.sp-duo img{inline-size:17px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.45)}.sp-duo img+img{margin-inline-start:-6px}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:7px}
.sp-board{display:grid;justify-items:center;gap:18px}
.sp-piles{display:flex;gap:22px;align-items:flex-end}
.sp-disc.is-target img{box-shadow:0 0 0 3px var(--felt-gold),0 12px 20px -10px rgba(0,0,0,.7)}
.sp-drawn{display:grid;justify-items:center;gap:8px;padding:10px 18px 12px;border-radius:14px;background:rgba(250,245,236,.07);box-shadow:inset 0 0 0 1.5px rgba(232,166,66,.5)}
.sp-drawn__t{color:var(--felt-ink);font-size:13.5px;font-weight:700}
.sp-drawn>div{display:flex;gap:16px}
.sp-drawn figure{margin:0;display:grid;justify-items:center;gap:6px;font-size:12px;color:var(--felt-muted)}
.sp-drawn img{inline-size:96px;border-radius:7px;box-shadow:0 10px 16px -8px rgba(0,0,0,.6)}
.sp-drawn .is-keep img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 16px -8px rgba(0,0,0,.7)}
.sp-drawn .is-keep figcaption{color:var(--felt-gold);font-weight:700}
.sp-drawn .is-drop img{opacity:.7;transform:rotate(-4deg)}
.sp-mine{display:flex;align-items:center;gap:10px;color:var(--felt-muted);font-size:12.5px}
.sp-mine .sp-duo img{inline-size:42px;border-radius:4px}.sp-mine .sp-duo img+img{margin-inline-start:-14px}
.sp-above{display:flex;align-items:center;justify-content:center;gap:18px;inline-size:100%;margin-block-end:4px}
.sp-steps{display:flex;gap:4px;margin:0;padding:0;list-style:none;counter-reset:s}
.sp-steps li{counter-increment:s;display:inline-flex;align-items:center;gap:5px;block-size:28px;padding-inline:10px;border-radius:999px;background:rgba(250,245,236,.08);color:var(--felt-muted);font-size:12.5px}
.sp-steps li::before{content:counter(s,persian);font-weight:700}
.sp-steps li.is-now{background:var(--felt-gold);color:#142B3B;font-weight:700}
.sp-btns{display:flex;gap:8px}
.sp-above--ph{flex-direction:column;gap:6px;padding-inline:10px;box-sizing:border-box}
.sp-above--ph .sp-btns{inline-size:100%}.sp-above--ph .sp-btns .bgv-btn{flex:1}
.sp-sum{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:13.5px;color:var(--text)}
.sp-sum li{display:flex;justify-content:space-between}.sp-sum b{color:var(--heading)}
.sp-sum li.is-total{border-block-start:1px solid var(--line);padding-block-start:6px;font-weight:700}.sp-sum li.is-total b{color:var(--link);font-size:16px}
.cx-phone .sp-board{gap:10px}
.cx-phone .sp-piles{gap:12px}
.cx-phone .sp-drawn{padding:6px 12px 8px}.cx-phone .sp-drawn img{inline-size:66px}.cx-phone .sp-drawn>div{gap:10px}
.cx-phone .gc-seat__meta .gc-backs{display:none}
.cx-phone .bgv-gamebar__name .bgv-latin{display:none}
.cx-phone .sp-board{padding-block-start:4px}
.sp-cl{position:relative;display:block}.sp-cl>i{position:absolute;inset-inline:4%;inset-block-end:-9px;direction:rtl;display:flex;align-items:center;justify-content:center;gap:4px;block-size:18px;border-radius:999px;background:#FAF5EC;color:#142B3B;font-style:normal;font-size:10.5px;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap}
.sp-cl>i::before{content:"";inline-size:9px;block-size:9px;border-radius:50%;background:var(--c);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.cx-phone .sp-cl>i{font-size:8px;block-size:15px;inset-inline:0;gap:2px}
.gc-card{margin-inline-start:6px}.cx-phone .gc-card{margin-inline-start:-8px}.gc-card:first-child{margin-inline-start:0}.cx-phone .sp-cl>i::before{inline-size:7px;block-size:7px}
.gc-hand{padding-block-end:12px}
.sp-q{color:var(--felt-ink);font-size:13.5px;font-weight:700;max-inline-size:220px}
.sp-ops{display:flex;gap:6px}
.sp-op{all:unset;box-sizing:border-box;cursor:pointer;white-space:nowrap;display:grid;grid-template-columns:auto auto;align-items:center;column-gap:6px;padding:6px 12px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-weight:700}
.sp-op i{grid-row:1/3;inline-size:9px;block-size:9px;border-radius:50%}.sp-op small{font-size:10.5px;font-weight:500;color:var(--felt-muted)}
.sp-op.is-sel{background:var(--felt-gold);color:#142B3B}.sp-op.is-sel small{color:#142B3B}.sp-op:disabled{opacity:.45}
.sp-above--ph .sp-ops{inline-size:100%;justify-content:space-between}.sp-above--ph .sp-op{padding:6px 8px;font-size:12.5px}
.sp-pile{display:flex;gap:10px;justify-content:center;padding-block-end:10px}.sp-pile img{inline-size:84px;border-radius:6px}
.sp-pc{all:unset;cursor:pointer;border-radius:8px}.sp-pc.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}
.cx-phone .sp-pile img{inline-size:58px}`,
    shotTitle: 'دو بکش، یکی نگه دار', turnSub: 'و بعد بس یا آخرین فرصت',
    diffs: [
      ['چیدمان', 'وسط میز دسته و دو کپهٔ دورریز (کارت رو و تعداد)، زیرش دو کارتی که کشیده‌اید و جفت‌های رو‌شدهٔ شما. جفت‌های رو‌شدهٔ حریف‌ها کوچک روی صندلی‌شان'],
      ['دو بکش، یکی نگه دار', 'دو کارت کشیده‌شده فقط برای شما رو می‌شود: یکی با قاب طلایی «نگه می‌دارید»، دیگری کج و کم‌رنگ به کپهٔ هدف (قاب طلایی روی کپه) می‌رود؛ با دکمه کپه را عوض می‌کنید. اگر کپه‌ای خالی باشد فقط همان'],
      ['مراحل نوبت', 'سه مرحله بالای دست: برداشتن، جفت‌ها، پایان نوبت. در مرحلهٔ جفت‌ها کارت‌های جفت دست بالا می‌آیند و اثرشان (نگاه به کپه، نوبت اضافه، کارت دسته، دزدی) روی دکمه نوشته می‌شود'],
      ['بس و آخرین فرصت', 'در ردیف دکمه‌های ستون کنار و در نوار پایین گوشی؛ تا وقتی امتیاز کارت‌ها به ۷ نرسیده یا مرحلهٔ پایان نوبت نیست، غیرفعال‌اند. کارت ستون کنار امتیاز دست فعلی را ریز به ریز نشان می‌دهد'],
      ['رنگ کارت‌ها', 'زیر هر کارت دست برچسب رنگ چاپی‌اش آمده تا پری دریایی و پاداش رنگ خواندنی باشد؛ موتور فعلاً رنگ‌ها را چرخشی می‌دهد و باید با رنگ چاپی یکی شود (کارش در RULES.md آمده)'],
      ['قوانین', '۲ تا ۴ نفر مثل موتور؛ هدف ۴۰، ۳۵ و ۳۰ برای دو، سه و چهار نفر، چهار پری دریایی برد فوری. تمام شدن دسته دست را بی‌امتیاز می‌بندد'],
    ],
  };
}
