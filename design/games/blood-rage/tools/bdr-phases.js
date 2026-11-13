// Every phase outside the main Action turn, under the table on BR-Desktop (frames 1-5, numbered like COMPONENTS.md
// §20-§24). Each frame derives its state from the mock by applying the rulebook step it shows, so numbers add up.
const { C, M, CARD, ME, slug, statVal, onBoard, figStr, figArt, IMG, URL, ICONS } = require('./bdr-lib');
const P = require('./bdr-parts');

const clone = (s) => JSON.parse(JSON.stringify(s));
const figsIn = (s, p) => s.figures.filter((f) => P.provOfFig(f) === p || (f.where.startsWith('fjord:') && C.fjords[Number(f.where.split(':')[1])].supports.includes(p)));
// state after the main table's action: the Troll invades Angerboda and destroys Arash's warrior there
function afterTroll() {
  const s = clone(M);
  const slot = P.pickedSlot();
  s.figures.find((f) => f.seat === ME && f.monster === 26).where = 'village:' + slot;
  for (const f of s.figures) if (f.seat !== ME && f.kind === 'warrior' && P.provOfFig(f) === 3) f.where = 'valhalla';
  s.rage[ME] -= 2;
  return s;
}
// Mina's next turn: she pillages Angerboda; Niloufar passes, Arash brings his leader from Yggdrasil (last free village)
function battleState() {
  const s = afterTroll();
  s.turn = ME;
  const lead = s.figures.find((f) => f.seat === 2 && f.kind === 'leader');
  lead.where = 'village:' + P.empty(s, 3)[0];
  return s;
}
// the battle's result applied: Arash's figures in Angerboda die, Mina gains glory, pillages and discards her card
function afterBattle() {
  const s = battleState();
  for (const f of s.figures) if (f.seat === 2 && P.provOfFig(f) === 3) f.where = 'valhalla';
  s.pillage[3] = { ...s.pillage[3], pillaged: true, by: ME };
  s.glory[ME] += statVal(s, ME, 'axe') + 2 + 5;
  s.hands[ME] = s.hands[ME].filter((n) => n !== 44);
  return s;
}
const side = (s, seat, p) => figsIn(s, p).filter((f) => f.seat === seat);
// STR of a clan in a province: Brothers in Arms (23) makes each pair of warriors 3 total
function clanStr(s, seat, p) {
  const fs = side(s, seat, p);
  const u = s.upgrades[seat];
  let w = fs.filter((f) => f.kind === 'warrior');
  let str = fs.filter((f) => f.kind !== 'warrior').reduce((a, f) => a + figStr(s, f), 0);
  if (u.warrior === 23) str += Math.floor(w.length / 2) * 3 + (w.length % 2); else str += w.reduce((a, f) => a + figStr(s, f), 0);
  return str;
}

// zoomed crop of the map around a point (map units), the same map component at a larger size
function mapCrop(l, s, cx, cy, opts = {}) {
  const box = opts.box || 420, size = opts.size || 1150;
  const k = size / 1600;
  return `<div style="position:relative;inline-size:${box}px;block-size:${opts.h || box}px;overflow:hidden;border-radius:var(--radius-md);background:url(${URL('sea-background')}) center/cover" dir="ltr"><div style="position:absolute;left:${Math.round(box / 2 - cx * k)}px;top:${Math.round((opts.h || box) / 2 - cy * k)}px">${P.map(l, { ...opts, state: s, size: size + 'px' })}</div></div>`;
}
const waitChip = (l, seat, done, txt) => `<span class="bdr-step ${done ? 'is-done' : ''}" style="${P.cc(seat)}">${done ? ICONS.check : ''}${l.name(seat)}${txt ? ' · ' + txt : ''}</span>`;
const frame = (no, title, intro, body) => `<section class="bdr-frame" dir="rtl"><h2><span class="bdr-no">${no}</span>${title}</h2>${intro ? `<p>${intro}</p>` : ''}${body}</section>`;

