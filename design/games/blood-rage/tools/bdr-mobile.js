// Phone screens (390 x 844), placed side by side at the top of BR-Mobile-Spec (§25-§30 of COMPONENTS.md).
// Same data and components as desktop; the map is the same component scaled and panned.
const { C, M, CARD, ME, slug, statVal, STAT_MAX, onBoard, figArt, IMG, URL, ICONS } = require('./bdr-lib');
const P = require('./bdr-parts');
const PH = require('./bdr-phases');

const CSS = `
.bdr-phones{display:flex;flex-wrap:wrap;justify-content:center;gap:32px;align-items:flex-start;padding:40px 16px}
.bdr-phone{display:grid;gap:10px;justify-items:start}
.bdr-phone>h3{margin:0;font-size:16px;font-weight:900;color:var(--heading);display:flex;gap:8px;align-items:center}
.bdr-phone>h3 .bdr-no{display:inline-grid;place-items:center;min-inline-size:28px;block-size:28px;padding-inline:5px;border-radius:var(--radius-pill);background:var(--selected);color:var(--on-selected);font-size:13px}
.bdr-phone>p{margin:0;max-inline-size:390px;font-size:13px;line-height:1.75;color:var(--text-muted)}
.bdr-dev{position:relative;inline-size:390px;block-size:844px;overflow:hidden;border-radius:28px;box-shadow:0 0 0 10px #10161C,0 12px 30px rgba(0,0,0,.25);background:var(--bg)}
.bdr-dev>.bgv-tablescreen{block-size:844px}
.bdr .bgv-pcard--mini{padding:6px 8px}
.bdr .bgv-pcard--mini img.bdr-mcl{inline-size:30px;block-size:30px;border-radius:50%;box-shadow:0 0 0 2px var(--cc)}
.bdr .bgv-turn{max-inline-size:100%;min-inline-size:0}
.bdr-tabs{display:flex;gap:2px;padding:3px;border-radius:var(--radius-md);background:var(--felt-plate)}
.bdr-tabs button{flex:1;block-size:38px;padding-inline:4px;border:0;border-radius:var(--radius-sm);background:none;color:var(--felt-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.bdr-tabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink)}
.bdr-mview{position:relative;contain:paint;flex:1;min-block-size:0;overflow:hidden;border-radius:var(--radius-md);background:var(--bdr-sea) center/cover}
.bdr-mview--scroll{overflow:auto;background:none;display:flex;flex-direction:column;gap:10px}
.bdr-mview--scroll>*{flex:none}
.bdr-mview>.bdr-mapwrap{position:absolute}
.bdr-zoombtns{position:absolute;inset-block-start:8px;inset-inline-start:8px;display:grid;gap:6px;z-index:6}
.bdr-mapinfo{position:absolute;inset-block-start:8px;inset-inline-end:8px;z-index:6;max-inline-size:62%}
.bdr .bgv-actiondock__actions{flex-wrap:nowrap}
.bdr .bgv-actiondock__actions>.bgv-btn--primary{flex:1}
.bdr-dockprompt{min-inline-size:0;font-size:14px;line-height:1.6;display:grid;gap:6px}
.bdr-dockprompt>span b{color:var(--heading)}
.bdr-dockhint{font-size:12px;color:var(--text-muted);line-height:1.5}
.bdr-dockfx{font-size:12.5px;line-height:1.6;color:var(--text)}
.bdr-dockfx b{color:var(--danger)}
.bdr-mhand{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px}
.bdr-mhand .bdr-hcard,.bdr-mhand .bdr-card{inline-size:100%}
.bdr-mhand .bdr-hcard small{font-size:11.5px}
.bdr-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--felt-ink);font-size:13.5px}
.bdr-mhead b{font-weight:900}
.bdr-mhead small{color:var(--felt-muted);font-size:12px}
.bdr-msheet .bdr-slots{grid-template-columns:repeat(3,var(--sw))}
.bdr-sheetwrap{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;background:var(--scrim)}
.bdr-bsheet{position:relative;max-block-size:86%;padding:0 14px 14px;gap:9px;overflow:auto}
.bdr-bsheet__head{display:flex;align-items:center;gap:8px;font-size:14px;line-height:1.6}
.bdr-bsheet__head b{color:var(--heading);font-weight:900}
.bdr-bsheet__head .bgv-clock{margin-inline-start:auto;flex:none}
.bdr-sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.bdr-sgrid .bgv-btn{block-size:auto;min-block-size:58px;padding-block:6px;flex-direction:column;gap:2px;white-space:normal;line-height:1.4}
.bdr-sgrid .bgv-btn small{font-size:11.5px;font-weight:600;color:var(--text-muted)}
.bdr-sgrid .bgv-btn[aria-pressed="true"]{background:var(--selected);color:var(--on-selected);box-shadow:none}
.bdr-sgrid .bgv-btn[aria-pressed="true"] small{color:inherit;opacity:.85}
.bdr-mrow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:13px;border-inline-start:4px solid var(--cc)}
.bdr-mrow img{inline-size:30px;border-radius:50%}
.bdr-mrow b{font-weight:900;color:var(--heading)}
`;

