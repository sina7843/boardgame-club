// HTML parts of the Brass table (desktop and phone), BGA layout. Every number comes from work/mock.json (engine-checked).
const { G, M, INDUSTRIES, GOODS, IND_ART, ROMAN, COLORS, SEATS, LOC, nodes, tileDef, incomeLevel, buyPrice, at, IMG, cardArt, tileArt, ICONS } = require('./br-lib');

const ME = 0;
const seatStyle = (k) => `--pc:var(--br-${COLORS[k]});--seat-c:var(--br-${COLORS[k]})`;
const ink = (k) => `color:var(--br-${COLORS[k]}-ink)`;
const linksLeft = (s, k) => 14 - Object.values(s.links).filter((o) => o === k).length;
const MERCH_ART = (id) => { const t = M.merchantTiles.find((x) => x.id === id); return !t.goods.length ? 'merchant-blank' : t.goods.length === 3 ? 'merchant-all' : 'merchant-' + t.goods[0]; };
const RES = { coal: 'coal-cube', iron: 'iron-cube', brewery: 'beer-barrel' };

// engine error code -> sentence (the renderer only translates codes)
function reason(l, code) {
  const T = {
    NO_LOAN: ['درآمد زیر −۱۰ می‌رود', 'Income would drop below −10'], HAS_WILD: ['کارت آزاد در دست دارید', 'You hold a wild card'],
    NO_WILD_LEFT: ['کپهٔ کارت آزاد خالی است', 'A wild pile is empty'], NO_COAL: ['زغال در دسترس نیست', 'No coal available'],
    NO_BEER: ['آبجو در دسترس نیست', 'No beer available'], NO_MONEY: ['پول کافی ندارید', 'Not enough money'],
    NOT_IN_NETWORK: ['بیرون از شبکهٔ شما', 'Outside your network'], ONE_TILE_PER_TOWN: ['در دورهٔ کانال یک کاشی در هر شهر', 'One tile per town in the Canal Era'],
    WRONG_ERA_TILE: ['این سطح در این دوره ساخته نمی‌شود', 'This level cannot be built in this era'], CANNOT_DEVELOP: ['نماد لامپ: توسعه‌ناپذیر', 'Lightbulb: cannot be developed'],
    NO_SELL: ['کالای فروختنی وصل به تاجر ندارید', 'No goods connected to a buying merchant']
  }[code] || [code, code];
  return l.t(T[0], T[1]);
}

// ---------------- shell ----------------
function gamebar(l, mobile = false) {
  const meta = mobile
    ? `<span class="bgv-gamebar__mi is-first">${l.t('نوبتی', 'Turn-based')}</span><span class="bgv-gamebar__mi">${l.t('۲۴ ساعت هر نوبت', '24h per turn')}</span>`
    : `<span class="bgv-gamebar__mi is-first">${l.t('نوبتی', 'Turn-based')}</span><span class="bgv-gamebar__mi">${l.t('۲۴ ساعت هر نوبت', '24h per turn')}</span><span class="bgv-gamebar__mi">${l.t('۴ نفر', '4 players')}</span><span class="bgv-gamebar__mi">${l.t('رتبه‌ای', 'Ranked')}</span>`;
  return `<header class="bgv-gamebar" dir="${l.dir}"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('بازگشت به میزها', 'Back to tables')}">${ICONS.back}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">${l.t('برس: بیرمنگام', 'Brass: Birmingham')}${mobile || !l.fa ? '' : '<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">Brass: Birmingham</span>'}</span><span class="bgv-gamebar__meta">${meta}</span></div>${mobile ? '' : `<div class="br-lang" role="group" aria-label="${l.t('زبان بازی', 'Game language')}"><button type="button" aria-pressed="${l.fa}">فا</button><button type="button" aria-pressed="${!l.fa}">EN</button></div><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('قوانین برس', 'Brass rules')}">${ICONS.book}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-iconbtn-count" type="button" aria-label="${l.t('گفت‌وگوی میز، ۲ پیام تازه', 'Table chat, 2 new')}">${ICONS.chat}<span class="bgv-badge bgv-badge--count">${l.d(2)}</span></button>${mobile ? `<button class="bgv-btn bgv-btn--leave bgv-btn--icon" type="button" aria-label="${l.t('ترک میز', 'Leave table')}">${ICONS.leave}</button>` : `<button class="bgv-btn bgv-btn--leave bgv-btn--sm" type="button">${ICONS.leave.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}${l.t('ترک میز', 'Leave')}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('گزینه‌های میز', 'Table options')}">${ICONS.more}</button></header>`;
}
const clock = (l, chip = true) => `<span class="bgv-clock${chip ? ' bgv-clock--chip' : ''}" data-state="calm" style="--p:0.875;" role="timer" aria-label="${l.t('زمان نوبت شما', 'Your turn time')}"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">${l.t('۲۱ ساعت', '21h')}</span></span>`;

