// HTML parts of the Ark Nova table (desktop and phone), BGA layout. Every number, option and label comes from
// work/mock.json (played and checked by the repo engine).
const X = require('./an-lib');
const { M, V, MAP_W, MAP_H, HEX, hexXY, LEFT_XY, WORKER_XY, PARTNER_XY, UNI_XY, MB_W, MB_H, appealXY, cpXY, cpTarget, repXY, breakXY,
  FOLDER_X, FOLDER, DECK_XY, DISCARD_XY, BONUS_XY, AB_W, AB_H, TASK_XY, ZOO_XY, UNI_AB, DONATE_XY, LEVEL_XY, BONUS_FILE, UNI_FILE,
  cardFile, bldFile, actFile, fitBuilding, SEATS, pct, at, ICON_ORDER, ICON_FILE, ACTIONS, IMG, ICONS } = X;

const ME = 0;
const P = (k) => V.players[k];
const ORDER = [3, 0, 1, 2]; // turn order from the first player (BGA lists panels in turn order)
const OPTS = V.prompt.options;
const canAct = (k) => OPTS.some((o) => o.value === `a:${k}:0`);
const ui = (n, cls = 'an-ic', alt = '') => IMG('ui/' + n, `class="${cls}" alt="${alt}"`);
const piece = (kind, k, cls, x, y, W, H, alt = '') => IMG(`pieces/${kind}-${SEATS[k].color}`, `class="an-at an-piece ${cls}" alt="${alt}" style="${at(x, y, W, H)}"`);
const cardImg = (id, attrs = 'alt=""') => IMG(cardFile(id), attrs);
const faText = (id) => M.cardFa[id] || {};

// engine error code -> sentence (the renderer only translates engine codes)
function reason(l, code) {
  const T = {
    CONDITIONS: ['شرط کارت برقرار نیست', 'Condition not met'], CANNOT_AFFORD: ['پول کافی ندارید', 'Not enough money'],
    NO_ENCLOSURE: ['محوطهٔ خالی مناسب ندارید', 'No suitable empty enclosure'], ANIMAL_FORBIDDEN: ['اثر کارت اجازه نمی‌دهد', 'Forbidden by an effect'],
    LEVEL: ['سطح حامی از قدرت بیشتر است', 'Sponsor level above strength'], NO_ROOM: ['جای ساخت سازهٔ یکتا نیست', 'No room for the unique building'],
    NO_SUPPORT: ['شرط هیچ سطحی برقرار نیست', 'No level can be supported'], NOTHING: ['کاری برای انجام نیست', 'Nothing to do']
  }[code] || [code, code];
  return l.t(T[0], T[1]);
}

// ---------------- shell ----------------
function gamebar(l, mobile = false) {
  const meta = mobile ? '<span class="bgv-gamebar__mi is-first">نوبتی</span><span class="bgv-gamebar__mi">۲۴ ساعت</span>'
    : '<span class="bgv-gamebar__mi is-first">نوبتی</span><span class="bgv-gamebar__mi">۲۴ ساعت هر نوبت</span><span class="bgv-gamebar__mi">۴ نفر</span><span class="bgv-gamebar__mi">نقشه‌های پیشرفته</span>';
  return `<header class="bgv-gamebar" dir="rtl"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="بازگشت به میزها">${ICONS.back}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">آرک نوا${mobile ? '' : '<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">Ark Nova</span>'}</span><span class="bgv-gamebar__meta">${meta}</span></div>${mobile ? '' : `<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="قوانین آرک نوا">${ICONS.book}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-iconbtn-count" type="button" aria-label="گفت‌وگوی میز، ۲ پیام تازه">${ICONS.chat}<span class="bgv-badge bgv-badge--count">۲</span></button>${mobile ? `<button class="bgv-btn bgv-btn--leave bgv-btn--icon" type="button" aria-label="ترک میز">${ICONS.leave}</button>` : `<button class="bgv-btn bgv-btn--leave bgv-btn--sm" type="button">${ICONS.leave.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}ترک میز</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="گزینه‌های میز">${ICONS.more}</button></header>`;
}
const clock = (l, chip = true) => `<span class="bgv-clock${chip ? ' bgv-clock--chip' : ''}" data-state="calm" style="--p:0.875;" role="timer" aria-label="${l.t('زمان نوبت شما', 'Your turn time')}"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">${l.t('۲۱ ساعت', '21h')}</span></span>`;

