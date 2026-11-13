// Group A game module: export default (H) => game config. H = helpers from ga.mjs.
import { popCss, say, tbl } from './_ui.mjs';
export default function (H) {
  const { img, fa, ic, esc, CK, OT, playout } = H;

  // a position where white (you) must capture
  let po = null;
  for (let seed = 1; seed < 400 && !po; seed++) {
    const p = playout(CK, 15, seed);
    if (p.s.turn !== 'w') continue;
    const L = CK.legal(p.s);
    const capsDone = p.hist.filter((h) => h.san.includes('x')).length;
    if (L.length && L[0].caps.length && capsDone >= 2) po = p;
  }
  const L = CK.legal(po.s); const m = L[0];
  const cnt = (c) => 12 - po.s.b.filter((x) => x && x.toLowerCase() === c).length;
  const lastM = po.last;
  const N8 = CK.num; const at = (r, c) => r * 8 + c;
  const mk = (list) => { const b = Array(64).fill(null); for (const [r, c, p] of list) { if ((r + c) % 2 !== 1) throw new Error('checkers mock: light square ' + r + c); b[at(r, c)] = p; } return b; };
  const lost = (b, c) => 12 - b.filter((x) => x && x.toLowerCase() === c).length;
  const capNote = (b, who) => { const n = who === 'me' ? lost(b, 'b') : lost(b, 'w'); const c = who === 'me' ? 'black' : 'white'; return n ? `<span class="ga-mini" aria-label="${fa(n)} مهرهٔ گرفته‌شده">${Array.from({ length: Math.min(n, 6) }, () => img(`checkers-${c}-man`)).join('')}<b>${fa(n)}</b></span>` : ''; };
  // §4 Brazilian: your flying king on 29 takes two from a distance; the man on 24 could take one, but the most captures is compulsory
  const bBr = mk([[7, 0, 'W'], [5, 6, 'w'], [6, 3, 'w'], [7, 4, 'w'], [6, 5, 'w'], [4, 3, 'b'], [3, 6, 'b'], [4, 5, 'b'], [0, 3, 'b'], [1, 0, 'b'], [2, 7, 'b'], [0, 5, 'b']]);
  const kBr = at(7, 0), manBr = at(5, 6);
  // §5 English: your man jumps 10 and lands on 2: crowned, the move ends although the new king could take 7
  const bCr = mk([[0, 3, 'W'], [1, 4, 'b'], [0, 7, 'b'], [2, 7, 'b'], [3, 0, 'b'], [4, 3, 'b'], [5, 2, 'w'], [5, 6, 'w'], [6, 1, 'w'], [6, 5, 'w'], [7, 2, 'w'], [7, 6, 'w']]);
  // §6 draw by the 40-move rule: kings only, 40 moves each with no capture and no man moved
  const bDr = mk([[5, 2, 'W'], [6, 7, 'W'], [0, 5, 'B'], [2, 1, 'B']]);
  const histDr = [...po.hist, ...['14-10', '25-22', '10-15', '22-18', '15-11', '18-23', '11-16', '23-27', '16-20', '27-24'].map((san) => ({ san }))];
  return ({
    slug: 'Checkers', fa: 'چکرز', latin: 'Checkers', n: 8, inset: '2.67%', pcSize: '82%', board: 'checkers-board',
    meta: ['زنده', '۵ دقیقه', 'رتبه‌ای'], sideFa: ['سیاه', 'سفید'], notation: 'شمارهٔ خانه‌ها ۱ تا ۳۲',
    piece: (p) => `checkers-${p.toLowerCase() === 'b' ? 'black' : 'white'}-${p === p.toUpperCase() ? 'king' : 'man'}`,
    pieceAlt: (p) => `${p.toLowerCase() === 'b' ? 'سیاه' : 'سفید'}${p === p.toUpperCase() ? '، شاه' : ''}`,
    note: (st, who) => capNote(st.s.b, who), css: popCss + '.cx-phone .cx-ms__m:nth-last-child(n+8){display:none}',
    railCard: () => `<section class="cx-card"><div class="ga-rule">${ic('info')}<span><b>قوانین انگلیسی: گرفتن اجباری است.</b> وقتی مهره‌ای را بشود زد، فقط حرکت‌های زدن مجازند. زدن پشت‌سرهم یک حرکت حساب می‌شود و مهره‌ای که به ردیف آخر برسد شاه می‌شود و حرکتش تمام است.</span></div></section>`,
    turnSub: 'زدن اجباری',
    diffs: [['صفحه', 'همان ۸×۸ شطرنج، فقط خانه‌های تیره بازی می‌شوند؛ تصویر صفحه و مهره‌ها از بستهٔ آماده (BGA)'], ['حرکت', 'مهره را بکشید یا بزنید؛ خانه‌های مجاز نقطه دارند. اگر زدن ممکن باشد فقط مهره‌هایی که می‌زنند قابل انتخاب‌اند و مسیر زدن زنجیره‌ای پررنگ می‌شود'], ['کنار اسم', 'به جای مهره‌های گرفته‌شدهٔ شطرنج، تعداد مهره‌های زده‌شدهٔ حریف'], ['ثبت حرکت', 'شمارهٔ خانه‌ها مثل <bdi dir="ltr">22-18</bdi> و زدن با «x»؛ قوانین انگلیسی (WCDF) مثل موتور فعلی'], ['پایان', 'بی‌مهره یا بی‌حرکت ماندن حریف؛ تکرار سه‌باره و ۴۰ حرکت بدون زدن تساوی']],
    st: { s: po.s, hist: po.hist, turnMe: true, clocks: { me: '3:18', opp: '3:51' }, status: '<b>نوبت شماست.</b> باید بزنید؛ مهره‌ای که می‌زند را انتخاب کنید.', pstatus: '<b>نوبت شما.</b> زدن اجباری است.', bo: { last: lastM ? [lastM.path[0], lastM.path[lastM.path.length - 1]] : [], sel: m.path[0], path: m.path.slice(1, -1), dots: L.filter((x) => x.path[0] === m.path[0]).map((x) => x.path[x.path.length - 1]), caps: m.caps } },
    phases: [
      { shotTitle: 'واریانت برزیلی: شاه پرنده', turnSub: 'زدن بیشترین مهره اجباری است', meta: ['زنده', 'برزیلی', 'رتبه‌ای'],
        st: { s: { b: bBr, turn: 'w' }, hist: po.hist, turnMe: true, clocks: { me: '2:44', opp: '3:02' }, bo: { sel: kBr, path: [at(2, 5)], dots: [at(4, 7)], caps: [at(4, 3), at(3, 6)], last: [at(1, 6), at(2, 7)] },
          status: `<b>نوبت شماست.</b> شاه ${fa(N8(kBr))} از دور دو مهره می‌زند. مهرهٔ ${fa(N8(manBr))} فقط یکی می‌زند، پس انتخاب‌شدنی نیست.`,
          pstatus: `<b>نوبت شما.</b> باید بیشترین را بزنید: شاه ${fa(N8(kBr))}` },
        railCard: () => `<section class="cx-card"><h3>واریانت برزیلی</h3><div class="ga-rule">${ic('info')}<span><b>باید بیشترین مهره را بزنید.</b> اگر چند راه زدن هست، فقط راهی مجاز است که مهرهٔ بیشتری می‌گیرد؛ اینجا شاه دو تا و مهرهٔ ${fa(N8(manBr))} یکی.</span></div><div class="ga-rule" style="margin-block-start:8px">${ic('info')}<span><b>شاه پرنده است.</b> در قطر هر چند خانه می‌رود، از فاصله می‌زند و در هر خانهٔ خالی پشت مهره فرود می‌آید. مهرهٔ ساده رو به عقب هم می‌زند.</span></div></section>`,
        phone: true },
      { shotTitle: 'شاه شد، نوبت تمام', turnSub: 'قوانین انگلیسی', st: { s: { b: bCr, turn: 'b' }, hist: [...po.hist, { san: `${N8(at(2, 1))}x${N8(at(0, 3))}` }], turnMe: false, clocks: { me: '2:31', opp: '2:58' }, bo: { last: [at(2, 1), at(0, 3)] },
          status: `<b>مهرهٔ شما شاه شد</b> و حرکت همین‌جا تمام شد. شاه تازه نمی‌تواند در همین نوبت مهرهٔ ${fa(N8(at(1, 4)))} را بزند. نوبت نیلوفر است.`,
          pstatus: '<b>شاه شد،</b> نوبت تمام. نوبت نیلوفر' },
        ...say(img('checkers-white-king', 'شاه سفید'), 'شاه شد، نوبت تمام', `مهره‌تان با زدن ${fa(N8(at(1, 2)))} به ردیف آخر رسید و شاه شد. در قوانین انگلیسی حرکت همین‌جا تمام می‌شود، حتی اگر شاه بتواند باز هم بزند.`, 'به ردیف آخر رسید و شاه شد؛ ادامهٔ پرش نیست.'),
        phone: true },
      { shotTitle: 'پایان: مساوی', turnSub: 'قانون ۴۰ حرکت', st: { s: { b: bDr, turn: 'w' }, hist: histDr, turnMe: false, clocks: { me: '1:12', opp: '1:40' }, bo: { last: [at(1, 0), at(2, 1)] },
          status: '<b>بازی مساوی شد.</b> ۴۰ حرکت هر طرف بی‌زدن و بی‌حرکت مهرهٔ ساده.', pstatus: '<b>مساوی،</b> قانون ۴۰ حرکت' },
        railCard: () => `<section class="cx-card"><div class="ga-count">حرکت بی‌پیشرفت (بی‌زدن و بی مهرهٔ ساده)<b>${fa(40)} از ${fa(40)}</b><i style="--p:100%"></i></div><div class="ga-rule" style="margin-block-start:10px">${ic('info')}<span>شمارنده با هر زدن یا حرکت مهرهٔ ساده صفر می‌شود. تکرار سه‌بارهٔ یک وضعیت هم مساوی است.</span></div></section>`,
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('بازی دوباره', 'primary', 'repeat')}${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        overlay: () => H.modal('مساوی', `<p>۴۰ حرکت هر طرف (۸۰ نیم‌حرکت) گذشت و نه مهره‌ای زده شد و نه مهرهٔ ساده‌ای جلو رفت.</p>${tbl(['دلیل مساوی', 'این بازی'], [{ c: ['قانون ۴۰ حرکت', '۴۰ از ۴۰'], win: true }, { c: ['تکرار سه‌بارهٔ یک وضعیت', 'نه'] }, { c: ['توافق دو طرف', 'نه'] }])}`, `${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
    ],
  });

}
