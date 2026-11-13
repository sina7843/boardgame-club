// Splendor («کهربا») on the group D frame. Repo engine: 2–4 players, base game, no options. BGA layout: nobles on top, three market rows
// (level 3 at the top) with the deck on the left, the gem bank beside the market, every player's cards stacked by colour.
// Mock: 3 players (5 tokens per colour, 4 nobles), turn order نیلوفر → رضا → شما, round 8. All card faces/costs are the real BGA cards
// (ready to use/data/engine-mapping.json), so every affordability claim below was checked by hand against bonuses + tokens.
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const A = (n) => H.ART[n];
  const C5 = ['w', 'u', 'g', 'r', 'k'];
  const CN = { w: 'سفید', u: 'آبی', g: 'سبز', r: 'قرمز', k: 'مشکی', gold: 'طلا' };
  // id: [level, points, colour, cost]
  const DB = {
    1: [1, 0, 'w', 'w3u1k1'], 3: [1, 0, 'w', 'u3'], 4: [1, 0, 'w', 'r2k1'], 7: [1, 1, 'w', 'g4'], 9: [1, 0, 'u', 'w1k2'], 11: [1, 0, 'u', 'w1g1r1k1'],
    14: [1, 1, 'u', 'r4'], 16: [1, 0, 'u', 'k3'], 19: [1, 0, 'g', 'r3'], 20: [1, 0, 'g', 'w1u3g1'], 22: [1, 0, 'g', 'w2u1'], 27: [1, 0, 'r', 'u2g1'],
    31: [1, 0, 'r', 'w1u1g1k1'], 33: [1, 1, 'k', 'u4'], 36: [1, 0, 'k', 'g3'], 38: [1, 0, 'k', 'w1u1g1r1'], 40: [1, 0, 'k', 'g2r1'],
    44: [2, 2, 'w', 'r5'], 49: [2, 2, 'u', 'w5u3'], 53: [2, 3, 'g', 'g6'], 56: [2, 2, 'g', 'w4u2k1'], 57: [2, 1, 'g', 'w3g2r3'], 61: [2, 2, 'r', 'w1u4g2'],
    63: [2, 2, 'r', 'k5'], 66: [2, 1, 'k', 'w3g3k2'], 74: [3, 5, 'w', 'w3k7'], 78: [3, 3, 'u', 'w3g3r3k5'], 82: [3, 5, 'g', 'u7g3'], 86: [3, 3, 'r', 'w3u5g3k3'], 89: [3, 5, 'k', 'r7k3'],
  };
  const alt = (id) => { const [l, p, c] = DB[id]; return `کارت سطح ${fa(l)}، ${CN[c]}${p ? `، ${fa(p)} امتیاز` : ''}`; };
  const pad = (id) => String(id).padStart(3, '0');
  // card: o = { buy: badge text | true, sel, dim }
  const card = (id, o = {}) => `<span class="sp-c${o.buy ? ' is-buy' : ''}${o.sel ? ' is-sel' : ''}${o.dim ? ' is-dim' : ''}"><img src="${A('splendor-card-' + pad(id))}" alt="${alt(id)}">${typeof o.buy === 'string' ? `<em>${o.buy}</em>` : ''}</span>`;
  const deck = (lv, n, sel) => `<span class="sp-c sp-deck${sel ? ' is-sel' : ''}" aria-label="دستهٔ سطح ${fa(lv)}، ${fa(n)} کارت"><img src="${A('splendor-back-' + lv)}" alt=""><b>${fa(n)}</b></span>`;
  const NOB = { 3: '۴ سفید و ۴ آبی', 6: '۳ سفید، ۳ آبی و ۳ مشکی', 7: '۳ سبز، ۳ قرمز و ۳ مشکی', 9: '۳ آبی، ۳ سبز و ۳ قرمز' };
  const noble = (id, cls = '') => id ? `<span class="sp-n${cls ? ' ' + cls : ''}"><img src="${A('splendor-noble-' + String(id).padStart(2, '0'))}" alt="اشراف‌زاده، ۳ امتیاز: ${NOB[id]} کارت"></span>` : '<span class="sp-n is-gone" aria-label="خالی"></span>';
  // market: { rows:{3:[],2:[],1:[]}, decks:{3,2,1}, nobles:[], o:{id:opts}, deckSel }
  const market = (m, ph) => `<div class="sp-mk${ph ? ' sp-mk--ph' : ''}"><div class="sp-nobles" aria-label="اشراف">${m.nobles.map((n) => noble(n, m.nSel === n ? 'is-sel' : m.nOk?.includes(n) ? 'is-new' : '')).join('')}</div>${[3, 2, 1].map((lv) => `<div class="sp-row" aria-label="بازار سطح ${fa(lv)}">${deck(lv, m.decks[lv], m.deckSel === lv)}${m.rows[lv].map((id) => (id ? card(id, m.o?.[id] ?? {}) : '<span class="sp-c is-empty"></span>')).join('')}</div>`).join('')}</div>`;
  const tok = (c, n, cls = '', label = true) => `<span class="sp-t${cls ? ' ' + cls : ''}"><img src="${A('splendor-token-' + c)}" alt="${label ? `${CN[c]}: ${fa(n)}` : ''}"><b>${fa(n)}</b></span>`;
  // bank: { w,u,g,r,k,gold }, sel:[colours], off:[colours]
  const bank = (b, ph, sel = [], off = []) => `<div class="sp-bank${ph ? ' sp-bank--ph' : ''}" aria-label="بانک ژتون">${ph ? '' : '<small>بانک</small>'}${[...C5, 'gold'].map((c) => `<button type="button" class="sp-bt${sel.includes(c) ? ' is-sel' : ''}${off.includes(c) || c === 'gold' ? ' is-off' : ''}" aria-label="${CN[c]}: ${fa(b[c])} در بانک">${tok(c, b[c], '', false)}</button>`).join('')}</div>`;
  // opponent mini panel (desktop)
  const opp = (p) => `<figure class="sp-opp"><figcaption><i style="background:var(--seat-${p.seat})"></i>${p.name}<b>${fa(p.score)}</b></figcaption><div class="sp-og"><span></span>${[...C5, 'gold'].map((c) => `<img src="${A('splendor-token-' + c)}" alt="${CN[c]}">`).join('')}<small>کارت</small>${C5.map((c) => `<b>${fa(p.cards[c])}</b>`).join('')}<b>–</b><small>ژتون</small>${[...C5, 'gold'].map((c) => `<span>${fa(p.tok[c])}</span>`).join('')}</div><div class="sp-om"><span>رزرو</span>${p.res.length ? p.res.map((lv) => `<img src="${A('splendor-back-' + lv)}" alt="سطح ${fa(lv)}">`).join('') : `<span>${fa(0)}</span>`}<span class="sp-om__n">اشراف</span>${p.nobles.length ? p.nobles.map((n) => `<img class="sp-om__nob" src="${A('splendor-noble-' + String(n).padStart(2, '0'))}" alt="اشراف‌زاده">`).join('') : `<span>${fa(0)}</span>`}</div></figure>`;
  // my tableau: { cards:{w:[]..}, tok:{..gold}, res:[ids], nobles:[], tsel:[colours], nNew }
  const tableau = (st, ph) => {
    const cols = C5.map((c) => {
      const ids = st.cards[c];
      const stack = ids.length ? ids.map((id, k) => `<span class="sp-sc" style="--k:${k}">${card(id)}</span>`).join('') : '<span class="sp-sc sp-sc--empty"></span>';
      return `<div class="sp-col" aria-label="${CN[c]}: ${fa(ids.length)} کارت، ${fa(st.tok[c])} ژتون">${tok(c, st.tok[c], st.tsel?.includes(c) ? 'is-sel' : st.tok[c] ? '' : 'is-zero')}<div class="sp-stack" style="--n:${Math.max(ids.length, 1)}">${stack}</div></div>`;
    }).join('');
    const gold = `<div class="sp-col sp-col--gold">${tok('gold', st.tok.gold, st.tok.gold ? '' : 'is-zero')}</div>`;
    const res = `<div class="sp-res"><small>رزرو ${fa(st.res.length)} از ${fa(3)}</small><div>${st.res.map((id) => card(id, st.ro?.[id] ?? {})).join('')}</div></div>`;
    const nob = st.nobles?.length ? `<div class="sp-mynob">${st.nobles.map((n) => `${noble(n, st.nNew === n ? 'is-new' : '')}`).join('')}${st.nNew ? `<span class="gc-tag">+${fa(3)}</span>` : ''}</div>` : '';
    return `<div class="sp-tab${ph ? ' sp-tab--ph' : ''}">${cols}${gold}${res}${nob}</div>`;
  };
  const above = (st, acts) => (ph) => `<div class="sp-me${ph ? ' sp-me--ph' : ''}">${acts ? `<div class="sp-acts">${acts(ph)}</div>` : ''}${tableau(st, ph)}</div>`;

  // ---------- state ----------
  const MK = { rows: { 3: [74, 82, 86, 78], 2: [44, 61, 66, 53], 1: [19, 27, 36, 11] }, decks: { 3: 16, 2: 22, 1: 23 }, nobles: [3, 6, 7, 9] };
  // affordable with bonuses w3 u3 g1 r1 k2 + tokens w1 u1 g1 r2 k2 gold1 (8): 19 (2 red), 27 free, 36 (g1+gold), 11 free, 61 (u1 g1), 66 (g1+gold), reserved 56 (w1)
  const BUY = { 19: `${fa(2)} ژتون`, 27: 'رایگان', 36: `${fa(2)} ژتون`, 11: 'رایگان', 61: `${fa(2)} ژتون`, 66: `${fa(2)} ژتون` };
  const buyO = Object.fromEntries(Object.entries(BUY).map(([k, v]) => [k, { buy: v }]));
  const MECARDS = { w: [7, 4, 1], u: [14, 9, 49], g: [22], r: [31], k: [38, 40] };
  const ME = { cards: MECARDS, tok: { w: 1, u: 1, g: 1, r: 2, k: 2, gold: 1 }, res: [56] };
  const BANK = { w: 3, u: 3, g: 3, r: 1, k: 1, gold: 3 };
  const NIL = { name: 'نیلوفر', seat: 2, score: 6, cards: { w: 1, u: 2, g: 2, r: 3, k: 1 }, tok: { w: 1, u: 0, g: 0, r: 2, k: 1, gold: 0 }, res: [3, 2], nobles: [] };
  const REZ = { name: 'رضا', seat: 6, score: 3, cards: { w: 2, u: 1, g: 3, r: 0, k: 2 }, tok: { w: 0, u: 1, g: 1, r: 0, k: 1, gold: 1 }, res: [1], nobles: [] };
  const tot = (t) => Object.values(t).reduce((a, b) => a + b, 0);
  const seatMeta = (p, first) => `<span class="gc-tag gc-tag--soft">${fa(p.score)} امتیاز</span><span>ژتون ${fa(tot(p.tok))}</span><span>رزرو ${fa(p.res.length)}</span>${first ? `<img class="sp-fp" src="${A('splendor-first')}" alt="نفر اول">` : ''}`;
  const opps = (turn, n = NIL, r = REZ) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '2:10', turn: turn === 2, meta: seatMeta(n, true) },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:45', turn: turn === 6, meta: seatMeta(r) },
  ];
  const table = (o) => (ph) => `${o.banner ? `<div class="sp-banner">${ic('flag')}<span>${o.banner}</span></div>` : ''}${market(o.mk ?? { ...MK, o: buyO }, ph)}${bank(o.bank ?? BANK, ph, o.bsel, o.boff ?? C5.filter((c) => (o.bank ?? BANK)[c] === 0))}${ph ? '' : `<div class="sp-opps">${opp(o.nil ?? NIL)}${opp(o.rez ?? REZ)}</div>`}`;
  const note = (s) => `<span class="cx-note">${fa(s)} از ${fa(15)} امتیاز</span>`;
  const rail = `<section class="cx-card"><h3>دور ${fa(8)}</h3><div class="gc-pills"><span class="bgv-chip">هدف: ${fa(15)} امتیاز</span><span class="bgv-chip"><img src="${A('splendor-first')}" alt="">نفر اول: نیلوفر</span></div><div class="ga-rule">${ic('info')}<span>در هر نوبت فقط یک کار: ${fa(3)} گوهر از سه رنگ، ${fa(2)} گوهر هم‌رنگ (اگر دست‌کم ${fa(4)} تا در بانک باشد)، رزرو یک کارت با یک طلا، یا خرید. بیشتر از ${fa(10)} ژتون نمی‌شود نگه داشت.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const tokRow = (list) => `<span class="sp-pay">${list.map(([c, n]) => tok(c, n)).join('')}</span>`;

  // reserve modal (reserve the white level 3 card #74)
  const reserveM = (ph) => modal('رزرو این کارت؟', `<div class="sp-mrow">${card(74, { sel: true })}<div><p>کارت سطح ${fa(3)} سفید با ${fa(5)} امتیاز به رزروهای شما می‌رود و یک طلا هم می‌گیرید. هیچ‌کس دیگر نمی‌تواند آن را بخرد.</p><p class="sp-mline">${tok('gold', 1)}<span>طلا در بانک: ${fa(3)}</span></p><p class="cx-note">بعد از رزرو: ${fa(2)} از ${fa(3)} رزرو و ${fa(9)} ژتون</p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('رزرو', 'primary', 'check')}`);
  // buy modal (#66: cost w3 g3 k2; bonuses w3 g1 k2 → 1 green token + 1 gold)
  const buyM = (ph) => modal('خرید این کارت؟', `<div class="sp-mrow">${card(66, { sel: true })}<div><p>کارت سطح ${fa(2)} مشکی، ${fa(1)} امتیاز. تخفیف کارت‌هایتان بیشتر هزینه را پوشش می‌دهد.</p>${tbl(['رنگ', 'هزینه', 'تخفیف', 'ژتون', 'طلا'], [{ c: ['سفید', fa(3), fa(3), fa(0), fa(0)] }, { c: ['سبز', fa(3), fa(1), fa(1), fa(1)] }, { c: ['مشکی', fa(2), fa(2), fa(0), fa(0)] }, { c: ['پرداخت', '', '', fa(1), fa(1)], win: true }])}<p class="sp-mline">${tokRow([['g', 1], ['gold', 1]])}<span>به بانک برمی‌گردد</span></p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('خرید', 'primary', 'check')}`);
  // noble picker (another game, round 11): bonuses w3 u3 g3 r3 k2, buys black #36 (cost g3, free) → k3; noble 9 already went to Niloufar,
  // so 6 (3w 3u 3k) and 7 (3g 3r 3k) qualify together. Cards 7+14+49+57+63 = 7 points, +3 noble = 10.
  const nobleM = (ph) => modal('کدام اشراف‌زاده به دیدارتان بیاید؟', `<p>با کارت مشکی تازه نیاز دو اشراف‌زاده را با هم دارید. هر نوبت فقط یکی می‌آید؛ یکی را انتخاب کنید.</p><div class="sp-npick">${[6, 7].map((n) => `<button type="button" class="sp-np${n === 6 ? ' is-sel' : ''}" aria-pressed="${n === 6}">${noble(n)}<span><b>${fa(3)} امتیاز</b><span>${NOB[n]} کارت</span><small>همه را دارید</small></span></button>`).join('')}</div><p class="cx-note">آن یکی سر جایش می‌ماند. اگر آخر نوبت بعدتان هنوز آنجا بود و کس دیگری نبرده بود، خودکار به دیدارتان می‌آید.</p>`, btn(ph ? 'انتخاب' : 'انتخاب این اشراف‌زاده', 'primary', 'check'));
  const V_ME = { cards: { w: [7, 4, 1], u: [14, 9, 49], g: [22, 20, 57], r: [31, 27, 63], k: [38, 40, 36] }, tok: { w: 1, u: 0, g: 1, r: 1, k: 2, gold: 0 }, res: [] };
  const V_NIL = { ...NIL, score: 8, cards: { w: 1, u: 3, g: 3, r: 3, k: 1 }, tok: { w: 1, u: 0, g: 1, r: 0, k: 1, gold: 0 }, res: [], nobles: [9] };
  const V_MK = { rows: { 3: [74, 82, 86, 78], 2: [44, 61, 66, 53], 1: [19, 16, 33, 11] }, decks: { 3: 14, 2: 18, 1: 17 }, nobles: [3, 6, 7, 0], nOk: [6, 7] };
  const V_BANK = { w: 3, u: 4, g: 2, r: 4, k: 1, gold: 4 };
  const endM = (ph) => modal('پایان بازی', `<p>نیلوفر به ${fa(15)} امتیاز رسید و دور تا نوبت شما ادامه پیدا کرد. شما با خرید رایگان کارت سبز رزروشده به ${fa(16)} رسیدید.</p>${tbl(['بازیکن', 'کارت‌ها', 'اشراف', 'جمع', 'تعداد کارت'], [{ c: [`${ic('trophy')} شما`, fa(10), `${fa(2)} (${fa(6)}+)`, fa(16), fa(17)], win: true }, { c: ['نیلوفر', fa(9), `${fa(2)} (${fa(6)}+)`, fa(15), fa(16)] }, { c: ['رضا', fa(11), fa(0), fa(11), fa(13)] }])}<p class="cx-note">تساوی: کسی که کارت کمتری خریده برنده است؛ اگر باز مساوی بود، برد مشترک است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  // late game (last round): order نیلوفر → رضا → شما. You: bonuses w4 u4 g2 r2 k4, nobles 6 + 3 → 8 + 6 = 14. Final buy #44 (r5 − r2 = 3 red tokens).
  const LATE_ME = { cards: { w: [7, 4, 1, 3], u: [14, 9, 49, 16], g: [22, 20], r: [31, 61], k: [38, 40, 66, 33] }, tok: { w: 0, u: 1, g: 0, r: 3, k: 1, gold: 1 }, res: [56, 74], nobles: [6, 3] };
  const LATE_MK = { rows: { 3: [89, 82, 86, 78], 2: [44, 63, 53, 57], 1: [19, 36, 11, 27] }, decks: { 3: 9, 2: 8, 1: 6 }, nobles: [0, 0, 0, 0], o: { 44: { buy: `${fa(3)} ژتون` } } };
  const LATE_NIL = { ...NIL, score: 15, cards: { w: 2, u: 3, g: 4, r: 4, k: 3 }, tok: { w: 1, u: 1, g: 0, r: 1, k: 1, gold: 0 }, res: [3], nobles: [7, 9] };
  const LATE_REZ = { ...REZ, score: 11, cards: { w: 3, u: 2, g: 3, r: 2, k: 3 }, tok: { w: 2, u: 1, g: 1, r: 0, k: 1, gold: 1 }, res: [3, 2] };
  const END_REZ = { ...LATE_REZ, tok: { ...LATE_REZ.tok, g: 3 } };
  const LATE_BANK = { w: 2, u: 2, g: 4, r: 1, k: 2, gold: 3 };

  const takeActs = (ph) => `<span class="sp-pick">${tokRow([['w', 1], ['u', 1], ['g', 1]])}<small>${fa(3)} از ${fa(3)}</small></span>${ph ? '' : `<span class="sp-warn">${ic('info')}بعدش ${fa(1)} ژتون پس می‌دهید</span>`}${btn('برداشتن', 'primary', 'check')}${btn(ph ? 'پاک' : 'پاک کردن', 'secondary', 'x')}`;
  const retActs = (ph) => `<span class="sp-pick"><small>${ph ? 'پس دادن' : 'ژتونی را برای پس دادن بزنید'}: ${fa(1)} از ${fa(1)}</small></span>${btn('پس بده', 'primary', 'check')}`;

  return {
    slug: 'Splendor', fa: 'کهربا', latin: 'Splendor', meta: ['زنده', '۳ نفر', 'دور ۸'],
    opps: opps(1),
    me: { cards: [], clock: '1:32', turn: true, note: note(4), above: above({ ...ME, ro: { 56: { buy: `${fa(1)} ژتون` } } }, null) },
    table: table({}),
    status: `<b>نوبت شماست.</b> یک کار انجام دهید: ${fa(3)} گوهر مختلف، ${fa(2)} گوهر هم‌رنگ، رزرو یا خرید. کارت‌هایی که حلقهٔ سبز دارند را همین حالا می‌توانید بخرید؛ عدد رویشان ژتونی است که بعد از تخفیف می‌دهید.`,
    pstatus: `<b>نوبت شما.</b> گوهر بردارید، رزرو کنید یا یکی از کارت‌های سبز را بخرید.`,
    railCard: rail,
    logNote: `دور ${fa(8)}`,
    log: [[2, 'نیلوفر ۲ قرمز برداشت'], [6, 'رضا یک کارت سطح ۱ را از دسته رزرو کرد و طلا گرفت'], [1, 'نوبت شما']],
    dockItems: [['list', 'رویدادها'], ['users', 'بازیکنان'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'چیدمان سه‌نفره و نوبت نفر اول',
        opps: opps(2, { ...NIL, score: 0, tok: { w: 0, u: 0, g: 0, r: 0, k: 0, gold: 0 }, res: [] }, { ...REZ, score: 0, tok: { w: 0, u: 0, g: 0, r: 0, k: 0, gold: 0 }, res: [] }),
        me: { turn: false, clock: '3:00', note: note(0), above: above({ cards: { w: [], u: [], g: [], r: [], k: [] }, tok: { w: 0, u: 0, g: 0, r: 0, k: 0, gold: 0 }, res: [] }, null) },
        table: table({ mk: { ...MK, decks: { 3: 16, 2: 26, 1: 36 } }, bank: { w: 5, u: 5, g: 5, r: 5, k: 5, gold: 5 }, boff: [], nil: { ...NIL, score: 0, cards: { w: 0, u: 0, g: 0, r: 0, k: 0 }, tok: { w: 0, u: 0, g: 0, r: 0, k: 0, gold: 0 }, res: [] }, rez: { ...REZ, score: 0, cards: { w: 0, u: 0, g: 0, r: 0, k: 0 }, tok: { w: 0, u: 0, g: 0, r: 0, k: 0, gold: 0 }, res: [] } }),
        status: `<b>بازی شروع شد.</b> از هر سطح ${fa(4)} کارت رو شد و ${fa(4)} اشراف‌زاده آمدند (یکی بیشتر از تعداد بازیکنان). با سه نفر از هر رنگ ${fa(5)} ژتون در بانک است. نیلوفر نفر اول است؛ بعد رضا و بعد شما.`,
        log: [[1, 'بازی با ۳ نفر شروع شد'], [2, 'نیلوفر نفر اول است']],
        logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'برداشتن گوهر', turnSub: 'سه رنگ انتخاب شده، هشدار بیش از ۱۰ ژتون',
        table: table({ mk: MK, bsel: ['w', 'u', 'g'] }),
        me: { above: above(ME, takeActs) },
        status: `<b>${fa(3)} از ${fa(3)} انتخاب شد:</b> سفید، آبی و سبز. شما ${fa(8)} ژتون دارید و با این سه تا ${fa(11)} می‌شود، پس بعد از برداشتن باید ${fa(1)} ژتون پس بدهید. برداشتن دو ژتون هم‌رنگ الان ممکن نیست، چون هیچ رنگی ${fa(4)} تا در بانک ندارد.`,
        pstatus: `<b>${fa(3)} از ${fa(3)}:</b> سفید، آبی، سبز. بعدش باید ${fa(1)} ژتون پس بدهید.`,
        log: [[2, 'نیلوفر ۲ قرمز برداشت'], [6, 'رضا یک کارت سطح ۱ را از دسته رزرو کرد و طلا گرفت'], [1, 'شما سفید، آبی و سبز را انتخاب کردید']],
        phone: true,
      },
      {
        shotTitle: 'پس دادن ژتون', turnSub: 'بیشتر از ۱۰ ژتون',
        table: table({ mk: MK, bank: { w: 2, u: 2, g: 2, r: 1, k: 1, gold: 3 } }),
        me: { note: note(4), above: above({ ...ME, tok: { w: 2, u: 2, g: 2, r: 2, k: 2, gold: 1 }, tsel: ['r'] }, retActs) },
        status: `<b>${fa(1)} ژتون پس بدهید.</b> حالا ${fa(11)} ژتون دارید و آخر نوبت بیشتر از ${fa(10)} نمی‌شود. روی ژتون خودتان بزنید؛ قرمز انتخاب شده است. ژتون‌های تازه را هم می‌شود پس داد.`,
        pstatus: `<b>${fa(1)} ژتون پس بدهید.</b> قرمز انتخاب شده است.`,
        log: [[6, 'رضا یک کارت سطح ۱ را از دسته رزرو کرد و طلا گرفت'], [1, 'شما سفید، آبی و سبز برداشتید'], [1, 'باید ۱ ژتون پس بدهید']],
      },
      {
        shotTitle: 'رزرو', turnSub: 'کارت رو از بازار با یک طلا',
        table: table({ mk: { ...MK, o: { 74: { sel: true } } } }),
        overlay: reserveM,
        status: `<b>رزرو:</b> کارت سفید ${fa(5)} امتیازی سطح ${fa(3)} را زدید. با رزرو، کارت به دست شما می‌آید و یک طلا هم می‌گیرید. حداکثر ${fa(3)} کارت رزرو می‌شود؛ پشت هر دسته را هم می‌شود رزرو کرد.`,
        log: [[2, 'نیلوفر ۲ قرمز برداشت'], [6, 'رضا یک کارت سطح ۱ را از دسته رزرو کرد و طلا گرفت'], [1, 'شما کارت سطح ۳ سفید را برای رزرو زدید']],
      },
      {
        shotTitle: 'خرید', turnSub: 'پیش‌نمایش پرداخت با تخفیف و طلا',
        table: table({ mk: { ...MK, o: { ...buyO, 66: { sel: true } } } }),
        overlay: buyM,
        status: `<b>خرید:</b> کارت مشکی سطح ${fa(2)}. سه کارت سفید و دو کارت مشکی شما سفید و مشکی‌اش را می‌پوشانند؛ از سه سبز، یکی را کارت سبزتان می‌دهد، یکی را ژتون سبز و یکی را طلا.`,
        log: [[2, 'نیلوفر ۲ قرمز برداشت'], [6, 'رضا یک کارت سطح ۱ را از دسته رزرو کرد و طلا گرفت'], [1, 'شما کارت سطح ۲ مشکی را برای خرید زدید']],
        phone: true,
      },
      {
        shotTitle: 'دیدار اشراف', turnSub: 'آخر نوبت، خودکار',
        opps: opps(2),
        me: { turn: false, note: note(8), above: above({ cards: { ...MECARDS, k: [38, 40, 66] }, tok: { w: 1, u: 1, g: 0, r: 2, k: 2, gold: 0 }, res: [56], nobles: [6], nNew: 6 }, null) },
        table: table({ mk: { ...MK, rows: { ...MK.rows, 2: [44, 61, 63, 53] }, decks: { 3: 16, 2: 21, 1: 23 }, nobles: [3, 0, 7, 9] }, bank: { w: 3, u: 3, g: 4, r: 1, k: 1, gold: 4 } }),
        status: `<b>اشراف‌زاده به دیدار شما آمد.</b> با کارت مشکی تازه، سه سفید، سه آبی و سه مشکی دارید؛ همان چیزی که او می‌خواست. ${fa(3)} امتیاز گرفتید و حالا ${fa(8)} امتیاز دارید. جای خالی بازار با کارت تازهٔ سطح ${fa(2)} پر شد و نوبت به نیلوفر رسید.`,
        pstatus: `<b>اشراف‌زاده آمد:</b> ${fa(3)}+ امتیاز، حالا ${fa(8)} دارید.`,
        log: [[1, 'شما کارت سطح ۲ مشکی را با ۱ سبز و ۱ طلا خریدید'], [1, 'اشراف‌زاده به دیدار شما آمد: ۳+'], [2, 'نوبت نیلوفر']],
        phone: true,
      },
      {
        shotTitle: 'انتخاب اشراف', turnSub: 'بازی دیگر: دو اشراف با هم واجد شرایط‌اند', meta: ['زنده', '۳ نفر', 'دور ۱۱'],
        opps: opps(0, V_NIL),
        me: { note: note(7), above: above(V_ME, null) },
        table: table({ mk: V_MK, bank: V_BANK, nil: V_NIL }),
        overlay: nobleM, logNote: `دور ${fa(11)}`, railCard: rail.replace(`دور ${fa(8)}`, `دور ${fa(11)}`),
        status: `<b>دو اشراف‌زاده با هم آمدند.</b> کارت مشکی سطح ${fa(1)} را با تخفیف سبزها رایگان خریدید و حالا از هر رنگ ${fa(3)} کارت دارید. اشراف‌زادهٔ «سه آبی، سه سبز، سه قرمز» را نیلوفر قبلاً برده؛ دو تای دیگر واجد شرایط‌اند و یکی را انتخاب می‌کنید. ${fa(3)} امتیاز می‌گیرید و از ${fa(7)} به ${fa(10)} می‌رسید.`,
        pstatus: `<b>یکی از دو اشراف را انتخاب کنید.</b>`,
        log: [[2, 'نیلوفر ۲ قرمز برداشت'], [6, 'رضا ۳ گوهر برداشت'], [1, 'شما کارت سطح ۱ مشکی را رایگان خریدید'], [1, 'دو اشراف‌زاده واجد شرایط‌اند']],
      },
      {
        shotTitle: 'نوبت حریف و دور آخر', turnSub: 'منتظر رضا؛ نیلوفر به ۱۵ رسید',
        opps: opps(6, LATE_NIL, LATE_REZ),
        me: { turn: false, clock: '0:40', note: note(14), above: above({ ...LATE_ME, ro: { 56: { buy: 'رایگان' } } }, null) },
        table: table({ mk: LATE_MK, bank: LATE_BANK, nil: LATE_NIL, rez: LATE_REZ, banner: `دور آخر: نیلوفر به ${fa(15)} رسید. بازی بعد از نوبت شما تمام می‌شود.` }),
        status: `<b>نوبت رضاست.</b> نیلوفر با ${fa(15)} امتیاز دور آخر را شروع کرد، پس رضا و بعد شما یک نوبت دیگر دارید. رضا هر کاری بکند، کارت سبز رزروشده‌تان را رایگان می‌خرید و به ${fa(16)} می‌رسید.`,
        pstatus: `<b>دور آخر.</b> نوبت رضا؛ بعد از شما بازی تمام می‌شود.`,
        log: [[2, 'نیلوفر کارت سطح ۳ قرمز را خرید'], [2, 'اشراف‌زاده به دیدار نیلوفر آمد: ۱۵ امتیاز'], [6, 'دور آخر شروع شد؛ نوبت رضا']],
        logNote: `دور ${fa(14)}`,
        meta: ['زنده', '۳ نفر', 'دور آخر'],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیاز پایانی و برنده',
        opps: opps(0, LATE_NIL, END_REZ),
        me: { turn: false, clock: '', note: note(16), above: above({ ...LATE_ME, cards: { ...LATE_ME.cards, g: [22, 20, 56] }, res: [74] }, null) },
        table: table({ mk: { ...LATE_MK, o: {} }, bank: { ...LATE_BANK, g: 2 }, nil: LATE_NIL, rez: END_REZ }),
        overlay: endM,
        status: `<b>بازی تمام شد.</b> شما با ${fa(16)} امتیاز بردید.`,
        log: [[6, 'رضا ۲ سبز برداشت'], [1, 'شما کارت رزروشدهٔ سبز را خریدید: ۱۶ امتیاز'], [1, 'شما بردید']],
        logNote: `دور ${fa(14)}`,
        meta: ['تمام‌شده', '۳ نفر'],
      },
    ],
    css: `.gc-table{gap:14px;align-items:center}
.sp-mk{display:grid;gap:8px;direction:ltr;--cw:76px}
.sp-nobles{display:flex;gap:8px;justify-content:center;padding-inline-start:calc(var(--cw) + 8px)}
.sp-n{inline-size:62px;block-size:62px;flex:none;position:relative}
.sp-n img{display:block;inline-size:100%;block-size:100%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.sp-n.is-gone{border-radius:8px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.22)}
.sp-n.is-new{border-radius:8px;box-shadow:0 0 0 3px var(--felt-gold),0 0 0 6px rgba(232,166,66,.3)}
.sp-row{display:flex;gap:8px}
.sp-c{position:relative;flex:none;inline-size:var(--cw);aspect-ratio:136/176;display:block}
.sp-c img{display:block;inline-size:100%;block-size:100%;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 12px -8px rgba(0,0,0,.6)}
.sp-c.is-empty{border-radius:6px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.2)}
.sp-c.is-buy img{box-shadow:0 0 0 3px #5FBF7A,0 8px 12px -8px rgba(0,0,0,.6)}
.sp-c.is-sel{transform:translateY(-6px)}
.sp-c.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 12px 16px -8px rgba(0,0,0,.7)}
.sp-c.is-dim img{filter:saturate(.6) brightness(.8)}
.sp-c em{position:absolute;bottom:-7px;right:-5px;font-style:normal;font-size:11px;font-weight:800;line-height:1;padding:4px 6px;border-radius:999px;background:#5FBF7A;color:#0E2A1A;white-space:nowrap;direction:rtl;box-shadow:0 2px 4px rgba(0,0,0,.35)}
.sp-deck b{position:absolute;inset-block-end:6px;inset-inline:0;margin-inline:auto;inline-size:max-content;padding:2px 8px;border-radius:999px;background:rgba(10,20,28,.78);color:#FAF5EC;font-size:12.5px}
.sp-t{position:relative;display:inline-block;inline-size:var(--tw,44px);block-size:var(--tw,44px);flex:none}
.sp-t img{display:block;inline-size:100%;block-size:100%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.sp-t b{position:absolute;inset-block-start:-5px;inset-inline-end:-6px;min-inline-size:20px;block-size:20px;padding-inline:4px;box-sizing:border-box;border-radius:999px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:12px;box-shadow:0 0 0 1.5px rgba(250,245,236,.5)}
.sp-t.is-zero img{opacity:.35;filter:grayscale(.6)}
.sp-t.is-sel{border-radius:50%;box-shadow:0 0 0 3px var(--felt-gold),0 0 0 6px rgba(232,166,66,.3)}
.sp-bank{display:grid;gap:10px;justify-items:center;padding:10px 8px;border-radius:14px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)}
.sp-bank small{color:var(--felt-muted);font-size:12.5px}
.sp-bt{all:unset;cursor:pointer;display:block;border-radius:50%}
.sp-bt.is-sel{box-shadow:0 0 0 3px var(--felt-gold),0 0 0 6px rgba(232,166,66,.3)}
.sp-bt.is-off{cursor:default}
.sp-opps{display:grid;gap:12px}
.sp-opp{margin:0;display:grid;gap:6px;inline-size:182px;padding:8px 10px;border-radius:12px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink)}
.sp-opp figcaption{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700}
.sp-opp figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.sp-opp figcaption b{margin-inline-start:auto;color:var(--felt-gold);font-size:15px}
.sp-og{display:grid;grid-template-columns:30px repeat(6,1fr);align-items:center;justify-items:center;row-gap:3px;font-size:12.5px}
.sp-og img{inline-size:20px;block-size:20px}
.sp-og small{justify-self:start;color:var(--felt-muted);font-size:11.5px}
.sp-og b{font-size:14px;color:var(--felt-ink)}
.sp-og span{color:var(--felt-muted)}
.sp-om{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--felt-muted)}
.sp-om img{inline-size:17px;border-radius:2px}
.sp-om img.sp-om__nob{inline-size:20px}
.sp-om__n{margin-inline-start:auto}
.sp-fp{inline-size:18px;block-size:18px}
.bgv-chip img{inline-size:18px;block-size:18px;margin-inline-end:4px}
.sp-banner{position:absolute;inset-block-start:0;inset-inline:0;margin-inline:auto;inline-size:max-content;max-inline-size:100%;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700;z-index:2}
.sp-warn{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--felt-gold)}
.sp-warn .bgv-icon{inline-size:16px;block-size:16px}
.sp-me{display:grid;justify-items:center;gap:8px;inline-size:100%}
.sp-acts{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
.sp-pick{display:inline-flex;align-items:center;gap:10px;padding:4px 12px 4px 8px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-size:13px}
.sp-pay{display:inline-flex;gap:8px;direction:ltr;--tw:30px}
.sp-pay .sp-t b{min-inline-size:17px;block-size:17px;font-size:11px}
.sp-tab{display:flex;align-items:flex-start;gap:12px;direction:ltr;--cw:58px;--tw:36px}
.sp-col{display:grid;justify-items:center;gap:6px;inline-size:var(--cw)}
.sp-col--gold{inline-size:auto}
.sp-stack{position:relative;inline-size:var(--cw);block-size:calc(var(--cw) * 1.294 + (var(--n) - 1) * var(--off,17px))}
.sp-sc{position:absolute;inset-inline-start:0;inset-block-start:calc(var(--k) * var(--off,17px))}
.sp-sc--empty{inset-block-start:0;inline-size:var(--cw);aspect-ratio:136/176;border-radius:6px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.2)}
.sp-res{display:grid;gap:4px;justify-items:start;padding-inline-start:6px;border-inline-start:1px solid rgba(250,245,236,.16)}
.sp-res small{color:var(--felt-muted);font-size:12px;direction:rtl}
.sp-res>div{display:flex;gap:6px;min-block-size:calc(var(--cw) * 1.294)}
.sp-mynob{display:flex;align-items:center;gap:6px;align-self:center;--nw:48px}
.sp-mynob .sp-n{inline-size:var(--nw);block-size:var(--nw)}
.sp-npick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-np{all:unset;cursor:pointer;display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--border)}
.sp-np.is-sel{box-shadow:inset 0 0 0 2.5px #E8A642;background:var(--surface-sunken)}
.sp-np .sp-n{inline-size:72px;block-size:72px}
.sp-np>span{display:grid;gap:6px;font-size:13.5px}.sp-np b{color:var(--heading)}.sp-np small{color:var(--text-muted);font-size:12px}
.cx-phone .sp-npick{grid-template-columns:1fr;gap:8px}.cx-phone .sp-np{padding:8px 10px}.cx-phone .sp-np .sp-n{inline-size:56px;block-size:56px}
.sp-mrow{display:flex;gap:16px;align-items:flex-start;--cw:96px}
.sp-mrow>div{display:grid;gap:10px;flex:1;min-inline-size:0}
.sp-mrow .gd-score{inline-size:100%;border-collapse:collapse;font-size:13.5px}
.sp-mline{display:flex;align-items:center;gap:10px;--tw:30px}
.sp-mline .sp-t b{min-inline-size:17px;block-size:17px;font-size:11px}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.cx-phone .gc-table{gap:6px;flex-direction:column}
.sp-mk--ph{--cw:58px;gap:6px}
.sp-mk--ph .sp-row{gap:6px}
.sp-mk--ph .sp-nobles{gap:6px;padding-inline-start:calc(var(--cw) + 6px)}
.sp-mk--ph .sp-n{inline-size:46px;block-size:46px}
.sp-mk--ph .sp-c em{font-size:10px;padding:3px 5px;bottom:-5px;right:-3px}
.sp-mk--ph .sp-deck b{font-size:11px;padding:1px 6px}
.sp-bank--ph{display:flex;gap:12px;padding:6px 12px;--tw:34px;direction:ltr}
.sp-bank--ph .sp-t b{min-inline-size:18px;block-size:18px;font-size:11px}
.cx-phone .sp-banner{position:static;font-size:12.5px;padding:5px 12px}
.sp-me--ph{gap:6px}
.sp-me--ph .sp-acts{gap:6px;flex-wrap:nowrap;padding-inline:10px}
.sp-me--ph .sp-pick{padding:2px 8px 2px 6px;gap:6px}
.sp-me--ph .sp-pay{--tw:24px;gap:6px}
.sp-tab--ph{--cw:40px;--tw:26px;--off:12px;gap:6px}
.sp-tab--ph .sp-t b{min-inline-size:16px;block-size:16px;font-size:10.5px;inset-block-start:-4px;inset-inline-end:-5px}
.sp-tab--ph .sp-res{padding-inline-start:4px}
.sp-tab--ph .sp-res small{font-size:10.5px}
.sp-tab--ph .sp-res>div{gap:4px}
.sp-tab--ph .sp-c em{font-size:9.5px;padding:2px 4px}
.sp-tab--ph .sp-mynob{--nw:34px;flex-direction:column;gap:2px}
.sp-tab--ph .sp-mynob .gc-tag{block-size:18px;padding-inline:5px;font-size:11px}
.cx-phone .sp-mrow{--cw:72px;gap:10px}
.cx-phone .sp-mrow .gd-score th,.cx-phone .sp-mrow .gd-score td{padding:5px 4px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب کار؛ کارت‌های قابل خرید سبزند',
    diffs: [
      ['چیدمان', 'مثل BGA: اشراف بالای بازار، سه ردیف کارت (سطح ۳ بالا) با پشت دسته و شمار مانده در چپ، بانک ژتون کنار بازار و خلاصهٔ هر حریف (کارت و ژتون هر رنگ، رزرو، اشراف) کنارش. روی گوشی خلاصهٔ حریف در کارت صندلی است'],
      ['کارت‌های شما', 'کارت‌های خریده مثل BGA در پنج ستون رنگی روی هم چیده می‌شوند و نوار بالایشان (امتیاز و رنگ) پیداست؛ ژتون هر رنگ بالای همان ستون، طلا جدا و سه خانهٔ رزرو کنارش'],
      ['کمک خرید', 'کارت‌هایی که با تخفیف و ژتون فعلی خریدنی‌اند حلقهٔ سبز دارند و عدد رویشان ژتونی است که می‌دهید. خرید و رزرو قبل از انجام، پنجرهٔ تأیید با جزئیات پرداخت دارند (§۷، §۸)'],
      ['ژتون‌ها', 'انتخاب از بانک با حلقهٔ طلایی و شمارندهٔ «۳ از ۳»؛ اگر جمع از ۱۰ بگذرد قبل از برداشتن هشدار می‌دهد و بعدش مرحلهٔ پس دادن می‌آید (§۵، §۶)'],
      ['اشراف و پایان', 'اشراف‌زاده آخر نوبت خودکار می‌آید (§۹)؛ اگر چند تا با هم واجد شرایط باشند، پنجرهٔ انتخاب با نیاز هر کدام باز می‌شود (§۱۰، مثل BGA). وقتی کسی به ۱۵ برسد نوار «دور آخر» بالای میز می‌آید (§۱۱) و جدول پایانی تعداد کارت را برای تساوی نشان می‌دهد (§۱۲)'],
      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر، بازی پایه؛ ژتون هر رنگ با ۲، ۳ و ۴ نفر ۴، ۵ و ۷ تا. همهٔ کارت‌ها و اشراف تصویر واقعی BGA هستند'],
    ],
  };
}