// ---------------- BGA counters ----------------
function counters(l, k, opts = {}) {
  const p = P(k);
  const c = (img, v, title, cls = '') => `<span class="an-cnt${cls}" title="${title}">${img}<b class="an-num">${l.d(v)}</b></span>`;
  return `<span class="an-cnts">${[
    c(ui('money', '', ''), p.money, l.t('پول', 'Money'), ' an-cnt--coin'),
    c(ui('appeal', '', ''), p.appeal, l.t('جذابیت', 'Appeal')),
    c(ui('conservation', '', ''), p.cp, l.t('امتیاز حفاظت', 'Conservation points')),
    c(ui('reputation', '', ''), p.rep, l.t('اعتبار', 'Reputation')),
    c(ui('xtoken', '', ''), p.x, l.t('نشان X (حداکثر ۵)', 'X-tokens (max 5)')),
    c(IMG('card-backs/card-back-zoo', 'alt=""'), p.handCount, l.t('کارت در دست', 'Cards in hand')),
    c(IMG(`pieces/worker-${SEATS[k].color}`, 'alt=""'), p.workers, l.t('کارمند انجمن آماده', 'Association workers available'))
  ].join('')}</span>`;
}
const iconCounts = (l, k) => `<span class="an-icons" aria-label="${l.t('نمادهای باغ‌وحش', 'Zoo icons')}">${ICON_ORDER.map((i) => {
  const n = P(k).icons[i] || 0;
  return `<span class="an-icn${n ? '' : ' is-zero'}" title="${l.icon(i)}: ${l.d(n)}">${IMG('icons/' + ICON_FILE[i], 'alt=""')}${n ? `<b class="an-num">${l.d(n)}</b>` : ''}</span>`;
}).join('')}</span>`;
const scoreBadge = (l, k) => { const v = P(k).vp; return `<span class="an-score${v < 0 ? ' is-neg' : ''}" title="${l.t('امتیاز فعلی = جذابیت − عدد هدف حفاظت', 'Score now = appeal − conservation target')}"><b class="an-num">${l.d(v)}</b><small>${l.t('امتیاز', 'score')}</small></span>`; };
const goal = (l, k) => `<span class="an-goal">${l.t('جذابیت', 'Appeal')} <b class="an-num">${l.d(P(k).appeal)}</b> ← ${l.t('هدف حفاظت', 'target')} <b class="an-num">${l.d(P(k).target)}</b></span>`;

