// Love Letter on the card-table frame (classic 16-card edition, as the repo engine; 4 players → 4 tokens to win).
// Mock round 4, your third turn: you hold Guard + Baron. Your Priest (turn 1) showed Sara holds the Prince;
// Sara has since played Baron (beat Reza) and a drawn Guard, so she still has it. Niloufar is protected (Handmaid).
// Played: you 2,1 · Niloufar 1,4 · Reza 1,2 (out) · Sara 3,1. Hands: you 2, Niloufar 1, Sara 1. Set aside 1 → deck 3.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const NAME = { 1: 'نگهبان', 2: 'کشیش', 3: 'بارون', 4: 'ندیمه', 5: 'شاهزاده', 6: 'شاه', 7: 'کنتس', 8: 'شاهزاده‌خانم' };
  const role = (n, cls = '') => img(`love-letter-role-${n}`, `${NAME[n]} (${fa(n)})`, cls);
  const disc = (...ns) => `<span class="ll-disc" aria-label="کارت‌های بازی‌شده">${ns.map((n) => role(n)).join('')}</span>`;
  const tok = (n) => `<span class="ll-tok" aria-label="${fa(n)} نشان از ${fa(4)}">${img('love-letter-token', '')}${fa(n)}</span>`;
  const guess = (ph) => `<div class="ll-guess${ph ? ' ll-guess--ph' : ''}" role="group" aria-label="حدس نگهبان">
<span class="ll-guess__l">حدس برای <b>سارا</b></span>
<span class="ll-guess__row">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" class="ll-g${n === 5 ? ' is-sel' : ''}${[2, 3].includes(n) ? ' is-gone' : ''}" aria-pressed="${n === 5}">${img(`love-letter-guess-${n}`, '')}<small>${NAME[n]}</small></button>`).join('')}</span>
${ph ? '' : btn('بازی نگهبان', 'primary', 'check')}</div>`;
  const { modal } = H;
  const deck = (n, extra = '') => (ph) => `<div class="gc-pile" style="--pw:92px;--ppw:58px">${img('love-letter-back', 'دسته')}<span>دسته: <b>${fa(n)}</b> کارت</span></div>
