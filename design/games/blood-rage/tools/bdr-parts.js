// Building blocks of the Blood Rage table (every artboard uses these). P = { state, view } of work/mock.json.
const { C, M, CARD, CLAN, ME, SEATS, at, pct, slug, statVal, STAT_MAX, isBoard, onBoard, inZone, figStr, figArt, IMG, URL, ICONS } = require('./bdr-lib');

const cc = (seat, s = M) => `--cc:var(--bdr-${slug(seat, s)})`;
const ink = (seat, s = M) => `color:var(--bdr-${slug(seat, s)}-ink)`;
const rageIc = (l, n) => `<span class="bdr-rage">${IMG('icon-rage-mini', 'alt=""')}<span class="bdr-num">${l.d(n)}</span></span>`;
const slotOf = (f) => (f.where.startsWith('village:') ? Number(f.where.split(':')[1]) : null);
const provOfFig = (f) => (f.where === 'yggdrasil' ? 0 : f.where.startsWith('village:') ? C.slots[slotOf(f)].province : null);

// ---------------- game bar (DS) ----------------
function gamebar(l, mobile = false) {
  const meta = `<span class="bgv-gamebar__mi is-first">${l.t('نوبتی', 'Turn-based')}</span><span class="bgv-gamebar__mi">${l.t('۲۴ ساعت هر نوبت', '24h per turn')}</span>` + (mobile ? '' : `<span class="bgv-gamebar__mi">${l.t('۴ نفر', '4 players')}</span><span class="bgv-gamebar__mi">${l.t('رتبه‌ای', 'Ranked')}</span>`);
  return `<header class="bgv-gamebar" dir="${l.dir}"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('بازگشت به میزها', 'Back to tables')}">${ICONS.back}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">${l.t('بلاد ریج', 'Blood Rage')}${mobile || !l.fa ? '' : '<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">Blood Rage</span>'}</span><span class="bgv-gamebar__meta">${meta}</span></div>${mobile ? '' : `<div class="bdr-lang" role="group" aria-label="${l.t('زبان بازی', 'Game language')}"><button type="button" aria-pressed="${l.fa}">فا</button><button type="button" aria-pressed="${!l.fa}">EN</button></div><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('قوانین بلاد ریج', 'Blood Rage rules')}">${ICONS.book}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--secondary bgv-iconbtn-count" type="button" aria-label="${l.t('گفت‌وگوی میز، ۲ پیام تازه', 'Table chat, 2 new')}">${ICONS.chat}<span class="bgv-badge bgv-badge--count">${l.d(2)}</span></button>${mobile ? `<button class="bgv-btn bgv-btn--leave bgv-btn--icon" type="button" aria-label="${l.t('ترک میز', 'Leave table')}">${ICONS.leave}</button>` : `<button class="bgv-btn bgv-btn--leave bgv-btn--sm" type="button">${ICONS.leave.replace('bgv-icon"', 'bgv-icon bgv-icon--sm"')}${l.t('ترک میز', 'Leave')}</button>`}<button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="${l.t('گزینه‌های میز', 'Table options')}">${ICONS.more}</button></header>`;
}
const clock = (l, txt) => `<span class="bgv-clock bgv-clock--chip" data-state="calm" style="--p:0.875;" role="timer" aria-label="${l.t('زمان نوبت شما', 'Your turn time')}"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">${txt || l.t('۲۱ ساعت', '21h')}</span></span>`;

