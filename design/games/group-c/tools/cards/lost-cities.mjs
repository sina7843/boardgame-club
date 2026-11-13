// Lost Cities on the card-table frame (as the repo engine: 2 players, 60 cards, 5 colours × 2–10 + 3 wagers, hands of 8).
// Colours y صحرا, b دریا, w کوهستان (purple art), g جنگل, r آتشفشان. Mock round 1 of 3, 10 turns each so far:
// you: y [wager, 4, 6] · b [3, 5, 7, 8] · g [2]. Niloufar: w [wager, wager, 5, 7] · r [4, 6, 9].
// Discard piles: y [2] · w [3] · g [9, 3] · r [2]. 16 in hands + 20 on the table → deck 24. Your turn, place step:
// hand y8 y10 b4 b9 g6 g8 r3 w9 — b4 can only be discarded (blue is at 8). Scores: you −20, +3, −18; Niloufar −24, −1.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const COL = ['y', 'b', 'w', 'g', 'r'];
  const FA = { y: 'صحرا', b: 'دریا', w: 'کوهستان', g: 'جنگل', r: 'آتشفشان' };
  const c = (id) => `lost-cities-${id}`;
  const alt = (id) => `${FA[id[0]]} ${id.slice(1) === '0' ? 'شرط' : fa(Number(id.slice(1)))}`;
  const OPP = { w: ['w0', 'w0', 'w5', 'w7'], r: ['r4', 'r6', 'r9'] };
  const ME = { y: ['y0', 'y4', 'y6'], b: ['b3', 'b5', 'b7', 'b8'], g: ['g2'] };
  const DIS = { y: ['y2'], w: ['w3'], g: ['g9', 'g3'], r: ['r2'] };
  const SCORE = { y: '−۲۰', b: '+۳', g: '−۱۸' };
  const col = (cards, side, k) => `<span class="lc-col lc-col--${side}${side === 'me' && k === 'y' ? ' is-target' : ''}">${(cards ?? []).map((id) => img(c(id), alt(id))).join('')}${side === 'me' && k === 'y' ? `<span class="lc-drop">${img(c('y8'), '')}</span>` : ''}</span>`;
  const pile = (k, i) => `<span class="lc-dis${DIS[k] ? '' : ' is-empty'}"><span class="lc-dis__slot">${img(`lost-cities-symbol-${i + 1}`, FA[k], 'lc-sym')}${DIS[k] ? img(c(DIS[k].at(-1)), alt(DIS[k].at(-1)), 'lc-top') : ''}</span><small>${FA[k]}${DIS[k] ? `<span class="bgv-sep"></span>${fa(DIS[k].length)}` : ''}</small></span>`;
  const above = (ph) => `<div class="lc-step${ph ? ' lc-step--ph' : ''}"><span class="lc-step__s is-on">۱. بازی یا دور انداختن</span><span class="lc-step__s">۲. کشیدن</span>${ph ? '' : `${btn('بازی در صحرا', 'primary', 'check')}${btn('دور انداختن', 'secondary', 'x')}`}</div>`;
  const hand = ['y8', 'y10', 'b4', 'b9', 'g6', 'g8', 'r3', 'w9'].map((id) => ({ art: c(id), alt: alt(id), sel: id === 'y8', dim: id === 'b4' }));
  const { modal } = H;
  const exp = (k, me, nil) => `<tr><td><span class="lc-sw lc-sw--${k}"></span>${FA[k]}</td><td class="n"><span dir="ltr">${me}</span></td><td class="n"><span dir="ltr">${nil}</span></td></tr>`;
  const roundEnd = (ph) => modal('پایان دست ۱', `<p>دسته تمام شد و دست همان لحظه بسته شد. امتیاز هر سفر: جمع عددها منهای ${fa(20)}، ضرب در (شرط‌ها + ${fa(1)})؛ با ${fa(8)} کارت یا بیشتر ${fa(20)}+.</p>
<table class="gd-score"><thead><tr><th>سفر</th><th class="n">شما</th><th class="n">نیلوفر</th></tr></thead><tbody>
${exp('y', `(${fa(28)} − ${fa(20)}) × ${fa(2)} = ${fa(16)}`, '—')}${exp('b', `${fa(32)} − ${fa(20)} = ${fa(12)}`, '—')}${exp('w', '—', `(${fa(21)} − ${fa(20)}) × ${fa(3)} = ${fa(3)}`)}${exp('g', `${fa(16)} − ${fa(20)} = −${fa(4)}`, '—')}${exp('r', '—', `${fa(19)} − ${fa(20)} = −${fa(1)}`)}
<tr class="is-win"><td>جمع دست</td><td class="n">${fa(24)}</td><td class="n">${fa(2)}</td></tr></tbody></table><p class="cx-note">سفری که شروع نشده امتیاز ندارد. دست ۲ را نیلوفر شروع می‌کند.</p>`, `${btn('دست بعد', 'primary', 'next')}`);
  const gameEnd = (ph) => modal('پایان بازی: سه دست', `<table class="gd-score"><thead><tr><th>دست</th><th class="n">شما</th><th class="n">نیلوفر</th></tr></thead><tbody><tr><td>${fa(1)}</td><td class="n">${fa(24)}</td><td class="n">${fa(2)}</td></tr><tr><td>${fa(2)}</td><td class="n">${fa(11)}−</td><td class="n">${fa(37)}</td></tr><tr><td>${fa(3)}</td><td class="n">${fa(45)}</td><td class="n">${fa(18)}</td></tr><tr class="is-win"><td>جمع</td><td class="n">${fa(58)}</td><td class="n">${fa(57)}</td></tr></tbody></table><p>شما با ${fa(58)} امتیاز بردید. جمع برابر یعنی مساوی.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'LostCities', fa: 'شهرهای گمشده', latin: 'Lost Cities', meta: ['زنده', '۲ نفر', 'دور ۱ از ۳'],
    opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${backs('lost-cities-back', 8)}<span>سفرها: <b>${'−۲۵'}</b></span>` }],
    me: { cards: hand, clock: '0:48', turn: true, note: `سفرها: ${'−۳۵'}`, above: (ph) => above(ph) },
    cardW: 70, phoneCardW: 44, cardRatio: 1.52,
    table: (ph) => `<div class="lc-board">
<div class="lc-row lc-row--opp" aria-label="سفرهای نیلوفر">${COL.map((k) => col(OPP[k], 'opp', k)).join('')}</div>
<div class="lc-mid"><div class="lc-row lc-row--dis" aria-label="کپه‌های دور ریخته">${COL.map(pile).join('')}</div><div class="gc-pile lc-deck" style="--pw:54px;--ppw:34px">${img('lost-cities-back', 'دسته')}<span><b>${fa(24)}</b> کارت</span></div></div>
<div class="lc-row lc-row--me" aria-label="سفرهای شما">${COL.map((k) => col(ME[k], 'me', k)).join('')}</div>
<div class="lc-row lc-row--score">${COL.map((k) => `<small>${SCORE[k] ?? '—'}</small>`).join('')}</div></div>`,
    status: '<b>نوبت شماست.</b> اول یک کارت بازی کنید یا دور بیندازید، بعد از دسته یا بالای یکی از کپه‌ها بکشید. ۸ صحرا را انتخاب کردید؛ بعد از ۶ می‌نشیند.',
    pstatus: '<b>نوبت شما.</b> بازی یا دور انداختن، بعد کشیدن.',
    railCard: `<section class="cx-card"><h3>سفرهای شما</h3><div class="gc-pills"><span class="bgv-chip">صحرا ${SCORE.y} (شرط ×۲)</span><span class="bgv-chip">دریا ${SCORE.b}</span><span class="bgv-chip">جنگل ${SCORE.g}</span></div><div class="ga-rule">${ic('info')}<span>هر سفر با ۲۰ امتیاز منفی شروع می‌شود و هر کارت شرط آن را چند برابر می‌کند. کارت‌ها فقط صعودی می‌نشینند؛ ۴ دریا دیگر جا ندارد و فقط دور انداخته می‌شود.</span></div></section>`,
    logNote: 'دسته: ۲۴ کارت',
    log: [[2, 'نیلوفر ۷ کوهستان را بازی کرد'], [2, 'نیلوفر از دسته کشید'], [1, 'شما ۳ جنگل را دور انداختید'], [1, 'شما از دسته کشیدید'], [2, 'نیلوفر ۹ آتشفشان را بازی کرد'], [2, 'نیلوفر از دسته کشید'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['check', 'بازی'], ['x', 'دور انداختن'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'پایان دست', turnSub: 'امتیاز هر سفر هر دو نفر', overlay: roundEnd,
        me: { turn: false, clock: '', cards: [], above: () => '' },
        status: '<b>دست ۱ تمام شد.</b> شما ۲۴ و نیلوفر ۲ امتیاز گرفتید.',
        log: [[2, 'نیلوفر آخرین کارت دسته را کشید'], [1, 'دست ۱: شما ۲۴، نیلوفر ۲']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جمع سه دست', phone: true, phoneOnly: true, overlay: gameEnd, meta: ['تمام شد', 'دونفره', 'دست ۳ از ۳'],
        me: { turn: false, clock: '', cards: [], above: () => '' },
        pstatus: '<b>بازی تمام شد.</b> شما بردید.', status: '',
      },
    ],    css: `.lc-sw{display:inline-block;inline-size:10px;block-size:10px;border-radius:50%;margin-inline-end:6px}.lc-sw--y{background:#E8C33A}.lc-sw--b{background:#2F7FC1}.lc-sw--w{background:#8A62B8}.lc-sw--g{background:#3F9A55}.lc-sw--r{background:#D2452F}
.gc-card{margin-inline-start:4px}.gc-card:first-child{margin-inline-start:0}.cx-phone .gc-card{margin-inline-start:-4px}.cx-phone .gc-card:first-child{margin-inline-start:0}
.gc-seat{max-inline-size:280px}
.lc-board{display:grid;gap:6px;justify-items:center}
.lc-row{direction:ltr;display:grid;grid-template-columns:repeat(5,64px);gap:10px}
.lc-col{display:flex;flex-direction:column;align-items:center;min-block-size:148px}
.lc-col img{inline-size:54px;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 4px 8px -4px rgba(0,0,0,.6)}
.lc-col img+img,.lc-col img+.lc-drop{margin-block-start:-62px}
.lc-col--opp{justify-content:flex-end}
.lc-col--me{justify-content:flex-start}
.lc-col.is-target{border-radius:6px;box-shadow:0 0 0 2px rgba(232,166,66,.6);background:rgba(232,166,66,.08);padding-block-end:4px}
.lc-drop img{opacity:.55;outline:2px dashed var(--felt-gold);outline-offset:-2px}
.lc-mid{position:relative;padding:6px 10px;border-radius:12px;background:rgba(8,20,28,.3)}
.lc-row--dis{grid-template-columns:repeat(5,64px)}.lc-dis{display:grid;justify-items:center;gap:3px;color:var(--felt-muted);font-size:11px}
.lc-dis__slot{position:relative;display:grid;place-items:center;inline-size:58px;block-size:86px;border-radius:6px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.18)}
.lc-sym{inline-size:34px;opacity:.35}
.lc-top{position:absolute;inset:2px;inline-size:54px;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.lc-deck{position:absolute;inset-inline-end:-84px;inset-block-start:50%;transform:translateY(-50%);font-size:12px}
.lc-row--score small{text-align:center;font-size:12px;font-weight:700;color:var(--felt-ink)}
.lc-step{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.35);font-size:12.5px;color:var(--felt-muted)}
.lc-step__s{padding:4px 8px;border-radius:999px;white-space:nowrap}.lc-step__s.is-on{background:var(--felt-gold);color:#142B3B;font-weight:700}
.lc-step .bgv-btn{white-space:nowrap}
.cx-phone .lc-row{grid-template-columns:repeat(5,40px);gap:6px}.cx-phone .lc-col{min-block-size:96px}.cx-phone .lc-col img{inline-size:36px;border-radius:3px}.cx-phone .lc-col img+img,.cx-phone .lc-col img+.lc-drop{margin-block-start:-42px}
.cx-phone .lc-mid{padding:4px 0}.cx-phone .lc-row--dis{grid-template-columns:repeat(5,40px)}.cx-phone .lc-dis__slot{inline-size:38px;block-size:58px}.cx-phone .lc-top{inline-size:34px}.cx-phone .lc-sym{inline-size:22px}.cx-phone .lc-dis small{display:none}.cx-phone .lc-deck{inset-inline-end:-44px}.cx-phone .lc-deck span{font-size:10px}
.cx-phone .gc-table{gap:0}
.lc-step--ph{margin-inline:10px;justify-content:center}`,
    shotTitle: 'نوبت شما', turnSub: 'بازی یا دور انداختن، بعد کشیدن',
    diffs: [
      ['دونفره', 'فقط یک حریف؛ بالای میز سفرهای او (پنج ستون رنگی، رو به وسط)، وسط پنج کپهٔ دور ریخته با نشان هر رنگ و دسته، پایین سفرهای شما'],
      ['ستون‌ها', 'کارت‌های هر سفر روی هم می‌افتند و فقط نوار بالایی با عددش پیداست؛ آخرین کارت کامل دیده می‌شود. جای کارت انتخاب‌شده خط‌چین است'],
      ['دو مرحله', 'نوبت دو قدم دارد: بازی یا دور انداختن، بعد کشیدن. قدم فعلی بالای دست روشن است؛ در قدم دوم دسته و کپه‌ها قابل انتخاب می‌شوند (به جز کپه‌ای که همین الان در آن انداخته‌اید)'],
      ['دست شما', 'کارتی که به سفرش نمی‌خورد (کوچک‌تر از آخرین کارت) کم‌رنگ است و فقط دور انداخته می‌شود'],
      ['امتیاز', 'امتیاز هر سفر زیر ستونش و جمعش روی نوار شما؛ ستون کنار ضریب شرط را هم می‌گوید'],
      ['قوانین', 'مثل موتور: ۲ نفر، ۸ کارت در دست، سه دور (یا یک دور)؛ هشت کارت یا بیشتر در یک سفر ۲۰ امتیاز جایزه دارد'],
    ],
  };
}
