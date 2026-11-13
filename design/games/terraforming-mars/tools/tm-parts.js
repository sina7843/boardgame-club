// HTML parts of the TM table (desktop and phone), BGA layout. Every number shown comes from work/mock.json (engine-checked).
const { CROP, TAGS, M, BW, BH, hex, oxyPos, tempPos, MILESTONE_XY, AWARD_XY, SP_Y, RES, RES_ICON, CORP_FILE, SEATS, pct, at, IMG, ICONS } = require('./tm-lib');

const S = M.state;
const ME = 0;
const icon = (name, cls = 'tm-ic', alt = '') => IMG('i-' + name, `class="${cls}" alt="${alt}"`);
// board overlays are placed inside the cropped window (CROP) of the board image
const atc = (x, y) => at(x - CROP.x, y - CROP.y, CROP.w, CROP.h);
const cube = (color, cls, x, y, alt = '') => IMG('cube-' + color, `class="tm-at tm-cube ${cls}" alt="${alt}" style="${atc(x, y)}"`);
const cardSrc = (id) => (id.startsWith('R') ? 'corp-' + CORP_FILE[id] : 'card-' + id);
const seatStyle = (k) => `--seat-c:var(--tm-${SEATS[k].color})`;
const KIND = (id) => M.cards[id].kind;
const corpName = (l, k) => (l.fa ? M.cards[S.players[k].corp].nameFa : M.cards[S.players[k].corp].name);
const tagCount = (k, g) => (g === 'event' ? M.events[k] : g === 'wild' ? 0 : M.tags[k][g]);
const tilesOf = (k, kind) => Object.values(S.tiles).filter((t) => t.kind === kind && t.owner === k).length;

// error code -> sentence (the renderer only translates engine codes)
function reason(l, code, extra = {}) {
  const T = {
    REQUIREMENTS_NOT_MET: ['شرط کارت برقرار نیست', 'Requirement not met'],
    CANNOT_AFFORD: ['پول کافی ندارید', 'Not enough M€'],
    NO_SPACE: ['جای مجاز روی نقشه نیست', 'No legal area on Mars'],
    ACTION_USED: ['این نسل استفاده شده', 'Used this generation'],
    CANNOT_USE: ['الان قابل استفاده نیست', 'Cannot be used now'],
    MILESTONE_TAKEN: ['ثبت شده', 'Claimed'],
    MILESTONE_NOT_REACHED: ['هنوز نرسیده‌اید', 'Not reached yet'],
    AWARD_TAKEN: ['تأمین شده', 'Funded'],
    CANNOT_CONVERT: ['گیاه کافی ندارید', 'Not enough plants'],
    PARAMETER_MAXED: ['این پارامتر کامل شده', 'Parameter is maxed']
  }[code] || [code, code];
  return l.t(T[0], T[1]) + (extra.detail ? ` (${extra.detail})` : '');
}

// ---------------- shell ----------------
function gamebar(l, mobile = false) {
  const meta = mobile
    ? '<span class="bgv-gamebar__mi is-first">نوبتی</span><span class="bgv-gamebar__mi">۲۴ ساعت هر نوبت</span>'
    : '<span class="bgv-gamebar__mi is-first">نوبتی</span><span class="bgv-gamebar__mi">۲۴ ساعت هر نوبت</span><span class="bgv-gamebar__mi">۴ نفر</span><span class="bgv-gamebar__mi">دوران شرکت‌ها</span>';
  return `<header class="bgv-gamebar" dir="rtl"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="بازگشت به میزها">${ICONS.back}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">ترافورمینگ مارس${mobile ? '' : '<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">Terraforming Mars</span>'}</span><span class="bgv-gamebar__meta">${meta}</span></div>${mobile ? '' : `<div class="tm-lang" role="group" aria-label="زبان بازی"><button type="button" aria-pressed="${l.fa}">فا</button><button type="button" aria-pressed="${!l.fa}">EN</button></div><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="قوانین ترافورمینگ مارس">${ICONS.book}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-iconbtn-count" type="button" aria-label="گفت‌وگوی میز، ۲ پیام تازه">${ICONS.chat}<span class="bgv-badge bgv-badge--count">۲</span></button>${mobile ? `<button class="bgv-btn bgv-btn--leave bgv-btn--icon" type="button" aria-label="ترک میز">${ICONS.leave}</button>` : `<button class="bgv-btn bgv-btn--leave bgv-btn--sm" type="button">${ICONS.leave.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}ترک میز</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="گزینه‌های میز">${ICONS.more}</button></header>`;
}
const clock = (l, chip = true) => `<span class="bgv-clock${chip ? ' bgv-clock--chip' : ''}" data-state="calm" style="--p:0.875;" role="timer" aria-label="${l.t('زمان نوبت شما', 'Your turn time')}"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">${l.t('۲۱ ساعت', '21h')}</span></span>`;

