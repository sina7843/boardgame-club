// UNO on the card-table frame (official Mattel rules, as the repo engine).
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const hand = [
    { art: 'uno-r-num-3', alt: '۳ قرمز', ok: true },
    { art: 'uno-r-skip', alt: 'ردشدن قرمز', ok: true, sel: true },
    { art: 'uno-g-num-5', alt: '۵ سبز', ok: true },
    { art: 'uno-b-num-8', alt: '۸ آبی', dim: true },
    { art: 'uno-y-d2', alt: '+۲ زرد', dim: true },
    { art: 'uno-b-rev', alt: 'برگشت آبی', dim: true },
    { art: 'uno-wild', alt: 'رنگی', ok: true },
  ];
  const table = (ph) => `<div class="gc-pile" style="--pw:118px;--ppw:80px">${img('uno-back', 'دستهٔ کشیدن')}<span><b>${fa(58)}</b> کارت</span></div>
<div class="gc-pile uno-disc" style="--pw:130px;--ppw:88px">${img('uno-r-num-5', 'کارت رو: ۵ قرمز')}<span class="uno-color"><i></i>رنگ: <b>قرمز</b></span></div>
<div class="uno-dir" aria-label="جهت بازی: ساعتگرد">${ic('repeat')}<span>ساعتگرد</span></div>`;
  const { modal } = H;
  const COL = { r: ['قرمز', '#D6312B'], y: ['زرد', '#F2B705'], g: ['سبز', '#3C9A48'], b: ['آبی', '#1F6FB8'] };
  const tableOf = (top, alt, c, n = 58) => (ph) => `<div class="gc-pile" style="--pw:118px;--ppw:80px">${img('uno-back', 'دستهٔ کشیدن')}<span><b>${fa(n)}</b> کارت</span></div>
<div class="gc-pile uno-disc" style="--pw:130px;--ppw:88px;--uc:${c ? COL[c][1] : '#8A97A0'}">${img(top, alt)}<span class="uno-color"><i></i>رنگ: <b>${c ? COL[c][0] : 'هنوز انتخاب نشده'}</b></span></div>
<div class="uno-dir" aria-label="جهت بازی: ساعتگرد">${ic('repeat')}<span>ساعتگرد</span></div>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const picker = (ph) => modal('رنگ را انتخاب کنید', `<p>کارت رنگی را گذاشتید. هر رنگی را می‌توانید انتخاب کنید، حتی همان قرمز.</p><div class="uno-cps">${[['r', 2], ['g', 1], ['b', 2], ['y', 1]].map(([k, n], i) => `<button type="button" class="uno-cp${i === 2 ? ' is-sel' : ''}" style="--c:${COL[k][1]}"><i></i>${COL[k][0]}<small>${fa(n)} کارت در دست</small></button>`).join('')}</div>`, `${btn('تأیید آبی', 'primary', 'check')}`);
  const challenge = (ph) => modal('نیلوفر برایتان ‎+۴ گذاشت', `<div class="uno-ch">${img('uno-wd4', 'کارت رنگی ‎+۴')}<div><p>نیلوفر رنگ را <b>آبی</b> کرد. رنگ قبلی قرمز بود.</p><p>اگر بپذیرید ${fa(4)} کارت می‌کشید و نوبتتان می‌سوزد. اگر اعتراض کنید دست نیلوفر فقط به شما نشان داده می‌شود: اگر کارت قرمز داشته باشد او ${fa(4)} کارت می‌کشد و شما عادی بازی می‌کنید؛ اگر نداشته باشد شما ${fa(6)} کارت می‌کشید.</p></div></div>`, `${btn(`می‌پذیرم، ${fa(4)} کارت`, 'secondary', 'download')}${btn('اعتراض', 'primary', 'flag')}`);
  const reveal = (ph) => modal('دست نیلوفر، فقط برای شما', `<div class="uno-rev">${[['uno-r-num-3', '۳ قرمز', true], ['uno-g-num-1', '۱ سبز'], ['uno-b-num-8', '۸ آبی'], ['uno-y-d2', '‎+۲ زرد']].map(([a, alt, hit]) => `<span class="uno-rc${hit ? ' is-hit' : ''}">${img(a, alt)}</span>`).join('')}</div><p><b>اعتراض درست بود.</b> نیلوفر ۳ قرمز داشت و نباید ‎+۴ می‌گذاشت؛ او ${fa(4)} کارت می‌کشد و شما با رنگ آبی بازی می‌کنید. بقیه فقط نتیجه را می‌بینند.</p>`, `${btn('ادامه', 'primary', 'check')}`);
  const handEnd = (ph) => modal('دست ۳ تمام شد: شما بردید', `<p>آخرین کارتتان را گذاشتید. امتیاز کارت‌هایی که دست بقیه مانده به شما می‌رسد: عدد به اندازهٔ خودش، ردشدن و برگشت و ‎+۲ هر کدام ${fa(20)}، رنگی و ‎+۴ هر کدام ${fa(50)}.</p>
