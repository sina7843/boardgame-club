// Phone parts (390 x 844): frame, tabs, map view, hand, my mat, docks and the actions sheet. Same data as desktop.
const { G, M, COLORS, SEATS, ROMAN, IMG, ICONS, tileDef, incomeLevel, buyPrice, cardArt } = require('./br-lib');
const P = require('./br-parts');
const { ME, H, seatStyle, ink, clock, costLine } = P;

const CSS = `
.br .bgv-pcard--mini{padding:8px 10px}
.br .bgv-pcard--mini>.bgv-avatar{margin-block:2px 6px}
.br .bgv-turn{max-inline-size:100%;min-inline-size:0}
.br .bgv-pcard__score small{font-size:11px}
.br-tabs{display:flex;gap:2px;padding:3px;border-radius:var(--radius-md);background:var(--felt-plate)}
.br-tabs button{flex:1;block-size:38px;padding-inline:4px;border:0;border-radius:var(--radius-sm);background:none;color:var(--felt-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.br-tabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink)}
.br-subtabs{display:flex;gap:6px;overflow:auto}
.br-subtabs button{flex:none;display:inline-flex;align-items:center;gap:6px;block-size:36px;padding-inline:6px 10px;border-radius:var(--radius-pill);border:1px solid var(--felt-line);background:none;color:var(--felt-ink);font:inherit;font-size:13px;font-weight:700}
.br-subtabs button img{inline-size:24px;block-size:24px;border-radius:50%}
.br-subtabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink);border-color:transparent}
.br-mview{position:relative;contain:paint;flex:1;min-block-size:0;overflow:hidden;border-radius:var(--radius-md);background:#0B0D14}
.br-mview--scroll{overflow:auto;background:none;display:flex;flex-direction:column;gap:10px}
.br-mview--scroll>*{flex:none}
.br-mview .br-board.br-mboard{position:absolute;border-radius:0}
.br-zoombtns{position:absolute;inset-block-start:8px;inset-inline-start:8px;display:grid;gap:6px;z-index:2}
.br-mapinfo{position:absolute;inset-block-start:8px;inset-inline-end:8px;z-index:2;max-inline-size:62%}
.br .bgv-actiondock__actions{flex-wrap:nowrap}
.br .bgv-actiondock__actions>.bgv-btn--primary{flex:1}
.br-dockprompt{min-inline-size:0;font-size:14px;line-height:1.6;display:grid;gap:6px}
.br-dockprompt>span b{color:var(--heading)}
.br-dockhint{font-size:12px;color:var(--text-muted);line-height:1.5}
.br-dockcost{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:13px}
.br-dockcost .br-ic{block-size:17px}
.br-mhand{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 8px}
.br-mhand .br-hcard,.br-mhand .br-card{inline-size:100%}
.br-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--felt-ink);font-size:13.5px}
.br-mhead b{font-weight:900}
.br-mhead small{color:var(--felt-muted);font-size:12px}
.br-mview .br-ahead{gap:6px 8px;padding:8px}
.br-mview .br-ahead__name{block-size:30px;font-size:14px}
.br-mview .br-vp{inline-size:46px;block-size:46px}
.br-mview .br-vp b{font-size:18px}
.br-mview .br-chip{block-size:38px;padding-inline:6px 8px;font-size:16px}
.br-mview .br-chip img{block-size:24px}
.br-mview .br-matwrap{grid-template-columns:1fr}
.br-mview .br-side{grid-auto-flow:column;justify-content:start;align-items:center}
.br-mview .br-side .br-card{--cw:70px}
.br-mview .br-linkstack{inline-size:96px}
/* actions sheet */
.br-sheetwrap{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:flex-end}
.br-sheet{position:relative;max-block-size:86%;padding:0 14px 14px;gap:9px;overflow:auto}
.br-sheet__head{display:flex;align-items:center;gap:8px;font-size:14px;line-height:1.6}
.br-sheet__head b{color:var(--heading);font-weight:900}
.br-sheet__head .bgv-clock{margin-inline-start:auto;flex:none}
.br-sheet .br-label{font-size:12px;font-weight:700;color:var(--label)}
.br-sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.br-sgrid .bgv-btn{block-size:auto;min-block-size:54px;padding-block:6px;flex-direction:column;gap:2px;white-space:normal;line-height:1.4}
.br-sgrid .bgv-btn small{font-size:11.5px;font-weight:600;color:var(--text-muted)}
.br-sgrid .bgv-btn .br-pill{block-size:22px}
.br-score{display:grid;gap:8px}
.br-score__row{display:grid;grid-template-columns:auto 1fr repeat(3,auto);align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:13.5px}
.br-score__row img{inline-size:30px;block-size:30px;border-radius:50%}
.br-score__row b{font-weight:900;color:var(--heading)}
.br-score__row .br-gain{min-inline-size:44px;text-align:center}
.br-score__row .br-gain small{display:block;font-size:10.5px;font-weight:700;color:var(--text-muted)}
.br-score__row.is-you{box-shadow:inset 0 0 0 2px var(--pick)}
`;