<div class="gc-pile ll-aside" style="--pw:62px;--ppw:42px">${img('love-letter-back', 'کارت کنار گذاشته')}<span>کنار گذاشته</span></div>${extra}`;
  const baron = (ph) => modal('مقایسهٔ بارون', `<p class="cx-note">این دو کارت را فقط شما و سارا می‌بینید.</p><div class="ll-vs"><figure>${role(8)}<figcaption>شما: شاهزاده‌خانم (${fa(8)})</figcaption></figure><b>${fa(8)} &gt; ${fa(5)}</b><figure class="is-out">${role(5)}<figcaption>سارا: شاهزاده (${fa(5)})</figcaption></figure></div><p>کارت سارا کوچک‌تر بود؛ <b>سارا از این دور بیرون رفت</b> و کارتش برای همه رو می‌شود. کارت شما پنهان می‌ماند. اگر مساوی بود کسی بیرون نمی‌رفت.</p>`, `${btn('ادامه', 'primary', 'check')}`);
  const tgt = (name, seatN, st, sel, off) => `<button type="button" class="ll-t${sel ? ' is-sel' : ''}"${off ? ' disabled' : ''}><i style="background:var(--seat-${seatN})"></i>${name}<small>${st}</small></button>`;
  const princeBar = (ph) => `<div class="ll-guess${ph ? ' ll-guess--ph' : ''}" role="group" aria-label="هدف شاهزاده"><span class="ll-guess__l">هدف <b>شاهزاده</b></span><span class="ll-guess__row">${tgt('نیلوفر', 2, 'در امان', false, true)}${tgt('سارا', 4, 'در امان', false, true)}${tgt('خودم', 1, 'تنها هدف', true)}</span>${ph ? '' : btn('بازی شاهزاده', 'primary', 'check')}</div>`;
  const noTarget = (ph) => modal('هدفی نمانده', `<div class="ll-vs">${role(1)}<p>همهٔ بازیکنان دیگر یا در امان‌اند یا بیرون. نگهبان <b>بی‌اثر بازی می‌شود</b>: فقط کنار کارت‌های بازی‌شده‌تان می‌رود.</p></div>`, `${btn('لغو', 'secondary', 'x')}${btn('بازی بی‌اثر', 'primary', 'check')}`);
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const roundEnd = (ph) => modal('پایان دور ۴: دسته تمام شد', `<p>کارت‌های دست رو شد. بزرگ‌ترین کارت نشان می‌گیرد؛ اگر مساوی بود، جمع کارت‌های بازی‌شده.</p>
${tbl(['بازیکن', 'کارت دست', 'جمع بازی‌شده‌ها', 'نتیجه'], [
      { c: ['شما', `<span class="ll-hc">${role(5)}شاهزاده</span>`, fa(11), `${img('love-letter-token', '', 'll-ti')} نشان دوم`], win: true },
      { c: ['سارا', `<span class="ll-hc">${role(5)}شاهزاده</span>`, fa(6), 'تساوی، جمع کمتر'] },
      { c: ['نیلوفر', `<span class="ll-hc">${role(3)}بارون</span>`, fa(5), '—'] },
      { c: ['رضا', '—', fa(3), 'بیرون رفته بود'] },
    ])}<p class="cx-note">اگر جمع‌ها هم برابر بود هیچ‌کس نشان نمی‌گرفت و نفر بعد از شروع‌کننده دور بعد را شروع می‌کرد. هدف: ${fa(4)} نشان.</p>`, `${btn('دور بعد', 'primary', 'next')}`);
  const two = (ph) => `<div class="gc-pile" style="--pw:92px;--ppw:52px">${img('love-letter-back', 'دسته')}<span>دسته: <b>${fa(10)}</b></span></div><div class="ll-up" aria-label="سه کارت رو کنار گذاشته">${role(4)}${role(1)}${role(2)}<small>کنار گذاشته، رو</small></div>`;  return {
    slug: 'LoveLetter', fa: 'نامه عاشقانه', latin: 'Love Letter', meta: ['زنده', '۴ نفر', 'دور ۴', 'هدف: ۴ نشان'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${disc(1, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
      { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${disc(1, 2)}${tok(0)}<span class="gc-tag gc-tag--soft">بیرون از دور</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${disc(3, 1)}${tok(1)}<span class="gc-tag">هدف</span>` },
    ],
    me: {
      cards: [{ art: 'love-letter-role-1', alt: 'نگهبان (۱)', ok: true, sel: true }, { art: 'love-letter-role-3', alt: 'بارون (۳)', ok: true }],
      clock: '0:31', turn: true, note: `${disc(2, 1)}${tok(1)}`, above: (ph) => guess(ph),
    },
    cardW: 126, phoneCardW: 80, cardRatio: 1.345,
    table: (ph) => `<div class="gc-pile" style="--pw:92px;--ppw:58px">${img('love-letter-back', 'دسته')}<span>دسته: <b>${fa(3)}</b> کارت</span></div>
<div class="gc-pile ll-aside" style="--pw:62px;--ppw:42px">${img('love-letter-back', 'کارت کنار گذاشته')}<span>کنار گذاشته</span></div>
<div class="ll-play"><span class="ll-play__c">${role(1)}</span><span><b>نگهبان روی سارا</b><br><small>اگر کارت دستش شاهزاده باشد از این دور بیرون می‌رود</small></span></div>`,
    status: '<b>نوبت شماست.</b> نگهبان را انتخاب کردید و هدفتان ساراست. حالا حدس بزنید چه کارتی دارد (نگهبان را نمی‌شود حدس زد).',
    pstatus: '<b>نوبت شما.</b> کارت سارا را حدس بزنید.',
    railCard: `<section class="cx-card"><h3>یادداشت‌های شما</h3><div class="ll-seen">${role(5)}<span><b>سارا شاهزاده دارد</b><br><small>با کشیش دیدید (نوبت اول). بعدش بارون و نگهبان بازی کرد، پس هنوز همان را دارد.</small></span></div>
<div class="gc-pills"><span class="bgv-chip">دیده‌نشده: ندیمه ${fa(1)}</span><span class="bgv-chip">شاهزاده ${fa(2)}</span><span class="bgv-chip">شاه ${fa(1)}</span><span class="bgv-chip">کنتس ${fa(1)}</span><span class="bgv-chip">شاهزاده‌خانم ${fa(1)}</span></div>
<div class="ga-rule">${ic('info')}<span>ندیمه نیلوفر را تا نوبت بعدش در امان نگه می‌دارد؛ رضا هم از این دور بیرون است. پس فقط سارا را می‌شود هدف گرفت.</span></div></section>`,
    logNote: 'دور ۴',
    log: [[1, 'شما با کشیش دست سارا را دیدید'], [2, 'نیلوفر با نگهبان روی شما «بارون» گفت؛ اشتباه بود'], [4, 'سارا با بارون رضا را بیرون کرد (کشیش)'], [1, 'شما با نگهبان روی نیلوفر «کشیش» گفتید؛ اشتباه بود'], [2, 'نیلوفر ندیمه بازی کرد و در امان است'], [4, 'سارا با نگهبان روی شما «شاه» گفت؛ اشتباه بود'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین و کارت‌ها', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['check', 'بازی کارت'], ['list', 'کارت‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'نتیجهٔ بارون', turnSub: 'نمایش خصوصی دو کارت، اعلام عمومی حذف',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${disc(1, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${disc(1, 2)}${tok(0)}<span class="gc-tag gc-tag--soft">بیرون از دور</span>` },
          { name: 'سارا', av: 'س', seat: 4, out: true, meta: `${disc(3, 1, 5)}${tok(1)}<span class="gc-tag gc-tag--soft">بیرون رفت: شاهزاده</span>` },
        ],
        table: deck(3), overlay: baron,
        me: { cards: [{ art: 'love-letter-role-8', alt: 'شاهزاده‌خانم (۸)' }], note: `${disc(2, 1, 3)}${tok(1)}`, above: () => '' },
        status: '<b>بارون روی سارا.</b> کارت شما بزرگ‌تر بود و سارا بیرون رفت؛ کارت او (شاهزاده) برای همه رو شد.',
        log: [[4, 'سارا با نگهبان روی شما «شاه» گفت؛ اشتباه بود'], [1, 'شما بارون را روی سارا بازی کردید'], [4, 'سارا با شاهزاده بیرون رفت']],
      },
      {
        shotTitle: 'شاهزاده روی خودتان', turnSub: 'چیپ «خودم»؛ وقتی بقیه در امان‌اند اجباری است',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${disc(1, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${disc(1, 2)}${tok(0)}<span class="gc-tag gc-tag--soft">بیرون از دور</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${disc(3, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
        ],
        table: deck(2),
        me: { cards: [{ art: 'love-letter-role-5', alt: 'شاهزاده (۵)', ok: true, sel: true }, { art: 'love-letter-role-2', alt: 'کشیش (۲)', ok: true }], note: `${disc(2, 1)}${tok(1)}`, above: princeBar },
        status: '<b>نوبت شماست.</b> نیلوفر و سارا هر دو ندیمه دارند، پس اگر شاهزاده بازی کنید تنها هدف خودتان هستید: کشیشتان را دور می‌ریزید و کارت تازه می‌کشید.',
        pstatus: '<b>نوبت شما.</b> شاهزاده فقط روی خودتان.',
        phone: true,
        log: [[2, 'نیلوفر ندیمه بازی کرد'], [4, 'سارا ندیمه بازی کرد'], [1, 'نوبت شماست']],
      },
      {
        shotTitle: 'کارت بی‌هدف', turnSub: '«بی‌اثر بازی می‌شود»', phone: true, phoneOnly: true,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${disc(1, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${disc(1, 2)}${tok(0)}` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:45', meta: `${disc(3, 4)}${tok(1)}<span class="gc-tag gc-tag--soft">${ic('hand')}در امان</span>` },
        ],
        table: deck(2), overlay: noTarget,
        me: { cards: [{ art: 'love-letter-role-1', alt: 'نگهبان (۱)', sel: true }, { art: 'love-letter-role-6', alt: 'شاه (۶)' }], note: `${disc(2, 1)}${tok(1)}`, above: () => '' },
        pstatus: '<b>هدفی نیست.</b> نگهبان بی‌اثر بازی می‌شود.', status: '',
      },
      {
        shotTitle: 'پایان دور', turnSub: 'کارت‌های رو شده، تساوی‌شکن و نشان',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `${disc(1, 4)}${tok(1)}` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${disc(1, 2)}${tok(0)}` },
          { name: 'سارا', av: 'س', seat: 4, meta: `${disc(2, 4)}${tok(1)}` },
        ],
        table: deck(0), overlay: roundEnd,
        me: { turn: false, clock: '', cards: [{ art: 'love-letter-role-5', alt: 'شاهزاده (۵)' }], note: `${disc(1, 3, 7)}${tok(2)}`, above: () => '' },
        status: '<b>دور ۴ تمام شد.</b> شما و سارا هر دو شاهزاده داشتید؛ جمع کارت‌های بازی‌شدهٔ شما بیشتر بود و نشان را گرفتید.',
        log: [[2, 'نیلوفر آخرین کارت دسته را کشید'], [1, 'دسته تمام شد؛ کارت‌ها رو شد'], [1, 'شما نشان گرفتید (۲ از ۴)']],
      },
      {
        shotTitle: 'دونفره', turnSub: 'سه کارت رو کنار دسته؛ هدف ۶ نشان', phone: true, phoneOnly: true, meta: ['زنده', '۲ نفر', 'دور ۱', 'هدف: ۶ نشان'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:45', meta: `${tok(0)}` }],
        table: two,
        me: { cards: [{ art: 'love-letter-role-3', alt: 'بارون (۳)', ok: true }, { art: 'love-letter-role-6', alt: 'شاه (۶)', ok: true }], note: `${tok(0)}`, above: () => '' },
        pstatus: '<b>بازی دونفره.</b> سه کارت رو و یک کارت پنهان کنار رفته؛ ۶ نشان لازم است.', status: '',
      },
    ],    css: `.gc-card{margin-inline-start:10px}
.ll-disc{display:inline-flex;gap:2px}.ll-disc img{inline-size:20px;block-size:auto;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.45)}
.ll-tok{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:var(--felt-ink)}
.ll-tok img{inline-size:18px;block-size:18px}
.cx-pbar .ll-tok{color:var(--felt-ink)}.cx-pbar__note{display:inline-flex;align-items:center;gap:8px}
.gc-seat__meta .gc-tag{block-size:20px;padding-inline:6px;font-size:11.5px}.gc-seat__meta .gc-tag .bgv-icon{inline-size:12px;block-size:12px}
.gc-seat__meta{flex-wrap:wrap}
.ll-aside img{opacity:.85;transform:rotate(-8deg)}
.ll-play{display:flex;gap:10px;align-items:center;max-inline-size:250px;padding:10px 12px;border-radius:var(--radius-md);background:rgba(232,166,66,.14);box-shadow:inset 0 0 0 1.5px var(--felt-gold);color:var(--felt-ink);font-size:13px;line-height:1.6}.ll-play small{color:var(--felt-muted)}
.ll-play__c img{inline-size:44px;border-radius:3px;display:block}
.ll-guess{display:flex;align-items:center;gap:8px;padding:5px 10px;max-inline-size:100%;box-sizing:border-box;border-radius:var(--radius-md);background:rgba(8,20,28,.35);color:var(--felt-ink);font-size:13px}
.ll-guess__l{white-space:nowrap}
.ll-guess__row{display:flex;gap:4px}
.ll-g{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:2px;inline-size:50px;padding:4px 2px;border-radius:8px}
.ll-g img{inline-size:32px;block-size:32px;display:block}.ll-g small{font-size:10px;color:var(--felt-muted);white-space:nowrap}
.ll-g.is-sel{background:var(--felt-gold)}.ll-g.is-sel small{color:#142B3B;font-weight:700}
.ll-g.is-gone{opacity:.4}
.ll-guess .bgv-btn{white-space:nowrap}
.ll-seen{display:flex;gap:12px;align-items:center;font-size:14px;line-height:1.7;color:var(--text)}.ll-seen img{inline-size:56px;border-radius:4px;box-shadow:var(--shadow-card)}.ll-seen small{color:var(--text-muted);font-size:12.5px}
.cx-phone .ll-play{display:none}
.ll-guess--ph{display:grid;gap:4px;margin-inline:10px;padding:6px}.ll-guess--ph .ll-guess__row{gap:0;justify-content:space-between}.ll-guess--ph .ll-g{inline-size:auto;flex:1;padding-inline:0}.ll-guess--ph .ll-g img{inline-size:28px;block-size:28px}.ll-guess--ph .ll-g small{font-size:9.5px}
.cx-phone .gc-hand{padding-block-start:22px}
.ll-vs{display:flex;align-items:center;justify-content:center;gap:16px}.ll-vs figure{margin:0;display:grid;justify-items:center;gap:6px;font-size:12.5px;font-weight:700}.ll-vs figure img,.ll-vs>img{inline-size:96px;border-radius:6px;box-shadow:var(--shadow-card)}
.ll-vs figure.is-out img{filter:grayscale(.7)}.ll-vs>b{font-size:20px;color:var(--heading)}
.cx-phone .ll-vs figure img,.cx-phone .ll-vs>img{inline-size:64px}.cx-phone .ll-vs{gap:8px}
.ll-t{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:auto auto;align-items:center;column-gap:6px;padding:6px 12px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-weight:700}
.ll-t i{grid-row:1/3;inline-size:9px;block-size:9px;border-radius:50%}.ll-t small{font-size:10.5px;font-weight:500;color:var(--felt-muted)}
.ll-t.is-sel{background:var(--felt-gold);color:#142B3B}.ll-t.is-sel small{color:#142B3B}.ll-t:disabled{opacity:.45}
.ll-guess--ph .ll-t{padding:6px 8px;font-size:12px}
.ll-hc{display:inline-flex;align-items:center;gap:6px}.ll-hc img{inline-size:26px;border-radius:2px}
.ll-ti{inline-size:18px;vertical-align:middle}
.ll-up{display:grid;grid-template-columns:repeat(3,auto);gap:4px;justify-items:center;color:var(--felt-muted);font-size:11px}.ll-up img{inline-size:46px;border-radius:3px}.ll-up small{grid-column:1/4}`,
    shotTitle: 'نوبت شما', turnSub: 'نگهبان: هدف و حدس',
    diffs: [
      ['چیدمان', 'حریف‌ها بالا؛ جلوی هر کدام کارت‌هایی که این دور بازی کرده رو و ریز چیده شده و تعداد نشان‌هایش. وسط میز دسته، کارت کنار گذاشته و کارتی که دارید بازی می‌کنید'],
      ['دو کارت', 'دست شما همیشه دو کارت است (یکی کشیده‌اید)؛ کارت‌ها جدا و بزرگ‌اند و کارت انتخاب‌شده بالا می‌آید. قانون کنتس (با شاه یا شاهزاده) کارت دیگر را غیرفعال می‌کند'],
      ['هدف و حدس', 'هدف را از چیپ حریف بالا انتخاب می‌کنید؛ کسی که ندیمه دارد یا بیرون است انتخاب‌شدنی نیست. حدس نگهبان یک ردیف هفت‌تایی (۲ تا ۸) بالای دست است؛ کارت‌هایی که همه‌شان رو شده کم‌رنگ‌اند'],
      ['یادداشت‌ها', 'چیزی که با کشیش یا تساوی بارون دیده‌اید فقط برای شما در ستون کنار می‌ماند، با شمارش کارت‌های دیده‌نشده'],
      ['نشان محبت', 'تصویر نشان از BGA (همان ژتونی که شمارندهٔ محبت BGA است)'],
      ['قوانین', 'نسخهٔ کلاسیک ۱۶ کارتی مثل موتور: ۲ تا ۴ نفر، ۶ / ۵ / ۴ نشان (مثل BGA)؛ در دونفره ۳ کارت رو هم کنار دسته دیده می‌شود (§۸)'],
    ],
  };
}