// ---------------- rail ----------------
function dashboard(l, P) {
  const s = P.state;
  const rounds = 8; // 4 players: 8 rounds per era (64 cards)
  const era = s.era === 'canal';
  return `<section class="bgv-card br-dash" aria-label="${l.t('وضعیت بازی', 'Game state')}">
  <div class="br-dash__tools"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('راهنمای بازیکن', 'Player aid')}">${ICONS.book}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('تنظیمات میز', 'Table settings')}">${ICONS.gear}</button></div>
  <div class="br-dash__row"><span class="br-era">${IMG(`link-grey-${era ? 'canal' : 'rail'}`, 'alt=""')}<span>${era ? l.t('دورهٔ کانال', 'Canal Era') : l.t('دورهٔ راه‌آهن', 'Rail Era')}<br><small>${l.t(`دور ${l.d(s.round)} از ${l.d(rounds)}`, `Round ${s.round} of ${rounds}`)}</small></span></span>
   <span class="br-stat" title="${l.t('دستهٔ کشیدنی', 'Draw deck')}">${IMG('card-back', 'alt=""')}<b class="br-num">${l.d(s.deck.length)}</b></span>
   <span class="br-stat" title="${l.t('قیمت زغال بازار', 'Coal market price')}">${IMG('coal-cube', 'alt=""')}${l.gbp(buyPrice('coal', s.coal))}</span>
   <span class="br-stat" title="${l.t('قیمت آهن بازار', 'Iron market price')}">${IMG('iron-cube', 'alt=""')}${l.gbp(buyPrice('iron', s.iron))}</span></div>
 </section>`;
}
function panel(l, P, k) {
  const s = P.state, v = P.view;
  const you = k === ME, turn = k === v.current;
  const lvl = incomeLevel(s.income[k]);
  const pos = s.order.indexOf(k) + 1;
  const status = turn ? `<span>${l.t(`در نوبت · اقدام ${l.d(3 - s.actionsLeft)} از ۲`, `Playing · action ${3 - s.actionsLeft} of 2`)}</span>` : s.order.indexOf(k) < s.order.indexOf(v.current) ? `<span class="bgv-pstate bgv-pstate--done">${ICONS.check}${l.t('نوبتش تمام شد', 'Done this round')}</span>` : `<span>${l.t(`نفر ${l.d(pos)} این دور`, `Plays ${pos}${['st', 'nd', 'rd', 'th'][pos - 1]} this round`)}</span>`;
  const disc = v.discardTop[k];
  return ` <div class="bgv-pcard br-panel ${you ? 'br-pl--me is-you' : 'br-pl'}${turn ? ' is-turn' : ''}" data-seat="${k}" data-flip-anchor="seat-${k}" style="${seatStyle(k)}${turn ? ';--clock-c:var(--clock-calm)' : ''}" role="button" tabindex="0" aria-label="${l.name(k)}${you ? l.t('، شما', ', you') : ''}">
  <div class="br-panel__head">${IMG(`character-${COLORS[k]}-front`, `class="br-panel__char" alt=""`)}<div class="br-panel__id"><b style="${ink(k)}">${l.name(k)}<span class="bgv-league bgv-league--${SEATS[k].league[0]}">${l.t(SEATS[k].league[1], SEATS[k].league[2])}</span></b><small>${status}</small></div>${disc != null ? IMG(cardArt(disc), `class="br-disc" data-flip="card-${disc}" alt="${l.t('آخرین کارت دورریخته', 'Top discard')}: ${l.card(disc)}" title="${l.t('آخرین کارت دورریخته', 'Top discard')}: ${l.card(disc)}"`) : ''}</div>
  <div class="br-panel__row"><span class="br-vp" title="${l.t('امتیاز پیروزی', 'Victory points')}"><b class="br-num">${l.d(s.vp[k])}</b><small>${l.t('امتیاز', 'VP')}</small></span>
   <span class="br-box"><span class="br-box__v">${IMG('coin-1', 'class="br-ic" alt=""')}${l.gbp(s.money[k])}</span><small>${l.t('پول', 'Money')}</small></span>
   <span class="br-box${lvl < 0 ? ' is-neg' : ''}" title="${l.t(`خانهٔ ${l.d(s.income[k])} مسیر پیشرفت`, `Progress space ${s.income[k]}`)}"><span class="br-box__v">${IMG('income-' + COLORS[k], 'class="br-ic" alt=""')}<b class="br-num">${l.sd(lvl)}</b></span><small>${l.t('درآمد', 'Income')}</small></span>
   <span class="br-box" title="${l.t('خرج این دور؛ کمترین خرج زودتر بازی می‌کند', 'Spent this round; least spent plays first')}"><span class="br-box__v">${l.gbp(s.spent[k])}</span><small>${l.t('خرج دور', 'Spent')}</small></span></div>
  <div class="br-panel__row2"><span class="br-stat" title="${l.t('کارت در دست', 'Cards in hand')}">${IMG('card-back', 'alt=""')}<b class="br-num">${l.d(v.handCounts[k])}</b></span><span class="br-stat" title="${l.t('کاشی مسیر باقی', 'Link tiles left')}">${IMG(`link-${COLORS[k]}-${s.era === 'canal' ? 'canal' : 'rail'}`, 'alt=""')}<b class="br-num">${l.d(linksLeft(s, k))}</b></span><span class="br-stat" title="${l.t('کاشی صنعت روی نقشه', 'Industry tiles on the map')}">${IMG(tileArt('cotton', 1, k), 'alt=""')}<b class="br-num">${l.d(Object.values(s.board).flat().filter((t) => t && t.owner === k).length)}</b></span></div>
  ${incomeTrack(l, s, k)}
  ${nextTiles(l, s, k)}
 </div>`;
}
// BGA panel row: the income levels around the marker (marker on the current level)
function incomeTrack(l, s, k) {
  const lvl = incomeLevel(s.income[k]);
  const from = Math.max(-10, Math.min(30 - 6, lvl - 3));
  return `<div class="br-itrack" role="img" aria-label="${l.t('مسیر درآمد', 'Income track')}: ${l.sd(lvl)}">${Array.from({ length: 7 }, (_, i) => from + i).map((v) => v === lvl ? `<span class="br-itrack__c is-on">${IMG('income-' + COLORS[k], 'alt=""')}<b class="br-num">${l.sd(v)}</b></span>` : `<span class="br-itrack__c"><b class="br-num">${l.sd(v)}</b></span>`).join('')}</div>`;
}
// BGA panel row: the next tile of each industry (level shown on the tile), dots = tiles of that level left, + opens the mat
function nextTiles(l, s, k) {
  const cells = INDUSTRIES.map((ind) => {
    const stack = M.stack[ind], taken = s.mat[k][ind], t = stack[taken];
    if (!t) return `<span class="br-ntile is-empty" title="${l.ind(ind)}: ${l.t('تمام شد', 'none left')}"></span>`;
    const sameLeft = stack.slice(taken).filter((x) => x.level === t.level).length;
    const allLeft = stack.length - taken;
    return `<span class="br-ntile" title="${l.ind(ind)} ${ROMAN[t.level]}: ${l.t(`${l.d(sameLeft)} از این سطح، ${l.d(allLeft)} در کل`, `${sameLeft} of this level, ${allLeft} in all`)}">${IMG(tileArt(ind, t.level, k), 'alt=""')}<i aria-hidden="true">${'<s></s>'.repeat(sameLeft)}</i></span>`;
  }).join('');
  return `<div class="br-ntiles">${cells}<button class="br-ntiles__more" type="button" aria-haspopup="dialog" aria-label="${l.t('صفحهٔ صنعت', 'Industry mat')} ${l.name(k)}">${ICONS.plus}</button></div>`;
}
// the map zone: BGA toolbar (zoom, era plate, markets) over a zoomable board box
function mapZone(l, P, boardOpts = {}, toolsOnly = false) {
  const s = P.state;
  const era = s.era === 'canal';
  return `<main class="bgv-felt br-zone br-mapzone" aria-label="${l.t('نقشه', 'Board')}">
 <div class="br-maptools"><div class="br-maptools__zoom" role="group" aria-label="${l.t('بزرگ‌نمایی', 'Zoom')}"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><span class="br-zoomv br-num">${l.d(100)}٪</span><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کل نقشه', 'Whole board')}">${ICONS.fit}</button></div>
  <span class="br-eraplate">${IMG(`link-grey-${era ? 'canal' : 'rail'}`, 'alt=""')}<b>${era ? l.t('دورهٔ کانال', 'Canal Era') : l.t('دورهٔ راه‌آهن', 'Rail Era')}</b><span>${l.t(`دور ${l.d(s.round)} از ${l.d(8)}`, `round ${s.round} of 8`)}</span><span title="${l.t('دستهٔ کشیدنی', 'Draw deck')}">${IMG('card-back', 'alt=""')}<b class="br-num">${l.d(s.deck.length)}</b></span><span title="${l.t('قیمت زغال بازار', 'Coal price')}">${IMG('coal-cube', 'alt=""')}${l.gbp(buyPrice('coal', s.coal))}</span><span title="${l.t('قیمت آهن بازار', 'Iron price')}">${IMG('iron-cube', 'alt=""')}${l.gbp(buyPrice('iron', s.iron))}</span></span>
  <span class="br-maptools__end"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('راهنمای بازیکن', 'Player aid')}">${ICONS.book}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('تنظیمات میز', 'Table settings')}">${ICONS.gear}</button></span></div>
 ${toolsOnly ? '' : `<div class="br-mapbox" tabindex="0" aria-label="${l.t('نقشه: کشیدن برای جابه‌جایی، چرخ یا دو انگشت برای بزرگ‌نمایی', 'Board: drag to pan, wheel or pinch to zoom')}">
 ${board(l, P, boardOpts)}
 </div>`}
</main>`;
}
// the full industry mat of one player, opened from the panel's +
function matDialog(l, P, k) {
  return `<section class="bgv-dialog br-matdialog" role="dialog" aria-modal="true" aria-label="${l.t('صفحهٔ صنعت', 'Industry mat')} ${l.name(k)}">
 <div class="bgv-dialog__head"><span class="bgv-dialog__title" style="${ink(k)}">${l.t('صفحهٔ صنعت', 'Industry mat')} ${l.name(k)}${k === ME ? l.t(' (شما)', ' (you)') : ''}</span><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('بستن', 'Close')}">${ICONS.x}</button></div>
 <div class="bgv-dialog__body">${playerArea(l, P, k)}<p class="br-dockhint" style="margin:0">${l.t('کاشی بعدی هر صنعت حلقهٔ کهربایی دارد و «×n» تعداد باقی آن سطح است؛ قاب خالی همان چاپ صفحه است. با کلیدهای ← → صفحهٔ بازیکن بعدی.', 'The next tile of each industry is ringed and «×n» is how many of that level are left; an empty frame is the printed mat. ← → for the next player.')}</p></div>
</section>`;
}
function logLine(l, e) {
  const a = e.a;
  const who = `<b style="${ink(e.seat)}">${l.name(e.seat)}</b>`;
  if (a.type === 'build') return `${who} ${l.t('ساخت', 'built')} ${l.ind(a.industry)} ${l.t('در', 'in')} ${l.town(a.loc)}`;
  if (a.type === 'network') return `${who} ${l.t('ریل ساخت:', 'built rail:')} ${a.links.map(l.link).join(l.t('، ', ', '))}`;
  if (a.type === 'loan') return `${who} ${l.t('وام £۳۰ گرفت', 'took a £30 loan')}`;
  if (a.type === 'sell') return `${who} ${l.t('فروخت', 'sold')}`;
  if (a.type === 'develop') return `${who} ${l.t('توسعه داد:', 'developed')} ${a.industries.map(l.ind).join(' + ')}`;
  return `${who} ${l.t('رد کرد', 'passed')}`;
}
function rail(l, P, opts = {}) {
  const s = P.state;
  const log = (P.log || []).slice(-6).reverse();
  return `<aside class="br-rail br__players" dir="${l.dir}" aria-label="${l.t('بازیکنان', 'Players')}">
${s.order.map((k) => panel(l, P, k)).join('\n')}
 <section class="bgv-card br-log" aria-label="${l.t('گزارش بازی', 'Game log')}"><ol class="bgv-log">
  <li class="bgv-log__item bgv-log__item--round">${l.t(`دورهٔ راه‌آهن، دور ${l.d(s.round)}`, `Rail Era, round ${s.round}`)}</li>
${log.map((e) => `  <li class="bgv-log__item">${logLine(l, e)}</li>`).join('\n')}
 </ol></section>
</aside>`;
}