function hud(l, s = M) {
  const order = [s.first, ...[1, 2, 3].map((k) => (s.first + k) % s.players)];
  return `<section class="bgv-hud bgv-hud--strip" aria-label="${l.t('بازیکنان به ترتیب نوبت', 'Players in turn order')}">${order.map((k) => {
    const you = k === ME, turn = k === s.turn;
    return `<div class="bgv-pcard bgv-pcard--mini${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="${P.cc(k, s)}${turn ? ';--clock-c:var(--clock-calm)' : ''}" role="button" tabindex="0" aria-label="${l.name(k)}">${IMG('icon-clan-' + s.clans[k], 'class="bdr-mcl" alt=""')}<div class="bgv-pcard__name"><b>${you ? `<span class="bgv-sr">${l.name(k)}</span>${l.t('شما', 'You')}` : l.name(k)}</b><small>${l.t(`${l.d(s.rage[k])} خشم، ${l.d(s.hands[k].length)} کارت`, `${s.rage[k]} rage, ${s.hands[k].length} cards`)}</small></div><div class="bgv-pcard__score">${l.d(s.glory[k])}<small>${l.t('افتخار', 'glory')}</small></div></div>`;
  }).join('')}</section>`;
}
function tabs(l, sel, handN) {
  const T = [['map', 'نقشه', 'Map'], ['hand', `دست ${l.d(handN)}`, `Hand ${handN}`], ['clan', 'قبیلهٔ من', 'My clan'], ['players', 'بازیکنان', 'Players']];
  return `<div class="bdr-tabs" role="tablist" aria-label="${l.t('بخش‌های میز', 'Table parts')}">${T.map(([id, fa, en]) => `<button type="button" role="tab" aria-selected="${id === sel}">${l.t(fa, en)}</button>`).join('')}</div>`;
}
function turnRow(l, s, plate) {
  const mine = s.turn === ME;
  return `<div class="bgv-felt-row" style="flex-wrap:nowrap"><span class="bgv-turn ${mine ? 'bgv-turn--mine' : 'bgv-turn--other'}" role="status"><span class="bgv-turn__who">${mine ? l.t('نوبت شماست', 'Your turn') : l.t(`نوبت ${l.name(s.turn)}`, `${l.name(s.turn)} to play`)}</span><span class="bgv-turn__sep"></span>${P.clock(l).replace(' bgv-clock--chip', '')}</span><span class="bgv-felt-plate">${plate ?? l.t(`عصر <strong>${l.d(s.age)}</strong>، ${l.phase(s.phase)}`, `Age <strong>${s.age}</strong>, ${l.phase(s.phase)}`)}</span></div>`;
}
function frame(l, s, { row, tab, view, dock = '', overlay = '' }) {
  return `<div class="bdr-dev"><div class="bgv-tablescreen bdr" style="height:844px" data-age="${s.age}" data-phase="${s.phase}">
