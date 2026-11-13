// Ludo / منچ on the shared table frame (group B). Reference = BGA Ludo (owner decision 2026-11-08; 52 + 5 board). Was: engine Mensch (6 to enter,
// 6 rolls again, landing on an opponent sends it to its yard, exact count into the goal column).
// Board art: the ready-made BGA 4-player board (15×15 cross: 52-square track, 5-square goal column) — the engine and the
// current renderer use an 11×11 board (40 + 4), so pieces here sit on the art's own geometry (see diffs).
// Mock (4 players, clockwise red → green → yellow → blue; you are blue): you rolled a 6. Legal moves:
//   yard pawn → your start (13,8); pawn on (8,11) → (6,13), capturing Setareh's red pawn on its start square;
//   pawn on (2,6) → (6,3). The pawn in your goal column (11,7) cannot move 6 (exact count).
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const N = 15;
  const at = (c, r) => `left:${((c + 0.5) / N * 100).toFixed(3)}%;top:${((r + 0.5) / N * 100).toFixed(3)}%`;
  const pawn = (col, c, r, cls = '', alt = '') => `<span class="ld-p${cls ? ' ' + cls : ''}" style="${at(c, r)}">${img(`ludo-pawn-${col}`, alt)}</span>`;
  const mark = (c, r, cls = '') => `<i class="ld-t${cls ? ' ' + cls : ''}" style="${at(c, r)}"></i>`;
  const dot = (c, r) => `<i class="ld-step" style="${at(c, r)}"></i>`;
  const pieces = [
    // red (Setareh)
    pawn('red', 6, 13, 'is-hit', 'مهرهٔ قرمز ستاره روی خانهٔ شروعش'), pawn('red', 0, 8), pawn('red', 2, 12), pawn('red', 3, 12),
    // green (Kian)
    pawn('green', 4, 8), pawn('green', 2, 7, '', 'مهرهٔ سبز در ستون خانه'), pawn('green', 2, 2), pawn('green', 3, 2),
    // yellow (Niloufar)
    pawn('yellow', 8, 3), pawn('yellow', 12, 6), pawn('yellow', 11, 2), pawn('yellow', 12, 2),
    // blue (you)
    pawn('blue', 11, 11, 'is-ok', 'مهرهٔ ۱ در لانه'), pawn('blue', 8, 11, 'is-ok is-sel', 'مهرهٔ ۲'), pawn('blue', 2, 6, 'is-ok', 'مهرهٔ ۳'), pawn('blue', 11, 7, '', 'مهرهٔ ۴ در ستون خانه'),
  ].join('');
  const marks = [dot(8, 12), dot(8, 13), dot(8, 14), dot(7, 14), dot(6, 14), mark(6, 13, 'is-cap'), mark(13, 8), mark(6, 3)].join('');
  const board = (ph) => `<div class="ld-board${ph ? ' ld-board--ph' : ''}" aria-label="صفحهٔ منچ">${img('ludo-board-4', 'صفحهٔ منچ چهارنفره')}${marks}${pieces}<span class="ld-cap" style="${at(6, 13)}">${ic('swords')}</span></div>`;
  const yardN = (col, home, yard) => `<span class="ld-sum">${img(`ludo-pawn-${col}`, '')}خانه <b>${fa(home)}</b>، لانه <b>${fa(yard)}</b></span>`;
  const move = (label, sub, o = {}) => `<button class="ld-mv${o.sel ? ' is-sel' : ''}" type="button"><b>${label}</b><small>${sub}</small></button>`;
  const above = (ph) => ph
    ? `<div class="ld-roll ld-roll--ph">${img('ludo-die-6', 'تاس: ۶')}<span><b>۶ آوردید.</b> بعد از حرکت، تاس جایزه دارید.</span></div>`
    : `<div class="ld-roll">${img('ludo-die-6', 'تاس: ۶')}<span class="ld-roll__t"><b>۶ آوردید</b><small>بعد از حرکت، تاس جایزه</small></span>
<div class="ld-mvs" role="group" aria-label="حرکت‌های ممکن">${move('زدن مهرهٔ ستاره', 'مهرهٔ ۲، شش خانه + تاس جایزه', { sel: true })}${move('بیرون آوردن مهره', 'از لانه به خانهٔ شروع')}${move('جلو بردن مهرهٔ ۳', 'شش خانه')}</div></div>`;
  const { modal } = H;
  const piecesNo = [
    pawn('red', 6, 13), pawn('red', 0, 8), pawn('red', 2, 12), pawn('red', 3, 12),
    pawn('green', 4, 8), pawn('green', 2, 7), pawn('green', 2, 2), pawn('green', 3, 2),
    pawn('yellow', 8, 3), pawn('yellow', 12, 6), pawn('yellow', 11, 2), pawn('yellow', 12, 2),
    pawn('blue', 11, 11, 'is-dim', 'مهرهٔ ۱ در لانه'), pawn('blue', 12, 11, 'is-dim', 'مهرهٔ ۲ در لانه'), pawn('blue', 11, 12, 'is-dim', 'مهرهٔ ۳ در لانه'), pawn('blue', 12, 12, 'is-dim', 'مهرهٔ ۴ در لانه'),
  ].join('');
  const boardNo = (ph) => `<div class="ld-board${ph ? ' ld-board--ph' : ''}" aria-label="صفحهٔ منچ">${img('ludo-board-4', 'صفحهٔ منچ چهارنفره')}${piecesNo}</div>`;
  const tries = (n) => `<span class="ld-tries" aria-label="تلاش ${fa(n)} از ${fa(3)}">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'is-on' : ''}"></i>`).join('')}</span>`;
  const noMove = (ph) => `<div class="ld-roll${ph ? ' ld-roll--ph' : ''}">${img('ludo-die-3', 'تاس: ۳')}<span class="ld-roll__t"><b>۳ آوردید؛ حرکتی نیست</b><small>${ph ? 'نوبت به نیلوفر می‌رسد' : 'همهٔ مهره‌ها در لانه‌اند و فقط ۶ بیرونشان می‌آورد؛ نوبت به نیلوفر می‌رسد'}</small></span><span class="ld-tr">تلاش برای ۶ ${tries(2)}<small>${fa(2)} از ${fa(3)}</small></span></div>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ending = (ph) => modal('شما بردید', `<p>هر چهار مهرهٔ آبی به خانه رسید. رتبهٔ بقیه با تعداد مهره‌های رسیده است؛ در تساوی، مهره‌های بیرون از لانه و بعد خانه‌های طی‌شده.</p>
${tbl(['رتبه', 'بازیکن', 'رسیده به خانه', 'بیرون از لانه', 'خانه‌های طی‌شده'], [
      { c: [fa(1), 'شما', fa(4), '—', '—'], win: true },
      { c: [fa(2), 'نیلوفر', fa(2), fa(2), fa(61)] },
      { c: [fa(3), 'کیان', fa(2), fa(1), fa(40)] },
      { c: [fa(4), 'ستاره', fa(1), fa(2), fa(55)] },
    ])}<p class="cx-note">نیلوفر و کیان هر دو ۲ مهره رساندند؛ نیلوفر با مهرهٔ بیرون بیشتر دوم شد.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Ludo', fa: 'منچ', latin: 'Ludo', meta: ['زنده', '۴ نفر', '۳۰ ثانیه هر نوبت'],
    opps: [
      { name: 'ستاره', av: 'س', seat: 3, clock: '0:30', meta: yardN('red', 0, 2) },
      { name: 'کیان', av: 'ک', seat: 8, clock: '0:30', meta: yardN('green', 1, 2) },
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: yardN('yellow', 0, 2) },
    ],
    me: { cards: [], clock: '0:24', turn: true, note: `<span class="ld-sum ld-sum--me">${img('ludo-pawn-blue', '')}آبی، خانه <b>${fa(1)}</b>، لانه <b>${fa(1)}</b></span>`, above },
    table: (ph) => board(ph),
    status: '<b>نوبت شماست؛ ۶ آوردید.</b> سه مهره می‌توانند حرکت کنند. مهرهٔ ۲ دقیقاً روی مهرهٔ ستاره می‌نشیند و آن را به لانه برمی‌گرداند. بعد از حرکت دوباره تاس می‌ریزید؛ اگر بزنید، یک تاس جایزهٔ دیگر هم دارید.',
    pstatus: '<b>نوبت شما.</b> یکی از ۳ مهرهٔ طلایی را بزنید.',
    railCard: `<section class="cx-card"><h3>مهره‌های شما<span class="bgv-spacer"></span><span class="cx-note">آبی</span></h3><div class="gc-pills"><span class="bgv-chip">در خانه: ${fa(1)} از ${fa(4)}</span><span class="bgv-chip">در لانه: ${fa(1)}</span><span class="bgv-chip">${fa(3)} حرکت ممکن</span></div><div class="ga-rule">${ic('info')}<span>مهرهٔ لانه فقط با ۶ بیرون می‌آید و ۶ یک تاس جایزه دارد. اگر دقیقاً روی مهرهٔ حریف بنشینید، به لانه‌اش برمی‌گردد. ورود به ستون خانه با عدد دقیق است.</span></div></section>`,
    logNote: 'دور ۱۴',
    log: [[3, 'ستاره ۶ آورد و مهرهٔ تازه‌ای بیرون آورد'], [3, 'ستاره ۴ آورد و مهرهٔ دیگرش را جلو برد'], [8, 'کیان ۵ آورد و یک مهره را به ستون خانه برد'], [2, 'نیلوفر ۳ آورد و جلو رفت'], [1, 'شما ۶ آوردید؛ ۳ حرکت ممکن است']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['flag', 'ترک میز']],
    phases: [
      {
        shotTitle: 'حرکتی نیست', turnSub: 'تاس آمد ولی مهره‌ای حرکت ندارد؛ تلاش برای ۶', phone: true,
        table: (ph) => boardNo(ph),
        opps: [
          { name: 'ستاره', av: 'س', seat: 3, clock: '0:30', meta: yardN('red', 0, 2) },
          { name: 'کیان', av: 'ک', seat: 8, clock: '0:30', meta: yardN('green', 1, 2) },
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', meta: yardN('yellow', 0, 2) },
        ],
        me: { note: `<span class="ld-sum ld-sum--me">${img('ludo-pawn-blue', '')}آبی، خانه <b>${fa(0)}</b>، لانه <b>${fa(4)}</b></span>`, above: noMove },
        railCard: `<section class="cx-card"><h3>تلاش برای ۶</h3><div class="ga-rule">${ic('info')}<span>وقتی هیچ مهره‌ای بدون ۶ حرکت ندارد، سه بار تاس می‌ریزید (این شمارنده فقط با گزینهٔ «محدودیت شروع» دیده می‌شود). اگر ۶ بیاید ولی مهره‌ای نتواند برود، باز هم نوبت می‌رود.</span></div></section>`,
        status: '<b>۳ آوردید و حرکتی ندارید.</b> همهٔ مهره‌هایتان در لانه است و فقط ۶ بیرونشان می‌آورد. این تلاش دوم بود؛ یک تلاش دیگر دارید.',
        pstatus: '<b>حرکتی نیست.</b> تلاش ۲ از ۳.',
        log: [[3, 'ستاره مهرهٔ آخر شما را زد'], [1, 'شما ۲ آوردید؛ حرکتی نبود'], [1, 'شما ۳ آوردید؛ حرکتی نبود']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'رتبه‌ها و تساوی‌شکن', overlay: ending, meta: ['تمام شد', '۴ نفر', '۳۰ ثانیه هر نوبت'],
        table: (ph) => boardNo(ph).replace(/<span class="ld-p is-dim"[\s\S]*?<\/span>/g, ''),
        me: { turn: false, clock: '', above: () => '', note: `<span class="ld-sum ld-sum--me">${img('ludo-pawn-blue', '')}خانه <b>${fa(4)}</b></span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> هر چهار مهرهٔ شما به خانه رسید.',
        log: [[1, 'شما ۲ آوردید و آخرین مهره به خانه رسید'], [1, 'شما بردید']],
      },
    ],    css: `.ld-board{position:relative;direction:ltr;inline-size:var(--bw,560px);aspect-ratio:1;border-radius:10px;overflow:hidden;background:#FFF;box-shadow:0 0 0 4px #0D1A23,0 18px 34px -14px rgba(0,0,0,.8);flex:none}
.ld-board>img{display:block;inline-size:100%;block-size:100%}
.ld-board--ph{--bw:342px;border-radius:6px;box-shadow:0 0 0 3px #0D1A23}
.ld-p,.ld-t,.ld-step,.ld-cap{position:absolute;transform:translate(-50%,-50%)}
.ld-p{inline-size:calc(var(--bw,560px)/15*.74);aspect-ratio:1;border-radius:50%;box-shadow:0 2px 3px rgba(0,0,0,.55)}
.ld-p img{display:block;inline-size:100%;block-size:100%}
.ld-p.is-ok{box-shadow:0 0 0 2.5px #FAF5EC,0 0 0 5px var(--felt-gold),0 3px 6px rgba(0,0,0,.6)}
.ld-p.is-sel{box-shadow:0 0 0 2.5px #142B3B,0 0 0 6px var(--felt-gold),0 4px 8px rgba(0,0,0,.6);transform:translate(-50%,-58%) scale(1.08)}
.ld-p.is-hit{box-shadow:0 0 0 2px #fff,0 0 0 4.5px #C62828}
.ld-t{inline-size:calc(var(--bw,560px)/15*.86);aspect-ratio:1;border-radius:50%;border:2.5px dashed #142B3B;background:rgba(232,166,66,.35);box-sizing:border-box}
.ld-t.is-cap{inline-size:calc(var(--bw,560px)/15*1.02);border-color:#C62828;background:none}
.ld-step{inline-size:calc(var(--bw,560px)/15*.26);aspect-ratio:1;border-radius:50%;background:#142B3B;opacity:.55}
.ld-cap{display:grid;place-items:center;inline-size:22px;block-size:22px;border-radius:50%;background:#C62828;color:#fff;margin:calc(var(--bw,560px)/15*-.5) 0 0 calc(var(--bw,560px)/15*.5);box-shadow:0 1px 3px rgba(0,0,0,.5)}
.ld-cap .bgv-icon{inline-size:13px;block-size:13px}
.ld-board--ph .ld-cap{inline-size:16px;block-size:16px}.ld-board--ph .ld-cap .bgv-icon{inline-size:10px;block-size:10px}
.ld-board--ph .ld-p.is-ok{box-shadow:0 0 0 1.5px #FAF5EC,0 0 0 3.5px var(--felt-gold)}.ld-board--ph .ld-p.is-sel{box-shadow:0 0 0 1.5px #142B3B,0 0 0 4px var(--felt-gold)}
.ld-board--ph .ld-t{border-width:2px}
.ld-sum{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.ld-sum img{inline-size:13px;block-size:13px;border-radius:50%}.ld-sum b{color:var(--felt-ink)}
.cx-pbar .ld-sum b{color:inherit}
.ld-p.is-dim{opacity:.6}.ld-p.is-home{opacity:.35}
.ld-tr{display:grid;justify-items:center;gap:2px;margin-inline-start:auto;font-size:12px;color:var(--felt-muted);white-space:nowrap}.ld-tr small{font-size:11px}
.ld-tries{display:inline-flex;gap:5px}.ld-tries i{inline-size:12px;block-size:12px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--felt-muted)}.ld-tries i.is-on{background:var(--felt-gold);box-shadow:none}.ld-roll{display:flex;align-items:center;gap:12px;inline-size:100%;padding:8px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.ld-roll>img{inline-size:46px;block-size:46px;border-radius:9px;box-shadow:0 0 0 3px var(--felt-gold),0 6px 10px -4px rgba(0,0,0,.6);transform:rotate(-8deg)}
.ld-roll__t{display:grid;gap:2px;font-size:15px;white-space:nowrap}.ld-roll__t small{font-size:12px;color:var(--felt-muted)}
.ld-mvs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;flex:1}
.ld-mv{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:1px;justify-items:center;text-align:center;padding:6px 4px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.ld-mv b{font-size:13.5px}.ld-mv small{font-size:11px;color:#3A4F5E}
.ld-mv.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.ld-roll--ph{margin-inline:10px;inline-size:auto;padding:6px 10px;font-size:13px;line-height:1.6;gap:10px}.ld-roll--ph>img{inline-size:34px;block-size:34px;border-radius:7px;box-shadow:0 0 0 2px var(--felt-gold)}`,
    shotTitle: 'نوبت شما', turnSub: '۶ آمده؛ انتخاب مهره',
    diffs: [
      ['صفحه به جای دست', 'دست کارت ندارد؛ وسط میز صفحهٔ آمادهٔ چهارنفره (برای ۲ و ۳ نفر صفحهٔ همان تعداد) و مهره‌ها روی خانه‌ها، لانه‌ها و ستون‌های خانه'],
      ['تاس و حرکت‌ها', 'تاس آماده بالای نوار شما با سه دکمهٔ حرکت ممکن؛ روی صفحه مهره‌های قابل حرکت حلقهٔ طلایی دارند و خانهٔ مقصد خط‌چین است. حرکت انتخاب‌شده قدم‌به‌قدم نقطه‌چین می‌شود'],
      ['زدن', 'مهرهٔ حریفی که زده می‌شود حلقهٔ قرمز و نشان شمشیر دارد تا پیش از کلیک معلوم باشد چه کسی به لانه برمی‌گردد'],
      ['چیپ حریف‌ها', 'به جای تعداد کارت: رنگ مهره، تعداد مهرهٔ رسیده به خانه و مهرهٔ لانه؛ رنگ آواتار هم نزدیک رنگ مهره است'],
      ['هندسهٔ صفحه', 'مرجع، منچ BGA است (تصمیم مالک): صفحهٔ ۱۵×۱۵ با مسیر ۵۲ خانه، ستون ۵ خانه و خانهٔ مرکزی، همین تصویر. موتور فعلی ۴۰ + ۴ خانه دارد و باید به ۵۲/۵ برود (RULES.md، E1)'],
      ['قوانین', 'مثل BGA: ۶ برای بیرون آمدن و تاس جایزه (اگر حرکتی شد)، زدن با نشستن دقیق و پاداش زدن (یک تاس جایزه برای هر مهرهٔ زده‌شده؛ تنها گزینهٔ میز BGA که در نسخهٔ اول روشن است)، نشستن روی مهرهٔ خودی مجاز، ورود دقیق به ستون خانه'],
    ],
  };
}
