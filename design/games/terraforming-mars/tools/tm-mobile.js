// Phone parts (390 x 844): frame, tabs, Mars view, hand, players, docks and the actions sheet.
const { CROP, M, hex, SEATS, IMG, ICONS, L } = require('./tm-lib');
const P = require('./tm-parts');
const { S, ME, icon, cardSrc, seatStyle, reason, clock } = P;

const CSS = `
.tm .bgv-pcard--mini{padding:8px 10px}
.tm .bgv-pcard--mini>.bgv-avatar{margin-block:2px 6px}
.tm .bgv-turn{max-inline-size:100%;min-inline-size:0}
.tm .bgv-pcard__score small{font-size:11px}
@media (max-width:899px){.bgv-gamebar__meta{gap:4px}}
.tm-tabs{display:flex;gap:2px;padding:3px;border-radius:var(--radius-md);background:var(--felt-plate)}
.tm-tabs button{flex:1;block-size:38px;padding-inline:6px;border:0;border-radius:var(--radius-sm);background:none;color:var(--felt-muted);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.tm-tabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink)}
.tm-subtabs{display:flex;gap:6px;overflow:auto}
.tm-subtabs button{flex:none;display:inline-flex;align-items:center;gap:6px;block-size:34px;padding-inline:10px;border-radius:var(--radius-pill);border:1px solid var(--felt-line);background:none;color:var(--felt-ink);font:inherit;font-size:13px;font-weight:700}
.tm-subtabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink);border-color:transparent}
.tm-mview{position:relative;contain:paint;flex:1;min-block-size:0;overflow:hidden;border-radius:var(--radius-md);background:#1B0E09}
.tm-mview--scroll{overflow:auto;background:none;display:flex;flex-direction:column;gap:10px}
.tm-mview--scroll>*{flex:none}
.tm-mview .tm-board.tm-mboard{position:absolute;border-radius:0}
.tm-zoombtns{position:absolute;inset-block-start:8px;inset-inline-start:8px;display:grid;gap:6px;z-index:2}
.tm-mapinfo{position:absolute;inset-block-start:8px;inset-inline-end:8px;z-index:2}
.tm .bgv-actiondock__actions{flex-wrap:nowrap}
.tm .bgv-actiondock__actions>.bgv-btn--primary{flex:1}
.tm-dockprompt{min-inline-size:0;font-size:14px;line-height:1.6;display:grid;gap:6px}
.tm-dockprompt>span b{color:var(--heading)}
.tm-dockhint{font-size:12px;color:var(--text-muted);line-height:1.5}
.tm-mhand{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px}
.tm-mhand .tm-hcard{inline-size:100%}
.tm-mhand .tm-card{inline-size:100%}
.tm-mgrid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
.tm-mgrid2 .tm-hcard,.tm-mgrid2 .tm-card{inline-size:100%}
.tm-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--felt-ink);font-size:13.5px}
.tm-mhead b{font-weight:900}
.tm-mhead small{color:var(--felt-muted);font-size:12px}
.tm-mview .tm-ahead{gap:8px 10px;padding:8px}
.tm-mview .tm-ahead__res{gap:6px}
.tm-mview .tm-ahead .tm-logo{block-size:32px}
.tm-mview .tm-rs>.tm-ic{block-size:38px}
.tm-mview .tm-rs__nums{min-inline-size:34px}
.tm-mview .tm-ahead .tm-tagc{inline-size:34px;block-size:34px}
.tm-mview .tm-secs{gap:10px}
.tm-mtags{display:flex;flex-wrap:wrap;gap:4px}
.tm-mtags .tm-tag{border-color:var(--felt-line);color:var(--felt-muted)}
.tm-mtags .tm-tag b{color:var(--felt-ink)}
.tm-ready{display:flex;gap:6px;flex-wrap:wrap}
.tm-ready span{display:inline-flex;align-items:center;gap:5px;block-size:28px;padding-inline:9px;border-radius:var(--radius-pill);background:var(--felt-plate);color:var(--felt-ink);font-size:12.5px;font-weight:700}
.tm-ready span .bgv-icon{inline-size:14px;block-size:14px;color:var(--success)}
/* actions sheet */
.tm-sheetwrap{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:flex-end}
.tm-sheet{position:relative;max-block-size:84%;padding:0 14px 14px;gap:9px;overflow:auto}
.tm-sheet__head{display:flex;align-items:center;gap:8px;font-size:14px;line-height:1.6}
.tm-sheet__head b{color:var(--heading);font-weight:900}
.tm-sheet__head .bgv-clock{margin-inline-start:auto;flex:none}
.tm-sheet .tm-label{font-size:12px;font-weight:700;color:var(--label)}
.tm-sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.tm-sgrid .bgv-btn{block-size:auto;min-block-size:48px;padding-block:6px;flex-direction:column;gap:1px;white-space:normal;line-height:1.4}
.tm-sgrid .bgv-btn>span{display:inline-flex;align-items:center;gap:3px}
.tm-sgrid .bgv-btn small{font-size:11.5px;font-weight:600;color:var(--text-muted)}
.tm-sgrid .bgv-btn .tm-costpill{block-size:22px}
.tm-srow{display:flex;gap:8px}
.tm-srow .bgv-btn{flex:1}
.tm-choice{display:grid;gap:8px}
.tm-choice .bgv-btn{justify-content:flex-start;block-size:auto;min-block-size:48px;white-space:normal;text-align:start;line-height:1.5}
.tm-choice .bgv-btn[aria-pressed="true"]{box-shadow:0 0 0 3px var(--pick)}
`;