// ---------- frame ----------
function hud(l, S, opts = {}) {
  const s = S.state, v = S.view;
  return `<section class="bgv-hud bgv-hud--strip" aria-label="${l.t('بازیکنان به ترتیب نوبت این دور', 'Players in this round\'s turn order')}">${s.order.map((k) => {
    const you = k === ME, turn = k === v.current && !opts.noTurn;
    const lvl = incomeLevel(s.income[k]);
    return `<div class="bgv-pcard bgv-pcard--mini${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}"${turn ? ' style="--clock-c:var(--clock-calm)"' : ''} role="button" tabindex="0" aria-label="${l.name(k)}"><span class="bgv-avatar bgv-avatar--sm${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="${seatStyle(k)}${turn ? ';--clock-c:var(--clock-calm)' : ''}">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="bgv-pcard__name"><b><i class="bgv-seat" style="${seatStyle(k)}"></i>${you ? `<span class="bgv-sr">${l.name(k)}</span>` : l.name(k)}</b><small>${l.gbp(s.money[k])} · ${l.t('درآمد', 'inc')} <span class="br-num">${l.sd(lvl)}</span></small></div><div class="bgv-pcard__score">${l.d(s.vp[k])}<small>${l.t('امتیاز', 'VP')}</small></div></div>`;
  }).join('')}</section>`;
}
function tabs(l, sel, handN = 6) {
  const T = [['map', 'نقشه', 'Map'], ['hand', `دست ${l.d(handN)}`, `Hand ${handN}`], ['mat', 'صفحهٔ من', 'My mat'], ['players', 'بازیکنان', 'Players']];
  return `<div class="br-tabs" role="tablist" aria-label="${l.t('بخش‌های میز', 'Table parts')}">${T.map(([id, fa, en]) => `<button type="button" role="tab" aria-selected="${id === sel}">${l.t(fa, en)}</button>`).join('')}</div>`;
}
function turnRow(l, S, plate) {
  const s = S.state;
  const mine = S.view.current === ME;
  return `<div class="bgv-felt-row" style="flex-wrap:nowrap"><span class="bgv-turn ${mine ? 'bgv-turn--mine' : 'bgv-turn--other'}" role="status"><span class="bgv-turn__who">${mine ? l.t('نوبت شماست', 'Your turn') : l.t(`نوبت ${l.name(S.view.current)}`, `${l.name(S.view.current)} to play`)}</span><span class="bgv-turn__sep"></span>${clock(l, false)}</span><span class="bgv-felt-plate">${plate ?? l.t(`دور <strong>${l.d(s.round)}</strong> · اقدام ${l.d(3 - s.actionsLeft)}/${l.d(2)}`, `Round <strong>${s.round}</strong> · ${3 - s.actionsLeft}/2`)}</span></div>`;
}
function frame(l, S, { row, tab, view, dock, overlay = '', hudOpts }) {
  return `<div class="bgv-tablescreen br" style="height:844px" data-seq="${S.state.seq}" data-era="${S.state.era}" data-round="${S.state.round}">