// ---------------- rail ----------------
function dashboard(l) {
  const info = (img, v, label) => `<span class="an-dinfo" title="${label}">${img}<b class="an-num">${v}</b>${label}</span>`;
  return `<section class="bgv-card an-dash" aria-label="${l.t('وضعیت میز', 'Table status')}">
  <div class="an-dash__tools"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('راهنما', 'Help')}">${ICONS.book}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('تنظیمات میز', 'Table settings')}" aria-haspopup="dialog">${ICONS.gear}</button></div>
  <div class="an-dash__info">${info(ui('break', '', ''), `${l.d(V.brk)}/${l.d(V.brkMax)}`, l.t('استراحت', 'Break'))}${info(IMG('card-backs/card-back-zoo', 'alt=""'), l.d(V.deckCount), l.t('دسته', 'Deck'))}${info(ui('act-cards', '', ''), l.d(V.turnsDone + 1), l.t('نوبت', 'Turn'))}</div>
 </section>`;
}
function panel(l, k) {
  const you = k === ME, turn = k === V.current;
  return ` <div class="bgv-pcard an-panel${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}"${turn ? ' style="--clock-c:var(--clock-calm)"' : ''} role="button" tabindex="0" aria-label="${l.name(k)}${you ? l.t('، شما', ', you') : ''}" data-seat="${k}">
  <div class="an-panel__head"><span class="bgv-avatar bgv-avatar--sm${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="--seat-c:var(--an-${SEATS[k].color})${turn ? ';--clock-c:var(--clock-calm)' : ''}">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="an-panel__id"><b style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}<span class="bgv-league bgv-league--${SEATS[k].league[0]}">${l.t(SEATS[k].league[1], SEATS[k].league[2])}</span></b><small>${turn ? l.t('در حال انتخاب کنش', 'choosing an action') : `${l.t('نقشهٔ', 'Map')} ${l.d(P(k).map)}: ${M.maps[P(k).map].nameFa}`}</small></div>${scoreBadge(l, k)}</div>
  ${counters(l, k)}
  ${goal(l, k)}
  ${iconCounts(l, k)}
 </div>`;
}
function log(l) {
  return ` <section class="bgv-card an-log" aria-label="${l.t('گزارش بازی', 'Game log')}"><ol class="bgv-log">
  <li class="bgv-log__item bgv-log__item--round">${l.t('نوبت', 'Turn')} ${l.d(V.turnsDone + 1)}</li>
  <li class="bgv-log__item"><b>${l.name(3)}</b> ${l.t('کنش «حامیان» با قدرت ۴: ۴ پول و ۴ خانه در مسیر استراحت', 'Sponsors at strength 4: 4 money, break +4')} ${ui('break')}</li>
  <li class="bgv-log__item"><b>${l.name(2)}</b> ${l.t(`«${M.names[449]}» را در محوطهٔ ۲ خانه گذاشت: +۲`, 'played an animal: +2')} ${ui('appeal')}</li>
  <li class="bgv-log__item"><b>${l.name(1)}</b> ${l.t('از پروژهٔ «تنوع گونه‌ها» حمایت کرد: +۲', 'supported Species Diversity: +2')} ${ui('conservation')}</li>
  <li class="bgv-log__item"><b>${l.name(1)}</b> ${l.t('کنش نشان X با کارت «ساخت»', 'X-token action with Build')} ${ui('xtoken')}</li>
 </ol></section>`;
}
function rail(l) {
  return `<aside class="an-rail" dir="${l.dir}" aria-label="${l.t('بازیکنان', 'Players')}">
 ${dashboard(l)}
${ORDER.map((k) => panel(l, k)).join('\n')}
${log(l)}
</aside>`;
}

// ---------------- action bar: choose an action card (+ X-tokens) or the X-token action ----------------
function actionBar(l, opts = {}) {
  const me = P(ME);
  const xs = opts.x ?? 0;
  const btn = (k, i) => {
    const ok = canAct(k), str = me.strengths[i] + xs;
    return `<button class="bgv-btn bgv-btn--secondary bgv-btn--sm an-opt" type="button" data-opt="a:${k}:${xs}"${ok ? '' : ` disabled="" data-reason="NOTHING" title="${reason(l, 'NOTHING')}"`}>${ui('act-' + k)}${l.act(k)}${me.up[k] ? ' II' : ''} <span class="an-strength an-num">${l.d(str)}</span></button>`;
  };
  return `<section class="an-bar an-prompt" aria-live="polite" aria-label="${l.t('نوار کنش', 'Action bar')}" data-an-actbar="">
 <div class="an-bar__row"><span class="an-bar__text"><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': یک کارت کنش را بازی کنید (قدرت = شمارهٔ خانه) یا کنش نشان X. کارت‌های کنش روی نقشهٔ شما هم زدنی‌اند.', ': play an action card (strength = its slot) or take the X-token action. The action cards on your map are clickable too.')}</span>${clock(l)}</div>
 <div class="an-bar__row an-options" role="toolbar" aria-label="${l.t('کارت‌های کنش', 'Action cards')}">
  ${me.slots.map((k, i) => btn(k, i)).join('\n  ')}
  <span class="an-xseg" role="group" aria-label="${l.t('نشان X خرج کنید', 'Spend X-tokens')}"><span>${ui('xtoken')}${l.t('خرج', 'Spend')}</span>${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" aria-pressed="${n === xs}"${n > me.x ? ' disabled=""' : ''}>${l.d(n)}</button>`).join('')}</span>
  <span class="bgv-spacer"></span>
  <button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="x-mode" aria-haspopup="menu">${ui('xtoken')}${l.t('کنش نشان X…', 'X-token action…')}</button>
 </div>
 <p class="an-bar__hint">${l.t('هر نشان X یک قدرت اضافه است. «کنش نشان X»: یک کارت را بدون اجرا به خانهٔ ۱ ببرید و ۱ نشان X بگیرید. بعد از انتخاب، کنش قدم‌به‌قدم همین‌جا پرسیده می‌شود.', 'Each X-token adds 1 strength. X-token action: move a card to slot 1 without using it and take 1 X-token. After you choose, the action asks its steps right here.')}</p>
