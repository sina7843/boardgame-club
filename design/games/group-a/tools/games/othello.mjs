// Group A game module: export default (H) => game config. H = helpers from ga.mjs.
import { popCss, say, tbl } from './_ui.mjs';
export default function (H) {
  const { img, fa, ic, esc, CK, OT, playout } = H;

  let po = null;
  for (let seed = 3; seed < 400 && !po; seed++) { const p = playout(OT, 23, seed); if (p.s.turn === 'w' && OT.legal(p.s).length >= 6) po = p; }
  const L = OT.legal(po.s);
  const b = OT.count(po.s.b, 'b'), w = OT.count(po.s.b, 'w');
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  // full random games: §4 Niloufar (black) has no move while you (white) do; §5 game over with empty squares and you ahead
  let pass = null, end = null;
  for (let seed = 1; seed < 20000 && (!pass || !end); seed++) {
    const R = rng(seed); let s = OT.start(); const hist = []; let last = null;
    for (let k = 0; k < 70; k++) {
      let L = OT.legal(s);
      if (!L.length) {
        const o = { ...s, turn: s.turn === 'b' ? 'w' : 'b' };
        if (!OT.legal(o).length) { const e = s.b.filter((x) => !x).length; const W = OT.count(s.b, 'w'), B = OT.count(s.b, 'b'); if (!end && e >= 2 && e <= 9 && W > B) end = { s, hist: [...hist], last, e, W, B }; break; }
        if (!pass && s.turn === 'b' && k > 30) pass = { s: o, hist: [...hist, { san: 'pass' }], last };
        s = o; hist.push({ san: 'pass' }); L = OT.legal(s);
      }
      const m = L[Math.floor(R() * L.length)]; const r = OT.play(s, m); s = r.s; hist.push({ san: r.san }); last = m;
    }
  }
  if (!pass || !end) throw new Error('othello: no pass / end position');
  const PL = OT.legal(pass.s);
  const scoreCard = (st) => { const W = OT.count(st.s.b, 'w'), B = OT.count(st.s.b, 'b'); return `<div class="ga-score" aria-label="شمار مهره‌ها"><span class="ga-score__p">${img('othello-white-disc', 'سفید')}<span>مینا</span><b class="ga-score__n">${fa(W)}</b></span><span class="ga-score__vs">در برابر</span><span class="ga-score__p">${img('othello-black-disc', 'سیاه')}<span>نیلوفر</span><b class="ga-score__n">${fa(B)}</b></span></div>`; };
  return ({
    slug: 'Othello', fa: 'اتللو', latin: 'Othello', n: 8, inset: '4.97%', pcSize: '86%', board: 'othello-board',
    meta: ['زنده', '۵ دقیقه', 'رتبه‌ای'], sideFa: ['سیاه', 'سفید'], notation: 'ستون a تا h، ردیف ۱ تا ۸',
    piece: (p) => `othello-${p === 'b' ? 'black' : 'white'}-disc`, pieceAlt: (p) => (p === 'b' ? 'مهرهٔ سیاه' : 'مهرهٔ سفید'),
    css: popCss + '.cx-phone .cx-ms__m:nth-last-child(n+11){display:none}', noDraw: true,
    note: (st, who) => { const n = OT.count(st.s.b, who === 'me' ? 'w' : 'b'); return `<span class="ga-mini">${img(who === 'me' ? 'othello-white-disc' : 'othello-black-disc')}<b>${fa(n)} مهره</b></span>`; },
    railCard: (st) => `<section class="cx-card">${scoreCard(st)}<div class="ga-rule">${ic('info')}<span>اگر حرکت مجازی نداشته باشید، نوبت خودکار رد می‌شود؛ اعلانش روی میز و پیامش در گفت‌وگو می‌آید.</span></div></section>`,
    turnSub: 'خانه‌های مجاز',
    diffs: [['صفحه', 'سبز ۸×۸ با مهره‌های دورو از بستهٔ آماده (BGA)'], ['حرکت', 'روی خانهٔ نقطه‌دار بزنید؛ با نگه داشتن نشانگر روی یک خانه، مهره‌هایی که برمی‌گردند کم‌رنگ دیده می‌شوند'], ['کنار اسم', 'به جای مهره‌های گرفته‌شده، شمار مهره‌های هر رنگ؛ در ستون کنار هم امتیاز درشت'], ['رد نوبت', 'دکمه ندارد؛ وقتی حرکت مجاز نیست خودکار انجام می‌شود (قانون WOF مثل موتور) و اعلانش روی میز می‌آید (§۴)'], ['دکمه‌ها', 'فقط «تسلیم»؛ اتللو پیشنهاد مساوی ندارد و همیشه با شمارش تمام می‌شود'], ['پایان', 'پر شدن صفحه یا بی‌حرکت ماندن هر دو؛ بیشترین مهره برنده است و خانه‌های خالی به برنده می‌رسد (§۵)']],
    st: { s: po.s, hist: po.hist, turnMe: true, clocks: { me: '2:47', opp: '3:05' }, status: '<b>نوبت شماست.</b> روی یکی از خانه‌های نقطه‌دار مهره بگذارید.', pstatus: `<b>نوبت شما.</b> ${fa(L.length)} حرکت مجاز`, bo: { last: [po.last.sq], dots: L.map((x) => x.sq), flip: L[0].flips, sel: L[0].sq } },
    phases: [
      { shotTitle: 'نیلوفر حرکت نداشت', turnSub: 'نوبت خودکار رد شد', st: { s: pass.s, hist: pass.hist, turnMe: true, clocks: { me: '1:52', opp: '2:10' }, bo: { last: [pass.last.sq], dots: PL.map((x) => x.sq) },
          status: '<b>دوباره نوبت شماست.</b> نیلوفر هیچ خانهٔ مجازی نداشت و نوبتش خودکار رد شد.', pstatus: '<b>دوباره نوبت شما.</b> نیلوفر حرکت نداشت' },
        ...say(img('othello-black-disc', 'مهرهٔ سیاه'), 'نیلوفر حرکت نداشت', 'هیچ خانه‌ای برای نیلوفر مهره‌ای را برنمی‌گرداند، پس نوبتش رد شد. دوباره نوبت شماست.', 'نوبتش رد شد؛ دوباره نوبت شماست.'),
        phone: true },
      { shotTitle: 'پایان بازی', turnSub: 'خانه‌های خالی به برنده می‌رسد', st: { s: end.s, hist: end.hist, turnMe: false, clocks: { me: '0:48', opp: '1:15' }, bo: { last: [end.last.sq] },
          status: `<b>بازی تمام شد.</b> هیچ‌کدام حرکتی نداشتید. شما ${fa(end.W)} مهره و ${fa(end.e)} خانهٔ خالی، یعنی ${fa(end.W + end.e)} در برابر ${fa(end.B)}.`, pstatus: `<b>شما بردید،</b> ${fa(end.W + end.e)} در برابر ${fa(end.B)}` },
        railCard: (st) => `<section class="cx-card">${scoreCard(st)}<div class="ga-rule">${ic('info')}<span>${fa(end.e)} خانهٔ خالی ماند؛ طبق قانون مسابقات (WOF) به برنده داده می‌شود.</span></div></section>`,
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('بازی دوباره', 'primary', 'repeat')}${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        overlay: () => H.modal(`شما بردید: ${fa(end.W + end.e)} در برابر ${fa(end.B)}`, `<p>هیچ‌کدام حرکت مجازی نداشتید، پس بازی پیش از پر شدن صفحه تمام شد.</p>${tbl(['بازیکن', 'مهره', 'خانهٔ خالی', 'جمع'], [{ c: ['شما (سفید)', fa(end.W), `${fa(end.e)}+`, fa(end.W + end.e)], win: true }, { c: ['نیلوفر (سیاه)', fa(end.B), '۰', fa(end.B)] }])}<p class="cx-note">اگر شمار مهره‌ها برابر بود، بازی مساوی می‌شد.</p>`, `${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
    ],
  });

}