// ---------------- shared bits of the BGA player dashboard ----------------
const scoreBadge = (l, k, big = true) => `<span class="tm-score${big ? '' : ' tm-score--sm'}" title="${l.t('امتیاز فعلی (اگر بازی الان تمام شود)', 'Score now (if the game ended now)')}"><b class="tm-num">${l.d(M.scores[k].total)}</b><small>${l.t('امتیاز', 'VP')}</small></span>`;
const trBadge = (l, k) => `<span class="tm-tr" title="${l.t('رتبهٔ زمین‌سازی (TR)', 'Terraform rating')}"><b>${l.d(S.players[k].tr)}</b></span>`;
const handBadge = (l, k) => `<span class="tm-handn" title="${l.t('کارت در دست', 'Cards in hand')}">${IMG('card-back', 'class="tm-ic" alt=""')}<b class="tm-num">${l.d(S.players[k].hand.length)}</b></span>`;
const corpLogo = (l, k) => `<span class="tm-logo" title="${corpName(l, k)}">${IMG('logo-' + CORP_FILE[S.players[k].corp], `alt="${corpName(l, k)}"`)}</span>`;
// resource: icon with the amount on it, production underneath (BGA "+6" plate)
// BGA area header: icon, then a white box with the amount over the brown production strip
const resSide = (l, k) => RES.map((r) => {
  const p = S.players[k];
  return `<span class="tm-rs" title="${l.res(r)}">${icon(RES_ICON[r])}<span class="tm-rs__nums"><b class="tm-num">${l.d(p.res[r])}</b><span class="tm-prodv${p.prod[r] < 0 ? ' is-neg' : ''}" title="${l.t('تولید هر نسل', 'Production per generation')}">${l.d((p.prod[r] >= 0 ? '+' : '') + p.prod[r])}</span></span></span>`;
}).join('');
const resBoxes = (l, k) => RES.map((r) => {
  const p = S.players[k];
  return `<span class="tm-r" title="${l.res(r)}"><span class="tm-r__ic">${icon(RES_ICON[r])}<b class="tm-num">${l.d(p.res[r])}</b></span><span class="tm-prodv${p.prod[r] < 0 ? ' is-neg' : ''}" title="${l.t('تولید هر نسل', 'Production per generation')}">${l.d((p.prod[r] >= 0 ? '+' : '') + p.prod[r])}</span></span>`;
}).join('');
// tags: the publisher badge with the count on it (BGA); zero counts faded
const tagBadges = (l, k) => TAGS.filter((g) => g !== 'wild').map((g) => {
  const n = tagCount(k, g);
  return `<span class="tm-tagc${n ? '' : ' is-zero'}" title="${l.tag(g)}: ${l.d(n)}">${IMG('tag-' + g, 'alt=""')}<b class="tm-num">${l.d(n)}</b></span>`;
}).join('') + `<span class="tm-tagc tm-tagc--hex" title="${l.t('شهر', 'Cities')}: ${l.d(tilesOf(k, 'city'))}">${icon('city-hex', '')}<b class="tm-num">${l.d(tilesOf(k, 'city'))}</b></span><span class="tm-tagc tm-tagc--hex" title="${l.t('فضای سبز', 'Greeneries')}: ${l.d(tilesOf(k, 'greenery'))}">${icon('greenery-hex', '')}<b class="tm-num">${l.d(tilesOf(k, 'greenery'))}</b></span>`;