// ---------- frame ----------
function hud(l, opts = {}) {
  const order = [3, 0, 1, 2];
  return `<section class="bgv-hud bgv-hud--strip" aria-label="${l.t('بازیکنان، برای صفحهٔ هر بازیکن بزنید', 'Players, tap for a player board')}">${order.map((k) => {
    const p = S.players[k];
    const you = k === ME, turn = k === S.current && !opts.simul;
    const foot = opts.simul ? (opts.ready?.includes(k) ? `<div class="bgv-pcard__foot"><span class="bgv-pstate bgv-pstate--done">${ICONS.check}${l.t('آماده', 'Ready')}</span></div>` : '')
      : p.passed ? `<div class="bgv-pcard__foot"><span class="bgv-pstate bgv-pstate--done">${ICONS.check}${l.t('پاس داده', 'Passed')}</span></div>` : '';
    return `<div class="bgv-pcard bgv-pcard--mini${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}"${turn ? ' style="--clock-c:var(--clock-calm)"' : ''} role="button" tabindex="0" aria-label="${l.name(k)}"><span class="bgv-avatar bgv-avatar--sm${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="${seatStyle(k)}${turn ? ';--clock-c:var(--clock-calm)' : ''}">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="bgv-pcard__name"><b><i class="bgv-seat" style="${seatStyle(k)}"></i>${you ? `<span class="bgv-sr">${l.name(k)}</span>` : l.name(k)}</b><small>${opts.simul ? '' : (l.fa ? M.cards[p.corp].nameFa : M.cards[p.corp].name)}</small></div><div class="bgv-pcard__score">${l.d(opts.score ?? M.scores[k].total)}<small>${l.t('امتیاز', 'VP')}</small></div>${foot}</div>`;
  }).join('')}</section>`;
}
function tabs(l, sel, handN = 7) {
  const T = [['mars', 'مریخ', 'Mars'], ['hand', typeof handN === 'string' ? handN : `دست ${l.d(handN)}`, typeof handN === 'string' ? handN : `Hand ${handN}`], ['players', 'بازیکنان', 'Players']];
  return `<div class="tm-tabs" role="tablist" aria-label="${l.t('بخش‌های میز', 'Table parts')}">${T.map(([id, fa, en]) => `<button type="button" role="tab" aria-selected="${id === sel}">${l.t(fa, en)}</button>`).join('')}</div>`;
}
function turnRow(l, mine = true, plate) {
  return `<div class="bgv-felt-row" style="flex-wrap:nowrap"><span class="bgv-turn ${mine ? 'bgv-turn--mine' : 'bgv-turn--other'}" role="status"><span class="bgv-turn__who">${mine ? l.t('نوبت شماست', 'Your turn') : l.t('همه هم‌زمان', 'Everyone at once')}</span><span class="bgv-turn__sep"></span>${clock(l, false)}</span><span class="bgv-felt-plate">${plate ?? l.t(`نسل <strong>${l.d(S.generation)}</strong> · کنش ${l.d(1)} از ${l.d(2)}`, `Gen <strong>${S.generation}</strong> · action 1 of 2`)}</span></div>`;
}
function frame(l, { hudOpts = {}, row, tab, view, dock, overlay = '' }) {
  return `<div class="bgv-tablescreen" style="height:844px">