</section>`;
}

// ---------------- hand ----------------
function handCard(l, h, opts = {}) {
  const ok = !h.error;
  const pick = opts.pick || (ok ? 'selectable' : 'none');
  const note = h.kind === 'sponsor' && ok ? l.t(`سطح ${l.d(h.level)}؛ با ۲ نشان X`, `level ${h.level}; with 2 X`) : h.kind === 'animal' && ok ? l.t(`${l.d(h.cost)} پول`, `${h.cost} money`) : h.kind === 'project' && ok ? l.t('با کنش انجمن', 'via Association') : '';
  return `<div><button class="an-card" type="button" data-pick="${pick}"${ok ? '' : ` aria-disabled="true" data-reason="${h.error}"`} data-id="${h.id}" data-flip="card-${h.id}" style="--cw:${opts.cw || 128}px" aria-label="${l.card(h.id)}${ok ? '' : '، ' + reason(l, h.error)}">${cardImg(h.id)}${pick === 'picked' ? `<span class="an-check" aria-hidden="true">${ICONS.check}</span>` : ''}</button><span class="an-card__fa" style="inline-size:${opts.cw || 128}px">${l.card(h.id)}</span><span class="an-card__why" style="inline-size:${opts.cw || 128}px">${ok ? note : reason(l, h.error)}</span></div>`;
}
function handZone(l) {
  return `<section class="bgv-felt an-zone an-handzone" aria-label="${l.t('دست شما', 'Your hand')}">
 <div class="an-zone__head"><h2>${l.t('دست شما', 'Your hand')}</h2><small>${l.t(`${l.d(M.handInfo.length)} کارت از سقف ${l.d(P(ME).handLimit)} در استراحت؛ قابل بازی‌ها حلقه دارند. نشانگر را نگه دارید تا کارت بزرگ و متن فارسی دیده شود.`, `${M.handInfo.length} cards; playable ones are ringed. Hover for the big card and the rules text.`)}</small></div>
 <div class="an-hand">
${M.handInfo.map((h) => '  ' + handCard(l, h)).join('\n')}
 </div>
</section>`;
}
function zoomCard(l, id, extra = '') {
  const t = faText(id);
  return `<div class="an-zoom" role="tooltip">${cardImg(id, 'alt=""')}<div><h3>${l.card(id)}</h3><p>${t.textFa ? l.d(t.textFa) : ''}</p>${extra}<small dir="ltr" class="bgv-latin">#${id}</small></div></div>`;
}

