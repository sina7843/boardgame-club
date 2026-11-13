// Group A: Santorini. Rules = repo games/santorini/src/rules.ts (base game, no god powers; move then build;
// up one level at most; moving up onto level 3 wins; no whole turn = loss; 22/18/14 blocks and 18 domes).
import { tbl } from './_ui.mjs';
export default function (H) {
  const { img, fa, ic, esc, btn, ibtn } = H;

  // ---------- engine (port of rules.ts) ----------
  const adj = (a, b) => a !== b && Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) <= 1 && Math.abs((a % 5) - (b % 5)) <= 1;
  const around = (a) => Array.from({ length: 25 }, (_, i) => i).filter((i) => adj(a, i));
  const occ = (s, i) => s.workers[0].includes(i) || s.workers[1].includes(i);
  const canBuild = (s, i) => { const h = s.height[i]; if (h >= 4) return false; return h === 3 ? s.supply.dome > 0 : s.supply[h + 1] > 0; };
  const moveTargets = (s, f) => around(f).filter((i) => !occ(s, i) && s.height[i] < 4 && s.height[i] <= s.height[f] + 1);
  const buildTargets = (s, f, t) => around(t).filter((i) => (i === f || !occ(s, i)) && canBuild(s, i));
  function turns(s, seat) {
    const out = [];
    for (const f of s.workers[seat]) for (const t of moveTargets(s, f)) {
      if (s.height[t] === 3 && s.height[f] === 2) { out.push({ from: f, to: t }); continue; }
      for (const b of buildTargets(s, f, t)) out.push({ from: f, to: t, build: b });
    }
    return out;
  }
  const nm = (i) => 'abcde'[i % 5] + (Math.floor(i / 5) + 1);
  function apply(s, seat, t) {
    const n = { height: s.height.slice(), workers: [s.workers[0].slice(), s.workers[1].slice()], supply: { ...s.supply } };
    const ws = n.workers[seat]; ws[ws.indexOf(t.from)] = t.to;
    if (t.build !== undefined) { const h = n.height[t.build]; if (h === 3) n.supply.dome -= 1; else n.supply[h + 1] -= 1; n.height[t.build] = h + 1; }
    return n;
  }
  const san = (t) => `${nm(t.from)}-${nm(t.to)}${t.build !== undefined ? ' ' + nm(t.build) : ''}`;
  const wins = (s, seat) => turns(s, seat).some((t) => t.build === undefined);
  function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
  function run(seed, nTurns) {
    const R = rng(seed);
    let s = { height: Array(25).fill(0), workers: [[], []], supply: { 1: 22, 2: 18, 3: 14, dome: 18 } };
    const hist = []; let last = null;
    // setup: first player places both, then the second (central-ish squares)
    for (const seat of [0, 0, 1, 1]) {
      const free = [6, 7, 8, 11, 12, 13, 16, 17, 18, 2, 10, 14, 22].filter((i) => !occ(s, i));
      const at = free[Math.floor(R() * free.length)]; s.workers[seat].push(at); hist.push({ san: nm(at) });
    }
    let seat = 0;
    for (let k = 0; k < nTurns; k++) {
      const L = turns(s, seat).filter((t) => t.build !== undefined); if (!L.length) return null;
      let best = null, bv = -1e9;
      for (const t of L) {
        const n = apply(s, seat, t);
        let v = (s.height[t.to] - s.height[t.from]) * 2.5 + s.height[t.to] + R() * 3;
        if (wins(n, 1 - seat)) v -= 30;
        v += n.height[t.build] * 0.7;
        if (!turns(n, 1 - seat).length) v -= 50;
        if (v > bv) { bv = v; best = t; }
      }
      s = apply(s, seat, best); hist.push({ san: san(best) }); last = best; seat = 1 - seat;
    }
    return { s, hist, last, seat };
  }

  // moment: blue (you, seat 1) to move, mid-game, no winning move for either side yet; a worker that steps up with
  // 3 to 6 move targets, and after the shown move 3 to 6 build targets
  let po = null, sel = null, mv = null;
  for (let seed = 1; seed < 800 && !po; seed++) {
    const p = run(seed, 17); if (!p || p.seat !== 1) continue;
    const S0 = p.s; if (wins(S0, 1) || wins(S0, 0)) continue;
    const towers = S0.height.filter((h) => h > 0).length, domes = S0.height.filter((h) => h === 4).length, l3 = S0.height.filter((h) => h === 3).length;
    if (towers < 8 || domes < 1 || l3 < 1) continue;
    for (const f of S0.workers[1]) {
      const mt = moveTargets(S0, f); if (mt.length < 3 || mt.length > 7) continue;
      const up = mt.find((t) => S0.height[t] === S0.height[f] + 1 && S0.height[t] >= 1);
      if (up === undefined) continue;
      const bt = buildTargets(S0, f, up); if (bt.length < 3 || bt.length > 7) continue;
      po = p; sel = f; mv = { to: up, mt, bt }; break;
    }
  }
  if (!po) throw new Error('santorini: no position found');
  const S = po.s;

  // ---------- board: island 712×742, grid x 45..666, y 60..682 (5 × 124.3) ----------
  const towerArt = (h) => `santorini-tower-${h}`;
  const lv = (h) => (h === 4 ? 'گنبد' : `طبقهٔ ${fa(h)}`);
  function boardHtml(g, s0, o = {}) {
    const free = !!o.free; const phone = free || o.b === 366; // main: phone shows step 1 (move targets), desktop step 2 (build targets)
    const s = free ? s0 : phone ? S : apply(S, 1, { from: sel, to: mv.to });
    const cells = [];
    for (let row = 0; row < 5; row++) for (let c = 0; c < 5; c++) {
      const i = (4 - row) * 5 + c; const h = s.height[i]; const cls = ['sa-cell'];
      const w = s.workers[0].includes(i) ? 0 : s.workers[1].includes(i) ? 1 : -1;
      const last = free ? o.last?.includes(i) : po.last && (i === po.last.to || i === po.last.build);
      if (last) cls.push('is-last');
      if (free ? o.sel === i : phone && i === sel) cls.push('is-sel');
      if (!phone && i === mv.to) cls.push('is-sel');
      if (!phone && i === sel) cls.push('is-from');
      if (free && o.stuck?.includes(i)) cls.push('is-stuck');
      const dot = free ? !!o.dots?.includes(i) : phone ? mv.mt.includes(i) : mv.bt.includes(i);
      if (dot) cls.push(phone ? 'is-move' : 'is-build');
      cells.push(`<span class="${cls.join(' ')}" style="--lv:${Math.min(h, 3)};z-index:${row + 1}" aria-label="${nm(i)}، ${h ? lv(h) : 'زمین'}">${h ? img(towerArt(h), lv(h)) : ''}${w >= 0 ? `<i class="sa-w">${img(w ? 'santorini-blue-worker' : 'santorini-ivory-worker', w ? 'کارگر آبی' : 'کارگر روشن')}</i>` : ''}${h && h < 4 ? `<b class="sa-lv">${fa(h)}</b>` : ''}${dot ? `<em class="sa-dot">${!phone && h === 3 ? 'گنبد' : !phone ? fa(h + 1) : ''}</em>` : ''}</span>`);
    }
    const files = 'abcde'.split('').map((f, k) => `<span style="left:${(6.32 + (k + 0.5) * 17.45).toFixed(2)}%;bottom:1.6%">${f}</span>`).join('');
    const ranks = [1, 2, 3, 4, 5].map((r, k) => `<span style="top:${(8.09 + (4 - k + 0.5) * 16.77 - 1).toFixed(2)}%;left:3.1%">${r}</span>`).join('');
    return `<div class="ga-board sa-board" style="--img:url(${H.ART['santorini-island']});${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="${esc(g.fa)}"><div class="sa-grid">${cells.join('')}</div><div class="ga-coords sa-coords">${files}${ranks}</div></div>`;
  }

  const step = (n, title, sub, state) => `<li class="sa-step is-${state}"><b>${state === 'done' ? ic('check') : fa(n)}</b><span><strong>${title}</strong><small>${sub}</small></span></li>`;
  const sup = S.supply; // supply after the shown turn's move (build not yet placed)
  const css = `
.sa-board{isolation:isolate;inline-size:calc(var(--b,572px) * 712 / 742);block-size:var(--b,572px);box-shadow:none;background-size:100% 100%;filter:drop-shadow(0 10px 16px rgba(0,0,0,.35))}
.sa-grid{position:absolute;inset:8.09% 6.46% 8.09% 6.32%;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(5,1fr);direction:ltr}
.sa-cell{position:relative;display:grid;place-items:center;min-inline-size:0;min-block-size:0}
.sa-cell>img{position:absolute;inset-inline-start:50%;inset-block-end:2%;inline-size:118%;transform:translateX(-50%);max-inline-size:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,.3))}
.sa-w{position:absolute;inset-inline-start:50%;inset-block-end:calc(16% + var(--lv) * 8%);transform:translateX(-50%);inline-size:66%;z-index:3;display:block}
.sa-w img{inline-size:100%;display:block;filter:drop-shadow(0 4px 2px rgba(0,0,0,.4))}
.sa-lv{position:absolute;inset-block-start:5%;inset-inline-start:6%;z-index:4;min-inline-size:18px;block-size:18px;border-radius:9px;background:rgba(20,43,59,.82);color:#fff;font:800 11.5px/18px var(--font);text-align:center}
.sa-cell.is-last::before{content:"";position:absolute;inset:4%;border-radius:10px;background:rgba(232,166,66,.38);box-shadow:inset 0 0 0 2px rgba(232,166,66,.9)}
.sa-cell.is-sel::before{content:"";position:absolute;inset:3%;border-radius:10px;background:rgba(232,166,66,.45);box-shadow:inset 0 0 0 3px #E8A642}
.sa-cell.is-from::before{content:"";position:absolute;inset:3%;border-radius:10px;border:2.5px dashed rgba(20,43,59,.55)}
.sa-dot{position:absolute;z-index:5;inset-inline-start:50%;inset-block-start:50%;transform:translate(-50%,-50%);display:grid;place-items:center;font:800 12px/1 var(--font);font-style:normal;color:#fff;border-radius:50%}
.sa-cell.is-move .sa-dot{inline-size:30%;block-size:30%;background:rgba(20,43,59,.6);box-shadow:0 0 0 3px rgba(255,255,255,.75)}
.sa-cell.is-build .sa-dot{inline-size:auto;min-inline-size:32%;block-size:auto;padding:5px 7px;border-radius:999px;background:#2F6FB0;box-shadow:0 0 0 2.5px #fff,0 3px 8px rgba(0,0,0,.35)}
.sa-coords span{color:#fff;font-size:11.5px;transform:translate(-50%,0);text-shadow:0 1px 2px rgba(0,0,0,.7)}
.sa-steps{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}
.sa-step{display:flex;gap:10px;align-items:center;padding:6px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken)}
.sa-step>b{flex:none;inline-size:26px;block-size:26px;border-radius:50%;display:grid;place-items:center;font-size:13.5px;background:var(--surface);color:var(--text-muted);box-shadow:inset 0 0 0 1.5px var(--border)}
.sa-step>b .bgv-icon{inline-size:16px;block-size:16px}
.sa-step span{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.sa-step strong{font-size:14.5px;color:var(--heading)}.sa-step small{font-size:12.5px;color:var(--text-muted)}
.sa-step.is-done>b{background:var(--success,#2E8B57);color:#fff;box-shadow:none}
.sa-step.is-now{box-shadow:inset 0 0 0 2px var(--link)}
.sa-step.is-now>b{background:var(--link);color:#fff;box-shadow:none}
.sa-sup{display:flex;justify-content:space-between;gap:6px}
.sa-sup span{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)}
.sa-sup img{inline-size:26px;block-size:26px;object-fit:contain}
.sa-sup b{font-size:15px;color:var(--heading)}
.sa-cell.is-stuck::before{content:"";position:absolute;inset:3%;border-radius:10px;background:rgba(192,57,43,.22);box-shadow:inset 0 0 0 3px #C0392B}
.cx-phone .cx-ms__m:nth-last-child(n+6){display:none}
.cx-phone .sa-board{--b:366px;align-self:center}
.cx-phone .sa-lv{min-inline-size:14px;block-size:14px;font-size:9.5px;line-height:14px}
`;
  const hMe = Math.max(...S.workers[1].map((i) => Math.min(3, S.height[i]))), hOpp = Math.max(...S.workers[0].map((i) => Math.min(3, S.height[i])));
  const actions = `<div class="cx-actions">${btn('واگرد', 'secondary', 'undo')}${btn('تسلیم', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`;
  // hand-built positions; supply follows from the heights (each tower uses one block per level, a dome on top)
  const mkS = (hmap, ivory, blue) => { const height = Array(25).fill(0); for (const [k, v] of Object.entries(hmap)) height[k] = v; const supply = { 1: 22, 2: 18, 3: 14, dome: 18 }; for (const h of height) { for (let l = 1; l <= Math.min(h, 3); l++) supply[l]--; if (h === 4) supply.dome--; } return { height, workers: [ivory, blue], supply }; };
  const supRow = (sp) => `<div class="sa-sup" aria-label="قطعه‌های باقی‌مانده">${[1, 2, 3].map((h) => `<span>${img(towerArt(h), lv(h))}<b>${fa(sp[h])}</b></span>`).join('')}<span>${img('santorini-dome', 'گنبد')}<b>${fa(sp.dome)}</b></span></div>`;
  // §4 setup: Niloufar started and placed both ivory workers; you have placed one blue, one to go
  const sp0 = mkS({}, [12, 8], [7]);
  const free0 = Array.from({ length: 25 }, (_, i) => i).filter((i) => !occ(sp0, i));
  // §5 you are stuck: both blue workers boxed in by a dome, towers two levels up and an ivory worker
  const spX = mkS({ 5: 4, 6: 2, 2: 3, 7: 1, 11: 2, 12: 3, 13: 1, 17: 2, 18: 4, 16: 1, 22: 3, 10: 1, 8: 2, 14: 1 }, [7, 13], [0, 1]);
  if (turns(spX, 1).length) throw new Error('santorini mock: blue is not stuck');
  const histX = [...po.hist, ...['c2-b3 c3', 'd3-c4 d4', 'c4-d3 c4', 'b3-c2 b2'].map((san) => ({ san }))];
  return {
    slug: 'Santorini', fa: 'سانتورینی', latin: 'Santorini', board: 'santorini-island',
    meta: ['زنده', '۱۰ دقیقه', 'رتبه‌ای'], sideFa: ['روشن', 'آبی'], notation: 'حرکت، بعد ساخت',
    boardHtml, css, actions, noDraw: true,
    dockItems: [['more', 'گزینه‌ها'], ['undo', 'واگرد'], ['flag', 'تسلیم'], ['list', 'قوانین']],
    note: (st, who) => { const ws = st.s.workers[who === 'me' ? 1 : 0]; const h = ws.length ? Math.max(...ws.map((i) => Math.min(3, st.s.height[i]))) : 0; return `<span>${ws.length < 2 ? `${fa(ws.length)} از ۲ کارگر روی جزیره` : `بلندترین کارگر: ${h ? `طبقهٔ ${fa(h)}` : 'زمین'}`}</span>`; },
    railCard: () => `<section class="cx-card"><ol class="sa-steps">${step(1, 'حرکت', `${nm(sel)} به ${nm(mv.to)}، یک طبقه بالا`, 'done')}${step(2, 'ساخت', `یکی از ${fa(mv.bt.length)} خانهٔ کنار کارگر`, 'now')}</ol><div class="sa-sup" aria-label="قطعه‌های باقی‌مانده">${[1, 2, 3].map((h) => `<span>${img(towerArt(h), lv(h))}<b>${fa(sup[h])}</b></span>`).join('')}<span>${img('santorini-dome', 'گنبد')}<b>${fa(sup.dome)}</b></span></div></section>`,
    turnSub: 'حرکت انجام شد، حالا ساخت',
    diffs: [
      ['صفحه', 'جزیرهٔ ۵×۵ با برج‌های سه‌طبقه و گنبد به جای خانه‌های شطرنج؛ برج‌ها کمی از خانه بیرون می‌زنند و ردیف پایین روی ردیف بالا می‌افتد. عدد گوشهٔ هر خانه طبقهٔ آن است. همه از بستهٔ آماده (BGA)'],
      ['نوبت دومرحله‌ای', 'هر نوبت «حرکت، بعد ساخت» است. اول کارگر را بزنید و یکی از خانه‌های نقطه‌دار را (گوشی همین مرحله را نشان می‌دهد)، بعد روی یکی از خانه‌های کنار کارگر بسازید؛ روی هر خانهٔ مجاز طبقه‌ای که ساخته می‌شود نوشته شده (دسکتاپ)'],
      ['ستون کنار', 'به جای امتیاز یا مهره‌های گرفته‌شده: دو مرحلهٔ نوبت و قطعه‌های باقی‌ماندهٔ جعبه (۲۲، ۱۸ و ۱۴ طبقه و ۱۸ گنبد، مثل موتور). زیر اسم‌ها بلندترین طبقهٔ کارگرها'],
      ['دکمه‌ها', 'به جای «مساوی»، «واگرد»: موتور حرکت و ساخت را با هم می‌گیرد، پس تا ساخت ثبت نشده حرکت قابل برگشت است'],
      ['ثبت حرکت', 'خانهٔ مبدأ و مقصد کارگر و بعد خانهٔ ساخت، مثل «b2-c3 d3»؛ چهار حرکت اول جای‌گذاری کارگرهاست'],
      ['پایان', 'بالا رفتن به طبقهٔ ۳ فوراً می‌برد (بدون ساخت)؛ کسی که نتواند هم حرکت کند و هم بسازد می‌بازد (§۵). موتور نسخهٔ پایه است و کارت خدایان ندارد'],
    ],
    st: {
      s: S, hist: po.hist, turnMe: true, clocks: { me: '4:26', opp: '5:02' },
      status: `<b>نوبت شماست.</b> کارگر به ${nm(mv.to)} رفت؛ حالا روی یکی از خانه‌های کنارش بسازید.`,
      pstatus: `<b>نوبت شما.</b> کارگر ${nm(sel)} را به یکی از ${fa(mv.mt.length)} خانهٔ مجاز ببرید`,
      bo: {},
    },
    phases: [
      { shotTitle: 'گذاشتن کارگرها', turnSub: 'جای کارگرهایتان را انتخاب کنید', st: { s: sp0, hist: ['c3', 'd2', 'c2'].map((san) => ({ san })), turnMe: true, clocks: { me: '9:48', opp: '9:41' }, bo: { free: true, dots: free0, last: [7] },
          status: '<b>جای کارگرهایتان را انتخاب کنید.</b> نیلوفر شروع‌کننده بود و هر دو کارگرش را گذاشت. شما یکی را روی c2 گذاشتید؛ دومی را روی یکی از خانه‌های خالی بگذارید.',
          pstatus: '<b>کارگر دوم را بگذارید.</b> هر خانهٔ خالی' },
        railCard: () => `<section class="cx-card"><ol class="sa-steps">${step(1, 'کارگر اول', 'روی c2', 'done')}${step(2, 'کارگر دوم', 'یکی از خانه‌های خالی', 'now')}</ol><div class="ga-rule">${ic('info')}<span>شروع‌کننده هر دو کارگرش را می‌گذارد، بعد حریف. بعد از آن شروع‌کننده اولین حرکت را انجام می‌دهد.</span></div></section>`,
        actions: `<div class="cx-actions">${btn('واگرد', 'secondary', 'undo')}${btn('تسلیم', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`,
        phone: true },
      { shotTitle: 'پایان: گیر افتادید', turnSub: 'هیچ کارگری نمی‌توانست حرکت کند و بسازد', st: { s: spX, hist: histX, turnMe: true, clocks: { me: '1:30', opp: '2:05' }, bo: { free: true, stuck: [0, 1], last: [7, 6] },
          status: '<b>بازی تمام شد.</b> نوبت شما بود، اما هیچ کارگرتان نمی‌توانست حرکت کند و بسازد؛ نیلوفر برد.', pstatus: '<b>باختید.</b> هیچ کارگرتان راه نداشت' },
        railCard: (st) => `<section class="cx-card"><div class="ga-rule">${ic('info')}<span>کارگر فقط یک طبقه بالا می‌رود و روی گنبد یا کارگر دیگر نمی‌رود. اگر در نوبتتان هیچ کارگری نتواند حرکت کند و بعد بسازد، می‌بازید.</span></div>${supRow(st.s.supply)}</section>`,
        actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr auto">${btn('بازی دوباره', 'primary', 'repeat')}${btn('بازگشت به لابی', 'secondary', 'back')}${ibtn('list', 'قوانین بازی', 'secondary')}</div>`,
        dockItems: [['more', 'گزینه‌ها'], ['repeat', 'بازی دوباره'], ['back', 'لابی']],
        overlay: () => H.modal('نیلوفر برد', `<p><b>هیچ کارگرتان نمی‌توانست حرکت کند و بسازد.</b> کارگر a1 و b1 دورشان گنبد، برج دوطبقه و کارگر نیلوفر بود.</p>${tbl(['کارگر', 'خانه‌های کنار', 'چرا بسته'], [{ c: ['a1', 'a2، b2', 'گنبد؛ دو طبقه بالاتر'] }, { c: ['b1', 'a2، b2، c1، c2', 'گنبد؛ دو و سه طبقه بالاتر؛ کارگر نیلوفر'] }])}<p class="cx-note">برد دیگر: رفتن به طبقهٔ ۳ در نوبت خودتان.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        phone: true },
    ],
  };
}
