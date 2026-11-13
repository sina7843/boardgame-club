// Risk / ریسک on the shared table frame (group B). Rules as the repo engine (classic world domination, 3–6 players):
// reinforce (territories ÷ 3, min 3, + continent bonus, card sets), attack (1–3 dice, defender always rolls the most it
// may: 2 with 2+ armies; highest dice compared in pairs, ties to the defender; blitz), occupy, one fortify, a card if
// you conquered at least one territory this turn.
// Board art: risk-map-clean (1612×940): the site's own map SVG (export job of the current ready map, same geometry,
// borders pixel-identical) with no owner colour, no tokens, no text; continents tinted from the Hasbro board.
// Owners are shown by the ready army pieces (army-0 red seat ۱, army-1 blue ۲, army-2 cream ۳) at each territory's
// centre from the site geometry.ts (REGIONS[t].center → map px: 6 + (x + 16) × 1600/1032), with the ready count plate
// over the piece's own plate and the live count on it.
// Mock: round 1, no conquest yet. 3 players, 35 starting armies each, 14 territories each (the random deal).
//   Arash (red, first): placed 4 on Brazil, attacked Venezuela twice (lost 2, killed 1), no conquest → 37 armies.
//   You (blue, turn 2): +4 (14 ÷ 3) on East Africa (6 → 10); attacked North Africa with 3 dice: 6 4 1 vs 6 3 →
//   one loss each (East Africa 9, North Africa 3). Phase 'attack': legal targets from East Africa = North Africa,
//   Egypt, Congo, Middle East; up to 3 dice (9 armies). Niloufar (cream) hasn't played: 35 − 2 = 33 armies. No cards yet.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const W = 1612, Hh = 940;
  const P = { alaska: [89.7, 101.0], northwestTerritory: [310.7, 112.5], greenland: [579.5, 72.8], alberta: [260.6, 173.1], ontario: [367.7, 198.4], quebec: [462.7, 170.0], westernUS: [283.8, 265.7], easternUS: [376.4, 286.3], centralAmerica: [319.8, 352.7], venezuela: [477.6, 504.0], peru: [463.4, 583.5], brazil: [555.8, 597.9], argentina: [504.9, 720.4], iceland: [700.3, 98.6], scandinavia: [912.8, 98.7], greatBritain: [772.8, 183.5], northernEurope: [824.6, 197.8], westernEurope: [759.0, 262.0], southernEurope: [884.4, 234.1], ukraine: [957.8, 180.9], northAfrica: [785.1, 391.1], egypt: [902.7, 388.9], eastAfrica: [941.2, 493.4], congo: [877.2, 564.6], southAfrica: [885.4, 662.3], madagascar: [986.6, 649.4], ural: [1057.3, 129.4], siberia: [1179.6, 186.8], yakutsk: [1344.8, 105.8], kamchatka: [1376.5, 193.9], irkutsk: [1280.3, 153.6], mongolia: [1284.3, 237.2], japan: [1393.4, 291.3], afghanistan: [1053.4, 285.4], china: [1252.4, 320.7], middleEast: [971.1, 309.3], india: [1133.0, 370.3], siam: [1225.1, 394.5], indonesia: [1282.1, 533.8], newGuinea: [1412.2, 568.5], westernAustralia: [1326.9, 704.9], easternAustralia: [1415.9, 713.8] };
  // armies now, grouped by owner seat (1 you blue, 0 Arash red, 2 Niloufar cream)
  const N = {
    // you (blue): 14 territories, 38
    northwestTerritory: 2, alberta: 2, quebec: 2, scandinavia: 2, southernEurope: 3, ukraine: 3, eastAfrica: 9, southAfrica: 2, madagascar: 1, yakutsk: 2, kamchatka: 3, indonesia: 3, newGuinea: 2, easternAustralia: 2,
    // Arash (red): 14, 37
    ontario: 2, peru: 2, brazil: 3, egypt: 3, ural: 3, siberia: 2, irkutsk: 2, mongolia: 2, japan: 2, china: 3, middleEast: 5, india: 2, siam: 4, westernAustralia: 2,
    // Niloufar (cream): 14, 34
    alaska: 2, greenland: 2, westernUS: 3, easternUS: 3, centralAmerica: 2, venezuela: 2, argentina: 2, iceland: 2, greatBritain: 3, northernEurope: 3, westernEurope: 3, northAfrica: 3, congo: 2, afghanistan: 1,
  };
  const SEAT = {};
  [['northwestTerritory', 'alberta', 'quebec', 'scandinavia', 'southernEurope', 'ukraine', 'eastAfrica', 'southAfrica', 'madagascar', 'yakutsk', 'kamchatka', 'indonesia', 'newGuinea', 'easternAustralia'],
   ['ontario', 'peru', 'brazil', 'egypt', 'ural', 'siberia', 'irkutsk', 'mongolia', 'japan', 'china', 'middleEast', 'india', 'siam', 'westernAustralia'],
   ['alaska', 'greenland', 'westernUS', 'easternUS', 'centralAmerica', 'venezuela', 'argentina', 'iceland', 'greatBritain', 'northernEurope', 'westernEurope', 'northAfrica', 'congo', 'afghanistan']]
    .forEach((ids, i) => ids.forEach((id) => { SEAT[id] = [1, 0, 2][i]; }));
  const WHO = ['آرش', 'شما', 'نیلوفر'];
  const TFA = { alaska: 'آلاسکا', northwestTerritory: 'قلمرو شمال‌غربی', greenland: 'گرینلند', alberta: 'آلبرتا', ontario: 'انتاریو', quebec: 'کبک', westernUS: 'غرب آمریکا', easternUS: 'شرق آمریکا', centralAmerica: 'آمریکای مرکزی', venezuela: 'ونزوئلا', peru: 'پرو', brazil: 'برزیل', argentina: 'آرژانتین', iceland: 'ایسلند', scandinavia: 'اسکاندیناوی', greatBritain: 'بریتانیا', northernEurope: 'اروپای شمالی', westernEurope: 'اروپای غربی', southernEurope: 'اروپای جنوبی', ukraine: 'اوکراین', northAfrica: 'شمال آفریقا', egypt: 'مصر', eastAfrica: 'شرق آفریقا', congo: 'کنگو', southAfrica: 'آفریقای جنوبی', madagascar: 'ماداگاسکار', ural: 'اورال', siberia: 'سیبری', yakutsk: 'یاکوتسک', kamchatka: 'کامچاتکا', irkutsk: 'ایرکوتسک', mongolia: 'مغولستان', japan: 'ژاپن', afghanistan: 'افغانستان', china: 'چین', middleEast: 'خاورمیانه', india: 'هند', siam: 'سیام', indonesia: 'اندونزی', newGuinea: 'گینه نو', westernAustralia: 'استرالیای غربی', easternAustralia: 'استرالیای شرقی' };
  const at = (x, y) => `left:${(x / W * 100).toFixed(3)}%;top:${(y / Hh * 100).toFixed(3)}%`;
  const tc = (id) => P[id]; // token centre = territory centre
  // ready army piece (owner colour + seat badge), the ready count plate over its own plate, live count on top
  const piece = (id) => `<span class="rk-pc" role="img" aria-label="${TFA[id]}: ${WHO[SEAT[id]]}، ${fa(N[id])} ارتش" style="${at(...P[id])}">${img(`risk-army-${SEAT[id]}`, '')}<span class="rk-pl${id === 'eastAfrica' || id === 'northAfrica' ? ' is-hot' : ''}">${img('risk-army-count-plate', '')}<b>${fa(N[id])}</b></span></span>`;
  const ring = (id, cls) => `<i class="rk-ring ${cls}" style="${at(...tc(id))}"></i>`;
  const [ax, ay] = tc('eastAfrica'), [bx, by] = tc('northAfrica');
  const arrow = `<svg class="rk-ov" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><defs><marker id="rkh" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#E8A642"/></marker></defs><path d="M${ax - 22} ${ay - 6}Q${(ax + bx) / 2} ${ay - 80} ${bx + 30} ${by + 4}" fill="none" stroke="#142B3B" stroke-width="11" stroke-linecap="round" opacity=".55"/><path d="M${ax - 22} ${ay - 6}Q${(ax + bx) / 2} ${ay - 80} ${bx + 30} ${by + 4}" fill="none" stroke="#E8A642" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 13" marker-end="url(#rkh)"/></svg>`;
  // lower pieces drawn last so they overlap the ones above them, like stacked tokens
  const inner = `${img('risk-map-clean', 'نقشهٔ جهان ریسک؛ مهرهٔ قرمز آرش، آبی شما، کرم نیلوفر')}
${['egypt', 'congo', 'middleEast'].map((id) => ring(id, 'is-can')).join('')}${ring('eastAfrica', 'is-from')}${ring('northAfrica', 'is-to')}${arrow}
${Object.keys(P).sort((a, b) => P[a][1] - P[b][1]).map(piece).join('')}<span class="rk-lbl" style="${at(tc('northAfrica')[0], tc('northAfrica')[1] - 40)}">هدف</span><span class="rk-lbl rk-lbl--from" style="${at(tc('eastAfrica')[0] + 6, tc('eastAfrica')[1] + 50)}">مبدأ</span>`;
  const dice = (ph) => `<span class="rk-dice"><span class="rk-dice__g" aria-label="تاس‌های شما: ۶، ۴، ۱">${img('risk-att-6', '۶')}${img('risk-att-4', '۴')}${img('risk-att-1', '۱')}</span><span class="rk-vs">${ph ? '' : 'در برابر'}</span><span class="rk-dice__g" aria-label="تاس‌های مدافع: ۶، ۳">${img('risk-def-6', '۶')}${img('risk-def-3', '۳')}</span></span>`;
  // phone: the part of the map around the battle (x 640–1160, y 236–656); the full map pans/zooms
  const CX = 640, CY = 236, CW = 520, CH = 420;
  const board = (ph) => ph
    ? `<div class="rk-map rk-map--ph" aria-label="نقشهٔ ریسک، بخش آفریقا"><div class="rk-pan" style="inline-size:${(W / CW * 100).toFixed(2)}%;left:${(-CX / CW * 100).toFixed(2)}%;top:${(-CY / CH * 100).toFixed(2)}%">${inner}</div><span class="rk-zoom">${ic('search')}کل نقشه</span></div>`
    : `<div class="rk-col"><div class="rk-map" aria-label="نقشهٔ ریسک"><div class="rk-pan">${inner}</div></div><div class="rk-tray"><small>آخرین نبرد</small>${dice(false)}<b>هر طرف ${fa(1)} ارتش از دست داد</b></div></div>`;
  const nd = (n, sel) => `<button type="button" class="rk-nd${sel ? ' is-sel' : ''}" aria-pressed="${sel}">${fa(n)}</button>`;
  const above = (ph) => ph
    ? `<div class="rk-ctl rk-ctl--ph"><div class="rk-ctl__row">${dice(true)}<span class="rk-res rk-res--ph">هر طرف <b>${fa(1)}</b> ارتش از دست داد</span></div><div class="rk-ctl__row"><span class="rk-nds" role="group" aria-label="تعداد تاس">${nd(1)}${nd(2)}${nd(3, true)}</span>${btn('حمله', 'primary', 'swords')}${btn('سریع', 'secondary', 'zap')}${btn('پایان', 'secondary', 'next')}</div></div>`
    : `<div class="rk-ctl"><span class="rk-res"><b>شرق آفریقا ${fa(9)}${ic('prev')}شمال آفریقا ${fa(3)}</b><small>مدافع ${fa(2)} تاس می‌ریزد</small></span><span class="rk-nds" role="group" aria-label="تعداد تاس">${nd(1)}${nd(2)}${nd(3, true)}</span><span class="rk-btns">${btn('حمله', 'primary', 'swords')}${btn('حملهٔ سریع', 'secondary', 'zap')}${btn('پایان حمله', 'secondary', 'next')}</span></div>`;
  const stat = (k, t, a, c) => `<span class="rk-sum">${img(`risk-army-${k}`, '')}${fa(t)} قلمرو<span class="bgv-sep"></span>${fa(a)} ارتش<span class="bgv-sep"></span>${fa(c)} کارت</span>`;
  // ---- phases: any map state (owners move with the pieces; the map itself has no owner colour) ----
  const { modal } = H;
  const pieceS = (id, S) => { const n = S.N[id], s = S.SEAT[id]; return `<span class="rk-pc${(S.ghost ?? []).includes(id) ? ' is-ghost' : ''}" role="img" aria-label="${TFA[id]}: ${WHO[s]}، ${fa(n)} ارتش" style="${at(...P[id])}">${img(`risk-army-${s}`, '')}<span class="rk-pl${(S.hot ?? []).includes(id) ? ' is-hot' : ''}">${img('risk-army-count-plate', '')}<b>${fa(n)}</b></span></span>`; };
  const arrowOf = (a, b) => { const [x1, y1] = P[a], [x2, y2] = P[b]; const d = `M${x1} ${y1 - 10}Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 80} ${x2} ${y2 - 14}`; return `<svg class="rk-ov" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><defs><marker id="rkh2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#E8A642"/></marker></defs><path d="${d}" fill="none" stroke="#142B3B" stroke-width="11" stroke-linecap="round" opacity=".55"/><path d="${d}" fill="none" stroke="#E8A642" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 13" marker-end="url(#rkh2)"/></svg>`; };
  const innerOf = (S) => `${img('risk-map-clean', 'نقشهٔ جهان ریسک')}
${(S.rings ?? []).map(([id, cls]) => ring(id, cls)).join('')}${S.arrow ? arrowOf(...S.arrow) : ''}
${Object.keys(P).sort((a, b) => P[a][1] - P[b][1]).map((id) => pieceS(id, S)).join('')}${(S.labels ?? []).map(([id, t, dy, cls]) => `<span class="rk-lbl${cls ? ' ' + cls : ''}" style="${at(P[id][0], P[id][1] + dy)}">${t}</span>`).join('')}`;
  const boardS = (S, focus = [640, 236]) => (ph) => ph
    ? `<div class="rk-map rk-map--ph" aria-label="نقشهٔ ریسک"><div class="rk-pan" style="inline-size:${(W / CW * 100).toFixed(2)}%;left:${(-focus[0] / CW * 100).toFixed(2)}%;top:${(-focus[1] / CH * 100).toFixed(2)}%">${innerOf(S)}</div><span class="rk-zoom">${ic('search')}کل نقشه</span></div>`
    : `<div class="rk-map" aria-label="نقشهٔ ریسک"><div class="rk-pan">${innerOf(S)}</div></div>`;
  const ME_IDS = Object.keys(SEAT).filter((k) => SEAT[k] === 1);
  const own = (patch) => { const s = { ...SEAT }; for (const [k, v] of Object.entries(patch)) s[k] = v; return s; };
  // setup: 35 each, 14 claimed each (1 army), placing the rest one at a time; you have 21 left
  const N0 = Object.fromEntries(Object.keys(P).map((k) => [k, 1]));
  Object.assign(N0, { eastAfrica: 3, southernEurope: 2, ukraine: 2, kamchatka: 2, brazil: 3, middleEast: 2, siam: 2, westernEurope: 2, northAfrica: 2, greatBritain: 2 });
  // round 5: you hold 15 territories (took Egypt? not yet), cards traded later
  const N5 = { ...N, eastAfrica: 12, southAfrica: 4, egypt: 4, middleEast: 6, northAfrica: 4, southernEurope: 7, ukraine: 3, congo: 3 };
  const SEAT5 = own({ congo: 1 });
  const nd2 = (t, sel, lbl) => `<button type="button" class="rk-nd${sel ? ' is-sel' : ''}"${lbl ? ` aria-label="${lbl}"` : ''}>${t}</button>`;
  const stepper = (val, lbl) => `<span class="rk-nds" role="group" aria-label="${lbl}">${nd2('−', false, 'کم کردن')}<b class="rk-val">${val}</b>${nd2('+', false, 'زیاد کردن')}</span>`;
  const ctl = (title, sub, mid, btns) => (ph) => `<div class="rk-ctl${ph ? ' rk-ctl--ph rk-ctl--g' : ''}"><span class="rk-res"><b>${title}</b><small>${sub}</small></span>${mid}<span class="rk-btns">${btns(ph)}</span></div>`;
  const left = (n, t) => `<span class="rk-left">${img('risk-army-1', '')}<b>${fa(n)}</b>${t}</span>`;
  const cardsRow = (list) => `<div class="rk-cards">${list.map(([n, alt, sel]) => `<span class="rk-card${sel ? ' is-sel' : ''}">${img(`risk-card-${n}`, alt)}</span>`).join('')}</div>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const trade = (ph) => modal('معاوضهٔ کارت', `<p>۵ کارت دارید، پس <b>باید پیش از چیدن نیرو</b> یک دسته معاوضه کنید. سه کارت پیاده انتخاب شده است.</p>