${tbl(['بازیکن', 'کارت‌های مانده', 'امتیاز این دست', 'جمع'], [
      { c: ['شما', '—', `${fa(121)}+`, fa(355)], win: true },
      { c: ['نیلوفر', `۸ آبی، برگشت آبی، رنگی`, `${fa(78)}`, fa(120)] },
      { c: ['رضا', '۳ قرمز، ۷ سبز', `${fa(10)}`, fa(96)] },
      { c: ['سارا', '‎+۲ زرد، ۵ سبز، ۸ قرمز', `${fa(33)}`, fa(210)] },
    ])}<p class="cx-note">مسابقه تا ${fa(500)} امتیاز است (گزینه‌های دیگر: ${fa(200)} یا یک دست). جمع هر نفر امتیازی است که در دست‌هایی که برده گرفته.</p>`,
    `${btn('ترک میز', 'secondary', 'flag')}${btn('دست بعد', 'primary', 'next')}`);
  const catchBtn = `<button type="button" class="uno-catch">${ic('hand')}گرفتن</button>`;  return {
    slug: 'Uno', fa: 'اونو', latin: 'UNO', meta: ['زنده', '۴ نفر', '۳۰ ثانیه هر نوبت'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: backs('uno-back', 6) },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `${backs('uno-back', 1)}<span class="gc-tag">اونو!</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: backs('uno-back', 4) },
    ],
    me: { cards: hand, clock: '0:21', turn: true, note: `<span class="cx-note">${fa(7)} کارت</span>` },
    cardW: 84, phoneCardW: 58, cardRatio: 1.39,
    table,
    status: '<b>نوبت شماست.</b> روی کارت قرمز یا ۵ بازی کنید. رضا یک کارت دارد؛ «ردشدن» نوبت او را می‌سوزاند.',
    pstatus: '<b>نوبت شما.</b> قرمز یا ۵ بازی کنید.',
    railCard: `<section class="cx-card"><h3>دست شما</h3><div class="gc-pills"><span class="bgv-chip">${fa(4)} کارت قابل بازی</span><span class="bgv-chip">امتیاز دست: ${fa(83)}</span></div><div class="ga-rule">${ic('info')}<span>وقتی یک کارت برایتان ماند «اونو!» را بزنید. اگر نزنید و کسی پیش از شروع نوبت نفر بعد بگیردتان، ${fa(4)} کارت جریمه می‌کشید (تنظیم این میز؛ گزینهٔ دیگر ${fa(2)} کارت است).</span></div></section>`,
    logNote: 'دور ۳',
    log: [[2, 'نیلوفر ۷ زرد بازی کرد'], [6, 'رضا ۷ قرمز بازی کرد و «اونو!» گفت'], [4, 'سارا یک کارت کشید و ۵ قرمز بازی کرد'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto auto">${btn('کشیدن کارت', 'secondary', 'download')}${btn('اونو!', 'primary', 'zap', ' disabled')}${btn('ترک', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['download', 'کشیدن'], ['zap', 'اونو!'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'انتخاب رنگ', turnSub: 'بعد از کارت رنگی یا ‎+۴',
        table: tableOf('uno-wild', 'کارت رو: رنگی', null), overlay: picker,
        me: { cards: hand.filter((c) => c.art !== 'uno-wild').map((c) => ({ ...c, ok: false, sel: false, dim: false })) },
        status: '<b>کارت رنگی را گذاشتید.</b> رنگ بعدی را انتخاب کنید؛ تا انتخاب نکنید نوبت جلو نمی‌رود. اگر کارت اول بازی رنگی باشد، نفر اول همین پنجره را می‌بیند.',
        pstatus: '<b>رنگ را انتخاب کنید.</b>',
        log: [[6, 'رضا ۷ قرمز بازی کرد'], [4, 'سارا ۵ قرمز بازی کرد'], [1, 'شما کارت رنگی گذاشتید']],
      },
      {
        shotTitle: 'اعتراض به ‎+۴', turnSub: 'پذیرفتن یا اعتراض، با یادآوری هزینه', phone: true,
        table: tableOf('uno-wd4', 'کارت رو: ‎+۴', 'b'), overlay: challenge,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: backs('uno-back', 4) },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: backs('uno-back', 3) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: backs('uno-back', 4) },
        ],
        me: { cards: hand.map((c) => ({ ...c, ok: false, sel: false, dim: true })) },
        status: '<b>نیلوفر ‎+۴ گذاشت و رنگ را آبی کرد.</b> بپذیرید یا اعتراض کنید. فقط شما، که باید ۴ کارت بکشید، می‌توانید اعتراض کنید.',
        pstatus: '<b>‎+۴ برای شما.</b> می‌پذیرید یا اعتراض؟',
        log: [[4, 'سارا ۵ قرمز بازی کرد'], [2, 'نیلوفر ‎+۴ گذاشت و آبی را انتخاب کرد'], [1, 'نوبت شما: بپذیرید یا اعتراض کنید']],
      },
      {
        shotTitle: 'نتیجهٔ اعتراض', turnSub: 'دست ‎+۴گذار فقط به معترض نشان داده می‌شود',
        table: tableOf('uno-wd4', 'کارت رو: ‎+۴', 'b'), overlay: reveal,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: `${backs('uno-back', 8)}<span class="gc-tag gc-tag--soft">${fa(4)}+ جریمه</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: backs('uno-back', 3) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: backs('uno-back', 4) },
        ],
        me: { cards: hand.map((c) => ({ ...c, ok: false, sel: false, dim: true })) },
        status: '<b>اعتراض شما درست بود.</b> نیلوفر کارت قرمز داشت؛ ۴ کارت جریمه برای او. حالا نوبت شماست و رنگ آبی است.',
        log: [[2, 'نیلوفر ‎+۴ گذاشت و آبی را انتخاب کرد'], [1, 'شما اعتراض کردید'], [2, 'اعتراض درست بود: نیلوفر ۴ کارت کشید']],
      },
      {
        shotTitle: 'کارت کشیده‌شده', turnSub: 'بازی همان کارت یا نگه داشتن', phone: true,
        table: tableOf('uno-b-num-8', 'کارت رو: ۸ آبی', 'b', 57),
        me: {
          cards: [{ art: 'uno-r-num-3', alt: '۳ قرمز', dim: true }, { art: 'uno-r-skip', alt: 'ردشدن قرمز', dim: true }, { art: 'uno-g-num-5', alt: '۵ سبز', dim: true }, { art: 'uno-y-d2', alt: '‎+۲ زرد', dim: true }, { art: 'uno-b-rev', alt: 'برگشت آبی، تازه کشیده‌شده', ok: true, sel: true }],
          above: (ph) => `<div class="uno-act"><span class="uno-act__t"><b>برگشت آبی را کشیدید</b><small>${ph ? 'فقط همین کارت بازی‌شدنی است' : 'بعد از کشیدن فقط همین کارت را می‌شود بازی کرد؛ بقیهٔ دست قفل است'}</small></span>${btn(ph ? 'بازی' : 'بازی همین کارت', 'primary', 'check')}${btn(ph ? 'نگه دار' : 'نگه داشتن و پایان نوبت', 'secondary', 'next')}</div>`,
        },
        status: '<b>یک کارت کشیدید: برگشت آبی.</b> با ۸ آبی جور است. همین را بازی کنید یا نگهش دارید و نوبت را تمام کنید؛ کارت‌های دیگر دستتان این نوبت قفل‌اند.',
        pstatus: '<b>برگشت آبی را کشیدید.</b> بازی یا نگه داشتن؟',
        log: [[2, 'نیلوفر ۸ آبی بازی کرد'], [1, 'شما یک کارت کشیدید']],
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto auto">${btn('کشیدن کارت', 'secondary', 'download', ' disabled')}${btn('اونو!', 'primary', 'zap', ' disabled')}${btn('ترک', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
      },
      {
        shotTitle: 'اونو و گرفتن', turnSub: 'دو کارت مانده؛ سارا اونو نگفت',
        table: tableOf('uno-g-num-1', 'کارت رو: ۱ سبز', 'g', 41),
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: backs('uno-back', 5) },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: backs('uno-back', 4) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: `${backs('uno-back', 1)}${catchBtn}` },
        ],
        me: {
          cards: [{ art: 'uno-g-num-5', alt: '۵ سبز', ok: true, sel: true }, { art: 'uno-r-num-3', alt: '۳ قرمز', dim: true }],
          note: `<span class="cx-note">${fa(2)} کارت</span>`,
          above: (ph) => `<div class="uno-act"><span class="uno-act__t"><b>۵ سبز انتخاب شده</b><small>${ph ? 'با گذاشتنش یک کارت می‌ماند' : 'با گذاشتن این کارت یک کارت برایتان می‌ماند؛ «اونو» را همین حالا بزنید'}</small></span><button type="button" class="uno-say is-on" aria-pressed="true">${ic('zap')}اونو</button>${btn(ph ? 'گذاشتن' : 'گذاشتن کارت', 'primary', 'check')}</div>`,
        },
        status: '<b>نوبت شماست و دو کارت دارید.</b> سارا یک کارت دارد و اونو نگفت؛ تا وقتی کارت نکشیده یا نگذاشته‌اید می‌توانید روی «گرفتن» بزنید تا ۴ کارت جریمه بکشد. خودتان هم پیش از گذاشتن یکی‌مانده به آخر «اونو» را روشن کنید.',
        pstatus: '<b>دو کارت دارید.</b> اونو را روشن کنید؛ سارا را بگیرید.',
        log: [[6, 'رضا ۱ زرد بازی کرد'], [4, 'سارا ۱ سبز بازی کرد و یک کارت ماند'], [1, 'نوبت شما']],
        phone: true,
      },
      {
        shotTitle: 'پایان دست', turnSub: 'کارت‌های مانده، امتیاز و هدف مسابقه',
        table: tableOf('uno-g-num-5', 'کارت رو: ۵ سبز', 'g', 41), overlay: handEnd,
        me: { cards: [], turn: false, clock: '', note: `<span class="cx-note">${fa(355)} امتیاز از ${fa(500)}</span>` },
        status: '<b>دست ۳ تمام شد و شما بردید.</b> ۱۲۱ امتیاز گرفتید؛ جمع شما ۳۵۵ از ۵۰۰ است.',
        log: [[1, 'شما با اونو یک کارت ماندید'], [1, 'شما آخرین کارت را گذاشتید'], [1, 'شما ۱۲۱ امتیاز گرفتید']],
      },
    ],    css: `.uno-color{display:inline-flex;align-items:center;gap:6px}.uno-color i{inline-size:12px;block-size:12px;border-radius:50%;background:#D6312B;box-shadow:0 0 0 2px rgba(250,245,236,.6)}
.uno-disc img{box-shadow:0 0 0 4px #D6312B,0 12px 20px -10px rgba(0,0,0,.7)!important}
.uno-dir{display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:12.5px}.uno-dir .bgv-icon{inline-size:34px;block-size:34px;color:var(--felt-gold)}
.cx-phone .uno-dir{display:none}
.uno-disc{--uc:#D6312B}.uno-disc img{box-shadow:0 0 0 4px var(--uc),0 12px 20px -10px rgba(0,0,0,.7)!important}.uno-disc .uno-color i{background:var(--uc)}
.uno-cps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.uno-cp{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:10px;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-sunken);font-weight:800;color:var(--heading);min-block-size:56px}
.uno-cp i{grid-row:1/3;inline-size:34px;block-size:34px;border-radius:50%;background:var(--c);box-shadow:inset 0 0 0 3px rgba(255,255,255,.55)}
.uno-cp small{font-weight:500;font-size:12px;color:var(--text-muted)}
.uno-cp.is-sel{box-shadow:inset 0 0 0 3px var(--c)}
.uno-ch{display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:start}.uno-ch>img{inline-size:100%;block-size:auto;border-radius:8px}.uno-ch>div{display:grid;gap:8px}
.cx-phone .uno-ch{grid-template-columns:64px 1fr}
.uno-rev{display:flex;gap:8px;justify-content:center}.uno-rc img{display:block;inline-size:72px;block-size:auto;border-radius:6px}.uno-rc.is-hit img{box-shadow:0 0 0 3px var(--felt-gold)}
.uno-act{display:flex;align-items:center;gap:10px;inline-size:100%;padding:8px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.uno-act__t{display:grid;gap:2px;flex:1;font-size:14px}.uno-act__t small{font-size:12px;color:var(--felt-muted)}
.cx-phone .uno-act{margin-inline:10px;inline-size:auto;padding:6px 8px;gap:6px}.cx-phone .uno-act .bgv-btn{padding-inline:10px}
.uno-say{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:4px;block-size:40px;padding-inline:12px;border-radius:999px;font-weight:800;font-size:14px;box-shadow:inset 0 0 0 2px var(--felt-gold);color:var(--felt-gold)}
.uno-say.is-on{background:var(--felt-gold);color:#142B3B}
.uno-say .bgv-icon{inline-size:16px;block-size:16px}
.uno-catch{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:3px;block-size:24px;padding-inline:8px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:12px;font-weight:800}
.uno-catch .bgv-icon{inline-size:13px;block-size:13px}`,
    shotTitle: 'نوبت شما', turnSub: 'کارت‌های قابل بازی',
    diffs: [
      ['چیدمان', 'به جای صفحهٔ شطرنج: حریف‌ها بالا (اسم، ساعت، تعداد کارت)، وسط میز دستهٔ کشیدن و کارت رو، پایین دست شما به شکل بادبزن'],
      ['کارت‌های قابل بازی', 'کمی بالا آمده و حاشیهٔ طلایی دارند؛ بقیه کمی کم‌رنگ‌اند ولی دیده می‌شوند. کارت انتخاب‌شده بالاتر می‌آید'],
      ['رنگ فعلی', 'دور کارت رو حلقهٔ همان رنگ و زیرش «رنگ: …»؛ بعد از کارت رنگی رنگ انتخاب‌شده همین‌جا دیده می‌شود'],
      ['اونو!', 'دکمه فقط وقتی یک کارت برایتان بماند فعال می‌شود؛ برچسب «اونو!» کنار اسم کسی که گفته'],
      ['ستون کنار', 'به جای فهرست حرکت‌ها، رویدادهای دور (چه کسی چه کارتی زد یا کشید)؛ «مساوی» ندارد'],
      ['قوانین', 'قوانین رسمی Mattel مثل موتور: چالش ‎+۴ رنگی، جریمهٔ اونو، امتیاز تا هدف'],
    ],
  };
}
