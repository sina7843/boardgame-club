// Carcassonne on the group D frame (repo engine: 2–5 players, base game without farmers). BGA second-edition tiles, BGA meeples.
// Mock map (x,y grid, tile type, rotation ×90° clockwise) checked edge by edge below. Players: you blue (seat 1), Niloufar yellow (seat 2), Reza green (seat 6).
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  // unrotated edges [N,E,S,W]: C city, R road, F field (second-edition art)
  const EDGE = { 4: 'CFFC', 22: 'CFFF', 36: 'CRFR', 40: 'RFRF', 48: 'FFRR', 57: 'FRRR', 62: 'FFFF' };
  const NAME = { 4: 'شهر دوطرفه', 22: 'تکه شهر', 36: 'کاشی شروع', 40: 'جادهٔ راست', 48: 'جادهٔ پیچ', 57: 'سه‌راهی', 62: 'صومعه' };
  const edges = (t, r) => { const e = EDGE[t]; return [0, 1, 2, 3].map((d) => e[(d - r + 4) % 4]); };
  const BASE = [[-1, -1, 62, 0], [0, -1, 22, 2], [1, -1, 22, 1], [2, -1, 4, 0], [-1, 0, 57, 0], [0, 0, 36, 0], [1, 0, 40, 1], [2, 0, 48, 0], [-1, 1, 40, 0], [2, 1, 40, 0]];
  const check = (tiles) => { const at = new Map(tiles.map((t) => [`${t[0]},${t[1]}`, t])); for (const [x, y, t, r] of tiles) { const e = edges(t, r); [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]].forEach(([dx, dy, a, b]) => { const n = at.get(`${x + dx},${y + dy}`); if (n && edges(n[2], n[3])[b] !== e[a]) console.warn('carcassonne mock edge mismatch', x, y, dx, dy); }); } };
  check(BASE); check([...BASE, [0, 1, 48, 3]]); check([...BASE, [0, 1, 48, 3], [2, -2, 22, 2]]);
  // meeple spots in unrotated tile coordinates (0..1)
  const rot = ([x, y], r) => { for (let k = 0; k < r; k++) [x, y] = [1 - y, x]; return [x, y]; };
  const SPOT = { road40: [.5, .5], city4: [.3, .28], mon62: [.5, .55], road48: [.3, .72], city22: [.5, .18] };
  const MEEP = { b: [[1, 0, 40, 1, 'road40']], y: [[2, -1, 4, 0, 'city4']], g: [[-1, -1, 62, 0, 'mon62']] };
  const grid = (o, S) => {
    const tiles = o.tiles ?? BASE; const x0 = -2, y0 = -2, W = 6, Hh = 5;
    const pos = (x, y) => `left:${(x - x0) * S}px;top:${(y - y0) * S}px`;
    let h = `<div class="cc-grid" style="--s:${S}px;width:${W * S}px;height:${Hh * S}px" role="img" aria-label="نقشهٔ کاشی‌ها">`;
    for (const [x, y] of o.spots ?? []) h += `<i class="cc-spot" style="${pos(x, y)}"></i>`;
    for (const [x, y, t, r] of tiles) h += `<img class="cc-t" style="${pos(x, y)};transform:rotate(${r * 90}deg)" src="${H.ART['cc-t' + t]}" alt="${NAME[t]}">`;
    if (o.place) { const [x, y, t, r] = o.place; h += `<img class="cc-t is-new" style="${pos(x, y)};transform:rotate(${r * 90}deg)" src="${H.ART['cc-t' + t]}" alt="کاشی تازه">`; }
    for (const [x, y, cls] of o.frames ?? []) h += `<i class="cc-frame ${cls}" style="${pos(x, y)}"></i>`;
    for (const [p, list] of Object.entries(o.meeples ?? MEEP)) for (const [x, y, , r, s] of list) { const [mx, my] = rot(SPOT[s], r); h += `<img class="cc-m" style="left:${(x - x0 + mx) * S}px;top:${(y - y0 + my) * S}px" src="${H.ART['cc-m-' + p]}" alt="پیاده">`; }
    for (const [x, y, r, s] of o.ghostM ?? []) { const [mx, my] = rot(SPOT[s], r); h += `<img class="cc-m is-ghost" style="left:${(x - x0 + mx) * S}px;top:${(y - y0 + my) * S}px" src="${H.ART['cc-m-b']}" alt="جای پیاده">`; }
    for (const [x, y, t] of o.pops ?? []) h += `<b class="cc-pop" style="left:${(x - x0 + .5) * S}px;top:${(y - y0 + .1) * S}px">${t}</b>`;
    return h + '</div>';
  };
  const SPOTS1 = [[0, 1], [1, 1], [-2, 0], [3, 0], [-1, 2], [2, 2], [-1, -2], [0, -2], [1, -2]];
  const drawn = (t, r, left, ph, extra = '') => `<div class="cc-draw"><small>کاشی شما</small><span class="cc-big">${img('cc-t' + t, NAME[t])}</span>${ph ? '' : `<span class="cc-left">${img('cc-back', '')}${fa(left)} کاشی مانده</span>`}${extra}</div>`;
  const table = (o) => (ph) => `${grid(o, ph ? 58 : 80)}${ph ? '' : drawn(o.cur ?? 48, 0, o.left ?? 52, ph)}`;
  const meeples = (n, c) => `<span class="cc-meeps" aria-label="${fa(n)} پیادهٔ آزاد">${Array.from({ length: 7 }, (_, k) => `<img class="${k < n ? '' : 'is-used'}" src="${H.ART['cc-m-' + c]}" alt="">`).join('')}</span>`;
  const above = (o) => (ph) => `<div class="cc-me${ph ? ' cc-me--ph' : ''}">${ph && o.cur !== false ? `<span class="cc-pdraw">${img('cc-t' + (o.cur ?? 48), 'کاشی شما')}</span>` : ''}${o.acts ? `<div class="cc-acts">${o.acts(ph)}</div>` : ''}${ph ? '' : meeples(o.free ?? 6, 'b')}</div>`;
  const opps = (turn, o = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:50', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${fa(o.n ?? 18)} امتیاز</span>${meepsMini(o.nf ?? 6, 'y')}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', turn: turn === 6, meta: `<span class="gc-tag gc-tag--soft">${fa(o.r ?? 14)} امتیاز</span>${meepsMini(o.rf ?? 6, 'g')}` },
  ];
  const meepsMini = (n, c) => `<span class="cc-mm">${img('cc-m-' + c, '')}${fa(n)}</span>`;
  const rail = `<section class="cx-card"><h3>امتیازها</h3><div class="ga-rule">${ic('info')}<span>جادهٔ کامل: هر کاشی ${fa(1)}. شهر کامل: هر کاشی و هر سپر ${fa(2)}. صومعهٔ کامل (با ${fa(8)} کاشی دورش): ${fa(9)}. آخر بازی، سازهٔ ناقص: جاده و صومعه هر کاشی ${fa(1)}، شهر هر کاشی و سپر ${fa(1)}. کشاورز در این نسخه نیست.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const PLACED = [...BASE, [0, 1, 48, 3]];
  return {
    slug: 'Carcassonne', fa: 'کارکاسون', latin: 'Carcassonne', meta: ['زنده', '۳ نفر', 'کاشی ۲۰ از ۷۲'],
    opps: opps(1),
    me: { cards: [], clock: '0:55', turn: true, note: `<span class="cx-note">${fa(12)} امتیاز</span>`, above: above({ acts: (ph) => `${btn('چرخاندن', 'secondary', 'repeat')}${btn(ph ? 'تأیید' : 'تأیید جا', 'primary', 'check')}` }) },
    table: table({ spots: SPOTS1, place: [0, 1, 48, 3], frames: [[0, 1, 'is-sel']] }),
    status: `<b>نوبت شماست: کاشی را بگذارید.</b> خانه‌های خط‌چین جای مجازند. کاشی جادهٔ پیچ را زیر کاشی شروع گذاشتید؛ با «چرخاندن» جهت‌های مجاز دیگر را ببینید و بعد «تأیید جا».`,
    pstatus: '<b>گذاشتن کاشی.</b> یک خانهٔ خط‌چین را بزنید.',
    railCard: rail, logNote: `کاشی ${fa(20)}`,
    log: [[2, 'نیلوفر کاشی شهر گذاشت و پیاده‌اش را روی شهر نشاند'], [6, 'رضا کاشی جاده گذاشت'], [1, 'کاشی شما: جادهٔ پیچ']],
    dockItems: [['repeat', 'چرخاندن'], ['list', 'رویدادها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'گذاشتن پیاده', turnSub: 'گام دوم نوبت',
        table: table({ tiles: PLACED, ghostM: [[0, 1, 3, 'road48']], frames: [[0, 1, 'is-sel']] }),
        me: { above: above({ cur: false, acts: (ph) => `${btn('بدون پیاده', 'secondary', 'x')}${btn('گذاشتن پیاده', 'primary', 'check')}` }) },
        status: '<b>پیاده می‌گذارید؟</b> روی کاشی تازه فقط جاده آزاد است (کشاورز در این نسخه نیست). نقطهٔ کم‌رنگ را بزنید، یا «بدون پیاده».',
        log: [[1, 'شما کاشی جادهٔ پیچ را گذاشتید']],
      },
      {
        shotTitle: 'امتیاز سازهٔ کامل', turnSub: 'شهر نیلوفر بسته شد',
        opps: opps(2, { n: 24, nf: 7 }),
        table: table({ tiles: [...PLACED, [2, -2, 22, 2]], meeples: { b: [[1, 0, 40, 1, 'road40'], [0, 1, 48, 3, 'road48']], g: MEEP.g }, frames: [[1, -1, 'is-done'], [2, -1, 'is-done'], [2, -2, 'is-done']], pops: [[2, -1, `${fa(6)}+`]], left: 50 }),
        me: { turn: false, above: above({ cur: false, free: 5 }) },
        status: '<b>نیلوفر شهرش را بست.</b> شهر سه‌کاشی بی‌سپر: ${fa(6)} امتیاز برای نیلوفر، و پیاده‌اش به دستش برمی‌گردد.'.replace('${fa(6)}', fa(6)),
        log: [[2, 'نیلوفر کاشی شهر گذاشت'], [2, 'شهر کامل شد: نیلوفر ۶+']],
      },
      {
        shotTitle: 'کاشی بی‌جا', turnSub: 'هیچ خانه‌ای جا ندارد',
        table: table({ tiles: PLACED, cur: 4, left: 49 }),
        me: { above: above({ cur: 4, acts: () => `<span class="cc-msg">${ic('info')}این کاشی هیچ‌جای نقشه جا نمی‌شود؛ کنار رفت و کاشی تازه می‌کشید.</span>` }) },
        status: '<b>این کاشی جا نمی‌شود.</b> هیچ خانه‌ای با هیچ چرخشی با لبه‌هایش جور نیست؛ کاشی کنار رفت و یک کاشی دیگر برایتان کشیده شد.',
        log: [[1, 'کاشی شهر دوطرفه جا نشد و کنار رفت']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر رضا',
        opps: opps(6),
        table: table({ tiles: PLACED, frames: [[0, 1, 'is-last']], cur: 57, left: 51 }),
        me: { turn: false, above: above({ cur: false, free: 5 }) },
        status: '<b>نوبت رضا است.</b> کاشی‌ای که در دست اوست کنار نقشه دیده می‌شود. آخرین کاشی گذاشته‌شده قاب رنگ صاحبش را دارد. نقشه را می‌توانید جابه‌جا و بزرگ کنید.',
        log: [[1, 'شما پیاده‌تان را روی جاده گذاشتید'], [6, 'نوبت رضا']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'سازه‌های ناقص و برنده',
        opps: opps(0, { n: 71, r: 64 }),
        table: table({ tiles: PLACED, frames: [[1, 0, 'is-done'], [2, 0, 'is-done'], [2, 1, 'is-done']], pops: [[2, 0, `${fa(4)}+`]], left: 0 }),
        me: { turn: false, clock: '', above: above({ cur: false, free: 7 }), note: `<span class="cx-note">${fa(78)} امتیاز</span>` },
        overlay: () => modal('شما با ۷۸ امتیاز بردید', tbl(['بازیکن', 'در بازی', 'جادهٔ ناقص', 'شهر ناقص', 'صومعهٔ ناقص', 'جمع'], [{ c: ['شما', fa(66), `${fa(4)}+`, `${fa(6)}+`, `${fa(2)}+`, fa(78)], win: true }, { c: ['نیلوفر', fa(59), `${fa(3)}+`, `${fa(9)}+`, '—', fa(71)] }, { c: ['رضا', fa(52), '—', `${fa(5)}+`, `${fa(7)}+`, fa(64)] }]) + '<p class="cx-note">کاشی‌ها تمام شد. سازه‌های ناقص یکی‌یکی روی نقشه روشن شدند. تساوی: برد مشترک.</p>', `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        status: '<b>بازی تمام شد.</b> کاشی‌ها تمام شد و سازه‌های ناقص حساب شدند.',
        log: [[1, 'جادهٔ ناقص شما: ۴+'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{gap:18px}
.cc-grid{position:relative;flex:none;border-radius:6px;background:repeating-linear-gradient(0deg,transparent 0 calc(var(--s) - 1px),rgba(250,245,236,.06) calc(var(--s) - 1px) var(--s)),repeating-linear-gradient(90deg,transparent 0 calc(var(--s) - 1px),rgba(250,245,236,.06) calc(var(--s) - 1px) var(--s))}
.cc-t{position:absolute;inline-size:var(--s);block-size:var(--s);box-shadow:0 1px 2px rgba(0,0,0,.5)}
.cc-t.is-new{box-shadow:0 0 0 3px var(--felt-gold),0 6px 12px rgba(0,0,0,.5);z-index:1}
.cc-spot{position:absolute;inline-size:var(--s);block-size:var(--s);box-sizing:border-box;border:2px dashed rgba(232,166,66,.85);border-radius:4px;background:rgba(232,166,66,.1)}
.cc-frame{position:absolute;inline-size:var(--s);block-size:var(--s);box-sizing:border-box;border-radius:3px;z-index:2;pointer-events:none}
.cc-frame.is-sel{box-shadow:inset 0 0 0 3px var(--felt-gold)}
.cc-frame.is-done{background:rgba(255,236,170,.28);box-shadow:inset 0 0 0 2px #FFE2A8}
.cc-frame.is-last{box-shadow:inset 0 0 0 3px var(--seat-1)}
.cc-m{position:absolute;inline-size:calc(var(--s) * .34);transform:translate(-50%,-60%);z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.cc-m.is-ghost{opacity:.55;filter:drop-shadow(0 0 3px #fff)}
.cc-pop{position:absolute;z-index:4;transform:translate(-50%,-50%);padding:2px 8px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:15px;box-shadow:0 3px 6px rgba(0,0,0,.4)}
.cc-draw{display:grid;justify-items:center;gap:8px;color:var(--felt-muted);font-size:12.5px}
.cc-big img{display:block;inline-size:112px;block-size:112px;border-radius:4px;box-shadow:0 0 0 3px var(--felt-gold),0 10px 18px -8px rgba(0,0,0,.7)}
.cc-left{display:inline-flex;align-items:center;gap:6px}.cc-left img{inline-size:22px}
.cc-me{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
.cc-acts{display:flex;gap:8px}
.cc-meeps{display:inline-flex;gap:2px}.cc-meeps img{inline-size:26px}.cc-meeps img.is-used{opacity:.25;filter:grayscale(1)}
.cc-mm{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.cc-mm img{inline-size:18px}
.cc-msg{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(8,20,28,.35);color:var(--felt-ink);font-size:13.5px}
.cc-me--ph{gap:8px;padding-inline:10px}.cc-pdraw img{display:block;inline-size:52px;block-size:52px;border-radius:3px;box-shadow:0 0 0 2px var(--felt-gold)}.cc-me--ph .cc-msg{font-size:12.5px}
.gc-seat__meta .gc-tag{white-space:nowrap}`,
    shotTitle: 'نوبت شما', turnSub: 'گذاشتن کاشی',
    diffs: [
      ['چیدمان', 'مثل BGA: نقشهٔ کاشی‌ها وسط (جابه‌جا و بزرگ‌شدنی)، کنارش کاشی کشیده‌شده بزرگ با شمار کاشی‌های مانده، و ۷ پیادهٔ شما پایین (پیادهٔ به‌کاررفته کم‌رنگ)'],
      ['گذاشتن کاشی', 'خانه‌های مجاز خط‌چین طلایی؛ کاشی روی خانهٔ انتخاب‌شده با قاب طلایی پیش‌نمایش می‌شود و «چرخاندن» فقط بین چرخش‌های مجاز می‌گردد'],
      ['پیاده', 'گام دوم: نقطه‌های ممکن روی کاشی تازه با پیادهٔ کم‌رنگ؛ «بدون پیاده» همیشه هست (§۴)'],
      ['امتیاز', 'سازهٔ کامل روشن می‌شود و عدد امتیاز رویش می‌آید (§۵)؛ کاشی بی‌جا کنار می‌رود (§۶)'],
      ['پایان', 'جدول سازه‌های ناقص و جمع (§۸). گوشی: کاشی کشیده‌شده کنار دکمه‌ها'],
      ['قوانین', 'مثل موتور: ۲ تا ۵ نفر، بازی پایه بدون کشاورز؛ تصویر کاشی‌ها ویرایش دوم BGA است'],
    ],
  };
}
