// Heat: Pedal to the Metal on the group D frame (repo engine: 2–6 players; options track, laps, weather, garage, races).
// Board = BGA USA circuit (1650×1100 coords, scaled art 1320×880). Spaces ordered along travel by tools/heat_geo.py → heat-usa.json (69 spaces, 2 lanes).
// Players: you blue (seat 1), Niloufar yellow (seat 2), Reza green (seat 6). Lap 1 of 2; the corner after space 12 has limit 4.
import { readFileSync } from 'node:fs';
const GEO = JSON.parse(readFileSync(new URL('./heat-usa.json', import.meta.url), 'utf8'));
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const S = GEO.spaces;
  const P = (x, y) => `left:${(x / 1650 * 100).toFixed(2)}%;top:${(y / 1100 * 100).toFixed(2)}%`;
  const car = (pos, lane, c, cls = '') => { const [x, y, a] = S[pos % S.length][lane]; return `<img class="ht-car${cls}" style="${P(x, y)};transform:translate(-50%,-50%) rotate(${a}deg)" src="${H.ART['ht-car-' + c]}" alt="ماشین">`; };
  const dot = (pos, lane, cls = '') => { const [x, y] = S[pos % S.length][lane]; return `<i class="ht-dot${cls}" style="${P(x, y)}"></i>`; };
  const CARS = { y: [14, 0], g: [13, 1], b: [11, 0] };
  const board = (o, w) => {
    let h = `<div class="ht-b" style="--bw:${w}px" role="img" aria-label="پیست آمریکا">${img('ht-board', '')}`;
    for (const p of o.path ?? []) h += dot(p, 0, p === (o.path ?? []).at(-1) ? ' is-end' : '');
    for (const [c, [p, l]] of Object.entries(o.cars ?? CARS)) h += car(p, l, c);
    if (o.ghost) h += car(o.ghost[0], o.ghost[1], 'b', ' is-ghost');
    for (const [k, x, y] of o.tokens ?? []) h += `<img class="ht-tok" style="${P(x, y)}" src="${H.ART['ht-tok-' + k]}" alt="نشان شرایط جاده">`;
    if (o.flag) h += `<b class="ht-flag" style="${P(...S[o.flag[0]][0])}">${o.flag[1]}</b>`;
    return h + '</div>';
  };
  const win = (o, ph) => ph ? `<div class="ht-win"><div class="ht-pan">${board(o, 820)}</div><span class="ht-zoom">${ic('search')}کل پیست</span></div>` : board(o, 692);
  const order = (list) => `<div class="ht-order" aria-label="ترتیب مسابقه">${list.map(([n, s, me], i) => `<span class="${me ? 'is-me' : ''}"><b>${fa(i + 1)}</b><i style="background:var(--seat-${s})"></i>${n}</span>`).join('')}<small>دور ${fa(1)} از ${fa(2)}</small></div>`;
  const ORDER = [['نیلوفر', 2], ['رضا', 6], ['شما', 1, true]];
  const table = (o) => (ph) => `${win(o, ph)}${ph ? '' : order(o.order ?? ORDER)}`;
  const card = (k, cls = '') => `<span class="ht-c${cls}">${img(k === 'h' ? 'ht-heat' : k === 'x' ? 'ht-stress' : 'ht-s' + k, k === 'h' ? 'گرما' : k === 'x' ? 'استرس' : `سرعت ${fa(k)}`)}</span>`;
  const HAND = [1, 2, 3, 3, 4, 'h', 'x'];
  const hand = (sel = [], lock = true) => `<div class="ht-hand" aria-label="دست شما">${HAND.map((k, i) => card(k, sel.includes(i) ? ' is-sel' : (lock && (k === 'h' || k === 'x') ? ' is-lock' : ''))).join('')}</div>`;
  const gears = (cur) => `<div class="ht-gears" role="group" aria-label="دنده">${[1, 2, 3, 4].map((g) => `<button type="button" class="ht-gb${g === cur ? ' is-on' : ''}${g === 4 ? ' is-cost' : ''}">${img('ht-gear' + g, '')}<small>${g === 4 ? `${fa(1)} گرما` : g === 1 ? `${fa(1)} گرما` : 'رایگان'}</small></button>`).join('')}</div>`;
  const engine = (heat) => `<span class="ht-eng" aria-label="موتور">${img('ht-heat', '')}<b>${fa(heat)}</b><small>گرمای موتور</small></span>`;
  const above = (o) => (ph) => `<div class="ht-me${ph ? ' ht-me--ph' : ''}">${o.top ? `<div class="ht-acts">${o.top(ph)}</div>` : ''}<div class="ht-row">${ph ? '' : `<span class="ht-mat">${img('ht-mat', 'صفحهٔ ماشین شما')}</span>`}${o.hand === false ? '' : hand(o.sel, o.lock)}${ph ? '' : engine(o.heat ?? 6)}</div></div>`;
  const opps = (turn, o = {}) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', turn: turn === 2, meta: `<span class="gc-tag gc-tag--soft">${fa(1)}م</span><span class="ht-sm">دنده ${fa(o.ng ?? 3)}</span><span class="ht-sm">گرما ${fa(o.nh ?? 5)}</span>` },
    { name: 'رضا', av: 'ر', seat: 6, clock: '0:35', turn: turn === 6, meta: `<span class="gc-tag gc-tag--soft">${fa(2)}م</span><span class="ht-sm">دنده ${fa(o.rg ?? 2)}</span><span class="ht-sm">گرما ${fa(o.rh ?? 6)}</span>` },
  ];
  const rail = `<section class="cx-card"><h3>پیست آمریکا</h3><div class="gc-pills"><span class="bgv-chip">${img('ht-tok-weather', '')}آفتابی</span><span class="bgv-chip">دور ${fa(1)} از ${fa(2)}</span></div><div class="ga-rule">${ic('info')}<span>دنده تعداد کارت‌هاست. یک دنده بالا یا پایین رایگان است و دو دنده ${fa(1)} گرما می‌خواهد. اگر از پیچ با سرعتی بیشتر از عدد آن رد شوید، به اندازهٔ اختلاف گرما می‌دهید؛ اگر گرما نداشته باشید، ماشین پیش از پیچ می‌چرخد.</span></div></section>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const react = (ph) => `<div class="ht-react" role="group" aria-label="واکنش‌ها"><span class="ht-speed"><small>سرعت</small><b>${fa(6)}</b></span><button type="button" class="ht-rb is-on"><b>آدرنالین</b><small>آخر هستید: ${fa(1)}+ سرعت</small></button><button type="button" class="ht-rb"><b>تقویت</b><small>${fa(1)} گرما، یک کارت از دسته</small></button>${ph ? '' : `<span class="ht-warn">${ic('info')}پیچ ${fa(4)}: سرعت ${fa(7)} ← ${fa(3)} گرما</span>`}${btn('تأیید حرکت', 'primary', 'check')}</div>`;
  return {
    slug: 'Heat', fa: 'هیت', latin: 'Heat: Pedal to the Metal', meta: ['زنده', '۳ نفر', 'پیست آمریکا'],
    opps: opps(0),
    me: { cards: [], clock: '0:30', turn: true, note: `<span class="cx-note">جای ${fa(3)}<span class="bgv-sep"></span>دنده ${fa(3)}</span>`, above: above({ top: (ph) => `${gears(3)}${btn(ph ? `تأیید (${fa(3)})` : `تأیید ${fa(3)} کارت`, 'primary', 'check')}`, sel: [0, 1, 2] }) },
    table: table({}),
    status: `<b>برنامه‌ریزی (هم‌زمان):</b> دنده را از ${fa(2)} به ${fa(3)} بردید (رایگان)، پس ${fa(3)} کارت انتخاب می‌کنید: ${fa(1)}، ${fa(2)} و ${fa(3)}، یعنی سرعت ${fa(6)}. کارت گرما و استرس انتخاب‌شدنی نیستند. بقیه هم همین حالا انتخاب می‌کنند.`,
    pstatus: `<b>برنامه‌ریزی.</b> دندهٔ ${fa(3)}: سه کارت انتخاب کنید.`,
    railCard: rail, logNote: `دور ${fa(1)}`,
    log: [[2, 'نیلوفر با سرعت ۸ از پیچ ۴ رد شد: ۴ گرما'], [6, 'رضا مکش کرد: ۲+'], [1, 'نوبت برنامه‌ریزی']],
    dockItems: [['list', 'رویدادها'], ['search', 'پیست'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'حرکت و واکنش‌ها', turnSub: 'کارت‌ها رو شدند',
        table: table({ path: [12, 13, 14, 15, 16, 17, 18], ghost: [18, 0] }),
        me: { above: above({ top: react, hand: false }) },
        status: `<b>نوبت حرکت شماست.</b> کارت‌ها رو شدند: سرعت ${fa(6)}. چون آخر هستید آدرنالین (${fa(1)}+) دارید و به خانهٔ ${fa(18)} می‌رسید. پیچ سر راه سرعت مجاز ${fa(4)} دارد، پس ${fa(3)} گرما از موتور به دور ریخته‌ها می‌رود.`,
        log: [[2, 'نیلوفر حرکت کرد'], [6, 'رضا حرکت کرد'], [1, 'کارت‌های شما: ۱، ۲، ۳']],
      },
      {
        shotTitle: 'چرخیدن', turnSub: 'گرما برای پیچ کافی نیست',
        table: table({ cars: { y: [14, 0], g: [13, 1], b: [12, 1] }, flag: [12, '!'] }),
        me: { above: above({ heat: 0, hand: false }) },
        overlay: () => modal('ماشین چرخید', `<p>سرعت ${fa(9)} در پیچ ${fa(4)} یعنی ${fa(5)} گرما، ولی موتور فقط ${fa(0)} گرما دارد. ماشین پیش از پیچ متوقف می‌شود.</p><div class="ht-spin">${card('x')}${card('x')}<span><b>${fa(2)}+ استرس</b><small>به دست می‌آید؛ دنده ${fa(1)} می‌شود</small></span></div>`, btn('ادامه', 'primary', 'check')),
        status: '<b>چرخیدید.</b> ماشین روی خانهٔ پیش از پیچ ماند، دو کارت استرس به دستتان آمد و دنده به ۱ برگشت.',
        log: [[1, 'سرعت ۹ در پیچ ۴: گرما کافی نبود'], [1, 'شما چرخیدید: ۲+ استرس']],
      },
      {
        shotTitle: 'دور ریختن', turnSub: 'پایان نوبت',
        table: table({ cars: { y: [14, 0], g: [13, 1], b: [18, 0] } }),
        me: { above: above({ top: (ph) => `<span class="ht-msg">${ic('info')}هر تعداد کارت سرعت را دور بریزید؛ گرما و استرس قفل‌اند</span>${btn('پایان نوبت', 'primary', 'check')}`, sel: [4], heat: 3 }) },
        status: '<b>دور ریختن.</b> حرکت تمام شد و دست تا ۷ کارت پر شد. کارت‌هایی که نمی‌خواهید را دور بریزید؛ کارت‌های گرما و استرس در دست می‌مانند تا با خنک‌کاری یا بازی کردن کنار بروند.',
        log: [[1, 'شما به خانهٔ ۱۸ رسیدید'], [1, '۳ گرما برای پیچ']],
      },
      {
        shotTitle: 'نوبت دیگران', turnSub: 'به ترتیب مسابقه',
        opps: opps(2, { nh: 2 }),
        table: table({ cars: { y: [21, 1], g: [13, 1], b: [18, 0] }, path: [15, 16, 17, 18, 19, 20, 21] }),
        me: { turn: false, above: above({ lock: false }) },
        status: '<b>نیلوفر حرکت می‌کند.</b> ماشین جلویی اول حرکت می‌کند. کارت‌های رو شدهٔ هر نفر، سرعتش و گرمایی که برای پیچ داد در رویدادها می‌آید.',
        log: [[2, 'نیلوفر: کارت‌های ۴ و ۳، سرعت ۷'], [2, 'نیلوفر مکش کرد: ۲+']],
      },
      {
        shotTitle: 'آب‌وهوا و شرایط جاده', turnSub: 'ماژول پیشرفته',
        table: (ph) => `${win({ tokens: [['limit-minus', 1571, 1009], ['limit-plus', 53, 958], ['overheat', 864, 61], ['slipstream', 1517, 272]] }, ph)}${ph ? '' : `<div class="ht-wx">${img('ht-wcard-rain', 'کارت آب‌وهوا: باران')}<span><b>باران</b><small>${fa(1)} استرس بیشتر در دسته، و خنک‌کاری ${fa(1)}+</small></span><span class="ht-legend">${[['limit-minus', `سرعت مجاز ${fa(1)}−`], ['limit-plus', `سرعت مجاز ${fa(1)}+`], ['overheat', `داغ کردن: ${fa(1)} گرمای اضافه`], ['slipstream', `مکش ${fa(1)}+ در بخش بعد`]].map(([k, t]) => `<i>${img('ht-tok-' + k, '')}${t}</i>`).join('')}</span></div>`}`,
        me: { above: above({ hand: false }) },
        status: `<b>آب‌وهوا و شرایط جاده روشن است.</b> کارت آب‌وهوای این مسابقه «باران» است و روی هر پیچ یک نشان شرایط جاده نشسته: پیچ ${fa(4)} حالا سرعت مجاز ${fa(3)} دارد. راهنمای نشان‌ها زیر پیست است.`,
        log: [[1, 'آب‌وهوا: باران'], [1, 'نشان‌های شرایط جاده روی پیچ‌ها چیده شد']],
      },
      {
        shotTitle: 'گاراژ', turnSub: 'ماژول پیشرفته: انتخاب کارت ارتقا',
        table: (ph) => `<div class="ht-garage">${[['turbo', 'توربو'], ['cooler', 'خنک‌کن'], ['brakes', 'ترمز']].map(([k, n], i) => `<button type="button" class="ht-up${i === 0 ? ' is-sel' : ''}">${img('ht-g-' + k, n)}<small>${n}</small></button>`).join('')}</div>`,
        me: { above: above({ top: () => btn('برداشتن توربو', 'primary', 'check'), hand: false }) },
        status: '<b>گاراژ: دور ۱ از ۳.</b> یک کارت ارتقا از بازار بردارید؛ بقیه هم هم‌زمان انتخاب می‌کنند. کارت‌های ارتقا وارد دستهٔ شما می‌شوند.',
        log: [[1, 'گاراژ روشن است: سه دور انتخاب']],
      },
      {
        shotTitle: 'پایان مسابقه', turnSub: 'رتبه و امتیاز قهرمانی',
        opps: opps(0), table: table({ cars: { y: [66, 1], g: [64, 0], b: [68, 0] }, order: [['شما', 1, true], ['نیلوفر', 2], ['رضا', 6]] }),
        me: { turn: false, clock: '', above: above({ hand: false }), note: `<span class="cx-note">اول</span>` },
        overlay: () => modal('شما اول شدید', tbl(['رتبه', 'بازیکن', 'امتیاز این مسابقه', 'جمع قهرمانی'], [{ c: [fa(1), 'شما', fa(9), fa(9)], win: true }, { c: [fa(2), 'نیلوفر', fa(6), fa(6)] }, { c: [fa(3), 'رضا', fa(4), fa(4)] }]) + '<p class="cx-note">کسی که اول از خط پایان رد شود اول است؛ ماشین‌هایی که در یک نوبت رد شوند به ترتیب جایشان رتبه می‌گیرند. در قهرمانی، مسابقهٔ بعد روی پیست بعدی است.</p>', `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`),
        status: '<b>مسابقه تمام شد.</b> همه از خط پایان رد شدند.',
        log: [[1, 'شما از خط پایان رد شدید!'], [2, 'نیلوفر رسید'], [6, 'رضا رسید']],
      },
    ],
    css: `.gc-table{flex-direction:column;gap:8px}
