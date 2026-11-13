// Cryptid on the group D frame. No BGA version: the pack art is the site's own render (standard example map 1113×998, clue strips 392×52,
// disc/cube markers cut out of their 77×77 squares). Map cells and the three clue sets come from cryptid-std.json (made by tools/cr_geo.py
// from the pack's export-spec SVG, viewBox 392×351, flat-top hexes r=20, odd columns shifted down).
// Mock: 3 players. You (blue) hold «within 2 of a standing stone», Niloufar (yellow) «forest or desert», Reza (teal) «within 2 of a shack».
// Only column 3 row 4 satisfies all three. Every disc/cube below is checked against its owner's clue.
import { readFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(new URL('./cryptid-std.json', import.meta.url), 'utf8'));
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const CL = { b: 'clue-016', y: 'clue-000', t: 'clue-017' };
  const SET = Object.fromEntries(Object.entries(CL).map(([k, c]) => [k, new Set(D.sets[c].map(([x, y]) => `${x},${y}`))]));
  const WHO = { b: 'شما', y: 'نیلوفر', t: 'رضا' };
  const pos = (c, r) => [(38 + 30 * c) / 392 * 100, (35.3 + 34.64 * r + (c % 2 ? 17.32 : 0)) / 351 * 100];
  const lab = (c, r) => `ستون ${fa(c + 1)}، ردیف ${fa(r + 1)}`;
  // markers: [owner, kind 'disc'|'cube', c, r]
  const START = [['y', 'cube', 1, 0], ['t', 'cube', 2, 0], ['b', 'cube', 10, 6], ['y', 'cube', 6, 3], ['t', 'cube', 10, 1], ['b', 'cube', 8, 8]];
  const BASE = [...START, ['t', 'cube', 4, 1], ['b', 'cube', 11, 4], ['b', 'cube', 5, 4], ['y', 'cube', 7, 6], ['y', 'disc', 3, 3], ['y', 'disc', 2, 6], ['t', 'disc', 1, 4]];
  const check = (list) => { for (const [o, k, c, r] of list) { const ok = SET[o].has(`${c},${r}`); if (ok !== (k === 'disc')) console.warn('cryptid mock marker breaks clue', o, k, c, r); } const cubes = list.filter((m) => m[1] === 'cube').map((m) => `${m[2]},${m[3]}`); if (new Set(cubes).size !== cubes.length) console.warn('cryptid: two cubes on one cell'); };
  const hasCube = (list, c, r) => list.some((m) => m[1] === 'cube' && m[2] === c && m[3] === r);
  const cellsAll = D.cells.map(([c, r]) => [c, r]);
  const cubeOk = (list, o) => cellsAll.filter(([c, r]) => !SET[o].has(`${c},${r}`) && !hasCube(list, c, r));
  const others = (cells) => { const k = new Set(cells.map(([c, r]) => `${c},${r}`)); return cellsAll.filter(([c, r]) => !k.has(`${c},${r}`)); };
  const mineOk = (list) => cellsAll.filter(([c, r]) => SET.b.has(`${c},${r}`) && !hasCube(list, c, r));
  // board: o = { m: markers, hl: cells, ring: [c,r], dim: cells, glow: [c,r], pops: [[c,r,text]] }
  const OFF = [[-.26, -.2], [.26, -.2], [0, .24], [-.26, .2], [.26, .2]];
  const board = (o, W) => {
    const list = o.m ?? BASE; check(list);
    let h = `<div class="cr-b" style="--bw:${W}px" role="img" aria-label="نقشهٔ کریپتید">${img('cryptid-map', '')}`;
    for (const [c, r] of o.hl ?? []) { const [x, y] = pos(c, r); h += `<i class="cr-hl" style="left:${x}%;top:${y}%"></i>`; }
    for (const [c, r] of o.dim ?? []) { const [x, y] = pos(c, r); h += `<i class="cr-hl is-dim" style="left:${x}%;top:${y}%"></i>`; }
    if (o.glow) { const [x, y] = pos(...o.glow); h += `<i class="cr-hl is-glow" style="left:${x}%;top:${y}%"></i>`; }
    if (o.ring) { const [x, y] = pos(...o.ring); h += `<i class="cr-ring" style="left:${x}%;top:${y}%"></i>`; }
    const per = {};
    for (const [ow, k, c, r] of list) { const key = `${c},${r}`, i = per[key] = (per[key] ?? -1) + 1; const [x, y] = pos(c, r), n = list.filter((m) => m[2] === c && m[3] === r).length; const [dx, dy] = n === 1 ? [0, 0] : OFF[i]; h += `<img class="cr-m${k === 'cube' ? ' is-cube' : ''}" style="left:calc(${x}% + ${dx} * var(--hx));top:calc(${y}% + ${dy} * var(--hx))" src="${H.ART[`cryptid-${k}-${ow}`]}" alt="${k === 'disc' ? 'دیسک' : 'مکعب'} ${WHO[ow]}، ${lab(c, r)}">`; }
    for (const [c, r, t] of o.pops ?? []) { const [x, y] = pos(c, r); h += `<b class="cr-pop" style="left:${x}%;top:${y}%">${t}</b>`; }
    return h + '</div>';
  };
  const table = (o = {}) => (ph) => board(o, ph ? 362 : 610);
  const count = (list, o) => ({ d: list.filter((m) => m[0] === o && m[1] === 'disc').length, c: list.filter((m) => m[0] === o && m[1] === 'cube').length });
  const mk = (o, k, n) => `<span class="cr-mk"><img src="${H.ART[`cryptid-${k}-${o}`]}" alt="${k === 'disc' ? 'دیسک' : 'مکعب'}">${fa(n)}</span>`;
  const opps = (turn, list = BASE, x = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '2:05', turn: turn === 'y', meta: `${mk('y', 'disc', count(list, 'y').d)}${mk('y', 'cube', count(list, 'y').c)}${x.y ?? ''}` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:50', turn: turn === 't', meta: `${mk('t', 'disc', count(list, 't').d)}${mk('t', 'cube', count(list, 't').c)}${x.t ?? ''}` },
  ];
  const clue = (o, label = 'سرنخ شما') => `<figure class="cr-clue"><figcaption>${label}</figcaption>${img('cryptid-' + CL[o], label)}</figure>`;
  const above = (o = {}) => (ph) => `<div class="cr-me${ph ? ' cr-me--ph' : ''}">${o.noClue ? '' : clue('b')}${o.acts ? `<div class="cr-acts">${o.acts(ph)}</div>` : ''}</div>`;
  const note = (list = BASE) => `<span class="cx-note cr-note">${mk('b', 'disc', count(list, 'b').d)}${mk('b', 'cube', count(list, 'b').c)}</span>`;
  const rail = `<section class="cx-card"><h3>بازیکن‌ها</h3><div class="cr-legend">${[['b', 'شما'], ['y', 'نیلوفر'], ['t', 'رضا']].map(([o, n]) => `<span>${img(`cryptid-disc-${o}`, '')}${img(`cryptid-cube-${o}`, '')}${n}</span>`).join('')}</div><div class="ga-rule">${ic('info')}<span>هر نفر یک سرنخ پنهان دارد و سرنخ‌ها با هم فقط یک خانه را نشان می‌دهند. دیسک یعنی «سرنخ من اینجا را قبول دارد»، مکعب یعنی «نه». روی خانهٔ مکعب‌دار نمی‌شود پرسید. اولین جستجویی که همه با دیسک تأیید کنند، بازی را می‌برد.</span></div></section>`;
  const toggle = (on) => `<button type="button" class="cr-tog${on ? ' is-on' : ''}" aria-pressed="${on}">${ic('eye')}<span>خانه‌های مجاز من</span></button>`;

  const ASK = [...BASE];
  const PEN = [...BASE, ['t', 'disc', 3, 4], ['y', 'cube', 4, 3]];
  const SFAIL = [...PEN, ['b', 'cube', 11, 3], ['b', 'disc', 2, 4], ['y', 'cube', 2, 4]];
  const WAIT = [...SFAIL.filter((m) => !(m[0] === 'b' && m[1] === 'cube' && m[2] === 11 && m[3] === 3)), ['b', 'cube', 9, 7], ['b', 'cube', 11, 3], ['b', 'disc', 6, 1]];
  const END = [...WAIT, ['b', 'disc', 2, 3], ['y', 'disc', 2, 3], ['t', 'disc', 2, 3]];
  const endModal = () => modal('شما کریپتید را پیدا کردید', `<p>${lab(2, 3)}: هر سه سرنخ اینجا را قبول دارند. سرنخ همه رو شد:</p><div class="cr-all">${clue('b', 'شما')}${clue('y', 'نیلوفر')}${clue('t', 'رضا')}</div><p class="cx-note">بازی امتیاز ندارد؛ کسی که اول درست جستجو کند برنده است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'Cryptid', fa: 'کریپتید', latin: 'Cryptid', meta: ['زنده', '۳ نفر', 'سطح عادی'],
    opps: opps('b'),
    me: { cards: [], clock: '1:40', turn: true, note: note(), above: above({ acts: (ph) => `${btn('پرسیدن', 'primary', 'users')}${btn('جستجو', 'secondary', 'search')}${ph ? '' : toggle(false)}` }) },
    table: table({}),
    status: '<b>نوبت شماست.</b> از یک نفر دربارهٔ یک خانه بپرسید، یا خانه‌ای را که فکر می‌کنید جای کریپتید است جستجو کنید. دیسک‌ها و مکعب‌ها رنگ صاحبشان را دارند.',
    pstatus: '<b>نوبت شما.</b> پرسیدن یا جستجو.',
    railCard: rail,
    logNote: `نوبت ${fa(9)}`,
    log: [[1, 'شما از رضا دربارهٔ ستون ۵، ردیف ۲ پرسیدید: نه'], [2, 'نیلوفر از شما دربارهٔ ستون ۶، ردیف ۵ پرسید: نه'], [6, 'رضا از نیلوفر دربارهٔ ستون ۴، ردیف ۴ پرسید: بله'], [1, 'شما از نیلوفر دربارهٔ ستون ۳، ردیف ۷ پرسیدید: بله'], [2, 'نیلوفر از رضا دربارهٔ ستون ۲، ردیف ۵ پرسید: بله']],
    dockItems: [['list', 'رویدادها'], ['eye', 'خانه‌های من'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'مکعب‌های آغازین', turnSub: 'دو دور، هر بار یک مکعب', meta: ['زنده', '۳ نفر', 'شروع بازی'], phone: true,
        opps: opps(0, START.slice(0, 2), { y: '<span class="gc-tag gc-tag--soft">گذاشت</span>', t: '<span class="gc-tag gc-tag--soft">گذاشت</span>' }),
        table: table({ m: START.slice(0, 2), dim: others(cubeOk(START.slice(0, 2), 'b')) }),
        me: { note: note([]), above: above({ acts: () => `<span class="cr-ask">مکعب ${fa(1)} از ${fa(2)}</span>` }) },
        status: '<b>مکعب ۱ از ۲.</b> روی خانه‌ای بگذارید که سرنخ شما رد می‌کند؛ خانه‌های تیره مجاز نیستند. مکعب هیچ‌وقت روی جواب نمی‌افتد، پس بقیه از آن چیز یاد می‌گیرند.',
        pstatus: '<b>مکعب ۱ از ۲.</b> یکی از خانه‌های روشن را بزنید.',
        log: [[2, 'نیلوفر نفر اول است'], [2, 'نیلوفر مکعب گذاشت'], [6, 'رضا مکعب گذاشت'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'پرسیدن', turnSub: 'اول بازیکن، بعد خانه',
        table: table({ m: ASK, ring: [3, 4], dim: cellsAll.filter(([c, r]) => hasCube(ASK, c, r) || ASK.some((m) => m[0] === 't' && m[1] === 'disc' && m[2] === c && m[3] === r)) }),
        me: { above: above({ acts: (ph) => `<span class="cr-pick" role="radiogroup" aria-label="از چه کسی بپرسید">${[['y', 'ن', 2, 'نیلوفر', false], ['t', 'ر', 6, 'رضا', true]].map(([o, a, s, n, on]) => `<button type="button" class="cr-who${on ? ' is-on' : ''}" role="radio" aria-checked="${on}"><span class="bgv-avatar bgv-avatar--sm seat-${s}">${a}</span>${n}</button>`).join('')}</span>${btn(ph ? 'بپرس' : `پرسیدن: ${lab(3, 4)}`, 'primary', 'check')}` }) },
        status: `<b>از رضا می‌پرسید.</b> خانه‌های مکعب‌دار و خانه‌هایی که رضا قبلاً دیسک گذاشته تیره‌اند و پرسیدنی نیستند. ${lab(3, 4)} را انتخاب کردید؛ جواب را سرور از روی سرنخ رضا می‌دهد.`,
        pstatus: `<b>پرسیدن از رضا.</b> ${lab(3, 4)}`,
        log: [[2, 'نیلوفر از رضا دربارهٔ ستون ۲، ردیف ۵ پرسید: بله'], [1, 'شما رضا را انتخاب کردید']],
      },
      {
        shotTitle: 'مکعب جریمه', turnSub: 'جواب «نه» بود',
        table: table({ m: PEN, dim: others(cubeOk(PEN, 'b')), pops: [[4, 3, 'نه']] }),
        me: { above: above({ acts: () => `<span class="cr-ask">حالا شما هم یک مکعب بگذارید</span>` }) },
        opps: opps('b', PEN),
        status: `<b>نیلوفر گفت نه</b> و روی ${lab(4, 3)} مکعب گذاشت. حالا شما هم باید یک مکعب جایی بگذارید که سرنخ خودتان رد می‌کند؛ خانه‌های تیره مجاز نیستند.`,
        pstatus: '<b>جواب نه بود.</b> شما هم یک مکعب بگذارید.',
        log: [[1, 'شما از نیلوفر دربارهٔ ستون ۵، ردیف ۴ پرسیدید'], [2, 'نیلوفر: نه (مکعب)'], [1, 'مکعب جریمهٔ شما']],
      },
      {
        shotTitle: 'جستجو', turnSub: 'با ابزار «خانه‌های مجاز من»', phone: true,
        table: table({ m: [...PEN, ['b', 'cube', 11, 3]], hl: mineOk([...PEN, ['b', 'cube', 11, 3]]), ring: [2, 4] }),
        me: { note: note([...PEN, ['b', 'cube', 11, 3]]), above: above({ acts: (ph) => `<span class="cr-ask">${lab(2, 4)} را جستجو می‌کنید؟</span>${btn(ph ? 'جستجو' : 'بله، جستجو', 'primary', 'search')}${btn('لغو', 'secondary', 'x')}${ph ? '' : toggle(true)}` }) },
        status: `<b>جستجو.</b> «خانه‌های مجاز من» روشن است: خانه‌هایی که سرنخ شما قبول دارد و مکعب ندارند. فقط این‌ها را می‌شود جستجو کرد. اول خودتان دیسک می‌گذارید، بعد نیلوفر و رضا به ترتیب جواب می‌دهند.`,
        pstatus: `<b>جستجو؟</b> ${lab(2, 4)}`,
        log: [[1, 'شما مکعب جریمه گذاشتید'], [6, 'رضا از شما پرسید: بله'], [1, 'نوبت شما']],
      },
      {
        shotTitle: 'جستجوی ناموفق', turnSub: 'اولین مکعب جستجو را تمام می‌کند',
        table: table({ m: SFAIL, dim: others(cubeOk(SFAIL, 'b')), pops: [[2, 4, 'نیلوفر: نه']] }),
        me: { note: note(SFAIL), above: above({ acts: () => `<span class="cr-res"><span class="is-yes">${ic('check')}شما: دیسک</span><span class="is-no">${ic('x')}نیلوفر: مکعب</span><span class="is-skip">رضا: نوبتش نرسید</span></span>` }) },
        opps: opps('b', SFAIL),
        status: `<b>جستجو ناموفق.</b> نیلوفر روی ${lab(2, 4)} مکعب گذاشت، پس جستجو همان‌جا تمام شد و رضا جواب نداد. حالا شما هم یک مکعب بگذارید.`,
        pstatus: '<b>ناموفق.</b> یک مکعب بگذارید.',
        log: [[1, 'شما ستون ۳، ردیف ۵ را جستجو کردید'], [1, 'شما: دیسک'], [2, 'نیلوفر: مکعب'], [1, 'جستجو ناموفق؛ مکعب شما']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'جواب شما خودکار است', phone: true,
        opps: opps('t', WAIT),
        table: table({ m: WAIT, ring: [6, 1], pops: [[6, 1, 'شما: بله']] }),
        me: { turn: false, note: note(WAIT), above: above({}) },
        status: `<b>نوبت رضاست.</b> رضا از شما دربارهٔ ${lab(6, 1)} پرسید. سرنخ شما آنجا را قبول دارد، پس سایت خودش دیسک شما را گذاشت؛ دروغ گفتن ممکن نیست.`,
        pstatus: '<b>نوبت رضا.</b> شما دیسک گذاشتید.',
        log: [[2, 'نیلوفر از رضا پرسید: بله'], [6, 'رضا از شما دربارهٔ ستون ۷، ردیف ۲ پرسید'], [1, 'شما دیسک گذاشتید']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'کریپتید پیدا شد', meta: ['پایان', '۳ نفر', 'سطح عادی'],
        opps: opps(0, END),
        table: table({ m: END, glow: [2, 3] }), overlay: endModal,
        me: { turn: false, clock: '', note: note(END), above: above({ noClue: true }) },
        status: '<b>بازی تمام شد.</b> شما کریپتید را در ستون ۳، ردیف ۴ پیدا کردید.',
        log: [[1, 'شما ستون ۳، ردیف ۴ را جستجو کردید'], [2, 'نیلوفر: دیسک'], [6, 'رضا: دیسک'], [1, 'شما بردید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:8px}
.cr-b{position:relative;inline-size:var(--bw);--hx:calc(var(--bw) * 40 / 392);direction:ltr;flex:none;border-radius:10px;overflow:hidden;box-shadow:0 12px 24px -12px rgba(0,0,0,.7)}
.cr-b>img:first-child{display:block;inline-size:100%;block-size:auto}
.cr-hl{position:absolute;inline-size:calc(var(--hx) * .98);block-size:calc(var(--hx) * .85);transform:translate(-50%,-50%);clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:rgba(232,166,66,.42)}
.cr-hl.is-dim{background:rgba(6,14,20,.55)}
.cr-hl.is-glow{background:rgba(255,236,170,.75);box-shadow:none}
.cr-ring{position:absolute;inline-size:calc(var(--hx) * .82);block-size:calc(var(--hx) * .82);transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.cr-m{position:absolute;inline-size:calc(var(--hx) * .5);block-size:auto;transform:translate(-50%,-50%)}
.cr-pop{position:absolute;transform:translate(-50%,-160%);padding:2px 8px;border-radius:999px;background:#FAF5EC;color:#142B3B;font-size:12px;white-space:nowrap;box-shadow:0 3px 6px rgba(0,0,0,.4)}
.cr-me{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;inline-size:100%}
.cr-clue{margin:0;display:grid;gap:3px;justify-items:center}
.cr-clue figcaption{font-size:12px;color:var(--felt-muted)}
.cr-clue img{display:block;inline-size:392px;max-inline-size:100%;border-radius:6px;box-shadow:0 6px 12px -6px rgba(0,0,0,.6)}
.cr-acts{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.cr-ask{color:var(--felt-ink);font-size:14px;font-weight:700}
.cr-tog{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;block-size:40px;padding-inline:12px;border-radius:999px;color:var(--felt-ink);font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.35)}
.cr-tog.is-on{background:rgba(232,166,66,.22);box-shadow:inset 0 0 0 2px var(--felt-gold)}
.cr-tog .bgv-icon{inline-size:18px;block-size:18px}
.cr-pick{display:inline-flex;gap:6px}
.cr-who{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;block-size:44px;padding-inline:8px 12px;border-radius:999px;color:var(--felt-ink);font-size:14px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.3)}
.cr-who.is-on{background:rgba(232,166,66,.22);box-shadow:inset 0 0 0 2.5px var(--felt-gold)}
.cr-res{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.cr-res>span{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:700;background:rgba(250,245,236,.1);color:var(--felt-ink)}
.cr-res .bgv-icon{inline-size:16px;block-size:16px}
.cr-res .is-yes{box-shadow:inset 0 0 0 1.5px #3BB273}.cr-res .is-no{box-shadow:inset 0 0 0 1.5px #E0505C}.cr-res .is-skip{opacity:.6}
.cr-mk{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.cr-mk img{inline-size:18px;block-size:auto}
.cr-note{display:inline-flex;gap:8px}
.cr-legend{display:grid;gap:6px;margin-block-end:8px}.cr-legend span{display:flex;align-items:center;gap:6px;font-size:14px}.cr-legend img{inline-size:22px}
.cr-all{display:grid;gap:8px;justify-items:center}.cr-all .cr-clue figcaption{color:var(--text-muted)}.cr-all .cr-clue img{inline-size:340px}
.gc-seat__meta>*{white-space:nowrap}
.cx-phone .gc-table{gap:6px}
.cr-me--ph{gap:6px}.cr-me--ph .cr-clue img{inline-size:340px}.cr-me--ph .cr-acts{gap:6px;padding-inline:8px}.cr-me--ph .cr-ask{font-size:13px}
.cx-phone .cr-all .cr-clue img{inline-size:300px}.cx-phone .cr-res>span{font-size:12px;padding:5px 8px}`,
    shotTitle: 'نوبت شما', turnSub: 'پرسیدن یا جستجو',
    diffs: [
      ['چیدمان', 'نقشهٔ ۱۲×۹ خانه وسط میز با شمارهٔ ستون و ردیف، قلمرو خرس و پوما با خط‌چین و سنگ‌چین‌ها و کلبه‌ها با رنگشان؛ سرنخ شما زیر نقشه همیشه دیده می‌شود. BGA این بازی را ندارد'],
      ['دیسک و مکعب', 'نشان‌ها به رنگ صندلی هر نفر (شما آبی، نیلوفر زرد، رضا فیروزه‌ای). همهٔ نشان‌های این طرح با سرنخ صاحبشان چک شده‌اند'],
      ['پرسیدن و جریمه', 'انتخاب بازیکن با آواتار، بعد خانه؛ خانه‌های غیرمجاز تیره (§۵). جواب «نه» یعنی مکعب جریمهٔ پرسنده؛ خانه‌هایی که سرنخ خودش قبول دارد تیره می‌شوند (§۶)'],
      ['جستجو', 'دکمهٔ «خانه‌های مجاز من» فقط برای خودتان خانه‌های قبول سرنخ را روشن می‌کند (§۷). جواب‌ها به ترتیب با اسم هر نفر و توقف با اولین مکعب (§۸). پایان با رو شدن همهٔ سرنخ‌ها (§۱۰)'],
      ['آرت', 'نقشه، نوار سرنخ و نشان‌ها رندر خود سایت‌اند (منبع چاپی در دسترس نبود) و در MISSING-ART با اندازه ثبت شدند تا با نسخهٔ وفادار به ناشر عوض شوند'],
      ['موتور', 'نقشه و سرنخ‌ها را موتور هر بار خودش می‌سازد و تکه‌های نقشهٔ موتور با تکه‌های چاپی تطبیق داده نشده (RULES E1)؛ این طرح نقشهٔ نمونهٔ بستهٔ آرت را نشان می‌دهد'],
    ],
  };
}