${cardsRow([[24, 'آفریقای جنوبی، پیاده', true], [0, 'آلاسکا، پیاده', true], [12, 'آرژانتین، پیاده', true], [19, 'اوکراین، سواره'], [42, 'جوکر']])}
<div class="gc-pills"><span class="bgv-chip">ارزش این دسته: ${fa(8)} ارتش</span><span class="bgv-chip">دستهٔ بعدی، برای همه: ${fa(10)}</span><span class="bgv-chip">آفریقای جنوبی مال شماست: ${fa(2)}+ همان‌جا</span></div>
<p class="cx-note">دسته یعنی سه نماد یکسان، یکی از هر نماد، یا دو کارت و یک جوکر. ارزش دسته‌ها برای همه بالا می‌رود: ${fa(4)}، ${fa(6)}، ${fa(8)}، ${fa(10)}، ${fa(12)}، ${fa(15)} و بعد هر بار ${fa(5)} تا بیشتر.</p>`,
    `${btn('بعداً', 'secondary', 'x', ' disabled')}${btn('معاوضه', 'primary', 'check')}`);
  const elim = (ph) => modal('نیلوفر حذف شد', `<p>آخرین قلمرو نیلوفر را گرفتید و ${fa(4)} کارت او به شما رسید. حالا ${fa(7)} کارت دارید؛ چون ${fa(6)} کارت یا بیشتر است <b>همین حالا</b> معاوضه کنید تا ${fa(4)} کارت یا کمتر بماند، نیرو بچینید و حمله را ادامه دهید.</p>