// ---------- §20 Gods' Gifts (draft): BGA o-draft «Choose one card to keep» above o-hand «My hand» ----------
function draft(l) {
  const pack = [44, 43, 62, 68, 54, 41];
  return frame(20, l.t('هدایای خدایان (درفت)، عصر ۲', "Gods' Gifts (draft), Age 2"), l.t('مثل BGA: بالای «دست من» یک بخش «یک کارت نگه دارید» باز می‌شود (فقط در این فاز). کارت انتخابی به «دست من» می‌رود و بقیه به نفر سمت چپ؛ ۶ بار، بعد ۲ کارت آخر بی‌نمایش دور ریخته می‌شود. کارت ذخیره از عصر قبل در دست می‌ماند. همه هم‌زمان؛ منتظرها در پنل خودشان «در حال انتخاب» دارند. ۲ نفره: هر بار ۲ کارت.', ''),
    `${P.bar(l, l.t('<b>هدایای خدایان</b>: یک کارت نگه دارید', "<b>Gods' Gifts</b>: choose one card to keep"), P.btn(`${ICONS.check}${l.t('نگه دار: خردکردن تیر', "Keep: Tyr's Crush")}`, 'primary', 'keep'), { note: l.t('انتخاب ۳ از ۶ · ۵ کارت دیگر به نیلوفر (سمت چپ) می‌رسد · نیلوفر و سارا انتخاب کرده‌اند، آرش هنوز نه', 'Pick 3 of 6 · the other 5 go to Niloufar (left)') })}
 ${P.handZone(l, { hand: pack, title: l.t('یک کارت نگه دارید', 'Choose one card to keep'), pick: (n) => (n === 44 ? 'picked' : 'selectable') })}
 ${P.handZone(l, { hand: [58, 48, 13], tag: (n) => (n === 13 ? l.t('از عصر ۱', 'from Age 1') : '') })}`);
}

