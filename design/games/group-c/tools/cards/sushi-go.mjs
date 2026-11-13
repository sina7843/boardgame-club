// Sushi Go! on the card-table frame (repo engine: 2–5 players, 4p = 8-card hands, three rounds, simultaneous picks).
// Moment: round 2, turn 4 — 5 cards left in each hand. Niloufar and Reza have picked; you are picking squid onto your wasabi.
export default function (H) {
  const { img, fa, ic, btn, ibtn, ART } = H;
  const NAME = { tempura: 'تمپورا', sashimi: 'ساشیمی', dumpling: 'دامپلینگ', maki2: 'ماکی ۲', maki3: 'ماکی ۳', squidnigiri: 'نیگیری ماهی مرکب', eggnigiri: 'نیگیری تخم‌مرغ', pudding: 'پودینگ', wasabi: 'واسابی', chopsticks: 'چاپستیک' };
  const c = (k, cls = '') => img(`sushi-go-${k}`, NAME[k], cls);
  const pud = (n) => `<span class="sg-pud" aria-label="${fa(n)} پودینگ">${img('sushi-go-pudding-icon', 'پودینگ')}<b>${fa(n)}</b></span>`;
  const tag = (ok) => `<span class="gc-tag${ok ? '' : ' gc-tag--soft'}">${ok ? 'برداشت' : 'در فکر'}</span>`;
  const hand = ['tempura', 'squidnigiri', 'maki2', 'pudding', 'sashimi'].map((k) => ({ art: `sushi-go-${k}`, alt: NAME[k], sel: k === 'squidnigiri', ok: k === 'tempura' }));
  const tab = (who, seat, cards, info, cls = '') => `<div class="sg-tab ${cls}"><header><i style="background:var(--seat-${seat})"></i><b>${who}</b><span>${info}</span></header><div class="sg-tab__cards">${cards}</div></div>`;
  const table = (ph) => `<div class="sg-board">
<div class="sg-opps">${tab('نیلوفر', 2, c('sashimi') + c('sashimi') + c('dumpling'), `${pud(2)}`)}${tab('رضا', 6, c('maki2') + c('chopsticks') + c('eggnigiri'), `ماکی ${fa(2)} ${pud(0)}`)}${tab('سارا', 4, c('dumpling') + c('dumpling') + c('pudding'), `${pud(2)}`)}</div>
<div class="sg-pass">${ic('repeat')}<span>${ph ? `${fa(4)} کارت باقی به نیلوفر می‌رسد` : `بعد از انتخاب، ${fa(4)} کارت باقی‌مانده به نیلوفر می‌رسد و دست سارا به شما`}</span></div>
${tab('میز شما', 1, `<span class="sg-wasabi">${c('wasabi')}<span class="sg-drop">${ph ? '×۳' : 'نیگیری بعدی ×۳'}</span></span>${c('tempura')}${c('maki3')}`, `ماکی ${fa(3)} ${pud(1)}`, 'is-me')}</div>`;
  const bar = (ph) => `<div class="sg-bar${ph ? ' sg-bar--ph' : ''}"><span>${ph ? '' : 'انتخاب: '}<b>ماهی مرکب روی واسابی</b><small>${fa(3)} × ${fa(3)} = ${fa(9)} امتیاز</small></span>${btn(ph ? 'بردار' : 'بردار و رد کن', 'primary', 'check')}</div>`;
  const { modal } = H;
  const tblS = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((cc, k) => `<td${k ? ' class="n"' : ''}>${cc}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const chopT = (ph) => `<div class="sg-board"><div class="sg-opps">${tab('نیلوفر', 2, c('sashimi') + c('sashimi') + c('dumpling'), `${pud(2)}`)}${tab('رضا', 6, c('maki2') + c('eggnigiri'), `ماکی ${fa(2)} ${pud(0)}`)}${tab('سارا', 4, c('dumpling') + c('dumpling') + c('pudding'), `${pud(2)}`)}</div>
${tab('میز شما', 1, `<span class="sg-wasabi">${c('wasabi')}<span class="sg-drop">${ph ? '×۳' : 'نیگیری بعدی ×۳'}</span></span>${c('tempura')}${c('maki3')}<span class="sg-chop is-on">${c('chopsticks')}<span class="sg-drop">${ph ? 'روشن' : 'دو کارت این نوبت'}</span></span>`, `ماکی ${fa(3)} ${pud(1)}`, 'is-me')}</div>`;
  const chopHand = ['tempura', 'squidnigiri', 'maki2', 'pudding', 'sashimi'].map((k) => ({ html: `<span class="sg-ord">${c(k)}${k === 'squidnigiri' ? '<b>۱</b>' : k === 'tempura' ? '<b>۲</b>' : ''}</span>`, alt: NAME[k], sel: k === 'squidnigiri' || k === 'tempura' }));
  const chopBar = (ph) => `<div class="sg-bar${ph ? ' sg-bar--ph' : ''}"><button type="button" class="sg-tog is-on" aria-pressed="true">${ic('hand')}${ph ? 'چاپستیک' : 'دو کارت با چاپستیک'}</button><span><b>۱: ماهی مرکب روی واسابی، ۲: تمپورا</b>${ph ? '' : `<small>چاپستیک به دستی که رد می‌کنید برمی‌گردد</small>`}</span>${btn(ph ? 'بردار' : 'برداشتن هر دو', 'primary', 'check')}</div>`;
  const revealT = (ph) => `<div class="sg-board"><div class="sg-opps">${tab('نیلوفر', 2, c('sashimi') + c('dumpling') + `<span class="sg-new">${c('sashimi')}</span>`, `${pud(2)}`)}${tab('رضا', 6, c('maki2') + c('eggnigiri') + `<span class="sg-new">${c('maki3')}</span>`, `ماکی ${fa(5)} ${pud(0)}`)}${tab('سارا', 4, c('dumpling') + c('pudding') + `<span class="sg-new">${c('dumpling')}</span>`, `${pud(2)}`)}</div>
<div class="sg-pass is-on">${ic('repeat')}<span>کارت‌ها با هم رو شد؛ دست‌ها یکی به چپ رفت: دست شما به نیلوفر، دست سارا به شما</span></div>
${tab('میز شما', 1, `<span class="sg-wasabi sg-new">${c('wasabi')}${c('squidnigiri', 'sg-on')}</span>${c('tempura')}${c('maki3')}`, `ماکی ${fa(3)} ${pud(1)}`, 'is-me')}</div>`;
  const roundEnd = (ph) => modal('پایان دور ۲', `<p>همهٔ کارت‌ها برداشته شد. امتیاز این دور:</p>${tblS(['بازیکن', 'ماکی', 'ست‌ها', 'نیگیری', 'این دور', 'جمع'], [
      { c: ['شما', `${fa(6)} (${fa(5)} آیکون)`, `تمپورا ${fa(5)}`, `${fa(9)}`, `${fa(20)}+`, fa(41)], win: true },
      { c: ['رضا', `${fa(3)} (${fa(4)} آیکون)`, '—', fa(1), `${fa(4)}+`, fa(28)] },
      { c: ['نیلوفر', '—', `ساشیمی ${fa(10)}، دامپلینگ ${fa(1)}`, '—', `${fa(11)}+`, fa(29)] },
      { c: ['سارا', '—', `دامپلینگ ${fa(6)}`, fa(2), `${fa(8)}+`, fa(23)] },
    ])}<p class="cx-note">ماکی: بیشترین ${fa(6)}، دومی ${fa(3)}؛ مساوی‌ها تقسیم می‌کنند. واسابی خالی و چاپستیک امتیاز ندارند. پودینگ‌ها تا آخر بازی می‌مانند.</p>`, `${btn('دور ۳', 'primary', 'next')}`);
  const gameEnd = (ph) => modal('پایان بازی', `<p>سه دور تمام شد و پودینگ‌ها حساب شد: بیشترین ${fa(6)}+ و کمترین ${fa(6)}−.</p>${tblS(['رتبه', 'بازیکن', 'سه دور', 'پودینگ', 'جمع'], [{ c: [fa(1), 'شما', fa(58), `${fa(2)}: ${fa(0)}`, fa(58)], win: true }, { c: [fa(2), 'نیلوفر', fa(46), `${fa(4)}: ${fa(6)}+`, fa(52)] }, { c: [fa(3), 'سارا', fa(46), `${fa(4)}: ${fa(6)}+`, fa(52)] }, { c: [fa(4), 'رضا', fa(44), `${fa(0)}: ${fa(6)}−`, fa(38)] }])}<p class="cx-note">نیلوفر و سارا هم امتیازند و پودینگ برابر دارند؛ رتبهٔ مشترک. در تساوی، پودینگ بیشتر بالاتر است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'SushiGo', fa: 'سوشی گو', latin: 'Sushi Go!', meta: ['زنده', '۴ نفر', 'دور ۲ از ۳'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:20', meta: `<span class="sg-sc">${fa(18)}</span>${pud(2)}${tag(true)}` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:20', meta: `<span class="sg-sc">${fa(24)}</span>${pud(0)}${tag(true)}` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:14', turn: true, meta: `<span class="sg-sc">${fa(15)}</span>${pud(2)}${tag(false)}` },
    ],
    me: { cards: hand, clock: '0:16', turn: true, note: `<span class="cx-note">${fa(21)} امتیاز</span>`, above: (ph) => bar(ph) },
    cardW: 92, phoneCardW: 64, cardRatio: 1.45,
    table,
    status: '<b>همه هم‌زمان برمی‌دارند.</b> یک کارت از دستتان بردارید؛ بقیه به نیلوفر می‌رسد. ماهی مرکب روی واسابی شما ۹ امتیاز است.',
    pstatus: '<b>انتخاب هم‌زمان.</b> یک کارت بردارید و بقیه را رد کنید.',
    railCard: `<section class="cx-card"><h3>این دور</h3><div class="gc-pills"><span class="bgv-chip">دور ${fa(2)} از ${fa(3)}</span><span class="bgv-chip">نوبت ${fa(4)} از ${fa(8)}</span></div><dl class="sg-race"><dt>ماکی</dt><dd>شما ${fa(3)}، رضا ${fa(2)}، بقیه ${fa(0)}</dd><dt>پودینگ</dt><dd>نیلوفر و سارا ${fa(2)}، شما ${fa(1)}، رضا ${fa(0)}</dd><dt>امتیاز</dt><dd>رضا ${fa(24)}، شما ${fa(21)}، نیلوفر ${fa(18)}، سارا ${fa(15)}</dd></dl><div class="ga-rule">${ic('info')}<span>رضا چاپستیک دارد و در یکی از نوبت‌های بعد می‌تواند دو کارت بردارد. نیلوفر دو ساشیمی دارد؛ ساشیمی دست شما سومی اوست.</span></div></section>`,
    logNote: `دور ${fa(2)}، نوبت ${fa(4)}`,
    log: [[1, 'نوبت ۳: شما ماکی ۳ برداشتید'], [6, 'رضا نیگیری تخم‌مرغ برداشت'], [4, 'سارا پودینگ برداشت'], [2, 'نیلوفر دومین ساشیمی را برداشت'], [2, 'نوبت ۴: نیلوفر و رضا برداشتند'], [1, 'منتظر شما و سارا']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'امتیاز کارت‌ها', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['more', 'گزینه‌ها'], ['list', 'امتیازها'], ['chat', 'گفت‌وگو'], ['flag', 'ترک میز']],
    phases: [
      {
        shotTitle: 'چاپستیک', turnSub: 'دو کارت در یک نوبت', table: chopT, phone: true,
        me: { cards: chopHand, above: chopBar },
        status: '<b>چاپستیک روی میز شماست.</b> «دو کارت با چاپستیک» را روشن کردید: اول ماهی مرکب روی واسابی (۹) و بعد تمپورا که جفت تمپورا را کامل می‌کند. چاپستیک به دستی که رد می‌کنید برمی‌گردد.',
        pstatus: '<b>چاپستیک:</b> دو کارت.',
        log: [[1, 'نوبت ۳: شما چاپستیک برداشتید'], [1, 'نوبت ۴: چاپستیک را روشن کردید']],
      },
      {
        shotTitle: 'رو شدن هم‌زمان', turnSub: 'کارت‌های انتخابی و دست به دست شدن', table: revealT,
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:20', meta: `<span class="sg-sc">${fa(18)}</span>${pud(2)}` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:20', meta: `<span class="sg-sc">${fa(24)}</span>${pud(0)}` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:20', meta: `<span class="sg-sc">${fa(15)}</span>${pud(2)}` },
        ],
        me: { cards: ['dumpling', 'eggnigiri', 'maki2', 'tempura'].map((k) => ({ art: `sushi-go-${k}`, alt: NAME[k] })), above: () => '' },
        status: '<b>همه برداشتند و کارت‌ها با هم رو شد.</b> کارت تازهٔ هر نفر قاب طلایی دارد. دست سارا (۴ کارت) حالا دست شماست.',
        pstatus: '<b>رو شد.</b> دست سارا به شما رسید.',
        log: [[1, 'شما ماهی مرکب روی واسابی گذاشتید'], [2, 'نیلوفر ساشیمی'], [6, 'رضا ماکی ۳'], [4, 'سارا دامپلینگ'], [1, 'دست‌ها رد شد']],
      },
      {
        shotTitle: 'پایان دور', turnSub: 'ماکی، ست‌ها و نیگیری', overlay: roundEnd,
        me: { cards: [], turn: false, clock: '', above: () => '', note: `<span class="cx-note">${fa(41)} امتیاز</span>` },
        status: '<b>دور ۲ تمام شد.</b> شما ۲۰ امتیاز گرفتید.',
        log: [[1, 'آخرین کارت دور برداشته شد'], [1, 'دور ۲: شما ۲۰ امتیاز']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'پودینگ و تساوی‌شکن', phone: true, phoneOnly: true, overlay: gameEnd, meta: ['تمام شد', '۴ نفر', 'دور ۳ از ۳'],
        me: { cards: [], turn: false, clock: '', above: () => '' },
        pstatus: '<b>بازی تمام شد.</b> شما بردید.', status: '',
      },
    ],    css: `.sg-sc{font-weight:700;color:var(--felt-ink)}
.sg-pud{display:inline-flex;align-items:center;gap:2px}.sg-pud img{inline-size:18px;block-size:18px}.sg-pud b{color:var(--felt-ink);font-weight:700}
.gc-seat .gc-tag{white-space:nowrap;padding-inline:7px;font-size:11.5px}
.sg-chop{position:relative;display:inline-block}.sg-chop.is-on img{box-shadow:0 0 0 3px var(--felt-gold)}
.sg-ord{position:relative;display:block}.sg-ord>b{position:absolute;inset-block-start:-10px;inset-inline-start:-6px;display:grid;place-items:center;inline-size:22px;block-size:22px;border-radius:50%;background:var(--felt-gold);color:#142B3B;font-size:13px}
.sg-tog{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:5px;block-size:38px;padding-inline:12px;border-radius:999px;font-weight:800;font-size:13px;box-shadow:inset 0 0 0 2px var(--felt-gold);color:var(--felt-gold);white-space:nowrap}
.sg-tog.is-on{background:var(--felt-gold);color:#142B3B}.sg-tog .bgv-icon{inline-size:16px;block-size:16px}
.sg-new img{box-shadow:0 0 0 3px var(--felt-gold)!important}
.sg-pass.is-on{color:var(--felt-gold)}.sg-board{display:grid;gap:12px;justify-items:center;inline-size:100%}
.sg-opps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;inline-size:100%}
.sg-tab{display:grid;gap:6px;padding:8px 10px 10px;border-radius:var(--radius-md);background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)}
.sg-tab header{display:flex;align-items:center;gap:6px;color:var(--felt-ink);font-size:13px}.sg-tab header i{inline-size:8px;block-size:8px;border-radius:50%}
.sg-tab header span{margin-inline-start:auto;display:inline-flex;align-items:center;gap:8px;color:var(--felt-muted);font-size:12.5px}
.sg-tab__cards{display:flex;gap:6px;justify-content:center}
.sg-tab__cards img{inline-size:58px;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.25),0 6px 10px -6px rgba(0,0,0,.6)}
.sg-tab.is-me{inline-size:min(100%,460px);background:url(${ART['sushi-go-mat']}) center/cover;box-shadow:inset 0 0 0 2px rgba(232,166,66,.7);padding-block-end:12px}
.sg-tab.is-me header{background:rgba(20,43,59,.82);margin:-8px -10px 0;padding:6px 10px;border-radius:var(--radius-md) var(--radius-md) 0 0}
.sg-tab.is-me .sg-tab__cards{gap:10px}.sg-tab.is-me .sg-tab__cards img{inline-size:72px}
.sg-wasabi{position:relative;display:block}
.sg-wasabi img{box-shadow:0 0 0 3px var(--felt-gold),0 6px 10px -6px rgba(0,0,0,.6)!important}
.sg-drop{position:absolute;inset-inline:-4px;inset-block-end:-8px;text-align:center;font-size:11px;font-weight:700;padding:2px 4px;border-radius:6px;background:var(--felt-gold);color:#142B3B;white-space:nowrap}
.sg-pass{display:flex;align-items:center;gap:6px;color:var(--felt-muted);font-size:12.5px}.sg-pass .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold)}
.sg-bar{display:flex;align-items:center;justify-content:center;gap:14px;inline-size:100%;margin-block-end:14px}
.sg-bar>span{display:grid;color:var(--felt-ink);font-size:14px}.sg-bar small{color:var(--felt-muted);font-size:12px}
.sg-bar--ph{padding-inline:10px;box-sizing:border-box;justify-content:space-between;margin-block-end:10px}.sg-bar--ph>span{font-size:13px}
.sg-race{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13.5px;color:var(--text)}.sg-race dt{font-weight:700;color:var(--heading)}.sg-race dd{margin:0}
.cx-phone .sg-board{gap:8px;padding-inline:8px;box-sizing:border-box}
.cx-phone .sg-opps{gap:6px}
.cx-phone .sg-tab{padding:6px 6px 8px;gap:4px}
.cx-phone .sg-tab header{font-size:11.5px;gap:4px}.cx-phone .sg-tab header span{font-size:11px;gap:4px}
.cx-phone .sg-tab__cards{gap:3px}.cx-phone .sg-tab__cards img{inline-size:34px;border-radius:3px}
.cx-phone .sg-tab.is-me .sg-tab__cards img{inline-size:50px}.cx-phone .sg-tab.is-me{inline-size:100%}
.cx-phone .sg-pud img{inline-size:15px;block-size:15px}
.cx-phone .sg-pass{font-size:11.5px}`,
    shotTitle: 'برداشتن و رد کردن', turnSub: 'دور ۲، نوبت ۴',
    diffs: [
      ['چیدمان', 'وسط میز سفرهٔ هر بازیکن (کارت‌هایی که این دور برداشته)؛ سه حریف بالا کوچک‌تر، سفرهٔ شما روی حصیر و بزرگ‌تر. دست شما پایین'],
      ['برداشتن هم‌زمان', 'نوبتی نیست؛ ساعت همه می‌چرخد. یک کارت را انتخاب و «بردار و رد کن» را می‌زنید؛ روی صندلی‌ها «برداشت» یا «در فکر» و کارت‌ها تا انتخاب همه پنهان‌اند'],
      ['رد کردن دست', 'زیر سفرهٔ حریف‌ها نوشته شده دست شما به چه کسی می‌رسد و دست چه کسی به شما؛ جهت در هر سه دور یکی است'],
      ['ترکیب‌ها', 'واسابی خالی با حاشیهٔ طلایی و برچسب «نیگیری بعدی ×۳»؛ بالای دست امتیاز انتخاب (۳ × ۳ = ۹). تمپورای دوم هم کمی بالا آمده چون جفت را کامل می‌کند'],
      ['دور و پودینگ', 'گیم‌بار و ستون کنار: دور ۲ از ۳ و نوبت ۴ از ۸؛ رقابت ماکی و شمار پودینگ هر نفر روی صندلی و در کارت کنار، چون پودینگ تا آخر بازی می‌ماند'],
      ['قوانین', '۲ تا ۵ نفر مثل موتور (چهارنفره ۸ کارت در هر دست). تصویر کارت‌ها همان کارت‌های اصلی با نوشتهٔ انگلیسی است؛ اسم فارسی در متن جایگزین و راهنما'],
    ],
  };
}