${cardsRow([[1, 'قلمرو شمال‌غربی، سواره', true], [16, 'اروپای شمالی، سواره', true], [42, 'جوکر', true], [2, 'گرینلند، توپخانه'], [29, 'کامچاتکا، توپخانه'], [35, 'خاورمیانه، توپخانه'], [19, 'اوکراین، سواره']])}
<div class="gc-pills"><span class="bgv-chip">ارزش این دسته: ${fa(15)} ارتش</span><span class="bgv-chip">بعد از این معاوضه: ${fa(4)} کارت</span></div>`,
    `${btn(`معاوضه و چیدن ${fa(15)} ارتش`, 'primary', 'check')}`);
  const gotCard = (ph) => modal('یک کارت گرفتید', `<div class="rk-got">${img('risk-card-21', 'کارت مصر، پیاده')}<p>این نوبت مصر را گرفتید، پس آخر نوبت یک کارت از دسته به شما رسید. <b>فقط شما</b> این کارت را می‌بینید؛ بقیه فقط می‌بینند که یک کارت گرفتید.</p></div><div class="gc-pills"><span class="bgv-chip">کارت‌های شما: ${fa(3)}</span><span class="bgv-chip">دسته: ${fa(31)} کارت</span></div>`, `${btn('باشه', 'primary', 'check')}`);
  const RAIL5 = `<section class="cx-card"><h3>این نوبت<span class="bgv-spacer"></span><span class="cx-note">دور ۵</span></h3><div class="gc-pills"><span class="bgv-chip">نیرو: ${fa(13)}</span><span class="bgv-chip">دستهٔ بعدی: ${fa(10)}</span><span class="bgv-chip rk-deck">${img('risk-card-back', '')}دسته: ${fa(32)} کارت</span></div><div class="ga-rule">${ic('info')}<span>پایان حمله یعنی یک جابه‌جایی و بعد پایان نوبت. اگر این نوبت دست‌کم یک قلمرو بگیرید، آخر نوبت یک کارت می‌گیرید.</span></div></section>`;
  const ALLME = Object.fromEntries(Object.keys(P).map((k) => [k, 1]));
  const NEND = { ...N, eastAfrica: 4, egypt: 6, middleEast: 9, ukraine: 5, siam: 3, india: 3, china: 4, peru: 2, brazil: 3, argentina: 2, venezuela: 4 };
  const ending = (ph) => modal('شما بردید', `<p>هر ${fa(42)} قلمرو نقشه مال شماست؛ آرش آخرین نفری بود که حذف شد.</p>
