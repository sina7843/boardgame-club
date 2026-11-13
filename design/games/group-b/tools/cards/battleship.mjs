// Battleship / بتل‌شیپ on the shared table frame (group B). Rules as the repo engine: 2 players, 10×10 seas, fleet
// 5·4·3·3·2, alternate single shots (no extra shot on a hit), "hit" doesn't say which ship, a sunk ship is named and shown.
// Rows «الف» … «د» (top → bottom), columns ۱ … ۱۰ (left → right), cell name = row + column (e.g. ح۳).
// Mock (you fire first; shot 18): your shots 17 = sunk submarine ت۶–ت۸ + hits ج۳, چ۳ (battleship, not sunk) + 12 misses;
// you aim at ح۳ below the two hits. Reza's 17 shots: sank your patrol boat (ح۱, خ۱), 2 hits on your carrier (ب۳, ب۴), 13 misses.
// Reza's hidden ships (not drawn): carrier خ… row 9 x4–8, cruiser x9 y0–2, patrol (6,6)-(7,6) — no miss lies on them.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const ROWS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د'];
  const NAMES = ['ناو هواپیمابر', 'رزمناو', 'ناوشکن', 'زیردریایی', 'قایق گشتی'];
  const LEN = [5, 4, 3, 3, 2];
  // cropped chart 532×527: grid x0 35, y0 30, cell 48.3; ship art is drawn for 50 px cells with 11 px bow/stern overhang
  const W = 532, Hh = 527, X0 = 35, Y0 = 30, C = 48.3, S = C / 50;
  const pos = (x, y) => `left:${((X0 + (x + 0.5) * C) / W * 100).toFixed(3)}%;top:${((Y0 + (y + 0.5) * C) / Hh * 100).toFixed(3)}%`;
  const ship = (k, x, y, dir, sunk) => {
    const len = LEN[k], cx = X0 + (dir === 'h' ? x + len / 2 : x + 0.5) * C, cy = Y0 + (dir === 'v' ? y + len / 2 : y + 0.5) * C;
    return `<span class="bs-ship${dir === 'v' ? ' is-v' : ''}${sunk ? ' is-sunk' : ''}" style="left:${(cx / W * 100).toFixed(3)}%;top:${(cy / Hh * 100).toFixed(3)}%;inline-size:${((len * 50 + 22) * S / W * 100).toFixed(3)}%">${img(`battleship-ship-${k}${sunk ? '-sunk' : ''}`, NAMES[k] + (sunk ? '، غرق شده' : ''))}</span>`;
  };
  const shot = (x, y, hit, onSunk) => `<span class="bs-shot${hit ? ' is-hit' : ''}${onSunk ? ' is-onsunk' : ''}" style="${pos(x, y)}">${img(hit ? 'battleship-hit' : 'battleship-miss', `${ROWS[y]}${fa(x + 1)}: ${hit ? 'اصابت' : 'آب'}`)}</span>`;
  const myMiss = [[6, 0], [0, 2], [3, 3], [6, 3], [1, 5], [5, 6], [9, 6], [2, 8], [7, 9], [9, 1], [0, 4], [3, 7], [7, 7]];
  const myHit = [[2, 1], [3, 1], [0, 7], [0, 8]];
  const oppMiss = [[0, 0], [4, 1], [7, 1], [2, 2], [4, 3], [8, 3], [0, 5], [5, 5], [2, 4], [3, 6], [8, 7], [5, 8]];
  const oppHit = [[5, 3], [6, 3], [7, 3], [2, 5], [2, 6]];
  const aim = [2, 7];
  const mine = (ph) => `<figure class="bs-sea bs-sea--mine${ph ? ' bs-sea--ph' : ''}"><figcaption>دریای شما <small>${fa(4)} کشتی شناور</small></figcaption><div class="bs-chart">${img('battleship-chart', 'دریای شما')}
${ship(0, 1, 1, 'h')}${ship(1, 8, 2, 'v')}${ship(2, 3, 4, 'h')}${ship(3, 4, 8, 'h')}${ship(4, 0, 7, 'v', true)}
${myMiss.map(([x, y]) => shot(x, y, false)).join('')}${myHit.map(([x, y]) => shot(x, y, true, x === 0)).join('')}<i class="bs-last" style="${pos(3, 1)}"></i></div></figure>`;
  const target = (ph) => `<figure class="bs-sea bs-sea--target${ph ? ' bs-sea--ph' : ''}"><figcaption>دریای رضا <small>شلیک‌های شما<span class="bgv-sep"></span>${fa(4)} کشتی شناور</small></figcaption><div class="bs-chart">${img('battleship-chart', 'دریای رضا')}
<i class="bs-band bs-band--row" style="top:${((Y0 + aim[1] * C) / Hh * 100).toFixed(3)}%;block-size:${(C / Hh * 100).toFixed(3)}%"></i><i class="bs-band bs-band--col" style="left:${((X0 + aim[0] * C) / W * 100).toFixed(3)}%;inline-size:${(C / W * 100).toFixed(3)}%"></i>
${ship(3, 5, 3, 'h', true)}${oppMiss.map(([x, y]) => shot(x, y, false)).join('')}${oppHit.map(([x, y]) => shot(x, y, true, y === 3)).join('')}
<span class="bs-aim" style="${pos(...aim)}"><i></i><b dir="rtl">${ROWS[aim[1]]}${fa(aim[0] + 1)}</b></span></div></figure>`;
  const fleet = (sunk) => `<ul class="bs-fleet">${[0, 1, 2, 3, 4].map((k) => `<li class="${k === sunk ? 'is-sunk' : ''}"><i class="bs-fleet__s">${img(`battleship-ship-${k}${k === sunk ? '-sunk' : ''}`, '', '')}</i><span>${NAMES[k]}<small>${fa(LEN[k])} خانه${k === sunk ? '، غرق شد' : ''}</small></span></li>`).join('')}</ul>`;
  const above = (ph) => `<div class="bs-fire${ph ? ' bs-fire--ph' : ''}"><span class="bs-fire__t">${ic('search')}<span><b>هدف: ${ROWS[aim[1]]}${fa(aim[0] + 1)}</b>${ph ? '' : '<small>زیر دو اصابت ج۳ و چ۳</small>'}</span></span>${btn('شلیک', 'primary', 'zap')}</div>`;
  const { modal } = H;
  const sea = (cls, cap, inner, ph) => `<figure class="bs-sea ${cls}${ph ? ' bs-sea--ph' : ''}"><figcaption>${cap}</figcaption><div class="bs-chart">${img('battleship-chart', 'دریا')}${inner}</div></figure>`;
  const ghost = (k, x, y, bad) => { const len = LEN[k], cx = X0 + (x + len / 2) * C, cy = Y0 + (y + 0.5) * C; return `<span class="bs-ship bs-ghost${bad ? ' is-bad' : ''}" style="left:${(cx / W * 100).toFixed(3)}%;top:${(cy / Hh * 100).toFixed(3)}%;inline-size:${((len * 50 + 22) * S / W * 100).toFixed(3)}%">${img(`battleship-ship-${k}`, 'کشتی در حال گذاشتن')}</span>`; };
  const setupSea = (ph) => sea('bs-sea--target', `دریای شما <small>چیدمان پنهان</small>`, `${ship(0, 1, 1, 'h')}${ship(1, 8, 2, 'v')}${ship(2, 3, 4, 'h')}${ghost(3, 4, 4, true)}<span class="bs-err" style="${pos(5, 5)}">روی کشتی دیگر</span>`, ph);
  const dock = `<ul class="bs-dock">${[[3, 'زیردریایی', true], [4, 'قایق گشتی', false]].map(([k, n, s]) => `<li class="${s ? 'is-sel' : ''}">${img(`battleship-ship-${k}`, n)}<small>${n}</small></li>`).join('')}</ul>`;
  const setupBar = (ph) => `<div class="bs-fire bs-fire--wrap${ph ? ' bs-fire--ph' : ''}">${ph ? '' : dock}<span class="bs-fire__t"><span><b>${fa(3)} از ${fa(5)} کشتی گذاشته شد</b><small class="bs-bad">${ph ? 'روی کشتی دیگر است' : 'زیردریایی روی ناوشکن افتاده؛ جای دیگری بگذارید'}</small></span></span><span class="bs-btns">${btn('چرخاندن', 'secondary', 'repeat')}${btn(ph ? 'تصادفی' : 'چیدمان تصادفی', 'secondary', 'zap')}${btn(ph ? 'تأیید' : 'تأیید چیدمان', 'primary', 'check', ' disabled')}</span></div>`;
  const fullMine = (ph) => sea('bs-sea--target', 'دریای شما <small>چیده شد</small>', `${ship(0, 1, 1, 'h')}${ship(1, 8, 2, 'v')}${ship(2, 3, 4, 'h')}${ship(3, 4, 8, 'h')}${ship(4, 0, 7, 'v')}`, ph);
  const hitTarget = (ph) => sea('bs-sea--target', `دریای رضا <small>${fa(3)} کشتی شناور</small>`, `${ship(3, 5, 3, 'h', true)}${ship(2, 2, 5, 'v', true)}${oppMiss.map(([x, y]) => shot(x, y, false)).join('')}${oppHit.map(([x, y]) => shot(x, y, true, true)).join('')}${shot(2, 7, true, true)}<span class="bs-boom" style="${pos(2, 7)}"><b>ح۳: اصابت، ناوشکن غرق شد</b></span>`, ph);
  const endTarget = (ph) => sea('bs-sea--target', 'ناوگان رضا <small>همهٔ کشتی‌ها رو شد</small>', `${ship(0, 4, 8, 'h', true)}${ship(1, 9, 0, 'v', true)}${ship(2, 2, 5, 'v', true)}${ship(3, 5, 3, 'h', true)}${ship(4, 6, 6, 'h', true)}`, ph);
  const ending = `<section class="cx-card"><h3>شما بردید<span class="bgv-spacer"></span><span class="cx-note">شلیک ${fa(41)}</span></h3><div class="gc-pills"><span class="bgv-chip">شما: ${fa(17)} اصابت از ${fa(41)}</span><span class="bgv-chip">رضا: ${fa(14)} اصابت از ${fa(40)}</span><span class="bgv-chip">کشتی‌های شناور شما: ${fa(1)}</span></div><div class="ga-rule">${ic('info')}<span>اولین کسی که هر پنج کشتی حریف را غرق کند می‌برد؛ مساوی ندارد. حالا ناوگان رضا کامل نشان داده می‌شود.</span></div></section>`;  return {
    slug: 'Battleship', fa: 'بتل‌شیپ', latin: 'Battleship', meta: ['زنده', '۲ نفر', 'شلیک ۱۸'],
    opps: [{ name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `<span class="bs-m">${fa(4)} کشتی شناور<span class="bgv-sep"></span>${fa(4)} اصابت</span>` }],
    me: { cards: [], clock: '0:19', turn: true, note: `<span class="bs-m bs-m--me">${fa(4)} کشتی شناور<span class="bgv-sep"></span>${fa(5)} اصابت از ${fa(17)}</span>`, above },
    table: (ph) => ph ? `<div class="bs-ph">${target(true)}</div>` : `${target(false)}${mine(false)}`,
    status: '<b>نوبت شماست.</b> روی دریای رضا خانه‌ای را بزنید که قبلاً نزده‌اید. ج۳ و چ۳ اصابت بوده و ث۳ آب؛ پس کشتی عمودی است و ح۳ انتخاب خوبی است.',
    pstatus: '<b>نوبت شما.</b> ح۳ را نشانه گرفته‌اید؛ شلیک کنید.',
    railCard: `<section class="cx-card"><h3>ناوگان رضا<span class="bgv-spacer"></span><span class="cx-note">${fa(4)} از ${fa(5)} شناور</span></h3>${fleet(3)}<div class="ga-rule">${ic('info')}<span>«اصابت» نمی‌گوید به کدام کشتی خورده؛ فقط وقتی کشتی غرق شود نامش اعلام و جایش دیده می‌شود.</span></div></section>`,
    logNote: 'شلیک ۱۷',
    log: [[6, 'رضا خ۱ زد: اصابت؛ قایق گشتی شما غرق شد'], [1, 'شما ج۳ زدید: اصابت'], [6, 'رضا ب۳ زد: اصابت'], [1, 'شما چ۳ زدید: اصابت'], [6, 'رضا ب۴ زد: اصابت'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['eye', 'دریای من'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'چیدمان', turnSub: 'گذاشتن، چرخاندن، خطا، تصادفی و تأیید', meta: ['زنده', '۲ نفر', 'چیدمان'],
        opps: [{ name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: '<span class="bs-m">در حال چیدن</span>' }],
        table: (ph) => setupSea(ph), me: { clock: '0:48', note: '<span class="bs-m bs-m--me">چیدمان پنهان</span>', above: setupBar },
        railCard: `<section class="cx-card"><h3>چیدمان</h3><div class="ga-rule">${ic('info')}<span>کشتی افقی یا عمودی، کامل داخل دریا و بدون روی هم افتادن. هر دو نفر هم‌زمان و پنهانی می‌چینند و بعد از شروع جابه‌جایی ندارد.</span></div></section>`,
        status: '<b>ناوگانتان را بچینید.</b> کشتی را از پایین انتخاب کنید، با «چرخاندن» افقی یا عمودی کنید و روی دریا بگذارید. زیردریایی روی ناوشکن افتاده و قرمز است.',
        pstatus: '<b>چیدمان.</b> زیردریایی جای درستی ندارد.',
        log: [[1, 'شما ناو هواپیمابر، رزمناو و ناوشکن را گذاشتید']], phone: true,
      },
      {
        shotTitle: 'منتظر حریف', turnSub: 'چیدمان تأیید شد', phone: true, phoneOnly: true, meta: ['زنده', '۲ نفر', 'چیدمان'],
        opps: [{ name: 'رضا', av: 'ر', seat: 6, clock: '0:31', meta: '<span class="bs-m">در حال چیدن</span>' }],
        table: (ph) => `<div class="bs-ph">${fullMine(true)}</div>`, me: { turn: false, note: '<span class="bs-m bs-m--me">آماده</span>', above: (ph) => `<div class="bs-fire bs-fire--ph"><span class="bs-fire__t">${ic('clock')}<span><b>منتظر رضا</b><small>وقتی او هم تأیید کند بازی شروع می‌شود</small></span></span></div>` },
        pstatus: '<b>چیدمان شما تأیید شد.</b> منتظر رضا.', status: '',
      },
      {
        shotTitle: 'نتیجهٔ شلیک', turnSub: 'اصابت، آب یا غرق؛ پیش از رفتن نوبت',
        opps: [{ name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: `<span class="bs-m">${fa(3)} کشتی شناور<span class="bgv-sep"></span>${fa(4)} اصابت</span>` }],
        table: (ph) => ph ? `<div class="bs-ph">${hitTarget(true)}</div>` : `${hitTarget(false)}${mine(false)}`,
        me: { turn: false, above: (ph) => `<div class="bs-fire${ph ? ' bs-fire--ph' : ''}"><span class="bs-fire__t">${ic('zap')}<span><b>ح۳: اصابت؛ ناوشکن رضا غرق شد</b><small>اصابت شلیک اضافه نمی‌دهد؛ نوبت رضاست</small></span></span></div>` },
        railCard: `<section class="cx-card"><h3>ناوگان رضا<span class="bgv-spacer"></span><span class="cx-note">${fa(3)} از ${fa(5)} شناور</span></h3><div class="gc-pills"><span class="bgv-chip">غرق: زیردریایی</span><span class="bgv-chip">غرق: ناوشکن</span></div></section>`,
        status: '<b>ح۳ اصابت بود و ناوشکن رضا غرق شد.</b> کشتی غرق‌شده سر جایش خاکستری دیده می‌شود. حالا نوبت رضاست.',
        pstatus: '<b>ح۳: اصابت.</b> ناوشکن غرق شد.',
        log: [[1, 'شما ح۳ زدید: اصابت'], [1, 'ناوشکن رضا غرق شد'], [6, 'نوبت رضا']], phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'ناوگان کامل حریف', meta: ['تمام شد', '۲ نفر', 'شلیک ۴۱'],
        opps: [{ name: 'رضا', av: 'ر', seat: 6, meta: `<span class="bs-m">${fa(0)} کشتی شناور</span>` }],
        table: (ph) => ph ? `<div class="bs-ph">${endTarget(true)}</div>` : `${endTarget(false)}${mine(false)}`,
        me: { turn: false, clock: '', above: (ph) => `<div class="bs-fire${ph ? ' bs-fire--ph' : ''}"><span class="bs-fire__t">${ic('trophy')}<span><b>شما بردید</b><small>هر پنج کشتی رضا غرق شد</small></span></span>${btn('بازی دوباره', 'primary', 'repeat')}</div>` },
        railCard: ending,
        status: '<b>بازی تمام شد.</b> آخرین کشتی رضا (ناو هواپیمابر) غرق شد و ناوگانش کامل رو شد.',
        log: [[1, 'شما خ۸ زدید: ناو هواپیمابر رضا غرق شد'], [1, 'شما بردید']],
      },
    ],    css: `.bs-sea{margin:0;display:grid;gap:6px;justify-items:center;color:var(--felt-muted);font-size:13px}
.bs-sea figcaption{display:flex;align-items:baseline;gap:8px;color:var(--felt-ink);font-weight:700;font-size:14.5px}.bs-sea figcaption small{font-weight:400;font-size:12px;color:var(--felt-muted)}
.bs-chart{position:relative;direction:ltr;inline-size:var(--sw);aspect-ratio:532/527;filter:drop-shadow(0 14px 18px rgba(0,0,0,.55))}
.bs-chart>img{display:block;inline-size:100%;block-size:100%}
.bs-sea--target{--sw:430px}.bs-sea--mine{--sw:250px;align-self:center}
.bs-ship,.bs-shot,.bs-aim,.bs-last{position:absolute;transform:translate(-50%,-50%)}
.bs-ship img{display:block;inline-size:100%;block-size:auto}
.bs-ship.is-v{transform:translate(-50%,-50%) rotate(90deg)}
.bs-shot{inline-size:calc(var(--sw) * .1);pointer-events:none}.bs-shot img{display:block;inline-size:100%;block-size:auto}
.bs-shot.is-hit{inline-size:calc(var(--sw) * .115)}.bs-shot.is-onsunk{inline-size:calc(var(--sw) * .06);opacity:.9}
.bs-band{position:absolute;background:rgba(232,166,66,.16);pointer-events:none}.bs-band--row{inset-inline:6.6% 2.6%}.bs-band--col{inset-block:5.7% 2.6%}
.bs-aim{inline-size:calc(var(--sw) * .1);aspect-ratio:1;border-radius:6px;box-shadow:0 0 0 3px #E8A642,0 0 0 5px #142B3B,0 0 18px 4px rgba(232,166,66,.6)}
.bs-aim i{position:absolute;inset:0;background:linear-gradient(#E8A642,#E8A642) center/2px 60% no-repeat,linear-gradient(#E8A642,#E8A642) center/60% 2px no-repeat}
.bs-aim b{position:absolute;inset-block-start:calc(100% + 7px);left:50%;transform:translateX(-50%);padding:1px 8px;border-radius:999px;background:#E8A642;color:#142B3B;font-size:12.5px;white-space:nowrap}
.bs-last{inline-size:calc(var(--sw) * .1);aspect-ratio:1;border-radius:4px;box-shadow:0 0 0 2px #FAF5EC}
.bs-m{white-space:nowrap}
.bs-fire{display:flex;align-items:center;gap:14px;inline-size:100%;padding:8px 12px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.bs-fire__t{display:flex;align-items:center;gap:10px;flex:1}.bs-fire__t>.bgv-icon{color:var(--felt-gold);inline-size:24px;block-size:24px}.bs-fire__t span{display:grid;gap:1px}.bs-fire__t b{font-size:16px}.bs-fire__t small{font-size:12px;color:var(--felt-muted)}
.bs-fire .bgv-btn{min-inline-size:140px}
.bs-fire--ph{margin-inline:10px;inline-size:auto;padding:6px 10px}.bs-fire--ph .bgv-btn{min-inline-size:110px}
.bs-fleet{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.bs-fleet li{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--text)}.bs-fleet__s{flex:none;inline-size:100px;display:flex;justify-content:flex-start}.bs-fleet li img{block-size:auto;flex:none}.bs-fleet li:nth-child(1) img{inline-size:98px}.bs-fleet li:nth-child(2) img{inline-size:80px}.bs-fleet li:nth-child(3) img,.bs-fleet li:nth-child(4) img{inline-size:62px}.bs-fleet li:nth-child(5) img{inline-size:44px}
.bs-fleet li span{display:flex;align-items:baseline;gap:6px}.bs-fleet li small{color:var(--text-muted);font-size:12px}
.bs-fleet li.is-sunk span{color:var(--text-muted);text-decoration:line-through}
.bs-ph{display:grid;justify-items:center}.bs-sea--ph.bs-sea--target{--sw:340px}
.bs-ghost{opacity:.75}.bs-ghost.is-bad img{filter:drop-shadow(0 0 0 #F0AAA3) drop-shadow(0 0 4px #E2553F) sepia(1) saturate(4) hue-rotate(-20deg)}
.bs-err,.bs-boom{position:absolute;transform:translate(-50%,-180%);padding:2px 9px;border-radius:999px;background:#C8553D;color:#fff;font-size:12px;font-weight:800;white-space:nowrap}
.bs-boom{background:#E8A642;color:#142B3B;transform:translate(-20%,-170%)}
.bs-dock{list-style:none;margin:0;padding:0;display:flex;gap:8px}.bs-dock li{display:grid;justify-items:center;gap:2px;padding:4px 6px;border-radius:8px;font-size:11px;color:var(--felt-muted)}.bs-dock li img{block-size:22px;inline-size:auto}
.bs-dock li.is-sel{background:rgba(232,166,66,.2);box-shadow:inset 0 0 0 1.5px var(--felt-gold)}
.bs-bad{color:#F4B9B2!important}
.bs-fire--wrap{flex-wrap:wrap}.bs-fire--wrap .bs-fire__t{flex:1 1 60%}.bs-fire--ph.bs-fire--wrap .bs-fire__t{flex:1 1 100%}.bs-btns{display:flex;gap:8px;flex:1 1 100%;justify-content:flex-end}.bs-fire--wrap .bgv-btn{min-inline-size:0}.bs-fire--ph .bs-btns .bgv-btn{flex:1;padding-inline:8px}`,
    shotTitle: 'نوبت شما', turnSub: 'نشانه گرفتن یک خانه',
    diffs: [
      ['دو دریا به جای دست', 'وسط میز دریای حریف بزرگ (جای شلیک) و کنارش دریای خودتان کوچک‌تر با کشتی‌ها و شلیک‌های حریف؛ دست کارت ندارد. در گوشی فقط دریای حریف می‌آید و دریای خودتان با دکمهٔ «دریای من» در نوار پایین'],
      ['نشانه‌گیری', 'خانهٔ هدف حلقهٔ طلایی و نام خانه (ح۳) دارد و سطر و ستونش کم‌رنگ روشن می‌شود؛ دکمهٔ «شلیک» بالای نوار شما'],
      ['اصابت، آب، غرق', 'نشان‌های آمادهٔ آتش و آب؛ کشتی غرق‌شدهٔ حریف با تصویر خاکستری آماده سر جایش دیده می‌شود. آخرین شلیک حریف روی دریای شما قاب سفید دارد'],
      ['ناوگان حریف', 'در ستون کنار پنج کشتی حریف با تصویر آماده؛ غرق‌شده خاکستری و خط‌خورده. تعداد شناورها روی چیپ‌ها هم هست'],
      ['برگهٔ دریا', 'عنوان و «کشتی شناور ۵» که در تصویر آماده چاپ شده بود بریده شد، چون برای دریای حریف عدد غلط نشان می‌داد؛ این‌ها حالا متن زنده‌اند'],
      ['قوانین', 'مثل موتور: دونفره، ناوگان ۵، ۴، ۳، ۳ و ۲، چیدمان پنهان و هم‌زمان، هر نوبت یک شلیک (اصابت شلیک اضافه نمی‌دهد)'],
    ],
  };
}