${P.gamebar(l, true)}
${hud(l, s)}
<main class="bgv-felt" style="padding:12px;gap:8px" aria-label="${l.t('میز بلاد ریج', 'Blood Rage table')}">
 ${row}
 ${tab}
 ${view}
</main>
${dock}
</div>${overlay}</div>`;
}
const dockBtns = (l, { confirm = true, back = true, cancel = true, confirmLabel } = {}) => `<div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button" data-act="confirm"${confirm ? '' : ' disabled=""'}>${ICONS.check}${confirmLabel || l.t('ثبت', 'Confirm')}</button>${back ? `<button class="bgv-btn bgv-btn--secondary" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button>` : ''}${cancel ? `<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('لغو این اقدام', 'Cancel this action')}">${ICONS.x}</button>` : ''}</div>`;
const steps = (l, list) => `<span class="bdr-steps">${list.map(([fa, en, st]) => P.step(st === 'done' ? 'is-done' : st === 'cur' ? 'is-cur' : '', l.t(fa, en))).join('')}</span>`;

// the map scaled (px per map unit) and panned so (cx, cy) sits in the middle of a vw x vh view
function mapView(l, s, { scale, cx = 800, cy = 800, vw = 366, vh = 400, info, ...opts }) {
  const w = 1600 * scale;
  const left = Math.round(vw / 2 - cx * scale), top = Math.round(vh / 2 - cy * scale);
  return `<div class="bdr-mview" role="tabpanel" aria-label="${l.t('نقشه', 'Map')}" style="background-image:url(${URL('sea-background')})" dir="ltr">
 <div class="bdr-mapwrap" style="left:${left}px;top:${top}px">${P.map(l, { ...opts, state: s, size: w + 'px' })}</div>
 <div class="bdr-zoombtns" role="group" aria-label="${l.t('بزرگ‌نمایی', 'Zoom')}"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-btn--sm" type="button" aria-label="${l.t('کل نقشه', 'Whole map')}">${ICONS.fit}</button></div>
 ${info ? `<span class="bgv-felt-plate bdr-mapinfo" dir="${l.dir}">${info}</span>` : ''}
</div>`;
}

// §25 Invade: auto-zoom on the legal villages, Angerboda picked, Troll effect shown before confirm
function invadeMobile(l) {
  const s = M;
  const slot = P.pickedSlot();
  const targets = P.invadeTargets(s);
  const spots = targets.flatMap(({ p }) => P.empty(s, p).map((v) => ({ slot: v, on: v === slot, ghost: v === slot ? `${slug(ME)}-card-026-troll-token` : null })));
  const xs = spots.map((sp) => C.slots[sp.slot]);
  const x0 = Math.min(...xs.map((p) => p.x)) - 70, x1 = Math.max(...xs.map((p) => p.x)) + 70, y0 = Math.min(...xs.map((p) => p.y)) - 70, y1 = Math.max(...xs.map((p) => p.y)) + 70;
  const vh = 372, scale = Math.min(366 / (x1 - x0), vh / (y1 - y0));
  const victims = s.figures.filter((f) => f.seat !== ME && f.kind === 'warrior' && P.provOfFig(f) === 3).map((f) => f.id);
  const view = mapView(l, s, { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, vh, spots, fx: victims, info: l.t(`بزرگ‌نمایی خودکار: ${l.d(spots.length)} روستای خالی`, `Auto-zoom: ${spots.length} empty villages`) });
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('اقدام شما', 'Your action')}">
 <div class="bgv-actiondock__prompt"><span class="bdr-dockprompt">${steps(l, [['یورش', 'Invade', 'done'], ['ترول', 'Troll', 'done'], ['روستا', 'Village', 'cur']])}<span><b>${l.t('ترول ← آنگربودا', 'Troll → Angerboda')}</b> <span class="bdr-pill">${P.rageIc(l, 2)}</span> ${l.t('خشم ۴ ← ۲', 'rage 4 → 2')}</span><span class="bdr-dockfx">${l.t('اثر ترول: <b>جنگجوی آرش</b> نابود می‌شود.', "Troll: <b>Arash's warrior</b> is destroyed.")}</span><span class="bdr-dockhint">${l.t('تا «ثبت» با «برگرد» عوض می‌شود.', 'Until Confirm, Back changes it.')}</span></span></div>
 ${dockBtns(l)}