${P.gamebar(l, true)}
${hud(l, S, hudOpts)}
<main class="bgv-felt" style="padding:12px;gap:8px" aria-label="${l.t('میز برس', 'Brass table')}">
 ${row}
 ${tab}
 ${view}
</main>
${dock}
</div>
${overlay}`;
}
const steps = (l, list) => `<span class="br-steps">${list.map(([fa, en, st]) => `<span class="br-step${st === 'done' ? ' is-done' : st === 'cur' ? ' is-cur' : ''}">${st === 'done' ? ICONS.check : ''}${l.t(fa, en)}</span>`).join('')}</span>`;
const dockBtns = (l, { confirm = true, back = true, cancel = true, confirmLabel } = {}) => `<div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button" data-act="confirm"${confirm ? '' : ' disabled=""'}>${ICONS.check}${confirmLabel || l.t('ثبت', 'Confirm')}</button>${back ? `<button class="bgv-btn bgv-btn--secondary" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button>` : ''}${cancel ? `<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('لغو این اقدام', 'Cancel this action')}">${ICONS.x}</button>` : ''}</div>`;

// ---------- map view: the board scaled and panned (cx, cy in board units) ----------
function mapView(l, S, { scale = 0.366, cx = 500, cy = 500, vw = 366, vh = 400, info, ...opts }) {
  const w = 1000 * scale, left = Math.round(vw / 2 - cx * scale), top = Math.round(vh / 2 - cy * scale);
  const b = P.board(l, S, opts).replace('<div class="br-board br__map"', `<div class="br-board br-mboard br__map" style="inline-size:${w}px;left:${left}px;top:${top}px"`);
  return `<div class="br-mview" role="tabpanel" aria-label="${l.t('نقشه', 'Board')}">
 ${b}
 <div class="br-zoombtns" role="group" aria-label="${l.t('بزرگ‌نمایی', 'Zoom')}"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کل نقشه', 'Whole board')}">${ICONS.fit}</button></div>
 ${info ? `<span class="bgv-felt-plate br-mapinfo">${info}</span>` : ''}
</div>`;
}