// ---------------- rail: global parameters dashboard + BGA player panels ----------------
function dashboard(l) {
  const param = (ic, v, label) => `<span class="tm-param" title="${label}">${icon(ic)}<b class="tm-num">${v}</b></span>`;
  return `<section class="bgv-card tm-dash" aria-label="${l.t('پارامترهای جهانی', 'Global parameters')}">
  <div class="tm-dash__tools"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('راهنما', 'Help')}">${ICONS.book}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('تنظیمات میز', 'Table settings')}" aria-haspopup="dialog">${ICONS.gear}</button></div>
  <div class="tm-dash__params">${param('oxygen', l.d(S.oxygen) + '%', l.t('اکسیژن', 'Oxygen'))}${param('temperature', l.d(S.temperature) + '°C', l.t('دما', 'Temperature'))}${param('ocean', l.d(S.oceans), l.t('اقیانوس از ۹', 'Oceans of 9'))}${param('generation', l.d(S.generation), l.t('نسل', 'Generation'))}</div>
 </section>`;
}
function panel(l, k) {
  const p = S.players[k];
  const you = k === ME, turn = k === S.current;
  const status = p.passed ? `<span class="bgv-pstate bgv-pstate--done">${ICONS.check}${l.t('پاس داده', 'Passed')}</span>` : turn ? `<span>${l.t('کنش ۱ از ۲', 'Action 1 of 2')}</span>` : '';
  return ` <div class="bgv-pcard tm-panel${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}"${turn ? ' style="--clock-c:var(--clock-calm)"' : ''} role="button" tabindex="0" aria-label="${l.name(k)}${you ? l.t('، شما', ', you') : ''}">
  <div class="tm-panel__head"><span class="bgv-avatar bgv-avatar--sm${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="${seatStyle(k)}${turn ? ';--clock-c:var(--clock-calm)' : ''}">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="tm-panel__id"><b style="color:var(--tm-${SEATS[k].color}-ink)">${l.name(k)}<span class="bgv-league bgv-league--${SEATS[k].league[0]}">${l.t(SEATS[k].league[1], SEATS[k].league[2])}</span></b>${status ? `<small>${status}</small>` : ''}</div>${k === S.firstPlayer ? IMG('first-player', `class="tm-fp" alt="${l.t('نفر اول این نسل', 'First player this generation')}" title="${l.t('نفر اول این نسل', 'First player this generation')}"`) : ''}${scoreBadge(l, k)}</div>
  <div class="tm-panel__row">${trBadge(l, k)}${handBadge(l, k)}${corpLogo(l, k)}</div>
  <div class="tm-panel__res">${resBoxes(l, k)}</div>
  <div class="tm-tags" aria-label="${l.t('نشان‌ها و کاشی‌ها', 'Tags and tiles')}">${tagBadges(l, k)}</div>
 </div>`;
}
function rail(l) {
  const order = [3, 0, 1, 2]; // turn order from the first player (BGA lists players in turn order)
  return `<aside class="tm-rail" dir="${l.dir}" aria-label="${l.t('بازیکنان', 'Players')}">
 ${dashboard(l)}
${order.map((k) => panel(l, k)).join('\n')}
 <section class="bgv-card tm-log" aria-label="${l.t('گزارش بازی', 'Game log')}"><ol class="bgv-log">
  <li class="bgv-log__item bgv-log__item--round">${l.t('نسل ۵', 'Generation 5')}</li>
  <li class="bgv-log__item"><b>${l.name(3)}</b> ${l.t('کنش «کارخانهٔ آهن» را زد: ۱ فولاد، اکسیژن ۵٪', 'used Ironworks: 1 steel, oxygen 5%')}</li>
  <li class="bgv-log__item"><b>${l.name(3)}</b> ${l.t('جایزهٔ «بانکدار» را با ۸', 'funded Banker for 8')} ${icon('mc')}</li>
  <li class="bgv-log__item"><b>${l.name(2)}</b> ${l.t('پاس داد', 'passed')}</li>
  <li class="bgv-log__item"><b>${l.name(1)}</b> ${l.t('«آینه‌های فضایی» را بازی کرد', 'played Space Mirrors')}</li>
 </ol></section>
</aside>`;
}