// ---------------- main board: display folders, appeal / conservation / reputation / break tracks ----------------
function stackOffset(list) { // pieces on the same space fan out a little (BGA)
  const seen = {};
  return list.map(([k, x, y]) => { const key = `${Math.round(x)}_${Math.round(y)}`; const n = seen[key] = (seen[key] || 0) + 1; return [k, x + (n - 1) * 16, y - (n - 1) * 12]; });
}
function mainBoard(l, opts = {}) {
  let h = `<div class="an-boardimg an-main-board" dir="ltr" data-an-board="main" role="group" aria-label="${l.t('بورد اصلی: ویترین، مسیر جذابیت، حفاظت، اعتبار و استراحت', 'Main board: display, appeal, conservation, reputation and break tracks')}">
  ${IMG('boards/main-board', `class="an-base" alt="" width="3000" height="814"`)}\n`;
  const at3 = (x, y) => at(x, y, MB_W, MB_H);
  const range = P(ME).range;
  V.display.forEach((id, i) => {
    if (!id) return;
    h += `  <button class="an-hot" type="button" data-folder="${i + 1}" style="${at3(FOLDER_X[i], FOLDER.y)};inline-size:6.2%;aspect-ratio:400/558" aria-label="${l.t('پوشهٔ', 'Folder')} ${l.d(i + 1)}: ${l.card(id)}${i < range ? l.t('، در محدودهٔ اعتبار شما', ', in your reputation range') : ''}">${cardImg(id, `class="an-fcard${i < range && opts.range !== false ? ' is-range' : ''}" alt="" style="inline-size:100%;position:static;transform:none"`)}</button>\n`;
  });
  h += `  ${IMG('card-backs/card-back-zoo', `class="an-at an-fcard" alt="" style="${at3(...DECK_XY)}"`)}<span class="an-badge" style="${at3(DECK_XY[0], DECK_XY[1] + 150)}">${l.t('دسته', 'Deck')} <span class="an-num">${l.d(V.deckCount)}</span></span>\n`;
  h += `  <span class="an-badge" style="${at3(...DISCARD_XY)}">${l.t('دورریخته', 'Discard')} <span class="an-num">${l.d(V.discardCount)}</span></span>\n`;
  for (const m of ['5', '8']) V.bonusTiles[m].forEach((t, i) => { h += `  ${IMG('bonus-tiles/' + BONUS_FILE[t], `class="an-at an-piece an-btile" alt="${M.tiles[t]}" title="${M.tiles[t]}" style="${at3(...BONUS_XY[m][i])}"`)}\n`; });
  const pts = (fn) => stackOffset(V.players.map((p) => [p.seat, ...fn(p)]));
  for (const [k, x, y] of pts((p) => appealXY(Math.min(113, p.appeal)))) h += `  ${piece('counter', k, 'an-counter', x, y, MB_W, MB_H, `${l.name(k)}: ${l.t('جذابیت', 'appeal')} ${l.d(P(k).appeal)}`)}\n`;
  for (const [k, x, y] of pts((p) => cpXY(p.cp))) h += `  ${piece('counter', k, 'an-counter', x, y, MB_W, MB_H, `${l.name(k)}: ${l.t('حفاظت', 'conservation')} ${l.d(P(k).cp)}`)}\n`;
  for (const [k, x, y] of pts((p) => repXY(p.rep))) h += `  ${piece('counter', k, 'an-counter', x, y, MB_W, MB_H, `${l.name(k)}: ${l.t('اعتبار', 'reputation')} ${l.d(P(k).rep)}`)}\n`;
  const [bx, by] = breakXY(V.brk, V.brkMax);
  h += `  ${IMG('wooden-pieces/break-token', `class="an-at an-piece an-brk" alt="${l.t('نشان استراحت', 'Break token')} ${l.d(V.brk)}/${l.d(V.brkMax)}" style="${at3(bx, by)}"`)}\n`;
  return h + ' </div>';
}

