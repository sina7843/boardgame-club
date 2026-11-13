// No Thanks! on the card-table frame (as the repo engine: cards 3–35, 9 removed unseen, 11 chips each for 3–5 players).
// Mock: 4 players (44 chips). Taken: you 6, 25, 26 · Niloufar 8, 9, 31 · Reza 17, 33, 34, 35 · Sara 12, 19, 20 = 13 cards;
// 27 is up with 6 chips on it (Reza took 35 and turned up 27; refusals: Reza, Sara, you, Niloufar, Reza, Sara),
// deck 24 − 14 = 10. You hold 5 chips (others' chips are secret). Score now 6 + 25 − 5 = 26; taking 27 → 6 + 25 − 11 = 20.
// No hidden hand: your cards lie face up, so the frame's hand is empty and your runs sit above your bar.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const c = (n) => `no-thanks-${n}`;
  const runs = (rs, cls = 'nt-runs') => `<span class="${cls}">${rs.map((r) => `<span class="nt-run">${r.map((n) => img(c(n), fa(n))).join('')}</span>`).join('')}</span>`;
  const chipN = (n) => `<span class="nt-chips">${img('no-thanks-chip', 'ژتون')}<b>${n}</b></span>`;
  const meta = (rs) => `<span class="nt-tags">${rs.map((r) => `<span class="nt-tag">${r.map((n) => `<i>${fa(n)}</i>`).join('')}</span>`).join('')}</span>${chipN('؟')}`;
  const above = (ph) => `<div class="nt-me${ph ? ' nt-me--ph' : ''}">
<div class="nt-mine"><span class="nt-mine__l">کارت‌های شما</span><span class="nt-runs"><span class="nt-run">${img(c(6), '۶')}</span><span class="nt-run">${img(c(25), '۲۵')}${img(c(26), '۲۶')}<span class="nt-ghost">${img(c(27), '۲۷ اگر بردارید')}</span></span></span></div>
<div class="nt-dec">${btn(`برمی‌دارم (+${fa(6)} ژتون)`, 'primary', 'hand')}${btn('نه، مرسی! (−۱)', 'secondary', 'x')}</div></div>`;
  const { modal } = H;
  const runT = (rs) => rs.map((r) => r.length > 1 ? `<span class="nt-r">${fa(r[0])} تا ${fa(r[r.length - 1])}</span>` : `<span class="nt-r">${fa(r[0])}</span>`).join(' ');
  const ending = (ph) => modal('پایان بازی', `<p>آخرین کارت برداشته شد و ژتون‌های همه رو شد. از هر ردیف پشت‌سرهم فقط کوچک‌ترین عدد حساب می‌شود و هر ژتون یک امتیاز کم می‌کند؛ <b>کمترین امتیاز می‌برد</b>.</p>
<table class="gd-score"><thead><tr><th>رتبه</th><th>بازیکن</th><th class="n">کارت‌ها</th><th class="n">کارت</th><th class="n">ژتون</th><th class="n">امتیاز</th></tr></thead><tbody>
<tr class="is-win"><td>${fa(1)}</td><td>سارا</td><td class="n">${runT([[11, 12], [19, 20, 21], [28]])}</td><td class="n">${fa(58)}</td><td class="n">${fa(16)}−</td><td class="n">${fa(42)}</td></tr>
<tr><td>${fa(2)}</td><td>نیلوفر</td><td class="n">${runT([[8, 9, 10], [14], [31, 32]])}</td><td class="n">${fa(53)}</td><td class="n">${fa(6)}−</td><td class="n">${fa(47)}</td></tr>
<tr><td>${fa(3)}</td><td>شما</td><td class="n">${runT([[6], [16], [25, 26, 27], [29]])}</td><td class="n">${fa(76)}</td><td class="n">${fa(14)}−</td><td class="n">${fa(62)}</td></tr>
<tr><td>${fa(4)}</td><td>رضا</td><td class="n">${runT([[3], [17], [22], [33, 34, 35]])}</td><td class="n">${fa(75)}</td><td class="n">${fa(8)}−</td><td class="n">${fa(67)}</td></tr></tbody></table><p class="cx-note">۹ کارت از اول نادیده کنار رفته بود: ${[4, 5, 7, 13, 15, 18, 23, 24, 30].map((n) => fa(n)).join('، ')}. امتیاز برابر یعنی رتبهٔ مشترک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'NoThanks', fa: 'نه مرسی', latin: 'No Thanks!', meta: ['زنده', '۴ نفر', '۳۰ ثانیه هر نوبت'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: meta([[8, 9], [31]]) },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: meta([[17], [33, 34, 35]]) },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:30', meta: meta([[12], [19, 20]]) },
    ],
    me: { cards: [], clock: '0:22', turn: true, note: `${chipN(fa(5))}<span>امتیاز فعلی ${fa(26)}</span>`, above: (ph) => above(ph) },
    table: (ph) => `<div class="gc-pile" style="--pw:96px;--ppw:62px">${img('no-thanks-back', 'دسته')}<span>دسته: <b>${fa(10)}</b> کارت</span><small class="nt-rem">${fa(9)} کارت کنار رفته و دیده نمی‌شود</small></div>
<div class="nt-offer"><span class="nt-offer__c">${img(c(27), 'کارت ۲۷')}<span class="nt-pot" aria-label="${fa(6)} ژتون روی کارت">${Array.from({ length: 6 }, () => img('no-thanks-chip', '')).join('')}</span></span><span class="nt-offer__l"><b>${fa(6)}</b> ژتون روی کارت</span></div>`,
    status: '<b>نوبت شماست.</b> ۲۷ با ۶ ژتون جلوی شماست. اگر بردارید کنار ۲۵ و ۲۶ می‌نشیند و امتیاز تازه‌ای نمی‌دهد؛ یا یک ژتون بدهید و رد کنید.',
    pstatus: '<b>نوبت شما.</b> ۲۷ را برمی‌دارید یا یک ژتون می‌دهید؟',
    railCard: `<section class="cx-card"><h3>حساب شما</h3><div class="gc-pills"><span class="bgv-chip">الان: ${fa(26)}</span><span class="bgv-chip">با ۲۷: ${fa(20)}</span><span class="bgv-chip">ژتون: ${fa(5)}</span></div><div class="ga-rule">${ic('info')}<span>از هر رشتهٔ پشت سر هم فقط کوچک‌ترین کارت حساب می‌شود و هر ژتون یک امتیاز کم می‌کند. امتیاز کمتر برنده است. ژتون‌های بقیه مخفی است.</span></div></section>`,
    logNote: '۱۰ کارت مانده',
    log: [[6, 'رضا ۳۵ را با ۴ ژتون برداشت'], [6, 'کارت تازه: ۲۷؛ رضا نه، مرسی'], [4, 'سارا نه، مرسی'], [1, 'شما نه، مرسی'], [2, 'نیلوفر نه، مرسی'], [6, 'رضا نه، مرسی'], [4, 'سارا نه، مرسی'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['hand', 'برمی‌دارم'], ['x', 'نه، مرسی'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'پایان بازی', turnSub: 'ژتون‌های همه رو، امتیاز و رتبه', overlay: ending, meta: ['تمام شد', '۴ نفر', 'دسته خالی'],
        me: { turn: false, clock: '', above: () => '', note: `<span class="cx-note">${fa(62)} امتیاز</span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> سارا با ۴۲ امتیاز برد؛ شما سوم شدید.',
        log: [[4, 'سارا آخرین کارت را برداشت'], [1, 'ژتون‌ها رو شد'], [4, 'سارا برد']],
        phone: true,
      },
    ],    css: `.nt-r{display:inline-block;padding:0 6px;margin:1px;border-radius:6px;background:var(--surface-sunken);white-space:nowrap}
.nt-runs{display:inline-flex;gap:10px;direction:ltr}
.nt-run{display:inline-flex}.nt-run img{inline-size:58px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 6px 10px -6px rgba(0,0,0,.6)}
.nt-run img+img{margin-inline-start:-26px}.nt-ghost{margin-inline-start:6px}
.nt-tag i{font-style:normal}.nt-tags{display:inline-flex;gap:4px;direction:ltr}.nt-tag{display:inline-flex;align-items:center;gap:4px;font-style:normal;block-size:20px;padding-inline:6px;border-radius:5px;background:#FBE9C8;color:#1F4E8C;font-weight:800;font-size:12px;box-shadow:inset 0 0 0 1.5px #E58A2B;white-space:nowrap}.nt-runs--mini{gap:4px}.nt-runs--mini .nt-run img{inline-size:16px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.4)}.nt-runs--mini .nt-run img+img{margin-inline-start:-9px}
.nt-chips{display:inline-flex;align-items:center;gap:3px;font-weight:700;color:var(--felt-ink)}.nt-chips img{inline-size:16px;block-size:auto}
.cx-pbar__note{display:inline-flex;align-items:center;gap:10px}
.nt-rem{font-size:11.5px;color:var(--felt-muted);max-inline-size:120px;text-align:center;line-height:1.5}
.nt-offer{display:grid;justify-items:center;gap:10px;color:var(--felt-muted);font-size:13px}
.nt-offer__c{position:relative}.nt-offer__c>img{display:block;inline-size:150px;border-radius:9px;box-shadow:0 0 0 3px var(--felt-gold),0 16px 26px -12px rgba(0,0,0,.75)}
.nt-pot{position:absolute;inset-block-end:-14px;inset-inline:0;display:flex;justify-content:center}.nt-pot img{inline-size:34px;margin-inline:-6px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.nt-pot img:nth-child(odd){transform:translateY(-6px)}
.nt-offer__l b{font-size:20px;color:var(--felt-ink)}
.nt-me{display:flex;align-items:center;justify-content:space-between;gap:16px;inline-size:100%;padding:8px 12px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box}
.nt-mine{display:flex;align-items:center;gap:12px;color:var(--felt-muted);font-size:12.5px}
.nt-ghost img{opacity:.45;outline:2px dashed var(--felt-gold);outline-offset:-2px}
.nt-dec{display:flex;gap:8px}.nt-dec .bgv-btn{white-space:nowrap}
.cx-phone .nt-offer__c>img{inline-size:96px}.cx-phone .nt-pot img{inline-size:24px;margin-inline:-4px}.cx-phone .nt-rem{display:none}
.nt-me--ph{display:grid;justify-items:center;margin-inline:10px;inline-size:auto;gap:8px}.nt-me--ph .nt-dec{display:none}.nt-me--ph .nt-run img{inline-size:44px}.nt-me--ph .nt-run img+img{margin-inline-start:-20px}`,
    shotTitle: 'نوبت شما', turnSub: 'برداشتن یا یک ژتون',
    diffs: [
      ['بدون دست', 'در این بازی دست پنهان ندارید؛ کارت‌هایی که برداشته‌اید رو و به ترتیب جلوی شماست. پس پایین میز به جای بادبزن کارت، رشته‌های شما و دو دکمهٔ تصمیم است'],
      ['وسط میز', 'کارت رو بزرگ با ژتون‌های رویش و دستهٔ پشت‌ورو؛ ۹ کارتی که کنار رفته هیچ‌وقت دیده نمی‌شود'],
      ['رشته‌ها', 'کارت‌های پشت سر هم روی هم می‌افتند تا رشته دیده شود؛ روی چیپ حریف‌ها رشته‌ها به شکل برچسب عددی‌اند تا خوانا بمانند؛ کارت پیشنهادی اگر رشته را ادامه دهد خط‌چین کنارش نشان داده می‌شود'],
      ['ژتون', 'ژتون‌های خودتان را می‌بینید و ژتون بقیه «؟» است (مثل قانون و موتور)؛ بی‌ژتون دکمهٔ «نه، مرسی» خاموش است'],
      ['حساب', 'ستون کنار امتیاز فعلی و امتیاز بعد از برداشتن را کنار هم می‌گذارد'],
      ['قوانین', '۳ تا ۷ نفر؛ دونفره ندارد (تصمیم مالک). ۱۱ ژتون (۶ نفر ۹، ۷ نفر ۷)؛ کمترین امتیاز برنده است'],
    ],
  };
}