// ---------------- action bar (desktop) ----------------
function actionBar(l) {
  const playable = M.hand.filter((h) => !h.error).length;
  const ms = M.milestones.some((m) => !m.error);
  const ca = M.tableauActions.filter((a) => !a.error).length;
  return `<section class="tm-bar" aria-live="polite" aria-label="${l.t('نوار کنش', 'Action bar')}" data-tm-actbar="">
 <div class="tm-bar__row"><span class="tm-bar__text"><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': کنش ۱ از ۲. یک کنش انتخاب کنید؛ کارت‌های قابل بازی در دست و کنش‌های روی صفحه حلقهٔ کهربایی دارند.', ': action 1 of 2. Choose an action; playable cards in your hand and actions on the boards have an amber ring.')}</span>${clock(l)}</div>
 <div class="tm-bar__row" role="toolbar" aria-label="${l.t('کنش‌ها', 'Actions')}">
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="play">${l.t('بازی کارت', 'Play a card')} <span class="tm-costpill">${l.d(playable)} ${l.t('قابل بازی', 'playable')}</span></button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="project">${l.t('پروژهٔ استاندارد', 'Standard project')}</button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="milestone"${ms ? '' : ` disabled="" data-reason="MILESTONE_NOT_REACHED" title="${l.t('به هیچ نقطهٔ عطف آزادی نرسیده‌اید', 'No free milestone reached')}"`}>${l.t('نقطهٔ عطف', 'Claim milestone')} <span class="tm-costpill">${l.d(8)}${icon('mc')}</span></button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="award">${l.t('تأمین جایزه', 'Fund award')} <span class="tm-costpill">${l.d(14)}${icon('mc')}</span></button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="cardAction">${l.t('کنش کارت', 'Card action')} <span class="tm-costpill">${l.d(ca)}</span></button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="convertHeat">${l.d(8)}${icon('heat')}→${icon('temperature-sm')}</button>
  <button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="convertPlants" disabled="" data-reason="CANNOT_CONVERT" title="${l.t('۶ از ۷ گیاه دارید', 'You have 6 of 7 plants')}">${l.d(M.greeneryPlants)}${icon('plant')}→${icon('greenery')}</button>
  <span class="bgv-spacer"></span>
  <button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="pass">${l.t('پاس (تا آخر نسل)', 'Pass (rest of generation)')}</button>
 </div>
 <p class="tm-bar__hint">${l.t('پروژه‌های استاندارد، نقطه‌های عطف و جایزه‌ها روی خود صفحهٔ مریخ هم زدنی‌اند؛ کنش کارت‌های آبی روی همان کارت. بعد از کنش اول، «پایان نوبت» یا کنش دوم.', 'Standard projects, milestones and awards can also be clicked on the Mars board; blue-card actions on the card itself. After the first action: «End turn» or a second action.')}</p>
</section>`;
}

// ---------------- hand (BGA: cards as they are; playable ones ringed, no cost line, no fading) ----------------
function handCard(l, h, opts = {}) {
  const ok = !h.error;
  const pick = opts.pick || (ok ? 'selectable' : 'none');
  const why = ok ? '' : reason(l, h.error);
  return `<div class="tm-hcard"><button class="tm-card" type="button" data-pick="${pick}"${ok ? '' : ` aria-disabled="true" data-reason="${h.error}" title="${why}"`} data-id="${h.id}" data-flip="card-${h.id}" aria-label="${l.card(h.id)}${ok ? '' : '، ' + why}">${IMG(cardSrc(h.id), 'alt=""')}${pick === 'picked' ? `<span class="tm-check" aria-hidden="true">${ICONS.check}</span>` : ''}</button></div>`;
}
function handZone(l) {
  return `<section class="bgv-felt tm-zone tm-handzone" aria-label="${l.t('دست شما', 'Your hand')}">
 <div class="tm-zone__head"><h2>${l.t('دست شما', 'Your hand')}</h2><small>${l.t(`${l.d(M.hand.length)} کارت؛ قابل بازی‌ها حلقه دارند. نشانگر را روی کارت نگه دارید تا بزرگ شود.`, `${M.hand.length} cards; playable ones are ringed. Hover a card to enlarge it.`)}</small><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('دست شناور: کشوی پایین صفحه', 'Floating hand: drawer at the bottom')}">${ICONS.pin.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}${l.t('شناور', 'Float')}</button></div>
 <div class="tm-hand tm-hand--desk" style="--cw:134px">
${M.hand.map((h) => '  ' + handCard(l, h)).join('\n')}
 </div>
</section>`;
}