// ---------------- association board + conservation projects ----------------
function projCard(l, id, opts = {}) {
  const toks = V.ptoks[id] || [null, null, null];
  const lv = toks.map((s, i) => {
    const [x, y] = LEVEL_XY[i];
    if (s === -1) return `<span class="an-lvl-x" style="left:${x * 100}%;top:${y * 100}%" title="${l.t('بسته در ۲ نفره', 'Blocked (2 players)')}">${ICONS.x}</span>`;
    if (s === null) return opts.avail && opts.avail.includes(i) ? `<button class="an-hot is-avail" type="button" style="left:${x * 100}%;top:${y * 100}%;inline-size:24%;aspect-ratio:1;border-radius:50%" aria-label="${l.t('سطح', 'Level')} ${l.d(i + 1)}"></button>` : '';
    return IMG(`pieces/cube-${SEATS[s].color}`, `class="an-lvl" alt="${l.name(s)}" style="left:${x * 100}%;top:${y * 100}%"`);
  }).join('');
  return `<div class="an-proj" data-project="${id}" style="--cw:${opts.cw || 112}px"><div class="an-card" title="${l.card(id)}">${cardImg(id)}${lv}</div><span class="an-card__fa" style="inline-size:${opts.cw || 112}px">${l.card(id)}</span></div>`;
}
function assocBoard(l, opts = {}) {
  const at3 = (x, y) => at(x, y, AB_W, AB_H);
  let h = `<div class="an-boardimg an-assoc" dir="ltr" data-an-board="association" role="group" aria-label="${l.t('بورد انجمن', 'Association board')}">
  ${IMG('boards/association-board', `class="an-base" alt="" width="3000" height="1346"`)}\n`;
  for (const z of V.zoosAvail) h += `  ${IMG('partner-zoos/partner-' + z, `class="an-at an-piece an-ptile" alt="${l.t('باغ‌وحش همکار', 'Partner zoo')} ${l.icon(z)}" style="${at3(...ZOO_XY[z])}"`)}\n`;
  for (const u of V.unisAvail) h += `  ${IMG('universities/' + UNI_FILE[u], `class="an-at an-piece an-utile" alt="${M.UNI_FA[u]}" style="${at3(...UNI_AB[u])}"`)}\n`;
  for (let i = 0; i < V.donations; i++) h += `  <span class="an-done" style="${at3(...DONATE_XY[Math.min(i, 7)])}">${ICONS.check}</span>\n`;
  for (const [task, seats] of Object.entries(V.assoc)) seats.forEach((s, i) => { const [x, y] = TASK_XY[task]; h += `  ${piece('worker', s, 'an-worker', x - 60 + i * 70, y, AB_W, AB_H, l.name(s))}\n`; });
  if (opts.hot) for (const [task, ok] of Object.entries(opts.hot)) {
    const [x, y] = TASK_XY[task];
    h += `  <button class="an-hot${ok ? ' is-avail' : ''}" type="button" data-task="${task}" style="${at3(x, y - 330)};inline-size:${task === 'zoo' ? 30 : task === 'uni' ? 24 : 9}%;block-size:${task === 'rep' || task === 'project' ? 60 : 50}%"${ok ? '' : ' disabled=""'} aria-label="${task}"></button>\n`;
  }
  return h + ' </div>';
}
function boardsZone(l) {
  return `<main class="bgv-felt an-zone an-boardzone" aria-label="${l.t('بوردهای مشترک', 'Shared boards')}">
 ${mainBoard(l)}
 <div class="an-boards">
  <div>${assocBoard(l)}</div>
  <div class="an-projcol"><div class="an-zone__head"><h2>${l.t('پروژه‌های حفاظت', 'Conservation projects')}</h2><small>${l.t('پایه + بازی‌شده؛ مکعب = حمایت', 'Base + played; cube = support')}</small></div>
   <div class="an-projrow" style="flex-wrap:wrap">${[...V.baseProjects, ...V.projects].map((id) => projCard(l, id, { cw: 132 })).join('')}</div></div>
 </div>
</main>`;
}