${P.gamebar(l, true)}
${hud(l, hudOpts)}
<main class="bgv-felt" style="padding:12px;gap:8px" aria-label="${l.t('میز ترافورمینگ مارس', 'Terraforming Mars table')}">
 ${row}
 ${tab}
 ${view}
</main>
${dock}
</div>
${overlay}`;
}
const dockBar = (l) => `<section class="bgv-actiondock" aria-label="${l.t('کنش شما', 'Your action')}" data-tm-actbar="">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': کنش ۱ از ۲', ': action 1 of 2')}</span></span></div>
 <div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button" aria-haspopup="dialog">${l.t('کنش‌ها', 'Actions')}</button><button class="bgv-btn bgv-btn--ghost" type="button" data-act="pass">${l.t('پاس', 'Pass')}</button></div>
</section>`;
const steps = (l, list) => `<span class="tm-steps">${list.map(([fa, en, st]) => `<span class="tm-step${st === 'done' ? ' is-done' : st === 'cur' ? ' is-cur' : ''}">${st === 'done' ? ICONS.check : ''}${l.t(fa, en)}</span>`).join('')}</span>`;
const dockBtns = (l, { confirm = true, back = true, cancel = true, confirmLabel } = {}) => `<div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button"${confirm ? '' : ' disabled=""'}>${ICONS.check}${confirmLabel || l.t('تأیید', 'Confirm')}</button>${back ? `<button class="bgv-btn bgv-btn--secondary" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button>` : ''}${cancel ? `<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('لغو این کنش', 'Cancel this action')}">${ICONS.x}</button>` : ''}</div>`;

// ---------- Mars view (board scaled and panned) ----------
function marsView(l, { scale = 1, cx = CROP.x + CROP.w / 2, cy = CROP.y + CROP.h / 2, vw = 366, vh = 420, picks, picked, info }) {
  // cx/cy are board-image pixels; the board element is the cropped window (no TR frame)
  const w = CROP.w * scale, left = Math.round(vw / 2 - (cx - CROP.x) * scale), top = Math.round(vh / 2 - (cy - CROP.y) * scale);
  const b = P.board(l, { picks, picked, bonus: true, pickOnly: !!picks }).replace('<div class="tm-board"', `<div class="tm-board tm-mboard" style="inline-size:${w}px;left:${left}px;top:${top}px"`);
  return `<div class="tm-mview" role="tabpanel" aria-label="${l.t('صفحهٔ مریخ', 'Mars board')}">
 ${b}
 <div class="tm-zoombtns" role="group" aria-label="${l.t('بزرگ‌نمایی', 'Zoom')}"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کل صفحه', 'Whole board')}">${ICONS.fit}</button></div>
 ${info ? `<span class="bgv-felt-plate tm-mapinfo">${info}</span>` : ''}
</div>`;
}

// ---------- screens ----------
function turnMobile(l) { // pending space prompt after the Greenery standard project
  const picks = M.greenerySpaces, picked = '40';
  const view = marsView(l, { scale: 1.1, cx: 346, cy: 462, vh: 262, picks, picked });
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('تصمیم شما', 'Your decision')}" data-tm-pending="space">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt">${steps(l, [['پروژهٔ فضای سبز', 'Greenery project', 'done'], ['جای کاشی', 'Place the tile', 'cur']])}<span>${l.t('فضای سبز روی ناحیهٔ <b>۴۰</b>: ۱ پلهٔ اکسیژن و ۱ رتبه، پاداش چاپ‌شده', 'Greenery on area <b>40</b>: +1 oxygen step and +1 TR, printed bonus')} ${icon('plant')}</span><span class="tm-dockhint">${l.t(`${l.d(picks.length)} جای مجاز خط‌چین دارند. پروژه پرداخت و تأیید شده و برگشت ندارد؛ تا «تأیید» می‌توانید ناحیهٔ دیگری بزنید.`, `${picks.length} legal areas are dashed. The project is paid and confirmed; until «Confirm» you can tap another area.`)}</span></span></div>
 ${dockBtns(l, { back: false, cancel: false, confirmLabel: l.t('تأیید جا', 'Confirm area') })}