// ---------- §21 Battle (pillage): BGA status bar steps, then the «Battle in …!» dialog ----------
function battle(l) {
  const s = battleState();
  const leadFrom = M.figures.find((f) => f.seat === 2 && f.kind === 'leader');
  const callState = afterTroll();
  const freeSlot = P.empty(callState, 3)[0];
  const lines = [[ME, 44, true], [2, 3, false]];
  const strs = Object.fromEntries(lines.map(([k, card]) => [k, clanStr(s, k, 3) + CARD[card].value]));
  const line = ([k, card, attacker]) => `<div class="bdr-bline ${strs[k] === Math.max(...Object.values(strs)) ? 'is-win' : 'is-lose'}" style="${P.cc(k)}"><div class="bdr-bline__who">${IMG('icon-clan-' + s.clans[k], 'alt=""')}<span>${l.name(k)}${attacker ? `<small>${l.t('(غارتگر)', '(Attacker)')}</small>` : ''}</span></div><div class="bdr-bline__str"><b class="bdr-num">${l.d(strs[k])}</b></div><div class="bdr-bline__card">${IMG(CARD[card].art, `alt="${l.card(card)}"`)}</div><div class="bdr-bline__sum">${l.t(`مهره‌ها ${l.d(clanStr(s, k, 3))} + ${l.card(card)} ${l.d(CARD[card].value)}`, `figures ${clanStr(s, k, 3)} + ${CARD[card].value}`)}</div></div>`;
  const glory = s.upgrades[ME].clan.includes(33);
  const dlg = `<div class="bgv-dialog" role="dialog" style="position:static;inline-size:640px;max-inline-size:none;transform:none"><div class="bgv-dialog__head">${IMG('battle', 'style="block-size:26px" alt=""')}<h3 class="bgv-dialog__title">${l.t('نبرد در آنگربودا!', 'Battle in Angerboda!')}</h3><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بستن', 'Close')}">${ICONS.x}</button></div><div class="bgv-dialog__body" style="display:grid;gap:10px">
   <div class="bdr-battle">${lines.map(line).join('')}</div>
   <div class="bdr-result"><span><b>${l.t('مینا برد؛ آنگربودا غارت شد', 'Mina wins: Angerboda is pillaged')}</b></span><span>${l.t(`تبر <b>+${l.d(statVal(s, ME, 'axe'))}</b>`, `Axes <b>+${statVal(s, ME, 'axe')}</b>`)}</span>${glory ? `<span>${l.t('شکوه تور <b>+۲</b>', "Thor's Glory <b>+2</b>")}</span>` : ''}<span>${l.t('پاداش غارت <b>+۵</b>', 'Pillage reward <b>+5</b>')}</span><span>${l.t('۲ مهرهٔ آرش به والهالا', "2 of Arash's figures to Valhalla")}</span></div>
   <div style="display:flex;justify-content:center"><button class="bgv-btn bgv-btn--secondary" type="button">${l.t('بستن', 'Close')}</button></div></div></div>`;
  return frame(21, l.t('نبرد: مینا آنگربودا را غارت می‌کند', 'Battle: Mina pillages Angerboda'), l.t('مثل BGA: ۱) فراخوان: از چپ غارتگر به ترتیب، نوار «یک مهره برای پیوستن به نبرد انتخاب کنید» با «رد» و «رد برای همه»؛ هدف روی نقشه. ۲) کارت نبرد پنهان از «دست من». ۳) کارت‌های «پس از آشکار شدن» (دایرهٔ سفید) از غارتگر به ترتیب. ۴) پنجرهٔ «نبرد در …!» با قدرت هر قبیله در دایرهٔ قرمز و کارتش؛ برابری = همه بازنده. همین پنجره بعداً از دکمهٔ «آخرین نبرد» روی نقشه باز می‌شود.', ''),
    `<div class="bdr-cols" style="grid-template-columns:560px 1fr">
  <div class="bdr-panelbox"><h3>${l.t('۱. فراخوان نبرد (نمای آرش)', "1. Call to battle (Arash's view)")}</h3>
   ${P.bar(l, l.t('یک مهره برای پیوستن به نبرد انتخاب کنید', 'Choose a figure to join the battle'), P.btn(l.t('رد', 'Pass'), 'secondary', 'pass') + P.btn(l.t('رد برای همهٔ نبردها', 'Pass all'), 'ghost', 'pass-all'), { note: l.t('رایگان، حتی با خشم صفر · نیلوفر رد کرد · بعد: سارا، مینا', 'Free, even at zero rage') })}
   ${mapCrop(l, callState, 990, 610, { box: 530, h: 380, size: 1150, spots: [{ slot: freeSlot }], sel: [leadFrom.id] })}</div>
  <div class="bdr-panelbox"><h3>${l.t('۲. کارت نبرد (نمای مینا)', "2. Battle card (Mina's view)")}</h3>
   ${P.bar(l, l.t('یک کارت نبرد انتخاب کنید', 'Choose a battle card'), P.btn(`${ICONS.check}${l.t('بازی کارت', 'Play card')}`, 'primary', 'play-card') + P.btn(l.t('بدون کارت', 'No card'), 'ghost', 'no-card'), { note: l.t(`آرش انتخاب کرده · مهره‌های شما ${l.d(clanStr(s, ME, 3))} + خردکردن تیر ۴ = ${l.d(clanStr(s, ME, 3) + 4)}`, 'Arash has picked') })}
   ${P.handZone(l, { hand: [44, 39, 63, 61, 13], cw: 120, pick: (n) => (n === 44 ? 'picked' : CARD[n].type === 'battle' ? 'selectable' : null) })}</div>
  <div class="bdr-panelbox" style="grid-column:1/-1;justify-items:center"><h3 style="justify-self:start">${l.t('۳. نتیجه (پنجرهٔ BGA)', '3. Result (BGA dialog)')}</h3>${dlg}</div>
 </div>`);
}

