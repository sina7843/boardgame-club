// Res Arcana (جادوی کهن) on the group D frame. Real BGA base-game art: mages, magic items, artifacts, places of power, monuments, essences.
// Mock: 3 players, round 3. You (Mina) are the Druid with Research; Niloufar is the Necromancer, Reza the Healer. Reza has already passed (first-player token).
// Your essences after collect: elan 3, life 2, calm 1, death 1, gold 2. Hand: Hawk (life+calm, playable), Celestial Horse (elan+2 calm, short 1 calm), Fire Dragon (6 elan).
// The engine plays a small invented card set (RULES E1); the design shows the real game.
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const EN = { elan: 'شور', life: 'زندگی', calm: 'آرامش', death: 'مرگ', gold: 'طلا' };
  const ORD = ['elan', 'life', 'calm', 'death', 'gold'];
  const NM = {
    'mage-3': 'درویید', 'mage-8': 'پیشگو', 'mage-6': 'احضارگر مردگان', 'mage-5': 'شفادهنده',
    'item-71': 'کیمیا', 'item-72': 'آرامش یا شور', 'item-73': 'مرگ یا زندگی', 'item-74': 'پیشگویی', 'item-75': 'محافظت', 'item-76': 'زنده‌سازی', 'item-77': 'پژوهش', 'item-78': 'دگرگونی', 'item-back': 'پاس داده',
    'art-43': 'کلنگ کوتوله‌ها', 'art-49': 'گودال آتش', 'art-62': 'انگشتر میداس', 'art-41': 'تخم اژدها', 'art-53': 'شاهین', 'art-33': 'اسب آسمانی', 'art-48': 'اژدهای آتش', 'art-54': 'شاخ فراوانی',
    'art-38': 'جمجمهٔ نفرین‌شده', 'art-37': 'سردابه', 'art-50': 'چشمهٔ جوانی', 'art-35': 'جام زندگی', 'art-45': 'چشمهٔ عناصر', 'art-59': 'بلبل', 'art-66': 'درخت زندگی',
    'pp-21': 'لانهٔ اژدها', 'pp-23': 'قلعهٔ مرجانی', 'pp-26': 'برج کیمیاگر', 'pp-27': 'دخمهٔ مردگان', 'pp-30': 'معدن کوتوله‌ها',
    'mon-11': 'کلوسوس', 'mon-15': 'کتابخانه', 'mon-13': 'هرم بزرگ', 'mon-back': 'دستهٔ بناها', 'art-back': 'دستهٔ آثار',
  };
  const E = (k) => `<img class="ra-ei" src="${H.ART['ra-ess-' + k]}" alt="${EN[k]}">`;
  const pool = (p, cls = '') => `<span class="ra-pool ${cls}" aria-label="جوهرها">${ORD.map((k) => `<span class="ra-e${p[k] ? '' : ' is-zero'}">${E(k)}<b>${fa(p[k] ?? 0)}</b></span>`).join('')}</span>`;
  const vpTag = (n) => `<span class="gc-tag gc-tag--soft ra-vpt"><img src="${H.ART['ra-vp']}" alt="">${fa(n)} امتیاز</span>`;
  // one card: o = { w, tap, lit, sel, dim, store:[[k,n]], plus:html, act:html, badge }
  const C = (n, o = {}) => `<span class="ra-slot"><span class="ra-c${o.tap ? ' is-tap' : ''}${o.lit ? ' is-lit' : ''}${o.sel ? ' is-sel' : ''}${o.dim ? ' is-dim' : ''}" style="--w:${o.w ?? 70}px">${img('ra-' + n, NM[n] + (o.tap ? '، چرخانده' : ''))}${(o.store ?? []).map(([k, c]) => `<span class="ra-store">${Array.from({ length: c }, () => E(k)).join('')}</span>`).join('')}${o.plus ? `<span class="ra-plus">${o.plus}</span>` : ''}${o.badge ? `<b class="ra-badge">${o.badge}</b>` : ''}</span>${o.act ?? ''}</span>`;
  const act = (html, on = true) => `<button type="button" class="ra-act${on ? '' : ' is-off'}">${html}</button>`;

  // ---------- centre: places of power + monuments ----------
  const PP = ['pp-21', 'pp-23', 'pp-26', 'pp-27', 'pp-30'];
  const centre = (o, ph) => {
    const w = ph ? 58 : 76;
    const pp = `<div class="ra-grp"><h4>مکان‌های قدرت</h4><div class="ra-row">${PP.map((p) => C(p, { w, lit: o.ppLit === p, sel: o.ppSel === p })).join('')}</div></div>`;
    const mon = `<div class="ra-grp"><h4>بناها</h4><div class="ra-row">${C('mon-11', { w })}${C('mon-15', { w })}${C('mon-back', { w, badge: fa(o.monDeck ?? 6) })}</div></div>`;
    return `<div class="ra-centre${ph ? ' ra-centre--ph' : ''}">${pp}${mon}</div>`;
  };
  // ---------- opponents ----------
  const NIL = { mage: 'mage-6', item: 'item-72', arts: [['art-38'], ['art-37', { tap: true }], ['art-50'], ['mon-13']], pool: { elan: 1, life: 1, calm: 2, death: 5, gold: 0 }, vp: 3 };
  const REZ = { mage: 'mage-5', item: 'item-back', arts: [['art-35', { tap: true }], ['art-45'], ['art-59'], ['art-66', { tap: true }]], pool: { elan: 2, life: 1, calm: 3, death: 0, gold: 1 }, vp: 2, first: true };
  const oppPanel = (nm, seat, st, o = {}) => `<section class="ra-opp${o.turn ? ' is-turn' : ''}" aria-label="میز ${nm}"><header><i style="background:var(--seat-${seat})"></i><b>${nm}</b>${st.first ? `<img class="ra-fp" src="${H.ART['ra-first']}" alt="نشان نفر اول">` : ''}${o.passed ? '<span class="gc-tag">پاس داد</span>' : ''}<span class="ra-sp"></span>${pool(st.pool, 'ra-pool--sm')}</header><div class="ra-row">${C(st.mage, { w: 42, tap: st.mageTap })}${C(st.item, { w: 42 })}${st.arts.map(([n, x]) => C(n, { w: 42, ...(x ?? {}) })).join('')}</div></section>`;
  const opps = (turn, o = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '2:10', turn: turn === 2, meta: `${vpTag(o.nvp ?? 3)}<span>دست ${fa(o.nh ?? 2)}</span>${o.npass ? '<span class="gc-tag">پاس داد</span>' : ''}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:35', turn: turn === 6, meta: `${vpTag(o.rvp ?? 2)}<span>دست ${fa(o.rh ?? 1)}</span>${o.rpass === false ? '' : '<span class="gc-tag">پاس داد</span>'}` },
  ];
  const table = (o = {}) => (ph) => {
    let h = centre(o, ph);
    if (o.items) h += `<div class="ra-grp ra-items"><h4>اشیای جادویی</h4><div class="ra-row">${o.items.map(([n, x]) => C(n, { w: ph ? 40 : 62, ...(x ?? {}) })).join('')}</div></div>`;
    if (!ph && !o.noOpps) h += `<div class="ra-opps">${oppPanel('نیلوفر', 2, o.nil ?? NIL, { turn: o.turn === 2, passed: o.npass })}${oppPanel('رضا', 6, o.rez ?? REZ, { turn: o.turn === 6, passed: o.rpass !== false })}</div>`;
    return h;
  };
  // ---------- you ----------
  const POOL1 = { elan: 3, life: 2, calm: 1, death: 1, gold: 2 };
  const myTab = (o, ph) => {
    const A = (x) => (ph ? '' : x);
    const list = o.tab ?? [
      ['mage-3', {}], ['item-77', { lit: true, act: A(act(`${fa(1)} جوهر ← کارت`)) }],
      ['art-43', { lit: true, act: A(act(`${E('elan')}←${E('gold')}`)) }],
      ['art-49', { lit: true, act: A(act(`${E('life')}←${E('elan')}${E('death')}`)) }],
      ['art-62', { lit: true, act: A(act(`ذخیرهٔ ${E('gold')}`)) }],
      ['art-41', { lit: true, act: A(act(`اژدها ${fa(4)} کمتر`)) }],
    ];
    const w = ph ? (list.length > 6 ? 46 : 52) : (list.length > 6 ? 82 : 90);
    return `<div class="ra-tab">${list.map(([n, x]) => C(n, { w, ...x })).join('')}</div>`;
  };
  const above = (o = {}) => (ph) => `<div class="ra-me${ph ? ' ra-me--ph' : ''}">${o.acts ? `<div class="ra-acts">${o.acts(ph)}</div>` : ''}<div class="ra-mine">${myTab(o, ph)}<div class="ra-side">${pool(o.pool ?? POOL1, ph ? 'ra-pool--row' : 'ra-pool--col')}${ph ? '' : `<span class="ra-deck">${img('ra-art-back', 'دستهٔ شما')}<small>دسته ${fa(o.deck ?? 1)}</small></span>`}</div></div></div>`;
  const hand = (sel, list = [['art-53', 'ok'], ['art-33', 'dim'], ['art-48', 'dim']]) => list.map(([n, s]) => ({ art: 'ra-' + n, alt: NM[n], ok: s === 'ok', dim: s === 'dim', sel: sel === n }));
  const note = (vp, extra = '', h = 3) => `<span class="cx-note">${fa(vp)} امتیاز<span class="bgv-sep"></span>دست ${fa(h)}${extra}</span>`;
  const rail = (items = ['item-71', 'item-73', 'item-74', 'item-76', 'item-78'], fp = 'رضا', rnd = `دور ${fa(3)}`) => `<section class="cx-card"><h3>${rnd}</h3><div class="gc-pills"><span class="bgv-chip"><img src="${H.ART['ra-first']}" alt="">نفر اول: ${fp}</span><span class="bgv-chip">${img('ra-mon-back', '')}بناها: ${fa(6)}</span></div><div class="ra-rail-items" aria-label="اشیای جادویی آزاد">${items.map((n) => img('ra-' + n, NM[n])).join('')}</div><div class="ga-rule">${ic('info')}<span>هر نوبت یک اکشن: بازی یک اثر، گرفتن مکان قدرت یا بنا (${fa(4)} طلا)، فعال کردن قدرت یک کارت، دور ریختن یک کارت (${fa(1)} طلا یا ${fa(2)} جوهر دیگر) یا پاس. آخر دور هر کس ${fa(10)} امتیاز یا بیشتر داشته باشد، بازی تمام است.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  const acts1 = (ph) => `${btn(ph ? 'بازی شاهین' : `بازی شاهین (${fa(1)} زندگی و ${fa(1)} آرامش)`, 'primary', 'check')}${btn(ph ? 'دور ریختن' : 'دور ریختن کارت', 'secondary', 'download')}${btn('پاس', 'secondary', 'flag')}`;

  // ---------- modals ----------
  const DECK8 = ['art-43', 'art-49', 'art-41', 'art-62', 'art-53', 'art-33', 'art-48', 'art-54'];
  const mageModal = (ph) => modal('جادوگرتان را انتخاب کنید', `<p>از این دو جادوگر یکی را برای کل بازی نگه می‌دارید.</p><div class="ra-pick">${[['mage-3', true, 'آخر هر جمع‌آوری ۱ زندگی'], ['mage-8', false, 'آخر هر جمع‌آوری ۱ آرامش']].map(([n, s, t]) => `<button type="button" class="ra-pk${s ? ' is-sel' : ''}">${img('ra-' + n, NM[n])}<b>${NM[n]}</b><small>${t}</small></button>`).join('')}</div><p class="cx-note">دستهٔ ۸ کارتی شما: ۳ کارت اول در دست است و ۵ تای دیگر را می‌شود دید.</p><div class="ra-deck8">${DECK8.map((n, i) => `<span class="${i < 3 ? 'is-hand' : ''}">${img('ra-' + n, NM[n])}</span>`).join('')}</div>`, btn(ph ? 'انتخاب درویید' : 'انتخاب درویید', 'primary', 'check'));
  const discardModal = (ph) => modal('دور ریختن اژدهای آتش', `<div class="ra-dis">${img('ra-art-48', 'اژدهای آتش')}<div class="ra-opts"><button type="button" class="ra-opt"><span>${E('gold')} <b>${fa(1)} طلا</b></span></button><button type="button" class="ra-opt is-on" aria-pressed="true"><span><b>${fa(2)} جوهر دیگر</b><small>یکسان یا مختلف</small></span></button><div class="ra-steps">${['elan', 'life', 'calm', 'death'].map((k) => { const n = k === 'elan' || k === 'calm' ? 1 : 0; return `<span class="ra-step${n ? ' is-on' : ''}">${E(k)}<b>${fa(n)}</b><button type="button" aria-label="یکی بیشتر ${EN[k]}">+</button></span>`; }).join('')}</div></div></div><p class="cx-note">انتخاب شما: ${fa(1)} شور و ${fa(1)} آرامش. کارت به دورریختهٔ شما می‌رود.</p>`, `${btn('لغو', 'secondary', 'x')}${btn(ph ? 'دور ریختن' : 'دور ریختن و گرفتن جوهر', 'primary', 'check')}`);
  const passModal = (ph) => modal('پاس می‌دهید؟', `<p>این دور دیگر اکشن ندارید. رضا زودتر پاس داده، پس نشان نفر اول با اوست.</p><p>شیء جادویی‌تان (پژوهش) را پس می‌دهید و یکی از این‌ها را برمی‌دارید:</p><div class="ra-pick ra-pick--items">${['item-71', 'item-73', 'item-74', 'item-76', 'item-78'].map((n) => `<button type="button" class="ra-pk${n === 'item-74' ? ' is-sel' : ''}">${img('ra-' + n, NM[n])}<small>${NM[n]}</small></button>`).join('')}</div><p class="cx-note">بعد ${fa(1)} کارت از دسته‌تان می‌کشید.</p>`, `${btn('لغو', 'secondary', 'x')}${btn('پاس با پیشگویی', 'primary', 'flag')}`);
  const checkModal = () => modal('پایان دور ۳: بررسی پیروزی', `${tbl(['بازیکن', 'کارت‌ها', 'نشان نفر اول', 'جمع'], [{ c: ['نیلوفر', fa(3), fa(0), fa(3)] }, { c: ['شما', fa(2), fa(0), fa(2)] }, { c: ['رضا', fa(1), fa(1), fa(2)] }])}<p>کسی به ${fa(10)} امتیاز نرسید. کارت‌های چرخانده صاف می‌شوند و دور ${fa(4)} را رضا شروع می‌کند.</p>`, btn('دور ۴', 'primary', 'check'));
  const endModal = () => modal('شما با ۱۱ امتیاز بردید', `${tbl(['بازیکن', 'کارت‌ها', 'نشان نفر اول', 'جمع', 'جوهر مانده (طلا ×۲)'], [{ c: [`${ic('trophy')} شما`, fa(10), fa(1), fa(11), fa(9)], win: true }, { c: ['نیلوفر', fa(10), fa(0), fa(10), fa(12)] }, { c: ['رضا', fa(7), fa(0), fa(7), fa(5)] }])}<p class="cx-note">آخر دور ${fa(7)} شما و نیلوفر هر دو به ${fa(10)} رسیدید؛ امتیاز بیشتر برنده است. اگر مساوی می‌شد، جوهرهای مانده (هر طلا دوتا) تعیین می‌کرد و بعد برد مشترک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  const TAB_PLAIN = [['mage-3', {}], ['item-77', {}], ['art-43', {}], ['art-49', {}], ['art-62', {}], ['art-41', {}]];
  return {
    slug: 'ResArcana', fa: 'جادوی کهن', latin: 'Res Arcana', meta: ['زنده', '۳ نفر', 'دور ۳'],
    opps: opps(1),
    me: { cards: hand(null), clock: '1:50', turn: true, note: note(2), above: above({ acts: acts1 }) },
    cardW: 100, phoneCardW: 64, cardRatio: 1.4,
    table: table(),
    status: `<b>نوبت شماست.</b> شاهین را می‌توانید بازی کنید (${fa(1)} زندگی و ${fa(1)} آرامش). قدرت‌های آماده روی میزتان قاب طلایی دارند؛ مثلاً کلنگ ${fa(1)} شور را طلا می‌کند و با ${fa(3)} طلا برج کیمیاگر هم خریدنی می‌شود.`,
    pstatus: `<b>نوبت شما.</b> شاهین بازی‌کردنی است؛ کارت‌های قاب‌طلایی قدرت آماده دارند.`,
    railCard: rail(),
    logNote: `دور ${fa(3)}`,
    log: [[2, 'نیلوفر سردابه را چرخاند: ۲ مرگ'], [6, 'رضا پاس داد، ۱ کارت کشید و نفر اول شد'], [2, 'نیلوفر چشمهٔ جوانی را بازی کرد'], [1, 'نوبت شما']],
    dockItems: [['list', 'رویدادها'], ['users', 'حریف‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'انتخاب جادوگر از دو کارت',
        opps: opps(0, { nvp: 0, rvp: 0, nh: 3, rh: 3, rpass: false }),
        table: table({ noOpps: true }), overlay: mageModal, phone: true,
        me: { turn: true, clock: '0:40', note: note(0), cards: hand(null, [['art-43'], ['art-49'], ['art-41']]), above: above({ tab: [], pool: { elan: 1, life: 1, calm: 1, death: 1, gold: 1 }, deck: 5 }) },
        railCard: rail(['item-71', 'item-72', 'item-73', 'item-74', 'item-75', 'item-76', 'item-77', 'item-78'], 'نیلوفر', 'آماده‌سازی'), meta: ['زنده', '۳ نفر', 'شروع بازی'],
        status: '<b>شروع بازی.</b> هر نفر از هر جوهر ۱ دارد، دو جادوگر و دستهٔ ۸ کارتی خودش.',
        log: [[1, 'بازی شروع شد: هر نفر از هر جوهر ۱'], [2, 'نیلوفر نفر اول است'], [1, 'انتخاب جادوگر']],
      },
      {
        shotTitle: 'انتخاب شیء جادویی', turnSub: 'پیش از دور ۱، برخلاف عقربه',
        opps: opps(0, { nvp: 0, rvp: 0, nh: 3, rh: 3, rpass: false }),
        table: table({ noOpps: true, items: [['item-71'], ['item-72'], ['item-73'], ['item-74'], ['item-75'], ['item-76'], ['item-77', { sel: true }], ['item-78']] }),
        me: { turn: true, clock: '0:35', note: note(0), cards: hand(null, [['art-43'], ['art-49'], ['art-41']]), above: above({ tab: [['mage-3', {}]], pool: { elan: 1, life: 1, calm: 1, death: 1, gold: 1 }, deck: 5, acts: (ph) => btn(ph ? 'برداشتن پژوهش' : 'برداشتن پژوهش', 'primary', 'check') }) },
        railCard: rail(['item-71', 'item-72', 'item-73', 'item-74', 'item-75', 'item-76', 'item-77', 'item-78'], 'نیلوفر', 'آماده‌سازی'), meta: ['زنده', '۳ نفر', 'شروع بازی'],
        status: '<b>یک شیء جادویی بردارید.</b> نفر سمت راست نفر اول شروع می‌کند و برخلاف عقربه می‌رود: شما، رضا، بعد نیلوفر. پژوهش با ۱ جوهر یک کارت می‌کشد.',
        pstatus: '<b>شیء جادویی.</b> شما اول انتخاب می‌کنید.',
        log: [[1, 'شما درویید را انتخاب کردید'], [6, 'رضا شفادهنده را انتخاب کرد'], [1, 'نوبت شما برای شیء جادویی']],
      },
      {
        shotTitle: 'جمع‌آوری', turnSub: 'آغاز دور ۳',
        opps: opps(0, { rh: 0, rpass: false }),
        table: table({ rpass: false, nil: { ...NIL, arts: NIL.arts.map(([n]) => [n]) }, rez: { ...REZ, item: 'item-78', first: false, arts: REZ.arts.map(([n]) => [n]) } }),
        me: { turn: true, clock: '1:50', note: note(2), above: above({ pool: { elan: 3, life: 2, calm: 1, death: 1, gold: 1 }, tab: [['mage-3', { plus: `+${E('life')}` }], ['item-77', {}], ['art-43', {}], ['art-49', { plus: `+${E('elan')}` }], ['art-62', { store: [['gold', 1]], lit: true }], ['art-41', {}]], acts: (ph) => `<span class="ra-ask">${ph ? '' : 'طلای روی انگشتر میداس:'}</span>${btn(ph ? 'برداشتن طلا' : `برداشتن ${fa(1)} طلا`, 'primary', 'check')}${btn('بماند', 'secondary', 'x')}` }) },
        railCard: rail(['item-71', 'item-73', 'item-74', 'item-75', 'item-76'], 'نیلوفر'),
        status: `<b>دور ${fa(3)}: جمع‌آوری.</b> درویید ${fa(1)} زندگی و گودال آتش ${fa(1)} شور به استخرتان دادند. روی انگشتر میداس ${fa(1)} طلا ذخیره است؛ می‌توانید برش دارید یا بگذارید بماند.`,
        pstatus: '<b>جمع‌آوری.</b> طلای روی انگشتر را برمی‌دارید؟',
        log: [[1, 'شما: ۱ زندگی و ۱ شور'], [2, 'نیلوفر: ۱ مرگ و ۱ زندگی'], [6, 'رضا: ۲ زندگی، ۲ آرامش و ۱ شور'], [1, 'تصمیم دربارهٔ طلای ذخیره']],
      },
      {
        shotTitle: 'دور ریختن کارت', turnSub: '۱ طلا یا ۲ جوهر دیگر',
        me: { cards: hand('art-48', [['art-53'], ['art-33'], ['art-48']]), above: above({ tab: TAB_PLAIN }) },
        overlay: discardModal, phone: true,
        status: '<b>دور ریختن.</b> اژدهای آتش را انتخاب کردید. در عوض ۱ طلا می‌گیرید یا ۲ جوهر غیرطلایی، یکسان یا مختلف.',
        pstatus: '<b>دور ریختن.</b> ۱ طلا یا ۲ جوهر دیگر.',
        log: [[6, 'رضا پاس داد'], [2, 'نیلوفر چشمهٔ جوانی را بازی کرد'], [1, 'شما اژدهای آتش را دور می‌ریزید']],
      },
      {
        shotTitle: 'پاس', turnSub: 'عوض کردن شیء جادویی و کشیدن کارت',
        me: { above: above({ tab: [['mage-3', {}], ['item-77', {}], ['art-43', { tap: true }], ['art-49', {}], ['art-62', {}], ['art-41', {}], ['art-53', {}]], pool: { elan: 2, life: 1, calm: 0, death: 1, gold: 3 } }), cards: hand(null, [['art-33'], ['art-48']]), note: note(2, '', 2) },
        overlay: passModal, phone: true,
        status: '<b>پاس.</b> شاهین را بازی کردید و با کلنگ طلا گرفتید. حالا پاس می‌دهید و شیء جادویی‌تان را عوض می‌کنید.',
        pstatus: '<b>پاس.</b> یک شیء جادویی تازه انتخاب کنید.',
        log: [[1, 'شما شاهین را بازی کردید'], [2, 'نیلوفر جمجمه را چرخاند'], [1, 'شما کلنگ را چرخاندید: ۱ شور ← ۱ طلا'], [1, 'شما پاس می‌دهید']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر نیلوفر', phone: true,
        opps: opps(2),
        table: table({ turn: 2, ppLit: null }),
        me: { turn: false, clock: '1:12', note: note(2, '<span class="bgv-sep"></span>پاس دادید'), cards: hand(null, [['art-33'], ['art-48'], ['art-54']]), above: above({ tab: [['mage-3', {}], ['item-back', {}], ['art-43', { tap: true }], ['art-49', {}], ['art-62', {}], ['art-41', {}], ['art-53', {}]], pool: { elan: 2, life: 1, calm: 0, death: 1, gold: 3 }, deck: 0 }) },
        railCard: rail(['item-71', 'item-73', 'item-76', 'item-77', 'item-78']),
        status: '<b>نوبت نیلوفر است.</b> شما و رضا پاس داده‌اید؛ شیء جادویی هر دو رو به پایین است. نیلوفر تا وقتی پاس ندهد اکشن می‌کند.',
        pstatus: '<b>نوبت نیلوفر.</b> شما پاس داده‌اید.',
        log: [[1, 'شما پاس دادید و پیشگویی را برداشتید'], [1, 'شما ۱ کارت کشیدید'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'بررسی پیروزی', turnSub: 'پایان دور ۳',
        opps: opps(0, { npass: true }),
        table: table({ npass: true }), overlay: checkModal,
        me: { turn: false, clock: '', note: note(2), cards: hand(null, [['art-33'], ['art-48'], ['art-54']]), above: above({ tab: [['mage-3', {}], ['item-back', {}], ['art-43', { tap: true }], ['art-49', {}], ['art-62', {}], ['art-41', {}], ['art-53', {}]], pool: { elan: 2, life: 1, calm: 0, death: 1, gold: 3 }, deck: 0 }) },
        status: '<b>همه پاس دادند.</b> امتیازها شمرده شد.',
        log: [[2, 'نیلوفر پاس داد'], [1, 'بررسی پیروزی: کسی به ۱۰ نرسید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و برنده', meta: ['پایان', '۳ نفر', 'دور ۷'], railCard: rail(['item-71', 'item-73', 'item-76', 'item-77', 'item-78'], 'نیلوفر', `دور ${fa(7)}`),
        opps: opps(0, { npass: true, nvp: 10, rvp: 7 }),
        table: table({ npass: true }), overlay: endModal,
        me: { turn: false, clock: '', note: note(11, '', 0), above: above({ tab: TAB_PLAIN, pool: { elan: 2, life: 1, calm: 1, death: 1, gold: 2 }, deck: 0 }), cards: [] },
        status: '<b>بازی تمام شد.</b> شما با ۱۱ امتیاز بردید.',
        log: [[1, 'شما برج کیمیاگر را گرفتید'], [2, 'نیلوفر به ۱۰ امتیاز رسید'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:12px}
.ra-centre{display:flex;gap:18px;align-items:flex-start;justify-content:center}
.ra-grp{display:grid;gap:4px;justify-items:center}
.ra-grp h4{margin:0;font-size:12px;font-weight:700;color:var(--felt-muted)}
.ra-row{display:flex;gap:4px;align-items:flex-end}
.ra-slot{display:grid;justify-items:center;gap:3px}
.ra-c{position:relative;display:block;inline-size:var(--w);block-size:calc(var(--w) * 1.4);flex:none}
.ra-c>img:first-child{display:block;inline-size:100%;block-size:100%;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 6px 10px -6px rgba(0,0,0,.6)}
.ra-c.is-tap{inline-size:calc(var(--w) * 1.4)}
.ra-c.is-tap>img:first-child{position:absolute;inline-size:var(--w);block-size:calc(var(--w) * 1.4);left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg)}
.ra-c.is-lit>img:first-child{box-shadow:0 0 0 2.5px var(--felt-gold),0 6px 10px -6px rgba(0,0,0,.6)}
.ra-c.is-sel>img:first-child{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.ra-c.is-dim>img:first-child{filter:saturate(.7) brightness(.8)}
.ra-badge{position:absolute;inset-block-end:6px;inset-inline-start:50%;transform:translateX(50%);min-inline-size:24px;block-size:24px;border-radius:12px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:13px;padding-inline:4px}
.ra-store{position:absolute;inset-block-start:32%;inset-inline:0;display:flex;justify-content:center}
.ra-store .ra-ei{inline-size:30%;block-size:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.ra-plus{position:absolute;inset-block-start:-8px;inset-inline-end:-6px;display:inline-flex;align-items:center;gap:1px;padding:2px 7px;border-radius:999px;background:#3BB273;color:#fff;font-size:13px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.ra-plus .ra-ei{inline-size:14px;block-size:auto}
.ra-ei{inline-size:16px;block-size:auto;vertical-align:middle}
.ra-act{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:2px;min-block-size:26px;max-inline-size:84px;padding:2px 6px;border-radius:7px;background:rgba(250,245,236,.92);color:#142B3B;font-size:11.5px;font-weight:700;line-height:1.3;text-align:center;box-shadow:0 0 0 1.5px var(--felt-gold)}
.ra-act .ra-ei{inline-size:14px}
.ra-act.is-off{opacity:.45;box-shadow:none}
.ra-pool{display:inline-flex;gap:4px;direction:rtl}
.ra-e{display:inline-flex;align-items:center;gap:3px;padding:3px 7px 3px 5px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:14px;font-weight:800}
.ra-e .ra-ei{inline-size:17px}
.ra-e.is-zero{opacity:.5}
.ra-pool--col{display:grid;grid-template-columns:auto auto;gap:4px}
.ra-pool--sm .ra-e{padding:1px 5px 1px 3px;font-size:12px;gap:2px}.ra-pool--sm .ra-ei{inline-size:12px}
.ra-opps{display:flex;gap:8px;justify-content:center;flex-wrap:nowrap}
.ra-opp{display:grid;gap:6px;padding:6px 8px 8px;border-radius:var(--radius-md);background:rgba(8,20,28,.28)}
.ra-opp.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.ra-opp header{display:flex;align-items:center;gap:6px;color:var(--felt-ink);font-size:13px}
.ra-opp header i{inline-size:10px;block-size:10px;border-radius:50%}
.ra-opp .ra-sp{flex:1}
.ra-fp{inline-size:22px;block-size:22px}
.ra-items .ra-row{gap:6px}
.ra-me{display:grid;gap:8px;justify-items:center;inline-size:100%}
.ra-acts{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.ra-ask{color:var(--felt-ink);font-size:13.5px;font-weight:700}
.ra-mine{display:flex;gap:12px;align-items:flex-start;justify-content:center}
.ra-tab{display:flex;gap:6px;align-items:flex-start}
.ra-side{display:grid;gap:8px;justify-items:center}
.ra-deck{display:grid;justify-items:center;gap:2px;color:var(--felt-muted);font-size:12px}.ra-deck img{inline-size:40px;border-radius:3px}
.ra-vpt img,.bgv-chip img{inline-size:18px;block-size:18px}
.gc-seat__meta>*{white-space:nowrap}
.gc-hand .gc-card{margin-inline-start:10px}.gc-hand .gc-card:first-child{margin-inline-start:0}
.cx-phone .gc-hand .gc-card{margin-inline-start:6px}
.ra-rail-items{display:flex;flex-wrap:wrap;gap:6px;margin-block-start:8px}.ra-rail-items img{inline-size:48px;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,.25)}
.ra-pick{display:flex;gap:12px;justify-content:center}
.ra-pk{all:unset;cursor:pointer;display:grid;justify-items:center;gap:4px;font-size:13px;text-align:center}
.ra-pk img{inline-size:120px;border-radius:6px;box-shadow:0 4px 8px -4px rgba(0,0,0,.5)}
.ra-pk small{color:var(--text-muted);font-size:12px}
.ra-pk.is-sel img{box-shadow:0 0 0 3px #E8A642}
.ra-pick--items{gap:8px}.ra-pick--items .ra-pk img{inline-size:76px}
.ra-deck8{display:flex;gap:5px;justify-content:center}.ra-deck8 span img{display:block;inline-size:54px;border-radius:4px}.ra-deck8 span.is-hand img{box-shadow:0 0 0 2.5px #E8A642}
.ra-dis{display:flex;gap:14px;align-items:flex-start}.ra-dis>img{inline-size:110px;border-radius:6px;flex:none}
.ra-opts{display:grid;gap:8px;flex:1}
.ra-opt{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--border);font-size:14px}
.ra-opt span{display:inline-flex;align-items:center;gap:6px}.ra-opt small{color:var(--text-muted);font-size:12px}
.ra-opt.is-on{box-shadow:inset 0 0 0 2px #E8A642}
.ra-steps{display:flex;gap:6px;flex-wrap:wrap}
.ra-step{display:inline-flex;align-items:center;gap:4px;padding:4px 4px 4px 8px;border-radius:999px;background:var(--surface-sunken);font-size:14px}
.ra-step.is-on{box-shadow:inset 0 0 0 2px #E8A642}
.ra-step button{all:unset;cursor:pointer;inline-size:24px;block-size:24px;border-radius:50%;display:grid;place-items:center;background:var(--surface);font-weight:800}
.cx-phone .gc-table{gap:8px}
.ra-centre--ph{flex-direction:column;align-items:center;gap:6px}
.ra-me--ph{gap:6px}.ra-me--ph .ra-mine{flex-direction:column;align-items:center;gap:6px}.ra-me--ph .ra-tab{gap:4px}
.ra-me--ph .ra-acts{gap:6px;flex-wrap:nowrap;padding-inline:8px}
.ra-pool--row .ra-e{padding:2px 6px 2px 4px;font-size:13px}
.cx-phone .ra-pk img{inline-size:96px}.cx-phone .ra-pick--items{flex-wrap:wrap}.cx-phone .ra-pick--items{gap:6px}.cx-phone .ra-pick--items .ra-pk img{inline-size:52px}.cx-phone .ra-pick--items .ra-pk small{font-size:11px}
.cx-phone .ra-deck8{flex-wrap:wrap}.cx-phone .ra-deck8{gap:4px}.cx-phone .ra-deck8 span img{inline-size:34px}
.cx-phone .ra-dis>img{inline-size:72px}
.cx-phone .gd-score{font-size:12.5px}.cx-phone .gd-score th,.cx-phone .gd-score td{padding:6px 4px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب یک اکشن',
    diffs: [
      ['چیدمان', 'مثل BGA: مکان‌های قدرت و بناها (دو بنای رو و دسته) بالای میز، میز کوچک هر حریف با جادوگر، شیء جادویی، آثار و استخر جوهر، و میز شما پایین با استخر و دستهٔ کارت'],
      ['اکشن‌ها', 'کارت‌های قابل بازی دست روشن و بقیه کم‌رنگ؛ هر قدرت آماده قاب طلایی و دکمهٔ کوچک هزینه ← نتیجه دارد. کارت چرخانده افقی است و تا آخر دور قدرتش را نمی‌دهد'],
      ['جوهرها', 'همهٔ جوهرها با شکل چاپی خودشان: شور قرمز، زندگی سبز، آرامش آبی، مرگ سیاه، طلا زرد. جوهر ذخیره‌شده روی کارت دیده می‌شود (انگشتر میداس در §۶)'],
      ['شروع و پاس', 'انتخاب جادوگر از دو کارت با دیدن دستهٔ ۸ کارتی (§۴)، انتخاب شیء جادویی برخلاف عقربه (§۵)، و پاس با عوض کردن شیء جادویی که بعدش رو به پایین «پاس داده» می‌ماند (§۸)'],
      ['پایان', 'بررسی پیروزی آخر هر دور (§۱۰) و جدول پایانی با تساوی‌شکن جوهرهای مانده (§۱۱)'],
      ['موتور', 'موتور فعلی مجموعهٔ کارت کوچک و ساختگی دارد و حمله، واکنش، اشیای جادویی و هزینهٔ «هر جوهر» را ندارد (RULES E1 تا E5)؛ طرح بازی واقعی را با کارت‌های چاپی BGA نشان می‌دهد'],
    ],
  };
}
