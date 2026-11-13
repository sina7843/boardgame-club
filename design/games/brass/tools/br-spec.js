// Spec artboards: the other phases (first Canal round, era end + income, game end, tutorial) and every action with
// its flow, cost and engine errors (rules.ts). Same parts and data as the table.
const { G, M, COLORS, ROMAN, IMG, ICONS, tileDef, incomeLevel, buyPrice, cardArt, tileArt } = require('./br-lib');
const P = require('./br-parts');
const MB = require('./br-mobile');
const { ME, H, ink, clock, costLine } = P;

const CSS = `
.br-spec{padding:32px;display:grid;gap:28px;background:var(--surface-sunken);color:var(--text)}
.br-spec h1{margin:0;font-size:28px;font-weight:900;color:var(--heading)}
.br-spec>p{margin:0;max-inline-size:980px;font-size:15px;line-height:1.8}
.br-phase{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start;padding:20px;border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-card)}
.br-phase>header{grid-column:1/-1;display:grid;gap:4px}
.br-phase h2{margin:0;font-size:20px;font-weight:900;color:var(--heading)}
.br-phase h2 span{display:inline-grid;place-items:center;inline-size:30px;block-size:30px;margin-inline-end:8px;border-radius:50%;background:var(--selected);color:var(--on-selected);font-size:15px}
.br-phase header p{margin:0;font-size:14px;line-height:1.75;color:var(--text-muted)}
.br-phase__col{display:grid;gap:12px;min-inline-size:0;align-content:start}
.br-phase .bgv-felt{padding:12px;border-radius:var(--radius-md)}
.br-notes{margin:0;padding-inline-start:20px;display:grid;gap:4px;font-size:13.5px;line-height:1.7}
.br-notes b{color:var(--heading)}
.br-notes code,.br-acard code{font-family:var(--font-mono,monospace);font-size:12px;padding:0 4px;border-radius:4px;background:var(--surface-sunken);direction:ltr;unicode-bidi:isolate}
.br-vpchip{position:absolute;transform:translate(-50%,-50%);padding:0 5px;border-radius:7px;background:#F7E7B4;color:#2B1E05;font-size:12px;font-weight:900;line-height:1.5;box-shadow:0 0 0 1.5px #2B1E05,0 2px 4px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}
.br-vpchip.is-tile{background:#FFFFFF}
.br-vpchip.is-gone{background:#E9C2BC;color:#5A1209;box-shadow:0 0 0 1.5px #5A1209}
.br-inc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.br-inc span{display:grid;justify-items:center;gap:2px;padding:6px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:12px;color:var(--text-muted)}
.br-inc b{font-size:17px;font-weight:900;color:var(--heading)}
.br-inc b.is-neg{color:var(--danger)}
.br-facedown{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius-sm);background:var(--felt-plate);color:var(--felt-ink);font-size:13.5px}
.br-facedown img{inline-size:54px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.br-tutbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);background:var(--invite-soft);color:var(--heading);font-size:14.5px;line-height:1.7}
.br-tutbar b{font-weight:900}
.br .br-hint{box-shadow:0 0 0 3px var(--pick),0 0 0 7px rgba(232,166,66,.35)!important}
.br-acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.br-acard{display:grid;gap:8px;align-content:start;padding:16px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card);font-size:13.5px;line-height:1.7}
.br-acard h3{margin:0;display:flex;align-items:center;gap:8px;font-size:17px;font-weight:900;color:var(--heading)}
.br-acard h3 small{font-size:12.5px;font-weight:700;color:var(--text-muted)}
.br-acard dl{margin:0;display:grid;grid-template-columns:96px 1fr;gap:4px 10px}
.br-acard dt{font-weight:900;color:var(--label);font-size:12.5px}
.br-acard dd{margin:0}
.br-acard .br-ic{block-size:17px}
.br-acard .br-example{padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken)}
.br-flow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px}
.br-flow>span{display:inline-flex;align-items:center;gap:6px;block-size:34px;padding-inline:12px;border-radius:var(--radius-pill);background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--line);font-weight:700}
.br-flow>i{color:var(--text-muted);font-style:normal}
`;