// ---------------- Mars board, shown without its TR frame ----------------
function tileImg(t) { return t.kind === 'special' ? 'tile-mining-area' : 'tile-' + t.kind; }
function board(l, opts = {}) {
  const E = opts.empty;
  let h = `<div class="tm-board" dir="ltr" data-tm-board="mars" role="group" aria-label="${l.t('صفحهٔ مریخ (تارسیس)', 'Mars board (Tharsis)')}">
  ${IMG('board-tharsis', `class="tm-base" alt="${l.t('صفحهٔ تارسیس با اکسیژن، دما و اقیانوس', 'Tharsis board with oxygen, temperature and oceans')}" width="1024" height="870"`)}\n`;
  for (const [id, t] of Object.entries(E ? {} : S.tiles)) {
    const [x, y] = hex(id);
    const who = t.owner === null ? '' : ` ${l.name(t.owner)}`;
    h += `  ${IMG(tileImg(t), `class="tm-at tm-tile" data-tm-piece="${t.kind}" data-space="${id}" alt="${l.t({ ocean: 'اقیانوس', city: 'شهر', greenery: 'فضای سبز', special: 'منطقهٔ معدن' }[t.kind], { ocean: 'Ocean', city: 'City', greenery: 'Greenery', special: 'Mining Area' }[t.kind])}${who}" style="${atc(x, y)}"`)}\n`;
    if (t.owner !== null) h += `  ${cube(SEATS[t.owner].color, '', x, y)}\n`;
  }
  const oxy = E ? 0 : S.oxygen, temp = E ? -30 : S.temperature;
  { const [x, y] = oxyPos(oxy); h += `  ${cube('white', 'tm-cube--track', x, y, l.t('اکسیژن ', 'Oxygen ') + l.d(oxy) + '٪')}\n`; }
  { const [x, y] = tempPos(temp); h += `  ${cube('white', 'tm-cube--track', x, y, l.t('دما ', 'Temperature ') + l.d(temp) + '°')}\n`; }
  const MS_FA = ['زمین‌ساز', 'شهردار', 'باغبان', 'سازنده', 'برنامه‌ریز'], MS_EN = ['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner'];
  M.milestones.forEach((m, i) => {
    const [x, y] = MILESTONE_XY[i];
    const own = !E && S.milestones.find((x2) => x2.id === m.id);
    const can = !m.error && !opts.pickOnly && !E;
    h += `  <button class="tm-mabtn${can ? ' is-avail' : ''}" type="button" data-tm-action="milestone-${m.id}"${m.error ? ` disabled="" data-reason="${m.error}"` : ''} aria-label="${l.t('نقطهٔ عطف', 'Milestone')} ${l.t(MS_FA[i], MS_EN[i])}: ${m.error ? reason(l, m.error) : l.t('قابل ثبت', 'claimable')}" style="${atc(x, y + 8)}"></button>\n`;
    if (own) h += `  ${cube(SEATS[own.seat].color, 'tm-cube--plaque', x, y, `${l.name(own.seat)}: ${l.t(MS_FA[i], MS_EN[i])}`)}\n`;
  });
  const AW_FA = ['زمین‌دار', 'بانکدار', 'دانشمند', 'گرماشناس', 'معدنچی'], AW_EN = ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner'];
  M.awards.forEach((a, i) => {
    const [x, y] = AWARD_XY[i];
    const own = !E && S.awards.find((x2) => x2.id === a.id);
    h += `  <button class="tm-mabtn" type="button" data-tm-action="award-${a.id}"${a.error ? ` disabled="" data-reason="${a.error}"` : ''} aria-label="${l.t('جایزه', 'Award')} ${l.t(AW_FA[i], AW_EN[i])}: ${a.error ? reason(l, a.error) : l.t('تأمین با ۱۴ مگاکردیت', 'fund for 14 M€')}" style="${atc(x, y + 10)}"></button>\n`;
    if (own) h += `  ${cube(SEATS[own.seat].color, 'tm-cube--plaque', x, y, `${l.name(own.seat)}: ${l.t(AW_FA[i], AW_EN[i])}`)}\n`;
  });
  const SP_FA = ['فروش امتیاز اختراع', 'نیروگاه', 'سیارک', 'سفرهٔ آب', 'فضای سبز', 'شهر'], SP_EN = ['Sell patents', 'Power plant', 'Asteroid', 'Aquifer', 'Greenery', 'City'];
  M.projects.forEach((p, i) => {
    h += `  <button class="tm-spbtn" type="button" data-act="project-${p.id}" data-tm-action="sp-${p.id}"${p.error ? ` disabled="" data-reason="${p.error}"` : ''} aria-label="${l.t('پروژهٔ استاندارد', 'Standard project')} ${l.t(SP_FA[i], SP_EN[i])}${p.cost ? ' ' + l.d(p.cost) + ' M€' : ''}" style="${atc(148, SP_Y[i])}"></button>\n`;
  });
  if (opts.picks) {
    const R = 38.6;
    const poly = (x, y) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (60 * i - 90) * Math.PI / 180; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
    h += `  <svg class="tm-picks" viewBox="${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}" aria-hidden="true">${opts.picks.map((id) => { const [x, y] = hex(id); return `<polygon class="tm-hex${id === opts.picked ? ' tm-hex--picked' : ''}" points="${poly(x, y)}" />`; }).join('')}</svg>\n`;
    for (const id of opts.picks) {
      const [x, y] = hex(id);
      const sp = M.spaces.find((s) => s.id === id);
      h += `  <button class="tm-hexbtn" type="button" data-space="${id}" data-pick="${id === opts.picked ? 'picked' : 'selectable'}" aria-pressed="${id === opts.picked}" aria-label="${l.t('ناحیهٔ', 'Area')} ${l.d(id)}" style="${atc(x, y)}"></button>\n`;
      if (id === opts.picked) h += `  <span class="tm-check" style="${atc(x + 24, y - 30)}" aria-hidden="true">${ICONS.check}</span>\n`;
      if (opts.bonus && sp.bonus.length) h += `  <span class="tm-bonus" style="${atc(x, y + 30)}">${sp.bonus.map((b) => icon(b === 'plants' ? 'plant' : b === 'card' ? 'card-sm' : b)).join('')}</span>\n`;
    }
  }
  if (opts.plates) h += `  <span class="tm-boardplate tm-boardplate--start">${l.t('دسته', 'Draw')} <b class="tm-num">${l.d(E ? 188 : 118)}</b> · ${l.t('دورریز', 'Discard')} <b class="tm-num">${l.d(E ? 0 : 41)}</b></span>\n  <span class="tm-boardplate tm-boardplate--end">${icon('generation')}${l.t('نسل', 'Gen')} <b class="tm-num">${l.d(E ? 1 : S.generation)}</b></span>\n`;
  return h + ' </div>';
}
function boardZone(l) {
  return `<main class="bgv-felt tm-zone tm-boardzone" aria-label="${l.t('صفحهٔ مریخ', 'Mars board')}">
 ${board(l, { plates: true })}
</main>`;
}