</section>`;
  return frame(l, { row: turnRow(l), tab: tabs(l, 'mars'), view, dock });
}
function handMobile(l) { // Domed Crater picked, paying with steel
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('دست شما', 'Your hand')}">
 <div class="tm-mhead"><b>${l.t('دست شما', 'Your hand')}</b><small>${l.t('برای بزرگ‌نمایی، کارت را نگه دارید', 'Long-press a card to enlarge it')}</small></div>
 <div class="tm-mhand">${M.hand.map((h) => P.handCard(l, h, h.id === '016' ? { pick: 'picked' } : {})).join('')}</div>
</div>`;
  const row = (res, label, n, unit, max, on, note) => `<div class="tm-payrow${on ? '' : ' is-off'}">${icon(res)}<span><b>${label}</b> <small>${note}</small></span><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کمتر', 'Less')}"${on && n > 0 ? '' : ' disabled=""'}>${ICONS.minus}</button><b class="tm-num">${l.d(n)}</b><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('بیشتر', 'More')}"${on && n < max ? '' : ' disabled=""'}>${ICONS.plus}</button></div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('پرداخت', 'Payment')}" data-tm-pending="pay">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt">${steps(l, [['کارت', 'Card', 'done'], ['پرداخت', 'Payment', 'cur'], ['تأیید', 'Confirm', '']])}<span>${l.t('بازی <b>دهانهٔ گنبدی</b>', 'Play <b>Domed Crater</b>')} <span class="tm-costpill">${l.d(24)}${icon('mc')}</span></span>
  <div class="tm-pay">${row('steel', l.t('فولاد', 'Steel'), 2, 2, 2, true, l.t('هر واحد ۲؛ نشان ساختمان', '2 each; building tag'))}${row('titanium', l.t('تیتانیوم', 'Titanium'), 0, 3, 1, false, l.t('فقط کارت فضایی', 'space cards only'))}<div class="tm-paysum"><span>${l.t('مگاکردیت', 'M€')} <b class="tm-num">${l.d(20)}</b> + ${l.t('فولاد', 'steel')} <b class="tm-num">${l.d(4)}</b></span><span>${l.t('جمع', 'Total')} <b class="tm-num">${l.d(24)}</b> ${l.t('از', 'of')} ${l.d(24)} ${ICONS.check}</span></div></div></span></div>
 ${dockBtns(l, { confirmLabel: l.t('تأیید و بازی', 'Confirm and play') })}
</section>`;
  return frame(l, { row: turnRow(l), tab: tabs(l, 'hand'), view, dock });
}
function actionsMobile(l) {
  const view = marsView(l, { scale: 0.398, vh: 262 });
  const SP_FA = ['فروش امتیاز اختراع', 'نیروگاه', 'سیارک', 'سفرهٔ آب', 'فضای سبز', 'شهر'], SP_EN = ['Sell patents', 'Power plant', 'Asteroid', 'Aquifer', 'Greenery', 'City'];
  const MS_FA = ['زمین‌ساز', 'شهردار', 'باغبان', 'سازنده', 'برنامه‌ریز'], MS_EN = ['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner'];
  const AW_FA = ['زمین‌دار', 'بانکدار', 'دانشمند', 'گرماشناس', 'معدنچی'], AW_EN = ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner'];
  const btn = (label, sub, dis, code, move) => `<button class="bgv-btn bgv-btn--secondary" type="button" data-act="${move}"${dis ? ` disabled="" data-reason="${code}"` : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
  const sp = M.projects.map((p, i) => btn(`${l.t(SP_FA[i], SP_EN[i])} ${p.cost ? `<span class="tm-costpill">${l.d(p.cost)}${icon('mc')}</span>` : ''}`, p.id === 'sellPatents' ? l.t('هر کارت ۱ مگاکردیت', '1 M€ per card') : '', !!p.error, p.error, 'project')).join('');
  const ms = M.milestones.map((m, i) => btn(l.t(MS_FA[i], MS_EN[i]), m.error === 'MILESTONE_TAKEN' ? l.t('ثبت شده: مینا', 'Claimed: Mina') : m.error ? l.t(`${l.d(m.value[ME])} از ${l.d(m.need)}`, `${m.value[ME]} of ${m.need}`) : '', !!m.error, m.error, 'milestone')).join('');
  const aw = M.awards.map((a, i) => btn(l.t(AW_FA[i], AW_EN[i]), a.error ? l.t('تأمین شده: سارا', 'Funded: Sara') : l.t(`شما ${l.d(a.value[ME])}، بیشترین ${l.d(Math.max(...a.value))}`, `you ${a.value[ME]}, top ${Math.max(...a.value)}`), !!a.error, a.error, 'award')).join('');
  const ca = M.tableauActions.map((a) => btn(l.card(a.id), a.error ? reason(l, a.error) : l.t('در دسترس', 'available'), !!a.error, a.error, 'cardAction')).join('');
  const sheet = `<div class="tm-sheetwrap"><div class="bgv-scrim"></div>
<section class="bgv-sheet tm-sheet" role="dialog" aria-label="${l.t('کنش‌های نوبت شما', 'Your turn actions')}" data-tm-actbar="">
 <div class="bgv-sheet__handle" aria-hidden="true"></div>
 <div class="tm-sheet__head"><span><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': کنش ۱ از ۲', ': action 1 of 2')}</span>${clock(l)}</div>
 <div class="tm-srow"><button class="bgv-btn bgv-btn--secondary" type="button" data-act="play">${l.t('بازی کارت از دست', 'Play a card')} <span class="tm-costpill">${l.d(4)} ${l.t('قابل بازی', 'playable')}</span></button></div>
 <span class="tm-label">${l.t('تبدیل', 'Conversions')}</span>
 <div class="tm-sgrid"><button class="bgv-btn bgv-btn--secondary" type="button" data-act="convertHeat"><span>${l.d(8)}${icon('heat')}→${icon('temperature-sm')}</span><small>${l.t('۱ پلهٔ دما و ۱ رتبه', '+1 temperature, +1 TR')}</small></button><button class="bgv-btn bgv-btn--secondary" type="button" data-act="convertPlants" disabled="" data-reason="CANNOT_CONVERT"><span>${l.d(7)}${icon('plant')}→${icon('greenery')}</span><small>${l.t('۶ از ۷ گیاه دارید', 'You have 6 of 7 plants')}</small></button></div>
 <span class="tm-label">${l.t('کنش کارت (هر نسل یک بار)', 'Card actions (once per generation)')}</span>
 <div class="tm-sgrid">${ca}</div>
 <span class="tm-label">${l.t('پروژهٔ استاندارد', 'Standard projects')}</span>
 <div class="tm-sgrid">${sp}</div>
 <span class="tm-label">${l.t('نقطهٔ عطف (۸ مگاکردیت، ۵ امتیاز)', 'Milestones (8 M€, 5 VP)')}</span>
 <div class="tm-sgrid">${ms}</div>
 <span class="tm-label">${l.t('تأمین جایزه (این بار ۱۴ مگاکردیت)', 'Fund an award (14 M€ now)')}</span>
 <div class="tm-sgrid">${aw}</div>
 <div class="tm-srow"><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="pass">${l.t('پاس تا آخر نسل', 'Pass for this generation')}</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">${l.t('بستن', 'Close')}</button></div>