</section>`;
  return frame(l, s, { row: turnRow(l, s), tab: tabs(l, 'map', s.hands[ME].length), view, dock });
}

// §26 the actions sheet: six actions with cost; disabled ones say why
function actionsMobile(l) {
  const s = M;
  const view = mapView(l, s, { scale: 366 / 1600, cx: 800, cy: 800, vh: 400 });
  const A = [['upgrade', l.t('بازی ارتقا', 'Play Upgrade'), l.t('خشم = قدرت کارت', 'rage = card STR')], ['monster', l.t('بازی هیولا', 'Play Monster'), l.t('جن تاریکی، ۱ خشم', 'Dark Elf, 1 rage')], ['invade', l.act('invade'), l.t('خشم = قدرت مهره', 'rage = figure STR')], ['march', l.act('march'), l.t('۱ خشم', '1 rage')], ['pillage', l.act('pillage'), l.t('رایگان', 'free')], ['pass', l.act('pass'), l.t('خشم باقی می‌سوزد', 'lose your rage')]];
  const overlay = `<div class="bdr-sheetwrap"><section class="bgv-sheet bdr-bsheet" role="dialog" aria-label="${l.t('اقدام‌ها', 'Actions')}"><span class="bgv-sheet__handle"></span>
 <div class="bdr-bsheet__head"><b>${l.t('یک اقدام انتخاب کنید', 'Choose an action')}</b><span class="bdr-pill">${P.rageIc(l, s.rage[ME])}</span>${P.clock(l)}</div>
 <div class="bdr-sgrid">${A.map(([k, label, sub]) => `<button class="bgv-btn ${k === 'pass' ? 'bgv-btn--ghost' : 'bgv-btn--secondary'}" type="button" data-act="${k}">${label}<small>${sub}</small></button>`).join('')}</div>
 <p class="bdr-note">${l.t(`مهره روی نقشه ${l.d(onBoard(s, ME))} از ${l.d(statVal(s, ME, 'horn'))} (شاخ): فقط یک یورش دیگر جا دارید.`, `${onBoard(s, ME)} of ${statVal(s, ME, 'horn')} figures on the map: room for one more invade.`)}</p>
</section></div>`;
  return frame(l, s, { row: turnRow(l, s), tab: tabs(l, 'map', s.hands[ME].length), view, overlay });
}

// §27 Gods' Gifts on the phone: the pack as a 3-column grid
function draftMobile(l) {
  const s = { ...M, phase: 'draft', turn: ME };
  const pack = [44, 43, 62, 68, 54, 41];
  const view = `<div class="bdr-mview bdr-mview--scroll"><div class="bdr-mhead"><b>${l.t('دستهٔ رسیده از سارا', 'Pack from Sara')}</b><small>${l.t('یکی را نگه دارید، ۵ تا به نیلوفر می‌رسد', 'keep one, 5 go to Niloufar')}</small></div><div class="bdr-mhand">${pack.map((n) => P.handCard(l, n, { cw: 110, pick: n === 44 ? 'picked' : 'selectable' })).join('')}</div><div class="bdr-mhead"><b>${l.t('نگه‌داشته‌ها', 'Kept')}</b><small>${l.t('۲ از ۶ + ۱ از عصر ۱', '2 of 6 + 1 from Age 1')}</small></div><div style="display:flex;gap:8px">${[58, 48, 13].map((n) => P.handCard(l, n, { cw: 64, noCaption: true })).join('')}</div></div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('انتخاب کارت', 'Pick a card')}"><div class="bgv-actiondock__prompt"><span class="bdr-dockprompt"><span><b>${l.t('انتخاب ۳ از ۶', 'Pick 3 of 6')}</b> ${l.t('نیلوفر و سارا انتخاب کرده‌اند', 'Niloufar and Sara have picked')}</span></span></div>${dockBtns(l, { confirmLabel: l.t('نگه دار', 'Keep'), back: false, cancel: false })}</section>`;
  return frame(l, s, { row: turnRow(l, s, l.t('هدایای خدایان', "Gods' Gifts")), tab: tabs(l, 'hand', 3), view, dock });
}