// ---------- screens ----------
function turnMobile(l) { // build: auto-zoom to the 4 legal spots, Birmingham picked
  const S = M.main;
  const b = H(S, 'build');
  const pick = b.find((h) => h.loc === 'birmingham' && h.slot === 3);
  const xs = b.map((h) => G.SLOTS[h.loc][h.slot]);
  const x0 = Math.min(...xs.map((p) => p[0])) - 40, x1 = Math.max(...xs.map((p) => p[0])) + 40, y0 = Math.min(...xs.map((p) => p[1])) - 40, y1 = Math.max(...xs.map((p) => p[1])) + 40;
  const vh = 330, scale = Math.min(366 / (x1 - x0), vh / (y1 - y0));
  const view = mapView(l, S, { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, vh, slots: b.map((h) => ({ loc: h.loc, slot: h.slot, picked: h === pick, ghost: h === pick ? { industry: 'manufacturer', level: 2 } : null })), info: l.t(`بزرگ‌نمایی خودکار: ${l.d(b.length)} جای مجاز`, `Auto-zoom: ${b.length} legal spots`) });
  const t = tileDef('manufacturer', 2);
  const dock = `<section class="bgv-actiondock br__actions" aria-label="${l.t('اقدام شما', 'Your action')}">
 <div class="bgv-actiondock__prompt"><span class="br-dockprompt">${steps(l, [['ساخت صنعت', 'Build', 'done'], ['جا', 'Spot', 'done'], ['کارت', 'Card', 'cur'], ['ثبت', 'Confirm', '']])}<span><b>${l.ind('manufacturer')} ${ROMAN[2]}</b> ${l.t('در بیرمنگام، خانهٔ ۴', 'in Birmingham, space 4')} <span class="br-pill">${l.gbp(-pick.cost.money)}</span></span><span class="br-dockcost">${costLine(l, S, pick).map((x) => `<span>${x}</span>`).join('')}</span><span class="br-dockhint">${l.t('کارت مجاز: پنبه / تولیدی (در سربرگ «دست» حلقه دارد). تا «ثبت» با «برگرد» عوض می‌شود.', 'Legal card: Cotton / Manufacturer (ringed in «Hand»). Until «Confirm», «Back» changes it.')}</span></span></div>
 ${dockBtns(l, { confirm: false })}
</section>`;
  return frame(l, S, { row: turnRow(l, S), tab: tabs(l, 'map'), view, dock });
}
function sellMobile(l) { // sell: whole board, own pottery picked, merchants that buy it ringed
  const S = M.main;
  const sells = H(S, 'sell');
  const nott = sells.find((h) => h.merchant === 'nottingham');
  const view = mapView(l, S, { scale: 0.366, cx: 500, cy: 500, vh: 366, slots: [{ loc: nott.loc, slot: nott.slot, picked: true }], merchants: sells.map((h) => ({ m: h.merchant, space: h.cost.beerMerchant[0].space, picked: h === nott })), info: l.t('تاجرهای خریدار سفال حلقه دارند', 'Merchants buying pottery are ringed') });
  const c = nott.cost, w = sells.find((h) => h.merchant === 'warrington');
  const dock = `<section class="bgv-actiondock br__actions" aria-label="${l.t('اقدام شما', 'Your action')}">
 <div class="bgv-actiondock__prompt"><span class="br-dockprompt">${steps(l, [['فروش', 'Sell', 'done'], ['کاشی و تاجر', 'Tile & merchant', 'done'], ['کارت', 'Card', 'done'], ['ثبت', 'Confirm', 'cur']])}<span><b>${l.ind('pottery')} ${ROMAN[1]}</b> ${l.t('کاونتری → ناتینگهام', 'Coventry → Nottingham')}</span><span class="br-dockcost"><span>${IMG('beer-barrel', 'class="br-ic" alt=""')} ${l.t('آبجوی همان تاجر', 'that merchant\'s beer')}</span><span>${l.t('پاداش', 'bonus')} +${l.d(c.vp)} ${l.t('امتیاز', 'VP')}</span><span>${l.t('برمی‌گردد: درآمد', 'flips: income')} <span class="br-num">${l.sd(c.incomeLevel)}</span> ${l.t('سطح', 'levels')}</span></span><span class="br-dockhint">${l.t(`وارینگتون هم می‌خرد (پاداش +${l.d(w.cost.money)} £). کاشی‌های کالای دیگر را هم می‌شود در همین فروش تیک زد.`, `Warrington also buys (bonus +£${w.cost.money}). More goods tiles can be ticked in the same sale.`)}</span></span></div>
 ${dockBtns(l)}
</section>`;
  return frame(l, S, { row: turnRow(l, S), tab: tabs(l, 'map'), view, dock });
}
function actionsMobile(l) { // the actions sheet over the hand tab
  const S = M.main;
  const handView = `<div class="br-mview br-mview--scroll" role="tabpanel" aria-label="${l.t('دست شما', 'Your hand')}"><div class="br-mhand">${S.state.hands[ME].map((c) => P.handCard(l, c, 'none', 100)).join('')}</div></div>`;
  const names = { build: ['ساخت صنعت', 'Build'], network: ['ساخت مسیر', 'Network'], develop: ['توسعه', 'Develop'], sell: ['فروش', 'Sell'], loan: ['وام', 'Loan'], scout: ['پیشاهنگ', 'Scout'], pass: ['رد کردن', 'Pass'] };
  const help = { build: ['پایین‌ترین کاشی صفحه', 'lowest mat tile'], network: ['ریل £۵ + ۱ زغال؛ دو ریل £۱۵', 'rail £5 + coal; two £15'], develop: ['هر کاشی ۱ آهن', '1 iron per tile'], sell: ['کالای وصل به تاجر', 'goods linked to a merchant'], loan: ['+£۳۰، درآمد −۳ سطح', '+£30, income −3 levels'], scout: ['۳ کارت → ۲ کارت آزاد', '3 cards → 2 wilds'], pass: ['فقط یک کارت دور', 'discard one card'] };
  const types = new Set(S.hints.map((h) => h.type));
  const pills = Object.fromEntries(P.kindPills(l, S).map(([k, , p]) => [k, p]));
  const sheet = `<div class="br-sheetwrap"><div class="bgv-scrim" aria-hidden="true"></div><section class="bgv-sheet br-sheet" role="dialog" aria-modal="true" aria-label="${l.t('اقدام‌ها', 'Actions')}"><span class="bgv-sheet__handle" aria-hidden="true"></span>
  <div class="br-sheet__head"><span><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': اقدام ۱ از ۲', ': action 1 of 2')}</span>${clock(l)}</div>
  <span class="br-label">${l.t('هر اقدام یک کارت دور می‌اندازد', 'Every action discards one card')}</span>
  <div class="br-sgrid br-kinds" role="group" aria-label="${l.t('نوع اقدام', 'Action')}">${Object.keys(names).map((k) => `<button class="bgv-btn bgv-btn--${k === 'pass' ? 'ghost' : 'secondary'}" type="button" data-act="${k}" aria-label="${l.t(...names[k])}"${types.has(k) ? '' : ' disabled=""'}><span>${l.t(...names[k])}</span>${pills[k] || `<small>${l.t(...help[k])}</small>`}</button>`).join('')}</div>
  <p class="br-dockhint" style="margin:0">${l.t('بعد از انتخاب، جاهای مجاز روی نقشه و کارت‌های مجاز در دست حلقهٔ کهربایی می‌گیرند.', 'After choosing, legal spots on the map and legal cards in your hand get an amber ring.')}</p>
 </section></div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('اقدام شما', 'Your action')}"><div class="bgv-actiondock__prompt"><span class="br-dockprompt"><span><b>${l.t('نوبت شماست', 'Your turn')}</b></span></span></div><div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button" aria-haspopup="dialog">${l.t('اقدام‌ها', 'Actions')}</button></div></section>`;
  return frame(l, S, { row: turnRow(l, S), tab: tabs(l, 'hand'), view: handView, dock, overlay: sheet });
}
function matMobile(l) { // my mat, seat switcher for the others
  const S = M.main;
  const s = S.state;
  const order = [0, ...s.order.filter((k) => k !== 0)];
  const view = `<div class="br-mview br-mview--scroll" role="tabpanel" aria-label="${l.t('صفحهٔ صنعت', 'Industry mat')}">
 <div class="br-subtabs" role="tablist" aria-label="${l.t('صفحهٔ کدام بازیکن', 'Whose mat')}">${order.map((k) => `<button type="button" role="tab" aria-selected="${k === ME}" style="${ink(k)}">${IMG(`character-${COLORS[k]}-front`, 'alt=""')}${k === ME ? l.t('من', 'Me') : l.name(k)}</button>`).join('')}</div>
 ${P.playerArea(l, S, ME)}
 <p class="br-dockhint" style="margin:0;color:var(--felt-muted)">${l.t('کاشی بعدی هر صنعت حلقهٔ کهربایی دارد؛ عدد «×» یعنی چند کاشی از آن سطح مانده. خانه‌های خالی همان چاپ صفحه‌اند.', 'The next tile of each industry is ringed; «×» is how many of that level are left. Empty frames show the printed mat.')}</p>
</div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('اقدام شما', 'Your action')}"><div class="bgv-actiondock__prompt"><span class="br-dockprompt"><span><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': اقدام ۱ از ۲', ': action 1 of 2')}</span></span></div><div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button" aria-haspopup="dialog">${l.t('اقدام‌ها', 'Actions')}</button></div></section>`;
  return frame(l, S, { row: turnRow(l, S), tab: tabs(l, 'mat'), view, dock });
}
function scoreRows(l, sc, before, after, opts = {}) {
  const order = [...Array(before.players).keys()].sort((a, b) => after.vp[b] - after.vp[a]);
  return `<div class="br-score">${order.map((k) => `<div class="br-score__row${k === ME ? ' is-you' : ''}">${IMG(`character-${COLORS[k]}-front`, 'alt=""')}<b style="${ink(k)}">${l.name(k)}</b><span class="br-gain"><b class="br-num">+${l.d(sc.per[k].links)}</b><small>${l.t('مسیرها', 'links')}</small></span><span class="br-gain"><b class="br-num">+${l.d(sc.per[k].tiles)}</b><small>${l.t('کاشی‌ها', 'tiles')}</small></span><span class="br-gain"><b class="br-num">${l.d(after.vp[k])}</b><small>${opts.place ? l.t(`رتبهٔ ${l.d(opts.place[k])}`, `place ${opts.place[k]}`) : l.t('امتیاز', 'VP')}</small></span></div>`).join('')}</div>`;
}
function eraEndMobile(l) { // end of the Canal Era: scoring sheet over the map
  const E = M.eraEnd, S = E.before;
  const view = mapView(l, S, { scale: 0.366, vh: 380, noTurn: true });
  const sheet = `<div class="br-sheetwrap"><div class="bgv-scrim" aria-hidden="true"></div><section class="bgv-sheet br-sheet" role="dialog" aria-modal="true" aria-label="${l.t('پایان دورهٔ کانال', 'End of the Canal Era')}"><span class="bgv-sheet__handle" aria-hidden="true"></span>
  <div class="br-sheet__head"><span><b>${l.t('پایان دورهٔ کانال', 'End of the Canal Era')}</b></span></div>
  <span class="br-label">${l.t('اول مسیرها (آیکون‌های دو سر هر مسیر)، بعد کاشی‌های برگشته', 'Links first (icons at both ends), then flipped tiles')}</span>
  ${scoreRows(l, E.score, E.before.state, E.after.state)}
  <p class="br-dockhint" style="margin:0">${l.t(`سپس همهٔ کانال‌ها و ${l.d(E.score.removed.length)} کاشی سطح I از نقشه برداشته می‌شوند، بشکه‌های تاجرها پر می‌شود، دسته بُر می‌خورد و هر نفر ۸ کارت تازه می‌گیرد. درآمد این دور هم پرداخت شد.`, `Then all canals and ${E.score.removed.length} level I tiles leave the board, merchant beer is refilled, the deck is reshuffled and everyone draws 8. This round's income was paid too.`)}</p>
  <div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button">${l.t('دورهٔ راه‌آهن', 'Rail Era')}</button><button class="bgv-btn bgv-btn--secondary" type="button">${l.t('نقشه پیش از امتیاز', 'Board before scoring')}</button></div>
 </section></div>`;
  return frame(l, S, { row: `<div class="bgv-felt-row"><span class="bgv-felt-plate">${l.t('دورهٔ کانال تمام شد · امتیازشماری', 'Canal Era over · scoring')}</span></div>`, tab: tabs(l, 'map', 0), view, dock: '', overlay: sheet, hudOpts: { noTurn: true } });
}

module.exports = { CSS, hud, tabs, turnRow, frame, steps, dockBtns, mapView, turnMobile, sellMobile, actionsMobile, matMobile, eraEndMobile, scoreRows };