</section></div>`;
  return frame(l, { row: turnRow(l), tab: tabs(l, 'mars'), view, dock: dockBar(l), overlay: sheet });
}
function boardMobile(l) {
  const k = ME, p = S.players[k];
  const sub = `<div class="tm-subtabs" role="tablist" aria-label="${l.t('بازیکن', 'Player')}">${[0, 3, 1, 2].map((s) => `<button type="button" role="tab" aria-selected="${s === k}"><i class="bgv-seat" style="${seatStyle(s)}"></i>${l.name(s)}${s === ME ? l.t('، شما', ' (you)') : ''}</button>`).join('')}</div>`;
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('صفحهٔ مینا', 'Mina\'s board')}">
 ${sub}
 ${P.areaHead(l, k)}
 ${P.sections(l, k, 150)}
</div>`;
  return frame(l, { row: turnRow(l), tab: tabs(l, 'players'), view, dock: dockBar(l) });
}
function choiceMobile(l) { // Regolith Eaters: engine choice prompt (labels from the card's resolve)
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('صفحهٔ مینا', 'Mina\'s board')}">
 <div class="tm-mhead"><b>${l.t('کارت‌های آبی شما', 'Your blue cards')}</b><small>${l.t('کنش «رگولیت‌خوارها» زده شد', 'Regolith Eaters action used')}</small></div>
 ${P.sections(l, ME, 150, { collapsed: ['hq', 'automated', 'effects', 'events'] }).replace('class="tm-card is-avail" type="button" data-id="033"', 'class="tm-card" type="button" data-id="033" data-pick="picked"')}
