// Skull on the card-table frame (as the repo engine: 4 discs each, 3 roses + 1 skull; 2 challenges win).
// Mock: 4 players, bidding phase. Stacks on the table: you 2 (both roses), Niloufar 2, Reza 3, Sara 1 → 8 discs, max bid 8.
// Niloufar opened with 3, Reza passed, Sara raised to 4; now you raise (5 to 8) or pass. Reza has 1 point (mat flipped);
// Sara lost a disc earlier (owns 3). Placing is closed once bidding starts, so your two held discs are dimmed.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const pile = (p, n, w = 16) => `<span class="sk-pile" style="--n:${n};--sw:${w}px" aria-label="${fa(n)} دیسک روی میز">${Array.from({ length: n }, () => img(`skull-player-${p}-back`)).join('')}</span>`;
  const meta = (p, stack, hand, pts, tag = '') => `${pile(p, stack)}<span>میز <b>${fa(stack)}</b><span class="bgv-sep"></span>دست ${fa(hand)}</span>${pts ? `<span class="gc-tag" title="امتیاز">★ ${fa(pts)}</span>` : ''}${tag}`;
  const mat = (p, pts, name, n, o = {}) => `<div class="sk-mat${o.me ? ' is-me' : ''}${o.bid ? ' is-bid' : ''}${o.pass ? ' is-pass' : ''}">
<span class="sk-mat__bg">${img(`skull-player-${p}-points-${pts}`, pts ? 'زیرانداز (یک امتیاز)' : 'زیرانداز')}<span class="sk-stack" style="--n:${n}">${o.faces ? o.faces.map((f) => img(`skull-player-1-${f}`, f === 'rose' ? 'گل' : 'جمجمه')).join('') : Array.from({ length: n }, () => img(`skull-player-${p}-back`, '')).join('')}</span></span>
<span class="sk-mat__l"><b>${name}</b> ${fa(n)} دیسک${o.note ? `<span class="bgv-sep"></span>${o.note}` : ''}</span></div>`;
  const bidRow = (ph) => `<div class="sk-bid${ph ? ' sk-bid--ph' : ''}" role="group" aria-label="شرط شما"><span class="sk-bid__l">شرط شما</span>
<span class="sk-bid__n">${[5, 6, 7, 8].map((n) => `<button type="button" class="sk-n${n === 5 ? ' is-sel' : ''}" aria-pressed="${n === 5}">${fa(n)}</button>`).join('')}</span>
${ph ? '' : `${btn('شرط ۵', 'primary', 'check')}${btn('پاس', 'secondary', 'x')}`}</div>`;
  const { modal } = H;
  // mat with explicit faces: up = [[player, 'rose'|'skull'], …] shown on top of the remaining backs
  const matF = (p, pts, name, n, up, o = {}) => `<div class="sk-mat${o.me ? ' is-me' : ''}${o.click ? ' is-click' : ''}${o.bad ? ' is-bad' : ''}">
<span class="sk-mat__bg">${img(`skull-player-${p}-points-${pts}`, 'زیرانداز')}<span class="sk-stack sk-stack--f">${Array.from({ length: n - up.length }, () => img(`skull-player-${p}-back`, '')).join('')}${up.map(([pp, f]) => img(`skull-player-${pp}-${f}`, f === 'rose' ? 'گل رو شده' : 'جمجمه رو شده', 'is-up')).join('')}</span></span>
<span class="sk-mat__l"><b>${name}</b> ${o.note ?? `${fa(n)} دیسک`}</span></div>`;
  const placeBar = (ph) => `<div class="sk-bid${ph ? ' sk-bid--ph' : ''}"><span class="sk-bid__l">${ph ? 'دیسک' : 'یک دیسک بگذارید'}</span>${btn(ph ? 'گل' : 'گذاشتن گل', 'secondary', 'check')}${btn(ph ? 'جمجمه' : 'گذاشتن جمجمه', 'secondary', 'check')}<span class="sk-or">یا</span>${btn(ph ? 'شرط' : 'باز کردن شرط', 'primary', 'zap')}</div>`;
  const flipBar = (ph) => `<div class="sk-bid${ph ? ' sk-bid--ph' : ''}"><span class="sk-left"><b>${fa(4)} از ${fa(5)}</b> رو شد</span><span class="sk-bid__l">${ph ? '۱ تا مانده؛ یک پشته را بزنید' : 'یکی دیگر مانده؛ روی پشتهٔ یکی از حریف‌ها بزنید'}</span></div>`;
  const lost = (ph) => modal('چالش شکست خورد', `<div class="sk-lost">${img('skull-player-4-skull', 'جمجمهٔ سارا')}<div><p>دیسک بالایی سارا <b>جمجمه</b> بود. یک دیسک از دیسک‌های شما به‌طور تصادفی کنار رفت.</p><p class="sk-priv">${img('skull-player-1-rose', 'گل')}<span><b>فقط شما می‌بینید:</b> یک <b>گل</b> از دست دادید. بقیه فقط می‌بینند که «یک دیسک از دست داد».</span></p></div></div><p class="cx-note">اگر جمجمهٔ خودتان بود، خودتان انتخاب می‌کردید کدام دیسک برود. حالا ${fa(3)} دیسک دارید و دور بعد را سارا شروع می‌کند.</p>`, `${btn('ادامه', 'primary', 'check')}`);
  const ending = (ph) => modal('شما بردید', `<p>دومین چالش موفق شما: ${fa(5)} دیسک را بی‌جمجمه رو کردید. زیراندازتان برای بار دوم برگشت.</p><table class="gd-score"><thead><tr><th>بازیکن</th><th class="n">چالش موفق</th><th class="n">دیسک مانده</th></tr></thead><tbody><tr class="is-win"><td>شما</td><td class="n">${fa(2)}</td><td class="n">${fa(3)}</td></tr><tr><td>رضا</td><td class="n">${fa(1)}</td><td class="n">${fa(4)}</td></tr><tr><td>نیلوفر</td><td class="n">${fa(0)}</td><td class="n">${fa(2)}</td></tr><tr><td>سارا</td><td class="n">${fa(0)}</td><td class="n">${fa(0)}، بیرون رفت</td></tr></tbody></table><p class="cx-note">کسی که همهٔ دیسک‌هایش را از دست بدهد بیرون می‌رود؛ آخرین نفر باقی‌مانده هم برنده است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Skull', fa: 'جمجمه', latin: 'Skull', meta: ['زنده', '۴ نفر', 'دو چالش موفق برنده است'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: meta(2, 2, 2, 0) },
      { name: 'رضا ★۱', av: 'ر', seat: 6, clock: '0:40', meta: meta(3, 3, 1, 0, '<span class="gc-tag gc-tag--soft">پاس</span>') },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: meta(4, 1, 2, 0, `<span class="gc-tag">شرط ${fa(4)}</span>`) },
    ],
    me: {
      cards: [{ art: 'skull-player-1-rose', alt: 'گل (در دست)', dim: true }, { art: 'skull-player-1-skull', alt: 'جمجمه (در دست)', dim: true }],
      clock: '0:27', turn: true, note: `پشته ${fa(2)}<span class="bgv-sep"></span>دست ${fa(2)}<span class="bgv-sep"></span>امتیاز ${fa(0)}`, above: (ph) => bidRow(ph),
    },
    cardW: 92, phoneCardW: 64, cardRatio: 1,
    table: (ph) => `<div class="sk-table"><div class="sk-mats">${mat(1, 0, 'شما', 2, { me: true, faces: ['rose', 'rose'], note: 'هر دو گل' })}${mat(2, 0, 'نیلوفر', 2)}${mat(3, 1, 'رضا', 3, { pass: true, note: 'پاس' })}${mat(4, 0, 'سارا', 1, { bid: true, note: `<em>شرط ${fa(4)}</em>` })}</div>
<div class="sk-banner"><span class="sk-banner__n">${fa(4)}</span><span><b>شرط فعلی: سارا</b><br><small>${fa(8)} دیسک روی میز است؛ بیشترین شرط ${fa(8)}</small></span></div></div>`,
    status: '<b>نوبت شماست.</b> سارا قول داده ۴ دیسک را بی‌جمجمه رو کند. شرط را بالا ببرید (۵ تا ۸) یا پاس بدهید. اگر بالاترین شرط مال شما بماند، اول دیسک‌های خودتان رو می‌شود.',
    pstatus: '<b>نوبت شما.</b> شرط ۵ تا ۸ یا پاس.',
    railCard: `<section class="cx-card"><h3>دیسک‌های شما</h3><div class="sk-mine"><span>${img('skull-player-1-rose', 'گل')}${img('skull-player-1-rose', 'گل')}<small>پشته</small></span><span>${img('skull-player-1-rose', 'گل')}${img('skull-player-1-skull', 'جمجمه')}<small>دست</small></span></div><div class="ga-rule">${ic('info')}<span>پشتهٔ خودتان فقط گل دارد؛ پس اگر چالش را ببرید، دو دیسک اول امن است و ${fa(3)} دیسک دیگر را از بالای پشتهٔ بقیه انتخاب می‌کنید.</span></div></section>`,
    logNote: 'دور ۳',
    log: [[2, 'نیلوفر یک دیسک گذاشت'], [6, 'رضا یک دیسک گذاشت'], [4, 'سارا یک دیسک گذاشت'], [1, 'شما یک دیسک گذاشتید'], [2, 'نیلوفر شرط را با ۳ باز کرد'], [6, 'رضا پاس داد'], [4, 'سارا شرط را به ۴ رساند'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['check', 'شرط ۵'], ['x', 'پاس'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'گذاشتن دیسک', turnSub: 'گل، جمجمه یا باز کردن شرط', phone: true,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: meta(2, 1, 3, 0) },
          { name: 'رضا ★۱', av: 'ر', seat: 6, clock: '0:40', meta: meta(3, 2, 2, 0) },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: meta(4, 1, 2, 0) },
        ],
        table: (ph) => `<div class="sk-table"><div class="sk-mats">${matF(1, 0, 'شما', 1, [[1, 'rose']], { me: true, note: 'یک گل' })}${matF(2, 0, 'نیلوفر', 1, [])}${matF(3, 1, 'رضا', 2, [])}${matF(4, 0, 'سارا', 1, [])}</div></div>`,
        me: { cards: [{ art: 'skull-player-1-rose', alt: 'گل', ok: true }, { art: 'skull-player-1-rose', alt: 'گل', ok: true }, { art: 'skull-player-1-skull', alt: 'جمجمه', ok: true, sel: true }], above: placeBar, note: `پشته ${fa(1)}<span class="bgv-sep"></span>دست ${fa(3)}` },
        status: '<b>نوبت شماست: گذاشتن.</b> یک دیسک دیگر روی پشته‌تان بگذارید، یا شرط را باز کنید (همه دست‌کم یک دیسک گذاشته‌اند).',
        pstatus: '<b>نوبت شما.</b> دیسک بگذارید یا شرط باز کنید.',
        log: [[2, 'نیلوفر یک دیسک گذاشت'], [6, 'رضا دومین دیسک را گذاشت'], [4, 'سارا یک دیسک گذاشت'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'رو کردن', turnSub: 'پشته‌های قابل انتخاب و شمارش', phone: true,
        table: (ph) => `<div class="sk-table"><div class="sk-mats">${matF(1, 0, 'شما', 2, [[1, 'rose'], [1, 'rose']], { me: true, note: 'هر دو گل' })}${matF(2, 0, 'نیلوفر', 2, [[2, 'rose']], { click: true, note: 'یک گل' })}${matF(3, 1, 'رضا', 3, [[3, 'rose']], { click: true, note: 'یک گل' })}${matF(4, 0, 'سارا', 1, [], { click: true, note: 'بزنید' })}</div>
<div class="sk-banner"><span class="sk-banner__n">${fa(5)}</span><span><b>شرط شما: ${fa(5)}</b><br><small>${fa(4)} گل رو شده؛ یکی دیگر</small></span></div></div>`,
        me: { above: flipBar },
        status: '<b>شرط ۵ مال شما ماند.</b> دو دیسک خودتان و بالایی نیلوفر و رضا گل بود. یکی دیگر مانده: روی پشتهٔ یکی از حریف‌ها بزنید.',
        pstatus: '<b>رو کردن:</b> ۴ از ۵.',
        log: [[1, 'شما با ۵ برنده شدید'], [1, 'دو گل شما رو شد'], [2, 'بالایی نیلوفر: گل'], [6, 'بالایی رضا: گل']],
      },
      {
        shotTitle: 'باخت چالش', turnSub: 'پیام عمومی و نوع دیسک فقط برای خودتان', overlay: lost,
        table: (ph) => `<div class="sk-table"><div class="sk-mats">${matF(1, 0, 'شما', 2, [[1, 'rose'], [1, 'rose']], { me: true, note: 'هر دو گل' })}${matF(2, 0, 'نیلوفر', 2, [[2, 'rose']], { note: 'گل' })}${matF(3, 1, 'رضا', 3, [[3, 'rose']], { note: 'گل' })}${matF(4, 0, 'سارا', 1, [[4, 'skull']], { bad: true, note: 'جمجمه!' })}</div></div>`,
        me: { turn: false, cards: [{ art: 'skull-player-1-rose', alt: 'گل' }, { art: 'skull-player-1-skull', alt: 'جمجمه' }], above: () => '', note: `دیسک ${fa(3)}<span class="bgv-sep"></span>امتیاز ${fa(0)}` },
        status: '<b>جمجمهٔ سارا!</b> چالش شما شکست خورد و یک دیسک تصادفی از دست دادید.',
        log: [[1, 'شما پشتهٔ سارا را زدید'], [4, 'جمجمه بود'], [1, 'شما یک دیسک از دست دادید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'دو چالش موفق', overlay: ending,
        table: (ph) => `<div class="sk-table"><div class="sk-mats">${matF(1, 1, 'شما', 1, [[1, 'rose']], { me: true, note: '★ ۲' })}</div></div>`,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: meta(2, 0, 2, 0) },
          { name: 'رضا ★۱', av: 'ر', seat: 6, meta: meta(3, 0, 4, 0) },
          { name: 'سارا', av: 'س', seat: 4, out: true, meta: '<span class="gc-tag gc-tag--soft">بیرون رفت</span>' },
        ],
        me: { turn: false, clock: '', cards: [], above: () => '', note: `امتیاز ${fa(2)}` }, railCard: '',
        status: '<b>بازی تمام شد.</b> با دومین چالش موفق بردید.',
        log: [[1, 'شما با ۵ برنده شدید'], [1, 'هر ۵ دیسک گل بود'], [1, 'شما بردید']],
      },
    ],    css: `.gc-card{margin-inline-start:12px}.gc-card img{border-radius:50%!important}
.sk-pile{display:inline-grid;grid-template-areas:"a"}.sk-pile img{grid-area:a;inline-size:var(--sw);block-size:var(--sw);border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.5)}
.sk-pile img:nth-child(2){transform:translateY(-3px)}.sk-pile img:nth-child(3){transform:translateY(-6px)}.sk-pile img:nth-child(4){transform:translateY(-9px)}
.gc-seat__meta b{color:var(--felt-ink)}.gc-seat__meta>span{white-space:nowrap}.gc-seat__meta .gc-tag{block-size:20px;padding-inline:7px;font-size:11.5px}
.sk-table{display:grid;gap:22px;justify-items:center}
.sk-mats{display:flex;gap:18px;justify-content:center}
.sk-mat{display:grid;justify-items:center;gap:8px;color:var(--felt-muted);font-size:12.5px}
.sk-mat__bg{position:relative;display:grid;place-items:center;inline-size:148px;block-size:148px}
.sk-mat__bg>img{position:absolute;inset:0;inline-size:100%;block-size:100%;border-radius:8px;box-shadow:0 10px 18px -10px rgba(0,0,0,.7)}
.sk-stack{position:relative;display:grid;grid-template-areas:"a"}.sk-stack img{grid-area:a;inline-size:108px;block-size:108px;border-radius:50%;box-shadow:0 2px 0 rgba(0,0,0,.35),0 4px 8px rgba(0,0,0,.4)}
.sk-stack img:nth-child(2){transform:translateY(-5px)}.sk-stack img:nth-child(3){transform:translateY(-10px)}.sk-stack img:nth-child(4){transform:translateY(-15px)}
.sk-mat__l b{color:var(--felt-ink)}
.sk-mat.is-me .sk-mat__bg{box-shadow:0 0 0 3px var(--felt-gold);border-radius:10px}
.sk-mat__l em{font-style:normal;color:var(--felt-gold);font-weight:700}.sk-mat.is-bid .sk-mat__bg{box-shadow:0 0 0 2px rgba(232,166,66,.55);border-radius:10px}
.sk-mat.is-pass{opacity:.7}
.sk-banner{display:flex;align-items:center;gap:12px;padding:8px 16px 8px 18px;border-radius:999px;background:rgba(232,166,66,.14);box-shadow:inset 0 0 0 1.5px var(--felt-gold);color:var(--felt-ink);font-size:13px;line-height:1.5}.sk-banner small{color:var(--felt-muted)}
.sk-banner__n{display:grid;place-items:center;inline-size:44px;block-size:44px;border-radius:50%;background:var(--felt-gold);color:#142B3B;font-size:24px;font-weight:900}
.sk-bid{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.35);color:var(--felt-ink);font-size:13.5px}
.sk-bid__n{display:flex;gap:6px}
.sk-n{all:unset;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;inline-size:42px;block-size:42px;border-radius:50%;background:var(--felt-control);color:#142B3B;font-size:18px;font-weight:800;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.sk-n.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.sk-bid .bgv-btn{white-space:nowrap}
.sk-mine{display:flex;gap:18px}.sk-mine>span{display:grid;grid-template-columns:auto auto;gap:6px;justify-items:center}.sk-mine img{inline-size:56px;border-radius:50%;box-shadow:var(--shadow-card)}.sk-mine small{grid-column:1/3;font-size:12.5px;color:var(--text-muted)}
.cx-phone .sk-table{gap:12px}.cx-phone .sk-mats{gap:8px}.cx-phone .sk-mat__bg{inline-size:78px;block-size:78px}.cx-phone .sk-stack img{inline-size:56px;block-size:56px}.cx-phone .sk-mat{font-size:11px;text-align:center}.cx-phone .sk-mat__l b{display:block}
.cx-phone .sk-banner{padding:6px 12px}.cx-phone .sk-banner__n{inline-size:34px;block-size:34px;font-size:19px}
.sk-bid--ph{margin-inline:10px;justify-content:center}.sk-bid--ph .sk-n{inline-size:38px;block-size:38px}
.sk-stack--f img.is-up{box-shadow:0 0 0 3px #FAF5EC,0 4px 8px rgba(0,0,0,.4)}
.sk-mat.is-click .sk-mat__bg{box-shadow:0 0 0 2px var(--felt-gold),0 0 12px 2px rgba(232,166,66,.45);border-radius:10px}
.sk-mat.is-bad .sk-mat__bg{box-shadow:0 0 0 3px #F0AAA3;border-radius:10px}
.sk-or{font-size:12px;color:var(--felt-muted)}.sk-left{font-size:14px;color:var(--felt-ink)}.sk-left b{color:var(--felt-gold);font-size:18px}
.sk-lost{display:flex;gap:14px;align-items:flex-start}.sk-lost>img{inline-size:88px;border-radius:50%}.sk-lost>div{display:grid;gap:8px}
.sk-priv{display:flex;gap:8px;align-items:center;padding:8px;border-radius:var(--radius-sm);background:var(--surface-sunken)}.sk-priv img{inline-size:36px;border-radius:50%}
.cx-phone .sk-lost>img{inline-size:56px}.cx-phone .sk-bid--ph{flex-wrap:wrap;gap:6px}.cx-phone .sk-bid--ph .bgv-btn{padding-inline:10px}`,
    shotTitle: 'نوبت شما', turnSub: 'شرط بستن',
    diffs: [
      ['چیدمان', 'به جای کارت‌های بادبزنی: وسط میز زیرانداز هر نفر با پشتهٔ دیسک‌هایش؛ پشتهٔ شما برای خودتان رو دیده می‌شود و برای بقیه پشت'],
      ['حریف‌ها', 'روی چیپ هر نفر تعداد دیسک روی میز و در دست، ستاره کنار اسم برای هر چالش موفق (زیرانداز هم برمی‌گردد) و برچسب «پاس» یا «شرط»'],
      ['شرط', 'شرط فعلی وسط میز بزرگ نوشته می‌شود؛ ردیف شرط بالای دست فقط عددهای مجاز را دارد (یکی بیشتر از شرط فعلی تا همهٔ دیسک‌های روی میز)'],
      ['دست شما', 'دیسک‌های دست مثل کارت پایین‌اند؛ در مرحلهٔ گذاشتن قابل انتخاب‌اند و وقتی شرط شروع شد کم‌رنگ می‌شوند'],
      ['رو کردن', 'برندهٔ شرط اول پشتهٔ خودش رو می‌شود، بعد روی زیرانداز بقیه کلیک می‌کند تا دیسک بالایی رو شود'],
      ['قوانین', '۳ تا ۶ نفر؛ دونفره ندارد (تصمیم مالک). دو چالش موفق یا آخرین نفر باقی‌مانده برنده است'],
    ],
  };
}