// ---------------- action bar (desktop): the 7 actions with their cost, then the steps ----------------
const H = (P, type) => P.hints.filter((h) => h.type === type);
function kindPills(l, P) {
  const s = P.state;
  const rail = s.era === 'rail';
  const b = H(P, 'build'), n = H(P, 'network'), dv = H(P, 'develop'), sl = H(P, 'sell');
  const minB = b.length ? Math.min(...b.map((h) => -h.cost.money)) : 0;
  const ironP = buyPrice('iron', s.iron);
  const KIND = [
    ['build', l.t('ساخت صنعت', 'Build'), b.length ? `<span class="br-pill">${l.t(`${l.d(b.length)} جا`, `${b.length} spots`)} · ${l.t('از', 'from')} ${l.gbp(minB)}</span>` : ''],
    ['network', l.t('ساخت مسیر', 'Network'), n.length ? `<span class="br-pill">${rail ? `${l.gbp(5)}+${IMG('coal-cube', 'class="br-ic" alt="زغال"')}` : l.gbp(3)}</span>` : ''],
    ['develop', l.t('توسعه', 'Develop'), dv.length ? `<span class="br-pill">${IMG('iron-cube', 'class="br-ic" alt=""')}${l.t('هر کاشی', 'per tile')}</span>` : ''],
    ['sell', l.t('فروش', 'Sell'), sl.length ? `<span class="br-pill">${l.d(new Set(sl.map((h) => h.loc + h.slot)).size)} ${l.t('کاشی', 'tile')}</span>` : ''],
    ['loan', l.t('وام', 'Loan'), `<span class="br-pill">+${l.gbp(30)} · ${l.t('درآمد', 'income')} ${l.sd(-3)}</span>`],
    ['scout', l.t('پیشاهنگ', 'Scout'), `<span class="br-pill">${l.d(3)} → ${l.d(2)} ${l.t('آزاد', 'wild')}</span>`],
    ['pass', l.t('رد کردن', 'Pass'), '']
  ];
  return KIND;
}
function kinds(l, P, picked) {
  const types = new Set(P.hints.map((h) => h.type));
  return `<div class="br-kinds" role="group" aria-label="${l.t('نوع اقدام', 'Action')}">${kindPills(l, P).map(([k, name, pill]) => {
    const ok = types.has(k);
    const why = ok ? '' : reason(l, P.blocked[k] || (k === 'sell' ? 'NO_SELL' : ''));
    return `<button class="bgv-btn bgv-btn--${k === 'pass' ? 'ghost' : 'secondary'} bgv-btn--sm" type="button" data-act="${k}" aria-label="${name}" aria-pressed="${picked === k}"${ok ? '' : ` disabled="" data-reason="${P.blocked[k] || 'NO_SELL'}" title="${why}"`}>${name}${pill ? ' ' + pill : ''}</button>`;
  }).join('')}</div>`;
}
// cost of one hint, as icons: £ + coal/iron/beer and where it comes from
function costLine(l, P, h) {
  const s = P.state, c = h.cost;
  const parts = [];
  if (h.type === 'build') {
    const t = tileDef(h.industry, c.built.level);
    parts.push(`${l.t('کاشی', 'tile')} ${l.gbp(t.cost)}`);
  }
  if (h.type === 'network') parts.push(`${h.links.length === 2 ? l.t('دو ریل', 'two rails') : s.era === 'rail' ? l.t('ریل', 'rail') : l.t('کانال', 'canal')} ${l.gbp(h.links.length === 2 ? 15 : s.era === 'rail' ? 5 : 3)}`);
  for (const f of c.from) parts.push(`${l.d(f.n)}${IMG(RES[f.industry], 'class="br-ic" alt=""')} ${l.t('از', 'from')} ${l.town(f.loc)}${f.owner === ME ? '' : ` (${l.name(f.owner)})`} ${l.t('رایگان', 'free')}`);
  if (c.ironMarket < 0) parts.push(`${l.d(-c.ironMarket)}${IMG('iron-cube', 'class="br-ic" alt=""')} ${l.t('از بازار', 'from market')} ${l.gbp(buyPrice('iron', s.iron))}`);
  if (c.coalMarket < 0) parts.push(`${l.d(-c.coalMarket)}${IMG('coal-cube', 'class="br-ic" alt=""')} ${l.t('از بازار', 'from market')} ${l.gbp(buyPrice('coal', s.coal))}`);
  for (const b of c.beerMerchant) parts.push(`${IMG('beer-barrel', 'class="br-ic" alt=""')} ${l.t('آبجوی', 'beer of')} ${l.loc(b.merchant)}`);
  return parts;
}
function buildTarget(l, P, h, on) {
  const t = h.cost.built;
  return `<button class="br-target${on ? ' is-on' : ''}" type="button" role="option" aria-selected="${on}" data-loc="${h.loc}" data-slot="${h.slot}">${IMG(tileArt(h.industry, t.level, ME), 'alt=""')}${l.ind(h.industry)} ${ROMAN[t.level]} ${l.t('در', 'in')} ${l.town(h.loc)} <span class="br-pill">${l.gbp(-h.cost.money)}</span></button>`;
}
function actionBar(l, P, opts = {}) {
  const s = P.state;
  const pick = H(P, 'build').find((h) => h.loc === 'birmingham' && h.slot === 3);
  const t = tileDef(pick.industry, pick.cost.built.level);
  return `<section class="br-bar br__actions" aria-live="polite" aria-label="${l.t('نوار اقدام', 'Action bar')}">
 <div class="br-bar__row"><span class="br-bar__text"><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(`: اقدام ۱ از ۲ در دور ${l.d(s.round)} دورهٔ راه‌آهن. هر اقدام یک کارت از دستتان را دور می‌اندازد.`, `: action 1 of 2, Rail Era round ${s.round}. Every action discards one card from your hand.`)}</span>${clock(l)}</div>
 ${kinds(l, P, 'build')}
 <div class="br-bar__row br-steps" aria-label="${l.t('مرحله‌ها', 'Steps')}"><span class="br-step is-done">${ICONS.check}${l.t('اقدام: ساخت صنعت', 'Action: Build')}</span><span class="br-step is-done">${ICONS.check}${l.t('جا: بیرمنگام، خانهٔ ۴', 'Spot: Birmingham, space 4')}</span><span class="br-step is-done">${ICONS.check}${l.t('کارت: پنبه / تولیدی', 'Card: Cotton / Manufacturer')}</span><span class="br-step is-cur">${l.t('ثبت', 'Confirm')}</span></div>
 <div class="br-targets" role="listbox" aria-label="${l.t('جاهای مجاز ساخت', 'Legal build spots')}">${H(P, 'build').map((h) => buildTarget(l, P, h, h === pick)).join('')}</div>
 <div class="br-sum"><span>${IMG(tileArt('manufacturer', 2, ME), 'class="br-ic" alt=""')} <b>${l.ind('manufacturer')} ${ROMAN[2]}</b> ${l.t('(پایین‌ترین کاشی صفحهٔ شما)', '(lowest tile on your mat)')}</span>${costLine(l, P, pick).map((x) => `<span>${x}</span>`).join('')}<span>${l.t('فروش با', 'sells with')} ${l.d(t.beer)}${IMG('beer-barrel', 'class="br-ic" alt=""')} · ${l.t('برگشته', 'flipped')}: ${l.d(t.vp)} ${l.t('امتیاز', 'VP')}، ${l.t('درآمد', 'income')} +${l.d(t.income)}</span><span class="br-sum__total">${l.t('جمع', 'Total')} <b>${l.gbp(-pick.cost.money)}</b></span></div>
 <div class="br-bar__row"><span class="br-bar__hint" style="flex:1">${l.t('جا را روی نقشه یا از فهرست بزنید؛ کارت‌های مجاز در دست حلقهٔ کهربایی دارند. تا «ثبت» با «برگرد» همه‌چیز عوض می‌شود؛ بعد از ثبت برگشت نیست.', 'Pick the spot on the map or in the list; legal cards in your hand are ringed. Until «Confirm», «Back» undoes anything; after it, nothing.')}</span><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">${ICONS.undo.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}${l.t('برگرد', 'Back')}</button><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="confirm">${ICONS.check.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}${l.t('ثبت', 'Confirm')}</button></div>
</section>`;
}

