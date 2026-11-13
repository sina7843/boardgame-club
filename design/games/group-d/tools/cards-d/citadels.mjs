// Citadels («دژ») on the group D frame. Repo engine: 2–7 players, characters 1–8, 54 coloured districts (no purple, E1), a city of 8
// ends the game after the round (BGA: 7, E2), ties shared (BGA: highest character rank, E3).
// BGA layout: the character ranks across the middle (called rank highlighted, killed/robbed marked), every opponent's city in a row with
// gold, hand and character, your city and character above your hand.
// Art = the site's ready-to-use renders at native size or exactly ½: districts 80×104 (½ = 40×52), characters 80×88 (½ = 40×44),
// crown and coin 200×200 (shown at 1/10). There is no character or district back in the pack, so hidden cards are a dashed «؟» slot.
// Mock: 4 players, clockwise مینا → نیلوفر → رضا → سارا, round 5, crown رضا (draft: رضا, سارا, مینا, نیلوفر).
//  removed: اسقف face down, شعبده‌باز and بازرگان face up. Picks: رضا شاه, سارا دزد, مینا معمار, نیلوفر آدم‌کش; سردار left over.
//  1 نیلوفر kills سردار (nobody), 2 سارا robs شاه, 4 رضا: his 4 gold → سارا, +2 for two yellow, crown. 7 you: +2 cards, take 2 gold.
//  Final scores are computed from the cities below (cost + 3 for four colours + 4 first / 2 other complete city of 8).
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['cit-' + n];
  const D = { 'عمارت': ['y3', 3, 'y'], 'قصر کوچک': ['y4', 4, 'y'], 'کاخ': ['y5', 5, 'y'], 'معبد': ['b1', 1, 'b'], 'کلیسا': ['b2', 2, 'b'], 'صومعه': ['b3', 3, 'b'], 'جامع': ['b5', 5, 'b'], 'کاروانسرا': ['g1', 1, 'g'], 'بازارچه': ['g2a', 2, 'g'], 'تیمچه': ['g2b', 2, 'g'], 'اسکله': ['g3', 3, 'g'], 'بندر': ['g4', 4, 'g'], 'دارالحکومه': ['g5', 5, 'g'], 'برج دیده‌بانی': ['r1', 1, 'r'], 'زندان': ['r2', 2, 'r'], 'میدان نبرد': ['r3', 3, 'r'], 'دژ': ['r5', 5, 'r'] };
  const CN = { y: 'اشرافی', b: 'مذهبی', g: 'تجاری', r: 'نظامی' };
  const CH = ['', 'آدم‌کش', 'دزد', 'شعبده‌باز', 'شاه', 'اسقف', 'بازرگان', 'معمار', 'سردار'];
  const AB = ['', 'یک شخصیت را می‌کشد؛ آن شخصیت این دور نوبت ندارد', 'طلای یک شخصیت را وقتی صدا زده شد برمی‌دارد', 'دستش را با یک بازیکن یا با دسته عوض می‌کند', 'تاج را می‌گیرد؛ از هر محلهٔ زرد ۱ طلا', 'سردار شهرش را خراب نمی‌کند؛ از هر محلهٔ آبی ۱ طلا', '۱ طلای اضافه؛ از هر محلهٔ سبز ۱ طلا', '۲ کارت اضافه می‌کشد و تا ۳ محله می‌سازد', 'یک محله را به قیمتش منهای ۱ خراب می‌کند؛ از هر محلهٔ قرمز ۱ طلا'];
  const NM = { 1: 'شما', 2: 'نیلوفر', 6: 'رضا', 4: 'سارا' };
  const im = (n, alt = '', cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${A(n)}" alt="${alt}">`;
  const coin = (n) => `<span class="ct-g">${im('coin')}${fa(n)}</span>`;
  const alt = (n) => `${n}، ${CN[D[n][2]]}، قیمت ${fa(D[n][1])}`;
  const dist = (n, o = {}) => `<span class="ct-d${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}${o.no ? ' is-no' : ''}${o.isNew ? ' is-new' : ''}">${im('d-' + D[n][0], alt(n))}${o.cost !== undefined ? `<em>${o.cost === null ? 'قفل' : coinTxt(o.cost)}</em>` : ''}</span>`;
  const coinTxt = (n) => `${im('coin')}${fa(n)}`;
  const city = (names, o = {}) => `<div class="ct-city${o.cls ? ' ' + o.cls : ''}" aria-label="شهر ${o.who ?? ''}: ${fa(names.length)} محله">${names.length ? names.map((n) => dist(n, o.d?.[n] ?? {})).join('') : '<span class="ct-empty">هنوز محله‌ای ساخته نشده</span>'}</div>`;
  const tok = (r, cls = '') => `<span class="ct-t${cls ? ' ' + cls : ''}">${im('c-' + r, `${CH[r]}، رتبهٔ ${fa(r)}`)}</span>`;
  const hidden = (label = 'پشت‌ورو') => `<span class="ct-t ct-t--hid" aria-label="${label}"><b>؟</b></span>`;
  // rank bar: slots {r: {st, who, note}}; st: up (face-up removed) | rev | cur | none | hid
  const rankBar = (slots, cur) => `<div class="ct-ranks" aria-label="صدا زدن رتبه‌ها">${[1, 2, 3, 4, 5, 6, 7, 8].map((r) => { const s = slots[r] ?? { st: 'hid' }; const face = s.st === 'up' || s.st === 'rev' || s.st === 'cur'; return `<div class="ct-rk is-${s.st}${s.killed ? ' is-killed' : ''}${s.robbed ? ' is-robbed' : ''}">${face ? tok(r) : `<span class="ct-t ct-t--num"><b>${fa(r)}</b></span>`}<small>${s.note ?? (s.st === 'up' ? 'کنار رفت' : s.who ? NM[s.who] : '')}</small>${s.killed ? '<i class="ct-flag">کشته شد</i>' : s.robbed ? '<i class="ct-flag ct-flag--rob">دزدیده شد</i>' : ''}</div>`; }).join('')}</div>`;
  const oppRow = (seat, p, ph) => `<div class="ct-or${p.turn ? ' is-turn' : ''}"><div class="ct-oh"><i style="background:var(--seat-${seat})"></i><b>${NM[seat]}</b>${p.ch ? tok(p.ch, 'ct-t--sm') : ''}${p.crown ? im('crown', 'تاج', 'ct-crown') : ''}${ph ? '' : `${coin(p.gold)}<span class="ct-hc">${fa(p.hand)} کارت</span>`}${p.full ? '<span class="gc-tag">کامل</span>' : ''}</div>${city(p.city, { cls: 'ct-city--sm', who: NM[seat], d: p.d })}</div>`;
  const seatMeta = (p) => `${p.crown ? im('crown', 'تاج', 'ct-crown') : ''}${coin(p.gold)}<span>${fa(p.hand)} کارت</span><span>${fa(p.city.length)} محله</span>`;
  const opps = (st, turn) => [2, 6, 4].map((s) => ({ name: NM[s], av: NM[s][0], seat: s, clock: ({ 2: '1:40', 6: '1:15', 4: '2:05' })[s], turn: turn === s, meta: seatMeta(st[s]) }));
  const table = (st) => (ph) => `${st.banner ? `<div class="ct-banner">${ic(st.bannerIc ?? 'flag')}<span>${st.banner}</span></div>` : ''}${st.draft ? st.draft(ph) : rankBar(st.ranks ?? {})}<div class="ct-ors">${[2, 6, 4].map((s) => oppRow(s, { ...st[s], turn: st.turn === s }, ph)).join('')}</div><div class="ct-deck"><span class="bgv-chip">دستهٔ محله: ${fa(st.deck)}</span>${st.extra ?? ''}</div>`;
  const above = (st, o = {}) => (ph) => `<div class="ct-me${ph ? ' ct-me--ph' : ''}">${ph ? '' : o.acts ? `<div class="ct-acts">${o.chips ?? ''}${o.acts(ph)}</div>` : o.chips ? `<div class="ct-acts">${o.chips}</div>` : ''}<div class="ct-mine">${st[1].ch ? `<div class="ct-mych">${tok(st[1].ch, st[1].chCls ?? '')}<small>${st[1].ch ? CH[st[1].ch] : ''}</small></div>` : `<div class="ct-mych">${hidden()}<small>شخصیت</small></div>`}<div class="ct-mycity"><div class="ct-myh">${st[1].crown ? im('crown', 'تاج', 'ct-crown') : ''}${coin(st[1].gold)}<span>${fa(st[1].city.length)} از ${fa(8)} محله</span>${ph && (o.acts || o.chips) ? `<span class="ct-acts">${o.chips ?? ''}${o.acts ? o.acts(ph) : ''}</span>` : ''}</div>${city(st[1].city, { who: 'شما', cls: ph ? 'ct-city--sm' : '', d: st[1].d })}</div></div></div>`;
  const hand = (names, o = {}) => names.map((n) => ({ art: 'cit-d-' + D[n][0], alt: alt(n), ok: o.ok?.includes(n), dim: o.dim?.includes(n), sel: o.sel?.includes(n) }));
  const note = (c) => `<span class="cx-note">${fa(c)} از ${fa(8)} محله</span>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rail = (round, crown) => `<section class="cx-card"><h3>دور ${fa(round)}</h3><div class="gc-pills"><span class="bgv-chip">${im('crown')}تاج: ${NM[crown]}</span><span class="bgv-chip">پایان: شهر ${fa(8)} محله‌ای</span></div><div class="ga-rule">${ic('info')}<span>هر دور: انتخاب پنهانی شخصیت از تاج‌دار، بعد صدا زدن رتبه‌ها از ${fa(1)} تا ${fa(8)}. در نوبت: ${fa(2)} طلا یا ${fa(2)} کارت (یکی نگه دارید)، بعد ساختن یک محله و توانایی شخصیت. محلهٔ تکراری در یک شهر ممنوع است.</span></div></section>`;

  // ---------- state ----------
  const ME4 = ['عمارت', 'معبد', 'کاروانسرا', 'بازارچه'];
  const ME5 = [...ME4, 'برج دیده‌بانی'];
  const ME6 = [...ME5, 'کلیسا'];
  const ME7 = [...ME6, 'قصر کوچک'];
  const NIL5 = ['کلیسا', 'صومعه', 'اسکله', 'برج دیده‌بانی', 'زندان'];
  const NIL6 = [...NIL5, 'بندر'];
  const REZ5 = ['قصر کوچک', 'کاخ', 'تیمچه', 'معبد', 'عمارت'];
  const REZ6 = [...REZ5, 'کاروانسرا'];
  const SAR5 = ['میدان نبرد', 'بندر', 'کاروانسرا', 'جامع', 'عمارت'];
  const SAR6 = [...SAR5, 'دارالحکومه'];
  const SAR8 = [...SAR5, 'برج دیده‌بانی', 'تیمچه', 'معبد'];
  const score = (c, first) => { const base = c.reduce((a, n) => a + D[n][1], 0); const all = new Set(c.map((n) => D[n][2])).size === 4 ? 3 : 0; const done = c.length >= 8 ? (first ? 4 : 2) : 0; if (new Set(c).size !== c.length) throw new Error('citadels duplicate district'); return [base, all, done, base + all + done]; };
  const FS = { 1: score(ME7), 4: score(SAR8, true), 6: score(REZ6), 2: score(NIL6) };
  if (FS[4][3] !== 27 || FS[1][3] !== 17 || FS[6][3] !== 16 || FS[2][3] !== 15) throw new Error('citadels scores ' + JSON.stringify(FS));
  // copies used must not exceed the deck (عمارت 5, معبد 3, کاروانسرا 5, برج 3, …)
  const COPIES = { 'عمارت': 5, 'قصر کوچک': 4, 'کاخ': 3, 'معبد': 3, 'کلیسا': 3, 'صومعه': 3, 'جامع': 2, 'کاروانسرا': 5, 'بازارچه': 4, 'تیمچه': 3, 'اسکله': 3, 'بندر': 3, 'دارالحکومه': 2, 'برج دیده‌بانی': 3, 'زندان': 3, 'میدان نبرد': 3, 'دژ': 2 };
  const use = {}; for (const n of [...ME7, ...NIL6, ...REZ6, ...SAR8, 'دژ', 'کاروانسرا']) use[n] = (use[n] ?? 0) + 1;
  for (const [n, k] of Object.entries(use)) if (k > COPIES[n]) throw new Error('citadels copies ' + n);

  const HAND_INC = ['قصر کوچک', 'دژ', 'کاروانسرا', 'برج دیده‌بانی', 'کلیسا'];
  const HAND1 = ['قصر کوچک', 'دژ', 'کاروانسرا', 'کلیسا'];
  const R5 = { 2: { gold: 4, hand: 3, city: NIL5, ch: 1 }, 6: { gold: 1, hand: 2, city: REZ5, ch: 4, crown: true }, 4: { gold: 7, hand: 4, city: SAR5, ch: 2 } };
  const RANKS7 = { 1: { st: 'rev', who: 2 }, 2: { st: 'rev', who: 4 }, 3: { st: 'up' }, 4: { st: 'rev', who: 6, robbed: true }, 5: { st: 'none', note: 'کسی نبود' }, 6: { st: 'up' }, 7: { st: 'cur', who: 1 }, 8: { st: 'hid', killed: true } };
  const ME_R5 = (gold, cityN, o = {}) => ({ 1: { gold, city: cityN, ch: 7, ...o } });
  const LOG5 = [[2, 'نیلوفر (آدم‌کش) سردار را کشت'], [4, 'سارا (دزد) از شاه دزدید'], [6, 'رضا ۴ طلایش را به سارا داد و تاج را گرفت'], [1, 'نوبت شما: معمار']];

  // draft panel (round 5)
  const draft = (o) => (ph) => `<div class="ct-draft"><div class="ct-rem"><small>این دور بازی نمی‌شوند</small><div>${hidden('شخصیت پشت‌ورو')}${tok(3)}${tok(6)}</div></div><div class="ct-order" aria-label="ترتیب انتخاب">${[6, 4, 1, 2].map((s, i) => `${i ? `<span class="ct-arrow">${ic('prev')}</span>` : ''}<span class="ct-who${o.at === s ? ' is-on' : ''}${o.done.includes(s) ? ' is-done' : ''}"><i style="background:var(--seat-${s})"></i>${NM[s]}${o.done.includes(s) ? ic('check') : ''}</span>`).join('')}</div><span class="bgv-chip">${o.left} کارت مانده</span></div>`;
  const pickM = (ph) => modal('شخصیت این دورتان را انتخاب کنید', `<p>رضا و سارا انتخاب کرده‌اند. از سه کارت مانده یکی را بردارید؛ دو کارت دیگر به نیلوفر می‌رسد.</p><div class="ct-pick">${[1, 7, 8].map((r) => `<div class="ct-pc${r === 7 ? ' is-sel' : ''}">${tok(r)}<div><b>${CH[r]}</b><small>رتبهٔ ${fa(r)}</small><span>${AB[r]}</span></div></div>`).join('')}</div>`, `${btn('انتخاب معمار', 'primary', 'check')}`);
  const keepM = (ph) => modal('یکی را نگه دارید', `<p>دو کارت از دسته کشیدید. یکی به دستتان می‌آید و دیگری زیر دسته می‌رود.</p><div class="ct-keep">${dist('صومعه', { sel: true })}${dist('زندان')}</div><p class="cx-note">صومعه انتخاب شده است. در شهرتان صومعه ندارید، پس بعداً ساختنی است.</p>`, `${btn('نگه داشتن صومعه', 'primary', 'check')}`);
  const destroyRow = (seat, names, lockAll) => `<div class="ct-dr"><b><i style="background:var(--seat-${seat})"></i>${NM[seat]}${lockAll ? `<small>${lockAll}</small>` : ''}</b>${city(names, { cls: 'ct-city--sm', d: Object.fromEntries(names.map((n) => [n, { cost: lockAll ? null : D[n][1] - 1, sel: !lockAll && n === 'دارالحکومه' && seat === 4, no: !!lockAll }])) })}</div>`;
  const destroyM = (ph) => modal('سردار: کدام محله را خراب می‌کنید؟', `<p>${fa(5)} طلا دارید. قیمت خراب کردن هر محله، قیمتش منهای ${fa(1)} است و زیر هر کارت نوشته شده.</p>${destroyRow(4, SAR6)}${destroyRow(6, REZ5)}${destroyRow(2, NIL6, 'اسقف است و شهرش در امان است')}<p class="cx-note">دارالحکومهٔ سارا انتخاب شده: ${fa(4)} طلا می‌دهید و ${fa(1)} طلا می‌ماند. شهر کامل (${fa(8)} محله) هم خراب نمی‌شود.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('خراب کردن', 'primary', 'check')}`);
  const endM = (ph) => modal('سارا برد', `<p>شهر سارا اولین شهر کامل شد و دور آخر تمام شد.</p>${tbl(['بازیکن', 'قیمت محله‌ها', 'همهٔ انواع', 'شهر کامل', 'جمع', 'رتبهٔ دور آخر'], [{ c: [`${ic('trophy')} سارا`, fa(FS[4][0]), `${fa(FS[4][1])}+`, `${fa(FS[4][2])}+`, fa(FS[4][3]), `${fa(7)}، معمار`], win: true }, { c: ['شما', fa(FS[1][0]), `${fa(FS[1][1])}+`, fa(0), fa(FS[1][3]), `${fa(6)}، بازرگان`] }, { c: ['رضا', fa(FS[6][0]), fa(0), fa(0), fa(FS[6][3]), `${fa(8)}، سردار`] }, { c: ['نیلوفر', fa(FS[2][0]), fa(0), fa(0), fa(FS[2][3]), `${fa(4)}، شاه`] }])}<p class="cx-note">همهٔ انواع: هر چهار رنگ در شهر ${fa(3)}+. شهر کامل: اولین ${fa(4)}+ و بقیه ${fa(2)}+. ستون رتبه برای تساوی در BGA است؛ موتور فعلاً برد مشترک می‌دهد.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  // target windows (rounds 2 to 4; you are the Assassin, the Thief, then the Magician). Face-up removed ranks are off (BGA).
  const TL = { self: 'خودتان', up: 'کنار رفت', killed: 'کشته شد', no: 'ممنوع', sel: 'انتخاب شد' };
  const tgtRow = (st) => `<div class="ct-tg" role="radiogroup">${[1, 2, 3, 4, 5, 6, 7, 8].map((r) => { const x = st[r] ?? 'ok'; const on = x === 'ok' || x === 'sel'; return `<button type="button" class="ct-tgb is-${x}"${on ? '' : ' disabled'} aria-pressed="${x === 'sel'}">${tok(r)}<b>${CH[r]}</b><small>${TL[x] ?? `رتبهٔ ${fa(r)}`}</small></button>`; }).join('')}</div>`;
  const killM = (ph) => modal('آدم‌کش: کدام شخصیت را می‌کشید؟', `<p>شخصیتی که بکشید این دور نوبت ندارد. نمی‌دانید دست کیست؛ کارت پشت‌ورو هم ممکن است همان باشد. دو شخصیتی که رو کنار رفته‌اند انتخاب‌شدنی نیستند.</p>${tgtRow({ 1: 'self', 5: 'up', 6: 'up', 7: 'sel' })}<p class="cx-note">معمار انتخاب شده است. وقتی رتبهٔ ${fa(7)} صدا زده شود، برچسب «کشته شد» می‌گیرد و صاحبش رو نمی‌کند.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('کشتن معمار', 'primary', 'check')}`);
  const robM = (ph) => modal('دزد: از کدام شخصیت می‌دزدید؟', `<p>وقتی آن شخصیت صدا زده شود، همهٔ طلایش به شما می‌رسد. از آدم‌کش و شخصیت کشته‌شده نمی‌شود دزدید.</p>${tgtRow({ 1: 'no', 2: 'self', 3: 'up', 5: 'up', 8: 'killed', 6: 'sel' })}<p class="cx-note">بازرگان انتخاب شده است. اگر کسی بازرگان نباشد، چیزی نمی‌دزدید.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('دزدیدن از بازرگان', 'primary', 'check')}`);
  const MAGH = ['کاروانسرا', 'میدان نبرد', 'قصر کوچک'];
  const magM = (ph) => modal('شعبده‌باز: کارت‌هایتان را عوض کنید', `<div class="ct-mg" role="radiogroup"><div class="ct-mo"><span class="ct-radio" aria-hidden="true"></span><div><b>عوض کردن کل دست با یک بازیکن</b><div class="ct-mp">${[[2, 4], [6, 2], [4, 3]].map(([sx, n]) => `<button type="button" class="ct-mpb"><i style="background:var(--seat-${sx})"></i>${NM[sx]}<small>${fa(n)} کارت</small></button>`).join('')}</div></div></div><div class="ct-mo is-on"><span class="ct-radio" aria-hidden="true"></span><div><b>عوض کردن چند کارت با دسته</b><small>کارت‌هایی را که نمی‌خواهید بزنید؛ زیر دسته می‌روند و همان تعداد کارت تازه می‌کشید.</small><div class="ct-keep">${MAGH.map((n) => dist(n, { sel: n !== 'قصر کوچک' })).join('')}</div></div></div></div><p class="cx-note">کاروانسرا را در شهرتان دارید و میدان نبرد گران است؛ هر دو انتخاب شده‌اند. قصر کوچک می‌ماند.</p>`, `${btn('لغو', 'secondary', 'x')}${btn(`عوض کردن ${fa(2)} کارت`, 'primary', 'check')}`);
  const abActs = (name, icon) => (ph) => `${btn(`توانایی ${name}`, 'primary', icon)}${btn(`${fa(2)} طلا`, 'secondary', 'download')}${btn(`${fa(2)} کارت`, 'secondary', 'hand')}`;

  const buildChips = (left, total) => `<span class="ct-bc">ساخت ${fa(total - left)} از ${fa(total)}</span>`;
  return {
    slug: 'Citadels', fa: 'دژ', latin: 'Citadels', meta: ['زنده', '۴ نفر', 'دور ۵'],
    opps: opps(R5, 1),
    me: { cards: hand(HAND1, { ok: ['قصر کوچک', 'کلیسا'], dim: ['دژ', 'کاروانسرا'] }), clock: '1:05', turn: true, note: note(5), above: above(ME_R5(4, ME5, { d: { 'برج دیده‌بانی': { isNew: true } } }), { chips: buildChips(2, 3), acts: (ph) => `${btn(ph ? 'پایان' : 'پایان نوبت', 'secondary', 'check')}` }) },
    cardW: 80, phoneCardW: 80, cardRatio: 1.3,
    table: table({ ...R5, ranks: RANKS7, deck: 21, turn: 0 }),
    status: `<b>نوبت شماست: معمار.</b> دو کارت اضافه گرفتید و ${fa(2)} طلا برداشتید. برج دیده‌بانی را ساختید (${fa(1)} طلا) و تا دو محلهٔ دیگر می‌توانید بسازید. قصر کوچک و کلیسا با ${fa(4)} طلا ساختنی‌اند؛ دژ گران است و کاروانسرا را دارید.`,
    pstatus: `<b>معمار: ساخت ${fa(1)} از ${fa(3)}.</b> قصر کوچک یا کلیسا را بسازید.`,
    railCard: rail(5, 6), logNote: `دور ${fa(5)}`, log: LOG5,
    dockItems: [['list', 'رویدادها'], ['users', 'شهرها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: '۲ طلا و ۴ کارت برای هر نفر',
        meta: ['زنده', '۴ نفر', 'دور ۱'],
        opps: opps({ 2: { gold: 2, hand: 4, city: [], crown: true }, 6: { gold: 2, hand: 4, city: [] }, 4: { gold: 2, hand: 4, city: [] } }, 2),
        me: { turn: false, clock: '1:30', note: note(0), cards: hand(['عمارت', 'معبد', 'کاروانسرا', 'میدان نبرد']), above: above({ 1: { gold: 2, city: [] } }) },
        table: table({ 2: { gold: 2, hand: 4, city: [], crown: true }, 6: { gold: 2, hand: 4, city: [] }, 4: { gold: 2, hand: 4, city: [] }, ranks: {}, deck: 38 }),
        railCard: rail(1, 2),
        status: `<b>بازی شروع شد.</b> هر نفر ${fa(2)} طلا و ${fa(4)} کارت محله دارد. تاج به قید قرعه به نیلوفر رسید؛ او شخصیت‌ها را کنار می‌گذارد و اول انتخاب می‌کند.`,
        log: [[1, 'بازی با ۴ نفر شروع شد'], [2, 'تاج به نیلوفر رسید']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'انتخاب شخصیت', turnSub: 'سه کارت کنار رفت؛ نوبت انتخاب شما',
        opps: opps({ ...R5, 2: { ...R5[2], gold: 2 }, 6: { ...R5[6], gold: 3, city: ['قصر کوچک', 'کاخ', 'تیمچه', 'معبد'] }, 4: { ...R5[4], gold: 1 } }, 0),
        me: { turn: true, clock: '0:30', note: note(4), cards: hand(['قصر کوچک', 'دژ', 'کاروانسرا']), above: above({ 1: { gold: 3, city: ME4 } }) },
        table: table({ 2: { gold: 2, hand: 3, city: NIL5 }, 6: { gold: 4, hand: 3, city: REZ5.slice(0, 4), crown: true }, 4: { gold: 1, hand: 4, city: SAR5 }, draft: draft({ at: 1, done: [6, 4], left: fa(3) }), deck: 23 }),
        overlay: pickM,
        status: `<b>نوبت انتخاب شماست.</b> یک شخصیت پشت‌ورو و شعبده‌باز و بازرگان رو کنار رفتند؛ این دور بازی نمی‌شوند. رضا و سارا پنهانی انتخاب کرده‌اند و سه کارت مانده است.`,
        pstatus: `<b>انتخاب شخصیت.</b> معمار انتخاب شده است.`,
        log: [[6, 'رضا شخصیت‌ها را کنار گذاشت'], [6, 'رضا انتخاب کرد'], [4, 'سارا انتخاب کرد'], [1, 'نوبت انتخاب شما']],
      },
      {
        shotTitle: 'انتخاب، انتظار', turnSub: 'نیلوفر در حال انتخاب است',
        opps: opps({ ...R5, 2: { ...R5[2], gold: 2 }, 6: { ...R5[6], gold: 4, hand: 3, city: REZ5.slice(0, 4) }, 4: { ...R5[4], gold: 1 } }, 2),
        me: { turn: false, clock: '0:30', note: note(4), cards: hand(['قصر کوچک', 'دژ', 'کاروانسرا']), above: above({ 1: { gold: 3, city: ME4, ch: 7 } }) },
        table: table({ 2: { gold: 2, hand: 3, city: NIL5 }, 6: { gold: 4, hand: 3, city: REZ5.slice(0, 4), crown: true }, 4: { gold: 1, hand: 4, city: SAR5 }, draft: draft({ at: 2, done: [6, 4, 1], left: fa(2) }), deck: 23, turn: 2 }),
        status: `<b>نیلوفر در حال انتخاب است.</b> شما معمار را برداشتید. از دو کارت مانده یکی به نیلوفر می‌رسد و دیگری کنار می‌رود. بعد رتبه‌ها از ${fa(1)} صدا زده می‌شوند.`,
        log: [[6, 'رضا انتخاب کرد'], [4, 'سارا انتخاب کرد'], [1, 'شما انتخاب کردید'], [2, 'نیلوفر در حال انتخاب']],
      },
      {
        shotTitle: 'صدا زدن رتبه‌ها', turnSub: 'نوبت شاه؛ طلایش به دزد رسید',
        opps: opps({ ...R5, 2: { ...R5[2] }, 6: { ...R5[6], gold: 2, hand: 3, city: REZ5.slice(0, 4) }, 4: { ...R5[4] } }, 6),
        me: { turn: false, clock: '1:05', note: note(4), cards: hand(['قصر کوچک', 'دژ', 'کاروانسرا']), above: above({ 1: { gold: 3, city: ME4, ch: 7 } }) },
        table: table({ ...R5, 6: { ...R5[6], gold: 2, hand: 3, city: REZ5.slice(0, 4) }, ranks: { 1: { st: 'rev', who: 2 }, 2: { st: 'rev', who: 4 }, 3: { st: 'up' }, 4: { st: 'cur', who: 6, robbed: true }, 6: { st: 'up' }, 8: { st: 'hid', killed: true } }, deck: 23, turn: 6 }),
        status: `<b>رتبهٔ ${fa(4)}، شاه: رضا.</b> سارا که دزد بود از شاه دزدیده بود، پس هر ${fa(4)} طلای رضا به سارا رسید. رضا تاج را گرفت و از دو محلهٔ زردش ${fa(2)} طلا گرفت. سردار هم کشته شده و وقتی صدا زده شود نوبت ندارد.`,
        log: [[2, 'نیلوفر (آدم‌کش) سردار را کشت'], [4, 'سارا (دزد) از شاه دزدید'], [6, 'رضا شاه است؛ ۴ طلا به سارا رسید'], [6, 'رضا از محله‌های زرد ۲ طلا گرفت']],
      },
      {
        shotTitle: 'درآمد', turnSub: '۲ طلا یا ۲ کارت',
        opps: opps({ ...R5, 6: { ...R5[6], hand: 2 } }, 0),
        me: { cards: hand(HAND_INC, { sel: [] }).map((c, i) => ({ ...c, ok: i >= 3 })), note: note(4), above: above(ME_R5(3, ME4), { acts: (ph) => `${btn(`${fa(2)} طلا`, 'primary', 'download')}${btn(ph ? `${fa(2)} کارت` : `${fa(2)} کارت بکش`, 'secondary', 'hand')}` }) },
        table: table({ ...R5, ranks: RANKS7, deck: 21 }),
        status: `<b>رتبهٔ ${fa(7)}، معمار: شما.</b> اول درآمد: ${fa(2)} طلا بگیرید یا ${fa(2)} کارت بکشید و یکی را نگه دارید. معمار همین الان دو کارت اضافه گرفت: برج دیده‌بانی و کلیسا (بالاتر در دست).`,
        log: [[6, 'رضا عمارت ساخت'], [6, 'رتبه‌های ۵ و ۶ کسی نبود'], [1, 'معمار: شما ۲ کارت اضافه گرفتید']],
      },
      {
        shotTitle: 'نگه داشتن کارت', turnSub: 'اگر کارت بکشید',
        opps: opps({ ...R5, 6: { ...R5[6], hand: 2 } }, 0),
        me: { cards: hand(HAND_INC), note: note(4), above: above(ME_R5(3, ME4)) },
        table: table({ ...R5, ranks: RANKS7, deck: 19 }),
        overlay: keepM,
        status: `<b>دو کارت کشیدید:</b> صومعه و زندان. یکی را نگه دارید؛ دیگری زیر دسته می‌رود. بعد مرحلهٔ ساخت شروع می‌شود.`,
        pstatus: `<b>یکی را نگه دارید.</b>`,
        log: [[6, 'رتبه‌های ۵ و ۶ کسی نبود'], [1, 'معمار: شما ۲ کارت اضافه گرفتید'], [1, 'شما ۲ کارت کشیدید']],
      },
      {
        shotTitle: 'توانایی سردار', turnSub: 'دور ۶: خراب کردن یک محله',
        meta: ['زنده', '۴ نفر', 'دور ۶'],
        opps: opps({ 2: { gold: 3, hand: 3, city: NIL6 }, 6: { gold: 2, hand: 3, city: REZ5, crown: true }, 4: { gold: 3, hand: 3, city: SAR6 } }, 0),
        me: { cards: hand(['قصر کوچک', 'دژ', 'کاروانسرا'], { dim: ['قصر کوچک', 'دژ', 'کاروانسرا'] }), clock: '1:10', note: note(6), above: above({ 1: { gold: 5, city: ME6, ch: 8 } }, { acts: (ph) => `${btn('توانایی سردار', 'primary', 'swords')}${btn('پایان نوبت', 'secondary', 'check')}` }) },
        table: table({ 2: { gold: 3, hand: 3, city: NIL6, ch: 5 }, 6: { gold: 2, hand: 3, city: REZ5, crown: true, ch: 4 }, 4: { gold: 3, hand: 3, city: SAR6, ch: 6 }, ranks: { 1: { st: 'none', note: 'کسی نبود' }, 2: { st: 'up' }, 3: { st: 'none', note: 'کسی نبود' }, 4: { st: 'rev', who: 6 }, 5: { st: 'rev', who: 2 }, 6: { st: 'rev', who: 4 }, 7: { st: 'up' }, 8: { st: 'cur', who: 1 } }, deck: 18 }),
        overlay: destroyM, railCard: rail(6, 6),
        status: `<b>دور ${fa(6)}: شما سردارید.</b> از برج دیده‌بانی ${fa(1)} طلا گرفتید و ${fa(2)} طلا برداشتید (${fa(5)}). روی شهر حریف‌ها قیمت خراب کردن هر محله آمده؛ شهر نیلوفر که اسقف است قفل است.`,
        pstatus: `<b>سردار.</b> دارالحکومهٔ سارا: ${fa(4)} طلا.`,
        log: [[6, 'رضا شاه است'], [2, 'نیلوفر اسقف است'], [4, 'سارا (بازرگان) دارالحکومه ساخت'], [1, 'نوبت شما: سردار']], logNote: `دور ${fa(6)}`,
      },
      {
        shotTitle: 'توانایی آدم‌کش', turnSub: 'دور ۲: انتخاب رتبه برای کشتن',
        meta: ['زنده', '۴ نفر', 'دور ۲'],
        opps: opps({ 2: { gold: 2, hand: 4, city: ['کلیسا'] }, 6: { gold: 1, hand: 3, city: ['قصر کوچک'], crown: true }, 4: { gold: 1, hand: 3, city: ['میدان نبرد'] } }, 0),
        me: { cards: hand(['معبد', 'کاروانسرا', 'میدان نبرد']), clock: '1:20', note: note(1), above: above({ 1: { gold: 1, city: ['عمارت'], ch: 1 } }, { acts: abActs('آدم‌کش', 'swords') }) },
        table: table({ 2: { gold: 2, hand: 4, city: ['کلیسا'] }, 6: { gold: 1, hand: 3, city: ['قصر کوچک'], crown: true }, 4: { gold: 1, hand: 3, city: ['میدان نبرد'] }, ranks: { 1: { st: 'cur', who: 1 }, 5: { st: 'up' }, 6: { st: 'up' } }, deck: 34 }),
        overlay: killM, railCard: rail(2, 6),
        status: `<b>دور ${fa(2)}: شما آدم‌کشید.</b> رتبهٔ ${fa(1)} اول صدا زده می‌شود و توانایی را پیش از درآمد هم می‌شود زد. اسقف و بازرگان رو کنار رفته‌اند و خاکستری‌اند؛ بقیهٔ رتبه‌ها مجازند.`,
        log: [[6, 'رضا شخصیت‌ها را کنار گذاشت'], [4, 'همه انتخاب کردند'], [1, 'رتبهٔ ۱، آدم‌کش: شما']], logNote: `دور ${fa(2)}`,
      },
      {
        shotTitle: 'توانایی دزد', turnSub: 'دور ۳: آدم‌کش و شخصیت کشته‌شده ممنوع',
        meta: ['زنده', '۴ نفر', 'دور ۳'],
        opps: opps({ 2: { gold: 1, hand: 3, city: ['کلیسا', 'صومعه'] }, 6: { gold: 2, hand: 3, city: ['قصر کوچک', 'کاخ'] }, 4: { gold: 3, hand: 2, city: ['میدان نبرد', 'بندر'], crown: true } }, 0),
        me: { cards: hand(MAGH), clock: '1:15', note: note(2), above: above({ 1: { gold: 2, city: ['عمارت', 'معبد'], ch: 2 } }, { acts: abActs('دزد', 'hand') }) },
        table: table({ 2: { gold: 1, hand: 3, city: ['کلیسا', 'صومعه'], ch: 1 }, 6: { gold: 2, hand: 3, city: ['قصر کوچک', 'کاخ'] }, 4: { gold: 3, hand: 2, city: ['میدان نبرد', 'بندر'], crown: true }, ranks: { 1: { st: 'rev', who: 2 }, 2: { st: 'cur', who: 1 }, 3: { st: 'up' }, 5: { st: 'up' }, 8: { st: 'hid', killed: true } }, deck: 30 }),
        overlay: robM, railCard: rail(3, 4),
        status: `<b>دور ${fa(3)}: شما دزدید.</b> نیلوفر (آدم‌کش) سردار را کشت. از یک شخصیت بدزدید تا وقتی صدا زده شد طلایش مال شما شود. آدم‌کش، سردارِ کشته‌شده و دو شخصیت رو کنار رفته خاکستری‌اند.`,
        log: [[4, 'سارا شخصیت‌ها را کنار گذاشت'], [2, 'نیلوفر (آدم‌کش) سردار را کشت'], [1, 'رتبهٔ ۲، دزد: شما']], logNote: `دور ${fa(3)}`,
      },
      {
        shotTitle: 'توانایی شعبده‌باز', turnSub: 'دور ۴: عوض کردن دست با بازیکن یا با دسته',
        meta: ['زنده', '۴ نفر', 'دور ۴'],
        opps: opps({ 2: { gold: 2, hand: 4, city: ['کلیسا', 'صومعه', 'اسکله'] }, 6: { gold: 1, hand: 2, city: ['قصر کوچک', 'کاخ', 'تیمچه'], crown: true }, 4: { gold: 2, hand: 3, city: ['میدان نبرد', 'بندر', 'کاروانسرا'] } }, 0),
        me: { cards: hand(MAGH, { sel: ['کاروانسرا', 'میدان نبرد'] }), clock: '1:10', note: note(3), above: above({ 1: { gold: 3, city: ['عمارت', 'معبد', 'کاروانسرا'], ch: 3 } }, { acts: abActs('شعبده‌باز', 'repeat') }) },
        table: table({ 2: { gold: 2, hand: 4, city: ['کلیسا', 'صومعه', 'اسکله'], ch: 2 }, 6: { gold: 1, hand: 2, city: ['قصر کوچک', 'کاخ', 'تیمچه'], crown: true }, 4: { gold: 2, hand: 3, city: ['میدان نبرد', 'بندر', 'کاروانسرا'], ch: 1 }, ranks: { 1: { st: 'rev', who: 4 }, 2: { st: 'rev', who: 2 }, 3: { st: 'cur', who: 1 }, 4: { st: 'hid', robbed: true }, 6: { st: 'up' }, 7: { st: 'hid', killed: true }, 8: { st: 'up' } }, deck: 27 }),
        overlay: magM, railCard: rail(4, 6),
        status: `<b>دور ${fa(4)}: شما شعبده‌بازید.</b> سارا (آدم‌کش) معمار را کشت و نیلوفر (دزد) از شاه دزدید. توانایی دو راه دارد: کل دستتان را با دست یک بازیکن عوض کنید، یا چند کارت را زیر دسته بگذارید و همان تعداد بکشید.`,
        log: [[6, 'رضا شخصیت‌ها را کنار گذاشت'], [4, 'سارا (آدم‌کش) معمار را کشت'], [2, 'نیلوفر (دزد) از شاه دزدید'], [1, 'رتبهٔ ۳، شعبده‌باز: شما']], logNote: `دور ${fa(4)}`,
      },
      {
        shotTitle: 'دور آخر', turnSub: 'شهر سارا کامل شد؛ نوبت رضا',
        meta: ['زنده', '۴ نفر', 'دور آخر'],
        opps: opps({ 2: { gold: 2, hand: 2, city: NIL6 }, 6: { gold: 3, hand: 2, city: REZ5 }, 4: { gold: 0, hand: 1, city: SAR8 } }, 6),
        me: { turn: false, cards: hand(['دژ', 'کاروانسرا']), clock: '0:50', note: note(7), above: above({ 1: { gold: 2, city: ME7, ch: 6, d: { 'قصر کوچک': { isNew: true } } } }) },
        table: table({ 2: { gold: 2, hand: 2, city: NIL6, ch: 4, crown: true }, 6: { gold: 3, hand: 2, city: REZ5, ch: 8 }, 4: { gold: 0, hand: 1, city: SAR8, ch: 7, full: true }, ranks: { 1: { st: 'up' }, 2: { st: 'none', note: 'کسی نبود' }, 3: { st: 'up' }, 4: { st: 'rev', who: 2 }, 5: { st: 'none', note: 'کسی نبود' }, 6: { st: 'rev', who: 1 }, 7: { st: 'rev', who: 4 }, 8: { st: 'cur', who: 6 } }, deck: 12, turn: 6, banner: `سارا هشتمین محله را ساخت؛ این دور آخر است` }),
        railCard: rail(7, 2),
        status: `<b>دور آخر.</b> سارا با معمار سه محله ساخت و شهرش ${fa(8)} محله‌ای شد. حالا رضا سردار است؛ شهر کامل سارا خراب نمی‌شود. بعد از نوبت رضا بازی تمام می‌شود.`,
        log: [[1, 'شما (بازرگان) قصر کوچک ساختید'], [4, 'سارا هشتمین محله را ساخت'], [6, 'نوبت رضا: سردار']], logNote: `دور ${fa(7)}`,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: opps({ 2: { gold: 2, hand: 2, city: NIL6 }, 6: { gold: 2, hand: 2, city: REZ6 }, 4: { gold: 0, hand: 1, city: SAR8 } }, 0).map((o) => ({ ...o, clock: '' })),
        me: { turn: false, clock: '', cards: hand(['دژ', 'کاروانسرا']), note: note(7), above: above({ 1: { gold: 2, city: ME7, ch: 6 } }) },
        table: table({ 2: { gold: 2, hand: 2, city: NIL6, ch: 4, crown: true }, 6: { gold: 2, hand: 2, city: REZ6, ch: 8 }, 4: { gold: 0, hand: 1, city: SAR8, ch: 7, full: true }, ranks: {}, deck: 12 }),
        overlay: endM, railCard: rail(7, 2),
        status: `<b>بازی تمام شد.</b> سارا با ${fa(27)} امتیاز برد؛ شما با ${fa(17)} دوم شدید.`,
        log: [[6, 'رضا کاروانسرا ساخت'], [4, 'سارا ۲۷ امتیاز'], [4, 'سارا برد']], logNote: `دور ${fa(7)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.ct-ranks{display:flex;gap:6px;direction:ltr;padding:6px 10px;border-radius:14px;background:rgba(6,14,20,.3);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)}
.ct-rk{position:relative;display:grid;justify-items:center;gap:2px;inline-size:64px;color:var(--felt-muted);font-size:11.5px;direction:rtl}
.ct-rk small{font-size:11.5px;white-space:nowrap;min-block-size:16px}
.ct-rk.is-cur .ct-t img{box-shadow:0 0 0 3px var(--felt-gold),0 0 0 6px rgba(232,166,66,.3)}
.ct-rk.is-cur small{color:var(--felt-gold);font-weight:700}
.ct-rk.is-rev small{color:var(--felt-ink)}
.ct-rk.is-up .ct-t,.ct-rk.is-none .ct-t{opacity:.45}
.ct-flag{inline-size:max-content;margin-block-start:1px;font-style:normal;font-size:10.5px;font-weight:800;padding:1px 5px;border-radius:999px;background:#E0505C;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.ct-flag--rob{background:#8D581A}
.ct-t{display:block;inline-size:40px;flex:none;position:relative}
.ct-t img{display:block;inline-size:100%;border-radius:5px;box-shadow:0 2px 4px rgba(0,0,0,.45)}
.ct-t--num,.ct-t--hid{block-size:44px;border-radius:5px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.25);display:grid;place-items:center;color:var(--felt-ink);font-size:16px}
.ct-t--hid{border:1.5px dashed rgba(250,245,236,.45);box-shadow:none;box-sizing:border-box;background:rgba(250,245,236,.05)}
.ct-t--sm{inline-size:40px}
.ct-ors{display:grid;gap:6px;inline-size:100%;max-inline-size:690px}
.ct-or{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:10px;padding:5px 10px;border-radius:12px;background:rgba(250,245,236,.05);box-shadow:inset 0 0 0 1px rgba(250,245,236,.1)}
.ct-or.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.ct-oh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;color:var(--felt-ink);font-size:12.5px}
.ct-oh i{inline-size:9px;block-size:9px;border-radius:50%}
.ct-oh b{font-size:13.5px}
.ct-oh .ct-t{inline-size:30px}
.ct-hc{color:var(--felt-muted)}
.ct-crown{inline-size:20px;block-size:20px}
.ct-g{display:inline-flex;align-items:center;gap:2px;font-weight:700}
.ct-g img{inline-size:20px;block-size:20px}
.ct-city{display:flex;gap:4px;direction:rtl;min-block-size:104px;align-items:center}
.ct-city--sm{min-block-size:52px;gap:3px}
.ct-d{position:relative;display:block;inline-size:80px;flex:none}
.ct-d img{display:block;inline-size:100%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
.ct-city--sm .ct-d{inline-size:40px}
.ct-d.is-new img{filter:drop-shadow(0 0 3px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold))}
.ct-d.is-sel{transform:translateY(-4px)}.ct-d.is-sel img{filter:drop-shadow(0 0 0 #FAF5EC) drop-shadow(0 0 3px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold))}
.ct-d.is-no img{filter:grayscale(.8) brightness(.8)}
.ct-d em{position:absolute;inset-block-end:-8px;inset-inline:0;margin-inline:auto;inline-size:max-content;display:inline-flex;align-items:center;gap:1px;font-style:normal;font-size:10.5px;font-weight:800;padding:0 4px;border-radius:999px;background:#142B3B;color:#FAF5EC}
.ct-d em img{inline-size:11px;filter:none}
.ct-empty{color:var(--felt-muted);font-size:12px}
.ct-deck{display:flex;gap:8px}
.ct-deck .bgv-chip{font-size:12.5px}
.ct-banner{display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.ct-draft{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;padding:8px 14px;border-radius:14px;background:rgba(6,14,20,.3);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink)}
.ct-rem{display:grid;gap:4px;justify-items:center}
.ct-rem small{color:var(--felt-muted);font-size:12px}
.ct-rem>div{display:flex;gap:6px}
.ct-rem .ct-t--hid{inline-size:40px}
.ct-order{display:flex;align-items:center;gap:4px;font-size:13px}
.ct-who{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:rgba(250,245,236,.08)}
.ct-who i{inline-size:8px;block-size:8px;border-radius:50%}
.ct-who.is-on{box-shadow:inset 0 0 0 2px var(--felt-gold);font-weight:700}
.ct-who.is-done{color:var(--felt-muted)}
.ct-who .bgv-icon{inline-size:14px;block-size:14px;color:#5FBF7A}
.ct-arrow .bgv-icon{inline-size:14px;block-size:14px;color:var(--felt-muted)}
.ct-me{display:grid;gap:6px;justify-items:center;inline-size:100%}
.ct-acts{display:flex;align-items:center;gap:8px}
.ct-bc{padding:4px 12px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:13px;font-weight:700}
.ct-mine{display:flex;align-items:flex-end;gap:12px}
.ct-mych{display:grid;justify-items:center;gap:2px;color:var(--felt-ink);font-size:12.5px;font-weight:700}
.ct-mych .ct-t{inline-size:80px}
.ct-mych .ct-t--hid{block-size:88px}
.ct-mycity{display:grid;gap:4px}
.ct-myh{display:flex;align-items:center;gap:8px;color:var(--felt-muted);font-size:12.5px}
.ct-myh .ct-g{color:var(--felt-ink);font-size:14px}
.ct-pick{display:grid;gap:8px}
.ct-pc{display:flex;gap:12px;align-items:center;padding:8px 10px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--border)}
.ct-pc .ct-t{inline-size:80px}
.ct-pc>div{display:grid;gap:2px;font-size:13.5px}
.ct-pc small{color:var(--text-muted);font-size:12px}
.ct-pc.is-sel{box-shadow:inset 0 0 0 2px var(--felt-gold,#E8A642);background:var(--surface-sunken)}
.ct-keep{display:flex;gap:16px;justify-content:center;padding-block:6px}
.ct-dr{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:8px;padding-block:6px;border-block-end:1px solid var(--border)}
.ct-dr b{display:grid;gap:2px;font-size:13px;color:var(--heading)}
.ct-dr b i{display:inline-block;inline-size:8px;block-size:8px;border-radius:50%;margin-inline-end:4px}
.ct-dr b small{font-weight:400;font-size:11px;color:var(--text-muted)}
.ct-dr .ct-city{padding-block-end:8px}
.ct-tg{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;direction:ltr}.ct-tgb{direction:rtl}
.ct-tgb{all:unset;cursor:pointer;display:grid;justify-items:center;gap:3px;padding:6px 2px 7px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--border);text-align:center}
.ct-tgb .ct-t{inline-size:44px}.ct-tgb b{font-size:12px;color:var(--heading);white-space:nowrap}.ct-tgb small{font-size:10.5px;color:var(--text-muted);white-space:nowrap}
.ct-tgb.is-sel{box-shadow:inset 0 0 0 2.5px #E8A642;background:var(--surface-sunken)}.ct-tgb.is-sel small{color:#8D581A;font-weight:700}
.ct-tgb:disabled{cursor:default;opacity:.42}.ct-tgb:disabled img{filter:grayscale(1)}
.ct-tgb.is-self{opacity:.7}.ct-tgb.is-self small{color:var(--heading)}
.ct-tgb.is-killed small,.ct-tgb.is-no small{color:#C0392B;font-weight:700}
.ct-mg{display:grid;gap:8px}
.ct-mo{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--border)}
.ct-mo>div{display:grid;gap:6px;flex:1;font-size:13.5px}.ct-mo>div>small{color:var(--text-muted);font-size:12.5px;line-height:1.6}
.ct-mo.is-on{box-shadow:inset 0 0 0 2px #E8A642;background:var(--surface-sunken)}
.ct-radio{flex:none;inline-size:16px;block-size:16px;margin-block-start:3px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--border-strong,#8A97A3)}
.ct-mo.is-on .ct-radio{box-shadow:inset 0 0 0 2px #E8A642,inset 0 0 0 5px var(--surface),inset 0 0 0 9px #E8A642}
.ct-mp{display:flex;gap:6px;flex-wrap:wrap}
.ct-mpb{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--border);font-size:13px}
.ct-mpb i{inline-size:8px;block-size:8px;border-radius:50%}.ct-mpb small{color:var(--text-muted)}
.ct-mo .ct-keep{justify-content:flex-start;padding-block:4px 2px}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.bgv-chip img{inline-size:16px;block-size:16px;margin-inline-end:4px}
.gc-seat__meta .ct-g img{inline-size:16px;block-size:16px}.gc-seat__meta .ct-crown{inline-size:18px;block-size:18px}
.cx-phone .gc-table{gap:4px}
.cx-phone .ct-deck{display:none}
.cx-phone .ct-mych small{display:none}
.ct-me--ph{gap:4px}.ct-me--ph .ct-myh{font-size:11.5px;flex-wrap:wrap}.ct-me--ph .ct-acts{gap:6px;margin-inline-start:auto}.ct-me--ph .ct-bc{font-size:12px;padding:3px 8px}.ct-me--ph .ct-mycity{gap:2px}
.cx-phone .ct-ranks{gap:3px;padding:4px 6px;margin-inline:6px}
.cx-phone .ct-rk{inline-size:40px;font-size:10px}.cx-phone .ct-rk small{font-size:10px;min-block-size:13px}
.cx-phone .ct-flag{font-size:9px;padding:0 3px;margin-block-start:-15px}
.cx-phone .ct-ors{gap:4px;padding-inline:6px;box-sizing:border-box}
.cx-phone .ct-or{grid-template-columns:62px 1fr;gap:6px;padding:4px 6px}
.cx-phone .ct-oh{font-size:11.5px}.cx-phone .ct-oh b{font-size:12px}.cx-phone .ct-oh .ct-t{inline-size:24px}
.cx-phone .ct-crown{inline-size:16px;block-size:16px}
.cx-phone .ct-draft{gap:8px;padding:6px 8px;margin-inline:6px}
.cx-phone .ct-order{font-size:11.5px;flex-wrap:wrap;justify-content:center}
.cx-phone .ct-banner{font-size:12px;padding:4px 10px;margin-inline:8px}
.ct-me--ph .ct-mych .ct-t{inline-size:40px}.ct-me--ph .ct-mych .ct-t--hid{block-size:44px}
.ct-me--ph .ct-mine{gap:8px}
.ct-me--ph .ct-city{min-block-size:52px}
.cx-phone .ct-pc .ct-t{inline-size:40px}.cx-phone .ct-pc{padding:6px 8px;gap:8px}.cx-phone .ct-pc>div{font-size:12.5px}
.cx-phone .ct-dr{grid-template-columns:64px 1fr}
.cx-phone .gd-modal__box{padding:14px}`,
    shotTitle: 'نوبت شما', turnSub: 'معمار: ساخت تا ۳ محله',
    diffs: [
      ['چیدمان', 'مثل BGA: نوار رتبه‌های ۱ تا ۸ وسط میز (رتبهٔ صدا زده‌شده طلایی، کشته و دزدیده با برچسب)، شهر هر حریف در یک ردیف با طلا، تعداد کارت و شخصیت رو شده، و شهر و شخصیت شما بالای دستتان'],
      ['آرت', 'محله‌ها، شخصیت‌ها، تاج و سکه همان رندرهای سادهٔ سایت‌اند، به اندازهٔ اصلی یا دقیقاً نصف، و بعداً با همان اندازه عوض می‌شوند. پشت کارت در بسته نیست، پس کارت پنهان یک خانهٔ خط‌چین «؟» است'],
      ['انتخاب شخصیت', 'کارت‌های کنار رفته با برچسب «این دور بازی نمی‌شوند»، ترتیب انتخاب با فلش و تعداد کارت مانده (§۵، §۶). پنجرهٔ انتخاب اسم، رتبه و توانایی کوتاه هر شخصیت را دارد'],
      ['نوبت', 'اول درآمد: «۲ طلا» یا «۲ کارت بکش» و نگه داشتن یکی (§۸، §۹)؛ بعد ساخت با شمارندهٔ «ساخت ۱ از ۳» و کارت‌های ساختنی روشن، تکراری و گران کم‌رنگ (§۱). توانایی‌ها پنجرهٔ خودشان را دارند، مثل سردار با قیمت خراب کردن روی هر محله و شهر اسقف قفل (§۱۰)، آدم‌کش و دزد با همهٔ رتبه‌ها و رتبه‌های ممنوع خاکستری (§۱۱، §۱۲) و شعبده‌باز با دو راه عوض کردن کارت (§۱۳)'],
      ['پایان', 'نوار «دور آخر» وقتی شهری کامل شد (§۱۴) و جدول قیمت محله‌ها، همهٔ انواع، شهر کامل و رتبهٔ شخصیت دور آخر (§۱۵)'],
      ['قوانین', 'مثل موتور: ۲ تا ۷ نفر، ۸ شخصیت و ۵۴ محلهٔ رنگی؛ پایان با شهر ۸ محله‌ای (BGA با ۷، E2)، بی‌محلهٔ بنفش (E1) و تساوی مشترک (E3)'],
    ],
  };
}