// ---------- §22 End of an Age: discard, quests, Ragnarök, Valhalla ----------
function endOfAge(l) {
  const s = afterBattle();
  const doom = 2; // Elvagar
  const dying = figsIn(s, doom);
  const perFig = C.ragnarokGlory[2];
  const bySeat = {};
  for (const f of dying) (bySeat[f.seat] = bySeat[f.seat] || []).push(f);
  const quest = (seat, card, ok, why) => `<div class="bdr-q">${IMG(CARD[card].art, 'alt="" style="inline-size:84px"')}<b style="color:var(--bdr-${slug(seat)}-ink)">${l.name(seat)}</b><span>${l.card(card)}</span>${ok ? `<span class="bdr-ok">${ICONS.check}+${l.d(CARD[card].value)} ${l.t('افتخار', 'glory')}</span>` : `<span class="bdr-no2">${l.t('انجام نشد', 'failed')}</span>`}<small style="color:var(--text-muted)">${why}</small></div>`;
  const dlg = (title, body, icon = '') => `<div class="bgv-dialog" role="dialog" style="position:static;inline-size:auto;max-inline-size:none;transform:none"><div class="bgv-dialog__head">${icon}<h3 class="bgv-dialog__title">${title}</h3><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بستن', 'Close')}">${ICONS.x}</button></div><div class="bgv-dialog__body" style="display:grid;gap:10px">${body}<div style="display:flex;justify-content:center"><button class="bgv-btn bgv-btn--secondary" type="button">${l.t('بستن', 'Close')}</button></div></div></div>`;
  return frame(22, l.t('پایان عصر: دور ریختن، مأموریت‌ها، راگناروک، آزادی از والهالا', 'End of an Age: discard, quests, Ragnarök, release Valhalla'), l.t('مثل BGA: دور ریختن با نوار وضعیت و «دست من»؛ نتیجهٔ مأموریت‌ها و راگناروک در پنجره (برای همه هم‌زمان)؛ انتخاب ویژگی پس از مأموریت موفق با دکمه‌های خشم/تبر/شاخ در نوار. آزادی از والهالا فقط در گزارش و شمارندهٔ «والهالا» دیده می‌شود.', ''),
    `${P.bar(l, l.t('<b>دور ریختن</b>: فقط یک کارت برای عصر بعد نگه دارید', '<b>Discard</b>: keep only one card for the next Age'), P.btn(`${ICONS.check}${l.t('دور ریختن بقیه', 'Discard the rest')}`, 'primary', 'discard'), { note: l.t('چشم هایمدال نگه داشته می‌شود · در عصر ۳ همه دور ریخته می‌شود', "Heimdall's Eye is kept · in Age 3 everything is discarded") })}
 ${P.handZone(l, { hand: [39, 63, 61, 13], cw: 120, pick: (n) => (n === 39 ? 'picked' : 'off') })}
 <div class="bdr-cols" style="grid-template-columns:1.25fr 1fr 0.75fr;align-items:start">
  ${dlg(l.t('مأموریت‌ها', 'Quests'), `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${quest(ME, 48, true, l.t('بیشترین قدرت در آنگربودا', 'most STR in Angerboda'))}${quest(1, 51, false, l.t('یوتونهایم فقط هورگر دارد؛ سارا جلوست', 'only Horgr left; Sara leads'))}${quest(1, 56, false, l.t('۱ مهره در والهالا', '1 figure in Valhalla'))}${quest(3, 53, true, l.t('آندلانگ فقط مال ساراست', 'Andlang is all Sara'))}</div>${P.bar(l, l.t('مأموریت انجام شد: یک ویژگی را بالا ببرید', 'Quest done: raise one stat'), ['rage', 'axe', 'horn'].map((k) => P.btn(`${IMG(`icon-${k}-mini`, 'class="bdr-ic" alt=""')}${l.stat(k)} ${l.d(statVal(s, ME, k))}→${l.d(C.statTracks[k][s.stats[ME][k] + 1])}`, 'secondary', 'stat-' + k)).join(''), { clock: false })}`)}
  ${dlg(l.t('عصر ۲، فاز راگناروک', 'Age 2, Ragnarök phase'), `<div style="display:flex;gap:10px;align-items:center">${IMG('ragnarok', 'style="inline-size:64px" alt=""')}<b style="font-size:15px">${l.t('استان الواگار نابود شد', 'Province Elvagar is destroyed')}</b></div>
   ${mapCrop(l, s, C.provinces[doom].x + 60, C.provinces[doom].y - 40, { box: 380, h: 200, size: 1000, fx: dying.map((f) => f.id) })}
   <table class="bdr-table"><tbody>${Object.entries(bySeat).map(([k, fs]) => `<tr><td><b style="color:var(--bdr-${slug(+k)}-ink)">${l.name(+k)}</b></td><td>${fs.map((f) => l.figName(s, f)).join('، ')}</td><td><b>+${l.d(fs.length * perFig + (fs.some((f) => f.kind === 'ship') && s.upgrades[k].ship === 58 ? 8 : 0))}</b>${fs.some((f) => f.kind === 'ship') && s.upgrades[k].ship === 58 ? `<br><small>${l.t('با اژدهاهای آتش +۸', 'incl. Fire Dragons +8')}</small>` : ''}</td></tr>`).join('')}</tbody></table>
   <p style="margin:0;font-size:13px">${l.t(`${l.d(perFig)} افتخار برای هر مهرهٔ نابودشده؛ نشان نابودی به گیمله می‌رود.`, `${perFig} glory per figure; the Doom token moves to Gimle.`)}</p>`, IMG('ragnarok', 'style="block-size:26px" alt=""'))}
  <div class="bdr-panelbox"><h3>${l.t('آزادی از والهالا (گزارش)', 'Release Valhalla (log)')}</h3>
   <ol class="bgv-log bdr-log">${[0, 1, 2, 3].map((k) => { const n = s.figures.filter((f) => f.seat === k && f.where === 'valhalla').length + dying.filter((f) => f.seat === k).length; return n ? `<li class="bgv-log__item" style="${P.cc(k)}"><b style="color:var(--bdr-${slug(k)}-ink)">${l.name(k)}</b> ${l.t(`${l.d(n)} مهره از والهالا آزاد شد${k === 1 ? `؛ قلمرو لوکی +${l.d(n)}` : ''}`, `released ${n} figures`)}</li>` : ''; }).join('')}</ol>
   <p class="bdr-note">${l.t('نشان‌های غارت برمی‌گردند، بازیکن اول به آرش می‌رسد و عصر ۳ با هدایای خدایان شروع می‌شود.', 'Pillage tokens flip back; the first-player token passes to Arash.')}</p></div>
 </div>`);
}