</div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('تصمیم شما', 'Your decision')}" data-tm-pending="choice">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt">${steps(l, [['کنش کارت', 'Card action', 'done'], ['انتخاب', 'Choose', 'cur']])}<span><b>${l.card('033')}</b>${l.t(': یکی را انتخاب کنید', ': choose one')}</span>
  <div class="tm-choice" role="radiogroup"><button class="bgv-btn bgv-btn--secondary" type="button" role="radio" aria-pressed="false" aria-checked="false">${l.t('۱ میکروب به این کارت', 'Add 1 microbe to this card')}</button><button class="bgv-btn bgv-btn--secondary" type="button" role="radio" aria-pressed="true" aria-checked="true">${l.t('۲ میکروب بردارید: اکسیژن ۱ پله', 'Remove 2 microbes: raise oxygen 1 step')}</button></div></span></div>
 ${dockBtns(l, { back: false, cancel: false })}
</section>`;
  return frame(l, { row: turnRow(l), tab: tabs(l, 'players'), view, dock });
}
// simultaneous phases: research buy, draft, generation 1 setup
function researchMobile(l) {
  const offer = [['146', true], ['159', true], ['184', false], ['203', false]];
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('پژوهش', 'Research')}">
 <div class="tm-mhead"><b>${l.t('پژوهش نسل ۶', 'Research, generation 6')}</b><small>${l.t('هر کارت ۳ مگاکردیت؛ نخریده‌ها دور ریخته می‌شوند', '3 M€ per card; the rest are discarded')}</small></div>
 <div class="tm-mgrid2">${offer.map(([id, pick]) => P.handCard(l, { id, cost: 3, printed: 3, error: null }, { pick: pick ? 'picked' : 'selectable', noCost: true })).join('')}</div>
 <div class="tm-ready">${[[3, true], [1, true], [2, false]].map(([k, r]) => `<span><i class="bgv-seat" style="${seatStyle(k)}"></i>${l.name(k)} ${r ? ICONS.check + l.t('آماده', 'ready') : l.t('در حال انتخاب', 'choosing')}</span>`).join('')}</div>
</div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('خرید کارت', 'Buy cards')}" data-tm-pending="research">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span>${l.t('خرید <b>۲ کارت</b>', 'Buy <b>2 cards</b>')} <span class="tm-costpill">${l.d(6)}${icon('mc')}</span> ${l.t('از ۳۴ مگاکردیت', 'of 34 M€')}</span><span class="tm-dockhint">${l.t('بعد از «تأیید» عوض نمی‌شود؛ خریدها وقتی همه آماده شدند آشکار و پرداخت می‌شوند.', 'After «Confirm» it cannot change; purchases are revealed and paid when everyone is ready.')}</span></span></div>
 ${dockBtns(l, { confirmLabel: l.t('تأیید خرید', 'Confirm purchase'), cancel: false })}
</section>`;
  return frame(l, { hudOpts: { simul: true, ready: [3, 1] }, row: turnRow(l, false, l.t('پژوهش · نسل <strong>۶</strong>', 'Research · gen <strong>6</strong>')), tab: tabs(l, 'hand', l.t('پژوهش', 'Research')), view, dock });
}
function draftMobile(l) {
  const pack = ['148', '073', '025', '131'];
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('درفت', 'Draft')}">
 <div class="tm-mhead"><b>${l.t('درفت، دور ۱ از ۳', 'Draft, pick 1 of 3')}</b><small>${l.t('یکی را نگه دارید؛ بقیه به نیلوفر می‌رسد', 'Keep one; the rest go to Niloufar')}</small></div>
 <div class="tm-mgrid2">${pack.map((id) => P.handCard(l, { id, cost: 0, printed: 0, error: null }, { pick: id === '073' ? 'picked' : 'selectable', noCost: true })).join('')}</div>
 <div class="tm-ready">${[[3, true], [1, false], [2, true]].map(([k, r]) => `<span><i class="bgv-seat" style="${seatStyle(k)}"></i>${l.name(k)} ${r ? ICONS.check + l.t('برداشت', 'picked') : l.t('در حال انتخاب', 'choosing')}</span>`).join('')}</div>
