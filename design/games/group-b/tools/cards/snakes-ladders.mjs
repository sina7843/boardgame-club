// Snakes and Ladders / مارپله on the shared table frame (group B). Rules as the repo engine: one die rolled by the
// server, no choices; landing exactly on a ladder foot climbs, on a snake head slides; exact roll to finish on 100
// (default). Board art: the ready-made 100-square board (classic 1943 layout, same snakes/ladders as rules.ts).
// Mock (4 players, seat order Setareh 1 red, you 2 blue, Kian 3 green, Niloufar 4 yellow): you were on 23 and rolled 5
// → 28, a ladder foot → 84. Setareh slid 56 → 53, Kian is on 66, Niloufar climbed 9 → 31.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  // square n → centre in board pixels (648 art, grid 24..624, 60 px cells, square 1 bottom-left, alternating rows)
  const xy = (n) => { const row = Math.floor((n - 1) / 10), k = (n - 1) % 10, col = row % 2 === 0 ? k : 9 - k; return [24 + col * 60 + 30, 24 + (9 - row) * 60 + 30]; };
  const pc = (n) => { const [x, y] = xy(n); return `left:${(x / 6.48).toFixed(3)}%;top:${(y / 6.48).toFixed(3)}%`; };
  const tok = (k, n, cls = '', alt = '') => `<span class="sl-tok${cls ? ' ' + cls : ''}" style="${pc(n)}">${img(`snakes-ladders-pawn-${k}`, alt)}</span>`;
  const dot = (n) => `<i class="sl-step" style="${pc(n)}"></i>`;
  const [ax, ay] = xy(28), [bx, by] = xy(84);
  const climb = `<svg class="sl-ov" viewBox="0 0 648 648" aria-hidden="true"><defs><marker id="slh" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#E8A642"/></marker></defs><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by + 22}" stroke="#E8A642" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 14" marker-end="url(#slh)"/></svg>`;
  const board = (ph) => `<div class="sl-board${ph ? ' sl-board--ph' : ''}" aria-label="صفحهٔ مارپله">${img('snakes-ladders-board', 'صفحهٔ صدخانه‌ای مارپله')}${climb}
${[24, 25, 26, 27].map(dot).join('')}<i class="sl-t" style="${pc(28)}"></i><i class="sl-t sl-t--end" style="${pc(84)}"></i>
${tok(1, 53, '', 'ستاره، خانهٔ ۵۳')}${tok(3, 66, '', 'کیان، خانهٔ ۶۶')}${tok(4, 31, '', 'نیلوفر، خانهٔ ۳۱')}${tok(2, 23, 'is-me', 'شما، خانهٔ ۲۳')}${tok(2, 84, 'is-ghost', 'شما بعد از نردبان، خانهٔ ۸۴')}
<span class="sl-lbl" style="${pc(28)}">پای نردبان</span></div>`;
  const where = (k, n) => `<span class="sl-sum">${img(`snakes-ladders-pawn-${k}`, '')}خانهٔ <b>${fa(n)}</b></span>`;
  const above = (ph) => `<div class="sl-roll${ph ? ' sl-roll--ph' : ''}">${img('snakes-ladders-die-5', 'تاس: ۵')}<span class="sl-roll__t"><b>۵ آوردید</b>${ph ? '' : '<small>از ۲۳ به ۲۸ و با نردبان تا ۸۴</small>'}</span><span class="sl-path" dir="rtl"><b>${fa(23)}</b>${ic('prev')}<b>${fa(28)}</b>${ic('prev')}<b class="is-up">${fa(84)}</b></span>${ph ? '' : btn('ریختن تاس', 'primary', 'repeat', ' disabled')}</div>`;
  const { modal } = H;
  const arrow = (a, b, col = '#E8A642') => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return `<svg class="sl-ov" viewBox="0 0 648 648" aria-hidden="true"><defs><marker id="slh${a}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker></defs><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2 + (y2 > y1 ? -22 : 22)}" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 14" marker-end="url(#slh${a})"/></svg>`; };
  const boardP = (o) => (ph) => `<div class="sl-board${ph ? ' sl-board--ph' : ''}" aria-label="صفحهٔ مارپله">${img('snakes-ladders-board', 'صفحهٔ صدخانه‌ای مارپله')}${o.arrow ?? ''}
${(o.dots ?? []).map(dot).join('')}${(o.ring ?? []).map((n, i) => `<i class="sl-t${i ? ' sl-t--end' : ''}${o.down && i ? ' sl-t--down' : ''}" style="${pc(n)}"></i>`).join('')}
${o.toks.map(([k, n, cls, alt]) => tok(k, n, cls, alt)).join('')}${o.lbl ? `<span class="sl-lbl${o.down ? ' sl-lbl--down' : ''}" style="${pc(o.lbl[0])}">${o.lbl[1]}</span>` : ''}</div>`;
  const rollBar = (die, title, sub, path, o = {}) => (ph) => `<div class="sl-roll${ph ? ' sl-roll--ph' : ''}${o.warn ? ' sl-roll--warn' : ''}">${img(`snakes-ladders-die-${die}`, `تاس: ${fa(die)}`)}<span class="sl-roll__t"><b>${title}</b>${ph ? '' : `<small>${sub}</small>`}</span><span class="sl-path" dir="rtl">${path.map(([n, cls], i) => `${i ? ic('prev') : ''}<b class="${cls ?? ''}">${typeof n === 'number' ? fa(n) : n}</b>`).join('')}</span>${ph ? '' : btn(o.again ? 'دوباره تاس' : 'ریختن تاس', 'primary', 'repeat', o.again ? '' : ' disabled')}</div>`;
  const others = [[1, 91, '', 'ستاره، خانهٔ ۹۱'], [3, 88, '', 'کیان، خانهٔ ۸۸'], [4, 60, '', 'نیلوفر، خانهٔ ۶۰']];
  const oppsLate = [
    { name: 'ستاره', av: 'س', seat: 3, clock: '0:20', meta: where(1, 91) },
    { name: 'کیان', av: 'ک', seat: 8, clock: '0:20', meta: where(3, 88) },
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:20', meta: where(4, 60) },
  ];
  const ending = (ph) => modal('شما بردید', `<p>با ${fa(3)} دقیقاً روی ${fa(100)} نشستید.</p><table class="gd-score"><thead><tr><th>رتبه</th><th>بازیکن</th><th class="n">خانه</th></tr></thead><tbody><tr class="is-win"><td>${fa(1)}</td><td>شما</td><td class="n">${fa(100)}</td></tr><tr><td>${fa(2)}</td><td>ستاره</td><td class="n">${fa(91)}</td></tr><tr><td>${fa(3)}</td><td>کیان</td><td class="n">${fa(88)}</td></tr><tr><td>${fa(4)}</td><td>نیلوفر</td><td class="n">${fa(60)}</td></tr></tbody></table><p class="cx-note">رتبهٔ بقیه به ترتیب نزدیکی به ${fa(100)} است؛ خانهٔ برابر یعنی رتبهٔ مشترک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'SnakesLadders', fa: 'مارپله', latin: 'Snakes & Ladders', meta: ['زنده', '۴ نفر', 'رسیدن دقیق به ۱۰۰'],
    opps: [
      { name: 'ستاره', av: 'س', seat: 3, clock: '0:20', meta: where(1, 53) },
      { name: 'کیان', av: 'ک', seat: 8, clock: '0:20', meta: where(3, 66) },
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:20', meta: where(4, 31) },
    ],
    me: { cards: [], clock: '0:16', turn: true, note: `<span class="sl-sum sl-sum--me">${img('snakes-ladders-pawn-2', '')}مهرهٔ ۲، خانهٔ <b>${fa(23)}</b></span>`, above },
    table: (ph) => board(ph),
    status: '<b>۵ آوردید.</b> مهره‌تان از ۲۳ چهار خانه جلو می‌رود و روی ۲۸ می‌نشیند که پای نردبان است؛ تا ۸۴ بالا می‌روید. بعد نوبت کیان است.',
    pstatus: '<b>۵ آوردید:</b> ۲۸ پای نردبان است؛ تا ۸۴ بالا می‌روید.',
    railCard: `<section class="cx-card"><h3>مسیر شما<span class="bgv-spacer"></span><span class="cx-note">مهرهٔ ۲</span></h3><div class="gc-pills"><span class="bgv-chip">الان: ${fa(84)}</span><span class="bgv-chip">تا ۱۰۰: ${fa(16)} خانه</span><span class="bgv-chip">جلوتر از همه</span></div><div class="ga-rule">${ic('info')}<span>فقط جایی که حرکت تمام می‌شود مهم است: پای نردبان بالا می‌برد و سر مار پایین. برای ۱۰۰ عدد دقیق لازم است؛ تاس بزرگ‌تر یعنی این نوبت حرکت نمی‌کنید.</span></div></section>`,
    logNote: 'دور ۹',
    log: [[8, 'کیان ۳ آورد: ۶۳ تا ۶۶'], [2, 'نیلوفر ۳ آورد: ۹ پای نردبان؛ تا ۳۱ بالا رفت'], [3, 'ستاره ۴ آورد: ۵۶ سر مار؛ تا ۵۳ پایین آمد'], [1, 'شما ۵ آوردید: ۲۸ پای نردبان؛ تا ۸۴ بالا']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['repeat', 'تاس'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'تاس بیشتر از فاصله', turnSub: 'رسیدن دقیق به ۱۰۰: این نوبت حرکت نمی‌کنید', railCard: '', opps: oppsLate, meta: ['زنده', '۴ نفر', 'رسیدن دقیق به ۱۰۰'],
        table: boardP({ toks: [...others, [2, 97, 'is-me', 'شما، خانهٔ ۹۷']], ring: [97], lbl: [97, '۳ خانه مانده'] }),
        me: { note: `<span class="sl-sum sl-sum--me">${img('snakes-ladders-pawn-2', '')}مهرهٔ ۲، خانهٔ <b>${fa(97)}</b></span>`, above: rollBar(5, '۵ آوردید؛ حرکت نمی‌کنید', 'تا ۱۰۰ فقط ۳ خانه مانده و عدد دقیق لازم است', [[97], ['۱۰۰؟', 'is-no']], { warn: true }) },
        status: '<b>۵ آوردید ولی تا ۱۰۰ فقط ۳ خانه مانده.</b> چون رسیدن دقیق لازم است، این نوبت سر جایتان می‌مانید. نوبت کیان است.',
        pstatus: '<b>۵ زیاد است.</b> این نوبت حرکت نمی‌کنید.',
        log: [[3, 'ستاره ۲ آورد: ۸۹ تا ۹۱'], [1, 'شما ۵ آوردید؛ بیشتر از ۳ بود، حرکت نکردید']],
        phone: true,
      },
      {
        shotTitle: 'برگشت از ۱۰۰', turnSub: 'گزینهٔ «برگشت»: اضافه‌ها به عقب، با اثر مار', railCard: '', opps: oppsLate, meta: ['زنده', '۴ نفر', 'برگشت از ۱۰۰'],
        table: boardP({ arrow: arrow(98, 78, '#F0AAA3'), dots: [98, 99, 100, 99], toks: [...others, [2, 97, 'is-ghost', ''], [2, 78, 'is-me', 'شما، خانهٔ ۷۸']], ring: [98, 78], down: true, lbl: [98, 'سر مار'] }),
        me: { note: `<span class="sl-sum sl-sum--me">${img('snakes-ladders-pawn-2', '')}مهرهٔ ۲، خانهٔ <b>${fa(78)}</b></span>`, above: rollBar(5, '۵ آوردید: تا ۱۰۰ و برگشت', 'دو خانهٔ اضافه به عقب شمرده شد و ۹۸ سر مار است', [[97], [100], [98], [78, 'is-down']]) },
        status: '<b>۵ آوردید و این میز «برگشت از ۱۰۰» دارد.</b> سه خانه تا ۱۰۰ رفتید و دو خانه برگشتید روی ۹۸ که سر مار است؛ تا ۷۸ پایین آمدید.',
        pstatus: '<b>برگشت از ۱۰۰:</b> ۹۸ سر مار؛ تا ۷۸.',
        log: [[1, 'شما ۵ آوردید: ۹۷ تا ۱۰۰ و برگشت تا ۹۸'], [1, '۹۸ سر مار بود؛ تا ۷۸ پایین آمدید']],
      },
      {
        shotTitle: 'مار و جایزهٔ ۶', turnSub: 'پایین آمدن با مار؛ با ۶ دوباره تاس', railCard: '', opps: oppsLate, meta: ['زنده', '۴ نفر', 'جایزهٔ ۶ روشن'],
        table: boardP({ arrow: arrow(87, 24, '#F0AAA3'), dots: [82, 83, 84, 85, 86], toks: [...others, [2, 81, 'is-ghost', ''], [2, 24, 'is-me', 'شما، خانهٔ ۲۴']], ring: [87, 24], down: true, lbl: [87, 'سر مار'] }),
        me: { note: `<span class="sl-sum sl-sum--me">${img('snakes-ladders-pawn-2', '')}مهرهٔ ۲، خانهٔ <b>${fa(24)}</b></span>`, above: rollBar(6, '۶ آوردید: مار، ولی دوباره تاس دارید', 'از ۸۱ به ۸۷ که سر مار است؛ تا ۲۴ پایین آمدید', [[81], [87], [24, 'is-down']], { again: true }) },
        status: '<b>۶ آوردید.</b> روی ۸۷ نشستید که سر مار است و تا ۲۴ پایین آمدید. چون ۶ بود، جایزه دارید و دوباره تاس می‌ریزید.',
        pstatus: '<b>مار!</b> ۸۷ تا ۲۴؛ با ۶ دوباره تاس.',
        log: [[1, 'شما ۶ آوردید: ۸۱ تا ۸۷'], [1, '۸۷ سر مار بود؛ تا ۲۴'], [1, 'جایزهٔ ۶: دوباره تاس']],
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'رتبه‌ها', opps: oppsLate.map((o) => ({ ...o, clock: '' })), meta: ['تمام شد', '۴ نفر', 'رسیدن دقیق به ۱۰۰'],
        table: boardP({ toks: [...others, [2, 100, 'is-me', 'شما، خانهٔ ۱۰۰']], ring: [100] }), overlay: ending,
        me: { turn: false, clock: '', above: () => '', note: `<span class="sl-sum sl-sum--me">${img('snakes-ladders-pawn-2', '')}خانهٔ <b>${fa(100)}</b></span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما اول به ۱۰۰ رسیدید.',
        log: [[1, 'شما ۳ آوردید: ۹۷ تا ۱۰۰'], [1, 'شما بردید']],
      },
    ],    css: `.sl-board{position:relative;direction:ltr;inline-size:var(--bw,560px);aspect-ratio:1;flex:none;filter:drop-shadow(0 16px 22px rgba(0,0,0,.55))}
.sl-board>img{display:block;inline-size:100%;block-size:100%}
.sl-board--ph{--bw:350px}
.sl-ov{position:absolute;inset:0;inline-size:100%;block-size:100%}
.sl-tok,.sl-step,.sl-t,.sl-lbl{position:absolute;transform:translate(-50%,-50%)}
.sl-tok{inline-size:calc(var(--bw,560px)*.135);transform:translate(-50%,-60%)}
.sl-tok img{display:block;inline-size:100%;block-size:auto}
.sl-tok.is-me img{filter:drop-shadow(0 0 0 #fff) drop-shadow(0 0 3px #FAF5EC) drop-shadow(0 0 2px var(--felt-gold))}
.sl-tok.is-ghost{opacity:.6}.sl-tok.is-ghost img{filter:drop-shadow(0 0 4px #E8A642)}
.sl-step{inline-size:calc(var(--bw,560px)*.024);aspect-ratio:1;border-radius:50%;background:#E8A642;box-shadow:0 0 0 2px #142B3B}
.sl-t{inline-size:calc(var(--bw,560px)*.085);aspect-ratio:1;border-radius:50%;border:3px dashed #142B3B;background:rgba(232,166,66,.45);box-sizing:border-box}
.sl-t--end{inline-size:calc(var(--bw,560px)*.093);border:3px solid #E8A642;background:rgba(232,166,66,.25)}
.sl-lbl{margin-top:calc(var(--bw,560px)*.068);padding:1px 7px;border-radius:999px;background:#142B3B;color:#FAF5EC;font-size:11.5px;font-weight:700;white-space:nowrap}
.sl-board--ph .sl-lbl{font-size:9.5px;padding:0 5px}.sl-board--ph .sl-t,.sl-board--ph .sl-t--end{border-width:2px}
.sl-sum{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.sl-sum img{inline-size:18px;block-size:auto;margin-block:-6px -2px}.sl-sum b{color:var(--felt-ink)}
.cx-pbar .sl-sum b{color:inherit}
.sl-roll{display:flex;align-items:center;gap:12px;inline-size:100%;padding:8px 12px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.sl-roll>img{inline-size:48px;block-size:48px;transform:rotate(-8deg);filter:drop-shadow(0 0 0 #E8A642) drop-shadow(0 4px 5px rgba(0,0,0,.5))}
.sl-roll__t{display:grid;gap:2px;font-size:15px;white-space:nowrap}.sl-roll__t small{font-size:12px;color:var(--felt-muted)}
.sl-path{display:inline-flex;align-items:center;gap:6px;margin-inline-start:auto;font-size:18px}.sl-path .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-muted)}
.sl-path b{display:inline-grid;place-items:center;min-inline-size:40px;block-size:34px;border-radius:8px;background:rgba(250,245,236,.1);box-shadow:inset 0 0 0 1px rgba(250,245,236,.2)}
.sl-path b.is-up{background:var(--felt-gold);color:#142B3B;box-shadow:none}
.sl-roll .bgv-btn{white-space:nowrap}
.sl-roll--ph{margin-inline:10px;inline-size:auto;padding:6px 10px;gap:10px}.sl-roll--ph>img{inline-size:36px;block-size:36px}.sl-roll--ph .sl-roll__t{font-size:13.5px}.sl-roll--ph .sl-roll__t small{font-size:11px}
.sl-path b.is-down{background:#F0AAA3;color:#142B3B;box-shadow:none}.sl-path b.is-no{opacity:.5;text-decoration:line-through}
.sl-roll--warn{box-shadow:inset 0 0 0 1.5px #F0AAA3}
.sl-t--down{border-color:#F0AAA3!important;background:rgba(240,170,163,.25)!important}
.sl-lbl--down{background:#8E2F22}
.sl-roll--ph .sl-path{font-size:14px;gap:3px}.sl-roll--ph .sl-path b{min-inline-size:30px;block-size:28px}.sl-roll--ph .sl-path .bgv-icon{inline-size:12px;block-size:12px}`,
    shotTitle: 'نوبت شما', turnSub: 'تاس ریخته شد؛ پای نردبان',
    diffs: [
      ['صفحه به جای دست', 'دست کارت ندارد؛ وسط میز صفحهٔ آمادهٔ صدخانه‌ای و مهره‌های شماره‌دار روی شمارهٔ خانه (رنگ همراه عدد، نه فقط رنگ)'],
      ['تاس و مسیر', 'تاس آماده بالای نوار شما با مسیر «۲۳ ← ۲۸ ← ۸۴»؛ روی صفحه قدم‌ها نقطه‌اند، خانهٔ فرود خط‌چین و برچسب «پای نردبان» دارد و جای نهایی مهرهٔ کم‌رنگ است'],
      ['تصمیم ندارد', 'تنها کار بازیکن تاس ریختن است؛ بعد از ریختن دکمه خاموش می‌شود تا مهره راه برود و نوبت برود'],
      ['چیپ حریف‌ها', 'به جای تعداد کارت: مهرهٔ شماره‌دار و شمارهٔ خانه؛ هم‌خانه شدن مجاز است و مهره‌ها کنار هم پخش می‌شوند'],
      ['نوار بالا', 'حالت رسیدن به ۱۰۰ («دقیق» یا «برگشت») و جایزهٔ ۶ اگر روشن باشد در نوار بالای میز دیده می‌شود'],
      ['قوانین', 'مثل موتور: ۲ تا ۶ نفر، چیدمان کلاسیک ۱۹۴۳ (۹ نردبان، ۱۰ مار)، رسیدن دقیق به ۱۰۰ پیش‌فرض است'],
    ],
  };
}