const thumb = (l, S, w, opts = {}) => `<div class="bgv-felt" style="inline-size:${w}px">${P.board(l, S, opts)}</div>`;

// ---------- phases ----------
function startPhase(l) {
  const S = M.start, s = S.state;
  const net = H(S, 'network');
  return `<section class="br-phase" aria-label="${l.t('دور اول دورهٔ کانال', 'First Canal round')}">
 <header><h2><span>${l.d(1)}</span>${l.t('دور اول دورهٔ کانال: یک اقدام، یک کارت رو به پایین', 'First Canal round: one action, one face-down card')}</h2><p>${l.t('فقط در دور اول کانال هر نفر ۱ اقدام دارد (موتور: actionsLeft = 1). ترتیب نوبت دور اول تصادفی است. هر کس ۸ کارت دارد و ۱ کارت رو به پایین در دورریختهٔ خودش است که هیچ‌کس نمی‌بیند؛ پایان کانال با بقیه بُر می‌خورد.', 'Only in the first Canal round does everyone have 1 action (engine: actionsLeft = 1). Round 1 order is random. Everyone holds 8 cards, and 1 face-down card sits in their own discard, seen by nobody; it is reshuffled at the end of the Canal Era.')}</p></header>
 <div class="br-phase__col">${thumb(l, S, 640)}</div>
 <div class="br-phase__col">
  <section class="br-bar br__actions"><div class="br-bar__row"><span class="br-bar__text"><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': اقدام ۱ از ۱ (دور اول کانال). نفر سوم این دور هستید.', ': action 1 of 1 (first Canal round). You play third this round.')}</span>${clock(l)}</div>${P.kinds(l, S, null)}<p class="br-bar__hint">${l.t(`کانال £۳ است و ${l.d(net.length)} خط کانال مجاز دارید: تا وقتی کاشی و مسیری روی نقشه ندارید، همهٔ نقشه شبکهٔ شماست.`, `A canal costs £3 and you have ${net.length} legal canal lines: until you have a tile or link on the board, the whole board is your network.`)}</p></section>
  <div class="bgv-felt"><div class="br-zone__head"><h2>${l.t('دست شما', 'Your hand')}</h2><small>${l.t('۸ کارت', '8 cards')}</small></div><div class="br-hand" style="--cw:74px">${s.hands[ME].map((c) => P.handCard(l, c, 'selectable', 74)).join('')}</div></div>
  <div class="br-facedown">${IMG('card-back', 'alt=""')}<span>${l.t('<b>۱ کارت رو به پایین</b> در دورریختهٔ شما؛ نه شما می‌بینید نه حریف‌ها. در پنل هر بازیکن جای «آخرین کارت» با پشت کارت نشان داده می‌شود تا اولین کارت رو.', '<b>1 face-down card</b> in your discard; neither you nor the others see it. Each panel shows a card back as «top discard» until the first face-up card.')}</span></div>
 </div>
</section>`;
}
function eraPhase(l) {
  const E = M.eraEnd, S = E.before, s = S.state, sc = E.score;
  const chips = [];
  for (const lk of sc.links) { const [x, y] = G.LINKS[lk.id]; chips.push(`<span class="br-vpchip" style="left:${x / 10}%;top:${y / 10}%">+${l.d(lk.vp)}</span>`); }
  for (const t of sc.tiles) { const [x, y] = G.SLOTS[t.loc][t.slot]; chips.push(`<span class="br-vpchip is-tile" style="left:${(x + 14) / 10}%;top:${(y - 16) / 10}%">+${l.d(t.vp)}</span>`); }
  for (const t of sc.removed) { const [x, y] = G.SLOTS[t.loc][t.slot]; chips.push(`<span class="br-vpchip is-gone" style="left:${(x - 14) / 10}%;top:${(y + 16) / 10}%">${ICONS.x.replace('bgv-icon"', 'bgv-icon" style="inline-size:10px;block-size:10px;vertical-align:-1px"')}</span>`); }
  const b = P.board(l, S).replace(/ <\/div>$/, chips.join('\n') + '\n </div>');
  return `<section class="br-phase" aria-label="${l.t('پایان دوره', 'End of an era')}">
 <header><h2><span>${l.d(2)}</span>${l.t('پایان دورهٔ کانال: درآمد، امتیاز مسیرها و کاشی‌ها، حذف سطح I', 'End of the Canal Era: income, link and tile scoring, level I removed')}</h2><p>${l.t('وقتی دسته و همهٔ دست‌ها خالی شود: اول درآمد دور پرداخت می‌شود، بعد هر مسیر به اندازهٔ آیکون‌های مسیرِ دو سرش (تاجر ۲؛ شهر = جمع آیکون کاشی‌های برگشتهٔ آن شهر) امتیاز می‌دهد، مسیرها برداشته می‌شوند و هر کاشی برگشته امتیاز خودش را می‌دهد. سپس همهٔ کاشی‌های سطح I می‌روند (برگشته یا نه)، آبجوی تاجرها پر می‌شود و هر نفر ۸ کارت تازه می‌گیرد. روی نقشه: زرد = امتیاز هر مسیر، سفید = امتیاز هر کاشی، قرمز = کاشی سطح I که حذف می‌شود.', 'When the deck and every hand are empty: income is paid, each link scores the link icons at both ends (merchant 2; town = sum of link icons on its flipped tiles), links are removed and each flipped tile scores its VP. Then every level I tile leaves (flipped or not), merchant beer is refilled and everyone draws 8 new cards. On the board: yellow = each link, white = each tile, red = level I tile removed.')}</p></header>
 <div class="br-phase__col"><div class="bgv-felt" style="inline-size:640px">${b}</div></div>
 <div class="br-phase__col">
  <section class="bgv-card" style="padding:14px;display:grid;gap:10px"><b style="font-size:16px;color:var(--heading)">${l.t('درآمد دور ۸ (پیش از امتیاز)', 'Round 8 income (before scoring)')}</b><div class="br-inc">${[0, 1, 2, 3].map((k) => `<span><img src="../assets/games/brass/character-${COLORS[k]}-front.webp" alt="" style="inline-size:28px;border-radius:50%"><b class="br-num${sc.income[k] < 0 ? ' is-neg' : ''}">${sc.income[k] < 0 ? '−' : '+'}£${l.d(Math.abs(sc.income[k]))}</b>${l.name(k)}</span>`).join('')}</div><p class="br-notes" style="padding:0;list-style:none">${l.t('درآمد منفی پرداخت می‌شود. اگر پول کم بیاید، سرور ارزان‌ترین کاشی‌های همان بازیکن را برمی‌دارد و نصف هزینه‌شان را می‌دهد؛ اگر باز کم بود هر £۱ کسری = ۱ امتیاز کمتر (زیر صفر نه). این‌ها در گزارش بازی با نام کاشی می‌آیند.', 'Negative income is paid. If money runs short, the server removes that player\'s cheapest tiles for half their cost; if still short, each missing £1 costs 1 VP (not below 0). These go into the log by tile name.')}</p></section>
  <section class="bgv-card" style="padding:14px;display:grid;gap:10px"><b style="font-size:16px;color:var(--heading)">${l.t('امتیاز دورهٔ کانال', 'Canal Era scoring')}</b>${MB.scoreRows(l, sc, s, E.after.state)}</section>
  <ul class="br-notes"><li>${l.t(`<b>${l.d(sc.links.length)}</b> مسیر و <b>${l.d(sc.tiles.length)}</b> کاشی برگشته امتیاز گرفتند؛ <b>${l.d(sc.removed.length)}</b> کاشی سطح I حذف شد.`, `<b>${sc.links.length}</b> links and <b>${sc.tiles.length}</b> flipped tiles scored; <b>${sc.removed.length}</b> level I tiles removed.`)}</li><li>${l.t('ترتیب نمایش: درآمد ← مسیرها یکی‌یکی (عدد روی مسیر، پرواز امتیاز به نشانگر) ← کاشی‌ها ← حذف سطح I ← پر شدن آبجو ← دست تازه. با «رد شدن» همه یک‌جا.', 'Order shown: income → links one by one (number on the link, VP flies to the marker) → tiles → level I removed → beer refilled → new hand. «Skip» shows all at once.')}</li><li>${l.t('پایان دورهٔ راه‌آهن همین است، بدون حذف و دست تازه؛ درآمد دور آخر بازی پرداخت نمی‌شود.', 'The end of the Rail Era is the same, without removal or a new hand; the last round\'s income is not paid.')}</li></ul>
 </div>
</section>`;
}
function endPhase(l) {
  const F = M.final, sc = F.score;
  const place = Object.fromEntries(F.placements.map((x) => [x.seat, x.place]));
  return `<section class="br-phase" aria-label="${l.t('پایان بازی', 'Game end')}">
 <header><h2><span>${l.d(3)}</span>${l.t('پایان بازی: امتیاز دورهٔ راه‌آهن و رتبه', 'Game end: Rail Era scoring and places')}</h2><p>${l.t('پس از امتیازشماری راه‌آهن بازی تمام است. برابری: سطح درآمد بالاتر، بعد پول بیشتر؛ اگر باز برابر بود رتبهٔ مشترک. صفحهٔ نتیجهٔ میز همان Table-Result دیزاین سیستم است؛ این کارت فقط ریز امتیاز برس است که در آن صفحه بالای جدول رتبه می‌نشیند.', 'After Rail scoring the game ends. Ties: higher income level, then more money; still tied = shared place. The table result page is the DS Table-Result; this card is only the Brass breakdown that sits above its ranking.')}</p></header>
 <div class="br-phase__col"><section class="bgv-card" style="padding:14px;display:grid;gap:10px"><b style="font-size:16px;color:var(--heading)">${l.t('امتیاز دورهٔ راه‌آهن و رتبهٔ نهایی', 'Rail Era scoring and final places')}</b>${MB.scoreRows(l, sc, F.before.state, F.after.state, { place })}</section></div>
 <div class="br-phase__col"><ul class="br-notes"><li>${l.t(`برنده: <b style="${ink(F.placements[0].seat)}">${l.name(F.placements[0].seat)}</b> با ${l.d(F.placements[0].score)} امتیاز. ستون آخر امتیاز کل است؛ دو ستون اول فقط آنچه همین امتیازشماری داد.`, `Winner: <b style="${ink(F.placements[0].seat)}">${l.name(F.placements[0].seat)}</b> with ${F.placements[0].score} VP. The last column is the total; the first two are what this scoring gave.`)}</li><li>${l.t('در پنل هر بازیکن نتیجه با نشان رتبه («رتبهٔ ۱») جای «در نوبت» می‌آید و دکمه‌های اقدام حذف می‌شوند.', 'Each panel shows the place badge («1st») instead of the turn status, and the action buttons are removed.')}</li><li>${l.t('کناره‌گیری: بازی بلافاصله تمام می‌شود و کناره‌گیر آخر است (resignPolicyFa).', 'Resign: the game ends at once and the resigning player is last (resignPolicyFa).')}</li></ul></div>
</section>`;
}
function tutorialPhase(l) {
  const S = M.tutorial, s = S.state;
  const sale = S.expected.sales[0];
  return `<section class="br-phase" aria-label="${l.t('آموزش تعاملی', 'Interactive tutorial')}">
 <header><h2><span>${l.d(4)}</span>${l.t('آموزش تعاملی (۲ نفر، دو دور آخر راه‌آهن)', 'Interactive tutorial (2 players, last two Rail rounds)')}</h2><p>${l.t('همان قالب میز با نوار آموزش بالای نوار اقدام. کنترل بعدی که باید زده شود حلقهٔ کهربایی تپنده دارد (کلاس <code>br-hint</code>، تست e2e روی آن کلیک می‌کند): نوع اقدام ← هدف ← کارت ← «ثبت». متن هر مرحله از tutorial.steps موتور است.', 'Same table with a tutorial strip above the action bar. The next control to press has a pulsing amber ring (class <code>br-hint</code>, which the e2e test clicks): action → target → card → «Confirm». Each step\'s text comes from the engine\'s tutorial.steps.')}</p></header>
 <div class="br-phase__col">${thumb(l, S, 640, { slots: [{ loc: sale.loc, slot: sale.slot, picked: false }], merchants: [{ m: 'oxford', space: 0 }] })}</div>
 <div class="br-phase__col">
  <div class="br-tutbar" role="status"><b>${l.t(`آموزش: مرحله ${l.d(S.step)} از ${l.d(S.steps)}`, `Tutorial: step ${S.step} of ${S.steps}`)}</b></div>
  <section class="br-bar br__actions"><div class="br-bar__row"><span class="br-bar__text">${S.instruction}</span></div>${P.kinds(l, S, null).replace('data-act="sell"', 'data-act="sell" data-hint=""').replace(/(<button class="bgv-btn bgv-btn--secondary bgv-btn--sm)(" type="button" data-act="sell")/, '$1 br-hint$2')}</section>
  <ul class="br-notes"><li>${l.t('پس از «فروش»، کاشی پنبهٔ بیرمنگام روی نقشه و در فهرست هدف حلقهٔ تپنده می‌گیرد، بعد کارت «کاونتری» در دست، بعد «ثبت».', 'After «Sell», the Birmingham cotton mill gets the pulsing ring on the map and in the target list, then the «Coventry» card in hand, then «Confirm».')}</li><li>${l.t('پایان آموزش: کارت «آموزش کامل شد» با ریز امتیاز (متن completedFa) و دکمهٔ «بازی واقعی».', 'Tutorial end: «Tutorial complete» card with the score breakdown (completedFa) and a «Real game» button.')}</li></ul>
 </div>
</section>`;
}
function matPhase(l) {
  const S = M.main;
  return `<section class="br-phase" style="grid-template-columns:360px minmax(0,1fr)" aria-label="${l.t('پنجرهٔ صفحهٔ صنعت', 'Industry mat dialog')}">
 <header><h2><span>${l.d(5)}</span>${l.t('صفحهٔ صنعت: در پنجره، از دکمهٔ + پنل', 'Industry mat: a dialog from the panel +')}</h2><p>${l.t('مثل BGA صفحهٔ بازیکن‌ها زیر نقشه نیست. پنل هر بازیکن در ریل کاشی بعدی هر صنعت (با نقطه برای تعداد آن سطح) را نشان می‌دهد و + کل صفحه را در این پنجره باز می‌کند. در گوشی همین در سربرگ «صفحهٔ من» است.', 'As on BGA, the player mats are not under the board. Each rail panel shows the next tile of each industry (dots = tiles of that level) and + opens the whole mat in this dialog. On the phone it is the «My mat» tab.')}</p></header>
 <div class="br-phase__col">${P.panel(l, S, ME)}</div>
 <div class="br-phase__col" style="padding:24px;border-radius:var(--radius-md);background:var(--scrim)">${P.matDialog(l, S, ME)}</div>
</section>`;
}
function phasesDesktop(l) {
  return `<div class="br-spec">
 <h1>${l.t('برس: فازهای غیر از نوبت عادی', 'Brass: phases other than a normal turn')}</h1>
 <p>${l.t('هر پنج بخش با همان نقشه، نوار اقدام و پنل‌های میز اصلی ساخته شده و عددها از یک بازی واقعی همین موتور است (engine/mock.mjs، بذر ۳۳).', 'All five parts use the same board, action bar and panels as the main table; every number comes from one real game of this engine (engine/mock.mjs, seed 33).')}</p>
 ${startPhase(l)}
 ${eraPhase(l)}
 ${endPhase(l)}
 ${tutorialPhase(l)}
 ${matPhase(l)}
</div>`;
}