</div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('درفت', 'Draft')}" data-tm-pending="draft">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span>${l.t('نگه داشتن <b>دانشگاه مریخ</b>', 'Keep <b>Mars University</b>')}</span><span class="tm-dockhint">${l.t('نسل زوج: بسته به نفر بعدی می‌رود؛ نسل فرد: به نفر قبلی. آخرین کارت خودکار برداشته می‌شود.', 'Even generations pass to the next player, odd to the previous one. The last card is taken automatically.')}</span></span></div>
 ${dockBtns(l, { confirmLabel: l.t('نگه دار', 'Keep'), back: false, cancel: false })}
</section>`;
  return frame(l, { hudOpts: { simul: true, ready: [3, 2] }, row: turnRow(l, false, l.t('درفت · نسل <strong>۶</strong>', 'Draft · gen <strong>6</strong>')), tab: tabs(l, 'hand', l.t('درفت', 'Draft')), view, dock });
}
const SETUP = { corps: ['R17', 'R13'], corp: 'R17', offer: ['087', '093', '141', '047', '049', '172', '033', '060', '118', '122'], picked: ['087', '093', '049', '033'] };
function setupMobile(l) {
  const view = `<div class="tm-mview tm-mview--scroll" role="tabpanel" aria-label="${l.t('انتخاب آغازین', 'Starting choice')}">
 <div class="tm-mhead"><b>${l.t('۱. شرکت', '1. Corporation')}</b><small>${l.t('یکی از دو شرکت', 'one of two')}</small></div>
 <div class="tm-mgrid2">${SETUP.corps.map((id) => `<button class="tm-card" type="button" data-pick="${id === SETUP.corp ? 'picked' : 'selectable'}" aria-pressed="${id === SETUP.corp}" aria-label="${l.fa ? M.cards[id].nameFa : M.cards[id].name}">${IMG(cardSrc(id), 'alt=""')}${id === SETUP.corp ? `<span class="tm-check" aria-hidden="true">${ICONS.check}</span>` : ''}</button>`).join('')}</div>
 <div class="tm-mhead"><b>${l.t('۲. کارت‌های آغازین', '2. Starting cards')}</b><small>${l.t('هر کارت ۳ مگاکردیت از پول شرکت', '3 M€ each from the corporation\'s money')}</small></div>
 <div class="tm-mhand">${SETUP.offer.map((id) => P.handCard(l, { id, cost: 3, printed: 3, error: null }, { pick: SETUP.picked.includes(id) ? 'picked' : 'selectable', noCost: true })).join('')}</div>
</div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('انتخاب آغازین', 'Starting choice')}" data-tm-pending="corp">
 <div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span><b>${l.t('اکولاین', 'Ecoline')}</b> + ${l.t('۴ کارت', '4 cards')} <span class="tm-costpill">${l.d(12)}${icon('mc')}</span> ${l.t('از ۳۶؛ می‌ماند ۲۴', 'of 36; 24 left')}</span></span></div>
 ${dockBtns(l, { confirmLabel: l.t('تأیید انتخاب', 'Confirm choice'), cancel: false })}
</section>`;
  return frame(l, { hudOpts: { simul: true, ready: [1], score: 20 }, row: turnRow(l, false, l.t('نسل <strong>۱</strong>', 'Gen <strong>1</strong>')), tab: tabs(l, 'hand', l.t('انتخاب آغازین', 'Setup')), view, dock });
}

module.exports = { CSS, hud, tabs, turnRow, frame, marsView, turnMobile, handMobile, actionsMobile, boardMobile, choiceMobile, researchMobile, draftMobile, setupMobile, SETUP, steps, dockBtns };