// §28 battle: participants and their figure STR, then the secret card
function battleMobile(l) {
  const s = PH.battleState();
  const rows = [ME, 2].map((k) => `<div class="bdr-mrow" style="${P.cc(k, s)}">${IMG('icon-clan-' + s.clans[k], 'alt=""')}<span><b>${l.name(k)}</b> ${k === ME ? l.t('(غارتگر)', '(pillager)') : ''}<br><small>${PH.figsIn(s, 3).filter((f) => f.seat === k).map((f) => l.figName(s, f)).join('، ')}</small></span><b class="bdr-num" style="font-size:20px">${l.d(PH.clanStr(s, k, 3))}</b></div>`).join('');
  const view = `<div class="bdr-mview bdr-mview--scroll"><div class="bdr-mhead">${IMG('battle', 'style="block-size:22px" alt=""')}<b>${l.t('نبرد در آنگربودا', 'Battle in Angerboda')}</b><small>${l.t('قدرت مهره‌ها پیش از کارت', 'figure STR before cards')}</small></div>${rows}<div class="bdr-mhead"><b>${l.t('یک کارت پنهانی انتخاب کنید', 'Pick a secret card')}</b><small>${l.t('آرش انتخاب کرده', 'Arash has picked')}</small></div><div class="bdr-mhand">${[44, 39, 63, 61, 13].map((n) => P.handCard(l, n, { cw: 110, pick: n === 44 ? 'picked' : 'selectable' })).join('')}</div></div>`;
  const dock = `<section class="bgv-actiondock" aria-label="${l.t('کارت نبرد', 'Battle card')}"><div class="bgv-actiondock__prompt"><span class="bdr-dockprompt"><span><b>${l.card(44)}</b> +${l.d(4)} ← ${l.t('جمع', 'total')} <b class="bdr-num">${l.d(PH.clanStr(s, ME, 3) + 4)}</b></span></span></div>${dockBtns(l, { confirmLabel: l.t('رو به پایین بگذار', 'Play face down'), cancel: false })}</section>`;
  return frame(l, s, { row: turnRow(l, s, l.t('نبرد، مرحلهٔ ۲ از ۳', 'Battle, step 2 of 3')), tab: tabs(l, 'map', 5), view, dock });
}

// §29 my clan sheet: 3x3 slots, reserve, stats
function clanMobile(l) {
  const s = M;
  const stat = (k) => `<span class="bdr-stat">${IMG(`icon-${k}-mini`, 'alt=""')}<span class="bdr-num">${l.d(statVal(s, ME, k))}<small>/${l.d(STAT_MAX[k])}</small></span></span>`;
  const view = `<div class="bdr-mview bdr-mview--scroll bdr-msheet"><div class="bdr-mhead">${IMG('icon-clan-' + s.clans[ME], 'style="inline-size:28px;border-radius:50%" alt=""')}<b>${l.t('قبیلهٔ کلاغ', 'Raven clan')}</b><small>${l.t(`${l.d(s.glory[ME])} افتخار`, `${s.glory[ME]} glory`)}</small></div><div class="bdr-stats">${stat('rage')}${stat('axe')}${stat('horn')}</div><div style="display:flex;gap:8px"><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${l.t(`ذخیره: ${l.d(s.figures.filter((f) => f.seat === ME && f.where === 'reserve').length)}`, 'Reserve')}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${l.t('مأموریت‌ها: ۱', 'Quests: 1')}</button></div>${P.sheetSlots(l, s, ME, { sw: 104, cols: 3 })}</div>`;
  return frame(l, s, { row: turnRow(l, s), tab: tabs(l, 'clan', s.hands[ME].length), view });
}

