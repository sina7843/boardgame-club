// The Mind on the card-table frame (cooperative, as the repo engine: level n deals n cards; 3 players → 10 levels).
// Mock: 3 players, level 4 (4 cards each = 12). Played so far 8, 19, 23, 31; left: you 3 (37, 58, 81), Niloufar 2, Reza 3.
// Lives start at 3 (= players) and stars at 1; star after level 2 (+1), life after level 3 (+1), one life lost and one star
// used earlier → 3 lives, 1 star. Reza has raised his hand for a star (needs everyone still holding cards).
// No turns: anyone plays their lowest card at any time, so there are no seat clocks.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  // Card face as the printed NSV card: one blank face (GPT, checked against the real card) + the number in code:
  // big black number in the glow, small white numbers in the four corners (bottom two upside down).
  const face = (n) => `<span class="tm-face" role="img" aria-label="${fa(n)}">${img('the-mind-blank', '')}<b>${fa(n)}</b><i class="tm-k tm-k--a">${fa(n)}</i><i class="tm-k tm-k--b">${fa(n)}</i><i class="tm-k tm-k--c">${fa(n)}</i><i class="tm-k tm-k--d">${fa(n)}</i></span>`;
  const icons = (kind, on, max) => `<span class="tm-icons" aria-label="${fa(on)} از ${fa(max)}">${Array.from({ length: max }, (_, k) => img(`the-mind-${kind}-${k < on ? 'active' : 'inactive'}`, '')).join('')}</span>`;
  const above = (ph) => `<div class="tm-acts${ph ? ' tm-acts--ph' : ''}">${btn(`بازی ${fa(37)}`, 'primary', 'hand')}${btn(ph ? 'ستاره ۱/۳' : 'ستاره (۱ از ۳ موافق)', 'secondary', 'zap')}</div>`;
  const { modal } = H;
  const team = (lv, life, star, pile = []) => (ph) => `<div class="tm-team"><span class="tm-level"><small>مرحله</small><b>${fa(lv)}</b><small>از ${fa(10)}</small></span><span class="tm-row">${icons('life', life, 5)}<small>جان</small></span><span class="tm-row">${icons('star', star, 3)}<small>ستاره</small></span></div>${pile.length ? `<div class="tm-pile">${pile.map((n) => `<span class="tm-c">${face(n)}</span>`).join('')}</div>` : ''}`;
  const ready = (who, seatN, on) => `<span class="tm-ready${on ? ' is-on' : ''}"><i style="background:var(--seat-${seatN})"></i>${who}<small>${on ? 'آماده' : 'در تمرکز'}</small></span>`;
  const focusT = (ph) => `${team(5, 3, 2)(ph)}<div class="tm-focus">${ic('hand')}<b>تمرکز</b><span>همه دستشان را روی میز گذاشته‌اند؛ وقتی همه «آماده» بزنند مرحله شروع می‌شود</span><div class="tm-readies">${ready('شما', 1, false)}${ready('نیلوفر', 2, true)}${ready('رضا', 6, true)}</div></div>`;
  const mistake = (ph) => modal('اشتباه! یک جان کم شد', `<p>نیلوفر <b>${fa(45)}</b> را بازی کرد، ولی کارت‌های کوچک‌تر هنوز در دست‌ها بود. این کارت‌ها رو شدند و کنار رفتند:</p><div class="tm-lost">${[[37, 'شما'], [42, 'رضا'], [44, 'رضا']].map(([n, w]) => `<figure>${face(n)}<figcaption>${w}</figcaption></figure>`).join('')}</div><div class="gc-pills"><span class="bgv-chip">جان: ${fa(3)} ← ${fa(2)}</span><span class="bgv-chip">بازی از ${fa(45)} ادامه دارد</span></div><p class="cx-note">بعد از اشتباه همه دوباره تمرکز می‌کنند.</p>`, `${btn('تمرکز', 'primary', 'hand')}`);
  const starRes = (ph) => modal('ستاره بازی شد', `<p>همه موافق بودند. کمترین کارت هر نفر رو شد و کنار رفت:</p><div class="tm-lost">${[[12, 'شما'], [15, 'نیلوفر'], [20, 'رضا']].map(([n, w]) => `<figure>${face(n)}<figcaption>${w}</figcaption></figure>`).join('')}</div>`, `${btn('ادامه', 'primary', 'check')}`);
  const clear = (ph) => modal('مرحلهٔ ۵ تمام شد', `<div class="tm-rw">${img('the-mind-star-active', 'ستاره')}<p>همهٔ کارت‌ها به ترتیب بازی شد. <b>پاداش: یک ستاره</b>. مرحلهٔ ${fa(6)} با ${fa(6)} کارت برای هر نفر.</p></div>`, `${btn('مرحلهٔ بعد', 'primary', 'next')}`);
  const win = (ph) => modal('تیم برد!', `<p>مرحلهٔ ${fa(10)} هم تمام شد؛ هر ده مرحله را بی‌حرف رد کردید.</p><div class="gc-pills"><span class="bgv-chip">جان مانده: ${fa(1)}</span><span class="bgv-chip">ستاره مانده: ${fa(0)}</span><span class="bgv-chip">اشتباه‌ها: ${fa(6)}</span></div>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const lose = (ph) => modal('جان‌ها تمام شد', `<p>آخرین جان در مرحلهٔ ${fa(7)} از دست رفت. تیم باخت؛ نتیجهٔ این بازی «رسیدن به مرحلهٔ ${fa(7)}» است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'TheMind', fa: 'ذهن', latin: 'The Mind', meta: ['زنده', '۳ نفر', 'همکاری', 'بدون حرف'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, meta: backs('the-mind-back', 2) },
      { name: 'رضا', av: 'ر', seat: 6, meta: `${backs('the-mind-back', 3)}<span class="gc-tag">${ic('zap')}ستاره</span>` },
    ],
    me: {
      cards: [{ html: face(37), ok: true, sel: true }, { html: face(58), dim: true }, { html: face(81), dim: true }],
      turn: false, note: `${fa(3)} کارت`, above: (ph) => above(ph),
    },
    cardW: 104, phoneCardW: 72, cardRatio: 1.34,
    table: (ph) => `<div class="tm-team"><span class="tm-level"><small>مرحله</small><b>${fa(4)}</b><small>از ${fa(10)}</small></span><span class="tm-row">${icons('life', 3, 5)}<small>جان</small></span><span class="tm-row">${icons('star', 1, 3)}<small>ستاره</small></span></div>
<div class="tm-pile" aria-label="کارت‌های بازی‌شده">${[8, 19, 23, 31].map((n) => `<span class="tm-c">${face(n)}</span>`).join('')}</div>
<div class="tm-next"><b>${fa(31)} ← ؟</b><span>${fa(8)} کارت در دست‌ها</span></div>`,
    status: '<b>بازی گروهی، بی‌نوبت.</b> آخرین کارت ۳۱ است و کمترین کارت شما ۳۷. حرف نزنید؛ هر وقت حس کردید وقتش است، بازی کنید.',
    pstatus: '<b>بی‌نوبت.</b> ۳۱ روی میز؛ کمترین کارت شما ۳۷.',
    railCard: `<section class="cx-card"><h3>تیم</h3><div class="tm-rail"><span>${icons('life', 3, 5)}<small>${fa(3)} جان</small></span><span>${icons('star', 1, 3)}<small>${fa(1)} ستاره</small></span></div><div class="ga-rule">${ic('info')}<span>اگر کسی کارت کوچک‌تری داشته باشد و شما زودتر بازی کنید، تیم یک جان از دست می‌دهد و همهٔ کارت‌های کوچک‌تر کنار می‌روند. ستاره وقتی همه موافق باشند، کمترین کارت همه را کنار می‌گذارد.</span></div><p class="cx-note" style="margin:0">پاداش بعدی: بعد از مرحلهٔ ${fa(5)} یک ستاره</p></section>`,
    logNote: 'مرحلهٔ ۴',
    log: [[6, 'رضا ۸ را بازی کرد'], [2, 'نیلوفر ۱۹ را بازی کرد'], [6, 'رضا ۲۳ را بازی کرد'], [2, 'نیلوفر ۳۱ را بازی کرد'], [6, 'رضا دستش را برای ستاره بالا برد'], [1, 'کمترین کارت شما: ۳۷']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['hand', 'بازی'], ['zap', 'ستاره'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    chat: [['sys', 'بازی شروع شد. ۳ نفر سر میزند'], ['sys', 'در ذهن حرف زدن دربارهٔ عددها ممنوع است؛ گفت‌وگو تا پایان مرحله بسته است']],
    phases: [
      {
        shotTitle: 'تمرکز', turnSub: 'شروع مرحله و بعد از اشتباه: آماده یا ایست', meta: ['زنده', '۳ نفر', 'همکاری', 'مرحلهٔ ۵'],
        table: focusT, phoneCardW: 58,
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: `${backs('the-mind-back', 5)}<span class="gc-tag gc-tag--soft">آماده</span>` }, { name: 'رضا', av: 'ر', seat: 6, meta: `${backs('the-mind-back', 5)}<span class="gc-tag gc-tag--soft">آماده</span>` }],
        me: { cards: [12, 37, 58, 81, 92].map((n) => ({ html: face(n) })), above: (ph) => `<div class="tm-acts${ph ? ' tm-acts--ph' : ''}">${btn('آماده‌ام', 'primary', 'check')}${btn('ایست', 'secondary', 'pause')}</div>`, note: `${fa(5)} کارت` },
        status: '<b>مرحلهٔ ۵: تمرکز.</b> نیلوفر و رضا آماده‌اند. وقتی شما هم «آماده» بزنید بازی شروع می‌شود؛ هر کس هر وقت بخواهد می‌تواند «ایست» بدهد و همه دوباره تمرکز کنند.',
        pstatus: '<b>تمرکز.</b> آماده‌اید؟',
        log: [[1, 'مرحلهٔ ۴ تمام شد'], [2, 'نیلوفر آماده است'], [6, 'رضا آماده است']],
        phone: true,
      },
      {
        shotTitle: 'پس گرفتن ستاره', turnSub: 'پیشنهاد خودتان را پس بگیرید', phone: true, phoneOnly: true,
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: backs('the-mind-back', 2) }, { name: 'رضا', av: 'ر', seat: 6, meta: `${backs('the-mind-back', 3)}<span class="gc-tag">${ic('zap')}ستاره</span>` }],
        me: { above: (ph) => `<div class="tm-acts tm-acts--ph">${btn(`بازی ${fa(37)}`, 'primary', 'hand')}${btn('پس گرفتن ستاره', 'secondary', 'undo')}</div>`, note: `${fa(3)} کارت<span class="bgv-sep"></span>ستاره: ${fa(2)} از ${fa(3)} موافق` },
        pstatus: '<b>شما و رضا ستاره خواسته‌اید.</b> نیلوفر هنوز نه؛ می‌توانید پس بگیرید.', status: '',
      },
      {
        shotTitle: 'اشتباه', turnSub: 'کارت‌های کنار رفته و صاحبانشان', overlay: mistake,
        table: team(4, 2, 1, [8, 19, 23, 31, 45]),
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: backs('the-mind-back', 1) }, { name: 'رضا', av: 'ر', seat: 6, meta: backs('the-mind-back', 1) }],
        me: { cards: [{ html: face(58) }, { html: face(81) }], above: () => '', note: `${fa(2)} کارت` },
        status: '<b>اشتباه.</b> نیلوفر ۴۵ را زود بازی کرد؛ ۳۷ شما و ۴۲ و ۴۴ رضا کنار رفت و تیم یک جان از دست داد.',
        log: [[2, 'نیلوفر ۴۵ را بازی کرد'], [1, 'اشتباه: ۳۷ (شما)، ۴۲ و ۴۴ (رضا) کنار رفت'], [1, 'یک جان کم شد']],
      },
      {
        shotTitle: 'نتیجهٔ ستاره', turnSub: 'کارت‌هایی که با ستاره کنار رفت', phone: true, phoneOnly: true, overlay: starRes,
        table: team(5, 3, 1, [3, 7]),
        me: { cards: [{ html: face(37) }, { html: face(58) }, { html: face(81) }], above: () => '' },
        pstatus: '<b>ستاره بازی شد.</b>', status: '',
      },
      {
        shotTitle: 'گذر مرحله', turnSub: 'پاداش گرفته‌شده', overlay: clear, meta: ['زنده', '۳ نفر', 'همکاری', 'مرحلهٔ ۵'],
        table: team(5, 3, 2, [37, 58, 64, 81, 92]),
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: backs('the-mind-back', 0) }, { name: 'رضا', av: 'ر', seat: 6, meta: backs('the-mind-back', 0) }],
        me: { cards: [], above: () => '' },
        status: '<b>مرحلهٔ ۵ تمام شد</b> و تیم یک ستاره گرفت.',
        log: [[1, 'شما ۹۲ را بازی کردید'], [1, 'مرحلهٔ ۵ تمام شد: یک ستاره']],
      },
      {
        shotTitle: 'برد تیم', turnSub: 'آخرین مرحله تمام شد', overlay: win, meta: ['تمام شد', '۳ نفر', 'همکاری', 'مرحلهٔ ۱۰'],
        table: team(10, 1, 0),
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: '' }, { name: 'رضا', av: 'ر', seat: 6, meta: '' }],
        me: { cards: [], above: () => '' }, railCard: '',
        status: '<b>بازی تمام شد.</b> تیم هر ده مرحله را رد کرد.',
        log: [[6, 'رضا آخرین کارت را بازی کرد'], [1, 'تیم برد']],
      },
      {
        shotTitle: 'باخت تیم', turnSub: 'جان‌ها تمام شد', phone: true, phoneOnly: true, overlay: lose, meta: ['تمام شد', '۳ نفر', 'همکاری', 'مرحلهٔ ۷'],
        table: team(7, 0, 0),
        me: { cards: [], above: () => '' },
        pstatus: '<b>باخت.</b> جان‌ها تمام شد.', status: '',
      },
    ],    css: `.gc-card{margin-inline-start:12px}
.tm-focus{display:grid;justify-items:center;gap:8px;padding:14px 20px;border-radius:14px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1.5px rgba(232,166,66,.5);color:var(--felt-ink);text-align:center;max-inline-size:340px;font-size:13px}
.tm-focus>.bgv-icon{inline-size:30px;block-size:30px;color:var(--felt-gold)}.tm-focus>b{font-size:18px}.tm-focus>span{color:var(--felt-muted)}
.tm-readies{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.tm-ready{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(250,245,236,.1);font-weight:700;font-size:12.5px}.tm-ready i{inline-size:8px;block-size:8px;border-radius:50%}.tm-ready small{font-weight:500;color:var(--felt-muted)}
.tm-ready.is-on{background:rgba(62,155,106,.3)}
.tm-lost{display:flex;gap:10px;justify-content:center}.tm-lost figure{margin:0;display:grid;justify-items:center;gap:4px;inline-size:72px;font-size:12px;font-weight:700}
.tm-rw{display:flex;gap:12px;align-items:center}.tm-rw img{inline-size:52px}
.cx-phone .tm-lost figure{inline-size:56px}.cx-phone .tm-focus{padding:10px 12px;max-inline-size:none;margin-inline:10px}
.gc-card .tm-face img,.tm-c .tm-face img{box-shadow:none!important;border-radius:0}
.gc-card{filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))}
.gc-card.is-ok,.gc-card.is-sel{filter:drop-shadow(0 0 0 var(--felt-gold)) drop-shadow(0 0 3px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold)) drop-shadow(0 8px 10px rgba(0,0,0,.5))}
.gc-card.is-dim .tm-face{filter:brightness(.72)}
.tm-face{position:relative;display:block;inline-size:100%;container-type:inline-size;direction:ltr;user-select:none}
.tm-face img{display:block;inline-size:100%;block-size:auto}
.tm-face b{position:absolute;inset:0;display:grid;place-items:center;font-size:46cqi;font-weight:900;line-height:1;color:#000;-webkit-text-stroke:.6cqi #fff;paint-order:stroke fill;text-shadow:0 0 2cqi rgba(255,255,255,.9)}
.tm-k{position:absolute;font-style:normal;font-size:13cqi;font-weight:700;line-height:1;color:#fff}
.tm-k--a{inset-block-start:5cqi;inset-inline-start:7cqi}.tm-k--b{inset-block-start:5cqi;inset-inline-end:7cqi}
.tm-k--c{inset-block-end:5cqi;inset-inline-start:7cqi;rotate:180deg}.tm-k--d{inset-block-end:5cqi;inset-inline-end:7cqi;rotate:180deg}
.bgv-composer{display:none}
.gc-backs img{inline-size:20px;border-radius:3px}
.gc-seat__meta .gc-tag{white-space:nowrap;block-size:20px;font-size:11.5px;padding-inline:7px}.gc-seat__meta .gc-tag .bgv-icon{inline-size:12px;block-size:12px}
.gc-table{flex-direction:row}
.tm-team{display:grid;justify-items:center;gap:10px;padding:14px 18px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);color:var(--felt-ink)}
.tm-level{display:grid;justify-items:center;line-height:1.1}.tm-level b{font-size:44px;font-weight:900;color:var(--felt-gold)}.tm-level small{font-size:12px;color:var(--felt-muted)}
.tm-row{display:grid;justify-items:center;gap:2px}.tm-row small{font-size:11.5px;color:var(--felt-muted)}
.tm-icons{display:inline-flex;gap:0}.tm-icons img{inline-size:40px;block-size:40px;clip-path:inset(22% round 5px);margin-inline:-7px}
.tm-pile{display:flex;align-items:center;direction:ltr}
.tm-c{display:block;inline-size:84px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))}
.tm-c+.tm-c{margin-inline-start:-48px}.tm-c:last-child{inline-size:120px;margin-inline-start:-56px}
.tm-next{display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:12.5px}.tm-next b{font-size:22px;color:var(--felt-ink)}
.tm-acts{display:flex;gap:10px;justify-content:center}
.tm-rail{display:flex;gap:24px}.tm-rail>span{display:grid;justify-items:center;gap:2px}.tm-rail small{color:var(--text-muted);font-size:12.5px}.tm-rail .tm-icons img{inline-size:44px;block-size:44px;margin-inline:-7px}
.cx-phone .gc-table{gap:10px}.cx-phone .tm-team{padding:8px 10px;gap:6px}.cx-phone .tm-level b{font-size:30px}.cx-phone .tm-icons img{inline-size:30px;block-size:30px;margin-inline:-5px}
.cx-phone .tm-c{inline-size:52px}.cx-phone .tm-c+.tm-c{margin-inline-start:-38px}.cx-phone .tm-c:last-child{inline-size:78px;margin-inline-start:-44px}.cx-phone .tm-next{display:none}
.tm-acts--ph{margin-inline:10px}.tm-acts--ph .bgv-btn{flex:1}`,
    shotTitle: 'وسط مرحله', turnSub: 'بازی بی‌نوبت و بدون حرف',
    diffs: [
      ['بی‌نوبت', 'نوبت و ساعت نوبت ندارد؛ همه هر وقت بخواهند کمترین کارتشان را بازی می‌کنند. پس چیپ‌ها ساعت ندارند و فقط تعداد کارت دست هر نفر پیداست'],
      ['تیم', 'مرحله، جان‌ها و ستاره‌ها وسط میز و در ستون کنار؛ جاهای خالی (تا ۵ جان و ۳ ستاره) کم‌رنگ دیده می‌شوند'],
      ['کارت و دسته', 'کارت مثل نسخهٔ چاپی NSV است: یک زمینهٔ خالی (با GPT ساخته و با عکس کارت واقعی مقایسه شد) و عدد با کد، عدد بزرگ سیاه با دورخط سفید وسط و چهار عدد کوچک سفید در گوشه‌ها (دو تای پایین وارونه)، پس ۱۰۰ کارت یک تصویر و یک جزء است. کارت‌های بازی‌شدهٔ این مرحله روی هم با آخرین کارت بزرگ‌تر؛ کنارش «۳۱ ← ؟» و تعداد کارت‌های مانده در دست همه'],
      ['دست شما', 'فقط کمترین کارت قابل بازی است و بالا آمده؛ بقیه کم‌رنگ‌اند. دکمهٔ بازی عدد همان کارت را دارد'],
      ['ستاره و گفت‌وگو', 'پیشنهاد ستاره با برچسب روی چیپ و شمارش موافق‌ها؛ گفت‌وگو در طول مرحله بسته است چون حرف زدن دربارهٔ عددها ممنوع است'],

      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر، ۱۲ / ۱۰ / ۸ مرحله؛ پاداش ستاره بعد از مرحله‌های ۲، ۵، ۸ و جان بعد از ۳، ۶، ۹'],
    ],
  };
}