// ---------------- hand ----------------
function handCard(l, id, pick, cw) {
  return `<div class="br-hcard"><button class="br-card" type="button" data-pick="${pick}" data-flip="card-${id}"${pick === 'none' ? ' aria-disabled="true"' : ''} aria-label="${l.card(id)}" style="--cw:${cw}px">${IMG(cardArt(id), 'alt=""')}${pick === 'picked' ? `<span class="br-check" aria-hidden="true">${ICONS.check}</span>` : ''}</button></div>`;
}
function handZone(l, P, opts = {}) {
  const hand = P.state.hands[ME];
  const ok = opts.allowed || [61];
  return `<section class="bgv-felt br-zone br__hand" aria-label="${l.t('دست شما', 'Your hand')}">
 <div class="br-zone__head"><h2>${l.t('دست شما', 'Your hand')}</h2><small>${l.t(`${l.d(hand.length)} کارت؛ دسته خالی است، پس دست دیگر پر نمی‌شود. برای «ساخت تولیدی در بیرمنگام» فقط کارت پنبه / تولیدی مجاز است (بیرمنگام در شبکهٔ شماست).`, `${hand.length} cards; the deck is empty, so the hand is not refilled. For «Manufacturer in Birmingham» only the Cotton / Manufacturer card is legal (Birmingham is in your network).`)}</small></div>
 <div class="br-hand">
${hand.map((c) => '  ' + handCard(l, c, opts.picked === c || (opts.picked === undefined && c === 61) ? 'picked' : ok.includes(c) ? 'selectable' : 'none', opts.cw || 118)).join('\n')}
 </div>
</section>`;
}