// ---------------- player area (BGA): dashboard header + collapsible card sections, no player board ----------------
function cardEl(l, k, id, opts = {}) {
  const p = S.players[k], c = M.cards[id];
  const act = Object.fromEntries(M.tableauActions.map((a) => [a.id, a]));
  const n = p.cardRes[id];
  const isUsed = p.used.includes(id);
  const avail = k === ME && act[id] && !act[id].error;
  const tag = c.action ? 'button' : 'div';
  return `<${tag} class="tm-card${avail ? ' is-avail' : ''}"${c.action ? ` type="button"${isUsed ? ' disabled=""' : ''}` : ''} data-id="${id}" aria-label="${l.card(id)}${isUsed ? l.t('، کنش این نسل استفاده شده', ', action used this generation') : avail ? l.t('، کنش در دسترس', ', action available') : ''}">${IMG(cardSrc(id), 'alt=""')}${n ? `<span class="tm-cres" title="${l.t('منبع روی کارت', 'Resources on card')}">${IMG('i-' + c.resource, 'class="tm-ic" alt=""')}${l.d(n)}</span>` : ''}${isUsed ? IMG('cube-' + SEATS[k].color, `class="tm-cused" alt="${l.t('استفاده شده', 'used')}"`) : ''}</${tag}>`;
}
function sections(l, k, cw, opts = {}) {
  const p = S.players[k];
  const groups = { hq: [p.corp], automated: [], effects: [], actions: [], events: [] };
  p.played.forEach((id) => {
    const c = M.cards[id];
    if (c.kind === 'event') groups.events.push(id);
    else if (c.kind === 'automated') groups.automated.push(id);
    else groups[c.action ? 'actions' : 'effects'].push(id);
  });
  const SEC = [
    ['hq', 'ستاد', 'Headquarters', 'grid', 'grey'], ['automated', 'خودکار', 'Automated', 'stack', 'green'],
    ['effects', 'اثرها', 'Effects', 'stack', 'blue'], ['actions', 'کنش‌ها', 'Actions', 'stack', 'blue'], ['events', 'رویدادها', 'Events', 'stack', 'red']
  ];
  const collapsed = opts.collapsed || ['events'];
  return `<div class="tm-secs">${SEC.map(([key, fa, en, mode, tone]) => {
    const ids = groups[key], open = !collapsed.includes(key);
    return `<section class="tm-sec tm-sec--${tone}${open ? '' : ' is-closed'}" data-tm-section="${key}" style="--cw:${key === 'hq' ? Math.round(cw * 1.45) : cw}px">
  <div class="tm-sec__head"><button class="tm-sec__toggle" type="button" aria-expanded="${open}"><span class="tm-sec__n">${l.d(ids.length)}</span><span class="tm-sec__t"><b>${l.t(fa, en)}</b><small>${mode === 'grid' ? l.t('شبکه', 'Grid') : l.t('دسته', 'Stack')}</small></span></button><button class="tm-sec__menu" type="button" aria-label="${l.t('چیدمان این بخش: شبکه یا دسته', 'Layout of this section: grid or stack')}">${ICONS.menu}</button></div>
  ${open ? `<div class="tm-sec__body tm-${mode}${mode === 'stack' ? ' tm-stack--' + tone : ''}">${ids.map((id) => cardEl(l, k, id)).join('') || ''}</div>` : ''}
 </section>`;
  }).join('')}</div>`;
}
function areaHead(l, k) {
  const p = S.players[k];
  return `<div class="tm-ahead"><span class="tm-ahead__name" style="color:var(--tm-${SEATS[k].color}-ink)">${l.name(k)}${k === ME ? l.t('، شما', ' (you)') : ''}${p.passed ? ` <small>${l.t('پاس داده', 'passed')}</small>` : ''}</span>${corpLogo(l, k)}${scoreBadge(l, k, false)}${trBadge(l, k)}${handBadge(l, k)}<span class="tm-ahead__res">${resSide(l, k)}</span><span class="tm-tags tm-ahead__tags">${tagBadges(l, k)}</span></div>`;
}
function playerArea(l, k, cw = 150) {
  return `<section class="tm-player" style="--pc:var(--tm-${SEATS[k].color})" data-seat="${k}" aria-label="${l.t('محوطهٔ ', 'Area of ')}${l.name(k)}">
 ${areaHead(l, k)}
 ${sections(l, k, cw)}
</section>`;
}

module.exports = { S, ME, icon, cube, atc, cardSrc, seatStyle, reason, gamebar, clock, dashboard, panel, rail, actionBar, handCard, handZone, board, boardZone, areaHead, sections, playerArea, scoreBadge, trBadge, handBadge, corpLogo, resBoxes, tagBadges };