// ---------- §23 End of the game ----------
function gameEnd(l) {
  // final table of a finished mock game (steps reached at the end of Age 3)
  const rows = [
    { k: 1, glory: 118, steps: { rage: 2, axe: 5, horn: 3 }, extra: 0 },
    { k: ME, glory: 104, steps: { rage: 4, axe: 2, horn: 3 }, extra: 0 },
    { k: 3, glory: 97, steps: { rage: 1, axe: 3, horn: 5 }, extra: 0 },
    { k: 2, glory: 88, steps: { rage: 5, axe: 1, horn: 2 }, extra: 15 }
  ];
  const bonus = (st) => Object.values(st).reduce((a, v) => a + (C.legendary[v] || 0), 0);
  const tot = rows.map((r) => ({ ...r, b: bonus(r.steps), t: r.glory + bonus(r.steps) + r.extra })).sort((a, b) => b.t - a.t);
  const cell = (r, k) => { const v = r.steps[k]; const b = C.legendary[v] || 0; return `<td>${l.d(C.statTracks[k][v])}${b ? ` <span class="bdr-ok">+${l.d(b)}</span>` : ''}</td>`; };
  return frame(23, l.t('پایان بازی', 'End of the game'), l.t('پس از آزادی از والهالای عصر ۳ بازی تمام است. فقط در پایان بازی هر ویژگی که به پلهٔ ۴ یا ۵ رسیده +۱۰ و پلهٔ آخر +۲۰ افتخار می‌دهد. فتح تور (۳ افتخار برای هر مهرهٔ روی نقشه) هم این‌جا حساب می‌شود. بیشترین افتخار برنده است؛ قانون برابری در کتاب نیست، پس رتبهٔ مشترک می‌دهیم (ENGINE.md §۷).', ''),
    `<div class="bdr-cols" style="grid-template-columns:1fr 360px"><table class="bdr-table"><thead><tr><th>${l.t('رتبه', 'Place')}</th><th>${l.t('بازیکن', 'Player')}</th><th>${l.t('افتخار بازی', 'Glory')}</th><th>${l.t('خشم', 'Rage')}</th><th>${l.t('تبر', 'Axes')}</th><th>${l.t('شاخ', 'Horns')}</th><th>${l.t('کارت‌های پایانی', 'End cards')}</th><th>${l.t('جمع', 'Total')}</th></tr></thead><tbody>${tot.map((r, i) => `<tr class="${i === 0 ? 'is-win' : ''}"><td><b>${l.d(i + 1)}</b></td><td><b style="color:var(--bdr-${slug(r.k)}-ink)">${l.name(r.k)}</b> · ${l.clan(M.clans[r.k])}</td><td>${l.d(r.glory)}</td>${cell(r, 'rage')}${cell(r, 'axe')}${cell(r, 'horn')}<td>${r.extra ? `${l.t('فتح تور', "Thor's Conquest")} +${l.d(r.extra)}` : '—'}</td><td><b>${l.d(r.t)}</b></td></tr>`).join('')}</tbody></table>
  <div class="bdr-panelbox"><h3>${l.t('نتیجه', 'Result')}</h3><p>${l.t(`<b>${l.name(tot[0].k)}</b> با ${l.d(tot[0].t)} افتخار برنده شد. صفحهٔ نتیجهٔ میز (DS: Table-Result) همین جدول را با رتبه‌ها نشان می‌دهد؛ publicSummary امتیاز نهایی را می‌فرستد.`, `<b>${l.name(tot[0].k)}</b> wins with ${tot[0].t} glory.`)}</p><p class="bdr-note">${l.t('پلهٔ ویژگی با رنگ قبیله روی «آمار قبیله» دیده می‌شود؛ پله‌های افسانه‌ای (۴ به بالا) در پنل بازیکن قاب طلایی دارند.', 'Legendary steps (4+) get a gold ring in the player panel.')}</p></div></div>`);
}