// ---------------- the board ----------------
function trackMarkers(l, s) {
  let h = '';
  const seen = {};
  const put = (space, cls, art, alt) => {
    const [x, y] = G.TRACK[space];
    const n = (seen[space] = (seen[space] || 0) + 1) - 1;
    const side = x < 30 || x > 970; // vertical edge: stack sideways
    const ox = side ? (x < 30 ? 1 : -1) * n * 7 : 0, oy = side ? 0 : (y < 30 ? 1 : -1) * n * 7;
    h += `  ${IMG(art, `class="br-at ${cls}" alt="${alt}" style="${at(x + ox, y + oy)}"`)}\n`;
  };
  for (let k = 0; k < s.players; k++) put(s.income[k], 'br-incm', 'income-' + COLORS[k], `${l.name(k)}: ${l.t('درآمد', 'income')} ${l.sd(incomeLevel(s.income[k]))}`);
  for (let k = 0; k < s.players; k++) put(s.vp[k] % 100, 'br-vpm', 'vp-' + COLORS[k], `${l.name(k)}: ${l.d(s.vp[k])} ${l.t('امتیاز', 'VP')}`);
  return h;
}
function board(l, P, opts = {}) {
  const s = P.state;
  const E = opts.empty;
  let h = `<div class="br-board br__map" dir="ltr" role="group" aria-label="${l.t('نقشهٔ بیرمنگام (روی شب)', 'Birmingham board (night side)')}">
  ${IMG('board-night', `class="br-base" alt="" width="1000" height="1000"`)}\n`;
  // links (the engine keeps only the current era's links)
  for (const [id, owner] of Object.entries(s.links)) {
    const [x, y, a] = G.LINKS[id];
    h += `  <span class="br-at" data-flip="link-${id}" style="${at(x, y)};inline-size:5.2%;line-height:0;transform:translate(-50%,-50%) rotate(${a}deg)">${IMG(`link-${COLORS[owner]}-${s.era === 'canal' ? 'canal' : 'rail'}`, `style="inline-size:100%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.65))" alt="${l.t('مسیر', 'Link')} ${l.link(id)}: ${l.name(owner)}"`)}</span>\n`;
  }
  // industry tiles, with their cubes / barrels
  for (const [loc, row] of Object.entries(s.board)) row.forEach((t, i) => {
    if (!t) return;
    const [x, y] = G.SLOTS[loc][i];
    h += `  ${IMG(tileArt(t.industry, t.level, t.owner, t.flipped ? 'back' : 'front'), `class="br-at br-tile" data-br-piece="tile" data-flip="tile-${loc}-${i}" alt="${l.ind(t.industry)} ${ROMAN[t.level]} ${l.name(t.owner)}${t.flipped ? l.t('، برگشته', ', flipped') : ''}" style="${at(x, y)}"`)}\n`;
    if (t.cubes > 0) h += `  <span class="br-oncubes" style="${at(x, y + 6)}" aria-hidden="true">${Array.from({ length: t.cubes }, () => IMG(RES[t.industry], `class="${t.industry === 'brewery' ? 'is-beer' : ''}" alt=""`)).join('')}</span>\n`;
  });
  // merchants and their beer
  for (const [m, st] of Object.entries(s.merchants)) {
    const g = G.MERCHANTS[m];
    st.tiles.forEach((id, i) => { if (id) h += `  ${IMG(MERCH_ART(id), `class="br-at br-merch" alt="${l.t('تاجر', 'Merchant')} ${l.loc(m)}" style="${at(...g.spaces[i])}"`)}\n`; });
    st.beer.forEach((b, i) => { if (b) h += `  ${IMG('beer-barrel', `class="br-at br-beer" data-flip="beer-${m}-${i}" alt="${l.t('آبجوی تاجر', 'Merchant beer')}" style="${at(...g.beer[i])}"`)}\n`; });
  }
  // markets: cubes fill the most expensive spaces
  const spaces = (X, top) => { const o = []; for (let p = top; p >= 1; p--) for (const x of X) o.push([x, G.ROW_Y(p)]); return o; };
  spaces(G.COAL_X, 7).slice(0, s.coal).forEach(([x, y]) => { h += `  ${IMG('coal-cube', `class="br-at br-mcube" alt="" style="${at(x, y)}"`)}\n`; });
  spaces(G.IRON_X, 5).slice(0, s.iron).forEach(([x, y]) => { h += `  ${IMG('iron-cube', `class="br-at br-mcube" alt="" style="${at(x, y)}"`)}\n`; });
  // card piles in the three frames, turn order, progress track
  const pile = (key, art, n, label) => `  <span class="br-pile${n ? '' : ' is-empty'}" style="${at(...G.FRAMES[key])}" title="${label}">${IMG(art, `alt="${label}"`)}<b class="br-num">${l.d(n)}</b></span>\n`;
  h += pile('deck', 'card-back', s.deck.length, l.t('دستهٔ کشیدنی', 'Draw deck'));
  h += pile('wildLocation', 'card-wild-location', s.wild.location, l.t('کارت‌های شهر آزاد', 'Wild location cards'));
  h += pile('wildIndustry', 'card-wild-industry', s.wild.industry, l.t('کارت‌های صنعت آزاد', 'Wild industry cards'));
  s.order.forEach((k, i) => { h += `  ${IMG(`character-${COLORS[k]}-front`, `class="br-at br-char${!E && P.view.current === k ? ' is-turn' : ''}" alt="${l.t('ترتیب نوبت', 'Turn order')} ${l.d(i + 1)}: ${l.name(k)}" style="${at(...G.ORDER[i])}"`)}\n`; });
  h += trackMarkers(l, s);
  // targets of the chosen action
  if (opts.slots) for (const sl of opts.slots) {
    const [x, y] = G.SLOTS[sl.loc][sl.slot];
    if (sl.ghost) h += `  ${IMG(tileArt(sl.ghost.industry, sl.ghost.level, ME), `class="br-at br-tile is-ghost" alt="" style="${at(x, y)}"`)}\n`;
    h += `  <button class="br-slot" type="button" aria-pressed="${!!sl.picked}" data-loc="${sl.loc}" data-slot="${sl.slot}" aria-label="${l.town(sl.loc)} ${l.t('خانهٔ', 'space')} ${l.d(sl.slot + 1)}" style="${at(x, y)}"></button>\n`;
    if (sl.picked) h += `  <span class="br-check" style="${at(x + 22, y - 22)}" aria-hidden="true">${ICONS.check}</span>\n`;
  }
  if (opts.links) for (const lk of opts.links) {
    const [x, y, a] = G.LINKS[lk.id];
    h += `  <button class="br-linkbtn" type="button" aria-pressed="${!!lk.picked}" data-link="${lk.id}" aria-label="${l.link(lk.id)}" style="${at(x, y)};transform:translate(-50%,-50%) rotate(${a}deg)"></button>\n`;
  }
  if (opts.merchants) for (const mm of opts.merchants) h += `  <button class="br-mbtn" type="button" data-merchant="${mm.m}" data-space="${mm.space}" aria-pressed="${!!mm.picked}" aria-label="${l.loc(mm.m)}" style="${at(...G.MERCHANTS[mm.m].spaces[mm.space])}"></button>\n`;
  if (opts.tip) h += `  <div class="br-tip" style="${opts.tip.style}">${opts.tip.html}</div>\n`;
  return h + ' </div>';
}
function boardZone(l, P) {
  const b = H(P, 'build');
  const pick = b.find((h) => h.loc === 'birmingham' && h.slot === 3);
  const t = tileDef('manufacturer', 2);
  const [x, y] = G.SLOTS.birmingham[3];
  const tip = { style: `left:${(x + 30) / 10}%;top:${(y - 5) / 10}%`, html: `<b>${l.ind('manufacturer')} ${ROMAN[2]}</b> · ${l.town('birmingham')} ${l.t('خانهٔ ۴', 'space 4')}<br>${costLine(l, P, pick).join('<br>')}<br>${l.t('فروش با', 'Sells with')} ${l.d(t.beer)} ${IMG('beer-barrel', 'class="br-ic" alt=""')} · ${l.d(t.vp)} ${l.t('امتیاز', 'VP')} · ${l.t('درآمد', 'income')} +${l.d(t.income)} · ${l.d(t.linkVp)} ${l.t('آیکون مسیر', 'link icon')}` };
  return mapZone(l, P, { slots: b.map((h) => ({ loc: h.loc, slot: h.slot, picked: h === pick, ghost: h === pick ? { industry: 'manufacturer', level: 2 } : null })), tip });
}

