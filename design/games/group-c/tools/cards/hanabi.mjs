// Hanabi on the card-table frame (cooperative, as the repo engine: 50 cards, hands of 4 with 4 players, 8 clues, 3 fuses).
// Mock: 4 players. Fireworks r2 y1 g3 b0 w1 = 7 played; 4 discarded (one was a misplay → 1 fuse burned); 16 in hands
// → deck 50 − 16 − 7 − 4 = 23. Clue tokens 5 of 8. Teammates (you see them): Niloufar b3 g4 r1 w5 · Reza y2 r4 b1 g1 ·
// Sara w2 y5 b2 r3. Your hand: 4 unknown cards; you were told card 2 is a «5» (Reza) and card 4 is «red» (Sara).
// Your turn: you're giving Niloufar the clue «green», which touches only her g4 — playable on green 3.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const CFA = { r: 'قرمز', y: 'زرد', g: 'سبز', b: 'آبی', w: 'سفید' };
  const HEX = { r: '#E3053A', y: '#F2D22E', g: '#2BB673', b: '#1BA6E8', w: '#F4F4F4' };
  const c = (id) => `hanabi-${id}`;
  const alt = (id) => `${CFA[id[0]]} ${fa(Number(id[1]))}`;
  const team = [['نیلوفر', 2, ['b3', 'g4', 'r1', 'w5'], 'g'], ['رضا', 6, ['y2', 'r4', 'b1', 'g1']], ['سارا', 4, ['w2', 'y5', 'b2', 'r3']]];
  const handRow = ([name, seat, cards, hit], ph) => `<div class="hb-hand${hit ? ' is-target' : ''}"><span class="hb-hand__n"><i style="background:var(--seat-${seat})"></i>${name}</span><span class="hb-hand__c">${cards.map((id) => `<span class="hb-c${hit && id[0] === hit ? ' is-hit' : ''}">${img(c(id), alt(id))}</span>`).join('')}</span></div>`;
  const STACK = { r: 2, y: 1, g: 3, b: 0, w: 1 };
  const fw = (k, i) => `<span class="hb-fw">${STACK[k] ? img(c(`${k}${STACK[k]}`), alt(`${k}${STACK[k]}`)) : `<span class="hb-empty">${img(`hanabi-symbol-${i + 1}`, '')}</span>`}<small><i style="background:${HEX[k]}"></i>${fa(STACK[k])}</small></span>`;
  const clueRow = (ph) => `<div class="hb-clue${ph ? ' hb-clue--ph' : ''}" role="group" aria-label="راهنمایی"><span class="hb-clue__l">${ph ? 'به نیلوفر' : 'راهنما به <b>نیلوفر</b>'}</span>
<span class="hb-clue__g">${Object.keys(CFA).map((k) => `<button type="button" class="hb-b hb-b--c${k === 'g' ? ' is-sel' : ''}" aria-label="${CFA[k]}"><i style="background:${HEX[k]}"></i></button>`).join('')}</span>
<span class="hb-clue__g">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="hb-b">${fa(n)}</button>`).join('')}</span>
${ph ? '' : btn('بده (−۱ نشانه)', 'primary', 'check')}</div>`;
  const { modal } = H;
  const DISC = [['y1', ''], ['b2', 'اشتباه'], ['r3', ''], ['g1', '']];
  const discs = (list) => `<div class="hb-disc">${Object.keys(CFA).map((k) => { const l = list.filter(([id]) => id[0] === k); return `<div class="hb-disc__r"><i style="background:${HEX[k]}"></i>${l.length ? l.map(([id, t]) => `<span class="hb-dc${t ? ' is-mis' : ''}">${img(c(id), alt(id))}${t ? `<em>${t}</em>` : ''}</span>`).join('') : '<small>—</small>'}</div>`; }).join('')}</div>`;
  const discModal = (ph) => modal('کارت‌های دورریخته', `<p>همهٔ کارت‌هایی که دور ریخته یا به اشتباه بازی شده، به ترتیب رنگ. از هر رنگ سه تا ۱، دو تا ۲ تا ۴ و فقط یک ۵ هست.</p>${discs(DISC)}<p class="cx-note">آبی ۲ با اشتباه رضا دور رفت؛ یکی دیگر هنوز در بازی است (دست سارا).</p>`, `${btn('بستن', 'secondary', 'x')}`);
  const tableEnd = (st, deck, last) => (ph) => `<div class="hb-board"><div class="hb-mid"><div class="hb-fws">${Object.keys(CFA).map((k, i) => `<span class="hb-fw">${st[k] ? img(c(`${k}${st[k]}`), alt(`${k}${st[k]}`)) : `<span class="hb-empty">${img(`hanabi-symbol-${i + 1}`, '')}</span>`}<small><i style="background:${HEX[k]}"></i>${fa(st[k])}</small></span>`).join('')}</div>
