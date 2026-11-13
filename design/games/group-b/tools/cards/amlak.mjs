// Monopoly / مونوپولی (repo slug amlak) on the shared table frame (group B). Rules as the repo engine: 2–8 players,
// two dice, buy or (default) auction for everyone, rent doubles on a full colour group without houses, even building,
// mortgages, Chance/Chest, jail; money in thousand toman, start 1500, salary 200.
// Board art: the ready-made 40-square Tehran board (1112 px; corners 33–175 and 937–1079, edge squares 84.67 px).
// Mock (4 players, round 9; you are blue / pawn 2): you were on 9 «خیابان پیروزی» and rolled 3 + 4 → 16 «خیابان طالقانی»,
// unowned (180). Phase 'buy': legal actions are only buy or decline (decline starts an auction, you bid too).
//   You: 620 cash; 15 راه‌آهن, 18 مطهری, 19 بهار, 26 سعادت‌آباد → buying 16 completes orange (rent ×2, building allowed).
//   Setareh (red car, seat-3): 410; 5, 6, 8, 9 (light blue full, 1 house each); on 22 (chance).
//   Kian (yellow horse, seat-2): 530; 11, 12, 13, 24, 37; on 34 (chest).
//   Niloufar (teal boat, seat-6): 380; 1, 3 (brown full, 1 house each), 21, 23, 28, 31, 32; in jail.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const S = 1112, E = 84.67;
  const cxy = (i) => i === 0 ? [1008, 1008] : i < 10 ? [937 - (i - 0.5) * E, 1008] : i === 10 ? [104, 1008] : i < 20 ? [104, 937 - (i - 10.5) * E]
    : i === 20 ? [104, 104] : i < 30 ? [175 + (i - 20.5) * E, 104] : i === 30 ? [1008, 104] : [1008, 175 + (i - 30.5) * E];
  const side = (i) => i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r';
  const at = (x, y) => `left:${(x / S * 100).toFixed(3)}%;top:${(y / S * 100).toFixed(3)}%`;
  const SEAT = { me: 1, setareh: 3, kian: 2, niloufar: 6 };
  // owner marker: white oval (cut like the pawn base) tinted with the seat colour via multiply
  const own = (i, who) => { const [x, y] = cxy(i), sd = side(i); const p = sd === 'b' ? [x, 1069] : sd === 'l' ? [43, y] : sd === 't' ? [x, 43] : [1069, y];
    return `<i class="am-own am-own--${sd === 'b' || sd === 't' ? 'h' : 'v'}" style="${at(...p)};--c:var(--seat-${SEAT[who]});--m:url(${H.ART['amlak-owner-marker']})">${img('amlak-owner-marker', '')}</i>`; };
  const house = (i) => { const [x, y] = cxy(i), sd = side(i); const p = sd === 'b' ? [x, 951] : sd === 'l' ? [161, y] : sd === 't' ? [x, 161] : [951, y];
    return `<span class="am-house" style="${at(...p)}">${img('amlak-house', 'یک خانه')}</span>`; };
  const hotel = (i) => { const [x, y] = cxy(i), sd = side(i); const p = sd === 'b' ? [x, 951] : sd === 'l' ? [161, y] : sd === 't' ? [x, 161] : [951, y];
    return `<span class="am-house am-house--h" style="${at(...p)}">${img('amlak-hotel', 'هتل')}</span>`; };
  const tok = (k, x, y, cls = '', alt = '') => `<span class="am-tok${cls ? ' ' + cls : ''}" style="${at(x, y)}">${img(`amlak-token-${k}`, alt)}</span>`;
  const owners = [[5, 'setareh'], [6, 'setareh'], [8, 'setareh'], [9, 'setareh'], [11, 'kian'], [12, 'kian'], [13, 'kian'], [24, 'kian'], [37, 'kian'],
    [1, 'niloufar'], [3, 'niloufar'], [21, 'niloufar'], [23, 'niloufar'], [28, 'niloufar'], [31, 'niloufar'], [32, 'niloufar'], [15, 'me'], [18, 'me'], [19, 'me'], [26, 'me']];
  const path = [[62, 1052], ...[11, 12, 13, 14, 15].map((i) => { const [, y] = cxy(i); return [62, y]; })];
  const [, y16] = cxy(16);
  const board = (ph, o = {}) => `<div class="am-board${ph ? ' am-board--ph' : ''}" aria-label="صفحهٔ مونوپولی">${img('amlak-board', 'صفحهٔ مونوپولی، خیابان‌های تهران')}
${owners.concat(o.own ?? []).map(([i, w]) => own(i, w)).join('')}${(o.houses ?? [6, 8, 9, 1, 3]).map(house).join('')}${(o.hotels ?? []).map(hotel).join('')}
${o.me ? '' : `<i class="am-land" style="${at(104, y16)}"></i>${path.map(([x, y]) => `<i class="am-step" style="${at(x, y)}"></i>`).join('')}${tok(2, cxy(9)[0], cxy(9)[1] - 6, 'is-ghost', '')}`}
${tok(1, ...cxy(22).map((v, k) => v + (k ? 22 : 0)), '', 'ستاره روی شانس')}${tok(4, cxy(34)[0] + 22, cxy(34)[1], '', 'کیان روی صندوق')}${o.nJail === false ? '' : tok(7, 122, 986, '', 'نیلوفر در زندان')}
${o.me ? tok(2, o.me[0], o.me[1], 'is-me', o.meAlt ?? '') : `${tok(2, 66, y16, 'is-me', 'شما روی خیابان طالقانی')}<span class="am-tag" style="${at(238, y16)}">صاحب ندارد</span>`}${o.tag ? `<span class="am-tag" style="${at(...o.tag[0])}">${o.tag[1]}</span>` : ''}</div>`;
  const offer = `<figure class="am-offer">${img('amlak-deed-16', 'سند خیابان طالقانی: قیمت ۱۸۰ هزار تومان')}<figcaption><b>نارنجی کامل می‌شود</b><span>اجارهٔ زمین هر سه دو برابر و ساخت خانه آزاد</span></figcaption></figure>`;
  const dice = (ph) => `<span class="am-dice">${img('amlak-die-3', 'تاس ۳')}${img('amlak-die-4', 'تاس ۴')}</span>`;
  const above = (ph) => ph
    ? `<div class="am-ctl am-ctl--ph">${dice(true)}<span class="am-ctl__t"><b>۷ آوردید: طالقانی</b><small>${fa(180)} هزار تومان</small></span>${btn('خرید', 'primary', 'check')}${btn('مزایده', 'secondary', 'users')}</div>`
    : `<div class="am-ctl">${dice(false)}<span class="am-ctl__t"><b>۳ و ۴ آوردید؛ خیابان طالقانی</b><small>از پیروزی ۷ خانه جلو رفتید</small></span><span class="am-ctl__b">${btn(`خرید با ${fa(180)} هزار`, 'primary', 'check')}${btn('نمی‌خرم، مزایده', 'secondary', 'users')}</span></div>`;
  const cash = (k, n, props) => `<span class="am-sum">${img(`amlak-token-${k}`, '')}<b>${fa(n)}</b> هزار<span class="bgv-sep"></span>${fa(props)} ملک</span>`;
  const { modal } = H;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((c, k) => `<td${k ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const who = (seatN, name) => `<span class="am-who"><i style="background:var(--seat-${seatN})"></i>${name}</span>`;
  const houses = (n) => n ? `<span class="am-hs">${Array.from({ length: n }, () => img('amlak-house', '')).join('')}</span>` : '<span class="cx-note">زمین خالی</span>';
  // §4 auction (engine: everyone bids in turn, at least +1 over the top bid, capped by own cash; pass = out)
  const auction = (ph) => modal(`مزایدهٔ خیابان طالقانی`, `<div class="am-auc${ph ? ' am-auc--ph' : ''}">${img('amlak-deed-16', 'سند خیابان طالقانی، قیمت ۱۸۰')}<div class="am-auc__r">
<p class="am-ph-hide">بانک خیابان طالقانی را مزایده گذاشته است. همه، حتی کسی که نخرید، به نوبت پیشنهاد می‌دهند؛ هر پیشنهاد دست‌کم ${fa(1)} هزار بیشتر از بالاترین است.</p>
${tbl(['بازیکن', 'آخرین پیشنهاد', 'وضعیت'], [{ c: [who(3, 'ستاره'), `${fa(120)} هزار`, '<span class="gc-tag">بالاترین</span>'] }, { c: [who(2, 'کیان'), `${fa(90)} هزار`, 'کنار کشید'] }, { c: [who(6, 'نیلوفر'), `${fa(100)} هزار`, 'منتظر'] }, { c: [who(1, 'شما'), '—', '<b>نوبت شما</b>'], win: true }])}</div></div>
<div class="am-bid"><span class="am-bid__l">پیشنهاد شما</span><span class="am-step2">${ibtn('chevdown', 'کم کردن', 'secondary')}<b>${fa(130)}</b><small>هزار</small></span><span class="am-quick"><span class="bgv-chip">${fa(1)}+</span><span class="bgv-chip">${fa(10)}+</span><span class="bgv-chip">${fa(50)}+</span></span><span class="cx-note">کمترین ${fa(121)}، بیشترین ${fa(620)} (نقد شما)</span></div>`,
    `${btn('کنار می‌کشم', 'secondary', 'x')}${btn(`پیشنهاد ${fa(130)} هزار`, 'primary', 'check')}`);
  // §5 manage properties: build/sell evenly, mortgage/unmortgage, bank stock
  const manage = (ph) => modal('املاک شما', `<p>نارنجی کامل است، پس می‌توانید بسازید؛ ساخت باید یکنواخت باشد: روی هیچ خیابانی بیشتر از یک خانه از کمترینِ گروه جلو نمی‌افتید. هر خانه ${fa(100)} هزار است و به ${fa(50)} هزار فروخته می‌شود.</p>
${tbl(['ملک', 'ساختمان', 'ساخت / فروش', 'رهن'], [
      { c: ['طالقانی <small class="cx-note">نارنجی</small>', houses(1), `${btn(`ساخت ${fa(100)}`, 'primary', 'check', ' disabled')}${btn('فروش', 'secondary', 'chevdown')}`, `<span class="cx-note">اول خانه‌ها فروخته شود</span>`] },
      { c: ['مطهری <small class="cx-note">نارنجی</small>', houses(1), `${btn(`ساخت ${fa(100)}`, 'primary', 'check', ' disabled')}${btn('فروش', 'secondary', 'chevdown')}`, `<span class="cx-note">اول خانه‌ها فروخته شود</span>`] },
      { c: ['بهار <small class="cx-note">نارنجی</small>', houses(0), `${btn(`ساخت ${fa(100)}`, 'primary', 'check')}`, '<span class="cx-note">اول خانه‌ها فروخته شود</span>'] },
      { c: ['ایستگاه راه‌آهن', '—', '<span class="cx-note">ساختنی نیست</span>', btn(`رهن: ${fa(100)}+`, 'secondary', 'download')] },
      { c: ['سعادت‌آباد <span class="gc-tag gc-tag--soft">در رهن</span>', '—', '<span class="cx-note">گروه کامل نیست</span>', btn(`فک رهن: ${fa(143)}−`, 'secondary', 'undo')] },
    ])}
<div class="gc-pills"><span class="bgv-chip">${img('amlak-house', '')}بانک: ${fa(26)} خانه از ${fa(32)}</span><span class="bgv-chip">${img('amlak-hotel', '')}بانک: ${fa(12)} هتل از ${fa(12)}</span><span class="bgv-chip">نقد شما: ${fa(240)} هزار</span></div>
<p class="cx-note">بهار هنوز خانه ندارد، پس تا روی بهار نسازید خانهٔ دوم طالقانی و مطهری قفل است. وقتی هر سه چهار خانه داشتند ساخت بعدی هتل است و چهار خانه به بانک برمی‌گردد. اگر بانک خانه نداشته باشد ساخت بسته می‌شود. فک رهن یعنی نصف قیمت به‌اضافهٔ ${fa(10)}٪ بهره.</p>`,
    `${btn('بستن', 'secondary', 'x')}`);
  // §6 trade builder (turn player proposes; mortgaged deed costs the receiver 10% at once)
  const side2 = (title, deeds, cash, extra = '') => `<div class="am-tr__s"><h4>${title}</h4><div class="am-tr__d">${deeds.map(([a, alt, m]) => `<span class="am-tr__c${m ? ' is-m' : ''}">${img(a, alt)}${m ? '<span class="gc-tag gc-tag--soft">در رهن</span>' : ''}</span>`).join('')}</div><div class="am-tr__cash">نقد <b>${fa(cash)}</b> هزار</div>${extra}</div>`;
  const trade = (ph) => modal('پیشنهاد معامله به نیلوفر', `<div class="am-tr">${side2('شما می‌دهید', [['amlak-deed-26', 'سند سعادت‌آباد', true]], 100, `<span class="cx-note">کارت آزادی ندارید</span>`)}<span class="am-tr__x">${ic('repeat')}</span>${side2('شما می‌گیرید', [['amlak-deed-21', 'سند ملک قرمز نیلوفر']], 0, `<span class="bgv-chip">${img('amlak-ch-free', '')}کارت آزادی از زندان</span>`)}</div>
<div class="ga-rule">${ic('info')}<span>سعادت‌آباد در رهن است: اگر نیلوفر بپذیرد همان لحظه ${fa(13)} هزار (${fa(10)}٪ مبلغ رهن) بهره به بانک می‌دهد. ملکی که در گروهش ساختمان هست معامله نمی‌شود؛ برای همین سندهای نارنجی شما در فهرست نیست.</span></div>`,
    `${btn('لغو', 'secondary', 'x')}${btn('فرستادن پیشنهاد', 'primary', 'share')}`);
  // §7 incoming offer (phone): Kian offers to me
  const offerIn = (ph) => modal('کیان پیشنهاد معامله داده', `<div class="am-tr">${side2('کیان می‌دهد', [['amlak-deed-23', 'سند ملک قرمز']], 150)}<span class="am-tr__x">${ic('repeat')}</span>${side2('شما می‌دهید', [['amlak-deed-15', 'سند ایستگاه راه‌آهن']], 0)}</div><p class="cx-note">تا پایان نوبت کیان وقت دارید جواب بدهید.</p>`,
    `${btn('رد', 'secondary', 'x')}${btn('قبول', 'primary', 'check')}`);
  // §9 debt: rent 600 to Setareh (hotel on Pirouzi), cash 240 → short 360
  const debt = (ph) => modal('بدهی به ستاره', `<p>روی خیابان پیروزی با هتل ستاره نشستید: اجاره <b>${fa(600)}</b> هزار. نقد شما ${fa(240)} هزار است، یعنی <b>${fa(360)} هزار کم دارید</b>. خانه بفروشید یا ملک رهن بگذارید؛ همین که پول جور شد بدهی خودکار پرداخت می‌شود.</p>
${tbl(['چه چیزی', 'پول', ''], [
      { c: ['فروش ۲ خانهٔ نارنجی (یکنواخت)', `${fa(100)}+`, btn('فروش', 'secondary', 'chevdown')] },
      { c: ['رهن ایستگاه راه‌آهن', `${fa(100)}+`, btn('رهن', 'secondary', 'download')] },
      { c: ['رهن طالقانی (بعد از فروش خانه‌ها)', `${fa(90)}+`, btn('رهن', 'secondary', 'download', ' disabled')] },
      { c: ['رهن مطهری و بهار', `${fa(190)}+`, btn('رهن', 'secondary', 'download', ' disabled')] },
    ])}
<div class="gc-pills"><span class="bgv-chip">بیشترین پولی که جور می‌شود: ${fa(480)} هزار</span><span class="bgv-chip">کسری: ${fa(360)} هزار</span></div>
<p class="cx-note">اگر نتوانید یا نخواهید بپردازید، ورشکسته می‌شوید: ساختمان‌ها به نصف قیمت به بانک فروخته می‌شود و همهٔ پول و املاک به ستاره می‌رسد.</p>`,
    `${btn('اعلام ورشکستگی', 'leave', 'flag')}${btn('پرداخت', 'primary', 'check', ' disabled')}`);
  // §11 end (20-round variant): net worth = cash + printed price (half if mortgaged) + buildings
  const ending = (ph) => modal('پایان بازی: ۲۰ دور تمام شد', `<p>میز با محدودیت ${fa(20)} دور بود؛ برنده کسی است که بیشترین دارایی را دارد.</p>
${tbl(['رتبه', 'بازیکن', 'نقد', 'املاک', 'ساختمان', 'دارایی'], [
      { c: [fa(1), who(1, 'شما'), fa(860), fa(1180), fa(600), fa(2640)], win: true },
      { c: [fa(2), who(2, 'کیان'), fa(720), fa(1210), fa(300), fa(2230)] },
      { c: [fa(3), who(3, 'ستاره'), fa(410), fa(850), fa(450), fa(1710)] },
      { c: [fa(4), who(6, 'نیلوفر'), '—', '—', '—', 'ورشکسته در دور ۱۷'] },
    ])}<p class="cx-note">ملک در رهن نصف قیمت حساب می‌شود. دارایی برابر یعنی رتبهٔ مشترک؛ ورشکسته‌ها به ترتیب عکس ورشکستگی رتبه می‌گیرند.</p>`,
    `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const jailCtl = (ph) => `<div class="am-ctl${ph ? ' am-ctl--ph am-ctl--wrap' : ''}"><span class="am-ctl__t"><b>در زندانید</b><small>تلاش ${fa(2)} از ${fa(3)}<span class="am-tries"><i class="is-on"></i><i class="is-on"></i><i></i></span></small></span><span class="am-ctl__b">${btn(`${fa(50)} هزار بده`, 'secondary', 'check')}${btn('کارت آزادی', 'secondary', 'flip')}${btn('تاس برای جفت', 'primary', 'repeat')}</span></div>`;
  const myCards = [{ art: 'amlak-deed-15', alt: 'سند ایستگاه راه‌آهن' }, { art: 'amlak-deed-16', alt: 'سند خیابان طالقانی، نارنجی' }, { art: 'amlak-deed-18', alt: 'سند خیابان مطهری، نارنجی' }, { art: 'amlak-deed-19', alt: 'سند خیابان بهار، نارنجی' }, { art: 'amlak-deed-26', alt: 'سند سعادت‌آباد، در رهن', dim: true }];
  const noteMe = (n, p) => `<span class="am-sum am-sum--me">${img('amlak-token-2', '')}نقد <b>${fa(n)}</b> هزار<span class="bgv-sep"></span>${fa(p)} ملک</span>`;
  const OWN16 = [[16, 'me']];
  const railMe = `<section class="cx-card"><h3>دارایی شما<span class="bgv-spacer"></span><span class="cx-note">آبی</span></h3><div class="gc-pills"><span class="bgv-chip">نقد: ${fa(240)} هزار</span><span class="bgv-chip">نارنجی: کامل</span><span class="bgv-chip">در رهن: ${fa(1)}</span></div></section>`;
  const B2 = (o) => (ph) => board(ph, { own: OWN16, houses: [6, 8, 9, 1, 3, 16, 18], ...o });  return {
    slug: 'Amlak', fa: 'مونوپولی', latin: 'Monopoly', meta: ['زنده', '۴ نفر', 'دور ۹'],
    opps: [
      { name: 'ستاره', av: 'س', seat: 3, clock: '1:00', meta: cash(1, 410, 4) },
      { name: 'کیان', av: 'ک', seat: 2, clock: '1:00', meta: cash(4, 530, 5) },
      { name: 'نیلوفر', av: 'ن', seat: 6, clock: '1:00', meta: `${cash(7, 380, 7)}<span class="gc-tag gc-tag--soft">زندان</span>` },
    ],
    me: {
      cards: [
        { art: 'amlak-deed-15', alt: 'سند ایستگاه راه‌آهن' },
        { art: 'amlak-deed-18', alt: 'سند خیابان مطهری، نارنجی', ok: true },
        { art: 'amlak-deed-19', alt: 'سند خیابان بهار، نارنجی', ok: true },
        { art: 'amlak-deed-26', alt: 'سند سعادت‌آباد' },
      ],
      clock: '0:42', turn: true, note: `<span class="am-sum am-sum--me">${img('amlak-token-2', '')}نقد <b>${fa(620)}</b> هزار<span class="bgv-sep"></span>${fa(4)} ملک</span>`, above,
    },
    cardW: 100, phoneCardW: 62, cardRatio: 1,
    table: (ph) => ph ? board(true) : `${board(false)}${offer}`,
    status: '<b>نوبت شماست؛ ۷ آوردید.</b> خیابان طالقانی صاحب ندارد. با ۱۸۰ هزار تومان بخرید یا بگذارید مزایده شود؛ مطهری و بهار مال شماست، پس با این خرید نارنجی کامل می‌شود.',
    pstatus: '<b>نوبت شما.</b> طالقانی صاحب ندارد؛ بخرید یا مزایده کنید.',
    railCard: `<section class="cx-card"><h3>دارایی شما<span class="bgv-spacer"></span><span class="cx-note">آبی</span></h3><div class="gc-pills"><span class="bgv-chip">نقد: ${fa(620)} هزار</span><span class="bgv-chip">نارنجی: ${fa(2)} از ${fa(3)}</span><span class="bgv-chip">ایستگاه: ${fa(1)} از ${fa(4)}</span></div><div class="ga-rule">${ic('info')}<span>اگر نخرید، ملک بین همه مزایده می‌شود و شما هم می‌توانید پیشنهاد بدهید. با سه خیابان هم‌رنگ اجارهٔ زمین دو برابر می‌شود و بعد از خرید، همین نوبت می‌توانید خانه بسازید (هر خانه ۱۰۰ هزار).</span></div></section>`,
    logNote: 'دور ۹',
    log: [[3, 'ستاره روی شانس نشست و ۵۰ هزار سود سهام گرفت'], [2, 'کیان روی صندوق نشست و ۲۵ هزار حق مشاوره گرفت'], [6, 'نیلوفر روی «برو به زندان» نشست'], [1, 'شما ۳ و ۴ آوردید؛ خیابان طالقانی صاحب ندارد']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['list', 'املاک'], ['chat', 'گفت‌وگو'], ['repeat', 'معامله'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'مزایده', turnSub: 'نخریدید؛ همه به نوبت پیشنهاد می‌دهند', phone: true,
        overlay: auction, me: { above: () => '' },
        status: '<b>مزایدهٔ خیابان طالقانی.</b> ستاره ۱۲۰ هزار پیشنهاد داده و کیان کنار کشیده. نوبت شماست: دست‌کم ۱۲۱ هزار بگویید یا کنار بکشید.',
        pstatus: '<b>مزایده.</b> بالاترین: ستاره، ۱۲۰ هزار.',
        log: [[1, 'شما طالقانی را نخریدید؛ مزایده شروع شد'], [2, 'کیان ۹۰ هزار گفت و بعد کنار کشید'], [6, 'نیلوفر ۱۰۰ هزار گفت'], [3, 'ستاره ۱۲۰ هزار گفت'], [1, 'نوبت پیشنهاد شما']],
      },
      {
        shotTitle: 'مدیریت املاک', turnSub: 'ساخت و فروش یکنواخت، رهن و فک رهن',
        table: B2({ me: [66, y16], meAlt: 'شما روی طالقانی' }), overlay: manage,
        me: { above: () => '', cards: myCards, note: noteMe(240, 5) },
        railCard: railMe,
        status: '<b>طالقانی را خریدید و دو خانه ساختید.</b> نارنجی کامل است؛ خانهٔ بعدی باید روی بهار برود. سعادت‌آباد در رهن است.',
        log: [[1, 'شما طالقانی را ۱۸۰ هزار خریدید'], [1, 'شما روی طالقانی یک خانه ساختید'], [1, 'شما روی مطهری یک خانه ساختید']],
      },
      {
        shotTitle: 'پیشنهاد معامله', turnSub: 'ساختن پیشنهاد برای یک بازیکن',
        table: B2({ me: [66, y16], meAlt: 'شما روی طالقانی' }), overlay: trade,
        me: { above: () => '', cards: myCards, note: noteMe(240, 5) },
        railCard: railMe,
        status: '<b>معامله با نیلوفر.</b> سعادت‌آباد (در رهن) و ۱۰۰ هزار نقد می‌دهید و یک ملک قرمز و کارت آزادی او را می‌گیرید.',
        log: [[1, 'شما روی مطهری یک خانه ساختید'], [1, 'شما دارید پیشنهاد معامله به نیلوفر را می‌سازید']],
      },
      {
        shotTitle: 'پیشنهاد رسیده', turnSub: 'قبول یا رد در گوشی', phone: true, phoneOnly: true,
        table: B2({ me: [66, y16], meAlt: 'شما روی طالقانی' }), overlay: offerIn,
        me: { turn: false, above: () => '', cards: myCards, note: noteMe(240, 5) },
        railCard: railMe,
        pstatus: '<b>نوبت کیان.</b> برایتان پیشنهاد معامله آمده.',
        status: '<b>نوبت کیان است.</b> کیان یک ملک قرمز و ۱۵۰ هزار را در برابر ایستگاه راه‌آهن شما پیشنهاد داده.',
      },
      {
        shotTitle: 'در زندان', turnSub: '۵۰ هزار، کارت آزادی یا تاس برای جفت',
        table: B2({ me: [150, 962], meAlt: 'شما در زندان' }),
        me: { above: jailCtl, cards: myCards, note: noteMe(240, 5) },
        railCard: railMe,
        status: '<b>نوبت شماست و در زندانید (تلاش دوم).</b> پیش از تاس می‌توانید ۵۰ هزار بدهید یا کارت آزادی را بازی کنید و عادی حرکت کنید. اگر تاس بریزید و جفت بیاید آزاد می‌شوید و همان عدد را می‌روید، ولی تاس دوباره ندارید. در تلاش سوم اگر جفت نیاید ۵۰ هزار می‌دهید و حرکت می‌کنید.',
        pstatus: '<b>در زندانید، تلاش ۲ از ۳.</b>',
        railCard: `<section class="cx-card"><h3>دارایی شما<span class="bgv-spacer"></span><span class="cx-note">آبی</span></h3><div class="gc-pills"><span class="bgv-chip">نقد: ${fa(240)} هزار</span><span class="bgv-chip">${img('amlak-ch-free', '')}کارت آزادی: ${fa(1)}</span></div><div class="ga-rule">${ic('info')}<span>در زندان هم اجاره می‌گیرید، می‌سازید و معامله می‌کنید.</span></div></section>`,
        log: [[1, 'شما با کارت شانس به زندان رفتید'], [1, 'تلاش اول: ۲ و ۵، جفت نیامد'], [1, 'نوبت شما: تلاش دوم']],
      },
      {
        shotTitle: 'بدهی', turnSub: 'پول کم است: فروش، رهن یا ورشکستگی',
        table: (ph) => board(ph, { own: OWN16, houses: [6, 8, 1, 3, 16, 18], hotels: [9], me: [cxy(9)[0], cxy(9)[1] - 6], meAlt: 'شما روی خیابان پیروزی' }), overlay: debt,
        me: { above: () => '', cards: myCards, note: noteMe(240, 5) },
        railCard: railMe,
        status: '<b>۶۰۰ هزار به ستاره بدهکارید و ۲۴۰ هزار نقد دارید.</b> تا ۳۶۰ هزار جور نکنید نوبت جلو نمی‌رود.',
        log: [[1, 'شما ۴ و ۵ آوردید: خیابان پیروزی'], [3, 'اجارهٔ هتل ستاره: ۶۰۰ هزار'], [1, 'بدهی: ۳۶۰ هزار کم دارید']],
      },
      {
        shotTitle: 'کارت شانس', turnSub: 'کارت کشیده‌شده و اثرش؛ صندوق پارکینگ و دورهای مانده',
        meta: ['زنده', '۴ نفر', 'دور ۹ از ۲۰'],
        table: (ph) => `${B2({ me: [cxy(7)[0], cxy(7)[1] - 6], meAlt: 'شما روی شانس' })(ph)}${ph ? '' : `<figure class="am-drawn">${img('amlak-ch-repairs', 'کارت شانس: تعمیرات ساختمان‌ها')}<figcaption><b>تعمیرات ساختمان‌ها</b><span>برای هر خانه ${fa(25)} و هر هتل ${fa(100)} هزار</span><span class="am-drawn__e">${fa(2)} خانه: ${fa(50)} هزار پرداخت شد</span></figcaption></figure>`}`,
        me: { above: (ph) => ph ? `<div class="am-ctl am-ctl--ph am-drawn-ph">${img('amlak-ch-repairs', 'کارت شانس: تعمیرات')}<span class="am-ctl__t"><b>تعمیرات: ${fa(50)} هزار</b><small>${fa(2)} خانه، هر کدام ${fa(25)}</small></span></div>` : '', cards: myCards, note: noteMe(190, 5) },
        phone: true,
        status: '<b>کارت شانس: تعمیرات ساختمان‌ها.</b> برای ۲ خانه ۵۰ هزار دادید و کارت زیر دسته رفت. چون جایزهٔ پارکینگ روشن است، این پول به صندوق وسط رفت.',
        pstatus: '<b>شانس:</b> تعمیرات، ۵۰ هزار.',
        railCard: `<section class="cx-card"><h3>میز<span class="bgv-spacer"></span><span class="cx-note">${fa(11)} دور مانده</span></h3><div class="gc-pills"><span class="bgv-chip">صندوق پارکینگ: ${fa(325)} هزار</span><span class="bgv-chip">دور ${fa(9)} از ${fa(20)}</span><span class="bgv-chip">${img('amlak-ch-free', '')}کارت آزادی شما: ${fa(1)}</span></div><div class="ga-rule">${ic('info')}<span>جایزهٔ پارکینگ در این میز روشن است: مالیات‌ها و پرداخت‌های کارت در صندوق وسط جمع می‌شود و هر کس روی پارکینگ بایستد همه را برمی‌دارد.</span></div></section>`,
        log: [[1, 'شما ۳ و ۴ آوردید: شانس'], [1, 'کارت شانس: تعمیرات، ۵۰ هزار'], [1, 'صندوق پارکینگ: ۳۲۵ هزار']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'رتبه‌ها و جدول دارایی',
        meta: ['تمام شد', '۴ نفر', 'دور ۲۰ از ۲۰'],
        table: (ph) => board(ph, { own: OWN16, houses: [6, 8, 1, 3], hotels: [9, 16, 18, 19], me: [1008, 1008], meAlt: 'شما روی شروع', nJail: false }), overlay: ending,
        opps: [
          { name: 'ستاره', av: 'س', seat: 3, meta: cash(1, 410, 4) },
          { name: 'کیان', av: 'ک', seat: 2, meta: cash(4, 720, 6) },
          { name: 'نیلوفر', av: 'ن', seat: 6, out: true, meta: '<span class="gc-tag gc-tag--soft">ورشکسته</span>' },
        ],
        me: { turn: false, clock: '', above: () => '', cards: myCards, note: noteMe(860, 6) },
        railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۲۶۴۰ هزار دارایی اول شدید.',
        log: [[6, 'نیلوفر در دور ۱۷ ورشکسته شد'], [1, 'دور ۲۰ تمام شد'], [1, 'شما با بیشترین دارایی بردید']],
      },
    ],    css: `.am-board{position:relative;direction:ltr;inline-size:var(--bw,452px);aspect-ratio:1;flex:none;filter:drop-shadow(0 16px 22px rgba(0,0,0,.55))}
.am-board>img{display:block;inline-size:100%;block-size:100%}
.am-board--ph{--bw:360px}
.am-own,.am-house,.am-tok,.am-land,.am-step,.am-tag{position:absolute;transform:translate(-50%,-50%)}
.am-own{display:block;background:var(--c);-webkit-mask:var(--m) center/100% 100% no-repeat;mask:var(--m) center/100% 100% no-repeat}.am-own img{display:block;inline-size:100%;block-size:100%;mix-blend-mode:multiply}
.am-own--h{inline-size:calc(var(--bw,452px)*.05);block-size:calc(var(--bw,452px)*.025)}.am-own--v{inline-size:calc(var(--bw,452px)*.05);block-size:calc(var(--bw,452px)*.025);rotate:90deg}
.am-house{inline-size:calc(var(--bw,452px)*.026)}.am-house img{display:block;inline-size:100%;block-size:auto}
.am-tok{inline-size:calc(var(--bw,452px)*.05)}.am-tok img{display:block;inline-size:100%;block-size:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.am-tok.is-me{inline-size:calc(var(--bw,452px)*.062)}.am-tok.is-ghost{opacity:.45}
.am-land{inline-size:calc(var(--bw,452px)*.128);block-size:calc(var(--bw,452px)*.076);border-radius:4px;box-shadow:inset 0 0 0 2.5px var(--felt-gold),0 0 0 2px #142B3B,0 0 14px 3px rgba(232,166,66,.55)}
.am-step{inline-size:calc(var(--bw,452px)*.012);aspect-ratio:1;border-radius:50%;background:#142B3B;opacity:.6}
.am-tag{padding:0 7px 0 12px;clip-path:polygon(10px 0,100% 0,100% 100%,10px 100%,0 50%);border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:11px;font-weight:800;line-height:18px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.45)}
.am-board--ph .am-tag{font-size:9px;line-height:14px;padding:0 5px}.am-board--ph .am-land{box-shadow:inset 0 0 0 2px var(--felt-gold),0 0 0 1.5px #142B3B}
.am-offer{margin:0;display:grid;gap:8px;justify-items:center;inline-size:208px;color:var(--felt-ink)}
.am-offer img{inline-size:100%;block-size:auto;border-radius:8px;box-shadow:0 0 0 3px var(--felt-gold),0 14px 22px -10px rgba(0,0,0,.7);transform:rotate(-2deg)}
.am-offer figcaption{display:grid;gap:2px;text-align:center;font-size:12.5px;color:var(--felt-muted);line-height:1.6}.am-offer figcaption b{color:var(--felt-ink);font-size:14px}
.am-sum{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.am-sum img{inline-size:16px;block-size:auto}.am-sum b{color:var(--felt-ink)}
.cx-pbar .am-sum b{color:inherit}
.am-ctl{display:flex;align-items:center;gap:12px;inline-size:100%;padding:8px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.am-dice{display:inline-flex;gap:6px;flex:none}.am-dice img{inline-size:40px;block-size:40px;filter:drop-shadow(0 4px 4px rgba(0,0,0,.45))}.am-dice img:first-child{transform:rotate(-9deg)}.am-dice img:last-child{transform:rotate(7deg)}
.am-ctl__t{display:grid;gap:2px;flex:1;font-size:15px;white-space:nowrap}.am-ctl__t small{font-size:12px;color:var(--felt-muted)}
.am-ctl__b{display:flex;gap:8px}
.am-ctl--ph{margin-inline:10px;inline-size:auto;padding:6px 8px;gap:8px}.am-ctl--ph .am-dice{gap:3px}.am-ctl--ph .am-dice img{inline-size:28px;block-size:28px}.am-ctl--ph .am-ctl__t{font-size:13px}.am-ctl--ph .am-ctl__t small{font-size:11px}
.am-ctl--ph .bgv-btn{padding-inline:10px}
.cx-phone .gc-hand{padding-block-start:10px}
.am-house--h{inline-size:calc(var(--bw,452px)*.034)}
.am-who{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.am-who i{inline-size:10px;block-size:10px;border-radius:50%}
.am-hs{display:inline-flex;gap:2px}.am-hs img{inline-size:16px;block-size:auto}
.am-auc{display:grid;grid-template-columns:118px minmax(0,1fr);gap:14px;align-items:start}.am-auc>img{inline-size:100%;block-size:auto;border-radius:6px;box-shadow:0 6px 12px -6px rgba(0,0,0,.5)}.am-auc__r{display:grid;gap:10px}
.am-bid{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);background:var(--surface-sunken)}
.am-bid__l{font-weight:700;color:var(--heading)}
.am-step2{display:inline-flex;align-items:center;gap:6px}.am-step2 b{font-size:22px;color:var(--heading);min-inline-size:44px;text-align:center}.am-step2 small{color:var(--text-muted)}
.am-quick{display:inline-flex;gap:6px}
.am-auc--ph{grid-template-columns:1fr}.am-auc--ph>img{display:none}.cx-phone .am-ph-hide{display:none}.cx-phone .gd-score th,.cx-phone .gd-score td{padding:5px 4px;font-size:12.5px}
.gd-modal__box .bgv-btn{white-space:nowrap}
.gd-score td .bgv-btn{block-size:32px;padding-inline:10px;font-size:13px;margin-inline-end:4px}
.gd-modal__box .bgv-chip img{inline-size:16px;block-size:auto;margin-inline-end:4px}
.am-tr{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center}
.am-tr__s{display:grid;gap:8px;justify-items:center;padding:10px;border-radius:var(--radius-sm);background:var(--surface-sunken);align-self:stretch;align-content:start}
.am-tr__s h4{margin:0;font-size:14px;color:var(--heading)}
.am-tr__d{display:flex;gap:6px;justify-content:center}.am-tr__c{position:relative;display:grid;justify-items:center;gap:4px}.am-tr__c img{inline-size:96px;block-size:auto;border-radius:5px}.am-tr__c.is-m img{filter:grayscale(.6)}
.am-tr__cash{font-size:13px}.am-tr__cash b{font-size:16px;color:var(--heading)}
.am-tr__x .bgv-icon{inline-size:26px;block-size:26px;color:var(--link)}
.am-tries{display:inline-flex;gap:4px;margin-inline-start:8px;vertical-align:middle}.am-tries i{inline-size:9px;block-size:9px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--felt-muted)}.am-tries i.is-on{background:var(--felt-gold);box-shadow:none}
.am-ctl--wrap{flex-wrap:wrap}.am-ctl--wrap .am-ctl__b{flex-wrap:wrap;gap:6px}
.am-drawn{margin:0;display:grid;gap:8px;justify-items:center;inline-size:220px;color:var(--felt-ink)}
.am-drawn img{inline-size:100%;block-size:auto;border-radius:6px;box-shadow:0 0 0 3px var(--felt-gold),0 14px 22px -10px rgba(0,0,0,.7)}
.am-drawn figcaption{display:grid;gap:2px;text-align:center;font-size:12.5px;color:var(--felt-muted);line-height:1.6}.am-drawn figcaption b{color:var(--felt-ink);font-size:14px}
.am-drawn__e{color:var(--felt-gold);font-weight:700}
.am-drawn-ph img{inline-size:96px;block-size:auto;border-radius:4px}
.cx-rail .bgv-chip img{inline-size:22px;block-size:auto;margin-inline-end:4px}`,
    shotTitle: 'نوبت شما', turnSub: 'ملک بی‌صاحب: خرید یا مزایده',
    diffs: [
      ['صفحه و سندها', 'وسط میز صفحهٔ آمادهٔ خیابان‌های تهران و کنارش سند ملکی که رویش ایستاده‌اید؛ دست شما سندهای خودتان است. سندهای هم‌رنگ با ملک تازه حلقهٔ طلایی دارند'],
      ['تاس و تصمیم', 'دو تاس آماده بالای نوار شما با دو دکمه: خرید با قیمت سند، یا «نمی‌خرم، مزایده». در این لحظه موتور فقط همین دو کار را قبول می‌کند؛ ساخت و معامله بعد از تصمیم باز می‌شود'],
      ['مسیر حرکت', 'مهرهٔ شما روی طالقانی، جای قبلی کم‌رنگ و خانه‌های بین راه نقطه‌چین؛ خانهٔ مقصد قاب طلایی و برچسب «صاحب ندارد» دارد'],
      ['مالکیت', 'روی لبهٔ بیرونی هر خانهٔ مالک‌دار یک نشان بیضی به رنگ صندلی صاحبش؛ نشان از روی پایهٔ مهره‌های همین بازی ساخته شده (owners/owner-marker.png)'],
      ['چیپ حریف‌ها', 'مهرهٔ هر نفر، پول نقد (هزار تومان) و تعداد ملک؛ کسی که در زندان است برچسب دارد. در گوشی جای سند بزرگ، فهرست املاک در نوار پایین است'],
      ['قوانین', 'مثل موتور: ۲ تا ۸ نفر، ۱۵۰۰ شروع و ۲۰۰ حقوق، مزایده پیش‌فرض روشن، اجارهٔ دو برابر با گروه کامل، ساخت یکنواخت، رهن ۱۰٪ بهره، سه جفت پشت سر هم یعنی زندان'],
    ],
  };
}