// ---------- actions spec ----------
function actionsSpec(l) {
  const S = M.main, s = S.state;
  const ex = (type, pred = () => true) => H(S, type).find(pred);
  const exLine = (h) => h ? costLine(l, S, h).join(' · ') : '';
  const b = ex('build', (h) => h.loc === 'birmingham'), n = ex('network'), n2 = H(S, 'network').find((h) => h.links.length === 2), d = ex('develop', (h) => h.industries.length === 1), sl = ex('sell', (h) => h.merchant === 'nottingham');
  const card = (key, title, cost, flow, rules, errors, example) => `<section class="br-acard" data-act="${key}"><h3>${title}<small>${l.d(H(S, key).length)} ${l.t('گزینهٔ مجاز در این موقعیت', 'legal options here')}</small></h3><dl><dt>${l.t('هزینه', 'Cost')}</dt><dd>${cost}</dd><dt>${l.t('مراحل', 'Steps')}</dt><dd>${flow}</dd><dt>${l.t('قانون‌ها', 'Rules')}</dt><dd>${rules}</dd><dt>${l.t('خطاهای موتور', 'Engine errors')}</dt><dd>${errors}</dd></dl>${example ? `<div class="br-example">${example}</div>` : ''}</section>`;
  const code = (c) => `<code>${c}</code>`;
  return `<div class="br-spec">
 <h1>${l.t('برس: همهٔ اقدام‌ها، از rules.ts', 'Brass: every action, from rules.ts')}</h1>
 <p>${l.t('هر اقدام یک کارت دور می‌اندازد. نوبت ۲ اقدام دارد (دور اول کانال ۱). پیش از «ثبت» هیچ‌چیز به سرور نمی‌رود؛ «برگرد» یک مرحله عقب می‌برد. هزینه‌ای که کنار هر گزینه نشان داده می‌شود اجرای آزمایشی همان اقدام روی کپی وضعیت است (مثل check() موتور)، پس منبع زغال، آهن و آبجو همانی است که سرور انتخاب می‌کند.', 'Every action discards a card. A turn is 2 actions (1 in the first Canal round). Nothing is sent before «Confirm»; «Back» steps back. The cost shown beside each option is a dry run of that action on a copy of the state (like the engine\'s check()), so the coal, iron and beer source is the one the server will pick.')}</p>
 <div class="br-flow"><span>${l.t('۱ اقدام', '1 action')}</span><i>←</i><span>${l.t('۲ جا / مسیر / کاشی (روی نقشه یا فهرست)', '2 spot / link / tile (map or list)')}</span><i>←</i><span>${l.t('۳ کارت (کارت‌های مجاز حلقه دارند)', '3 card (legal cards ringed)')}</span><i>←</i><span>${l.t('۴ «ثبت»', '4 «Confirm»')}</span><i>·</i><span>${l.t('پایان نوبت: دست تا ۸ پر می‌شود', 'End of turn: hand refilled to 8')}</span><i>·</i><span>${l.t('پایان دور: ترتیب با کمترین خرج، درآمد', 'End of round: order by least spent, income')}</span></div>
 <div class="br-acts">
 ${card('build', l.t('ساخت صنعت', 'Build'), l.t('هزینهٔ کاشی بعدی صفحه + زغال و آهنِ آن (زغال: نزدیک‌ترین معدن وصل، وگرنه بازار با اتصال به تاجر، خالی £۸؛ آهن: هر ذوب‌آهن، وگرنه بازار، خالی £۶)', 'cost of the next mat tile + its coal and iron (coal: closest connected mine, else market via a merchant link, empty £8; iron: any works, else market, empty £6)'), l.t('اقدام ← خانهٔ ساخت روی نقشه (خانهٔ دونمادی با زدن دوباره صنعت را عوض می‌کند) ← کارت ← ثبت', 'action → build space on the map (a two-icon space cycles the industry on a second tap) → card → confirm'), l.t('کارت شهر: همان شهر، حتی بیرون از شبکه. کارت صنعت: داخل شبکه. خانهٔ تک‌نماد پیش از دونماد. کانال: یک کاشی شما در هر شهر. روی‌سازی: سطح بالاتر همان صنعت؛ روی حریف فقط زغال/آهن وقتی آن منبع هیچ‌جا نمانده.', 'Location card: that town, even outside the network. Industry card: inside the network. Single-icon space before two-icon. Canal: one own tile per town. Overbuild: higher level of the same industry; on an opponent only coal/iron when none of it is left anywhere.'), [code('CARD_CANNOT_BUILD'), code('USE_SINGLE_SLOT'), code('ONE_TILE_PER_TOWN'), code('WRONG_ERA_TILE'), code('OVERBUILD_LEVEL'), code('OVERBUILD_OPPONENT'), code('NO_COAL'), code('NO_MONEY')].join(' '), b ? `${l.t('نمونه', 'Example')}: ${l.ind(b.industry)} ${ROMAN[b.cost.built.level]} ${l.t('در', 'in')} ${l.town(b.loc)} — ${exLine(b)} = ${l.gbp(-b.cost.money)}` : '')}
 ${card('network', l.t('ساخت مسیر', 'Network'), l.t('کانال £۳ · ریل £۵ + ۱ زغال · دو ریل با هم £۱۵ + ۲ زغال + ۱ آبجو (آبجوی آبجوسازی، نه تاجر)', 'canal £3 · rail £5 + 1 coal · two rails £15 + 2 coal + 1 beer (brewery beer, not merchant)'), l.t('اقدام ← خط روی نقشه (کپسول خط‌چین) ← برای دو ریل خط دوم ← کارت ← ثبت', 'action → line on the map (dashed capsule) → for two rails the second line → card → confirm'), l.t('هر مسیر باید به شبکهٔ شما بچسبد (تا وقتی چیزی ندارید همه‌جا). کانال فقط در کانال، ریل فقط در راه‌آهن. ۱۴ کاشی مسیر.', 'Each link must touch your network (anywhere until you have something). Canal only in the Canal Era, rail only in the Rail Era. 14 link tiles.'), [code('NOT_IN_NETWORK'), code('WRONG_ERA_LINK'), code('LINK_TAKEN'), code('ONE_CANAL_LINK'), code('NO_LINKS_LEFT'), code('NO_COAL'), code('NO_BEER')].join(' '), n ? `${l.t('نمونه', 'Example')}: ${l.link(n.links[0])} — ${exLine(n)}${n2 ? `<br>${l.t('دو ریل', 'Two rails')}: ${n2.links.map(l.link).join(' + ')} — ${exLine(n2)}` : ''}` : '')}
 ${card('develop', l.t('توسعه', 'Develop'), l.t('هر کاشی ۱ آهن (همان قاعدهٔ آهن ساخت)', '1 iron per tile (same iron rule as building)'), l.t('اقدام ← یک یا دو صنعت روی صفحهٔ خودتان (کاشی بعدی حلقه دارد) ← کارت ← ثبت', 'action → one or two industries on your own mat (next tile is ringed) → card → confirm'), l.t('پایین‌ترین کاشی آن صنعت از صفحه حذف می‌شود. سفال I و III نماد لامپ دارند و توسعه نمی‌شوند.', 'The lowest tile of that industry leaves the mat. Pottery I and III have the lightbulb and cannot be developed.'), [code('CANNOT_DEVELOP'), code('NO_TILES_LEFT'), code('NO_MONEY')].join(' '), d ? `${l.t('نمونه', 'Example')}: ${l.ind(d.industries[0])} — ${d.cost.ironMarket < 0 ? `${l.d(1)} ${l.t('آهن از بازار', 'iron from market')} ${l.gbp(-d.cost.money)}` : exLine(d)}` : '')}
 ${card('sell', l.t('فروش', 'Sell'), l.t('بدون پول؛ هر کاشی آبجوی چاپ‌شده‌اش (۰ تا ۲): بشکهٔ همان تاجر، آبجوسازی خودتان هرجا، یا حریف وصل', 'no money; each tile its printed beer (0–2): that merchant\'s barrel, your brewery anywhere, or a connected opponent\'s'), l.t('اقدام ← کاشی کالای خودتان ← تاجر خریدار (حلقه دارد) ← کاشی‌های دیگر (اختیاری) ← کارت ← ثبت. گلاستر: انتخاب صنعت برای توسعهٔ رایگان.', 'action → your goods tile → a buying merchant (ringed) → more tiles (optional) → card → confirm. Gloucester: pick the industry for the free develop.'), l.t('کاشی‌ها برمی‌گردند و درآمد بالا می‌رود. بشکهٔ تاجر = پاداش: آکسفورد +۲ درآمد، گلاستر توسعه، شروزبری +۴، ناتینگهام +۳ امتیاز، وارینگتون +£۵.', 'Tiles flip and income rises. Merchant barrel = bonus: Oxford +2 income, Gloucester develop, Shrewsbury +4, Nottingham +3 VP, Warrington +£5.'), [code('NOT_SELLABLE'), code('NO_MERCHANT'), code('NO_BEER'), code('NO_DEVELOP_BONUS')].join(' '), sl ? `${l.t('نمونه', 'Example')}: ${l.ind('pottery')} ${l.town(sl.loc)} → ${l.loc(sl.merchant)} — ${exLine(sl)} · ${l.t('درآمد', 'income')} ${l.sd(sl.cost.incomeLevel)} · +${l.d(sl.cost.vp)} ${l.t('امتیاز', 'VP')}` : '')}
 ${card('loan', l.t('وام', 'Loan'), l.t('+£۳۰، درآمد ۳ سطح پایین (نشانگر روی بالاترین خانهٔ آن سطح)', '+£30, income 3 levels down (marker on that level\'s top space)'), l.t('اقدام ← کارت ← ثبت', 'action → card → confirm'), l.t('زیر −۱۰ ممکن نیست؛ بازپرداخت ندارد. دکمه پیش‌نمایش سطح تازه را نشان می‌دهد.', 'Not below −10; never repaid. The button previews the new level.'), code('NO_LOAN'), `${l.t('نمونه', 'Example')}: ${l.t('درآمد', 'income')} ${l.sd(incomeLevel(s.income[ME]))} → ${l.sd(incomeLevel(s.income[ME]) - 3)}`)}
 ${card('scout', l.t('پیشاهنگ', 'Scout'), l.t('۳ کارت دور', 'discard 3 cards'), l.t('اقدام ← ۳ کارت ← ثبت', 'action → 3 cards → confirm'), l.t('یک شهر آزاد و یک صنعت آزاد می‌گیرید. اگر کارت آزاد در دست دارید یا یکی از دو کپه خالی است ممکن نیست. کارت آزاد پس از استفاده به کپه برمی‌گردد.', 'Take one wild location and one wild industry. Not allowed with a wild in hand or an empty pile. A used wild goes back to its pile.'), [code('HAS_WILD'), code('NO_WILD_LEFT')].join(' '), '')}
 ${card('pass', l.t('رد کردن', 'Pass'), l.t('۱ کارت دور', 'discard 1 card'), l.t('اقدام ← کارت ← ثبت', 'action → card → confirm'), l.t('همیشه مجاز. اگر وقت نوبت تمام شود سرور برای اقدام‌های باقی رد می‌کند (اولین کارت دست).', 'Always legal. On timeout the server passes the remaining actions (first card of the hand).'), '—', '')}
 <section class="br-acard"><h3>${l.t('کناره‌گیری و چند نکته', 'Resign and notes')}</h3><ul class="br-notes"><li>${l.t('کناره‌گیری از منوی میز (DS)، نه از نوار اقدام.', 'Resign is in the table menu (DS), not the action bar.')}</li><li>${l.t('کد خطا فقط برای دکمه‌های غیرفعال و پیام «چرا نه» ترجمه می‌شود؛ قانون در رندرر تکرار نمی‌شود.', 'Error codes are only translated for disabled buttons and the «why not» message; rules are not re-implemented in the renderer.')}</li><li>${l.t(`قیمت فعلی بازار: زغال ${l.gbp(buyPrice('coal', s.coal))} (${l.d(s.coal)} مکعب)، آهن ${l.gbp(buyPrice('iron', s.iron))} (${l.d(s.iron)} مکعب).`, `Market now: coal ${l.gbp(buyPrice('coal', s.coal))} (${s.coal} cubes), iron ${l.gbp(buyPrice('iron', s.iron))} (${s.iron} cubes).`)}</li></ul></section>
 </div>
</div>`;
}

module.exports = { CSS, phasesDesktop, actionsSpec };