<div class="hb-tok">${deck === 0 ? `<span class="hb-last">${ic('stopwatch')}<b>دسته تمام شد</b><small>${last}</small></span>` : ''}</div></div></div>`;
  const ending = (ph) => modal('پایان بازی: ۲۱ امتیاز', `<p>آخرین دور بعد از تمام شدن دسته بازی شد. امتیاز تیم جمع بالاترین کارت هر رنگ است.</p><table class="gd-score"><thead><tr><th>رنگ</th><th class="n">بالاترین کارت</th></tr></thead><tbody>${[['r', 5], ['y', 4], ['g', 5], ['b', 3], ['w', 4]].map(([k, n]) => `<tr><td><span class="hb-sw" style="background:${HEX[k]}"></span>${CFA[k]}</td><td class="n">${fa(n)}</td></tr>`).join('')}<tr class="is-win"><td>جمع</td><td class="n">${fa(21)} از ${fa(25)}</td></tr></tbody></table><p class="cx-note">اگر سومین فیتیله بسوزد بازی همان لحظه با باخت تیم تمام می‌شود (امتیاز صفر).</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Hanabi', fa: 'هانابی', latin: 'Hanabi', meta: ['زنده', '۴ نفر', 'همکاری'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `<span>${fa(4)} کارت</span><span class="gc-tag">هدف راهنما</span>` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `<span>${fa(4)} کارت</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `<span>${fa(4)} کارت</span>` },
    ],
    me: {
      cards: [1, 2, 3, 4].map((k) => ({ art: 'hanabi-back', alt: k === 2 ? 'کارت ۲: پنج' : k === 4 ? 'کارت ۴: قرمز' : `کارت ${fa(k)}: نامعلوم` })),
      clock: '0:51', turn: true, note: 'دست خودتان را نمی‌بینید', above: (ph) => clueRow(ph),
    },
    cardW: 54, phoneCardW: 38, cardRatio: 2.86,
    table: (ph) => `<div class="hb-board"><div class="hb-hands">${team.map((t) => handRow(t, ph)).join('')}</div>
<div class="hb-mid"><div class="hb-fws" aria-label="آتش‌بازی‌ها، امتیاز ${fa(7)}">${Object.keys(CFA).map(fw).join('')}</div>
<div class="hb-tok"><span class="hb-clues" aria-label="${fa(5)} نشانهٔ راهنما از ${fa(8)}">${Array.from({ length: 8 }, (_, k) => img('hanabi-clue', '', k < 5 ? '' : 'is-off')).join('')}</span><small>${fa(5)} نشانهٔ راهنما</small>
<span class="hb-fuse">${img('hanabi-fuse-1', 'یک فیتیله سوخته')}</span><small>${fa(1)} از ${fa(3)} فیتیله سوخته<span class="bgv-sep"></span>دسته ${fa(23)}</small></div></div></div>`,
    status: '<b>بازی گروهی؛ نوبت شماست.</b> به نیلوفر بگویید کدام کارتش «سبز» است؛ فقط ۴ سبز او لمس می‌شود و آمادهٔ بازی است.',
    pstatus: '<b>نوبت شما.</b> راهنمای «سبز» به نیلوفر.',
    railCard: `<section class="cx-card"><h3>تیم</h3><div class="gc-pills"><span class="bgv-chip">امتیاز ${fa(7)} از ${fa(25)}</span><span class="bgv-chip">نشانه ${fa(5)}</span><span class="bgv-chip">فیتیله ${fa(1)} از ${fa(3)}</span><span class="bgv-chip">دورریخته ${fa(4)}</span></div><div class="ga-rule">${ic('info')}<span>دانسته‌های شما از دست خودتان: کارت ۲ «پنج» است (رضا گفت) و کارت ۴ «قرمز» (سارا گفت). راهنما فقط یک رنگ یا یک عدد است و همهٔ کارت‌های جور را نشان می‌دهد.</span></div></section>`,
    logNote: 'دسته: ۲۳',
    log: [[2, 'نیلوفر ۳ سبز را بازی کرد'], [6, 'رضا به شما گفت: «۵» (کارت ۲)'], [4, 'سارا به شما گفت: «قرمز» (کارت ۴)'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${btn('بازی کارت', 'secondary', 'hand')}${btn('دور انداختن', 'secondary', 'x')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
    dockItems: [['check', 'راهنما'], ['hand', 'بازی'], ['x', 'دور انداختن'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'کپهٔ دورریخته', turnSub: 'دیدن کارت‌های دورریخته به ترتیب رنگ', overlay: discModal,
        status: '<b>کپهٔ دورریخته را باز کردید.</b> پیش از دور ریختن یا بازی، ببینید کدام کارت‌ها دیگر در بازی نیستند.',
        log: [[6, 'رضا آبی ۲ را بازی کرد؛ اشتباه بود'], [4, 'سارا زرد ۱ را دور ریخت'], [1, 'شما کپهٔ دورریخته را باز کردید']],
        phone: true,
      },
      {
        shotTitle: 'نوبت‌های آخر', turnSub: 'دسته تمام شد؛ هر نفر یک نوبت دیگر', meta: ['زنده', '۴ نفر', 'همکاری', 'نوبت‌های آخر'],
        table: tableEnd({ r: 5, y: 4, g: 4, b: 3, w: 4 }, 0, 'سه نوبت آخر مانده: شما، نیلوفر، رضا'),
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `<span>${fa(4)} کارت</span><span class="gc-tag gc-tag--soft">یک نوبت مانده</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `<span>${fa(4)} کارت</span><span class="gc-tag gc-tag--soft">یک نوبت مانده</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `<span>${fa(3)} کارت</span><span class="gc-tag gc-tag--soft">نوبتش تمام شد</span>` },
        ],
        me: { above: () => '', note: 'آخرین نوبت شما' },
        status: '<b>دسته تمام شد.</b> سارا آخرین کارت را کشید؛ حالا هر نفر، از جمله سارا که دسته را تمام کرد، فقط یک نوبت دیگر دارد. سه نوبت مانده.',
        pstatus: '<b>دسته تمام شد.</b> سه نوبت آخر مانده.',
        log: [[4, 'سارا آخرین کارت دسته را کشید'], [1, 'نوبت‌های آخر: شما، نیلوفر، رضا']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'امتیاز تیم یا باخت با سه فیتیله', overlay: ending, meta: ['تمام شد', '۴ نفر', 'همکاری'],
        table: tableEnd({ r: 5, y: 4, g: 5, b: 3, w: 4 }, 1, ''),
        me: { turn: false, clock: '', above: () => '' }, railCard: '',
        status: '<b>بازی تمام شد.</b> تیم ۲۱ امتیاز گرفت.',
        log: [[2, 'نیلوفر سبز ۵ را بازی کرد'], [6, 'رضا آخرین نوبتش را بازی کرد'], [1, 'تیم: ۲۱ امتیاز']],
      },
    ],    css: `.hb-disc{display:grid;gap:6px}.hb-disc__r{display:flex;align-items:center;gap:6px;min-block-size:30px}.hb-disc__r>i{inline-size:12px;block-size:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}.hb-disc__r small{color:var(--text-muted)}
.hb-dc{position:relative}.hb-dc img{display:block;inline-size:20px;border-radius:3px}.hb-dc.is-mis img{box-shadow:0 0 0 2px #C8553D}.hb-dc em{position:absolute;inset-block-start:2px;inset-inline-start:24px;font-style:normal;font-size:11px;color:#C8553D;font-weight:700;white-space:nowrap}
.hb-last{display:grid;justify-items:center;gap:2px;padding:8px 14px;border-radius:12px;background:rgba(232,166,66,.16);box-shadow:inset 0 0 0 1.5px var(--felt-gold);color:var(--felt-ink)}.hb-last .bgv-icon{color:var(--felt-gold)}.hb-last small{color:var(--felt-muted);font-size:12px}
.hb-sw{display:inline-block;inline-size:10px;block-size:10px;border-radius:50%;margin-inline-end:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.gc-card{margin-inline-start:14px}.gc-card:first-child{margin-inline-start:0}
.gc-card::after{position:absolute;inset-inline:4px;inset-block-end:8px;display:grid;place-items:center;block-size:24px;border-radius:6px;background:rgba(20,43,59,.85);color:#FAF5EC;font-size:13px;font-weight:800}
.gc-card:nth-child(2)::after{content:"۵"}
.gc-card:nth-child(4)::after{content:"قرمز";background:#E3053A}
.cx-phone .gc-card{margin-inline-start:10px}.cx-phone .gc-card:first-child{margin-inline-start:0}.cx-phone .gc-card::after{font-size:11px;block-size:18px;inset-block-end:5px}
.hb-board{display:grid;gap:14px;justify-items:center}
.hb-hands{display:flex;gap:16px}
.hb-hand{display:grid;justify-items:center;gap:4px;padding:6px 8px;border-radius:10px;background:rgba(8,20,28,.28)}
.hb-hand.is-target{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.hb-hand__n{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--felt-ink)}.hb-hand__n i{inline-size:8px;block-size:8px;border-radius:50%}
.hb-hand__c{direction:ltr;display:flex;gap:4px}
.hb-c img{display:block;inline-size:34px;border-radius:4px}
.hb-c.is-hit img{box-shadow:0 0 0 2px #FAF5EC,0 0 0 4px var(--felt-gold)}
.hb-mid{display:flex;align-items:center;gap:22px}
.hb-fws{direction:ltr;display:flex;gap:10px}
.hb-fw{display:grid;justify-items:center;gap:4px}.hb-fw img{display:block;inline-size:44px;border-radius:5px;box-shadow:0 8px 14px -8px rgba(0,0,0,.7)}
.hb-empty{display:grid;place-items:center;inline-size:44px;block-size:115px;border-radius:5px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.2)}.hb-empty img{inline-size:34px;box-shadow:none}
.hb-fw small{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--felt-ink)}.hb-fw small i{inline-size:9px;block-size:9px;border-radius:50%}
.hb-tok{display:grid;justify-items:center;gap:4px;color:var(--felt-muted);font-size:11.5px}
.hb-clues{display:grid;grid-template-columns:repeat(4,22px);gap:3px}.hb-clues img{inline-size:22px}.hb-clues img.is-off{opacity:.25;filter:grayscale(1)}
.hb-fuse img{inline-size:150px;border-radius:6px;margin-block-start:6px}
.hb-clue{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.35);color:var(--felt-ink);font-size:13px}
.hb-clue__l{white-space:nowrap}.hb-clue__g{display:flex;gap:4px}
.hb-b{all:unset;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;inline-size:32px;block-size:32px;border-radius:8px;background:var(--felt-control);color:#142B3B;font-weight:800;font-size:15px;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 2px 0 #0D1A23}
.hb-b i{inline-size:16px;block-size:16px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.hb-b.is-sel{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 2px 0 #0D1A23}
.hb-clue .bgv-btn{white-space:nowrap}
.cx-phone .hb-hands{gap:5px}.cx-phone .hb-hand{padding:4px}.cx-phone .hb-c img{inline-size:20px;border-radius:2px}.cx-phone .hb-hand__c{gap:2px}.cx-phone .hb-hand__n{font-size:10.5px}
.cx-phone .hb-mid{gap:8px}.cx-phone .hb-fws{gap:5px}.cx-phone .hb-fw img,.cx-phone .hb-empty{inline-size:28px}.cx-phone .hb-empty{block-size:73px}.cx-phone .hb-empty img{inline-size:22px}
.cx-phone .hb-fuse{display:none}.cx-phone .hb-clues{grid-template-columns:repeat(4,16px)}.cx-phone .hb-clues img{inline-size:16px}.cx-phone .hb-tok small:last-child{display:none}.cx-phone .hb-board{gap:8px}
.hb-clue--ph{margin-inline:10px;justify-content:center;gap:5px;padding:5px}.hb-clue--ph .hb-b{inline-size:28px;block-size:28px;font-size:13px}.hb-clue--ph .hb-clue__l{font-size:11.5px}`,
    shotTitle: 'نوبت شما', turnSub: 'راهنمای رنگ یا عدد',
    diffs: [
      ['دست‌های دیگران', 'همه‌چیز برعکس بازی‌های دیگر است: کارت‌های هم‌تیمی‌ها رو و وسط میز دیده می‌شوند، ولی دست خودتان پشت است'],
      ['دانسته‌ها', 'راهنماهایی که گرفته‌اید روی کارت‌های خودتان برچسب می‌شود (عدد یا رنگ)؛ بقیهٔ کارت‌هایتان نامعلوم می‌ماند'],
      ['راهنما', 'بالای دست: نام هم‌تیمی، پنج رنگ و پنج عدد؛ با انتخاب، کارت‌هایی که لمس می‌شوند در دست او حاشیهٔ طلایی می‌گیرند. هر راهنما یک نشانه خرج می‌کند'],
      ['آتش‌بازی‌ها', 'پنج ستون رنگی با بالاترین کارت هر رنگ؛ ستون خالی نشان کم‌رنگ آن رنگ را دارد. نشانه‌ها (۸ تایی) و تصویر فیتیله‌ها کنارش'],
      ['بازی و دور انداختن', 'با انتخاب کارتی از دست خودتان دکمه‌های «بازی» و «دور انداختن» فعال می‌شوند (در ستون کنار و نوار پایین گوشی)'],
      ['قوانین', 'مثل موتور: ۲ تا ۵ نفر، ۵ کارت (۴ کارت برای ۴ و ۵ نفر)؛ سه فیتیله یعنی باخت تیم، وگرنه امتیاز جمع ستون‌هاست'],
    ],
  };
}