// ---------- §2 Status bar states (BGA page-title button sets, bloodrage.js) ----------
function barStates(l) {
  const s = M;
  const P2 = P;
  const row = (no, cap, html) => `<div style="display:grid;grid-template-columns:200px 1fr;gap:14px;align-items:center"><p style="margin:0;font-size:13px;line-height:1.7;color:var(--text-muted)"><b style="color:var(--heading)">${no}</b> ${cap}</p>${html}</div>`;
  return frame(2, l.t('نوار وضعیت: حالت‌های BGA', 'Status bar: the BGA states'), l.t('مثل BGA هر اقدام از نوار بالای ستون بازی شروع می‌شود و دکمه‌ها همان برچسب‌های BGA را دارند. «بازی مأموریت/ارتقا/هیولا» فقط وقتی هست که چنین کارتی در دست دارید. فرق ما با BGA: پیش از ارسال «ثبت» و «انصراف» داریم (قانون DS) و یک خط زیر نوار هزینه و اثر را می‌گوید.', ''),
    `<div style="display:grid;gap:10px">
 ${row('۱', l.t('نوبت شما: «یک اقدام انتخاب کنید»', 'Choose an action'), P2.bar(l, l.t(`<b>${l.name(ME)}</b>، یک اقدام انتخاب کنید:`, `<b>${l.name(ME)}</b>, choose an action:`), P2.actionButtons(l)))}
 ${row('۲', l.t('پس از «یورش»: «یورش با …»', 'Invade with'), P2.bar(l, l.t('یورش با:', 'Invade with:'), P2.invadeWithButtons(l)))}
 ${row('۳', l.t('پس از انتخاب مهره: هدف روی نقشه', 'Pick the village on the map'), P2.bar(l, l.t('روستایی را برای یورش با <b>ترول</b> انتخاب کنید', 'Select the village to invade with the <b>Troll</b>'), P2.btn(l.t('انصراف', 'Cancel'), 'ghost', 'cancel')))}
 ${row('۴', l.t('روستا انتخاب شد: ثبت', 'Village picked: confirm'), P2.actionBar(l))}
 ${row('۵', l.t('نوبت دیگری', "Someone else's turn"), P2.bar(l, l.t('<b>آرش</b> یک اقدام انتخاب می‌کند', '<b>Arash</b> chooses an action'), '', { waiting: true, clock: false }))}
 ${row('۶', l.t('ارتقا: کارت را از دست بزنید', 'Upgrade: click the card'), P2.bar(l, l.t('ارتقای مورد نظر را انتخاب کنید:', 'Choose the Upgrade to play:'), P2.btn(l.t('انصراف', 'Cancel'), 'ghost', 'cancel')))}
 ${row('۷', l.t('مأموریت موفق یا پاداش ویژگی', 'Raise a stat'), P2.bar(l, l.t('یک ویژگی را یک پله بالا ببرید:', 'Raise one clan stat:'), ['rage', 'axe', 'horn'].map((k) => P2.btn(`${IMG(`icon-${k}-mini`, 'class="bdr-ic" alt=""')}${l.stat(k)}`, 'secondary', 'stat-' + k)).join('')))}
</div>`);
}