// ---------------- status bar (BGA page title) ----------------
// One line: text, then BGA's buttons inline (labels from bloodrage.js). Our additions: «ثبت» before an action is sent
// (DS rule: undo only before confirm), the clock, and one note line with the cost and the effect.
const btn = (label, kind = 'secondary', act = '', extra = '') => `<button class="bgv-btn bgv-btn--${kind} bgv-btn--sm" type="button"${act ? ` data-act="${act}"` : ''}${extra}>${label}</button>`;
function bar(l, text, buttons, opts = {}) {
  return `<section class="bdr-bar${opts.waiting ? ' is-waiting' : ''}" aria-label="${l.t('نوار وضعیت', 'Status bar')}"><div class="bdr-bar__row"><p class="bdr-bar__text">${text}</p>${buttons}${opts.clock === false ? '' : clock(l)}</div>${opts.note ? `<p class="bdr-bar__note">${opts.note}</p>` : ''}</section>`;
}
// «Choose an action:» — Play Quest / Play Upgrade / Play Monster only with such a card in hand (BGA)
function actionButtons(l, s = M, seat = ME) {
  const types = s.hands[seat].map((n) => CARD[n].type);
  const b = [];
  if (types.includes('quest')) b.push(btn(l.t('بازی مأموریت', 'Play Quest'), 'secondary', 'quest'));
  if (types.some((t) => ['leader', 'warrior', 'ship', 'clan'].includes(t))) b.push(btn(l.t('بازی ارتقا', 'Play Upgrade'), 'secondary', 'upgrade'));
  if (types.includes('monster')) b.push(btn(l.t('بازی هیولا', 'Play Monster'), 'secondary', 'monster'));
  b.push(btn(l.act('invade'), 'secondary', 'invade'), btn(l.act('march'), 'secondary', 'march'), btn(l.act('pillage'), 'secondary', 'pillage'), btn(l.act('pass'), 'ghost', 'pass'));
  return b.join('');
}
// «Invade with:» — one button per figure type in the reserve, with its rage cost
function invadeWithButtons(l, s = M, seat = ME) {
  const seen = new Set();
  const b = [];
  for (const f of s.figures.filter((x) => x.seat === seat && x.where === 'reserve')) {
    const k = f.kind === 'monster' ? 'm' + f.monster : f.kind;
    if (seen.has(k)) continue;
    seen.add(k);
    const c = f.kind === 'leader' || (f.kind === 'monster' && [27, 96].includes(f.monster)) ? 0 : figStr(s, f);
    b.push(btn(`${l.figName(s, f)}<span class="bdr-pill">${c ? rageIc(l, c) : l.t('رایگان', 'free')}</span>`, 'secondary', 'invade-' + k));
  }
  return b.join('') + btn(l.t('انصراف', 'Cancel'), 'ghost', 'cancel');
}
const step = (cls, txt) => `<span class="bdr-step ${cls}">${cls === 'is-done' ? ICONS.check : ''}${txt}</span>`;