.ht-b{position:relative;inline-size:var(--bw);flex:none;border-radius:8px;overflow:hidden;box-shadow:0 12px 20px -12px rgba(0,0,0,.7)}
.ht-b>img:first-child{display:block;inline-size:100%;block-size:auto}
.ht-car{position:absolute;inline-size:4.4%;block-size:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.ht-car.is-ghost{opacity:.6;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 2px var(--felt-gold))}
.ht-dot{position:absolute;inline-size:1.3%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:var(--felt-gold);box-shadow:0 0 0 2px rgba(20,43,59,.7)}
.ht-dot.is-end{inline-size:2.1%;background:#FAF5EC;box-shadow:0 0 0 3px var(--felt-gold)}
.ht-flag{position:absolute;transform:translate(-50%,-160%);inline-size:22px;block-size:22px;border-radius:50%;display:grid;place-items:center;background:#E0505C;color:#fff;font-size:14px}
.ht-win{position:relative;inline-size:370px;block-size:300px;overflow:hidden;border-radius:8px;flex:none}
.ht-pan{position:absolute;left:-450px;top:-300px}
.ht-zoom{position:absolute;inset-block-end:8px;inset-inline-start:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(8,20,28,.75);color:#FAF5EC;font-size:12px}.ht-zoom .bgv-icon{inline-size:14px;block-size:14px}
.ht-order{display:flex;align-items:center;gap:8px;color:var(--felt-ink);font-size:13px}.ht-order span{display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 6px;border-radius:999px;background:rgba(8,20,28,.3)}.ht-order span.is-me{box-shadow:inset 0 0 0 1.5px var(--felt-gold)}.ht-order b{color:var(--felt-gold)}.ht-order i{inline-size:9px;block-size:9px;border-radius:50%}.ht-order small{color:var(--felt-muted)}
.ht-me{display:grid;gap:8px;justify-items:center;inline-size:100%}
.ht-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
.ht-row{display:flex;gap:12px;align-items:center}
.ht-mat img{display:block;inline-size:190px;border-radius:6px}
.ht-hand{display:flex;gap:4px;direction:ltr}.ht-c{display:block}.ht-c img{display:block;inline-size:52px;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.ht-c.is-sel{transform:translateY(-10px)}.ht-c.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}.ht-c.is-lock img{filter:grayscale(.6) brightness(.7)}
.ht-eng{display:grid;justify-items:center;gap:2px;color:var(--felt-ink);font-size:11.5px}.ht-eng img{inline-size:36px;border-radius:3px}.ht-eng b{font-size:16px}.ht-eng small{color:var(--felt-muted)}
.ht-gears{display:flex;gap:6px}.ht-gb{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:2px;padding:6px 8px;min-block-size:44px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}.ht-gb img{inline-size:58px}.ht-gb small{font-size:11px}.ht-gb.is-on{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.ht-react{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.ht-speed{display:grid;justify-items:center;color:var(--felt-ink)}.ht-speed small{color:var(--felt-muted);font-size:11.5px}.ht-speed b{font-size:26px;line-height:1}
.ht-rb{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:1px;padding:6px 12px;min-block-size:44px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}.ht-rb b{font-size:13px}.ht-rb small{font-size:11px;color:#3A4F5E}.ht-rb.is-on{background:var(--felt-gold);box-shadow:inset 0 0 0 2px #142B3B,0 3px 0 #0D1A23}
.ht-warn,.ht-msg{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:var(--radius-sm);background:rgba(232,166,66,.2);color:#FFE2A8;font-size:12.5px}.ht-msg{background:rgba(8,20,28,.35);color:var(--felt-ink)}
.ht-spin{display:flex;gap:8px;align-items:center}.ht-spin .ht-c img{inline-size:56px}.ht-spin span{display:grid}.ht-spin small{color:var(--text-muted)}
.ht-tok{position:absolute;inline-size:4.6%;transform:translate(-50%,-50%);border-radius:6px;box-shadow:0 0 0 2px #fff,0 3px 6px rgba(0,0,0,.5)}
.ht-wx{display:flex;gap:12px;align-items:center;color:var(--felt-ink);font-size:13px}.ht-wx>img{inline-size:120px;border-radius:6px}.ht-wx>span:nth-child(2){display:grid;gap:2px;max-inline-size:150px}.ht-wx small{color:var(--felt-muted)}.ht-legend{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}.ht-legend i{display:inline-flex;align-items:center;gap:6px;font-style:normal;font-size:12px}.ht-legend img{inline-size:26px;border-radius:4px}
.ht-garage{display:flex;gap:14px}.ht-up{all:unset;cursor:pointer;display:grid;justify-items:center;gap:6px;color:var(--felt-ink);font-size:13px}.ht-up img{inline-size:120px;border-radius:6px}.ht-up.is-sel img{box-shadow:0 0 0 3px var(--felt-gold)}
.ht-sm{white-space:nowrap}.gc-seat__meta .gc-tag{white-space:nowrap}.bgv-chip img{inline-size:18px;block-size:18px;border-radius:3px;margin-inline-end:4px}
.cx-phone .gc-table{gap:6px}.ht-me--ph .ht-c img{inline-size:44px}.ht-me--ph .ht-gb{padding:5px}.ht-me--ph .ht-gb img{inline-size:40px}.ht-me--ph .ht-gb small{display:none}.ht-me--ph .ht-acts{gap:6px;flex-wrap:nowrap}.ht-me--ph .ht-react{gap:5px;padding-inline:8px}.ht-me--ph .ht-msg{font-size:12px}.cx-phone .ht-up img{inline-size:100px}`,
    shotTitle: 'نوبت شما', turnSub: 'برنامه‌ریزی: دنده و کارت',
    diffs: [
      ['چیدمان', 'مثل BGA: پیست آمریکا وسط با ماشین‌ها روی خانه‌ها (دو لاین)، زیرش ترتیب مسابقه و شمار دور. پایین صفحهٔ ماشین شما، دست ۷ کارتی و گرمای موتور'],
      ['برنامه‌ریزی', 'دکمه‌های دنده با هزینه (یک دنده رایگان، دو دنده ۱ گرما) و انتخاب کارت به تعداد دنده؛ گرما و استرس قفل‌اند'],
      ['حرکت', 'مسیر حرکت با نقطه‌های طلایی و پیش‌نمایش ماشین روی خانهٔ آخر؛ پنل واکنش‌ها (آدرنالین، تقویت، مکش، خنک‌کاری) با هشدار گرمای پیچ (§۴)'],
      ['حالت‌های خاص', 'چرخیدن پیش از پیچ (§۵)، دور ریختن (§۶)، حرکت بقیه به ترتیب (§۷)، آب‌وهوا و نشان‌های شرایط جاده روی پیچ‌ها (§۸)، گاراژ در ماژول پیشرفته (§۹)، جدول رتبه و قهرمانی (§۱۰)'],
      ['گوشی', 'بخشی از پیست دور ماشین شما بزرگ دیده می‌شود با «کل پیست»'],
      ['قوانین', 'مثل موتور: ۲ تا ۶ نفر، چهار پیست؛ پیست‌های موتور (tracks.ts) هندسهٔ ساختهٔ سایت دارند و با صفحهٔ BGA این طرح (۶۹ خانه، ۴ پیچ) فرق دارند؛ کارش در RULES.md'],
    ],
  };
}
