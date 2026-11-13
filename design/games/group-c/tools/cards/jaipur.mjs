// Jaipur on the card-table frame (repo engine: 2 players, 55 cards, market of 5, hand limit 7, best of three rounds).
// Moment: round 1. You exchange: take diamond + gold from the market, give two leathers from your hand.
export default function (H) {
  const { img, fa, ic, btn, ibtn, backs } = H;
  const NAME = { camel: 'شتر', diamonds: 'الماس', gold: 'طلا', silver: 'نقره', cloth: 'پارچه', spice: 'ادویه', leather: 'چرم' };
  const card = (k, sel) => `<span class="jp-mk${sel ? ' is-sel' : ''}${k === 'camel' ? ' is-camel' : ''}">${img(`jaipur-${k}`, NAME[k])}</span>`;
  const tok = (t, alt) => img(`jaipur-t-${t}`, alt);
  const piles = [['diamonds-7', 'الماس', 5], ['gold-6', 'طلا', 5], ['silver-5', 'نقره', 5], ['cloth-2', 'پارچه', 4], ['spice-3', 'ادویه', 5], ['leather-4', 'چرم', 9]];
  const hand = [['diamonds'], ['leather', 1], ['leather', 1], ['cloth'], ['silver']].map(([k, s]) => ({ art: `jaipur-${k}`, alt: NAME[k], sel: !!s }));
  const herd = (n) => `<span class="jp-herd" aria-label="گله: ${fa(n)} شتر">${img('jaipur-camel', 'شتر')}<b>${fa(n)}</b></span>`;
  const table = (ph) => `<div class="jp-board">
<div class="jp-tokens" aria-label="سکه‌های کالا">${piles.map(([t, n, c]) => `<span class="jp-tok">${tok(t, `${n}: سکهٔ بالا`)}<small>${fa(c)}</small></span>`).join('')}${ph ? '' : `<span class="jp-sep"></span>${[3, 4, 5].map((b, k) => `<span class="jp-tok">${img(`jaipur-bonus-${b}`, `پاداش ${fa(b)}تایی`)}<small>${fa([6, 6, 5][k])}</small></span>`).join('')}`}</div>
<div class="jp-row"><div class="jp-market" aria-label="بازار">${card('camel')}${card('diamonds', true)}${card('gold', true)}${card('spice')}${card('camel')}</div>${ph ? '' : `<div class="gc-pile" style="--pw:84px">${img('jaipur-back', 'دسته')}<span><b>${fa(34)}</b> کارت</span></div>`}</div></div>`;
  const act = (l, sel, off) => `<button type="button" class="jp-act${sel ? ' is-sel' : ''}"${off ? ' disabled' : ''}>${l}</button>`;
  const above = (ph) => `<div class="jp-above${ph ? ' jp-above--ph' : ''}"><div class="jp-acts" role="group" aria-label="کار این نوبت">${act('یک کالا')}${act(`شترها (${fa(2)})`)}${act('معاوضه', true)}${act('فروش')}</div><div class="jp-sum"><span><b>الماس و طلا</b> ← دو چرم</span>${btn('تأیید', 'primary', 'check')}</div></div>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const sellHand = [['diamonds', 1], ['diamonds', 1], ['gold'], ['leather'], ['silver']].map(([k, s]) => ({ art: `jaipur-${k}`, alt: NAME[k], sel: !!s, dim: !s && k !== 'diamonds' }));
  const sellBar = (ph) => `<div class="jp-above${ph ? ' jp-above--ph' : ''}"><div class="jp-acts" role="group">${act('یک کالا')}${act(`شترها (${fa(2)})`)}${act('معاوضه')}${act('فروش', true)}</div><div class="jp-sum jp-sell"><span><b>${fa(2)} الماس</b><span class="jp-prev">${tok('diamonds-7', '۷')}${tok('diamonds-7', '۷')}<b>= ${fa(14)}</b></span><small>${ph ? 'پاداش از ۳ کارت' : 'الماس دست‌کم دوتایی؛ پاداش از ۳ کارت به بالاست، پس پاداش نمی‌گیرید'}</small></span>${btn(ph ? 'فروش' : `فروش، ${fa(14)} روپیه`, 'primary', 'check')}</div></div>`;
  const errBar = (ph) => `<div class="jp-above${ph ? ' jp-above--ph' : ''}"><div class="jp-acts" role="group">${act('یک کالا')}${act(`شترها (${fa(2)})`)}${act('معاوضه', true)}${act('فروش')}</div><div class="jp-sum"><span class="jp-err">${ic('info')}<span><b>تعداد برابر نیست:</b> ${fa(2)} کارت از بازار، ${fa(1)} کارت از دست</span></span>${btn('تأیید', 'primary', 'check', ' disabled')}</div><p class="jp-errs">معاوضه یعنی دست‌کم ۲ کارت، تعداد برابر، کارتی که می‌گیرید هم‌نوع کارتی که می‌دهید نباشد، و دستتان بیشتر از ۷ کارت نشود.</p></div>`;
  const roundEnd = (ph) => modal('پایان دست ۱', `<p>سه کپهٔ سکه تمام شد. سکه‌های پاداش رو شدند و نشان شتر (${fa(5)}) به گلهٔ بزرگ‌تر رسید.</p>
${tbl(['بازیکن', 'سکهٔ کالا', 'پاداش', 'شتر', 'جمع'], [
      { c: ['شما', fa(48), `${fa(3)}+${fa(5)}+${fa(9)} = ${fa(17)}`, fa(0), fa(65)], win: true },
      { c: ['نیلوفر', fa(41), `${fa(2)}+${fa(6)} = ${fa(8)}`, `${fa(5)} (گلهٔ ${fa(6)})`, fa(54)] },
    ])}<div class="jp-seal">${tok('seal-0', 'مهر')}<span><b>شما مهر اول را گرفتید.</b> اگر جمع‌ها برابر بود، هر کس نشان پاداش بیشتری داشت می‌برد و بعد هر کس سکهٔ کالای بیشتری.</span></div>`, `${btn('دست بعد', 'primary', 'next')}`);
  const gameEnd = (ph) => modal('پایان بازی: دو مهر', `<div class="jp-seal">${tok('seal-0', 'مهر')}${tok('seal-0', 'مهر')}<span><b>شما بردید.</b> اولین کسی که ${fa(2)} مهر بگیرد برنده است.</span></div>${tbl(['دست', 'شما', 'نیلوفر', 'مهر'], [{ c: [fa(1), fa(65), fa(54), 'شما'] }, { c: [fa(2), fa(48), fa(57), 'نیلوفر'] }, { c: [fa(3), fa(71), fa(60), 'شما'], win: true }])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Jaipur', fa: 'جایپور', latin: 'Jaipur', meta: ['زنده', 'دونفره', 'دست ۱ از ۳'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `${backs('jaipur-back', 5, 3)}${herd(4)}<span class="jp-rs">${fa(11)} + پاداش</span>` },
    ],
    me: { cards: hand, clock: '0:44', turn: true, note: `${herd(3)}<span class="cx-note">${fa(8)} روپیه</span>`, above },
    cardW: 90, phoneCardW: 62, cardRatio: 1.387,
    table,
    status: '<b>نوبت شماست.</b> معاوضه: الماس و طلا را از بازار برمی‌دارید و دو چرم می‌گذارید. حالا دو الماس دارید و سکه‌های ۷ هنوز سر جایشان است.',
    pstatus: '<b>نوبت شما.</b> معاوضه: الماس و طلا با دو چرم.',
    railCard: `<section class="cx-card"><h3>سکه‌ها و نشان‌ها</h3><div class="jp-score"><div><span>شما</span><span class="jp-coins">${tok('spice-5', 'ادویه ۵')}${tok('spice-3', 'ادویه ۳')}</span><b>${fa(8)}</b></div><div><span>نیلوفر</span><span class="jp-coins">${tok('cloth-5', 'پارچه ۵')}${tok('cloth-3', 'پارچه ۳')}${tok('cloth-3', 'پارچه ۳')}${img('jaipur-bonus-3', 'پاداش پنهان')}</span><b>${fa(11)}+</b></div></div><div class="gc-pills"><span class="bgv-chip">${tok('seal-0', 'نشان')} نشان: ${fa(0)} و ${fa(0)}</span><span class="bgv-chip">${tok('camel_bonus-5', 'جایزهٔ شتر')} گلهٔ بزرگ‌تر: نیلوفر</span></div><div class="ga-rule">${ic('info')}<span>الماس، طلا و نقره را دست‌کم دوتایی باید فروخت. فروش ۳ کارت به بالا سکهٔ پاداش دارد که مبلغش از حریف پنهان است.</span></div></section>`,
    logNote: `دست ${fa(1)}`,
    log: [[2, 'نیلوفر سه پارچه فروخت: ۵، ۳، ۳ و یک پاداش'], [1, 'شما دو ادویه فروختید: ۵ و ۳'], [2, 'نیلوفر شترهای بازار را برداشت (۲ شتر)'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['eye', 'سکه‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها']],
    phases: [
      {
        shotTitle: 'فروش', turnSub: 'تعداد، پیش‌نمایش سکه‌ها و پاداش', phone: true,
        me: { cards: sellHand, above: sellBar },
        table: (ph) => table(ph).replace(/ is-sel/g, ''),
        status: '<b>فروش.</b> دو الماس انتخاب کرده‌اید: دو سکهٔ ۷ می‌گیرید. الماس را یکی‌یکی نمی‌شود فروخت؛ برای پاداش باید ۳ کارت یا بیشتر بفروشید.',
        pstatus: '<b>فروش دو الماس:</b> ۱۴ روپیه.',
        log: [[2, 'نیلوفر یک ادویه برداشت'], [1, 'شما فروش را انتخاب کردید']],
      },
      {
        shotTitle: 'خطای معاوضه', turnSub: 'پیام کنار «تأیید»', phone: true, phoneOnly: true,
        me: { cards: hand.map((h, i) => ({ ...h, sel: i === 1 })), above: errBar },
        pstatus: '<b>معاوضه درست نیست.</b> تعداد برابر نیست.', status: '',
      },
      {
        shotTitle: 'پایان دست', turnSub: 'سکه‌ها، پاداش‌ها، شتر و مهر', overlay: roundEnd, meta: ['زنده', 'دونفره', 'پایان دست ۱'],
        me: { turn: false, cards: [], above: () => '', note: `${herd(2)}<span class="cx-note">${fa(65)} روپیه</span>` },
        status: '<b>دست ۱ تمام شد.</b> شما ۶۵ و نیلوفر ۵۴؛ مهر اول مال شماست.',
        log: [[2, 'نیلوفر آخرین سکهٔ طلا را گرفت'], [1, 'سه کپهٔ سکه خالی شد'], [1, 'شما مهر گرفتید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'دو مهر', overlay: gameEnd, meta: ['تمام شد', 'دونفره', 'دست ۳ از ۳'],
        me: { turn: false, clock: '', cards: [], above: () => '' }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما با دو مهر بردید.',
        log: [[1, 'دست ۳: شما ۷۱، نیلوفر ۶۰'], [1, 'شما دومین مهر را گرفتید']],
      },
    ],    css: `.jp-herd{display:inline-flex;align-items:center;gap:3px;color:var(--felt-ink)}.jp-herd img{inline-size:15px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.4)}.jp-herd b{font-weight:700}
.cx-pbar .jp-herd{color:inherit;margin-inline-end:6px}
.jp-rs{white-space:nowrap;color:var(--felt-ink);font-weight:700}
.jp-board{display:grid;justify-items:center;gap:26px}
.jp-tokens{display:flex;gap:10px;align-items:center}
.jp-tok{display:grid;justify-items:center;gap:2px;color:var(--felt-muted);font-size:11.5px}
.jp-tok img{inline-size:54px;block-size:54px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.45))}
.jp-sep{inline-size:1px;block-size:44px;background:rgba(250,245,236,.18);margin-inline:4px}
.jp-row{display:flex;align-items:center;gap:20px}
.jp-market{display:flex;gap:10px;padding:12px;border-radius:14px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.14)}
.jp-mk img{display:block;inline-size:98px;border-radius:7px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 10px 16px -8px rgba(0,0,0,.6)}
.jp-mk.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 10px 16px -8px rgba(0,0,0,.7)}
.jp-mk.is-sel{transform:translateY(-8px)}
.jp-above{display:flex;align-items:center;justify-content:center;gap:16px;inline-size:100%;margin-block-end:12px}
.jp-acts{display:flex;gap:6px}
.jp-act{all:unset;box-sizing:border-box;cursor:pointer;block-size:38px;padding-inline:12px;display:inline-flex;align-items:center;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;font-size:13.5px;font-weight:700;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.jp-act.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.jp-sum{display:flex;align-items:center;gap:10px;color:var(--felt-ink);font-size:14px}
.jp-above--ph{flex-direction:column;gap:6px;padding-inline:10px;box-sizing:border-box;margin-block-end:8px}
.jp-above--ph .jp-acts{inline-size:100%}.jp-above--ph .jp-act{flex:1;justify-content:center;padding-inline:4px;font-size:12.5px;block-size:34px}
.jp-above--ph .jp-sum{inline-size:100%;justify-content:space-between;font-size:13px}
.jp-score{display:grid;gap:8px}
.jp-score>div{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:8px;font-size:13.5px;color:var(--text)}
.jp-score b{font-size:16px;color:var(--heading)}
.jp-coins{display:flex;gap:2px}.jp-coins img{inline-size:30px;block-size:30px}
.gc-pills .bgv-chip img{inline-size:20px;block-size:20px;vertical-align:middle}
.cx-phone .jp-board{gap:14px}
.cx-phone .jp-tokens{gap:6px}.cx-phone .jp-tok img{inline-size:40px;block-size:40px}
.cx-phone .jp-market{gap:5px;padding:8px}.cx-phone .jp-mk img{inline-size:62px}
.jp-sell>span{display:grid;gap:2px}.jp-sell small{font-size:11.5px;color:var(--felt-muted)}
.jp-prev{display:inline-flex;align-items:center;gap:3px;margin-inline-start:6px}.jp-prev img{inline-size:28px;block-size:28px}.jp-prev b{color:var(--felt-gold)}
.jp-err{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;background:rgba(240,170,163,.16);color:#F4B9B2;font-size:13px}.jp-err .bgv-icon{inline-size:16px;block-size:16px}
.jp-errs{flex-basis:100%;margin:0;inline-size:100%;text-align:center;font-size:11.5px;color:var(--felt-muted)}
.jp-above:has(.jp-errs){flex-wrap:wrap}.jp-above--ph .jp-errs{flex-basis:auto}
.jp-seal{display:flex;align-items:center;gap:8px}.jp-seal img{inline-size:44px;block-size:44px}`,
    shotTitle: 'نوبت شما', turnSub: 'معاوضه با بازار',
    diffs: [
      ['چیدمان', 'بازیِ دونفره: یک حریف بالا (کارت‌های دست، گله و سکه‌ها). وسط میز بالای همه کپهٔ سکهٔ هر کالا (سکهٔ بالا رو و تعداد مانده) و سه کپهٔ پاداش؛ زیرش بازار پنج‌تایی و دسته'],
      ['چهار کار نوبت', 'بالای دست: «یک کالا»، «شترها (۲)»، «معاوضه» و «فروش». با انتخاب کار، کارت‌های بازار و دست انتخابی می‌شوند و خلاصه (الماس و طلا ← دو چرم) کنار «تأیید» می‌آید'],
      ['معاوضه', 'کارت‌های انتخاب‌شدهٔ بازار بالا می‌آیند و قاب طلایی دارند؛ از دست هم همان تعداد. شتر گله را هم می‌شود داد؛ کالایی که برمی‌دارید را نمی‌شود پس داد و شتر بازار در معاوضه گرفته نمی‌شود'],
      ['گله و سکه', 'شمار شترها کنار نوار شما و روی صندلی حریف؛ سکه‌های کالا عمومی‌اند ولی مبلغ پاداش حریف پنهان است (۱۱ + پاداش)'],
      ['ستون کنار', 'کارت سکه‌ها و نشان‌ها: سکه‌های هر نفر، نشان‌های دست، و اینکه جایزهٔ شتر فعلاً مال کیست'],
      ['قوانین', 'دونفره و بهترین از سه دست (یا یک دست) مثل موتور؛ دست با تمام شدن سه کپهٔ سکه یا کم آمدن دسته تمام می‌شود. تصویر صفحهٔ بازی در بسته فقط یک زمینهٔ زرد است و استفاده نشده'],
    ],
  };
}