// ---------------- player area: header plate + night mat with the remaining tiles ----------------
function mat(l, s, k) {
  let h = `<div class="br-mat" dir="ltr" role="group" aria-label="${l.t('صفحهٔ صنعت', 'Industry mat')} ${l.name(k)}">${IMG('player-mat-night', 'class="br-base" alt=""')}`;
  for (const ind of INDUSTRIES) {
    const stack = M.stack[ind];
    const taken = s.mat[k][ind];
    const levels = [...new Set(stack.map((t) => t.level))];
    const nextLvl = stack[taken]?.level;
    for (const lvl of levels) {
      const first = stack.findIndex((t) => t.level === lvl);
      const count = stack.filter((t) => t.level === lvl).length;
      const left = Math.max(0, Math.min(count, first + count - taken));
      const [x, y] = G.MAT[ind][lvl];
      const top = (y / G.MAT_H * 100).toFixed(3) + '%', left_ = (x / 10).toFixed(3) + '%';
      if (!left) continue;
      h += `${IMG(tileArt(ind, lvl, k), `data-industry="${ind}" data-level="${lvl}" class="br-mtile${left > 1 ? ' is-stack' : ''}${lvl === nextLvl && k === ME ? ' is-next' : ''}" alt="${l.ind(ind)} ${ROMAN[lvl]}: ${l.d(left)}" style="left:${left_};top:${top}"`)}`;
      if (left > 1) h += `<span class="br-mcount" style="left:${((x + 30) / 10).toFixed(3)}%;top:${((y + 30) / G.MAT_H * 100).toFixed(3)}%">×${l.d(left)}</span>`;
    }
  }
  return h + '</div>';
}
function areaHead(l, P, k) {
  const s = P.state, v = P.view;
  const lvl = incomeLevel(s.income[k]);
  return `<div class="br-ahead"><span class="br-ahead__name" style="${ink(k)}">${IMG(`character-${COLORS[k]}-front`, 'alt=""')}${l.name(k)}${k === ME ? ` <small>${l.t('شما', 'you')}</small>` : ''}</span><span class="br-vp"><b class="br-num">${l.d(s.vp[k])}</b><small>${l.t('امتیاز', 'VP')}</small></span>
  <span class="br-chip">${IMG('coin-5', 'alt=""')}<span><b>${l.gbp(s.money[k])}</b><small>${l.t('پول', 'money')}</small></span></span>
  <span class="br-chip${lvl < 0 ? ' is-neg' : ''}">${IMG('income-' + COLORS[k], 'alt=""')}<span><b class="br-num">${l.sd(lvl)}</b><small>${l.t('درآمد هر دور', 'income / round')}</small></span></span>
  <span class="br-chip"><span><b>${l.gbp(s.spent[k])}</b><small>${l.t('خرج این دور', 'spent this round')}</small></span></span>
  <span class="br-chip">${IMG('card-back', 'alt=""')}<span><b class="br-num">${l.d(v.handCounts[k])}</b><small>${l.t('کارت', 'cards')}</small></span></span></div>`;
}
function playerArea(l, P, k) {
  const s = P.state, v = P.view;
  const disc = k === ME && P.pvDiscard !== undefined ? P.pvDiscard : v.discardTop[k];
  return `<section class="br-player br-area${k === ME ? ' is-me' : ''}" style="${seatStyle(k)}" data-seat="${k}" aria-label="${l.t('صفحهٔ بازیکن', 'Player area')} ${l.name(k)}">
 ${areaHead(l, P, k)}
 <div class="br-matwrap">${mat(l, s, k)}<div class="br-side"><figure>${disc != null ? `<span class="br-card" data-flip="card-${disc}" style="--cw:104px">${IMG(cardArt(disc), 'alt=""')}</span>` : `<span class="br-card" style="--cw:104px;opacity:.35">${IMG('card-back', 'alt=""')}</span>`}<figcaption>${l.t('آخرین کارت دورریخته', 'Top discard')}</figcaption></figure><figure><span class="br-linkstack">${IMG(`link-${COLORS[k]}-${s.era === 'canal' ? 'canal' : 'rail'}`, 'alt=""')}<b class="br-num">×${l.d(linksLeft(s, k))}</b></span><figcaption>${l.t('کاشی مسیر باقی', 'link tiles left')}</figcaption></figure></div></div>
</section>`;
}

module.exports = { incomeTrack, nextTiles, mapZone, matDialog, ME, H, seatStyle, ink, reason, gamebar, clock, dashboard, panel, rail, kinds, kindPills, costLine, actionBar, handCard, handZone, board, boardZone, trackMarkers, mat, areaHead, playerArea, MERCH_ART, RES, linksLeft, logLine };
