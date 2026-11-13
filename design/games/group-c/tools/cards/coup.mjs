// Coup on the card-table frame (base game, as the repo engine).
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const coins = (n) => `<span class="cp-coins" aria-label="${fa(n)} سکه"><b>${fa(n)}</b> سکه</span>`;
  const infl = (n, lost) => `<span class="gc-backs">${Array.from({ length: n }, () => img('coup-back')).join('')}${lost ? img(`coup-${lost}`, 'کارت ازدست‌رفته', 'cp-lost') : ''}</span>`;
  const act = (label, sub, o = {}) => `<button class="cp-act${o.sel ? ' is-sel' : ''}${o.claim ? ' is-claim' : ''}" type="button"${o.off ? ' disabled' : ''}><b>${label}</b><small>${sub}</small></button>`;
  const actions = (ph) => `<div class="cp-acts${ph ? ' cp-acts--ph' : ''}" role="group" aria-label="کار این نوبت">
${act('درآمد', '+۱ سکه')}${act('کمک خارجی', '+۲، دوک جلوگیری می‌کند')}${act('کودتا', '۷ سکه', { off: true })}
${act('مالیات', 'دوک، +۳', { claim: true })}${act('دزدی', 'کاپیتان، ۲ سکه', { claim: true, sel: true })}${act('ترور', 'آدم‌کش، ۳ سکه', { claim: true })}${act('مبادله', 'سفیر', { claim: true })}</div>`;
  const { modal } = H;
  const NM = { duke: 'دوک', captain: 'کاپیتان', ambassador: 'سفیر', assassin: 'آدم‌کش', contessa: 'کنتس' };
  const timer = (s) => `<span class="cp-timer">${ic('stopwatch')}<b>${fa(s)}</b> ثانیه</span>`;
  const claimT = (seatN, av, title, sub) => (ph) => `<div class="gc-pile" style="--pw:96px;--ppw:66px">${img('coup-back', 'دستهٔ دربار')}<span>دربار: <b>${fa(9)}</b> کارت</span></div><div class="cp-bank" aria-label="خزانه"><b>${fa(30)}</b><span>سکهٔ خزانه</span></div><div class="cp-claim"><span class="bgv-avatar bgv-avatar--sm seat-${seatN}">${av}</span><span><b>${title}</b><br><small>${sub}</small></span></div>`;
  const respond = (ph) => modal('نیلوفر می‌خواهد از شما دزدی کند', `<div class="cp-resp"><div class="cp-who">${img('coup-captain', 'کاپیتان')}<p>نیلوفر ادعا می‌کند <b>کاپیتان</b> دارد و ${fa(2)} سکه از شما برمی‌دارد. چون هدف شمایید، فقط شما می‌توانید جلوگیری کنید؛ همه می‌توانند چالش کنند.</p></div>${timer(12)}</div>
<div class="cp-opts">${btn('قبول', 'secondary', 'check')}${btn('چالش', 'secondary', 'flag')}${btn('جلوگیری با کاپیتان', 'primary', 'hand')}${btn('جلوگیری با سفیر', 'secondary', 'hand')}</div><p class="cx-note">اگر کسی پیش از شما چالش کند همان بررسی می‌شود. اگر وقت تمام شود یعنی قبول.</p>`);
  const blockCh = (ph) => modal('سارا با دوک جلوگیری کرد', `<div class="cp-resp"><div class="cp-who">${img('coup-duke', 'دوک')}<p>رضا کمک خارجی خواست و سارا ادعا کرد <b>دوک</b> دارد و جلوی آن را گرفت. می‌توانید این جلوگیری را چالش کنید.</p></div>${timer(9)}</div><div class="cp-opts">${btn('قبول', 'secondary', 'check')}${btn('چالش جلوگیری', 'primary', 'flag')}</div>`);
  const loseOne = (ph) => modal('یک نفوذ از دست می‌دهید', `<p>چالشِ رضا درست بود: کاپیتان نداشتید. کدام کارتتان رو شود و کنار برود؟ کار شما (دزدی) باطل شد.</p><div class="cp-pick">${[['duke', false], ['ambassador', true]].map(([k, s]) => `<button type="button" class="cp-pc${s ? ' is-sel' : ''}">${img(`coup-${k}`, NM[k])}<b>${NM[k]}</b></button>`).join('')}</div>`, `${btn('رو کردن سفیر', 'primary', 'check')}`);
  const exchange = (ph) => modal('مبادله با سفیر: ۲ کارت نگه دارید', `<p>دو کارت از دربار کشیدید. از این چهار کارت دو تا را نگه دارید؛ بقیه بُر خورده به دسته برمی‌گردند. کسی نمی‌بیند کدام‌ها را نگه داشتید.</p><div class="cp-pick">${[['duke', 'کارت شما', true], ['ambassador', 'کارت شما', false], ['assassin', 'تازه', true], ['contessa', 'تازه', false]].map(([k, t, s]) => `<button type="button" class="cp-pc${s ? ' is-sel' : ''}">${img(`coup-${k}`, NM[k])}<b>${NM[k]}</b><small>${t}</small></button>`).join('')}</div>`, `${btn('نگه داشتن دوک و آدم‌کش', 'primary', 'check')}`);
  const truth = (ph) => modal('ادعای شما راست بود', `<div class="cp-tr">${img('coup-duke', 'دوک')}${ic('repeat')}${img('coup-contessa', 'کنتس')}</div><p>رضا مالیات شما را چالش کرد. دوکتان رو شد، پس سه سکه را گرفتید و رضا یک نفوذ از دست داد. دوک به دسته برگشت و بُر خورد و کارت تازهٔ شما <b>کنتس</b> است؛ <b>فقط شما</b> این کارت تازه را می‌بینید.</p>`, `${btn('باشه', 'primary', 'check')}`);
  const ending = (ph) => modal('شما بردید', `<p>آخرین نفوذ سارا با کودتای شما از دست رفت و فقط شما مانده‌اید. کودتا نفر دوم ندارد.</p><table class="gd-score"><thead><tr><th>بازیکن</th><th class="n">کارت‌های رو شده</th><th class="n">بیرون رفت</th></tr></thead><tbody><tr class="is-win"><td>شما</td><td class="n">سفیر</td><td class="n">برنده</td></tr><tr><td>سارا</td><td class="n">کنتس، دوک</td><td class="n">نوبت ${fa(31)}</td></tr><tr><td>نیلوفر</td><td class="n">کاپیتان، آدم‌کش</td><td class="n">نوبت ${fa(26)}</td></tr><tr><td>رضا</td><td class="n">کنتس، دوک</td><td class="n">نوبت ${fa(17)}</td></tr></tbody></table>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const OPPS = [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${infl(2)}${coins(5)}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${infl(1, 'contessa')}${coins(2)}` },
    { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `${infl(2)}${coins(7)}` },
  ];  return {
    slug: 'Coup', fa: 'کودتا', latin: 'Coup', meta: ['زنده', '۴ نفر', '۶۰ ثانیه هر نوبت'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${infl(2)}${coins(5)}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `${infl(1, 'contessa')}${coins(2)}<span class="gc-tag gc-tag--soft">هدف</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `${infl(2)}${coins(7)}` },
    ],
    me: { cards: [{ art: 'coup-duke', alt: 'دوک' }, { art: 'coup-captain', alt: 'کاپیتان' }], clock: '0:42', turn: true, note: coins(4), above: (ph) => actions(ph) },
    cardW: 92, phoneCardW: 70, cardRatio: 1.37,
    table: (ph) => `<div class="gc-pile" style="--pw:96px;--ppw:66px">${img('coup-back', 'دستهٔ دربار')}<span>دربار: <b>${fa(9)}</b> کارت</span></div><div class="cp-bank" aria-label="خزانه"><b>${fa(32)}</b><span>سکهٔ خزانه</span></div><div class="cp-claim"><span class="bgv-avatar bgv-avatar--sm seat-1 is-you">م</span><span><b>دزدی از رضا</b><br><small>ادعا: کاپیتان؛ دیگران می‌توانند چالش کنند یا با کاپیتان یا سفیر جلوگیری کنند</small></span></div>`,
    status: '<b>نوبت شماست.</b> «دزدی» را انتخاب کردید؛ هدف را از بالا انتخاب کنید (رضا).',
    pstatus: '<b>نوبت شما.</b> هدف دزدی را انتخاب کنید.',
    railCard: `<section class="cx-card"><h3>کارت‌های شما</h3><div class="cp-mine">${img('coup-duke', 'دوک')}${img('coup-captain', 'کاپیتان')}</div><div class="ga-rule">${ic('info')}<span>هر ادعایی را می‌شود چالش کرد. لازم نیست کارت را داشته باشید؛ ولی اگر چالش شوید و نداشته باشید، یک نفوذ از دست می‌دهید. با ۱۰ سکه کودتا اجباری است.</span></div></section>`,
    logNote: 'نوبت ۱۲',
    log: [[2, 'نیلوفر مالیات گرفت (دوک) +۳'], [6, 'رضا با ترور سارا را نشانه گرفت؛ سارا با کنتس جلوگیری کرد'], [6, 'رضا چالش کرد و باخت؛ کنتس رو شد'], [4, 'سارا کمک خارجی گرفت +۲'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین و کارت‌ها', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['list', 'کارت‌ها'], ['chat', 'گفت‌وگو'], ['flag', 'ترک میز']],
    phases: [
      {
        shotTitle: 'پنجرهٔ پاسخ', turnSub: 'قبول، چالش یا جلوگیری با شمارنده', phone: true,
        opps: [{ ...OPPS[0], turn: true, meta: `${infl(2)}${coins(5)}<span class="gc-tag">کاپیتان؟</span>` }, OPPS[1], OPPS[2]],
        table: claimT(2, 'ن', 'دزدی از شما', 'ادعا: کاپیتان'), overlay: respond,
        me: { turn: false, above: () => '' },
        status: '<b>نوبت نیلوفر است و شما را هدف گرفته.</b> ادعای کاپیتان کرده؛ ۱۲ ثانیه برای جواب دارید.',
        pstatus: '<b>نیلوفر از شما دزدی می‌کند.</b> جواب بدهید.',
        log: [[4, 'سارا کمک خارجی گرفت +۲'], [1, 'شما درآمد گرفتید +۱'], [2, 'نیلوفر: دزدی از شما (کاپیتان)']],
      },
      {
        shotTitle: 'چالش جلوگیری', turnSub: 'همان پنجره برای جلوگیریِ دیگران', phone: true, phoneOnly: true,
        opps: [OPPS[0], { ...OPPS[1], turn: true }, { ...OPPS[2], meta: `${infl(2)}${coins(7)}<span class="gc-tag">دوک؟</span>` }],
        table: claimT(4, 'س', 'جلوگیری از کمک خارجی', 'ادعا: دوک'), overlay: blockCh,
        me: { turn: false, above: () => '' },
        pstatus: '<b>سارا جلوگیری کرد.</b> چالش می‌کنید؟', status: '<b>سارا با دوک جلوگیری کرد.</b>',
      },
      {
        shotTitle: 'از دست دادن نفوذ', turnSub: 'خودتان انتخاب می‌کنید کدام کارت رو شود',
        opps: [OPPS[0], { ...OPPS[1], meta: `${infl(1, 'contessa')}${coins(2)}<span class="gc-tag">چالش کرد</span>` }, OPPS[2]],
        table: claimT(1, 'م', 'دزدی از رضا', 'ادعا: کاپیتان؛ رضا چالش کرد'), overlay: loseOne,
        me: { cards: [{ art: 'coup-duke', alt: 'دوک' }, { art: 'coup-ambassador', alt: 'سفیر', sel: true }], above: () => '' },
        railCard: '',
        status: '<b>بلوف شما لو رفت.</b> کاپیتان نداشتید؛ یکی از دو کارتتان را رو کنید.',
        log: [[1, 'شما: دزدی از رضا (کاپیتان)'], [6, 'رضا چالش کرد'], [1, 'کاپیتان نداشتید؛ دزدی باطل شد']],
      },
      {
        shotTitle: 'مبادلهٔ سفیر', turnSub: 'از ۴ کارت، ۲ تا را نگه دارید',
        table: claimT(1, 'م', 'مبادله', 'ادعا: سفیر؛ کسی چالش نکرد'), overlay: exchange,
        me: { cards: [{ art: 'coup-duke', alt: 'دوک' }, { art: 'coup-ambassador', alt: 'سفیر' }], above: () => '' },
        railCard: '',
        status: '<b>مبادله با سفیر.</b> دو کارت کشیدید؛ دو تا از چهار کارت را نگه دارید.',
        log: [[2, 'نیلوفر مالیات گرفت +۳'], [1, 'شما: مبادله (سفیر)'], [1, 'کسی چالش نکرد']],
      },
      {
        shotTitle: 'ادعای راست', turnSub: 'کارت رو شده و کارت تازه، فقط برای خودتان',
        opps: [OPPS[0], { ...OPPS[1], meta: `${infl(0, 'contessa')}${img('coup-duke', 'دوک ازدست‌رفته', 'cp-lost')}${coins(2)}`, out: true }, OPPS[2]],
        table: claimT(1, 'م', 'مالیات', 'ادعا: دوک؛ رضا چالش کرد و باخت'), overlay: truth,
        me: { cards: [{ art: 'coup-contessa', alt: 'کنتس، کارت تازه', sel: true }, { art: 'coup-assassin', alt: 'آدم‌کش' }], note: coins(7), above: () => '' },
        railCard: '',
        status: '<b>رضا چالش کرد و باخت.</b> دوک داشتید؛ کارتتان عوض شد و رضا آخرین نفوذش را از دست داد.',
        log: [[1, 'شما: مالیات (دوک)'], [6, 'رضا چالش کرد'], [1, 'دوک رو شد؛ رضا بیرون رفت']],
      },
      {
        shotTitle: 'شروع دونفره', turnSub: 'نفر اول ۱ سکه، دیگری ۲ سکه', phone: true, phoneOnly: true, meta: ['زنده', '۲ نفر', 'نوبت ۱'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${infl(2)}${coins(2)}` }],
        table: (ph) => `<div class="gc-pile" style="--pw:96px;--ppw:66px">${img('coup-back', 'دستهٔ دربار')}<span>دربار: <b>${fa(11)}</b> کارت</span></div><div class="cp-bank"><b>${fa(47)}</b><span>سکهٔ خزانه</span></div>`,
        me: { note: coins(1) },
        pstatus: '<b>بازی دونفره.</b> شما شروع می‌کنید و ۱ سکه دارید؛ نیلوفر ۲ سکه.',
        status: '<b>بازی دونفره.</b> نفر اول ۱ سکه دارد.',
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'آخرین نفر باقی‌مانده',
        opps: [{ ...OPPS[0], out: true, meta: `${img('coup-captain', '', 'cp-lost')}${img('coup-assassin', '', 'cp-lost')}` }, { ...OPPS[1], out: true, meta: `${img('coup-contessa', '', 'cp-lost')}${img('coup-duke', '', 'cp-lost')}` }, { ...OPPS[2], out: true, meta: `${img('coup-contessa', '', 'cp-lost')}${img('coup-duke', '', 'cp-lost')}` }],
        table: (ph) => `<div class="gc-pile" style="--pw:96px;--ppw:66px">${img('coup-back', 'دستهٔ دربار')}<span>دربار: <b>${fa(9)}</b> کارت</span></div>`, overlay: ending,
        me: { turn: false, clock: '', cards: [{ art: 'coup-assassin', alt: 'آدم‌کش' }], note: coins(1), above: () => '' },
        railCard: '',
        status: '<b>بازی تمام شد.</b> شما بردید.',
        log: [[1, 'شما با ۷ سکه روی سارا کودتا کردید'], [4, 'سارا بیرون رفت'], [1, 'شما بردید']],
      },
    ],    css: `.cp-coins{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:var(--felt-ink)}
.cx-pbar .cp-coins{color:var(--text)}
.cp-lost{filter:grayscale(.2);inline-size:18px!important;outline:2px solid #F0AAA3;border-radius:2px}
.cp-bank{display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:13px}.cp-bank b{font-size:22px;color:var(--felt-ink)}
.cp-claim{display:flex;gap:10px;align-items:center;max-inline-size:240px;padding:10px 12px;border-radius:var(--radius-md);background:rgba(232,166,66,.14);box-shadow:inset 0 0 0 1.5px var(--felt-gold);color:var(--felt-ink);font-size:13px;line-height:1.6}.cp-claim small{color:var(--felt-muted)}
.cp-acts{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;inline-size:100%}
.cp-act{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:2px;justify-items:center;text-align:center;padding:7px 4px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.cp-act b{font-size:13.5px}.cp-act small{font-size:10.5px;color:#3A4F5E;line-height:1.35}
.cp-act.is-claim{box-shadow:inset 0 0 0 1.5px #B57A25,0 3px 0 #0D1A23}
.cp-act.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.cp-act:disabled{opacity:.45;cursor:default}
.cp-acts--ph{grid-template-columns:repeat(4,minmax(0,1fr))}
.cp-mine{display:flex;gap:10px}.cp-mine img{inline-size:84px;border-radius:6px;box-shadow:var(--shadow-card)}
.cx-phone .cp-claim{display:none}
.cp-timer{display:inline-flex;align-items:center;gap:4px;align-self:start;padding:4px 10px;border-radius:999px;background:var(--surface-sunken);font-size:13px;white-space:nowrap}.cp-timer b{font-size:16px;color:var(--heading)}
.cp-resp{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
.cp-who{display:flex;gap:12px;align-items:flex-start}.cp-who img{inline-size:72px;border-radius:6px;flex:none}
.cp-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cp-pick{display:flex;gap:10px;justify-content:center}
.cp-pc{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:4px;padding:6px;border-radius:var(--radius-md);background:var(--surface-sunken);font-size:13px}
.cp-pc img{inline-size:92px;border-radius:6px}.cp-pc small{font-size:11.5px;color:var(--text-muted)}
.cp-pc.is-sel{box-shadow:inset 0 0 0 3px var(--felt-gold)}
.cx-phone .cp-pc img{inline-size:62px}.cx-phone .cp-who img{inline-size:52px}.cx-phone .cp-resp{flex-direction:column}
.cp-tr{display:flex;align-items:center;justify-content:center;gap:12px}.cp-tr img{inline-size:84px;border-radius:6px}.cp-tr .bgv-icon{color:var(--link)}
.gc-seat .cp-lost{inline-size:18px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب کار و هدف',
    diffs: [
      ['چیدمان', 'حریف‌ها بالا با دو کارت پشت‌ورو و سکه‌ها؛ کارتی که از دست رفته رو و با حاشیهٔ قرمز کنار پشت‌ها می‌ماند'],
      ['کارهای نوبت', 'هفت دکمه بالای دست شما: کارهای عمومی ساده، کارهای ادعایی (دوک، آدم‌کش، کاپیتان، سفیر) با حاشیهٔ طلایی؛ کودتا بی ۷ سکه غیرفعال'],
      ['ادعا و چالش', 'ادعای در جریان وسط میز می‌آید تا دیگران چالش یا جلوگیری کنند؛ این مرحله برای بقیه پنجرهٔ پاسخ با شمارنده دارد'],
      ['سکه', 'مثل BGA پول فقط عدد است (بی تصویر سکه)؛ تصمیم مالک ۱۹ آبان'],
      ['ستون کنار', 'رویدادها با جزئیات ادعا، جلوگیری و چالش؛ «مساوی» ندارد'],
      ['قوانین', 'نسخهٔ پایه ۲ تا ۶ نفر مثل موتور؛ ۱۰ سکه یعنی کودتای اجباری'],
    ],
  };
}
