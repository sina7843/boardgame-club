// Patchwork («پچ‌ورک») on the group D frame. Repo engine: 2 players, base game (income 5, 11 … 53; leather 20, 26, 32, 38, 44).
// BGA layout: patch circle as a strip that starts at the neutral pawn, time board in the middle, both 9×9 quilts.
// Mock: you (blue) at 18, نیلوفر (red) at 21, so you move. All patch shapes, costs, times and button counts are the real BGA patches
// (ready to use/data/asset-manifest.json); quilts are validated (no overlap, inside 9×9) and empty cells, income and scores are computed.
// Board geometry from BGA patchwork.css: quilt 462 px with a 42 px border and 42 px cells; Americana time board 446 px, padding 34, 47.25 px steps.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART[n];
  const PD = { 0: [':1', 0, 0, 0], 1: [':11', 2, 1, 0], 2: [':11:01', 3, 1, 0], 3: [':111', 2, 2, 0], 4: [':11:01', 1, 3, 0], 5: [':111:010', 2, 2, 0], 6: [':810:011', 3, 2, 1], 7: [':118:001', 4, 2, 1], 8: [':8111', 3, 3, 1], 9: [':11:88', 6, 5, 2], 10: [':118:800', 4, 6, 2], 11: [':1800:0880', 7, 6, 3], 12: [':10:11:11', 2, 2, 0], 13: [':101:111', 1, 2, 0], 14: [':81111', 7, 1, 1], 15: [':1100:0181', 2, 3, 1], 16: [':0800:1111', 3, 4, 1], 17: [':1881:0001', 10, 3, 2], 18: [':010:811:080', 5, 4, 2], 19: [':001:881:001', 5, 5, 2], 20: [':800:880:011', 10, 4, 3], 21: [':0100:1111:0010', 2, 1, 0], 22: [':1110:0111', 4, 2, 0], 23: [':1000:1111:0001', 1, 2, 0], 24: [':0100:1811:0100', 0, 3, 1], 25: [':1111:8001', 1, 5, 1], 26: [':0001:1881:0001', 7, 2, 2], 27: [':0110:1881', 7, 4, 2], 28: [':010:111:808', 3, 6, 2], 29: [':1888:0011', 10, 5, 3], 30: [':110:088:081', 8, 6, 3], 31: [':111:010:111', 2, 3, 0], 32: [':00100:81111:00100', 1, 4, 1], 33: [':0810:1111:0110', 5, 3, 1] };
  const rows = (n) => PD[n][0].slice(1).split(':');
  const dims = (n) => [rows(n)[0].length, rows(n).length];
  // cells of patch n placed with oriented bbox top-left (r,c), orientation st (0–3 clockwise turns, 4–7 mirrored first)
  const cellsOf = (n, r, c, st) => {
    let cs = []; rows(n).forEach((row, i) => [...row].forEach((ch, j) => { if (ch !== '0') cs.push([i, j]); }));
    if (st >= 4) { const mx = Math.max(...cs.map((p) => p[1])); cs = cs.map(([i, j]) => [i, mx - j]); }
    for (let k = 0; k < st % 4; k++) { const mr = Math.max(...cs.map((p) => p[0])); cs = cs.map(([i, j]) => [j, mr - i]); }
    const r0 = Math.min(...cs.map((p) => p[0])), c0 = Math.min(...cs.map((p) => p[1]));
    return cs.map(([i, j]) => [r + i - r0, c + j - c0]);
  };
  const quiltCells = (pl, who) => {
    const s = new Set();
    for (const [n, r, c, st] of pl) for (const [i, j] of cellsOf(n, r, c, st)) { const k = `${i},${j}`; if (i < 0 || j < 0 || i > 8 || j > 8 || s.has(k)) throw new Error(`patchwork: bad placement ${who} #${n} ${r},${c}`); s.add(k); }
    return s;
  };
  const income = (pl) => pl.reduce((a, [n]) => a + (PD[n][0].match(/8/g) || []).length, 0);
  const empty = (pl, who) => 81 - quiltCells(pl, who).size;
  const ALT = (n) => (n ? `تکه: ${fa(PD[n][1])} دکمه، ${fa(PD[n][2])} زمان${PD[n][3] ? `، ${fa(PD[n][3])} درآمد` : ''}` : 'تکهٔ چرمی');
  const pimg = (n) => A(n ? 'patchwork-p' + n : 'patchwork-leather');

  // quilt: o = { B, color, ghost:[n,r,c,st], hl:n (framed), legal:[[r,c]], sel:[r,c], seven:true }
  const quilt = (pl, o) => {
    const cell = o.B * 42 / 462, P = (r, c) => `left:${(cell + c * cell).toFixed(1)}px;top:${(cell + r * cell).toFixed(1)}px`;
    const piece = ([n, r, c, st], cls = '') => {
      const [w, h] = n ? dims(n) : [1, 1], sw = st % 2 ? h : w, sh = st % 2 ? w : h, k = cell / 42, iw = (w * 42 + 36) * k, ih = (h * 42 + 36) * k;
      return `<span class="pw-pc${cls}" style="${P(r, c)};width:${(sw * cell).toFixed(1)}px;height:${(sh * cell).toFixed(1)}px"><img src="${pimg(n)}" alt="${ALT(n)}" style="width:${iw.toFixed(1)}px;height:${ih.toFixed(1)}px;left:${((sw * cell - iw) / 2).toFixed(1)}px;top:${((sh * cell - ih) / 2).toFixed(1)}px;transform:rotate(${90 * (st % 4)}deg)${st >= 4 ? ' scaleX(-1)' : ''}"></span>`;
    };
    quiltCells(o.ghost ? [...pl, o.ghost] : pl, o.color);
    let h = `<div class="pw-q" style="--qb:${o.B}px" role="img" aria-label="${o.label ?? 'لحاف'}"><img class="pw-qb" src="${A('patchwork-board-' + o.color)}" alt="">`;
    for (const p of pl) h += piece(p, o.hl === p[0] && !o.ghost ? ' is-hl' : '');
    for (const [r, c] of o.legal ?? []) h += `<i class="pw-cell pw-cell--free" style="${P(r, c)};width:${cell.toFixed(1)}px;height:${cell.toFixed(1)}px"></i>`;
    if (o.ghost) { h += piece(o.ghost, ' is-ghost'); for (const [r, c] of cellsOf(...o.ghost)) h += `<i class="pw-cell pw-cell--ok" style="${P(r, c)};width:${cell.toFixed(1)}px;height:${cell.toFixed(1)}px"></i>`; }
    if (o.seven) h += `<i class="pw-seven" style="${P(0, 0)};width:${(7 * cell).toFixed(1)}px;height:${(7 * cell).toFixed(1)}px"></i>`;
    return h + '</div>';
  };
  // time board: Americana track steps (col,row) for spaces 0–53, from BGA .scoreboard_3 .timetracker_N
  const TR = [[0, 7], [0, 6], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [1, 5], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 5], [4, 5], [3, 5], [2, 5], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [4, 4]];
  const LEATHER = [20, 26, 32, 38, 44];
  const tb = (B, o) => {
    const k = B / 446.04, step = 47.25 * k, at = (i, dx = 0, dy = 0, f = 1) => `left:${(34 * k + TR[i][0] * step + dx + step * (1 - f) / 2).toFixed(1)}px;top:${(34 * k + TR[i][1] * step + dy + step * (1 - f) / 2).toFixed(1)}px;width:${(step * f).toFixed(1)}px;height:${(step * f).toFixed(1)}px`;
    let h = `<div class="pw-tb" style="--tb:${B}px" role="img" aria-label="صفحهٔ زمان"><img class="pw-tbi" src="${A('patchwork-time')}" alt="">`;
    for (const i of o.leather) h += `<img class="pw-tl" style="${at(i, 0, 0, 1.15)}" src="${A('patchwork-leather')}" alt="تکهٔ چرمی روی خانهٔ ${fa(i)}">`;
    const same = o.blue === o.red;
    h += `<img class="pw-tm" style="${at(o.red, same ? -4 : 0, same ? -4 : 0, .8)}" src="${A('patchwork-marker-red')}" alt="نیلوفر: خانهٔ ${fa(o.red)}">`;
    h += `<img class="pw-tm" style="${at(o.blue, same ? 4 : 0, same ? 4 : 0, .8)}" src="${A('patchwork-marker-blue')}" alt="شما: خانهٔ ${fa(o.blue)}">`;
    if (o.gain) h += `<b class="pw-gain" style="${at(o.blue)}">${o.gain}</b>`;
    if (o.ghostAt != null) h += `<i class="pw-tghost" style="${at(o.ghostAt)}"></i>`;
    return h + '</div>';
  };
  // strip: patches from the neutral pawn; o = { list, choose: count of choosable (3), sel, short:{n:k}, cell }
  const strip = (o, ph) => {
    const cell = ph ? 13 : 16, k = cell / 42;
    const items = (ph ? o.list.slice(0, 4) : o.list).map((n, i) => {
      const [w, h] = dims(n), ch = i < (o.choose ?? 3) && !o.off;
      const short = o.short?.[n];
      return `<div class="pw-si${ch ? ' is-ch' : ''}${o.sel === n ? ' is-sel' : ''}${short ? ' is-short' : ''}"><img src="${pimg(n)}" alt="${ALT(n)}" style="width:${((w * 42 + 36) * k).toFixed(1)}px;height:${((h * 42 + 36) * k).toFixed(1)}px">${ch ? `<span class="pw-sc">${short ? `${fa(short)} دکمه کم` : `${fa(PD[n][1])} دکمه، ${fa(PD[n][2])} زمان`}</span>` : ''}</div>`;
    }).join('');
    return `<div class="pw-strip${ph ? ' pw-strip--ph' : ''}" aria-label="دایرهٔ تکه‌ها"><div class="pw-si pw-pawn"><img src="${A('patchwork-pawn')}" alt="مهرهٔ خنثی"></div>${items}<span class="pw-more">${fa(o.left)} تکه</span></div>`;
  };

  // ---------- state ----------
  const ME4 = [[9, 0, 0, 0], [6, 0, 2, 0], [13, 2, 0, 0], [3, 0, 4, 0]];
  const BUY28 = [28, 2, 4, 0];
  const ME5 = [...ME4, BUY28];
  const ME6 = [...ME5, [15, 1, 5, 0]];
  const LEATHER1 = [0, 1, 2, 0];
  const REST = [[2, 2, 3, 3], [4, 4, 0, 0], [8, 4, 2, 1], [5, 4, 3, 3], [11, 4, 5, 5], [16, 5, 0, 1], [19, 6, 3, 1], [0, 2, 1, 0]];
  const LAST = [17, 6, 5, 2];
  const MEF = [...ME6, LEATHER1, ...REST, LAST];
  const NIL5 = [[12, 0, 0, 0], [7, 0, 2, 0], [10, 3, 0, 0], [1, 1, 2, 0], [0, 2, 2, 0]];
  const NIL6 = [...NIL5, [14, 5, 0, 0]];
  // check the 7×7 really is complete in the final quilt
  { const s = quiltCells(MEF, 'final'); for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (!s.has(`${r},${c}`)) throw new Error('patchwork: 7x7 not complete'); }
  const ST1 = [20, 2, 28, 14, 15, 18, 21, 22];
  const nilQ = (pl = NIL5, hl) => `<figure class="pw-opp"><figcaption><i style="background:var(--seat-2)"></i>لحاف نیلوفر<span>درآمد ${fa(income(pl))}</span></figcaption>${quilt(pl, { B: 186, color: 'red', hl, label: 'لحاف نیلوفر' })}</figure>`;
  const bonusTok = (where) => `<figure class="pw-bonus"><img src="${A('patchwork-bonus')}" alt="پاداش ۷×۷"><figcaption>${where}</figcaption></figure>`;
  const table = (o) => (ph) => `${strip(o.strip, ph)}<div class="pw-mid${ph ? ' pw-mid--ph' : ''}">${tb(ph ? 168 : 250, o.tb)}${ph ? '' : `${o.noOpp ? '' : nilQ(o.nil, o.nilHl)}${o.bonus === false ? '' : bonusTok(o.bonus ?? `${fa(7)}+ امتیاز`)}`}</div>`;
  const stats = (b, pl) => `<div class="pw-stats"><span class="bgv-chip"><img src="${A('patchwork-button')}" alt="">${fa(b)} دکمه</span><span class="bgv-chip">درآمد ${fa(income(pl))}</span><span class="bgv-chip">خالی ${fa(empty(pl, 'me'))}</span></div>`;
  const above = (pl, qo, side) => (ph) => `<div class="pw-me${ph ? ' pw-me--ph' : ''}">${side ? `<div class="pw-side">${side(ph)}</div>` : ''}${quilt(pl, { B: ph ? 214 : 282, color: 'blue', label: 'لحاف شما', ...qo })}</div>`;
  const seatMeta = (b, pl, pos) => `<span class="gc-tag gc-tag--soft">${fa(b)} دکمه</span><span>درآمد ${fa(income(pl))}</span><span>زمان ${fa(pos)}</span>`;
  const opps = (turn, b = 7, pl = NIL5, pos = 21, clock = '1:40') => [{ name: 'نیلوفر', av: 'ن', seat: 2, clock, turn: turn === 2, meta: seatMeta(b, pl, pos) }];
  const note = (pos) => `<span class="cx-note">زمان ${fa(pos)} از ${fa(53)}</span>`;
  const rail = `<section class="cx-card"><h3>صفحهٔ زمان</h3><div class="gc-pills"><span class="bgv-chip"><img src="${A('patchwork-marker-blue')}" alt="">شما: ${fa(18)}</span><span class="bgv-chip"><img src="${A('patchwork-marker-red')}" alt="">نیلوفر: ${fa(21)}</span></div><div class="ga-rule">${ic('info')}<span>کسی بازی می‌کند که عقب‌تر است. یا یکی از سه تکهٔ بعد از مهرهٔ خنثی را می‌خرید، یا یک خانه جلوتر از حریف می‌روید و به ازای هر خانه یک دکمه می‌گیرید. آخر بازی: دکمه‌ها منهای ${fa(2)} برای هر خانهٔ خالی، به‌علاوهٔ ${fa(7)} برای اولین مربع ${fa(7)}×${fa(7)} کامل.</span></div></section>`;
  const tbl = (head, rws) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rws.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ME_END_B = 47, NIL_END_B = 39, NIL_END_EMPTY = 13;
  const meEnd = ME_END_B - 2 * empty(MEF, 'me') + 7, nilEnd = NIL_END_B - 2 * NIL_END_EMPTY;
  const endM = (ph) => modal('پایان بازی', `<p>هر دو مهره به خانهٔ آخر رسیدند. دکمه‌ها شمرده شد و هر خانهٔ خالی لحاف ${fa(2)} امتیاز کم کرد.</p>${tbl(['بازیکن', 'دکمه', 'خانهٔ خالی', 'پاداش ۷×۷', 'جمع'], [{ c: [`${ic('trophy')} شما`, fa(ME_END_B), `${fa(empty(MEF, 'me'))} (${fa(-2 * empty(MEF, 'me'))})`, `${fa(7)}+`, fa(meEnd)], win: meEnd > nilEnd }, { c: ['نیلوفر', fa(NIL_END_B), `${fa(NIL_END_EMPTY)} (${fa(-2 * NIL_END_EMPTY)})`, fa(0), fa(nilEnd)] }])}<p class="cx-note">تساوی: کسی برنده است که زودتر به خانهٔ آخر رسیده است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);
  const buySide = (ph) => `${ph ? '' : stats(5, ME4)}<div class="pw-prev"><b>${fa(3)}− دکمه</b><b>${fa(6)} خانه جلو</b><b>${fa(2)}+ درآمد</b></div><div class="pw-btns">${btn('تأیید', 'primary', 'check')}${btn('چرخاندن', 'secondary', 'repeat')}${btn(ph ? 'برعکس' : 'برعکس کردن', 'secondary', 'flip')}${ph ? '' : btn('لغو', 'secondary', 'x')}</div>`;
  const ALL_EMPTY = (pl) => { const s = quiltCells(pl, 'x'), o = []; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!s.has(`${r},${c}`)) o.push([r, c]); return o; };

  return {
    slug: 'Patchwork', fa: 'پچ‌ورک', latin: 'Patchwork', meta: ['زنده', '۲ نفر'],
    opps: opps(0),
    me: { cards: [], clock: '2:10', turn: true, note: note(18), above: above(ME4, { ghost: BUY28 }, buySide) },
    table: table({ strip: { list: ST1, sel: 28, short: { 20: 5 }, left: 25 }, tb: { blue: 18, red: 21, leather: [26, 32, 38, 44], ghostAt: 24 } }),
    status: `<b>نوبت شماست؛ شما عقب‌ترید (${fa(18)} در برابر ${fa(21)}).</b> تکهٔ سوم را برداشتید: ${fa(3)} دکمه، ${fa(6)} زمان و ${fa(2)} دکمهٔ درآمد. خانه‌های زیرش سبزند، پس جا دارد. تکهٔ اول را نمی‌شود خرید: ${fa(5)} دکمه کم دارید.`,
    pstatus: `<b>نوبت شما.</b> تکه را بچرخانید یا برعکس کنید و تأیید بزنید.`,
    railCard: rail,
    log: [[2, 'نیلوفر تکهٔ ۲ زمانی خرید و به ۲۱ رسید'], [1, 'نوبت شما']],
    dockItems: [['list', 'رویدادها'], ['users', 'لحاف حریف'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'دو مهره در خانهٔ شروع',
        opps: opps(2, 5, [], 0, '2:30'),
        me: { turn: false, clock: '2:30', note: note(0), above: above([], {}, (ph) => (ph ? '' : stats(5, []))) },
        table: table({ strip: { list: [21, 22, 23, 24, 25, 26, 27, 29], left: 33, off: false }, tb: { blue: 0, red: 0, leather: LEATHER }, nil: [] }),
        status: `<b>بازی شروع شد.</b> هر نفر ${fa(5)} دکمه دارد و درآمدش صفر است. مهرهٔ خنثی کنار کوچک‌ترین تکه است و سه تکهٔ بعد از آن قابل خریدند. پنج تکهٔ چرمی روی صفحهٔ زمان منتظرند. نیلوفر شروع می‌کند.`,
        log: [[1, 'بازی دونفره شروع شد'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'انتخاب کار', turnSub: 'خریدن یا جلو رفتن',
        me: { above: above(ME4, {}, (ph) => `${ph ? '' : stats(5, ME4)}<div class="pw-btns">${btn(`جلو رفتن (${fa(4)}+ دکمه)`, 'secondary', 'next')}</div>`) },
        table: table({ strip: { list: ST1, short: { 20: 5 }, left: 25 }, tb: { blue: 18, red: 21, leather: [26, 32, 38, 44] } }),
        status: `<b>یک تکه بخرید یا جلو بروید.</b> از سه تکهٔ بعد از مهرهٔ خنثی، دومی و سومی را می‌توانید بخرید. جلو رفتن شما را یک خانه جلوتر از نیلوفر (خانهٔ ${fa(22)}) می‌برد و ${fa(4)} دکمه می‌دهد.`,
        pstatus: `<b>بخرید یا جلو بروید</b> (${fa(4)}+ دکمه).`,
        phone: true,
      },
      {
        shotTitle: 'عبور از خانهٔ دکمه', turnSub: 'درآمد لحاف',
        opps: opps(2),
        me: { turn: false, note: note(24), above: above(ME5, { hl: 28 }, (ph) => (ph ? '' : stats(7, ME5))) },
        table: table({ strip: { list: [14, 15, 18, 21, 22, 23, 24, 25], left: 24, off: true }, tb: { blue: 24, red: 21, leather: [26, 32, 38, 44], gain: `${fa(5)}+` } }),
        status: `<b>از خانهٔ دکمه گذشتید: ${fa(5)}+ دکمه.</b> لحاف شما حالا ${fa(5)} دکمه دارد (با تکهٔ تازه)، پس هر بار که از خانهٔ دکمه رد شوید همین‌قدر می‌گیرید. ${fa(3)} دکمه دادید و ${fa(5)} گرفتید: ${fa(7)} دکمه دارید. نیلوفر حالا عقب‌تر است.`,
        pstatus: `<b>درآمد:</b> ${fa(5)}+ دکمه؛ نوبت نیلوفر.`,
        log: [[1, 'شما تکهٔ ۳ دکمه‌ای را خریدید'], [1, 'از خانهٔ دکمه گذشتید: ۵+'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'نیلوفر هنوز عقب‌تر است',
        opps: opps(2, 0, NIL6, 22),
        me: { turn: false, note: note(24), above: above(ME5, {}, (ph) => (ph ? '' : stats(7, ME5))) },
        table: table({ strip: { list: [15, 18, 21, 22, 23, 24, 25, 26], left: 23, off: true }, tb: { blue: 24, red: 22, leather: [26, 32, 38, 44] }, nil: NIL6, nilHl: 14 }),
        status: `<b>نوبت نیلوفر است.</b> تکهٔ ${fa(5)} خانه‌ای را خرید (قاب طلایی) و فقط یک خانه جلو رفت، به ${fa(22)}. هنوز از شما عقب‌تر است، پس دوباره بازی می‌کند.`,
        pstatus: `<b>نیلوفر هنوز عقب‌تر است</b> و دوباره بازی می‌کند.`,
        log: [[1, 'از خانهٔ دکمه گذشتید: ۵+'], [2, 'نیلوفر تکهٔ ۷ دکمه‌ای را خرید'], [2, 'نیلوفر هنوز عقب‌تر است']],
        phone: true,
      },
      {
        shotTitle: 'تکهٔ چرمی', turnSub: 'گذاشتن تکهٔ ۱×۱',
        opps: opps(0, 7, NIL6, 25),
        me: { note: note(27), above: above(ME6, { legal: ALL_EMPTY(ME6), ghost: LEATHER1 }, (ph) => `${ph ? '' : stats(5, ME6)}<div class="pw-btns">${btn('تأیید', 'primary', 'check')}</div>`) },
        table: table({ strip: { list: [18, 21, 22, 23, 24, 25, 26, 27], left: 22, off: true }, tb: { blue: 27, red: 25, leather: [32, 38, 44] }, nil: NIL6 }),
        status: `<b>تکهٔ چرمی گرفتید؛ آن را در لحاف بگذارید.</b> اولین نفر از خانهٔ ${fa(26)} گذشتید. هر خانهٔ خالی مجاز است؛ این‌جا تنها سوراخ بین تکه‌هاست و پرکردنش بعداً به مربع ${fa(7)}×${fa(7)} کمک می‌کند.`,
        pstatus: `<b>تکهٔ چرمی</b> را در یک خانهٔ خالی بگذارید.`,
        log: [[2, 'نیلوفر جلو رفت و ۳ دکمه گرفت'], [1, 'شما تکهٔ ۲ دکمه‌ای را خریدید'], [1, 'تکهٔ چرمی خانهٔ ۲۶ مال شماست']],
        phone: true,
      },
      {
        shotTitle: 'پاداش ۷×۷', turnSub: 'اولین مربع کامل',
        opps: opps(2, 31, NIL6, 47, '0:35'),
        me: { turn: false, clock: '0:40', note: note(50), above: above(MEF, { hl: 17, seven: true }, (ph) => `${ph ? '' : stats(41, MEF)}<div class="pw-won"><img src="${A('patchwork-bonus')}" alt="پاداش ۷×۷"><span class="gc-tag">${fa(7)}+</span></div>`) },
        table: table({ strip: { list: [29, 30, 31, 32, 33, 20], left: 6, off: true }, tb: { blue: 50, red: 47, leather: [] }, noOpp: true, bonus: false }),
        status: `<b>مربع ${fa(7)}×${fa(7)} کامل شد.</b> با آخرین تکه، گوشهٔ بالای لحافتان بی‌سوراخ شد و چون اولین نفرید، نشان ${fa(7)}×${fa(7)} و ${fa(7)} امتیازش مال شماست. نیلوفر دیگر نمی‌تواند آن را بگیرد.`,
        pstatus: `<b>پاداش ۷×۷</b> مال شما شد: ${fa(7)}+.`,
        log: [[1, 'شما تکهٔ ۱۰ دکمه‌ای را خریدید'], [1, 'اولین مربع ۷×۷ کامل: ۷+'], [2, 'نوبت نیلوفر']],
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جدول امتیاز و برنده',
        meta: ['تمام‌شده', '۲ نفر'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: `<span class="gc-tag gc-tag--soft">${fa(nilEnd)} امتیاز</span>` }],
        me: { turn: false, clock: '', note: `<span class="cx-note">${fa(meEnd)} امتیاز</span>`, above: above(MEF, {}, null) },
        table: table({ strip: { list: [29, 30, 31, 32, 33, 20], left: 6, off: true }, tb: { blue: 53, red: 53, leather: [] }, noOpp: true, bonus: false }),
        overlay: endM,
        status: `<b>بازی تمام شد.</b> شما با ${fa(meEnd)} امتیاز بردید.`,
        log: [[2, 'نیلوفر به خانهٔ آخر رسید'], [1, 'شما به خانهٔ آخر رسیدید'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:12px}
.pw-strip{flex:none;display:flex;align-items:center;gap:10px;direction:ltr;max-inline-size:100%;overflow:hidden;padding:6px 10px 8px;border-radius:12px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);box-sizing:border-box}
.pw-si{position:relative;flex:none;display:grid;justify-items:center;gap:4px}
.pw-si img{display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
.pw-si:not(.is-ch):not(.pw-pawn){opacity:.62}
.pw-si.is-ch img{filter:drop-shadow(0 0 0 #fff) drop-shadow(0 0 2px #FAF5EC) drop-shadow(0 2px 2px rgba(0,0,0,.35))}
.pw-si.is-sel img{filter:drop-shadow(0 0 2px var(--felt-gold)) drop-shadow(0 0 3px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold))}
.pw-si.is-short img{filter:grayscale(.9) brightness(.8)}
.pw-sc{font-size:11px;line-height:1;padding:3px 6px;border-radius:999px;background:rgba(250,245,236,.14);color:var(--felt-ink);white-space:nowrap;direction:rtl}
.pw-si.is-sel .pw-sc{background:var(--felt-gold);color:#142B3B;font-weight:700}
.pw-si.is-short .pw-sc{background:#5A2E2E;color:#F4D6D2}
.pw-pawn img{block-size:46px;inline-size:auto}
.pw-more{flex:none;font-size:12px;color:var(--felt-muted);direction:rtl}
.pw-mid{flex:none;display:flex;align-items:center;justify-content:center;gap:18px}
.pw-tb{position:relative;inline-size:var(--tb);block-size:var(--tb);flex:none;border-radius:8px;overflow:hidden;box-shadow:0 10px 18px -10px rgba(0,0,0,.7)}
.pw-tbi{display:block;inline-size:100%;block-size:100%}
.pw-tl{position:absolute;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
.pw-tm{position:absolute;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6));z-index:2}
.pw-gain{position:absolute;display:grid;place-items:center;transform:translate(-62%,-62%);z-index:3}
.pw-gain{font-size:13px;color:#142B3B;background:var(--felt-gold);border-radius:999px;inline-size:auto!important;block-size:auto!important;padding:2px 8px;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.pw-tghost{position:absolute;box-sizing:border-box;border:3px dashed var(--felt-gold);border-radius:50%;background:rgba(232,166,66,.35);box-shadow:0 0 0 2px rgba(20,43,59,.6);z-index:1}
.pw-opp{margin:0;display:grid;gap:4px}
.pw-opp figcaption{display:flex;align-items:center;gap:6px;color:var(--felt-ink);font-size:13px}
.pw-opp figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.pw-opp figcaption span{margin-inline-start:auto;color:var(--felt-muted);font-size:12px}
.pw-bonus{margin:0;display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:12px}
.pw-bonus img{inline-size:62px}
.pw-q{position:relative;inline-size:var(--qb);block-size:var(--qb);flex:none;border-radius:6px;overflow:hidden;box-shadow:0 10px 18px -10px rgba(0,0,0,.7);direction:ltr}
.pw-qb{display:block;inline-size:100%;block-size:100%}
.pw-pc{position:absolute;overflow:visible}
.pw-pc img{position:absolute;max-inline-size:none;transform-origin:50% 50%}
.pw-pc.is-ghost img{filter:drop-shadow(0 6px 6px rgba(0,0,0,.5))}
.pw-pc.is-hl img{filter:drop-shadow(0 0 2px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold)) drop-shadow(0 0 2px var(--felt-gold))}
.pw-cell{position:absolute;box-sizing:border-box;pointer-events:none}
.pw-cell--ok{box-shadow:inset 0 0 0 2px #5FBF7A;background:rgba(95,191,122,.18);z-index:3}
.pw-cell--free{box-shadow:inset 0 0 0 1.5px rgba(232,166,66,.7);background:rgba(232,166,66,.12)}
.pw-seven{position:absolute;box-sizing:border-box;border:3px solid var(--felt-gold);border-radius:4px;box-shadow:0 0 0 3px rgba(232,166,66,.35);z-index:4}
.pw-me{display:flex;align-items:center;justify-content:center;gap:20px;inline-size:100%}
.pw-side{display:grid;justify-items:center;gap:10px;max-inline-size:240px}
.pw-stats{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.bgv-chip img{inline-size:18px;block-size:18px;margin-inline-end:4px}
.pw-prev{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pw-prev b{font-size:12.5px;padding:3px 8px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink)}
.pw-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pw-won{display:flex;align-items:center;gap:8px}
.pw-won img{inline-size:70px;filter:drop-shadow(0 0 3px var(--felt-gold))}
.cx-phone .gc-table{gap:6px}
.pw-strip--ph{gap:8px;padding:4px 8px 6px;margin-inline:10px;max-inline-size:calc(100% - 20px)}
.pw-strip--ph .pw-pawn img{block-size:36px}
.pw-strip--ph .pw-sc{font-size:10px;padding:2px 4px}
.pw-me--ph{flex-direction:column;gap:6px}
.pw-me--ph .pw-side{display:flex;align-items:center;gap:6px;max-inline-size:none;padding-inline:10px}
.pw-me--ph .pw-prev{display:none}
.pw-me--ph .pw-btns{flex-wrap:nowrap;gap:6px}
.pw-me--ph .pw-won img{inline-size:46px}`,
    shotTitle: 'خرید و گذاشتن تکه', turnSub: 'چرخاندن، برعکس کردن، تأیید',
    diffs: [
      ['چیدمان', 'مثل BGA در حالت نوار: دایرهٔ تکه‌ها از مهرهٔ خنثی شروع می‌شود و سه تکهٔ اول روشن‌اند با قیمت و زمان زیرشان. صفحهٔ زمان وسط، لحاف نیلوفر و نشان ۷×۷ کنارش، لحاف شما پایین'],
      ['خرید', 'تکهٔ انتخاب‌شده روی لحاف می‌نشیند و خانه‌های زیرش سبز می‌شوند. پیش‌نمایش هزینه، جلو رفتن و درآمد کنار لحاف است و جای تازهٔ مهره روی صفحهٔ زمان خط‌چین است. تکه‌ای که پولش نیست خاکستری با «۵ دکمه کم»'],
      ['جلو رفتن', 'دکمهٔ «جلو رفتن» عدد دقیق دکمه‌ها را می‌گوید (§۵). عبور از خانهٔ دکمه درآمد لحاف را کنار مهره نشان می‌دهد (§۶)'],
      ['چرم و ۷×۷', 'تکهٔ چرمی بعد از گذشتن از خانه‌اش فوراً گذاشته می‌شود و همهٔ خانه‌های خالی مجازند (§۸). اولین مربع کامل ۷×۷ قاب طلایی می‌گیرد و نشانش به شما می‌رسد (§۹)'],
      ['پایان', 'جدول دکمه، خانه‌های خالی × ۲−، پاداش ۷×۷ و جمع؛ عددها از روی خود لحاف حساب شده‌اند (§۱۰)'],
      ['قوانین', 'مثل موتور: دونفره، خانه‌های درآمد ۵، ۱۱ تا ۵۳ و تکه‌های چرمی ۲۰، ۲۶، ۳۲، ۳۸ و ۴۴. آرت نسخهٔ BGA (لحاف آبی و قرمز و صفحهٔ زمان آمریکانا)'],
    ],
  };
}
