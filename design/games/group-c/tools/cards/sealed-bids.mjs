// Sealed Bids («مزایده سربسته»): the repo's house/test game (isTestGame). 2–4 players, tokens 1–5, five rounds, prize = round.
// History: R1 1/2/1/3 → Sara +1; R2 3/3/4/1 → Reza +2; R3 5/5/2/4 → tie on 5, nobody scores. Now round 4 (prize 4).
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const chip = (v, cls = '') => img(`sealed-bids-bid-${v}`, `ژتون ${fa(v)}`, cls);
  const left = (vs) => `<span class="sb-left" aria-label="ژتون‌های مانده">${vs.map((v) => chip(v)).join('')}</span>`;
  const score = (n) => `<span class="sb-score">${fa(n)} امتیاز</span>`;
  const tag = (ok) => `<span class="gc-tag${ok ? '' : ' gc-tag--soft'}">${ok ? 'مهر شد' : 'در فکر'}</span>`;
  const used = [1, 3, 5];
  const hand = [1, 2, 3, 4, 5].map((v) => ({ art: `sealed-bids-bid-${v}`, alt: used.includes(v) ? `ژتون ${fa(v)} (خرج شده)` : `ژتون ${fa(v)}`, dim: used.includes(v), sel: v === 4, ok: v === 2 }));
  const env = (who, seat, sealed, cls = '') => `<div class="sb-env ${cls}">${sealed ? img('sealed-bids-envelope', `پاکت مهرشدهٔ ${who}`) : '<span class="sb-env__empty"></span>'}<span><i style="background:var(--seat-${seat})"></i>${who}</span></div>`;
  const track = [['سارا', 'is-past'], ['رضا', 'is-past'], ['مساوی', 'is-past is-tie'], ['الان', 'is-now'], ['بعدی', '']];
  const table = (ph) => `<div class="sb-board">
<div class="sb-track" aria-label="جایزهٔ پنج دور">${track.map(([t, c], k) => `<figure class="${c}">${img(`sealed-bids-round-${k + 1}`, `دور ${fa(k + 1)}، جایزه ${fa(k + 1)} امتیاز`)}<figcaption>${t}</figcaption></figure>`).join('')}</div>
<div class="sb-envs" aria-label="پاکت‌های این دور">${env('نیلوفر', 2, false)}${env('رضا', 6, true)}${env('سارا', 4, true)}${env('شما', 1, false, 'is-me')}</div>
<p class="sb-hint">${ph ? 'وقتی همه مهر کنند پاکت‌ها با هم باز می‌شوند' : 'وقتی همه مهر کنند پاکت‌ها با هم باز می‌شوند؛ بالاترین پیشنهادِ تکی جایزه را می‌برد'}</p></div>`;
  const bar = (ph) => `<div class="sb-bar${ph ? ' sb-bar--ph' : ''}"><span>پیشنهاد شما: <b>ژتون ${fa(4)}</b>${ph ? '' : '<small>بعد از ثبت عوض نمی‌شود</small>'}</span>${btn('مهر و ثبت', 'primary', 'check')}</div>`;
  const row = (r, bids, win) => `<tr><th>${fa(r)}</th>${bids.map((b, k) => `<td class="${b === Math.max(...bids) ? 'is-top' : ''}">${chip(b)}</td>`).join('')}<td>${win}</td></tr>`;
  const { modal } = H;
  const openEnv = (who, seat, v, cls = '') => `<div class="sb-env sb-env--open ${cls}">${img('sealed-bids-envelope', `پاکت باز شدهٔ ${who}`)}<span class="sb-env__chip">${chip(v)}</span><span><i style="background:var(--seat-${seat})"></i>${who}</span></div>`;
  const trackAt = (now, labels) => `<div class="sb-track">${[1, 2, 3, 4, 5].map((k) => `<figure class="${k < now ? 'is-past' : k === now ? 'is-now' : ''}${labels[k - 1] === 'مساوی' ? ' is-tie' : ''}">${img(`sealed-bids-round-${k}`, `دور ${fa(k)}`)}<figcaption>${labels[k - 1]}</figcaption></figure>`).join('')}</div>`;
  const revealT = (ph) => `<div class="sb-board">${trackAt(4, ['سارا', 'رضا', 'مساوی', 'شما', 'بعدی'])}
<div class="sb-envs">${openEnv('نیلوفر', 2, 1)}${openEnv('رضا', 6, 3)}${openEnv('سارا', 4, 2)}${openEnv('شما', 1, 4, 'is-win')}</div>
<p class="sb-hint sb-hint--win">${ph ? 'شما با ۴ بردید: ۴ امتیاز' : 'پاکت‌ها با هم باز شد: بالاترین پیشنهاد تکی ۴ شما بود؛ ۴ امتیاز گرفتید'}</p></div>`;
  const lastT = (ph) => `<div class="sb-board">${trackAt(5, ['سارا', 'رضا', 'مساوی', 'شما', 'الان'])}<div class="sb-envs">${env('نیلوفر', 2, true)}${env('رضا', 6, true)}${env('سارا', 4, false)}${env('شما', 1, false, 'is-me')}</div></div>`;
  const lastBar = (ph) => `<div class="sb-bar${ph ? ' sb-bar--ph' : ''}"><span>دور آخر: <b>فقط ژتون ${fa(2)} مانده</b>${ph ? '' : '<small>از پیش انتخاب شده؛ فقط ثبتش کنید</small>'}</span>${btn(`مهر و ثبت ژتون ${fa(2)}`, 'primary', 'check')}</div>`;
  const ending = (ph) => modal('پایان بازی', `<p>پنج دور تمام شد. در دور ${fa(5)} رضا و سارا هر دو ${fa(5)} دادند و کسی امتیاز نگرفت.</p><table class="gd-score"><thead><tr><th>دور</th><th class="n">شما</th><th class="n">نیلوفر</th><th class="n">رضا</th><th class="n">سارا</th><th class="n">برنده</th></tr></thead><tbody>${[[1, [1, 2, 1, 3], 'سارا +۱'], [2, [3, 3, 4, 1], 'رضا +۲'], [3, [5, 5, 2, 4], 'مساوی'], [4, [4, 1, 3, 2], 'شما +۴'], [5, [2, 4, 5, 5], 'مساوی']].map(([r, b, w]) => `<tr><td>${fa(r)}</td>${b.map((v) => `<td class="n">${fa(v)}</td>`).join('')}<td class="n">${w}</td></tr>`).join('')}<tr class="is-win"><td>جمع</td><td class="n">${fa(4)}</td><td class="n">${fa(0)}</td><td class="n">${fa(2)}</td><td class="n">${fa(1)}</td><td class="n">شما</td></tr></tbody></table><p class="cx-note">امتیاز برابر یعنی رتبهٔ مشترک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'SealedBids', fa: 'مزایده سربسته', latin: 'Sealed Bids', meta: ['آزمایشی', 'زنده', '۴ نفر'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:19', turn: true, meta: `${score(0)}${left([1, 4])}${tag(false)}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `${score(2)}${left([3, 5])}${tag(true)}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: `${score(1)}${left([2, 5])}${tag(true)}` },
    ],
    me: { cards: hand, clock: '0:22', turn: true, note: `<span class="cx-note">${fa(0)} امتیاز</span>`, above: (ph) => bar(ph) },
    cardW: 70, phoneCardW: 54, cardRatio: 1,
    table,
    status: `<b>دور ${fa(4)}، جایزه ${fa(4)} امتیاز.</b> یک ژتون را مخفیانه مهر کنید. همه هم‌زمان پیشنهاد می‌دهند؛ مساوی در بالاترین، امتیازی ندارد.`,
    pstatus: `<b>دور ${fa(4)}، جایزه ${fa(4)}.</b> یک ژتون را مهر کنید.`,
    railCard: `<section class="cx-card"><h3>دورها<span class="bgv-spacer"></span><span class="bgv-chip">بازی آزمایشی</span></h3><table class="sb-hist"><thead><tr><th>دور</th><th>شما</th><th>نیلوفر</th><th>رضا</th><th>سارا</th><th>برنده</th></tr></thead><tbody>${row(1, [1, 2, 1, 3], 'سارا +۱')}${row(2, [3, 3, 4, 1], 'رضا +۲')}${row(3, [5, 5, 2, 4], 'مساوی')}</tbody></table><div class="ga-rule">${ic('info')}<span>پیشنهادهای قبلی رو شده‌اند، پس ژتون‌های ماندهٔ همه معلوم است: رضا و سارا هنوز ${fa(5)} دارند.</span></div></section>`,
    logNote: `دور ${fa(4)} از ${fa(5)}`,
    log: [[4, 'دور ۱: سارا با ۳ برد و ۱ امتیاز گرفت'], [6, 'دور ۲: رضا با ۴ برد و ۲ امتیاز گرفت'], [1, 'دور ۳: شما و نیلوفر هر دو ۵ دادید؛ کسی امتیاز نگرفت'], [6, 'دور ۴: رضا پیشنهادش را مهر کرد'], [4, 'سارا پیشنهادش را مهر کرد'], [1, 'منتظر شما و نیلوفر']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['list', 'دورها'], ['chat', 'گفت‌وگو'], ['flag', 'ترک میز']],
    phases: [
      {
        shotTitle: 'باز شدن پاکت‌ها', turnSub: 'هم‌زمان؛ برندهٔ دور یا مساوی', table: revealT, phone: true,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `${score(0)}${left([4])}` },
          { name: 'رضا', av: 'ر', seat: 6, meta: `${score(2)}${left([5])}` },
          { name: 'سارا', av: 'س', seat: 4, meta: `${score(1)}${left([5])}` },
        ],
        me: { turn: false, clock: '', cards: hand.map((h) => ({ ...h, sel: false, ok: false, dim: h.dim || h.alt.includes('۴') })), above: () => '', note: `<span class="cx-note">${fa(4)} امتیاز</span>` },
        status: '<b>پاکت‌های دور ۴ باز شد.</b> شما ۴، رضا ۳، سارا ۲ و نیلوفر ۱ داده بودند؛ ۴ امتیاز این دور مال شماست. اگر بالاترین پیشنهاد مساوی بود، کسی امتیاز نمی‌گرفت.',
        pstatus: '<b>شما بردید:</b> ۴ امتیاز.',
        log: [[1, 'همه مهر کردند'], [1, 'دور ۴: شما با ۴ بردید و ۴ امتیاز گرفتید']],
      },
      {
        shotTitle: 'دور آخر', turnSub: 'تنها ژتون از پیش انتخاب شده', table: lastT,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `${score(0)}${tag(true)}` },
          { name: 'رضا', av: 'ر', seat: 6, meta: `${score(2)}${tag(true)}` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:20', turn: true, meta: `${score(1)}${tag(false)}` },
        ],
        me: { cards: hand.map((h) => ({ ...h, dim: !h.alt.includes('۲'), sel: h.alt.includes('۲'), ok: false })), above: lastBar, note: `<span class="cx-note">${fa(4)} امتیاز</span>` },
        status: '<b>دور ۵، جایزه ۵ امتیاز.</b> فقط ژتون ۲ برایتان مانده و از پیش انتخاب شده؛ برای ثبت فقط «مهر و ثبت» را بزنید.',
        pstatus: '<b>دور آخر.</b> ژتون ۲ را ثبت کنید.',
        log: [[2, 'نیلوفر مهر کرد'], [6, 'رضا مهر کرد'], [1, 'نوبت ثبت شما']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول پنج دور و رتبهٔ مشترک', overlay: ending, meta: ['آزمایشی', 'تمام شد', '۴ نفر'],
        table: (ph) => `<div class="sb-board">${trackAt(6, ['سارا', 'رضا', 'مساوی', 'شما', 'مساوی'])}</div>`,
        me: { turn: false, clock: '', cards: [], above: () => '' }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۴ امتیاز بردید.',
        log: [[6, 'دور ۵: رضا و سارا هر دو ۵؛ مساوی'], [1, 'شما بردید']],
      },
    ],    css: `.gc-hand .gc-card{margin-inline-start:12px}.gc-hand .gc-card:first-child{margin-inline-start:0}
.sb-env--open{position:relative}.sb-env--open>img{opacity:.55}.sb-env__chip{position:absolute;inset-block-start:8px;inset-inline:0;display:grid;place-items:center}.sb-env__chip img{inline-size:52px;block-size:52px}
.sb-env.is-win>img{opacity:1;filter:drop-shadow(0 0 6px rgba(232,166,66,.9))}
.sb-hint--win{color:var(--felt-gold)!important;font-weight:700}
.cx-phone .sb-env__chip img{inline-size:34px;block-size:34px}
.gc-hand .gc-card img,.gc-hand .gc-card.is-sel img,.gc-hand .gc-card.is-ok img{box-shadow:none;border-radius:50%}
.gc-hand .gc-card.is-ok img{box-shadow:0 0 0 3px var(--felt-gold)}
.gc-hand .gc-card.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 14px -6px rgba(0,0,0,.6)}
.gc-hand .gc-card.is-dim img{opacity:.28;filter:grayscale(1)}
.sb-score{white-space:nowrap;color:var(--felt-ink);font-weight:700}
.sb-left{display:inline-flex;gap:2px}.sb-left img{inline-size:20px;block-size:20px}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:7px;font-size:11.5px}
.sb-board{display:grid;justify-items:center;gap:26px}
.sb-track{display:flex;gap:8px;direction:rtl}
.sb-track figure{margin:0;display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:12px}
.sb-track img{inline-size:112px;display:block}
.sb-track figure.is-past img{opacity:.5;filter:grayscale(.6)}
.sb-track figure.is-tie figcaption{color:#F0AAA3}
.sb-track figure.is-now img{inline-size:176px;filter:drop-shadow(0 0 0 #000) drop-shadow(0 0 6px rgba(232,166,66,.9))}
.sb-track figure.is-now figcaption{color:var(--felt-gold);font-weight:700}
.sb-envs{display:flex;gap:18px}
.sb-env{display:grid;justify-items:center;gap:6px;inline-size:112px;color:var(--felt-ink);font-size:12.5px;font-weight:700}
.sb-env img{inline-size:104px;display:block}
.sb-env>span:last-child{display:inline-flex;align-items:center;gap:5px}.sb-env i{inline-size:8px;block-size:8px;border-radius:50%}
.sb-env__empty{inline-size:100px;block-size:74px;margin-block:2px;border-radius:6px;border:1.5px dashed rgba(250,245,236,.35)}
.sb-env.is-me .sb-env__empty{border-color:var(--felt-gold);background:rgba(232,166,66,.1)}
.sb-hint{margin:0;color:var(--felt-muted);font-size:12.5px;text-align:center}
.sb-bar{display:flex;align-items:center;justify-content:center;gap:14px;inline-size:100%;margin-block-end:14px}
.sb-bar>span{display:grid;color:var(--felt-ink);font-size:14px}.sb-bar small{color:var(--felt-muted);font-size:12px}
.sb-bar--ph{padding-inline:10px;box-sizing:border-box;justify-content:space-between;margin-block-end:10px}.sb-bar--ph>span{font-size:13px}
.sb-hist{inline-size:100%;border-collapse:collapse;font-size:13px;color:var(--text)}
.sb-hist th{font-weight:700;color:var(--text-muted);font-size:12px;padding:4px 2px;text-align:center}
.sb-hist td{text-align:center;padding:3px 2px;border-block-start:1px solid var(--line)}
.sb-hist tbody th{border-block-start:1px solid var(--line);color:var(--heading)}
.sb-hist td img{inline-size:26px;block-size:26px;vertical-align:middle}
.sb-hist td.is-top img{box-shadow:0 0 0 2px var(--link);border-radius:50%}
.sb-hist td:last-child{font-weight:700;color:var(--heading);white-space:nowrap}
.cx-phone .sb-board{gap:12px}
.cx-phone .sb-track{gap:4px}.cx-phone .sb-track img{inline-size:62px}.cx-phone .sb-track figure.is-now img{inline-size:96px}
.cx-phone .sb-track figure{font-size:10.5px}
.cx-phone .sb-envs{gap:8px}.cx-phone .sb-env{inline-size:76px;font-size:11.5px}.cx-phone .sb-env img{inline-size:66px}
.cx-phone .sb-env__empty{inline-size:62px;block-size:46px}
.cx-phone .sb-hint{font-size:11.5px;padding-inline:12px}
.cx-phone .gc-hand .gc-card{margin-inline-start:8px}.cx-phone .gc-hand .gc-card:first-child{margin-inline-start:0}`,
    shotTitle: 'پیشنهاد پنهان', turnSub: 'دور ۴ از ۵',
    diffs: [
      ['بازی آزمایشی', '«مزایده سربسته» بازی خانگی و آزمایشی سایت است (برای امتحان موتور)، نه بازی منتشرشده؛ برچسب «آزمایشی» در نوار بالا و کارت ستون کنار'],
      ['چیدمان', 'وسط میز ردیف پنج جایزه (دور فعلی بزرگ و روشن، دورهای گذشته کم‌رنگ با اسم برنده)، زیرش پاکت هر بازیکن: مهرشده یا خالی'],
      ['پیشنهاد پنهان', 'دست شما پنج ژتون است؛ خرج‌شده‌ها خاکستری می‌مانند تا معلوم باشد چه دارید. ژتون را انتخاب و «مهر و ثبت» را می‌زنید؛ بعد از ثبت عوض نمی‌شود و پاکت شما مهر می‌خورد'],
      ['باز شدن هم‌زمان', 'نوبتی نیست؛ ساعت همه می‌چرخد. وقتی همه مهر کردند پاکت‌ها با هم باز می‌شوند؛ مساوی در بالاترین پیشنهاد امتیاز ندارد (مثل دور ۳)'],
      ['ژتون‌های حریف', 'پیشنهادهای گذشته عمومی‌اند، پس ژتون‌های ماندهٔ هر حریف روی صندلی‌اش نشان داده می‌شود؛ جدول دورها در ستون کنار'],
      ['قوانین', '۲ تا ۴ نفر و ۵ دور، جایزهٔ هر دور برابر شمارهٔ دور، مثل موتور؛ اگر زمان تمام شود کم‌ارزش‌ترین ژتون ثبت می‌شود'],
    ],
  };
}