${tbl(['رتبه', 'بازیکن', 'حذف در', 'فتح‌ها', 'دسته‌های معاوضه'], [{ c: [fa(1), 'شما', '—', fa(37), fa(4)], win: true }, { c: [fa(2), 'آرش', `دور ${fa(16)}`, fa(24), fa(3)] }, { c: [fa(3), 'نیلوفر', `دور ${fa(11)}`, fa(15), fa(2)] }])}<p class="cx-note">رتبهٔ بقیه به ترتیب عکس حذف شدن است.</p>`,
    `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Risk', fa: 'ریسک', latin: 'Risk', meta: ['زنده', '۳ نفر', 'دور ۱'],
    opps: [
      { name: 'آرش', av: 'آ', seat: 3, clock: '2:00', meta: stat(0, 14, 37, 0) },
      { name: 'نیلوفر', av: 'ن', seat: 4, clock: '2:00', meta: stat(2, 14, 33, 0) },
    ],
    me: { cards: [], clock: '1:31', turn: true, note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(14)} قلمرو<span class="bgv-sep"></span>${fa(38)} ارتش<span class="bgv-sep"></span>${fa(0)} کارت</span>`, above },
    table: (ph) => board(ph),
    status: '<b>نوبت شماست؛ مرحلهٔ حمله.</b> از شرق آفریقا (۹ ارتش) به شمال آفریقای نیلوفر (۳ ارتش) حمله کردید و هر طرف یک ارتش از دست داد. دوباره بزنید، هدف دیگری از خط‌چین‌ها انتخاب کنید یا حمله را تمام کنید.',
    pstatus: '<b>نوبت شما، حمله.</b> شرق آفریقا ۹ در برابر شمال آفریقا ۳.',
    railCard: `<section class="cx-card"><h3>این نوبت<span class="bgv-spacer"></span><span class="cx-note">آبی</span></h3><div class="gc-pills"><span class="bgv-chip">نیرو گرفتید: ${fa(4)}</span><span class="bgv-chip">آفریقا: ${fa(3)} از ${fa(6)}</span><span class="bgv-chip rk-deck">${img('risk-card-back', '')}دسته: ${fa(44)} کارت</span></div><div class="ga-rule">${ic('info')}<span>بالاترین تاس‌ها دوبه‌دو مقایسه می‌شوند و مساوی به نفع مدافع است. مدافع با ۲ ارتش یا بیشتر ۲ تاس می‌ریزد. اگر این نوبت دست‌کم یک قلمرو بگیرید، آخر نوبت یک کارت می‌گیرید.</span></div></section>`,
    logNote: 'دور ۱',
    log: [[3, 'آرش ۴ ارتش در برزیل گذاشت'], [3, 'آرش دو بار به ونزوئلا حمله کرد: ۲ ارتش از آرش، ۱ از نیلوفر'], [3, 'آرش بی فتح، نوبت را تمام کرد'], [1, 'شما ۴ ارتش در شرق آفریقا گذاشتید'], [1, 'شرق آفریقا به شمال آفریقا: ۶، ۴، ۱ در برابر ۶، ۳؛ یکی از هر طرف']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['globe', 'کل نقشه'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'چیدمان آغاز', turnSub: 'ارتش‌های مانده، هر بار یکی', meta: ['زنده', '۳ نفر', 'چیدمان'],
        opps: [{ name: 'آرش', av: 'آ', seat: 3, clock: '0:30', meta: stat(0, 14, 15, 0) }, { name: 'نیلوفر', av: 'ن', seat: 4, clock: '0:30', meta: stat(2, 14, 14, 0) }],
        table: boardS({ N: N0, SEAT, rings: [['quebec', 'is-to'], ...ME_IDS.filter((k) => k !== 'quebec').map((k) => [k, 'is-can'])], labels: [['quebec', '+۱', -40]] }, [200, 40]),
        me: { clock: '0:24', note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(14)} قلمرو<span class="bgv-sep"></span>${fa(14)} ارتش روی نقشه</span>`, above: ctl('چیدن ارتش‌های آغازین', 'به نوبت، هر نفر یکی', left(21, 'ارتش مانده'), (ph) => `${btn(ph ? 'کبک' : 'یکی در کبک', 'primary', 'check')}`) },
        status: '<b>چیدمان: نوبت شماست.</b> قلمروها پخش شده‌اند و هر کدام یک ارتش دارد. ۲۱ ارتش دیگر دارید؛ به نوبت هر بار یکی را روی یکی از قلمروهای خودتان (خط‌چین) بگذارید.',
        pstatus: '<b>چیدمان.</b> ۲۱ ارتش مانده؛ یکی بگذارید.',
        railCard: `<section class="cx-card"><h3>چیدمان<span class="bgv-spacer"></span><span class="cx-note">۳۵ ارتش برای هر نفر</span></h3><div class="gc-pills"><span class="bgv-chip">شما: ${fa(21)} مانده</span><span class="bgv-chip">آرش: ${fa(20)} مانده</span><span class="bgv-chip">نیلوفر: ${fa(21)} مانده</span></div></section>`,
        log: [[3, 'آرش یک ارتش در برزیل گذاشت'], [4, 'نیلوفر یک ارتش در بریتانیا گذاشت'], [1, 'نوبت شما: یک ارتش']],
      },
      {
        shotTitle: 'معاوضهٔ کارت', turnSub: 'با ۵ کارت اجباری؛ ارزش دسته و پاداش قلمرو', meta: ['زنده', '۳ نفر', 'دور ۵'],
        table: boardS({ N: N5, SEAT: SEAT5, rings: [['southAfrica', 'is-to']] }), overlay: trade,
        me: { cards: [{ art: 'risk-card-24', alt: 'آفریقای جنوبی', sel: true }, { art: 'risk-card-0', alt: 'آلاسکا', sel: true }, { art: 'risk-card-12', alt: 'آرژانتین', sel: true }, { art: 'risk-card-19', alt: 'اوکراین' }, { art: 'risk-card-42', alt: 'جوکر' }], above: () => '', note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(15)} قلمرو<span class="bgv-sep"></span>${fa(5)} کارت</span>` },
        cardW: 70, phoneCardW: 48, cardRatio: 1.38, railCard: RAIL5,
        status: '<b>شروع نوبت شما، دور ۵.</b> ۵ کارت دارید و پیش از چیدن نیرو باید یک دسته معاوضه کنید.',
        pstatus: '<b>معاوضه اجباری است.</b>',
        log: [[3, 'آرش دسته‌ای را با ۶ ارتش معاوضه کرد'], [3, 'آرش نوبتش را تمام کرد'], [1, 'نوبت شما: ۵ کارت دارید']],
      },
      {
        shotTitle: 'چیدن نیرو', turnSub: 'ارتش‌های مانده و +/− روی قلمرو', meta: ['زنده', '۳ نفر', 'دور ۵'],
        table: boardS({ N: { ...N5, eastAfrica: 15, southAfrica: 6 }, SEAT: SEAT5, rings: [['eastAfrica', 'is-to'], ...ME_IDS.filter((k) => k !== 'eastAfrica').concat('congo').map((k) => [k, 'is-can'])], labels: [['eastAfrica', '+۳', 50], ['southAfrica', '+۲ کارت', 46, 'rk-lbl--from']], hot: ['eastAfrica'] }),
        me: { cards: [{ art: 'risk-card-19', alt: 'اوکراین' }, { art: 'risk-card-42', alt: 'جوکر' }], above: ctl('شرق آفریقا: ۱۵', 'قلمرو انتخاب‌شده', `${stepper('+۳', 'ارتش این قلمرو')}${left(7, 'از ۱۳ مانده')}`, (ph) => `${btn(ph ? 'تأیید' : 'تأیید چیدن', 'primary', 'check', ' disabled')}${btn('برگرداندن', 'secondary', 'undo')}`), note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(15)} قلمرو<span class="bgv-sep"></span>${fa(2)} کارت</span>` },
        cardW: 70, phoneCardW: 48, cardRatio: 1.38, railCard: RAIL5,
        status: '<b>چیدن نیرو: ۱۳ ارتش.</b> ۵ برای ۱۵ قلمرو و ۸ از دستهٔ کارت؛ ۲ ارتش پاداش کارت خودکار روی آفریقای جنوبی نشست. روی قلمرو بزنید و با + و − تعداد را عوض کنید؛ «تأیید» وقتی همه چیده شد فعال می‌شود.',
        pstatus: '<b>چیدن نیرو.</b> ۷ از ۱۳ مانده.',
        railCard: `<section class="cx-card"><h3>نیروی این نوبت<span class="bgv-spacer"></span><span class="cx-note">${fa(13)}</span></h3><div class="gc-pills"><span class="bgv-chip">${fa(15)} قلمرو ÷ ${fa(3)}: ${fa(5)}</span><span class="bgv-chip">دستهٔ کارت: ${fa(8)}</span><span class="bgv-chip">قاره: ${fa(0)}</span><span class="bgv-chip">پاداش کارت: ${fa(2)} (آفریقای جنوبی)</span></div></section>`,
        log: [[1, 'شما سه پیاده را با ۸ ارتش معاوضه کردید'], [1, '۲ ارتش پاداش در آفریقای جنوبی'], [1, '۳ ارتش در شرق آفریقا']],
        phone: true,
      },
      {
        shotTitle: 'اشغال بعد از فتح', turnSub: 'چند ارتش به قلمرو تازه برود', meta: ['زنده', '۳ نفر', 'دور ۵'],
        table: boardS({ N: { ...N5, eastAfrica: 19, southAfrica: 6, egypt: 3 }, SEAT: own({ congo: 1, egypt: 1 }), rings: [['eastAfrica', 'is-from'], ['egypt', 'is-to']], arrow: ['eastAfrica', 'egypt'], hot: ['egypt', 'eastAfrica'], ghost: ['egypt'], labels: [['egypt', 'فتح شد', -40]] }),
        me: { cards: [{ art: 'risk-card-19', alt: 'اوکراین' }, { art: 'risk-card-42', alt: 'جوکر' }], above: ctl('مصر را گرفتید', 'دست‌کم ۳ (تاس‌های آخر)، حداکثر ۱۸', stepper(fa(6), 'تعداد ارتش برای مصر'), (ph) => `${btn('حداقل', 'secondary', 'first')}${btn(ph ? 'همه' : 'همه جز یکی', 'secondary', 'last')}${btn('تأیید', 'primary', 'check')}`), note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(16)} قلمرو<span class="bgv-sep"></span>${fa(2)} کارت</span>` },
        cardW: 70, phoneCardW: 48, cardRatio: 1.38, railCard: RAIL5,
        status: '<b>مصر فتح شد.</b> با ۳ تاس حمله کردید، پس دست‌کم ۳ ارتش باید به مصر برود و حداکثر ۱۸ (یکی در شرق آفریقا می‌ماند). مهرهٔ مصر حالا آبی است.',
        pstatus: '<b>اشغال مصر.</b> ۳ تا ۱۸ ارتش.',
        log: [[1, 'شرق آفریقا به مصر: ۶، ۵، ۲ در برابر ۴'], [3, 'آخرین ارتش آرش در مصر از بین رفت'], [1, 'شما مصر را گرفتید']],
        phone: true,
      },
      {
        shotTitle: 'جابه‌جایی', turnSub: 'مبدأ، مقصدهای مجاز، تعداد و پایان نوبت', meta: ['زنده', '۳ نفر', 'دور ۵'],
        table: boardS({ N: { ...N5, eastAfrica: 13, southAfrica: 6, egypt: 6 }, SEAT: own({ congo: 1, egypt: 1 }), rings: [['southernEurope', 'is-from'], ['ukraine', 'is-to'], ['scandinavia', 'is-can']], arrow: ['southernEurope', 'ukraine'], labels: [['southernEurope', 'مبدأ', 46, 'rk-lbl--from'], ['ukraine', 'مقصد', -40]] }, [640, 30]),
        me: { cards: [{ art: 'risk-card-19', alt: 'اوکراین' }, { art: 'risk-card-42', alt: 'جوکر' }], above: ctl('اروپای جنوبی ۷ به اوکراین ۳', 'از راه قلمروهای به‌هم‌پیوستهٔ خودتان', stepper(fa(5), 'تعداد ارتش جابه‌جایی'), (ph) => `${btn(ph ? 'جابه‌جایی' : 'جابه‌جایی و پایان نوبت', 'primary', 'check')}${btn(ph ? 'پایان' : 'پایان بی جابه‌جایی', 'secondary', 'next')}`), note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(16)} قلمرو<span class="bgv-sep"></span>${fa(2)} کارت</span>` },
        cardW: 70, phoneCardW: 48, cardRatio: 1.38, railCard: RAIL5,
        status: '<b>حمله تمام شد؛ یک جابه‌جایی دارید.</b> از اروپای جنوبی (۷) تا ۶ ارتش به یکی از قلمروهای وصل‌شدهٔ خودتان ببرید؛ مقصدهای مجاز خط‌چین‌اند. دست‌کم یک ارتش می‌ماند.',
        pstatus: '<b>جابه‌جایی.</b> اروپای جنوبی به اوکراین.',
        log: [[1, 'شما مصر را گرفتید و ۶ ارتش بردید'], [1, 'شما حمله را تمام کردید']],
        phone: true,
      },
      {
        shotTitle: 'کارت پایان نوبت', turnSub: 'فقط برای خودتان', phone: true, phoneOnly: true, meta: ['زنده', '۳ نفر', 'دور ۵'],
        table: boardS({ N: { ...N5, eastAfrica: 13, southAfrica: 6, egypt: 6, southernEurope: 2, ukraine: 8 }, SEAT: own({ congo: 1, egypt: 1 }) }), overlay: gotCard,
        me: { turn: false, cards: [{ art: 'risk-card-19', alt: 'اوکراین' }, { art: 'risk-card-42', alt: 'جوکر' }, { art: 'risk-card-21', alt: 'مصر', sel: true }], above: () => '' },
        cardW: 70, phoneCardW: 48, cardRatio: 1.38, railCard: RAIL5,
        pstatus: '<b>نوبت تمام شد.</b> یک کارت گرفتید.', status: '<b>نوبت تمام شد.</b> یک کارت گرفتید.',
      },
      {
        shotTitle: 'حذف بازیکن', turnSub: 'کارت‌های حذف‌شده و معاوضهٔ فوری', meta: ['زنده', '۳ نفر', 'دور ۱۱'],
        opps: [{ name: 'آرش', av: 'آ', seat: 3, clock: '2:00', meta: stat(0, 17, 41, 3) }, { name: 'نیلوفر', av: 'ن', seat: 4, out: true, meta: '<span class="gc-tag gc-tag--soft">حذف شد</span>' }],
        table: boardS({ N: { ...N5, argentina: 4, venezuela: 1, peru: 3, brazil: 5 }, SEAT: own({ congo: 1, egypt: 1, northAfrica: 1, westernEurope: 1, greatBritain: 1, northernEurope: 1, iceland: 1, greenland: 1, alaska: 0, westernUS: 0, easternUS: 0, centralAmerica: 0, venezuela: 1, argentina: 1, afghanistan: 0 }), rings: [['argentina', 'is-to']], labels: [['argentina', 'آخرین قلمرو نیلوفر', -40]] }, [300, 450]), overlay: elim,
        me: { cards: [{ art: 'risk-card-1', alt: '', sel: true }, { art: 'risk-card-16', alt: '', sel: true }, { art: 'risk-card-42', alt: '', sel: true }, { art: 'risk-card-2', alt: '' }, { art: 'risk-card-29', alt: '' }, { art: 'risk-card-35', alt: '' }, { art: 'risk-card-19', alt: '' }], above: () => '', note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(25)} قلمرو<span class="bgv-sep"></span>${fa(7)} کارت</span>` },
        cardW: 64, phoneCardW: 44, cardRatio: 1.38, railCard: '',
        status: '<b>نیلوفر حذف شد.</b> ۴ کارت او به شما رسید و ۷ کارت دارید؛ باید همین حالا معاوضه کنید.',
        log: [[1, 'آرژانتین به دست شما افتاد'], [4, 'نیلوفر حذف شد'], [1, 'کارت‌های نیلوفر به شما رسید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'همهٔ ۴۲ قلمرو', meta: ['تمام شد', '۳ نفر', 'دور ۱۶'],
        opps: [{ name: 'آرش', av: 'آ', seat: 3, out: true, meta: '<span class="gc-tag gc-tag--soft">حذف شد</span>' }, { name: 'نیلوفر', av: 'ن', seat: 4, out: true, meta: '<span class="gc-tag gc-tag--soft">حذف شد</span>' }],
        table: boardS({ N: NEND, SEAT: ALLME }), overlay: ending,
        me: { turn: false, clock: '', above: () => '', note: `<span class="rk-sum rk-sum--me">${img('risk-army-1', '')}${fa(42)} قلمرو</span>` },
        railCard: '',
        status: '<b>بازی تمام شد.</b> همهٔ ۴۲ قلمرو مال شماست.',
        log: [[1, 'شما آخرین قلمرو آرش را گرفتید'], [3, 'آرش حذف شد'], [1, 'شما بردید']],
      },
    ],    css: `.rk-map{position:relative;direction:ltr;inline-size:var(--bw,700px);aspect-ratio:${W}/${Hh};flex:none;border-radius:8px;overflow:hidden;box-shadow:0 16px 24px -12px rgba(0,0,0,.7)}
.rk-pan{position:absolute;inset-block-start:0;inset-inline-start:0;inline-size:100%;aspect-ratio:${W}/${Hh}}
.rk-pan>img{display:block;inline-size:100%;block-size:100%}
.rk-map--ph{--bw:370px;aspect-ratio:${CW}/${CH};--k:${(W / CW).toFixed(3)}}
.rk-ov{position:absolute;inset:0;inline-size:100%;block-size:100%}
.rk-pc,.rk-ring,.rk-lbl{position:absolute;transform:translate(-50%,-50%)}
.rk-pc{--u:calc(var(--bw,700px) * var(--k,1) / ${W});inline-size:max(44px,calc(var(--u) * 92));aspect-ratio:1}
.rk-pc>img{display:block;inline-size:100%;block-size:100%}
.rk-pl{--d:max(15px,calc(var(--u) * 34));position:absolute;left:50%;top:67.6%;inline-size:calc(var(--d) * 108 / 64);aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center}
.rk-pl>img{position:absolute;inset:0;inline-size:100%;block-size:100%}
.rk-pl>b{position:relative;color:#2A2520;font-weight:800;font-size:max(10px,calc(var(--u) * 20));line-height:1;letter-spacing:0}
.rk-pl.is-hot>b{color:#9A2A12}
.rk-ring{--u:calc(var(--bw,700px) * var(--k,1) / ${W});inline-size:calc(var(--u) * 58);aspect-ratio:1;border-radius:50%;box-sizing:border-box}
.rk-ring.is-can{border:calc(var(--u) * 4) dashed #142B3B;background:rgba(232,166,66,.22)}
.rk-ring.is-from{inline-size:calc(var(--u) * 60);box-shadow:0 0 0 calc(var(--u) * 4) #E8A642,0 0 0 calc(var(--u) * 7) #142B3B}
.rk-ring.is-to{inline-size:calc(var(--u) * 64);box-shadow:0 0 0 calc(var(--u) * 4) #E8A642,0 0 0 calc(var(--u) * 7) #142B3B,0 0 calc(var(--u) * 26) calc(var(--u) * 8) rgba(232,166,66,.7)}
.rk-lbl{padding:0 7px;border-radius:999px;background:#E8A642;color:#142B3B;font-size:11.5px;font-weight:800;line-height:18px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.45)}
.rk-lbl--from{background:#142B3B;color:#FAF5EC}
.rk-zoom{position:absolute;inset-block-end:8px;inset-inline-start:8px;display:inline-flex;align-items:center;gap:4px;padding:0 9px;border-radius:999px;background:rgba(20,43,59,.85);color:#FAF5EC;font-size:11.5px;font-weight:700;line-height:24px}.rk-zoom .bgv-icon{inline-size:13px;block-size:13px}
.rk-sum{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.rk-sum img{inline-size:18px;block-size:18px;margin-inline-end:2px}
.rk-ctl{display:flex;align-items:center;gap:12px;inline-size:100%;padding:8px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.rk-dice{display:inline-flex;align-items:center;gap:6px;flex:none}.rk-dice__g{display:inline-flex;gap:3px}.rk-dice img{inline-size:30px;block-size:30px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.45))}
.rk-vs{font-size:11.5px;color:var(--felt-muted)}
.rk-res{display:grid;gap:2px;flex:1;font-size:14px;white-space:nowrap}.rk-res small{font-size:12px;color:var(--felt-muted)}
.rk-nds{display:inline-flex;border-radius:var(--radius-sm);overflow:hidden;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23;flex:none}
.rk-nd{all:unset;box-sizing:border-box;cursor:pointer;inline-size:34px;block-size:36px;display:grid;place-items:center;background:var(--felt-control);color:#142B3B;font-weight:800;font-size:15px}
.rk-nd+.rk-nd{border-inline-start:1px solid #8EA7B4}.rk-nd.is-sel{background:var(--felt-gold)}
.rk-btns{display:flex;gap:6px}
.rk-res--ph{display:block}.rk-ctl--ph{display:grid;gap:6px;margin-inline:10px;inline-size:auto;padding:6px 8px}
.rk-ctl__row{display:flex;align-items:center;gap:8px}.rk-ctl--ph .rk-dice img{inline-size:24px;block-size:24px}.rk-ctl--ph .rk-res{font-size:12.5px}
.rk-ctl--ph .rk-nd{inline-size:30px;block-size:34px}.rk-ctl--ph .bgv-btn{padding-inline:10px;flex:1}
.rk-col{display:grid;justify-items:center;gap:12px}.rk-tray{display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(8,20,28,.3);color:#FAF5EC;font-size:12px;white-space:nowrap}
.rk-tray small{font-size:11px;color:#9FBCC2}.rk-tray b{font-size:13px}.rk-tray .rk-dice img{inline-size:28px;block-size:28px}.rk-tray .rk-vs{color:#9FBCC2;font-size:11px}
.rk-res b{display:inline-flex;align-items:center;gap:4px}.rk-res b .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold)}
.rk-deck img{inline-size:14px;block-size:auto;border-radius:2px;margin-inline-end:4px;vertical-align:middle}
.rk-pc.is-ghost{opacity:.6}
.rk-val{display:grid;place-items:center;min-inline-size:44px;block-size:36px;background:#FAF5EC;color:#142B3B;font-weight:800;font-size:15px}
.rk-left{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-size:13px;color:var(--felt-muted)}.rk-left img{inline-size:22px;block-size:22px}.rk-left b{color:var(--felt-ink);font-size:16px}
.rk-ctl--g{display:flex;flex-wrap:wrap;row-gap:6px}.rk-ctl--g .rk-res{flex:1 1 100%}.rk-ctl--g .rk-btns{flex:1}
.rk-cards{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.rk-card img{display:block;inline-size:72px;block-size:auto;border-radius:5px;box-shadow:0 4px 10px -4px rgba(0,0,0,.45)}
.rk-card.is-sel img{box-shadow:0 0 0 3px var(--felt-gold),0 6px 12px -4px rgba(0,0,0,.5);transform:translateY(-6px)}
.cx-phone .rk-card img{inline-size:52px}
.rk-got{display:flex;gap:12px;align-items:center}.rk-got img{inline-size:92px;block-size:auto;border-radius:6px;box-shadow:0 0 0 3px var(--felt-gold)}
.gd-modal__box .bgv-btn{white-space:nowrap}`,
    shotTitle: 'نوبت شما', turnSub: 'حمله: تاس‌ها و انتخاب هدف',
    diffs: [
      ['نقشه به جای دست', 'وسط میز نقشهٔ ۴۲ قلمرو بدون رنگ صاحب و بی‌نوشته است و فقط هر قاره رنگ خودش را دارد. صاحب هر قلمرو را مهرهٔ ارتش همان بازیکن در مرکز قلمرو نشان می‌دهد و تعداد ارتش روی پلاک مهره نوشته می‌شود؛ پس هر فتح فقط مهره و عدد را عوض می‌کند'],
      ['مبدأ و هدف', 'قلمرو مبدأ و هدف حلقهٔ طلایی و برچسب دارند و یک پیکان نقطه‌چین بینشان است؛ هدف‌های مجاز دیگر از همین مبدأ خط‌چین‌اند'],
      ['تاس و دکمه‌ها', 'تاس‌های آمادهٔ مهاجم (قرمز) و مدافع (سفید) از آخرین نبرد با نتیجه، انتخاب ۱ تا ۳ تاس، «حمله»، «حملهٔ سریع» و «پایان حمله» بالای نوار شما'],
      ['کارت‌ها', 'دست کارت هنوز خالی است چون کارت فقط با فتح می‌آید؛ تعداد کارت هر نفر روی چیپ‌ها و دستهٔ کارت با پشت آماده در ستون کنار'],
      ['گوشی', 'نقشهٔ کامل در ۳۹۰ ریز می‌شود؛ گوشی بخش آفریقا را دور نبرد نشان می‌دهد و «کل نقشه» آن را باز می‌کند'],
      ['قوانین', 'بازی کلاسیک «فتح جهان» دفترچهٔ Hasbro، ۲ تا ۵ نفر (دونفره با ارتش بی‌طرف؛ موتور فعلاً ۳ تا ۶ است و کارش در RULES.md آمده)، ۳۵ ارتش شروع برای ۳ نفر، نیرو = قلمرو ÷ ۳ (حداقل ۳) + پاداش قاره، مساوی به نفع مدافع، یک جابه‌جایی در پایان نوبت'],
    ],
  };
}
