// Race for the Galaxy on the group D frame. Real BGA base-game card art (printed powers), BGA phase icons, goods and VP chip.
// Mock: 3 players, round 5. You (Mina) started on Earth's Lost Colony; Niloufar on New Sparta (military), Reza on Alpha Centauri (brown windfalls).
// Your tableau: Earth's Lost Colony, Investment Credits, Artist Colony, Asteroid Belt, Consumer Markets = 7 card VP + 4 chips. Military 0.
// The engine plays an invented 55-card set and one phase per player even with 2 (RULES E1, E2). No card back in the pack: hidden cards are count chips.
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const NM = { 35: 'مستعمرهٔ گمشدهٔ زمین', 1: 'اعتبار سرمایه‌گذاری', 54: 'مستعمرهٔ هنرمندان', 42: 'کمربند سیارک‌ها', 10: 'بازارهای مصرف', 50: 'دنیای مرفه', 5: 'تفنگداران فضایی', 44: 'دنیای جواهر', 4: 'ربات‌های معدن', 57: 'بازماندگان تازه', 7: 'اقتصاد متنوع', 13: 'نیروی اکتشافی', 18: 'بانک میان‌ستاره‌ای', 61: 'دنیای منزوی', 9: 'آزمایشگاه‌های پژوهش', 36: 'اسپارتای نو', 20: 'ناوهای فرود', 69: 'معدنچیان شورشی', 58: 'دنیای یاغی', 67: 'تبعیدگاه سابق', 34: 'آلفا قنطورس', 49: 'دنیای معدنی', 66: 'منطقهٔ دنباله‌دار', 3: 'آزمایشگاه ژنتیک', 46: 'دنیای رادیواکتیو', 6: 'کنسرسیوم معدن', 72: 'دنیای ادویه', 86: 'مدسازان کهکشان', 24: 'امپراتوری کهکشان', 26: 'پیمایش کهکشان: ستی', 89: 'زمین نو', 23: 'فدراسیون کهکشانی' };
  const GN = { 1: 'نوآوری', 2: 'عناصر کمیاب', 3: 'ژن', 4: 'فناوری بیگانه' };
  const PH = [[1, 'اکتشاف'], [2, 'توسعه'], [3, 'سکونت'], [4, 'مصرف'], [5, 'تولید']];
  // card: o = { w, good, goodNew, lit, sel, dim, tag, ghost }
  const C = (id, o = {}) => `<span class="rg-slot"><span class="rg-c${o.lit ? ' is-lit' : ''}${o.sel ? ' is-sel' : ''}${o.dim ? ' is-dim' : ''}${o.ghost ? ' is-ghost' : ''}" style="--w:${o.w ?? 70}px">${img('rg-c' + id, NM[id] ?? '')}${o.good ? `<img class="rg-good${o.goodNew ? ' is-new' : ''}${o.goodSel ? ' is-sel' : ''}" src="${H.ART['rg-good' + o.good]}" alt="کالای ${GN[o.good]}">` : ''}${o.slotGood ? '<i class="rg-gslot"></i>' : ''}</span>${o.tag ? `<b class="rg-tag${o.tagSoft ? ' is-soft' : ''}">${o.tag}</b>` : ''}</span>`;
  const vpi = `<img class="rg-vpi" src="${H.ART['rg-vp']}" alt="ژتون امتیاز">`;
  const phi = (n) => `<img class="rg-phi" src="${H.ART['rg-ph' + (n - 1)]}" alt="">`;

  // ---------- action cards (simultaneous choice) ----------
  const ACTS = [[1, 'اکتشاف', `+${fa(5)} کشیدن`], [1, 'اکتشاف', `+${fa(1)} کشیدن، +${fa(1)} نگه داشتن`], [2, 'توسعه', `${fa(1)}− هزینه`], [3, 'سکونت', `+${fa(1)} کارت بعدش`], [4, 'مصرف', '$ تجارت'], [4, 'مصرف', `×${fa(2)} امتیاز`], [5, 'تولید', `${fa(1)} کالای بادآورده`]];
  const chooseBar = (sel, ph) => `<div class="rg-choose${ph ? ' rg-choose--ph' : ''}" role="radiogroup" aria-label="انتخاب مرحله">${ACTS.map(([n, t, b], i) => `<button type="button" class="rg-a${i === sel ? ' is-sel' : ''}" role="radio" aria-checked="${i === sel}">${phi(n)}<b>${t}</b><small>${b}</small></button>`).join('')}</div>`;
  // ---------- phase track (after reveal) ----------
  const track = (on, cur, ph) => `<div class="rg-track${ph ? ' rg-track--ph' : ''}" aria-label="مرحله‌های این دور">${PH.map(([n, t]) => { const who = on[n]; return `<span class="rg-p${who ? ' is-on' : ''}${cur === n ? ' is-cur' : ''}">${phi(n)}<b>${t}</b><small>${who ?? 'انتخاب نشد'}</small></span>`; }).join('')}</div>`;
  const pile = (o = {}) => `<div class="rg-piles"><span class="bgv-chip">دسته: ${fa(o.deck ?? 58)}</span><span class="bgv-chip">دورریخته: ${fa(o.disc ?? 21)}</span><span class="bgv-chip">${vpi}مخزن امتیاز: ${fa(o.pool ?? 29)}</span></div>`;

  // ---------- tableaux ----------
  const ME = [[35, { good: 1 }], [1], [54, { good: 1 }], [42], [10]];
  const NIL = [[36], [20], [69, { good: 2 }], [58], [67]];
  const REZ = [[34], [49, { good: 2 }], [66, { good: 2 }], [3], [46, { good: 2 }], [6]];
  const oppTab = (nm, seat, list, o = {}) => `<section class="rg-opp${o.turn ? ' is-turn' : ''}" aria-label="میز ${nm}"><header><i style="background:var(--seat-${seat})"></i><b>${nm}</b><span class="rg-sp"></span><span>${vpi}${fa(o.vp)}</span><span class="rg-mil">نیرو ${fa(o.mil)}</span><span>${fa(list.length)} کارت</span></header><div class="rg-row">${list.map(([id, x]) => C(id, { w: 48, ...(x ?? {}) })).join('')}</div></section>`;
  const table = (o = {}) => (ph) => {
    let h = o.top ? o.top(ph) : chooseBar(3, ph);
    h += pile(o.pile);
    if (o.mid) h += o.mid(ph);
    if (!ph && !o.noOpps) h += `<div class="rg-opps">${oppTab('نیلوفر', 2, o.nil ?? NIL, { vp: o.nvp ?? 8, mil: 7 })}${oppTab('رضا', 6, o.rez ?? REZ, { vp: o.rvp ?? 9, mil: 0 })}</div>`;
    return h;
  };
  const myTab = (list, ph) => `<div class="rg-tab">${list.map(([id, x]) => C(id, { w: ph ? (list.length > 6 ? 46 : 52) : 80, ...(x ?? {}) })).join('')}</div>`;
  const stats = (o, ph) => `<div class="rg-stats${ph ? ' rg-stats--ph' : ''}"><span class="rg-st"><b>${vpi}${fa(o.chips ?? 4)}</b><small>ژتون</small></span><span class="rg-st"><b>${fa(o.cvp ?? 7)}</b><small>امتیاز کارت</small></span><span class="rg-st"><b>${fa(o.mil ?? 0)}</b><small>نیروی نظامی</small></span></div>`;
  const above = (o = {}) => (ph) => `<div class="rg-me${ph ? ' rg-me--ph' : ''}">${o.acts ? `<div class="rg-acts">${o.acts(ph)}</div>` : ''}<div class="rg-mine">${myTab(o.tab ?? ME, ph)}${stats(o, ph)}</div></div>`;
  const hand = (list, o = {}) => list.map((id) => ({ html: `${list.length > 8 ? '<i class="rg-tight" hidden></i>' : ''}${img('rg-c' + id, NM[id])}${o[id]?.tag ? `<b class="rg-tag rg-htag">${o[id].tag}</b>` : ''}`, alt: NM[id], ok: !!o[id]?.ok, sel: !!o[id]?.sel, dim: !!o[id]?.dim }));
  const H6 = [5, 44, 4, 57, 50, 7];
  const opps = (st = {}, o = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:40', turn: !!st.n, meta: `<span class="gc-tag gc-tag--soft">${vpi}${fa(o.nvp ?? 8)}</span><span>دست ${fa(o.nh ?? 4)}</span>${st.n ? `<span class="gc-tag${st.n === 1 ? ' gc-tag--soft' : ''}">${st.nt ?? 'هنوز نه'}</span>` : `<span class="gc-tag">${st.nt ?? 'انتخاب کرد'}</span>`}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:25', turn: !!st.r, meta: `<span class="gc-tag gc-tag--soft">${vpi}${fa(o.rvp ?? 9)}</span><span>دست ${fa(o.rh ?? 3)}</span>${st.r ? `<span class="gc-tag gc-tag--soft">${st.rt ?? 'هنوز نه'}</span>` : `<span class="gc-tag">${st.rt ?? 'انتخاب کرد'}</span>`}` },
  ];
  const note = (vp, h, x = '') => `<span class="cx-note">${fa(vp)} امتیاز<span class="bgv-sep"></span>دست ${fa(h)}${x}</span>`;
  const rail = (rnd = 5) => `<section class="cx-card"><h3>دور ${fa(rnd)}</h3><div class="gc-pills"><span class="bgv-chip">${vpi}مخزن: ${fa(29)} از ${fa(36)}</span><span class="bgv-chip">بیشترین میز: ${fa(6)} کارت</span></div><div class="ga-rule">${ic('info')}<span>همه هم‌زمان و پنهانی یک مرحله انتخاب می‌کنند؛ فقط مرحله‌های انتخاب‌شده اجرا می‌شوند، برای همه، و انتخاب‌کننده پاداش هم می‌گیرد. آخر دور دست حداکثر ${fa(10)} کارت. بازی وقتی تمام می‌شود که میزی به ${fa(12)} کارت برسد یا مخزن امتیاز خالی شود.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ON5 = { 2: 'نیلوفر', 3: 'شما', 5: 'رضا' };

  // ---------- modals ----------
  const startModal = (ph) => modal('۲ کارت از ۶ کارت را دور بریزید', `<p>دنیای آغازین شما مستعمرهٔ گمشدهٔ زمین است. از این ۶ کارت ۴ تا را نگه می‌دارید.</p><div class="rg-start">${C(35, { w: ph ? 64 : 92 })}<div class="rg-six">${[1, 54, 13, 18, 61, 9].map((id) => C(id, { w: ph ? 44 : 60, dim: id === 61 || id === 9, tag: id === 61 || id === 9 ? 'دور ریخته' : '' })).join('')}</div></div>`, btn('تأیید', 'primary', 'check'));
  const endModal = () => modal('شما با ۳۶ امتیاز بردید', `<p>میز رضا به ${fa(12)} کارت رسید؛ بازی آخر همین دور تمام شد.</p>${tbl(['بازیکن', 'امتیاز کارت‌ها', 'ژتون', 'جمع', 'دست + کالا'], [{ c: [`${ic('trophy')} شما`, fa(22), fa(14), fa(36), fa(5)], win: true }, { c: ['رضا', fa(25), fa(9), fa(34), fa(4)] }, { c: ['نیلوفر', fa(20), fa(8), fa(28), fa(6)] }])}<p class="cx-note">تساوی: هر کس کارت دست و کالای بیشتری دارد برنده است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  const TAB6 = [...ME, [50, { ghost: true }]];
  const TAB6P = [[35], [1], [54], [42], [10], [50]];
  return {
    slug: 'RaceGalaxy', fa: 'ریس فور د گلکسی', latin: 'Race for the Galaxy', meta: ['زنده', '۳ نفر', 'دور ۵'],
    opps: opps({ r: 1 }),
    me: { cards: hand(H6), clock: '1:55', turn: true, note: note(11, 6), above: above({ acts: (ph) => `${btn(ph ? 'تأیید سکونت' : 'تأیید انتخاب: سکونت', 'primary', 'check')}` }) },
    cardW: 84, phoneCardW: 52, cardRatio: 1.4,
    table: table(),
    status: `<b>یک مرحله انتخاب کنید.</b> سکونت را برداشتید: دنیای مرفه (${fa(3)} کارت) یا دنیای جواهر (${fa(2)} کارت) را می‌توانید بگذارید و پاداشش ${fa(1)} کارت بعد از سکونت است. نیلوفر انتخاب کرده و رضا هنوز نه؛ انتخاب‌ها با هم رو می‌شوند.`,
    pstatus: '<b>انتخاب مرحله.</b> سکونت انتخاب شد؛ تأیید کنید.',
    railCard: rail(),
    logNote: `دور ${fa(5)}`,
    log: [[1, 'دور ۴: شما مصرف ×۲ کردید، ۴ امتیاز'], [6, 'رضا ۱ کالا روی دنیای رادیواکتیو گرفت'], [2, 'نیلوفر انتخاب کرد'], [1, 'انتخاب مرحلهٔ دور ۵']],
    dockItems: [['list', 'رویدادها'], ['users', 'میزها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'دنیای آغازین و نگه داشتن ۴ کارت', meta: ['زنده', '۳ نفر', 'شروع بازی'], phone: true,
        opps: opps({ n: 1, nt: 'هنوز نه', r: 1, rt: 'هنوز نه' }, { nvp: 0, rvp: 0, nh: 6, rh: 6 }),
        table: table({ top: () => '', pile: { deck: 92, disc: 0, pool: 36 }, nil: [[36]], rez: [[34]], nvp: 0, rvp: 0 }), overlay: startModal,
        me: { cards: [], note: note(0, 6), above: above({ tab: [[35]], chips: 0, cvp: 1, mil: 0 }) },
        status: '<b>شروع بازی.</b> هر نفر یک دنیای آغازین و ۶ کارت گرفته و ۲ تا را دور می‌ریزد. مخزن امتیاز برای سه نفر ۳۶ ژتون است.',
        pstatus: '<b>شروع.</b> ۲ کارت را دور بریزید.',
        log: [[1, 'بازی شروع شد'], [1, 'دنیای آغازین شما: مستعمرهٔ گمشدهٔ زمین']],
      },
      {
        shotTitle: 'رو شدن مرحله‌ها و توسعه', turnSub: 'توسعه، سکونت و تولید این دور اجرا می‌شوند',
        opps: opps({ n: 1, nt: 'در کار', r: 1, rt: 'در کار' }),
        table: table({ top: (ph) => track(ON5, 2, ph) }),
        me: { cards: hand(H6, { 7: { ok: true, tag: `${fa(3)} کارت` }, 4: { ok: true, tag: `${fa(1)} کارت` }, 5: { ok: true, tag: `${fa(1)} کارت` }, 44: { dim: true }, 57: { dim: true }, 50: { dim: true } }), note: note(11, 6), above: above({ acts: (ph) => `${btn('گذاشتن', 'primary', 'check')}${btn(ph ? 'هیچ' : 'هیچ توسعه‌ای', 'secondary', 'x')}` }) },
        status: '<b>مرحلهٔ توسعه (نیلوفر انتخاب کرد).</b> همه می‌توانند یک توسعه بگذارند؛ هزینه‌ها با تخفیف اعتبار سرمایه‌گذاری (۱−) روی کارت‌ها نوشته شده. پاداش ۱− فقط مال نیلوفر است.',
        pstatus: '<b>توسعه.</b> یک توسعه بگذارید یا «هیچ».',
        log: [[2, 'نیلوفر: توسعه'], [1, 'شما: سکونت'], [6, 'رضا: تولید'], [1, 'مرحلهٔ توسعه']],
      },
      {
        shotTitle: 'سکونت', turnSub: 'پرداخت هزینه با کارت دست',
        opps: opps({ n: 1, nt: 'در کار', r: 1, rt: 'در کار' }),
        table: table({ top: (ph) => track(ON5, 3, ph) }),
        me: { cards: hand(H6, { 50: { sel: true }, 5: { tag: 'پرداخت', dim: true }, 4: { tag: 'پرداخت', dim: true }, 57: { tag: 'پرداخت', dim: true } }), note: note(11, 6), above: above({ tab: TAB6, acts: (ph) => `<span class="rg-cost">${ph ? '' : 'دنیای مرفه: '}${fa(3)} از ${fa(3)} کارت</span>${btn(ph ? 'سکونت' : 'پرداخت و سکونت', 'primary', 'check')}${btn('لغو', 'secondary', 'x')}` }) },
        status: '<b>سکونت.</b> دنیای مرفه ۳ کارت هزینه دارد؛ سه کارت پرداخت را انتخاب کردید. بازماندگان تازه دنیای نظامی است (دفاع ۱) و با نیروی ۰ نمی‌شود گرفتش. چون سکونت را خودتان انتخاب کردید، بعدش ۱ کارت می‌کشید.',
        pstatus: '<b>سکونت.</b> ۳ کارت برای پرداخت.',
        log: [[2, 'نیلوفر ناوهای فرود گذاشت'], [6, 'رضا توسعه نگذاشت'], [1, 'مرحلهٔ سکونت']],
      },
      {
        shotTitle: 'منتظر بقیه', turnSub: 'کار شما در این مرحله تمام شد',
        opps: opps({ n: 1, nt: 'در کار', r: 0, rt: 'تمام' }),
        table: table({ top: (ph) => track(ON5, 3, ph) }),
        me: { turn: false, cards: hand([44, 7, 72]), note: note(14, 3), above: above({ tab: TAB6P, cvp: 9, acts: () => `<span class="rg-wait">${ic('clock')}منتظر نیلوفر</span>` }) },
        opps2: null,
        status: '<b>منتظر نیلوفر.</b> شما و رضا کارتان را در این مرحله کرده‌اید. کار دیگران وقتی مرحله تمام شود رو می‌شود.',
        pstatus: '<b>منتظر نیلوفر.</b>',
        log: [[1, 'شما در دنیای مرفه ساکن شدید'], [1, 'پاداش سکونت: ۱ کارت'], [6, 'رضا تمام کرد'], [2, 'نیلوفر هنوز سکونت می‌کند']],
      },
      {
        shotTitle: 'اکتشاف', turnSub: 'پاداش +۱ و +۱: ۳ بکش، ۲ نگه دار', meta: ['زنده', '۳ نفر', 'دور ۶'],
        opps: opps({ n: 1, nt: 'در کار', r: 1, rt: 'در کار' }, { nh: 5, rh: 4 }),
        table: table({ noOpps: true, top: (ph) => track({ 1: 'شما', 4: 'نیلوفر' }, 1, ph), mid: (ph) => `<div class="rg-drawn" aria-label="کارت‌های کشیده"><h4>کارت‌های کشیده</h4><div class="rg-row">${[72, 86, 24].map((id) => C(id, { w: ph ? 72 : 86, sel: id !== 24, tag: id !== 24 ? 'نگه می‌دارم' : 'دور ریخته', tagSoft: id === 24 })).join('')}</div></div>` }),
        me: { cards: hand([44, 7]), note: note(14, 2), above: above({ tab: TAB6P, cvp: 9, acts: (ph) => btn(ph ? 'نگه داشتن ۲ کارت' : 'نگه داشتن ۲ کارت', 'primary', 'check') }) },
        railCard: rail(6),
        status: '<b>اکتشاف با پاداش +۱ و +۱.</b> به جای ۲ کارت ۳ کشیدید و ۲ تا نگه می‌دارید. پاداش دیگر اکتشاف (+۵) یعنی ۷ کارت بکشید و ۱ نگه دارید.',
        pstatus: '<b>اکتشاف.</b> ۲ کارت از ۳ را نگه دارید.',
        log: [[1, 'شما: اکتشاف +۱ و +۱'], [2, 'نیلوفر: مصرف $'], [6, 'رضا هم اکتشاف کرد'], [1, '۳ کارت کشیدید']],
      },
      {
        shotTitle: 'مصرف', turnSub: 'کالاها با قدرت مصرف امتیاز می‌شوند', meta: ['زنده', '۳ نفر', 'دور ۷'], phone: true,
        opps: opps({ n: 1, nt: 'در کار', r: 1, rt: 'در کار' }),
        table: table({ top: (ph) => track({ 2: 'رضا', 4: 'شما' }, 4, ph) }),
        me: { cards: hand([44, 7, 72, 86]), note: note(14, 4), above: above({ tab: [[35, { good: 1, goodSel: true }], [1], [54, { good: 1, goodSel: true }], [42], [10, { lit: true }], [50, { good: 1, goodSel: true }]], cvp: 9, acts: (ph) => `<span class="rg-cost">${ph ? '' : 'بازارهای مصرف: '}${fa(3)} کالا ← ${fa(3)} امتیاز (×${fa(2)} = ${fa(6)})</span>${btn('مصرف', 'primary', 'check')}` }) },
        railCard: rail(7),
        status: '<b>مصرف با پاداش ×۲.</b> بازارهای مصرف هر کالای نوآوری (آبی) را ۱ امتیاز می‌کند، تا ۳ تا. سه کالای آبی دارید: ۳ امتیاز، با پاداش ×۲ می‌شود ۶ ژتون. قدرت مصرف باید کامل استفاده شود.',
        pstatus: '<b>مصرف ×۲.</b> ۳ کالا ← ۶ امتیاز.',
        log: [[6, 'رضا: توسعه'], [1, 'شما: مصرف ×۲'], [1, 'مرحلهٔ مصرف']],
      },
      {
        shotTitle: 'تولید', turnSub: 'پاداش: یک کالا روی دنیای بادآورده', meta: ['زنده', '۳ نفر', 'دور ۸'],
        opps: opps({ n: 1, nt: 'در کار', r: 0, rt: 'تمام' }, { nvp: 12, rvp: 14 }),
        table: table({ top: (ph) => track({ 3: 'نیلوفر', 5: 'شما' }, 5, ph), nvp: 12, rvp: 14 }),
        me: { cards: hand([44, 7, 72]), note: note(20, 3), above: above({ chips: 10, cvp: 10, tab: [[35, { good: 1, goodNew: true }], [1], [54, { good: 1, goodNew: true }], [42, { lit: true, slotGood: true, tag: 'اینجا؟' }], [10], [50, { good: 1, goodNew: true }]], acts: (ph) => `${btn(ph ? 'کالا روی کمربند' : 'کالا روی کمربند سیارک‌ها', 'primary', 'check')}` }) },
        railCard: rail(8),
        status: '<b>تولید.</b> سه دنیای تولیدی شما هر کدام یک کالای آبی گرفتند. چون تولید را خودتان انتخاب کردید، یک کالا هم روی یک دنیای بادآوردهٔ خالی می‌گذارید: کمربند سیارک‌ها.',
        pstatus: '<b>تولید.</b> یک دنیای بادآورده را انتخاب کنید.',
        log: [[2, 'نیلوفر: سکونت'], [1, 'شما: تولید'], [1, '۳ کالای نوآوری تولید شد']],
      },
      {
        shotTitle: 'دور ریختن تا ۱۰', turnSub: 'آخر دور، دست بیش از ۱۰ کارت', meta: ['زنده', '۳ نفر', 'دور ۹'],
        opps: opps({ n: 0, r: 0, nt: 'تمام', rt: 'تمام' }, { nvp: 12, rvp: 14 }),
        table: table({ top: (ph) => track({ 1: 'شما و رضا', 3: 'نیلوفر' }, 0, ph), nvp: 12, rvp: 14 }),
        me: { cards: hand([44, 7, 72, 86, 13, 18, 61, 9, 26, 89, 23], { 61: { sel: true } }), note: note(20, 11), above: above({ chips: 10, cvp: 10, tab: TAB6P, acts: (ph) => `<span class="rg-cost">${fa(1)} از ${fa(1)}</span>${btn(ph ? 'دور ریختن' : 'دور ریختن ۱ کارت', 'primary', 'check')}` }) },
        phone: true, phoneCardW: 40,
        railCard: rail(9),
        status: '<b>آخر دور ۹.</b> ۱۱ کارت در دست دارید و حداکثر ۱۰ مجاز است؛ ۱ کارت را دور بریزید.',
        pstatus: '<b>۱ کارت را دور بریزید.</b>',
        log: [[1, 'شما اکتشاف +۵ کردید'], [2, 'نیلوفر ساکن شد'], [1, 'دست شما ۱۱ کارت است']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و برنده', meta: ['پایان', '۳ نفر', 'دور ۱۲'],
        opps: opps({ n: 0, r: 0, nt: 'تمام', rt: 'تمام' }, { nvp: 28, rvp: 34 }),
        table: table({ top: (ph) => track({ 2: 'رضا', 4: 'شما', 5: 'نیلوفر' }, 0, ph), pile: { deck: 12, disc: 47, pool: 5 }, nvp: 28, rvp: 34 }), overlay: endModal,
        me: { turn: false, clock: '', cards: [], note: note(36, 5), above: above({ chips: 14, cvp: 22, mil: 1, tab: TAB6P }) },
        railCard: rail(12),
        status: '<b>بازی تمام شد.</b> شما با ۳۶ امتیاز بردید.',
        log: [[6, 'رضا دوازدهمین کارت را گذاشت'], [1, 'شما مصرف ×۲ کردید: ۸ امتیاز'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.rg-slot{display:grid;justify-items:center;gap:3px;position:relative}
.rg-c{position:relative;display:block;inline-size:var(--w);block-size:calc(var(--w) * 1.4);flex:none}
.rg-c>img:first-child{display:block;inline-size:100%;block-size:100%;border-radius:5px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 6px 10px -6px rgba(0,0,0,.6)}
.rg-c.is-lit>img:first-child{box-shadow:0 0 0 2.5px var(--felt-gold),0 6px 10px -6px rgba(0,0,0,.6)}
.rg-c.is-sel>img:first-child{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.rg-c.is-dim>img:first-child{filter:saturate(.6) brightness(.72)}
.rg-c.is-ghost{opacity:.6}.rg-c.is-ghost>img:first-child{box-shadow:0 0 0 2px dashed var(--felt-gold);outline:2px dashed var(--felt-gold);outline-offset:2px}
.rg-good{position:absolute;inline-size:36%;inset-block-end:4%;inset-inline-end:-6%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55))}
.rg-good.is-new{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 4px var(--felt-gold))}
.rg-good.is-sel{outline:2.5px solid var(--felt-gold);outline-offset:1px;border-radius:6px}
.rg-gslot{position:absolute;inline-size:36%;block-size:39%;inset-block-end:4%;inset-inline-end:-6%;border-radius:6px;border:2px dashed var(--felt-gold);background:rgba(232,166,66,.18);box-sizing:border-box}
.rg-tag{display:inline-block;padding:1px 7px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:11.5px;font-weight:800;white-space:nowrap}
.rg-tag.is-soft{background:rgba(250,245,236,.16);color:var(--felt-ink)}
.rg-htag{position:absolute;inset-block-start:-10px;left:50%;transform:translateX(-50%);z-index:2}
.rg-phi{inline-size:32px;block-size:32px;border-radius:4px;flex:none}
.rg-vpi{inline-size:18px;block-size:auto;vertical-align:middle}
.rg-choose{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;inline-size:100%;max-inline-size:700px}
.rg-a{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;align-content:start;gap:3px;padding:8px 4px;border-radius:10px;background:rgba(250,245,236,.08);box-shadow:inset 0 0 0 1px rgba(250,245,236,.16);color:var(--felt-ink);text-align:center}
.rg-a b{font-size:13.5px}.rg-a small{font-size:11.5px;line-height:1.4;color:var(--felt-muted)}
.rg-a.is-sel{background:rgba(232,166,66,.2);box-shadow:inset 0 0 0 2.5px var(--felt-gold)}.rg-a.is-sel small{color:var(--felt-ink)}
.rg-track{display:flex;gap:6px;justify-content:center}
.rg-p{display:grid;justify-items:center;gap:2px;inline-size:96px;padding:6px 4px;border-radius:10px;background:rgba(250,245,236,.05);color:var(--felt-muted);font-size:12px;opacity:.55}
.rg-p b{font-size:13.5px}
.rg-p.is-on{opacity:1;background:rgba(250,245,236,.1);color:var(--felt-ink)}
.rg-p.is-cur{background:rgba(232,166,66,.2);box-shadow:inset 0 0 0 2.5px var(--felt-gold)}
.rg-piles{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.rg-piles .bgv-chip img{margin-inline-end:4px}
.rg-opps{display:flex;gap:8px;justify-content:center}
.rg-opp{display:grid;gap:6px;padding:6px 8px 8px;border-radius:var(--radius-md);background:rgba(8,20,28,.28)}
.rg-opp header{display:flex;align-items:center;gap:8px;color:var(--felt-ink);font-size:12.5px;white-space:nowrap}
.rg-opp header i{inline-size:10px;block-size:10px;border-radius:50%}.rg-opp .rg-sp{flex:1}.rg-opp header span{color:var(--felt-muted)}
.rg-row{display:flex;gap:4px;align-items:flex-end;direction:ltr}
.rg-drawn{display:grid;justify-items:center;gap:6px}.rg-drawn h4{margin:0;font-size:12.5px;color:var(--felt-muted)}.rg-drawn .rg-row{gap:12px}
.rg-me{display:grid;gap:8px;justify-items:center;inline-size:100%}
.rg-acts{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.rg-cost{color:var(--felt-ink);font-size:13.5px;font-weight:700}
.rg-wait{display:inline-flex;align-items:center;gap:6px;block-size:40px;padding-inline:14px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-size:14px}
.rg-mine{display:flex;gap:14px;align-items:center;justify-content:center}
.rg-tab{display:flex;gap:6px;direction:ltr}
.rg-stats{display:grid;gap:6px}
.rg-st{display:grid;justify-items:center;color:var(--felt-ink)}
.rg-st b{display:inline-flex;align-items:center;gap:4px;font-size:18px}.rg-st small{font-size:11.5px;color:var(--felt-muted)}
.rg-start{display:flex;gap:14px;align-items:flex-start}.rg-six{display:flex;flex-wrap:wrap;gap:6px;direction:ltr}
.gc-seat__meta>*{white-space:nowrap}
.gc-hand .gc-card{margin-inline-start:6px}.gc-hand .gc-card:first-child{margin-inline-start:0}
.gc-hand:has(.rg-tight) .gc-card:not(:first-child){margin-inline-start:calc(var(--cw) * -.42)}
.gc-seat__meta .gc-tag img{inline-size:16px}
.cx-phone .gc-table{gap:8px}
.rg-choose--ph{grid-template-columns:repeat(4,1fr);padding-inline:8px;box-sizing:border-box;gap:5px}
.rg-choose--ph .rg-a{padding:6px 2px}.rg-choose--ph .rg-a small{font-size:10.5px}.rg-choose--ph .rg-phi{inline-size:24px;block-size:24px}
.rg-track--ph{gap:4px}.rg-track--ph .rg-p{inline-size:68px;font-size:11px}.rg-track--ph .rg-p b{font-size:12px}
.rg-me--ph{gap:6px}.rg-me--ph .rg-mine{flex-direction:column;gap:6px}.rg-tab{gap:4px}
.rg-stats--ph{display:flex;gap:14px}.rg-stats--ph .rg-st small{font-size:11px}
.rg-me--ph .rg-acts{gap:6px;padding-inline:8px}.rg-me--ph .rg-cost{font-size:12.5px}
.cx-phone .rg-start{flex-direction:column;align-items:center}.cx-phone .rg-six .rg-tag{font-size:10px;padding:1px 4px}.cx-phone .rg-six{justify-content:center}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب پنهانی یک مرحله',
    diffs: [
      ['چیدمان', 'مثل BGA: کارت‌های انتخاب مرحله (یا نوار مرحله‌های رو شده) بالای میز، دسته، دورریخته و مخزن امتیاز زیرش، میز کوچک هر حریف با کالاها و نیروی نظامی، و میز شما با امتیاز کارت، ژتون و نیرو بالای دست'],
      ['مرحله‌ها', 'هفت کارت انتخاب سه‌نفره (دو اکتشاف، دو مصرف) با پاداش هرکدام؛ بعد از رو شدن فقط مرحله‌های انتخاب‌شده روشن‌اند و اسم انتخاب‌کننده زیرشان است (§۵)'],
      ['گذاشتن کارت', 'کارت‌های قابل گذاشتن با هزینهٔ نهایی بعد از تخفیف؛ پرداخت با انتخاب کارت‌های دست (§۶)؛ دنیای نظامی با مقایسهٔ نیرو و دفاع'],
      ['کالا', 'کالاها همان کارت‌های رنگی BGA روی گوشهٔ دنیا: آبی نوآوری، قهوه‌ای عناصر کمیاب، سبز ژن، زرد فناوری بیگانه. مصرف با قدرت کارت‌ها و پیش‌نمایش امتیاز (§۹)، تولید با پاداش بادآورده (§۱۰)'],
      ['پشت کارت', 'پشت کارت در بسته نیست (BGA کارت پنهان را با عدد نشان می‌دهد)؛ دسته و دست حریف‌ها با عدد آمده و در MISSING-ART ثبت شد'],
      ['موتور', 'موتور فعلی ۵۵ کارت ساختگی با ۵ قدرت ساده دارد، تجارت و پاداش‌های BGA را ندارد و دونفره هم یک مرحله می‌دهد (RULES E1 تا E4)؛ طرح بازی واقعی را با کارت‌های چاپی BGA نشان می‌دهد'],
    ],
  };
}