// ---------------- zoo: map + buildings + pieces, action cards hanging below ----------------
function zoo(l, k, opts = {}) {
  const p = P(k);
  const atm = (x, y) => at(x, y, MAP_W, MAP_H);
  let h = `<div class="an-zoomap" dir="ltr" data-an-zoo="${k}"><div class="an-map an-board__map" role="group" aria-label="${l.t('نقشهٔ باغ‌وحش', 'Zoo map')} ${l.name(k)}">
  ${IMG('boards/map-' + p.map, `class="an-base" alt="" width="2000" height="1041"`)}\n`;
  for (const b of p.buildings) {
    const file = bldFile(b);
    if (!file) continue;
    const f = fitBuilding(file, b.cells);
    h += `  ${IMG(file, `class="an-bld" data-building="${b.id}" data-kind="${b.kind}" alt="${M.KIND_FA[b.kind] || b.kind}${b.full ? l.t('، پر', ', occupied') : ''}" style="left:${pct(f.x, MAP_W)};top:${pct(f.y, MAP_H)};inline-size:${pct(f.w, MAP_W)};transform:translate(-50%,-50%) rotate(${f.deg}deg)${f.mx < 0 ? ' scaleX(-1)' : ''}"`)}\n`;
  }
  { const R = HEX.r * 0.96, poly = (x, y) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (60 * i) * Math.PI / 180; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
    h += `  <svg class="an-hexes an-hit" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-hidden="true">${p.buildings.flatMap((b) => b.cells.map((c) => `<polygon class="an-hex--b" data-building="${b.id}" points="${poly(...hexXY(c))}" />`)).join('')}</svg>
`; }
  p.left.forEach((on, i) => { if (on) h += `  ${piece('cube', k, 'an-cube', ...LEFT_XY[i], MAP_W, MAP_H, l.t('نشان لبهٔ نقشه', 'Map edge token'))}\n`; });
  for (let i = p.hired; i < 3; i++) h += `  ${piece('worker', k, 'an-worker', ...WORKER_XY[i], MAP_W, MAP_H, l.t('کارمند استخدام‌نشده', 'Unhired worker'))}\n`;
  p.partners.forEach((z, i) => { h += `  ${IMG('partner-zoos/partner-' + z, `class="an-at an-piece an-ptile" alt="${l.t('باغ‌وحش همکار', 'Partner zoo')} ${l.icon(z)}" style="${atm(...PARTNER_XY[i])}"`)}\n`; });
  p.unis.forEach((u, i) => { h += `  ${IMG('universities/' + UNI_FILE[u], `class="an-at an-piece an-utile" alt="${M.UNI_FA[u]}" style="${atm(...UNI_XY[i])}"`)}\n`; });
  if (opts.picks) {
    const R = HEX.r * 0.96;
    const poly = (x, y) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (60 * i) * Math.PI / 180; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
    h += `  <svg class="an-hexes" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-hidden="true">${opts.picks.map((c) => `<polygon class="an-hex" points="${poly(...hexXY(c))}" />`).join('')}${(opts.ghost || []).map((c) => `<polygon class="an-hex an-hex--ghost" points="${poly(...hexXY(c))}" />`).join('')}</svg>\n`;
    if (opts.ghostKind) { const gf = /^e\d$/.test(opts.ghostKind) ? `enclosures/enclosure-${opts.ghostKind[1]}-empty` : X.KIND_FILE[opts.ghostKind]; const f = fitBuilding(gf, opts.ghost); h += `  ${IMG(gf, `class="an-bld an-bld--ghost" alt="${l.t('پیش‌نمایش', 'Preview')}" style="left:${pct(f.x, MAP_W)};top:${pct(f.y, MAP_H)};inline-size:${pct(f.w, MAP_W)};transform:translate(-50%,-50%) rotate(${f.deg}deg)${f.mx < 0 ? ' scaleX(-1)' : ''}"`)}
`; }
    for (const c of opts.picks) h += `  <button class="an-hot" type="button" data-cell="${c}" style="${atm(...hexXY(c))};inline-size:6.4%;aspect-ratio:1.15;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);border-radius:0" aria-label="${l.t('خانهٔ', 'Space')} ${c}"></button>\n`;
  }
  h += ' </div>\n <div class="an-acts" role="group" aria-label="' + l.t('کارت‌های کنش (خانهٔ ۱ تا ۵)', 'Action cards (slots 1–5)') + '">';
  p.slots.forEach((key, i) => {
    const mine = k === ME && opts.choose !== false;
    const ok = mine && canAct(key);
    const tk = p.tok[key];
    const toks = [...Array(tk.mult).fill('multiplier'), ...Array(tk.venom).fill('venom'), ...Array(tk.con).fill('constriction')];
    h += `<button class="an-act${ok ? ' is-avail' : ''}" type="button" data-act="a:${key}:0" data-slot="${i + 1}"${mine ? '' : ' disabled=""'} aria-label="${l.act(key)}${p.up[key] ? ' II' : ''}، ${l.t('قدرت', 'strength')} ${l.d(p.strengths[i])}">${IMG(actFile(key, p.up[key]), 'alt=""')}<span class="an-act__str an-num">${l.d(p.strengths[i])}</span>${toks.length ? `<span class="an-act__toks">${toks.map((t) => IMG('tokens/' + t, `alt="${t}" title="${t === 'venom' ? l.t('زهر: اگر این نوبت بازی نشود ۲ پول', 'Venom: pay 2 unless played this turn') : t === 'multiplier' ? l.t('دوبرابرکننده', 'Multiplier') : l.t('فشار: قدرت −۲', 'Constriction: −2 strength')}"`)).join('')}</span>` : ''}<span class="an-act__fa">${l.act(key)}${p.up[key] ? ' II' : ''}</span></button>`;
  });
  return h + '</div>\n</div>';
}
function areaHead(l, k) {
  const p = P(k);
  return `<div class="an-ahead"><span class="an-ahead__name" style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}${k === ME ? l.t('، شما', ' (you)') : ''}</span>${scoreBadge(l, k)}${counters(l, k)}<span class="an-ahead__map">${l.t('نقشهٔ', 'Map')} ${l.d(p.map)}: ${M.maps[p.map].nameFa}</span>${iconCounts(l, k)}</div>`;
}
function tableau(l, k) {
  const p = P(k);
  const finals = k === ME ? V.me.finals.map((id) => `<div class="an-card" style="--cw:84px" title="${l.card(id)}">${cardImg(id)}</div>`).join('')
    : Array(p.finalsCount).fill(`<div class="an-card" style="--cw:72px">${IMG('card-backs/card-back-final', 'alt=""')}</div>`).join('');
  return `<div class="an-row2"><div class="an-tableau"><p class="an-tableau__label">${l.t('کارت‌های باغ‌وحش', 'Zoo cards')} (${l.d(p.zoo.length)})</p>${p.zoo.map((id) => `<div><div class="an-card" title="${l.card(id)}" data-flip="card-${id}">${cardImg(id)}</div><span class="an-card__fa" style="inline-size:84px">${l.card(id)}</span></div>`).join('')}</div>
  <div class="an-tableau"><p class="an-tableau__label">${l.t('امتیاز پایانی', 'Final scoring')}${k === ME ? '' : l.t(' (مخفی)', ' (hidden)')}</p>${finals}</div></div>`;
}
function playerArea(l, k, opts = {}) {
  return `<section class="an-player${k === ME ? ' an-player--me' : ''}" style="--pc:var(--an-${SEATS[k].color})" data-seat="${k}" aria-label="${l.t('باغ‌وحش ', 'Zoo of ')}${l.name(k)}">
 ${areaHead(l, k)}
 ${zoo(l, k, opts)}
 ${tableau(l, k)}
</section>`;
}

module.exports = { ME, P, ORDER, canAct, ui, piece, cardImg, faText, reason, gamebar, clock, counters, iconCounts, scoreBadge, goal, dashboard, panel, log, rail, actionBar, handCard, handZone, zoomCard, mainBoard, projCard, assocBoard, boardsZone, zoo, areaHead, tableau, playerArea };