// ---------- §24 Dialogs (BGA br_modal: title, body, «Close») ----------
function dialogs(l) {
  const s = afterBattle();
  const X = [229, 328, 427, 527, 626, 725], Y = { rage: 80, axe: 183, horn: 286 };
  const k = ME;
  const stoks = ['rage', 'axe', 'horn'].map((st) => IMG('icon-clan-' + s.clans[k], `class="bdr-stok" style="left:${(X[s.stats[k][st]] / 8).toFixed(2)}%;top:${((Y[st] - 6) / 3.47).toFixed(2)}%" alt="${l.stat(st)}"`));
  const dlg = (title, body, w, icon = '') => `<div class="bgv-dialog" role="dialog" aria-label="${title}" style="position:static;inline-size:${w}px;max-inline-size:none;transform:none"><div class="bgv-dialog__head">${icon}<h3 class="bgv-dialog__title">${title}</h3><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('بستن', 'Close')}">${ICONS.x}</button></div><div class="bgv-dialog__body">${body}<div style="display:flex;justify-content:center;margin-top:12px"><button class="bgv-btn bgv-btn--secondary" type="button">${l.t('بستن', 'Close')}</button></div></div></div>`;
  const valh = [0, 1, 2, 3].map((q) => { const v = s.figures.filter((f) => f.seat === q && f.where === 'valhalla'); return v.length ? `<div style="${P.cc(q)}">${v.map((f) => IMG(figArt(s, f), `alt="${l.figName(s, f)}"`)).join('')}<span style="font-size:12.5px;margin-inline-start:6px">${l.name(q)} ×${l.d(v.length)}</span></div>` : ''; }).join('');
  const phases = ['draft', 'action', 'discard', 'quest', 'ragnarok', 'valhalla'];
  const ages = [1, 2, 3].map((a) => `<div style="text-align:center;display:grid;gap:3px"><b style="font-size:16px;text-decoration:underline">${l.t(`عصر ${['', 'اول', 'دوم', 'سوم'][a]}`, `Age ${a}`)}</b>${a === s.age ? phases.map((p) => `<span class="${p === s.phase ? 'bdr-pill' : ''}" style="justify-self:center">${p === 'ragnarok' ? l.t('راگناروک در ', 'Ragnarök in ') + l.prov(s.ragnarok[a - 1]) : l.phase(p)}</span>`).join('') : `<span>${l.t('راگناروک در ', 'Ragnarök in ') + l.prov(s.ragnarok[a - 1])}</span>`}<small style="color:var(--text-muted)">${l.t(`${l.d(C.ragnarokGlory[a])} افتخار برای هر مهرهٔ نابودشده در راگناروک`, `${C.ragnarokGlory[a]} glory per figure destroyed in Ragnarök`)}</small></div>`).join('');
  return frame(24, l.t('پنجره‌ها (مثل br_modal در BGA)', 'Dialogs (BGA br_modal)'), l.t('همه با DS Dialog: عنوان، محتوا، «بستن». باز می‌شوند از: نشان عصر روی نقشه (مسیر عصرها)، «جزئیات آمار» در پنل بازیکن (فقط همان بازیکن)، «ذخیره» و «مأموریت‌ها» روی صفحهٔ قبیله، «والهالا» و کارت‌های دورریخته پایین نقشه. راهنمای کارت با hover یا نگه‌داشتن.', ''),
    `<div class="bdr-cols" style="grid-template-columns:auto auto auto;justify-content:start;align-items:start">
  <div style="display:grid;gap:14px">${dlg(l.t('آمار: مینا', 'Statistics: Mina'), `<div class="bdr-statboard">${IMG('clan-statistics', 'alt=""')}${stoks.join('')}</div><p class="bdr-note" style="margin-top:10px">${l.t('نشان قبیلهٔ همین بازیکن روی پلهٔ فعلی هر ویژگی (BGA). دو خانهٔ آخر هر ردیف در دادهٔ BGA یکی‌اند (COMPONENTS.md §۱۸).', 'This player\'s clan token on each current step (BGA).')}</p>`, 540, IMG('icon-clan-' + s.clans[k], 'style="inline-size:30px;border-radius:50%" alt=""'))}
  ${dlg(l.t('مسیر عصرها', 'Age track'), `<div style="display:grid;gap:16px;font-size:13.5px">${ages}</div>`, 540)}</div>
  <div style="display:grid;gap:14px">${dlg(l.t('ذخیره: مینا', 'Reserve: Mina'), P.reserveGrid(l, s, ME), 430)}
  ${dlg(l.t(`والهالا (${l.d(s.figures.filter((f) => f.where === 'valhalla').length)})`, 'Valhalla'), `<div class="bdr-valh" style="display:grid;gap:8px">${valh}</div>`, 430)}</div>
  <div style="display:grid;gap:14px;align-content:start">${dlg(l.t('مأموریت‌ها: مینا', 'Quests: Mina'), `<div style="display:flex;gap:10px;align-items:center">${IMG(CARD[48].art, 'style="inline-size:90px;border-radius:5px" alt=""')}<p style="margin:0;font-size:13.5px;line-height:1.8"><b>${CARD[48].titleFa}</b> (${l.d(CARD[48].value)} ${l.t('افتخار', 'glory')})<br>${CARD[48].rulesFa}<br><span class="bdr-ok">${l.t('اکنون انجام‌شده: آنگربودا', 'Currently met: Angerboda')}</span></p></div><p style="font-size:12.5px;color:var(--text-muted);margin:8px 0 0">${l.t('برای بقیهٔ بازیکن‌ها فقط پشت کارت و تعداد.', 'Others see only card backs and the count.')}</p>`, 440)}
  ${P.tooltip(l, 64)}</div>
 </div>`);
}

const phases = (l) => `<div dir="rtl" style="display:grid;grid-template-columns:minmax(0,1fr);gap:24px;padding:28px 16px 40px">${barStates(l)}${draft(l)}${battle(l)}${endOfAge(l)}${gameEnd(l)}${dialogs(l)}</div>`;
module.exports = { CSS: '', HEIGHT: 9360, phases, afterTroll, battleState, afterBattle, clanStr, mapCrop, figsIn };