// main table: Mina invades with the Troll; the last free village of Angerboda is chosen
const PICK = { kind: 'monster', monster: 26, province: 3 };
const empty = (s, p) => (C.provinces[p].villages || []).filter((v) => !s.figures.some((f) => f.where === 'village:' + v));
const pickedSlot = (s = M) => empty(s, PICK.province)[0];
function invadeTargets(s = M) {
  return C.provinces.filter((p) => p.id !== 0 && !s.destroyed.includes(p.id)).map((p) => ({ p: p.id, free: empty(s, p.id).length })).filter((x) => x.free);
}
function actionBar(l) {
  const s = M;
  const before = s.rage[ME];
  const cost = CARD[PICK.monster].value;
  const victims = s.figures.filter((f) => f.seat !== ME && f.kind === 'warrior' && provOfFig(f) === PICK.province);
  return bar(l, l.t(`<b>${l.name(ME)}</b>: یورش با <b>ترول</b> به روستای آنگربودا`, `<b>${l.name(ME)}</b>: invade Angerboda with the <b>Troll</b>`),
    btn(`${ICONS.check}${l.t('ثبت', 'Confirm')}`, 'primary', 'confirm') + btn(l.t('انصراف', 'Cancel'), 'ghost', 'cancel'),
    { note: l.t(`${rageIc(l, cost)} خشم ${l.d(before)} ← ${l.d(before - cost)} · مهره روی نقشه ${l.d(onBoard(s, ME) + 1)} از ${l.d(statVal(s, ME, 'horn'))} · اثر ترول: <b>${victims.map((f) => `${l.fig('warrior')} ${l.name(f.seat)}`).join('، ')}</b> نابود می‌شود. روستای دیگری را روی نقشه بزنید تا عوض شود.`, `${rageIc(l, cost)} rage ${before} → ${before - cost} · the Troll destroys <b>${victims.map((f) => `${l.name(f.seat)}'s warrior`).join(', ')}</b>.`) });
}

// ---------------- map ----------------
// positions of figures: village slot; Yggdrasil = ring around the centre; fjord = row along the fjord point
function figPositions(s) {
  const pos = [];
  const ygg = s.figures.filter((f) => f.where === 'yggdrasil');
  const Y = C.provinces[0];
  ygg.forEach((f, i) => {
    const a = (-120 + i * (360 / Math.max(ygg.length, 6))) * Math.PI / 180;
    pos.push({ f, x: Y.x + Math.cos(a) * 130, y: Y.y + Math.sin(a) * 130 });
  });
  for (const fj of C.fjords) {
    const ships = s.figures.filter((f) => f.where === 'fjord:' + fj.id);
    ships.forEach((f, i) => pos.push({ f, x: fj.x + (i - (ships.length - 1) / 2) * 95, y: fj.y }));
  }
  for (const f of s.figures) if (f.where.startsWith('village:')) { const sl = C.slots[slotOf(f)]; pos.push({ f, x: sl.x, y: sl.y }); }
  return pos;
}
function map(l, opts = {}) {
  const s = opts.state || M;
  const me = ME;
  const doom = s.ragnarok[s.age - 1];
  const parts = [`<img class="bdr-base" src="${URL('main-board')}" alt="${l.t('نقشهٔ بلاد ریج: ایگدراسیل و هشت استان', 'Blood Rage map: Yggdrasil and eight provinces')}">`];
  for (const p of C.provinces) {
    if (s.destroyed.includes(p.id)) { parts.push(IMG('ragnarok', `class="bdr-at bdr-destroyed" style="${at(p.x, p.y)}" data-province="${p.id}" alt="${l.t(`${l.prov(p.id)} نابود شده`, `${l.prov(p.id)} destroyed`)}"`)); continue; }
    const pt = s.pillage[p.id];
    if (pt.pillaged) { parts.push(`<span class="bdr-at bdr-pdone" style="${at(p.x, p.y)}" data-province="${p.id}" dir="${l.dir}">${IMG('icon-' + pt.reward, 'alt=""')}<span>${l.t('غارت موفق', 'Successful pillage')}<br>${l.t('توسط ', 'by ')}<b>${l.name(pt.by)}</b></span></span>`); continue; }
    parts.push(IMG('icon-' + pt.reward, `class="bdr-at bdr-reward" style="${at(p.x, p.y)}" data-province="${p.id}" title="${l.t('پاداش غارت: ', 'Pillage reward: ') + l.reward(pt.reward)}" alt="${l.reward(pt.reward)}"`));
  }
  if (doom != null && !s.destroyed.includes(doom)) parts.push(IMG('icon-destiny', `class="bdr-at bdr-doom" style="${at(C.provinces[doom].doomX, C.provinces[doom].doomY)}" title="${l.t('نشان نابودی: این استان در راگناروک همین عصر نابود می‌شود', 'Doom: this province is destroyed in this Age\'s Ragnarök')}" alt="${l.t('نشان نابودی', 'Doom')}"`));
  const fx = opts.fx || [];
  for (const { f, x, y } of figPositions(s)) {
    const cls = ['bdr-at', 'bdr-tok'];
    if (f.seat === me) cls.push('is-mine');
    if (fx.includes(f.id)) cls.push('is-fx');
    if ((opts.sel || []).includes(f.id)) cls.push('is-sel');
    parts.push(`<span class="${cls.join(' ')}" style="${at(x, y)}" data-fig="${f.id}" data-seat="${f.seat}"><img src="${URL(figArt(s, f))}" style="inline-size:100%;display:block" alt="${l.figName(s, f)} ${l.name(f.seat)}, ${l.t('قدرت', 'STR')} ${l.d(figStr(s, f))}">${fx.includes(f.id) ? IMG('remove', 'class="bdr-x" alt=""') : ''}</span>`);
  }
  for (const sp of opts.spots || []) {
    const sl = C.slots[sp.slot];
    parts.push(`<button class="bdr-spot${sp.on ? ' is-on' : ''}" type="button" style="${at(sl.x, sl.y)}" data-slot="${sp.slot}" aria-label="${l.t('روستای خالی در ', 'Empty village in ') + l.prov(sl.province)}"${sp.on ? ' aria-pressed="true"' : ''}>${sp.on ? '' : IMG('spot-target', 'alt=""')}</button>`);
    if (sp.ghost) parts.push(`<span class="bdr-at bdr-tok is-ghost" style="${at(sl.x, sl.y)}"><img src="${URL(sp.ghost)}" style="inline-size:100%;display:block" alt=""></span>`);
  }
  for (const pv of opts.provs || []) parts.push(`<button class="bdr-prov${pv.on ? ' is-on' : ''}" type="button" style="${at(C.provinces[pv.p].x, C.provinces[pv.p].y + 95)}" data-province="${pv.p}">${pv.label || l.prov(pv.p)}</button>`);
  for (const lb of opts.labels || []) parts.push(`<span class="bdr-mlabel" style="${at(lb.x, lb.y)}">${lb.text}</span>`);
  return `<div class="bdr-map"${opts.size ? ` style="inline-size:${opts.size}"` : ''} data-age="${s.age}">${parts.join('\n')}</div>`;
}
// BGA o-map (80vh): logo top-left, Age badge + page up/down top-right (sticky pager), last battle top-centre,
// zoom on the left, battles archive / discarded cards / Valhalla at the bottom-left; the map fits the box height
function mapBox(l, opts = {}) {
  const s = opts.state || M;
  const h = opts.h || 720;
  const valh = s.figures.filter((f) => f.where === 'valhalla').length;
  return `<section class="bdr-mapbox" dir="ltr" style="--mh:${h}px;background-image:url(${URL('sea-background')})" aria-label="${l.t('نقشه', 'Map')}">
 ${IMG('blood-rage-logo', 'class="bdr-mapbox__logo" alt="Blood Rage"')}
 ${opts.lastBattle != null ? `<button class="bdr-mapbtn bdr-mapbox__battle" type="button" data-open="battle" dir="${l.dir}">${IMG('battle', 'alt=""')}<span>${l.t('آخرین نبرد: ', 'Last battle: ') + l.prov(opts.lastBattle)}</span></button>` : ''}
 <div class="bdr-pager" dir="${l.dir}"><button class="bdr-agebadge" type="button" data-open="ages" aria-label="${l.t('مسیر عصرها', 'Age track')}">${l.t(`عصر ${l.d(s.age)}`, `Age ${s.age}`)}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="${l.t('بخش قبلی', 'Previous section')}">${ICONS.chevU}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="${l.t('بخش بعدی', 'Next section')}">${ICONS.chevD}</button></div>
 <div class="bdr-mapbox__tools"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="${l.t('کل نقشه', 'Fit map')}">${ICONS.fit}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button></div>
 <div class="bdr-mapbox__bottom" dir="${l.dir}"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" data-open="archive" aria-label="${l.t('بایگانی نبردها', 'Battles archive')}">${ICONS.history}</button><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" data-open="discard" aria-label="${l.t(`کارت‌های نبرد دورریخته: ${l.d(s.discardPublic.length)}`, `Discarded battle cards: ${s.discardPublic.length}`)}">${ICONS.cards}</button><button class="bgv-btn bgv-btn--secondary" type="button" data-open="valhalla">${l.t(`والهالا (${l.d(valh)})`, `Valhalla (${valh})`)}</button></div>
 ${map(l, { ...opts, size: `min(calc(100% - 24px), ${h - 20}px);margin-block-start:10px` })}
</section>`;
}

// ---------------- hand ----------------
const cardMeta = (l, n) => {
  const c = CARD[n];
  if (c.type === 'battle') return c.variable ? l.t('نبرد · قدرت متغیر', 'Battle · variable') : l.t(`نبرد · +${l.d(c.value)} قدرت`, `Battle · +${c.value} STR`) + (c.afterReveal ? l.t(' · پس از آشکار شدن', ' · after reveal') : '');
  if (c.type === 'quest') return l.t(`مأموریت · ${l.d(c.value)} افتخار`, `Quest · ${c.value} glory`);
  return `${l.type(c.type)} · ${l.t(`${l.d(c.value)} خشم`, `${c.value} rage`)}`;
};
// BGA shows the bare card; the Persian name and text live in the tooltip and the aria-label (caption only on demand)
function handCard(l, n, opts = {}) {
  const c = CARD[n];
  return `<div class="bdr-hcard"><button class="bdr-card" type="button" data-card="${n}" data-flip="card-${n}"${opts.pick ? ` data-pick="${opts.pick}"` : ''} style="--cw:${opts.cw || 150}px" aria-label="${c.titleEn} (${c.titleFa}): ${c.rulesFa || cardMeta(l, n)}">${IMG(c.art, 'alt=""')}${opts.tag ? `<span class="bdr-cardtag">${opts.tag}</span>` : ''}${opts.pick === 'picked' ? `<span class="bdr-check">${ICONS.check}</span>` : ''}</button>${opts.caption ? `<small>${l.fa ? c.titleFa : c.titleEn}<i>${cardMeta(l, n)}</i></small>` : ''}</div>`;
}
// BGA o-hand / o-draft: a centred title, then the cards in a row from the start edge
function handZone(l, opts = {}) {
  const hand = opts.hand || M.hands[ME];
  return `<section class="bgv-felt bdr-zone bdr-handzone" aria-label="${opts.title || l.t('دست من', 'My hand')}">
 <h2 class="bdr-ztitle">${opts.title || l.t('دست من', 'My hand')}</h2>${opts.sub ? `<p class="bdr-zsub">${opts.sub}</p>` : ''}
 <div class="bdr-hand">${hand.map((n) => handCard(l, n, { pick: opts.pick && opts.pick(n), tag: opts.tag && opts.tag(n), cw: opts.cw, caption: opts.caption })).join('')}</div>
</section>`;
}

function tooltip(l, n) {
  const c = CARD[n];
  return `<div class="bdr-tip" role="tooltip">${IMG(c.art, 'alt=""')}<div><h3>${c.titleFa}<small>${c.titleEn}</small></h3><div class="bdr-tip__meta"><span class="bdr-pill">${l.type(c.type)}</span><span class="bdr-pill">${cardMeta(l, n).split(' · ').slice(1).join(' · ') || l.type(c.type)}</span><span class="bdr-pill">${l.t(`عصر ${l.d(c.age)}`, `Age ${c.age}`)}</span>${c.minPlayers > 2 ? `<span class="bdr-pill">${l.t(`${l.d(c.minPlayers)}+ نفر`, `${c.minPlayers}+ players`)}</span>` : ''}</div><p>${c.rulesFa || l.t(`فقط +${l.d(c.value)} قدرت در نبرد.`, `+${c.value} STR in battle.`)}</p><p style="font-family:var(--font-latin);font-size:12.5px;color:var(--text-muted)" dir="ltr">${c.extraEn ? c.extraEn + ' ' : ''}${c.rulesEn}</p></div></div>`;
}

// ---------------- clan sheet (BGA br-clan-wrapper) ----------------
// title = player name; «Reserve: n» «Quests: n» open dialogs; 9 card slots in BGA order, 5 columns
// [clan, leader, warrior, monster, monster] / [—, ship, clan, clan, clan]; 3 columns on phones (no blank cell)
function sheetSlots(l, s, seat, opts = {}) {
  const cl = slug(seat, s);
  const u = s.upgrades[seat];
  const inv = (kind) => (opts.invade ? opts.invade(kind) : null);
  const slot = (base, card, kind) => `<div class="bdr-slot" data-slot-kind="${kind}"${card ? ` data-card="${card}" data-flip="card-${card}"` : ''}>${IMG(card ? CARD[card].art : base, `alt="${card ? CARD[card].titleEn + ' — ' + CARD[card].titleFa : ''}"`)}${inv(kind) ? `<span class="bdr-slot__inv${inv(kind) === 'picked' ? ' is-on' : ''}">${IMG('hover-invade', 'alt=""')}</span>` : ''}</div>`;
  const cols = opts.cols || 5;
  return `<div class="bdr-slots" dir="ltr" style="--sw:${opts.sw || 150}px;--cols:${cols}">${slot(cl + '-icon-reference', null, 'clan-card')}${slot(cl + '-leader-reference', u.leader, 'leader')}${slot(cl + '-warrior-reference', u.warrior, 'warrior')}${slot('slot-monster', u.monster[0], 'monster')}${slot('slot-monster', u.monster[1], 'monster2')}${cols === 5 ? '<div class="bdr-slot is-void" aria-hidden="true"></div>' : ''}${slot(cl + '-ship-reference', u.ship, 'ship')}${u.clan.map((n, i) => slot('slot-clan', n, 'clan' + i)).join('')}</div>`;
}
// Reserve dialog body (BGA: every figure token in a grid)
function reserveGrid(l, s, seat) {
  return `<div class="bdr-resgrid">${s.figures.filter((f) => f.seat === seat && f.where === 'reserve').map((f) => IMG(figArt(s, f), `alt="${l.figName(s, f)}"`)).join('')}</div>`;
}
function sheet(l, s, seat, opts = {}) {
  const res = s.figures.filter((f) => f.seat === seat && f.where === 'reserve').length;
  return `<article class="bdr-sheet" style="${cc(seat, s)}" data-seat="${seat}" data-flip-anchor="sheet-${seat}">
 <h3 class="bdr-sheet__name" style="${ink(seat, s)}">${l.name(seat)}</h3>
 <div class="bdr-sheet__btns"><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-open="reserve-${seat}">${l.t(`ذخیره: ${l.d(res)}`, `Reserve: ${res}`)}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-open="quests-${seat}">${l.t(`مأموریت‌ها: ${l.d(s.quests[seat].length)}`, `Quests: ${s.quests[seat].length}`)}</button></div>
 ${sheetSlots(l, s, seat, opts)}
</article>`;
}
function sheetsZone(l, opts = {}) {
  const s = M;
  const order = [ME, ...[1, 2, 3].map((k) => (ME + k) % s.players)];
  return `<section class="bgv-felt bdr-zone bdr-sheetszone" aria-label="${l.t('صفحه‌های قبیله', 'Clan sheets')}">
 <div class="bdr-sheets">${order.map((k) => sheet(l, s, k, k === ME ? opts.mine || {} : {})).join('')}</div>
</section>`;
}

// ---------------- rail: BGA player boards, then the log ----------------
// BGA br_board: name + score «n ★»; clan icon, rage box (white number on the rage art), cards in hand, first-player
// horn; the three stats «value/max»; «Stats details»
function panel(l, k, s = M) {
  const me = k === ME, turn = k === s.turn;
  const stat = (key) => `<span class="bdr-stat${s.stats[k][key] >= 3 ? ' is-legend' : ''}" title="${l.stat(key)}: ${l.t('پلهٔ', 'step')} ${l.d(s.stats[k][key] + 1)} ${l.t('از ۶', 'of 6')}">${IMG(`icon-${key}-mini`, 'alt=""')}<span class="bdr-num">${l.d(statVal(s, k, key))}/${l.d(STAT_MAX[key])}</span></span>`;
  const clanName = l.t('قبیلهٔ ', '') + l.clan(s.clans[k]);
  return `<div class="bdr-panel${turn ? ' is-turn' : ''}" style="${cc(k, s)}" data-seat="${k}" data-flip-anchor="seat-${k}" role="button" tabindex="0" aria-label="${l.name(k)}, ${clanName}${me ? l.t('، شما', ', you') : ''}">
 <div class="bdr-panel__head"><b style="${ink(k, s)}">${l.name(k)}</b><span class="bgv-league bgv-league--${SEATS[k].league[0]}">${l.t(SEATS[k].league[1], SEATS[k].league[2])}</span>${turn ? clock(l) : ''}</div>
 <div class="bdr-panel__score" title="${l.t('افتخار', 'Glory')}"><b class="bdr-num">${l.d(s.glory[k])}</b> ★ <small>${l.t('افتخار', 'glory')}</small></div>
 <div class="bdr-panel__line1">${IMG('icon-clan-' + s.clans[k], `class="bdr-panel__clan" alt="${clanName}" title="${clanName}"`)}<span class="bdr-ragebox" title="${l.t(`خشم فعلی؛ شروع هر عصر ${l.d(statVal(s, k, 'rage'))}`, 'Rage now')}">${IMG('icon-rage', 'alt=""')}<b class="bdr-num">${l.d(s.rage[k])}</b></span><span class="bdr-cardbox" title="${l.t('کارت در دست', 'Cards in hand')}">${IMG('board-card', 'alt=""')}<b class="bdr-num">${l.d(s.hands[k].length)}</b></span>${s.first === k ? IMG('firstplayer', `class="bdr-fp" title="${l.t('بازیکن اول این عصر', 'First player this Age')}" alt="${l.t('بازیکن اول', 'First player')}"`) : ''}</div>
 <div class="bdr-stats">${stat('rage')}${stat('axe')}${stat('horn')}</div>
 <button class="bgv-btn bgv-btn--secondary bgv-btn--sm bdr-panel__more" type="button" data-open="stats-${k}">${l.t('جزئیات آمار', 'Stats details')}</button>
</div>`;
}
function log(l, s = M) {
  return `<section class="bgv-card" style="padding:10px 12px" aria-label="${l.t('گزارش بازی', 'Game log')}"><ol class="bgv-log bdr-log">${s.log.slice().reverse().map((e) => `<li class="bgv-log__item" style="${cc(e.seat, s)}"><b style="${ink(e.seat, s)}">${l.name(e.seat)}</b> ${(l.fa ? e.textFa : e.textEn).replace(/^\S+\s/, '')}</li>`).join('')}</ol></section>`;
}
function rail(l, opts = {}) {
  const s = M;
  const order = [ME, ...[1, 2, 3].map((k) => (ME + k) % s.players)];
  return `<aside class="bdr-rail" dir="${l.dir}" aria-label="${l.t('بازیکن‌ها', 'Players')}">${order.map((k) => panel(l, k, s)).join('')}${opts.noLog ? '' : log(l, s)}</aside>`;
}

module.exports = { cc, ink, rageIc, gamebar, clock, btn, bar, actionButtons, invadeWithButtons, step, actionBar, PICK, empty, pickedSlot, invadeTargets, figPositions, map, mapBox, cardMeta, handCard, handZone, tooltip, sheetSlots, reserveGrid, sheet, sheetsZone, panel, log, rail, provOfFig };