// §30 end of the Age summary sheet (quests + Ragnarök + Valhalla)
function ageEndMobile(l) {
  const s = PH.afterBattle();
  const view = mapView(l, s, { scale: 366 / 1600, cx: 800, cy: 800, vh: 400 });
  const overlay = `<div class="bdr-sheetwrap"><section class="bgv-sheet bdr-bsheet" role="dialog" aria-label="${l.t('پایان عصر ۲', 'End of Age 2')}"><span class="bgv-sheet__handle"></span>
 <div class="bdr-bsheet__head"><b>${l.t('پایان عصر ۲', 'End of Age 2')}</b></div>
 <div class="bdr-mrow" style="${P.cc(ME)}">${IMG(CARD[48].art, 'style="inline-size:40px;border-radius:3px" alt=""')}<span><b>${l.t('مانهایم! انجام شد', 'Manheim! done')}</b><br><small>${l.t('یک ویژگی را بالا ببرید', 'raise one stat')}</small></span><span class="bdr-ok">+${l.d(7)}</span></div>
 <div class="bdr-kinds">${['rage', 'axe', 'horn'].map((k) => `<button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${IMG(`icon-${k}-mini`, 'class="bdr-ic" alt=""')}${l.stat(k)} ${l.d(statVal(s, ME, k))}→${l.d(C.statTracks[k][s.stats[ME][k] + 1])}</button>`).join('')}</div>
 <div class="bdr-mrow" style="--cc:#E0505C">${IMG('ragnarok', 'alt=""')}<span><b>${l.t('راگناروک: الواگار', 'Ragnarök: Elvagar')}</b><br><small>${l.t('کشتی شما در آبدره هم می‌میرد: ۳ + اژدهاهای آتش ۸', 'your ship in the fjord dies too: 3 + Fire Dragons 8')}</small></span><span class="bdr-ok">+${l.d(11)}</span></div>
 <div class="bdr-mrow" style="${P.cc(ME)}">${IMG(figArt(s, s.figures.find((f) => f.seat === ME && f.kind === 'warrior')), 'alt=""')}<span><b>${l.t('آزادی از والهالا', 'Release Valhalla')}</b><br><small>${l.t('۲ مهره به ذخیره برمی‌گردد', '2 figures return to your reserve')}</small></span><span></span></div>
 ${dockBtns(l, { confirmLabel: l.t('ادامه', 'Continue'), back: false, cancel: false })}
</section></div>`;
  return frame(l, { ...s, phase: 'quest' }, { row: turnRow(l, { ...s, phase: 'quest' }), tab: tabs(l, 'map', 4), view, overlay });
}

const PHONES = [
  [25, 'یورش با بزرگ‌نمایی خودکار', 'نقشه روی روستاهای مجاز بزرگ می‌شود؛ اثر ترول پیش از «ثبت» در داک دیده می‌شود.', invadeMobile],
  [26, 'شیت اقدام‌ها', 'همان دکمه‌های BGA؛ «بازی مأموریت» نیست چون کارت مأموریت در دست ندارید.', actionsMobile],
  [27, 'هدایای خدایان', 'دستهٔ رسیده در سه ستون؛ زدن روی کارت بزرگش می‌کند، دوباره زدن انتخاب.', draftMobile],
  [28, 'نبرد: کارت پنهان', 'قدرت مهره‌های هر طرف، بعد انتخاب پنهانی کارت.', battleMobile],
  [29, 'قبیلهٔ من', 'نه جایگاه در سه ردیف، ذخیره و والهالا، ویژگی‌ها.', clanMobile],
  [30, 'پایان عصر', 'مأموریت، راگناروک و والهالا در یک شیت؛ فقط انتخاب ویژگی تصمیم است.', ageEndMobile]
];
const phones = (l) => `<div class="bdr-phones" dir="rtl">${PHONES.map(([no, t, d, fn]) => `<div class="bdr-phone"><h3><span class="bdr-no">${l.d(no)}</span>${t}</h3><p>${d}</p>${fn(l)}</div>`).join('')}</div>`;
module.exports = { CSS, phones, hud, frame, mapView };
