// Group A game module: Line Three («دوز», repo games/line-three, isTestGame). 3×3, X moves first, three in a row wins,
// full board = draw. One game per table (the engine has no rounds / best-of-N). Cells 0..8 row-major from the top-left, never mirrored.
import { popCss, pop } from './_ui.mjs';
export default function (H) {
  const bd = (L) => L.map(([a, b]) => [a, b.replace(/«([A-Za-z0-9<>+\-:. ]+)»/g, '«<bdi dir="ltr">$1</bdi>»')]);
  const { img, fa, ic, ART } = H;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const name = (i) => 'abc'[i % 3] + (3 - Math.floor(i / 3)); // a1 = bottom-left
  // scripted legal game: X b2, O a3, X c3 → X threatens a1 (c3-b2-a1); O (you) must block
  const moves = [4, 0, 2];
  const b = Array(9).fill(null); const hist = [];
  moves.forEach((c, k) => { if (b[c]) throw new Error('taken'); b[c] = k % 2 ? 'O' : 'X'; hist.push({ san: name(c) }); });
  const threats = LINES.filter((l) => l.filter((i) => b[i] === 'X').length === 2 && l.some((i) => !b[i])).map((l) => l.find((i) => !b[i]));
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  // same game played on: O blocks a1, X slips with c1, O completes column a
  const endMoves = [...moves, 6, 8, 3]; const be = Array(9).fill(null); const histEnd = [];
  endMoves.forEach((c, k) => { if (be[c]) throw new Error('taken'); be[c] = k % 2 ? 'O' : 'X'; histEnd.push({ san: name(c) }); });
  const winLine = LINES.find((l) => l.every((i) => be[i] === 'O'));
  if (!winLine || LINES.some((l) => l.every((i) => be[i] === 'X'))) throw new Error('line-three mock: no O win');

  const css = `
.l3-board{position:relative;block-size:var(--b,572px);aspect-ratio:372/420;background:var(--img) center/100% 100% no-repeat;border-radius:6px;box-shadow:0 4px 0 rgba(0,0,0,.28),0 18px 30px -18px rgba(0,0,0,.6);flex:none;align-self:center}
.l3-grid{position:absolute;inset:5.95% 1.6% 7.14% 1.6%;direction:ltr;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
.l3-c{position:relative;display:grid;place-items:center;margin:4%;border-radius:12px}
.l3-c>img{inline-size:72%;block-size:72%;object-fit:contain;filter:drop-shadow(0 3px 2px rgba(0,0,0,.4))}
.l3-c.is-last{box-shadow:inset 0 0 0 3px rgba(232,166,66,.75)}
.l3-c.is-dot::after{content:"";inline-size:16%;block-size:16%;border-radius:50%;background:rgba(250,245,236,.5)}
.l3-c.is-threat{background:rgba(232,166,66,.22);box-shadow:inset 0 0 0 3px #E8A642}
.l3-c.is-threat::after{inline-size:20%;block-size:20%;background:#F4C27A}
.l3-c.is-win{background:rgba(232,166,66,.25)}
.l3-line{position:absolute;inset:5.95% 1.6% 7.14% 1.6%;inline-size:96.8%;block-size:86.91%;overflow:visible;pointer-events:none;z-index:2}
.l3-line line{stroke:#E8A642;stroke-width:12px;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.cx-phone .l3-line line{stroke-width:8px}
.l3-sym{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.l3-sym>div{display:flex;align-items:center;gap:10px;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 12px;font-size:14px;color:var(--text)}
.l3-sym img{inline-size:30px;block-size:30px}
.l3-sym b{display:block;color:var(--heading)}
[data-theme="dark"] .l3-tag{color:#F4C27A;background:rgba(232,166,66,.16)}
.l3-tag{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#8D581A;background:rgba(232,166,66,.18);border-radius:999px;padding:2px 10px;justify-self:start}
` + popCss;
  function boardHtml(g, s, o = {}) {
    const cells = s.b.map((v, i) => {
      const cls = ['l3-c']; if (o.last === i) cls.push('is-last'); if (o.win?.includes(i)) cls.push('is-win'); if (!v && o.dots?.includes(i)) cls.push('is-dot'); if (o.threat?.includes(i)) cls.push('is-threat');
      return `<span class="${cls.join(' ')}">${v ? img(v === 'X' ? 'line-three-x' : 'line-three-o', `${v} در ${name(i)}`) : ''}</span>`;
    }).join('');
    const c = (i) => [(i % 3) + 0.5, Math.floor(i / 3) + 0.5]; const line = o.win ? (() => { const [x1, y1] = c(o.win[0]), [x2, y2] = c(o.win[2]); const dx = (x2 - x1) * 0.18, dy = (y2 - y1) * 0.18; return `<svg class="l3-line" viewBox="0 0 3 3" preserveAspectRatio="none" aria-label="خط برنده"><line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}"/></svg>`; })() : '';
    return `<div class="l3-board" style="--img:url(${ART['line-three-board']});${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="جدول ۳×۳ دوز"><div class="l3-grid">${cells}</div>${line}</div>`;
  }
  const cnt = (m, bb = b) => bb.filter((v) => v === m).length;
  return {
    slug: 'LineThree', fa: 'دوز', latin: 'Line Three', meta: ['زنده', 'آزمایشی', 'دوستانه'], sideFa: ['X', 'O'], notation: 'ستون a تا c، ردیف ۱ تا ۳',
    boardHtml, css,
    note: (st, who) => { const m = who === 'me' ? 'O' : 'X'; return `<span class="ga-mini">${img(m === 'X' ? 'line-three-x' : 'line-three-o')}<b>${fa(cnt(m, st.s.b))} خانه</b></span>`; },
    railCard: () => `<section class="cx-card"><span class="l3-tag">${ic('info')}بازی آزمایشی</span><div class="l3-sym"><div>${img('line-three-o', 'O')}<span><b>مینا</b>O، نفر دوم</span></div><div>${img('line-three-x', 'X')}<span><b>نیلوفر</b>X، شروع‌کننده</span></div></div><div class="ga-rule">${ic('info')}<span>سه نشان در یک ردیف، ستون یا قطر برنده است؛ اگر جدول پر شود و خطی کامل نشود، مساوی است. هر میز یک دست است و امتیاز سری ندارد.</span></div></section>`,
    noDraw: true,
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${H.btn('تسلیم', 'leave', 'flag')}${H.ibtn('list', 'قوانین بازی', 'secondary')}${H.ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
    turnSub: 'بستن خط حریف',
    diffs: bd([
      ['وضعیت', 'بازی خانگی و آزمایشی (isTestGame)؛ برچسب «آزمایشی» در نوار بالا و کارت ستون کنار دیده می‌شود'],
      ['صفحه', 'جدول ۳×۳ چوبی از بستهٔ آماده، کمی بلندتر از مربع (نسبت تصویر اصلی)؛ نشان‌های X و O از همان بسته'],
      ['حرکت', 'روی هر خانهٔ خالی بزنید (نقطه دارد). اگر حریف دو نشان در یک خط دارد، خانهٔ سوم با کادر نارنجی پررنگ می‌شود'],
      ['کنار اسم', 'نشان هر بازیکن و شمار خانه‌هایش؛ مهرهٔ گرفته‌شده‌ای در کار نیست'],
      ['امتیاز سری', 'موتور دور یا «بهترین از چند دست» ندارد، پس کارت امتیاز نداریم؛ اگر بعداً اضافه شود، جایش همین کارت ستون کنار است'],
      ['پایان', 'خط برنده روی سه خانه کشیده می‌شود (winningLine موتور، §۴)'], ['دکمه‌ها', 'فقط «تسلیم»؛ مساوی خودکار است (پر شدن جدول) و پیشنهاد مساوی معنا ندارد'],
    ]),
    st: {
      s: { b }, hist, turnMe: true, clocks: { me: '0:41', opp: '0:52' },
      status: `<b>نوبت شماست.</b> X دو نشان در قطر دارد؛ خانهٔ ${threats.map(name).join('، ')} را ببندید.`,
      pstatus: `<b>نوبت شما.</b> خط X را در ${threats.map(name).join('، ')} ببندید.`,
      bo: { last: moves.at(-1), dots: empty, threat: threats },
    },
    phases: [
      { shotTitle: 'پایان با خط برنده', turnSub: 'سه O در ستون a', st: { s: { b: be }, hist: histEnd, turnMe: false, clocks: { me: '0:33', opp: '0:40' }, bo: { last: endMoves.at(-1), win: winLine },
          status: '<b>شما بردید.</b> سه O در ستون a؛ نیلوفر با c1 خط c2 را تهدید کرد ولی دیر شد.', pstatus: '<b>شما بردید.</b> سه O در ستون a' },
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${H.btn('بازی دوباره', 'primary', 'repeat')}${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        feltExtra: (st, ph) => (ph ? '' : pop(img('line-three-o', 'O'), 'شما بردید', 'سه O در ستون a، خط برنده روی جدول کشیده شد. اگر جدول بی‌خط پر می‌شد، بازی مساوی بود.', `${H.btn('بازگشت به لابی', 'secondary', 'back')}${H.btn('بازی دوباره', 'primary', 'repeat')}`, true)),
        phone: true },
    ],
  };
}
