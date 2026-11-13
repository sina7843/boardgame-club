// Azul on the group D frame (repo engine: 2–4 players, printed coloured wall, base game). BGA layout: factory ring + centre, player boards.
// Mock: 3 players → 7 factories, round 2, your turn. Niloufar and Reza took F3 and F6; leftovers went to the centre (first-player tile still there).
// You took the 3 reds from F4 (its black went to the centre). Legal lines for red: 1 (2 overflow to floor), 3 (exact), floor.
// Board geometry from BGA azul.css (board 740×484): lines end at x=351, wall at (385,12) 339×341, floor at (1,407) 530×71.
export default function (H) {
  const { img, fa, ic, btn, ibtn, modal } = H;
  const CN = { 1: 'مشکی', 2: 'فیروزه‌ای', 3: 'آبی', 4: 'زرد', 5: 'قرمز' };
  const ROW0 = [3, 4, 5, 1, 2];
  const wallCol = (r, t) => (ROW0.indexOf(t) + r) % 5;
  const CW = 339 / 5, RH = 341 / 5, FW = 530 / 7;
  const pct = (x, y) => `left:${(x / 740 * 100).toFixed(2)}%;top:${(y / 484 * 100).toFixed(2)}%`;
  const T = (t, x, y, cls = '') => `<img class="az-t${cls ? ' ' + cls : ''}" style="${pct(x - 11, y - 11)}" src="${H.ART['azul-tile-' + t]}" alt="">`;
  const lineXY = (r, k) => [351 - (k + 1) * CW + (CW - 58) / 2, 12 + r * RH + (RH - 58) / 2];
  const wallXY = (r, c) => [385 + c * CW + (CW - 58) / 2, 12 + r * RH + (RH - 58) / 2];
  const floorXY = (k) => [1 + k * FW + (FW - 58) / 2, 407 + 6.5];
  const box = (x, y, w, h, cls) => `<i class="${cls}" style="${pct(x, y)};width:${(w / 740 * 100).toFixed(2)}%;height:${(h / 484 * 100).toFixed(2)}%"></i>`;
  // st: { wall:[[r,t]], lines:{r:[t,n]}, floor:[t], sel:[rows], floorSel, ghost:{r,t,n,over} , label }
  const board = (st, w, label) => {
    let h = `<div class="az-b" style="--bw:${w}px" role="img" aria-label="${label}">${img('azul-board', '')}${box(385, 12, 339, 341, 'az-dim')}`;
    for (const [r, t] of st.wall ?? []) { const [x, y] = wallXY(r, wallCol(r, t)); h += T(t, x, y); }
    for (const [r, [t, n]] of Object.entries(st.lines ?? {})) for (let k = 0; k < n; k++) { const [x, y] = lineXY(+r, k); h += T(t, x, y); }
    (st.floor ?? []).forEach((t, k) => { const [x, y] = floorXY(k); h += T(t, x, y); });
    for (const r of st.sel ?? []) h += box(351 - (r + 1) * CW, 12 + r * RH, (r + 1) * CW, RH, 'az-sel');
    if (st.floorSel) h += box(1, 407, 530, 71, 'az-sel');
    if (st.ghost) {
      const g = st.ghost, have = st.lines?.[g.r]?.[1] ?? 0, cap = g.r + 1, fit = Math.min(g.n, cap - have);
      for (let k = have; k < have + fit; k++) { const [x, y] = lineXY(g.r, k); h += T(g.t, x, y, 'az-ghost'); }
      const fl = (st.floor ?? []).length;
      for (let k = 0; k < (g.n - fit) + (g.fp ? 1 : 0); k++) { const [x, y] = floorXY(fl + k); h += T(g.fp && k === 0 ? 0 : g.t, x, y, 'az-ghost'); }
      h += box(351 - cap * CW, 12 + g.r * RH, cap * CW, RH, 'az-sel is-on');
    }
    return h + '</div>';
  };
  // factories: 2×2 tiles on each factory disc
  const FPOS = [[.2, .2], [.5, .2], [.2, .5], [.5, .5]];
  const factory = (tiles, i, pick, sz) => `<div class="az-f${pick ? ' is-pick' : ''}${tiles.length ? '' : ' is-empty'}" style="--fs:${sz}px" aria-label="کارخانهٔ ${fa(i)}${tiles.length ? '' : '، خالی'}">${img('azul-factory', '')}${tiles.map((t, k) => `<img class="az-ft${pick === t ? ' is-on' : ''}" style="left:${FPOS[k][0] * 100}%;top:${FPOS[k][1] * 100}%" src="${H.ART['azul-tile-' + t]}" alt="${CN[t]}">`).join('')}<b>${fa(i)}</b></div>`;
  const ring = (fs, centre, R, pick) => {
    const n = fs.length, fsz = Math.round(R * .27);
    const items = fs.map((tl, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; const x = 50 + Math.cos(a) * 37, y = 50 + Math.sin(a) * 37; return `<div class="az-slot" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${factory(tl, i + 1, pick?.f === i + 1 ? pick.t : 0, fsz)}</div>`; }).join('');
    const c = `<div class="az-centre" aria-label="مرکز میز">${centre.map((t) => `<img class="${pick?.f === 0 && (pick.t === t || t === 0) ? 'is-on' : ''}" src="${H.ART['azul-tile-' + t]}" alt="${t ? CN[t] : 'نشان نفر اول'}">`).join('')}</div>`;
    return `<div class="az-ring" style="--R:${R}px">${items}${c}</div>`;
  };
  const F = [[3, 3, 4, 1], [5, 2, 2, 4], [], [5, 5, 5, 1], [1, 4, 4, 2], [], [3, 5, 2, 1]];
  const F_AFTER = F.map((t, i) => (i === 3 ? [] : t));
  const CENTRE = [0, 2, 2, 1, 4, 3];
  const CENTRE_AFTER = [0, 2, 2, 1, 1, 4, 3];
  const ME = { wall: [[0, 3], [1, 4], [2, 2], [3, 3]], lines: { 1: [1, 1], 3: [4, 2], 4: [2, 3] }, floor: [] };
  const NIL = { wall: [[0, 4], [1, 3], [1, 5], [2, 1], [4, 4]], lines: { 2: [3, 1], 4: [5, 4] }, floor: [1] };
  const REZ = { wall: [[0, 5], [2, 3], [3, 1]], lines: { 0: [2, 1], 3: [1, 3] }, floor: [] };
  const mini = (st, nm, seat, sc) => `<figure class="az-mini"><figcaption><i style="background:var(--seat-${seat})"></i>${nm}<b>${fa(sc)}</b></figcaption>${board(st, 196, `صفحهٔ ${nm}`)}</figure>`;
  const table = (opt) => (ph) => `${ring(opt.F ?? F_AFTER, opt.centre ?? CENTRE_AFTER, ph ? 236 : 352, opt.pick)}${ph ? '' : `<div class="az-opps">${mini(NIL, 'نیلوفر', 2, 15)}${mini(REZ, 'رضا', 6, 8)}</div>`}`;
  const handChip = (t, n, extra = '') => `<span class="az-hand" aria-label="در دست: ${fa(n)} کاشی ${CN[t]}">${Array.from({ length: n }, () => `<img src="${H.ART['azul-tile-' + t]}" alt="">`).join('')}${extra}<small>${fa(n)} ${CN[t]}</small></span>`;
  const above = (st, acts, chip) => (ph) => `<div class="az-me${ph ? ' az-me--ph' : ''}">${acts ? `<div class="az-acts">${chip}${acts(ph)}</div>` : ''}${board(st, ph ? 352 : 470, 'صفحهٔ شما')}</div>`;
  const opps = (turn) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:20', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${fa(15)} امتیاز</span><span>کف: ${fa(1)}</span>` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:05', turn: turn === 6, meta: `<span class="gc-tag gc-tag--soft">${fa(8)} امتیاز</span><span>کف: ${fa(0)}</span>` },
  ];
  const rail = `<section class="cx-card"><h3>دور ${fa(2)}</h3><div class="gc-pills"><span class="bgv-chip">${img('azul-bag', '')}کیسه: ${fa(48)}</span><span class="bgv-chip">جعبه: ${fa(9)}</span><span class="bgv-chip">نفر اول: نیلوفر</span></div><div class="ga-rule">${ic('info')}<span>هر کاشی که روی دیوار می‌نشیند به اندازهٔ کاشی‌های پیوستهٔ افقی و عمودی‌اش امتیاز می‌گیرد. کف: ${fa(-1)}، ${fa(-1)}، ${fa(-2)}، ${fa(-2)}، ${fa(-2)}، ${fa(-3)}، ${fa(-3)}. پایان بازی: ردیف کامل ${fa(2)}+، ستون ${fa(7)}+، هر پنج کاشی یک رنگ ${fa(10)}+.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const roundEnd = (ph) => modal('پایان دور ۲: کاشی‌کاری', `<p>ردیف‌های کامل به دیوار رفتند و بقیهٔ کاشی‌های آن ردیف به جعبه. کف هر نفر کم شد و نشان نفر اول به صاحبش برگشت.</p>${tbl(['بازیکن', 'دیوار', 'کف', 'این دور', 'جمع'], [{ c: ['شما', `${fa(3)}+${fa(4)}+${fa(1)}`, fa(0), `${fa(8)}+`, fa(20)], win: true }, { c: ['نیلوفر', `${fa(2)}+${fa(5)}`, fa(-1), `${fa(6)}+`, fa(21)] }, { c: ['رضا', `${fa(1)}+${fa(3)}`, fa(-4), fa(0), fa(8)] }])}<p class="cx-note">امتیاز زیر صفر نمی‌رود. دور ۳ را نیلوفر شروع می‌کند.</p>`, `${btn('دور بعد', 'primary', 'check')}`);
  const gameEnd = (ph) => modal('پایان بازی', `<p>شما ردیف اول دیوار را کامل کردید، پس بازی بعد از همین دور تمام شد.</p>${tbl(['بازیکن', 'دورها', 'ردیف ×۲', 'ستون ×۷', 'رنگ ×۱۰', 'جمع'], [{ c: ['شما', fa(61), `${fa(2)} (${fa(4)}+)`, `${fa(1)} (${fa(7)}+)`, `${fa(1)} (${fa(10)}+)`, fa(82)], win: true }, { c: ['نیلوفر', fa(58), `${fa(1)} (${fa(2)}+)`, `${fa(1)} (${fa(7)}+)`, fa(0), fa(67)] }, { c: ['رضا', fa(44), fa(0), `${fa(2)} (${fa(14)}+)`, fa(0), fa(58)] }])}<p class="cx-note">تساوی: هر کس ردیف کامل بیشتری دارد برنده است؛ اگر باز مساوی بود، برد مشترک است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  const acts1 = (ph) => `${btn(ph ? 'ردیف ۳' : 'بگذار در ردیف ۳', 'primary', 'check')}${btn(ph ? 'کف' : 'همه به کف', 'secondary', 'chevdown')}${ph ? '' : btn('لغو', 'secondary', 'x')}`;
  return {
    slug: 'Azul', fa: 'آزول', latin: 'Azul', meta: ['زنده', '۳ نفر', 'دور ۲'],
    opps: opps(1),
    me: { cards: [], clock: '0:48', turn: true, note: `<span class="cx-note">${fa(12)} امتیاز</span>`, above: above({ ...ME, sel: [0, 2], floorSel: true, ghost: { r: 2, t: 5, n: 3 } }, acts1, handChip(5, 3)) },
    table: table({ pick: null }),
    status: `<b>نوبت شماست.</b> سه کاشی قرمز کارخانهٔ ${fa(4)} در دست شماست و مشکی‌اش به مرکز رفت. ردیف ${fa(3)} دقیقاً جا دارد؛ ردیف ${fa(1)} هم مجاز است ولی دو کاشی به کف می‌افتد.`,
    pstatus: `<b>نوبت شما.</b> سه قرمز در دست؛ ردیف ${fa(3)} دقیقاً جا دارد.`,
    railCard: rail,
    logNote: `دور ${fa(2)}`,
    log: [[2, 'نیلوفر ۲ زرد از کارخانهٔ ۳ برداشت'], [6, 'رضا ۲ آبی از کارخانهٔ ۶ برداشت'], [1, 'شما ۳ قرمز از کارخانهٔ ۴ برداشتید'], [1, 'یک مشکی به مرکز رفت']],
    dockItems: [['list', 'رویدادها'], ['users', 'صفحه‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    cardW: 0,
    phases: [
      {
        shotTitle: 'برداشتن از مرکز', turnSub: 'نشان نفر اول به کف می‌رود',
        table: table({ F: F_AFTER, centre: CENTRE_AFTER, pick: { f: 0, t: 2 } }),
        me: { above: above({ ...ME, sel: [4], floorSel: true, ghost: { r: 4, t: 2, n: 2, fp: true } }, (ph) => `${btn('بگذار در ردیف ۵', 'primary', 'check')}${btn('همه به کف', 'secondary', 'chevdown')}${btn('لغو', 'secondary', 'x')}`, handChip(2, 2, `<img src="${H.ART['azul-tile-0']}" alt="نشان نفر اول">`)) },
        status: `<b>از مرکز برداشتید:</b> دو فیروزه‌ای. چون اولین نفری هستید که از مرکز برمی‌دارد، نشان نفر اول هم با شماست: روی کف می‌نشیند (${fa(-1)}) و دور بعد را شما شروع می‌کنید. ردیف ${fa(5)} با این دو کامل می‌شود.`,
        log: [[2, 'نیلوفر ۲ زرد از کارخانهٔ ۳ برداشت'], [6, 'رضا ۲ آبی از کارخانهٔ ۶ برداشت'], [1, 'شما ۲ فیروزه‌ای و نشان نفر اول را از مرکز برداشتید']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر نیلوفر',
        opps: opps(2),
        me: { turn: false, clock: '0:48', above: above(ME, null, '') },
        table: table({ F: F_AFTER, centre: CENTRE_AFTER, pick: { f: 2, t: 2 } }),
        status: `<b>نوبت نیلوفر است.</b> دارد از کارخانهٔ ${fa(2)} انتخاب می‌کند. کارخانه‌ای که حریف رویش است با حلقه دیده می‌شود؛ تا نوبت شما برسد فقط می‌توانید نگاه کنید.`,
        log: [[1, 'شما ۳ قرمز را در ردیف ۳ گذاشتید'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'پایان دور', turnSub: 'کاشی‌کاری و امتیاز',
        me: { turn: false, above: above({ wall: [[0, 3], [1, 4], [2, 2], [3, 3], [1, 1], [2, 5], [4, 2]], lines: { 3: [4, 2] }, floor: [] }, null, '') },
        table: table({ F: [[], [], [], [], [], [], []], centre: [] }), overlay: roundEnd,
        status: '<b>دور ۲ تمام شد.</b> کارخانه‌ها و مرکز خالی‌اند؛ ردیف‌های کامل به دیوار رفتند.',
        log: [[1, 'شما ۸ امتیاز گرفتید'], [2, 'نیلوفر ۶ امتیاز گرفت'], [6, 'رضا ۴ امتیاز کف از دست داد']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیاز پایانی و برنده',
        me: { turn: false, clock: '', above: above({ wall: [[0, 3], [0, 4], [0, 5], [0, 1], [0, 2], [1, 4], [2, 2], [3, 3], [1, 1], [2, 5], [4, 2], [1, 3], [2, 1], [3, 4], [4, 3]], lines: {}, floor: [] }, null, '') },
        table: table({ F: [[], [], [], [], [], [], []], centre: [] }), overlay: gameEnd,
        status: '<b>بازی تمام شد.</b> شما با ۸۲ امتیاز بردید.',
        log: [[1, 'شما ردیف اول را کامل کردید'], [1, 'امتیاز پایانی: ۲۱+'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{gap:22px}
.az-ring{position:relative;inline-size:var(--R);block-size:var(--R);flex:none}
.az-slot{position:absolute;transform:translate(-50%,-50%)}
.az-f{position:relative;inline-size:var(--fs);block-size:var(--fs)}
.az-f>img:first-child{display:block;inline-size:100%;block-size:100%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))}
.az-f.is-empty>img:first-child{opacity:.55}
.az-ft{position:absolute;inline-size:30%;block-size:30%}
.az-ft.is-on,.az-centre img.is-on{filter:drop-shadow(0 0 0 var(--felt-gold)) drop-shadow(0 0 3px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold))}
.az-f.is-pick{border-radius:50%;box-shadow:0 0 0 3px var(--felt-gold),0 0 0 6px rgba(232,166,66,.25)}
.az-f>b{position:absolute;inset-block-start:-4px;inset-inline-start:-4px;inline-size:20px;block-size:20px;border-radius:50%;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:11.5px}
.az-centre{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);inline-size:34%;block-size:34%;border-radius:50%;background:rgba(250,245,236,.08);box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.18);display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:0;padding:8%;box-sizing:border-box}
.az-centre img{inline-size:30%;block-size:auto;margin:-3%}
.az-opps{display:grid;gap:12px}
.az-mini{margin:0;display:grid;gap:4px}
.az-mini figcaption{display:flex;align-items:center;gap:6px;color:var(--felt-ink);font-size:13px}
.az-mini figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.az-mini figcaption b{margin-inline-start:auto;color:var(--felt-gold)}
.az-b{position:relative;inline-size:var(--bw);direction:ltr;border-radius:8px;overflow:hidden;box-shadow:0 10px 18px -10px rgba(0,0,0,.7);flex:none}
.az-b>img:first-child{display:block;inline-size:100%;block-size:auto}
.az-t{position:absolute;inline-size:10.81%;block-size:auto}
.az-t.az-ghost{opacity:.55}
.az-dim{position:absolute;background:hsla(0,0%,100%,.69)}
.az-sel{position:absolute;box-sizing:border-box;border:2px dashed var(--felt-gold);border-radius:6px;background:rgba(232,166,66,.12)}
.az-sel.is-on{border-style:solid;border-width:3px;box-shadow:0 0 0 3px rgba(232,166,66,.35)}
.az-me{display:grid;justify-items:center;gap:10px;inline-size:100%}
.az-acts{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
.az-hand{display:inline-flex;align-items:center;gap:0;padding:4px 10px 4px 6px;border-radius:999px;background:rgba(250,245,236,.1);color:var(--felt-ink);font-size:13px;direction:ltr}
.az-hand img{inline-size:30px;block-size:30px;margin-inline-end:-6px}
.az-hand small{margin-inline-start:14px;padding-inline-start:4px;font-size:13px;direction:rtl;white-space:nowrap}
.bgv-chip img{inline-size:20px;block-size:20px;margin-inline-end:4px}
.cx-phone .gc-table{gap:0}
.az-me--ph{gap:6px}.az-me--ph .az-acts{gap:6px;flex-wrap:nowrap;padding-inline:10px}.az-me--ph .az-hand img{inline-size:24px;block-size:24px}.az-me--ph .az-hand small{display:none}
.cx-phone .gc-me .cx-pbar{margin-block-start:2px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب ردیف برای کاشی‌های برداشته',
    diffs: [
      ['چیدمان', 'مثل BGA: حلقهٔ کارخانه‌ها با مرکز وسط میز، صفحهٔ شما پایین و صفحهٔ کوچک حریف‌ها کنار حلقه. سه‌نفره ۷ کارخانه دارد (دونفره ۵ و چهارنفره ۹)'],
      ['برداشتن', 'همهٔ کاشی‌های یک رنگ از یک کارخانه یا از مرکز؛ کاشی‌های برداشته طلایی می‌شوند و بقیهٔ کارخانه به مرکز می‌رود. اولین کسی که از مرکز برمی‌دارد نشان نفر اول را هم می‌گیرد (§۴)'],
      ['انتخاب ردیف', 'ردیف‌های مجاز با خط‌چین طلایی؛ روی ردیف انتخاب‌شده پیش‌نمایش کم‌رنگ کاشی‌ها و سرریزشان روی کف دیده می‌شود. «همه به کف» همیشه مجاز است'],
      ['دیوار', 'دیوار رنگی چاپی با لایهٔ سفید کم‌رنگ می‌شود و کاشی‌های گذاشته پررنگ‌اند، همان کاری که BGA می‌کند'],
      ['پایان دور و بازی', 'جدول امتیاز کاشی‌کاری هر دور (§۶) و جدول پایانی با جایزهٔ ردیف، ستون و رنگ (§۷)'],
      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر، دیوار چاپی؛ بازی آخر همان دوری تمام می‌شود که کسی یک ردیف افقی را کامل کند'],
    ],
  };
}
