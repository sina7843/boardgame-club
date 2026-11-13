// Dice Throne on the group D frame. No BGA version and no publisher art in the pack: hero boards (1012×310, cropped to 874×310 without the
// baked HP/CP dials), die faces 60×60 and status tokens 28–32×41 are the site's own renders of the engine's four heroes.
// Mock: duel, turn 7. You (Mina) play «جنگجوی کوه» (die 1–3 sword, 4–5 heart, 6 fist); Niloufar plays «سایه‌رو» (1–2 dagger, 3–4 bag, 5–6 shade).
// Matched abilities below are computed from the dice with the board data (counts, combo, straight).
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const HERO = {
    warrior: { name: 'جنگجوی کوه', face: (v) => (v <= 3 ? 'sword' : v <= 5 ? 'heart' : 'fist'), ab: [{ n: 'ضربهٔ شمشیر', sym: 'sword', counts: [3, 4, 5], t: ['۴ آسیب', '۶ آسیب', '۸ آسیب'] }, { n: 'التیام خشم', sym: 'heart', counts: [3], t: ['۴ جان'] }, { n: 'ضربهٔ گیج‌کننده', sym: 'fist', counts: [3], t: ['۵ آسیب و گیجی'] }, { n: 'یورش', straight: 4, t: ['۶ آسیب'] }, { n: 'خشم کوهستان', sym: 'fist', counts: [5], t: ['۱۴ آسیب، دفاع‌ناپذیر'] }] },
    shadow: { name: 'سایه‌رو', face: (v) => (v <= 2 ? 'dagger' : v <= 4 ? 'bag' : 'shade'), ab: [{ n: 'خنجر', sym: 'dagger', counts: [3, 4, 5], t: ['۴ آسیب', '۵ آسیب و ۱ زخم', '۶ آسیب و ۲ زخم'] }, { n: 'دست‌برد', sym: 'bag', counts: [3], t: ['۲ آسیب، دزدی ۲ CP'] }, { n: 'نیش سایه', combo: { dagger: 2, shade: 2 }, t: ['۵ آسیب و ۱ زخم'] }, { n: 'شبیخون', straight: 5, t: ['۸ آسیب، دفاع‌ناپذیر'] }, { n: 'تاریکی مطلق', sym: 'shade', counts: [5], t: ['۱۲ آسیب، دفاع‌ناپذیر'] }] },
  };
  const match = (hero, dice) => {
    const h = HERO[hero], syms = dice.map(h.face), cnt = (s) => syms.filter((x) => x === s).length, vals = new Set(dice);
    const run = (n) => [1, 2, 3].some((a) => Array.from({ length: n }, (_, k) => a + k).every((v) => vals.has(v)));
    return h.ab.map((a, i) => { if (a.sym) { const tier = a.counts.filter((c) => cnt(a.sym) >= c).length - 1; return tier >= 0 ? [i, tier] : null; } if (a.combo) return Object.entries(a.combo).every(([s, n]) => cnt(s) >= n) ? [i, 0] : null; return run(a.straight) ? [i, 0] : null; }).filter(Boolean);
  };
  // ability boxes on the cropped 874×310 board
  const BOX = [[357, 18, 335, 85], [10, 18, 339, 85], [357, 110, 335, 85], [10, 110, 339, 85], [10, 203, 682, 89]];
  const pct = ([x, y, w, h]) => `left:${(x / 874 * 100).toFixed(2)}%;top:${(y / 310 * 100).toFixed(2)}%;width:${(w / 874 * 100).toFixed(2)}%;height:${(h / 310 * 100).toFixed(2)}%`;
  const ST = { wound: 'زخم', stun: 'گیجی', shield: 'سپر' };
  const stats = (s, ph) => `<div class="dt-stats${ph ? ' dt-stats--ph' : ''}"><span class="dt-hp${s.hit ? ' is-hit' : ''}"><b>${fa(s.hp)}</b><small>جان</small></span><span class="dt-cp"><b>${fa(s.cp)}</b><small>CP از ${fa(15)}</small></span><span class="dt-st">${Object.keys(ST).map((k) => `<span class="${s[k] ? '' : 'is-zero'}">${img('dice-throne-st-' + k, ST[k])}${s[k] ? fa(s[k]) : ''}</span>`).join('')}</span></div>`;
  const brd = (hero, W, s, o = {}, ph) => {
    const lit = o.dice ? match(hero, o.dice) : [];
    let h = `<div class="dt-side${ph ? ' dt-side--ph' : ''}">${stats(s, ph)}<div class="dt-b${o.dim ? ' is-dim' : ''}" style="--bw:${W}px" role="img" aria-label="صفحهٔ ${HERO[hero].name}">${img('dice-throne-board-' + hero, '')}`;
    for (const [i, t] of lit) h += `<i class="dt-box${o.pick === i ? ' is-pick' : ''}" style="${pct(BOX[i])}"><b>${HERO[hero].ab[i].t[t]}</b></i>`;
    if (s.pop) h += `<b class="dt-pop">${s.pop}</b>`;
    return h + '</div></div>';
  };
  const die = (hero, v, o = {}) => `<button type="button" class="dt-die${o.lock ? ' is-lock' : ''}${o.new ? ' is-new' : ''}" aria-pressed="${!!o.lock}">${img(`dice-throne-${hero}-${v}`, `تاس ${fa(v)}`)}${o.lock ? '<small>قفل</small>' : ''}</button>`;
  const tray = (hero, dice, locks = [], extra = '') => `<div class="dt-tray">${dice.map((v, i) => die(hero, v, { lock: locks.includes(i) })).join('')}${extra}</div>`;
  const ME0 = { hp: 21, cp: 4, wound: 1 }, NIL0 = { hp: 17, cp: 3 };
  const table = (o = {}) => (ph) => `${brd('shadow', ph ? 340 : 570, o.nil ?? NIL0, o.nilB ?? {}, ph)}${o.tray ? o.tray(ph) : ''}`;
  const above = (o = {}) => (ph) => `<div class="dt-me">${o.acts ? `<div class="dt-acts">${o.acts(ph)}</div>` : ''}${brd('warrior', ph ? 340 : 600, o.me ?? ME0, o.meB ?? {}, ph)}</div>`;
  const opps = (turn, s = NIL0, tag = '') => [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:30', turn: !!turn, meta: `<span class="gc-tag gc-tag--soft">${fa(s.hp)} جان</span><span>CP ${fa(s.cp)}</span><span>دست ${fa(s.hand ?? 4)} کارت</span>${tag}` }];
  const note = (s = ME0, x = '') => `<span class="cx-note">${fa(s.hp)} جان<span class="bgv-sep"></span>CP ${fa(s.cp)}<span class="bgv-sep"></span>دست ${fa(s.hand ?? 4)} کارت${x}</span>`;
  const rail = `<section class="cx-card"><h3>نوبت ${fa(7)}</h3><div class="gc-pills"><span class="bgv-chip">دوئل یک‌به‌یک</span><span class="bgv-chip">نفر اول: نیلوفر</span></div><div class="ga-rule">${ic('info')}<span>هر نوبت: نگهداری (اثر زخم و گیجی)، درآمد (${fa(1)} CP و ${fa(1)} کارت)، مرحلهٔ اصلی، تا ${fa(3)} بار ریختن ۵ تاس با نگه داشتن هر تعداد، حمله با یکی از توانایی‌های جورشده، دفاع حریف، مرحلهٔ اصلی دوم. حملهٔ نهایی دفاع‌ناپذیر است. جان هر کس به صفر برسد می‌بازد.</span></div></section>`;

  const pickModal = (ph) => modal('قهرمانتان را انتخاب کنید', `<p>نیلوفر سایه‌رو را برداشت.</p><div class="dt-pick">${[['warrior', true], ['shadow', false, 'نیلوفر'], ['pyro'], ['paladin']].map(([k, sel, who]) => `<button type="button" class="dt-pk${sel ? ' is-sel' : ''}${who ? ' is-taken' : ''}"${who ? ' disabled' : ''}>${img('dice-throne-board-' + k, k)}${who ? `<b>${who}</b>` : ''}</button>`).join('')}</div>`, btn('انتخاب جنگجوی کوه', 'primary', 'check'));
  const defModal = (ph) => modal('سایه‌رو با خنجر حمله کرد', `<p>۴ خنجر: ${fa(5)} آسیب و ${fa(1)} زخم. تاس دفاع شما ${fa(3)} تاس است: هر قلب ${fa(1)} جان، هر مشت ${fa(1)} آسیب برگشتی.</p>${tray('warrior', [4, 6, 1])}<p class="dt-res"><span class="is-g">${fa(1)} درمان</span><span class="is-r">${fa(1)} ضربهٔ برگشتی</span><span>شمشیر: اثری ندارد</span></p><p class="cx-note">نتیجه: ${fa(5)} آسیب منهای ${fa(1)} درمان؛ جان شما ${fa(20)} ← ${fa(16)} و زخم ${fa(2)}. نیلوفر ${fa(1)} آسیب می‌خورد.</p>`, btn('ادامه', 'primary', 'check'));
  const endModal = () => modal('جان نیلوفر به صفر رسید؛ شما بردید', `<table class="gd-score"><thead><tr><th>بازیکن</th><th class="n">قهرمان</th><th class="n">جان پایانی</th></tr></thead><tbody><tr class="is-win"><td>${ic('trophy')} شما</td><td class="n">جنگجوی کوه</td><td class="n">${fa(9)}</td></tr><tr><td>نیلوفر</td><td class="n">سایه‌رو</td><td class="n">${fa(0)}</td></tr></tbody></table><p class="cx-note">${fa(14)} نوبت. آخرین ضربه: خشم کوهستان (${fa(14)} آسیب، دفاع‌ناپذیر). اگر هر دو هم‌زمان به صفر برسند، بازی مساوی است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  const D1 = [1, 3, 3, 5, 2];
  return {
    slug: 'DiceThrone', fa: 'دایس ترون', latin: 'Dice Throne', meta: ['زنده', '۲ نفر', 'نوبت ۷'],
    opps: opps(false),
    me: { cards: [], clock: '1:45', turn: true, note: note(), above: above({ meB: { dice: D1, pick: 0 }, acts: (ph) => `${btn(ph ? 'ریختن (۱)' : 'ریختن (۱ مانده)', 'secondary', 'repeat')}${btn(ph ? 'حمله: ۶' : 'حمله: ضربهٔ شمشیر (۶)', 'primary', 'swords')}${ph ? '' : btn('بی‌حمله', 'secondary', 'x')}` }) },
    table: table({ tray: () => tray('warrior', D1, [0, 2, 4]) }),
    status: '<b>تاس حمله: ریختن دوم.</b> سه شمشیر قفل بود و دو تاس دیگر یک شمشیر و یک قلب آمد. ۴ شمشیر یعنی سطح دوم «ضربهٔ شمشیر»: ۶ آسیب. یک ریختن دیگر مانده؛ با ۵ شمشیر می‌شود ۸ آسیب.',
    pstatus: '<b>ریختن دوم.</b> ۴ شمشیر: ۶ آسیب.',
    railCard: rail,
    logNote: `نوبت ${fa(7)}`,
    log: [[2, 'نیلوفر با دست‌برد ۲ CP دزدید'], [1, 'زخم: ۱ آسیب به شما'], [1, '+۱ CP و ۱ کارت'], [1, 'ریختن اول: ۳ شمشیر'], [1, 'ریختن دوم: ۴ شمشیر']],
    dockItems: [['list', 'رویدادها'], ['users', 'صفحهٔ حریف'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'انتخاب قهرمان', turnSub: 'به نوبت، قهرمان گرفته‌شده خاکستری', meta: ['زنده', '۲ نفر', 'شروع بازی'], phone: true,
        opps: opps(false, { hp: 30, cp: 2 }, '<span class="gc-tag">سایه‌رو</span>'),
        table: table({ nil: { hp: 30, cp: 2 } }), overlay: pickModal,
        me: { note: note({ hp: 30, cp: 2 }), above: above({ me: { hp: 30, cp: 2 } }) },
        status: '<b>انتخاب قهرمان.</b> هر قهرمان ۵ تاس و صفحهٔ توانایی خودش را دارد. نیلوفر اول انتخاب کرد.',
        pstatus: '<b>انتخاب قهرمان.</b>',
        log: [[2, 'نیلوفر نفر اول شد'], [2, 'نیلوفر سایه‌رو را انتخاب کرد'], [1, 'نوبت انتخاب شما']],
      },
      {
        shotTitle: 'شروع نوبت', turnSub: 'نگهداری و درآمد',
        table: table({ tray: () => `<div class="dt-up"><span class="is-r">${img('dice-throne-st-wound', 'زخم')}زخم: ${fa(1)} آسیب</span><span class="is-g">+${fa(1)} CP</span><span class="is-g">+${fa(1)} کارت</span></div>` }),
        me: { note: note(), above: above({ me: { ...ME0, pop: `${fa(1)} آسیب` }, acts: (ph) => btn(ph ? 'ریختن تاس' : 'ریختن تاس حمله (۳ بار)', 'primary', 'repeat') }) },
        status: '<b>شروع نوبت شما.</b> زخم ۱ جان کم کرد (۲۲ ← ۲۱)، ۱ CP و ۱ کارت گرفتید. اگر گیج بودید، این نوبت می‌سوخت و نوبت به نیلوفر می‌رسید.',
        pstatus: '<b>شروع نوبت.</b> زخم −۱، +۱ CP.',
        log: [[2, 'نیلوفر نوبتش را تمام کرد'], [1, 'زخم: ۱ آسیب'], [1, '+۱ CP و ۱ کارت']],
      },
      {
        shotTitle: 'ریختن اول', turnSub: 'قفل کردن تاس‌ها', phone: true,
        table: table({ tray: () => tray('warrior', [1, 4, 3, 6, 2], [0, 2, 4]) }),
        me: { above: above({ meB: { dice: [1, 4, 3, 6, 2] }, acts: (ph) => `${btn(ph ? 'ریختن (۲)' : 'ریختن ۲ تاس (۲ مانده)', 'primary', 'repeat')}${btn(ph ? 'حمله' : 'حمله با همین', 'secondary', 'swords')}` }) },
        status: '<b>ریختن اول.</b> دو توانایی جور است: «ضربهٔ شمشیر» با ۳ شمشیر (۴ آسیب) و «یورش» با ردیف ۱ تا ۴ (۶ آسیب). سه شمشیر را قفل کردید تا شمشیر چهارم و پنجم را بگیرید.',
        pstatus: '<b>ریختن اول.</b> تاس‌ها را بزنید تا قفل شوند.',
        log: [[1, 'ریختن اول: ۳ شمشیر، قلب، مشت'], [1, 'سه شمشیر قفل شد']],
      },
      {
        shotTitle: 'ریختن اضافه', turnSub: 'سه ریختن تمام شد؛ ۲ CP برای یک بار دیگر', phone: true,
        table: table({ tray: () => tray('warrior', D1, [0, 1, 2, 4], `<span class="dt-left">ریختن ${fa(3)} از ${fa(3)}</span>`) }),
        me: { above: above({ meB: { dice: D1, pick: 0 }, acts: (ph) => `${btn(ph ? 'اضافه (۲ CP)' : 'ریختن اضافه (۲ CP)', 'secondary', 'repeat')}${btn(ph ? 'حمله: ۶' : 'حمله: ضربهٔ شمشیر (۶)', 'primary', 'swords')}${ph ? '' : btn('بی‌حمله', 'secondary', 'x')}` }) },
        status: `<b>ریختن سوم هم تمام شد.</b> چهار شمشیر قفل بود و تاس آخر باز قلب آمد؛ هنوز «ضربهٔ شمشیر» با ${fa(6)} آسیب جور است. حالا هر ریختن دیگر ${fa(2)} CP خرج دارد. ${fa(4)} CP دارید، پس دکمهٔ «ریختن اضافه» فعال است؛ با کمتر از ${fa(2)} CP خاکستری می‌شود.`,
        pstatus: `<b>سه ریختن تمام شد.</b> ریختن اضافه ${fa(2)} CP.`,
        log: [[1, 'ریختن دوم: ۴ شمشیر'], [1, 'چهار شمشیر قفل شد'], [1, 'ریختن سوم: قلب']],
      },
      {
        shotTitle: 'نتیجهٔ حمله', turnSub: 'دفاع حریف و کم شدن جان',
        opps: opps(false, { hp: 11, cp: 4 }),
        table: table({ nil: { hp: 11, cp: 4, hit: true, pop: `${fa(6)} آسیب` }, tray: () => `<div class="dt-def"><small>دفاع نیلوفر</small>${tray('shadow', [1, 3])}<span class="dt-res"><span class="is-r">خنجر: ${fa(1)} آسیب به شما</span><span class="is-g">کیسه: +${fa(1)} CP</span></span></div>` }),
        me: { note: note({ ...ME0, hp: 20 }), above: above({ me: { ...ME0, hp: 20, pop: `${fa(1)} آسیب` }, meB: { dice: D1, pick: 0 } }) },
        status: '<b>حمله شد.</b> ضربهٔ شمشیر ۶ آسیب زد؛ نیلوفر با ۲ تاس دفاع یک خنجر (۱ آسیب برگشتی) و یک کیسه (+۱ CP) آورد. جان نیلوفر ۱۷ ← ۱۱.',
        pstatus: '<b>نیلوفر ۶ آسیب خورد.</b>',
        log: [[1, 'حمله: ضربهٔ شمشیر (۶)'], [2, 'دفاع نیلوفر: خنجر و کیسه'], [2, 'نیلوفر ۶ آسیب خورد'], [1, 'شما ۱ آسیب خوردید']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'تاس‌های زندهٔ نیلوفر', phone: true,
        opps: opps(true, { hp: 11, cp: 5 }),
        table: table({ nil: { hp: 11, cp: 5 }, nilB: { dice: [1, 2, 5, 6, 1] }, tray: () => tray('shadow', [1, 2, 5, 6, 1], [0, 1, 4], `<span class="dt-left">ریختن ${fa(2)} از ${fa(3)}</span>`) }),
        me: { turn: false, note: note({ ...ME0, hp: 20 }), above: above({ me: { ...ME0, hp: 20 } }) },
        status: '<b>نوبت نیلوفر است.</b> تاس‌هایش زنده دیده می‌شود و توانایی‌های جورشده روی صفحه‌اش روشن است: «خنجر» با ۳ خنجر و «نیش سایه» با ۲ خنجر و ۲ سایه.',
        pstatus: '<b>نوبت نیلوفر.</b> دو توانایی جور است.',
        log: [[2, '+۱ CP و ۱ کارت'], [2, 'ریختن اول: ۲ خنجر'], [2, 'ریختن دوم: ۳ خنجر و ۲ سایه']],
      },
      {
        shotTitle: 'دفاع', turnSub: 'در نوبت حریف',
        opps: opps(true, { hp: 11, cp: 5 }),
        table: table({ nil: { hp: 11, cp: 5 }, nilB: { dice: [1, 2, 1, 2, 5], pick: 0 } }), overlay: defModal,
        me: { turn: false, note: note({ ...ME0, hp: 20 }), above: above({ me: { ...ME0, hp: 20 } }) },
        status: '<b>نیلوفر به شما حمله کرد.</b> تاس دفاع را ریختید؛ نتیجه با جزئیات در پنجره است.',
        log: [[2, 'حمله: خنجر با ۴ خنجر'], [1, 'دفاع شما: قلب، مشت، شمشیر']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جان پایانی و تعداد نوبت', meta: ['پایان', '۲ نفر', 'نوبت ۱۴'],
        opps: opps(false, { hp: 0, cp: 6 }),
        table: table({ nil: { hp: 0, cp: 6, hit: true } }), overlay: endModal,
        me: { turn: false, clock: '', note: note({ hp: 9, cp: 2 }), above: above({ me: { hp: 9, cp: 2, wound: 1 }, meB: { dice: [6, 6, 6, 6, 6], pick: 4 } }) },
        status: '<b>بازی تمام شد.</b> شما با خشم کوهستان بردید.',
        log: [[1, 'ریختن سوم: ۵ مشت'], [1, 'خشم کوهستان: ۱۴ آسیب، دفاع‌ناپذیر'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:12px}
.dt-side{display:flex;gap:10px;align-items:center;direction:ltr}
.dt-b{position:relative;inline-size:var(--bw);flex:none;border-radius:10px;overflow:hidden;box-shadow:0 10px 18px -10px rgba(0,0,0,.7)}
.dt-b>img:first-child{display:block;inline-size:100%;block-size:auto}
.dt-box{position:absolute;box-sizing:border-box;border-radius:8px;box-shadow:inset 0 0 0 3px var(--felt-gold),0 0 12px rgba(232,166,66,.65);background:rgba(232,166,66,.14)}
.dt-box.is-pick{box-shadow:inset 0 0 0 4px #FAF5EC,0 0 0 3px var(--felt-gold),0 0 14px rgba(232,166,66,.8)}
.dt-box b{position:absolute;inset-block-end:4px;left:6px;padding:1px 8px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:12px;direction:rtl;white-space:nowrap}
.dt-pop{position:absolute;top:8px;right:12px;padding:2px 10px;border-radius:999px;background:#E0505C;color:#fff;font-size:15px;font-weight:800}
.dt-stats{display:grid;gap:6px;justify-items:center;inline-size:84px;direction:rtl;color:var(--felt-ink)}
.dt-hp{display:grid;justify-items:center;inline-size:72px;block-size:72px;align-content:center;border-radius:50%;background:#2a1a12;box-shadow:inset 0 0 0 5px #E0505C}
.dt-hp b{font-size:26px;line-height:1}.dt-hp small{font-size:11px;color:var(--felt-muted)}
.dt-hp.is-hit{box-shadow:inset 0 0 0 5px #E0505C,0 0 0 4px rgba(224,80,92,.35)}
.dt-cp{display:grid;justify-items:center}.dt-cp b{font-size:18px;line-height:1.1}.dt-cp small{font-size:11px;color:var(--felt-muted)}
.dt-st{display:flex;gap:4px}.dt-st span{display:inline-flex;align-items:center;gap:1px;font-size:12px;font-weight:800}.dt-st img{inline-size:16px;block-size:auto}.dt-st .is-zero{opacity:.35}
.dt-tray{display:flex;gap:10px;align-items:center;justify-content:center;direction:ltr}
.dt-die{all:unset;cursor:pointer;position:relative;display:grid;justify-items:center;border-radius:12px}
.dt-die img{display:block;inline-size:60px;block-size:60px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.5))}
.dt-die.is-lock img{outline:3px solid var(--felt-gold);outline-offset:2px;border-radius:12px}
.dt-die small{position:absolute;inset-block-end:-10px;padding:0 6px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:11px;font-weight:800}
.dt-left{color:var(--felt-muted);font-size:13px;direction:rtl}
.dt-up,.dt-res{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.dt-up>span,.dt-res>span{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-size:14px;font-weight:700}
.dt-up img{inline-size:16px}
.is-g{box-shadow:inset 0 0 0 1.5px #3BB273}.is-r{box-shadow:inset 0 0 0 1.5px #E0505C}
.gd-modal .dt-res>span{background:var(--surface-sunken);color:var(--text)}
.dt-def{display:grid;gap:6px;justify-items:center}.dt-def>small{color:var(--felt-muted);font-size:12px}
.dt-me{display:grid;gap:10px;justify-items:center;inline-size:100%}
.dt-acts{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.dt-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dt-pk{all:unset;cursor:pointer;position:relative;display:block;border-radius:8px;overflow:hidden}.dt-pk img{display:block;inline-size:100%}
.dt-pk.is-sel{box-shadow:0 0 0 3px #E8A642}.dt-pk.is-taken img{filter:grayscale(1);opacity:.5}.dt-pk b{position:absolute;inset:auto 8px 8px auto;padding:2px 8px;border-radius:999px;background:#142B3B;color:#FAF5EC;font-size:12px}
.gc-seat__meta>*{white-space:nowrap}
.cx-phone .gc-table{gap:8px}
.dt-side--ph{flex-direction:column;gap:4px}
.dt-stats--ph{display:flex;inline-size:auto;gap:10px;align-items:center}
.dt-stats--ph .dt-hp{inline-size:auto;block-size:auto;border-radius:999px;padding:2px 12px;display:flex;gap:4px;align-items:baseline;box-shadow:inset 0 0 0 2px #E0505C}.dt-stats--ph .dt-hp b{font-size:16px}
.dt-stats--ph .dt-cp{display:flex;gap:4px;align-items:baseline}.dt-stats--ph .dt-cp b{font-size:14px}
.cx-phone .dt-box b{font-size:10px;padding:0 5px;inset-block-end:2px}
.cx-phone .dt-tray{gap:6px}.cx-phone .dt-die img{inline-size:52px;block-size:52px}
.cx-phone .dt-acts{gap:6px;padding-inline:8px}
.cx-phone .dt-up>span,.cx-phone .dt-res>span{font-size:12.5px;padding:5px 9px}`,
    shotTitle: 'نوبت شما', turnSub: 'تاس حمله و انتخاب توانایی',
    diffs: [
      ['چیدمان', 'دوئل روبه‌رو: صفحهٔ قهرمان حریف بالا، سینی تاس وسط، صفحهٔ شما پایین؛ جان، CP و نشان‌های زخم، گیجی و سپر کنار هر صفحه. BGA این بازی را ندارد'],
      ['تاس و توانایی', 'تا ۳ بار ریختن ۵ تاس؛ تاس قفل‌شده حلقهٔ طلایی دارد (§۶). بعد از سه ریختن، دکمهٔ «ریختن اضافه (۲ CP)» تا وقتی CP کافی هست (§۷). توانایی‌هایی که الگویشان جور است روی صفحه روشن می‌شوند با سطح و آسیب، و توانایی انتخاب‌شده قاب سفید دارد (همه از روی تاس‌ها حساب شده)'],
      ['دفاع و نتیجه', 'نتیجهٔ تاس دفاع حریف و کم شدن جان (§۸)، تاس‌های زندهٔ حریف با توانایی‌های جورشده‌اش (§۹)، پنجرهٔ دفاع شما با درمان و ضربهٔ برگشتی (§۱۰)'],
      ['کارت‌ها', 'بازی چاپی دستهٔ کارت هر قهرمان (کارت اصلی، تاس، فوری و ارتقا با CP) دارد ولی هیچ آرتی از کارت‌ها در بسته نیست؛ فعلاً فقط تعداد کارت دست به‌صورت متن آمده و در MISSING-ART ثبت شد'],
      ['آرت', 'صفحه‌های قهرمان، تاس‌ها و نشان‌ها رندر خود سایت از قهرمان‌های موتورند (ستون جان و CP چاپی صفحه بریده شد تا عدد زنده نشان داده شود) و با اندازه در MISSING-ART ثبت شدند'],
      ['موتور', 'موتور کارت ندارد، CP را خرج ریختن اضافه می‌کند، چهار قهرمان ساختگی و جان ۳۰ دارد (RULES E1 تا E3)'],
    ],
  };
}
