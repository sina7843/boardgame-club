// Spec + component sheet under the phones on BR-Mobile-Spec: §31 actions and errors, §32 pending decisions,
// §33 engine contract at a glance (full text: ENGINE.md), §34 every component with its COMPONENTS.md number.
const { C, M, CARD, ME, slug, statVal, figArt, IMG, URL, ICONS } = require('./bdr-lib');
const P = require('./bdr-parts');

const CSS = `
.bdr-spec{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;padding:0 16px 40px}
.bdr-spec .bdr-table td:first-child{white-space:nowrap}
.bdr-comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.bdr-spec__two{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,640px),1fr));gap:24px;align-items:start}
.bdr-comp{display:grid;gap:8px;align-content:start;padding:12px;border-radius:var(--radius-md);background:var(--surface-sunken);box-shadow:inset 0 0 0 1px var(--line)}
.bdr-comp h4{margin:0;display:flex;gap:8px;align-items:center;font-size:14px;font-weight:900;color:var(--heading)}
.bdr-comp h4 .bdr-no{display:inline-grid;place-items:center;min-inline-size:28px;block-size:28px;padding-inline:5px;border-radius:var(--radius-pill);background:var(--selected);color:var(--on-selected);font-size:13px}
.bdr-comp p{margin:0;font-size:12.5px;line-height:1.7;color:var(--text-muted)}
.bdr-comp code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;direction:ltr;unicode-bidi:isolate;background:var(--surface);padding:1px 4px;border-radius:4px}
.bdr-comp__art{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-block-size:60px;padding:8px;border-radius:var(--radius-sm);background:var(--surface)}
.bdr-comp__art.is-dark{background:var(--bdr-sea)}
.bdr-comp__art img{max-block-size:84px}
.bdr-swatch{display:inline-flex;align-items:center;gap:6px;font-size:12px}
.bdr-swatch i{inline-size:22px;block-size:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
.bdr-api{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px}
.bdr-api pre{margin:0;padding:12px;border-radius:var(--radius-sm);background:#0F1B24;color:#E6EDF2;font:12px/1.6 ui-monospace,Consolas,monospace;direction:ltr;text-align:left;white-space:pre-wrap}
`;

const ACTIONS = [
  ['invade', 'خشم = قدرت مهره (سردار، سرکردهٔ کوتوله‌ها، سرباز هِل: ۰)', 'مهره در ذخیره؛ مهره‌های روی نقشه کمتر از شاخ؛ روستای خالی در استان بیرونی سالم. کشتی (و مار دریایی) فقط به آبدره. ایگدراسیل فقط جن تاریکی.', 'روستاهای خالی، آبدره‌ها', 'NO_RAGE · HORNS_FULL · NOT_IN_RESERVE · VILLAGE_TAKEN · PROVINCE_DESTROYED · YGGDRASIL_MARCH_ONLY · SHIP_FJORD_ONLY'],
  ['march', '۱ خشم', 'از یک استان (نه آبدره) به یک استان دیگر، هر تعداد مهرهٔ غیرکشتی، تا جای روستای خالی. ایگدراسیل بی‌سقف. همسایه بودن لازم نیست.', 'استان مبدأ، مهره‌ها، استان مقصد', 'NO_RAGE · SHIPS_CANNOT_MOVE · NOT_ENOUGH_VILLAGES · SAME_PROVINCE'],
  ['upgrade', 'خشم = قدرت کارت (افسون فریگا −۱)', 'کارت ارتقا از دست روی جایگاه همان نوع؛ کارت قبلی دور ریخته می‌شود (هیولای قبلی از بازی بیرون). حداکثر ۲ هیولا. ارتقای مهره یا هیولا: یورش رایگان فوری اختیاری.', 'جایگاه‌های صفحهٔ قبیله', 'NO_RAGE · NOT_UPGRADE_CARD · SLOT_MISMATCH'],
  ['quest', 'رایگان (خشم باید بیش از صفر باشد)', 'کارت مأموریت از دست رو به پایین روی کارت قبیله. تعداد نامحدود.', 'کارت‌های مأموریت دست', 'NO_RAGE · NOT_QUEST_CARD'],
  ['pillage', 'رایگان (خشم باید بیش از صفر باشد)', 'استان سالم و غارت‌نشده که مهرهٔ شما در آن یا آبدرهٔ پشتیبانش هست ← نبرد (§۲۱).', 'نشان‌های غارت', 'NO_RAGE · ALREADY_PILLAGED · NO_PRESENCE · PROVINCE_DESTROYED'],
  ['pass', 'همهٔ خشم باقی', 'تا پایان فاز اقدام دیگر اقدامی ندارید؛ در نبردها هنوز شرکت می‌کنید.', '—', '—'],
  ['clan', 'طبق کارت', 'اقدام کارت قبیله: هماورد تیر (۲ خشم، غارت دوباره)، فداکاری فریگا (۲ مهره را نابود کن، یک ویژگی +۱).', 'استان / مهره‌ها', 'NO_RAGE · CARD_NOT_OWNED']
];
const PENDING = [
  ['draftPick', 'همه، هم‌زمان', 'هدایای خدایان', 'یک کارت (۲ نفره: دو کارت) از دستهٔ رسیده', '§۲۰، §۲۷'],
  ['freeInvade', 'بازیکن نوبت', 'پس از ارتقای مهره یا هیولا', 'یورش رایگان با همان مهره یا رد', '§۲'],
  ['extraWarrior', 'بازیکن نوبت', 'یاری فریگا پس از هر یورش', 'یک جنگجوی رایگان در همان استان یا رد', '§۲'],
  ['instantPillage', 'بازیکن نوبت', 'قلمرو تور پس از یورش', '۲ خشم و غارت فوری یا رد', '§۲'],
  ['callToBattle', 'هر بازیکن به ترتیب از چپ غارتگر', 'غارت', 'یک مهره از استان همسایه به روستای خالی یا رد', '§۲۱'],
  ['battleCard', 'همهٔ شرکت‌کننده‌ها، هم‌زمان', 'نبرد', 'یک کارت پنهان (یا هیچ اگر دست خالی است)', '§۲۱، §۲۸'],
  ['afterReveal', 'به ترتیب از غارتگر', 'پس از آشکار شدن', 'کارت با دایرهٔ سفید یا رد', '§۲۱'],
  ['keepOneFigure', 'هر شرکت‌کننده', 'موج اودین', 'یک مهره برای ماندن', '§۲۱'],
  ['replayCards', 'شرکت‌کننده‌ها', 'دیدبان هایمدال', 'کارت تازه', '§۲۱'],
  ['saveFigure', 'صاحب مهره', 'پناه فریگا هنگام نابودی', '۱ خشم و نجات یا رد', '§۲۱'],
  ['retreat', 'صاحب جادوگر وُلور', 'نابودی در استان بیرونی', 'عقب‌نشینی به ایگدراسیل یا رد', '§۲۱'],
  ['keepCards', 'برنده', 'دلاوری تیر', 'هر کارت آشکار با ۱ خشم', '§۲۱'],
  ['moveLeader', 'غارتگر', 'سرور پتک‌ها پس از غارت', 'استان همسایه یا ماندن', '§۲۱'],
  ['loserInvade', 'بازنده', 'برکت لوکی', 'یورش رایگان با جنگجو یا رد', '§۲۱'],
  ['raiseStat', 'یک بازیکن', 'مأموریت موفق، سوگند تور، سرور تبرها، لطف فریگا، فداکاری فریگا', 'خشم / تبر / شاخ', '§۲۲، §۳۰'],
  ['discardKeep', 'همه، هم‌زمان', 'دور ریختن (عصر ۱ و ۲)', 'یک کارت برای عصر بعد', '§۲۲']
];

function actionsTable(l) {
  return `<section class="bdr-frame" dir="rtl"><h2><span class="bdr-no">31</span>${l.t('اقدام‌ها، هزینه‌ها و کدهای خطا', 'Actions, costs and error codes')}</h2><p>${l.t('از کتاب قوانین CMON (ص ۱۳ تا ۱۹) و متن کارت‌ها؛ چون موتور در ریپو نیست، این جدول قرارداد UI و موتور است (ENGINE.md §۵). دکمهٔ هر اقدام هزینه‌اش را از فیلد <code>cost</code> در <code>legalActions</code> نشان می‌دهد و اگر غیرمجاز است، دلیلش را از <code>reason</code>.', 'From the CMON rulebook and card texts.')}</p>
 <table class="bdr-table"><thead><tr><th>${l.t('اقدام', 'Action')}</th><th>${l.t('هزینه', 'Cost')}</th><th>${l.t('شرط و اثر', 'Condition and effect')}</th><th>${l.t('هدف روی میز', 'Targets')}</th><th>${l.t('کد خطا', 'Errors')}</th></tr></thead><tbody>${ACTIONS.map(([k, cost, cond, tgt, err]) => `<tr><td><b>${k === 'clan' ? l.t('کارت قبیله', 'Clan card') : l.act(k)}</b><br><code>${k}</code></td><td>${cost}</td><td>${cond}</td><td>${tgt}</td><td><code>${err.replace(/ · /g, '</code> <code>')}</code></td></tr>`).join('')}</tbody></table>
 <p class="bdr-note">${l.t('<b>خشم صفر</b>: هیچ اقدامی، حتی رایگان؛ ولی فراخوان نبرد و کارت نبرد ممکن است. <b>پایان فاز اقدام</b>: خشم همه صفر یا همهٔ استان‌های سالم غارت‌شده. <b>یورش سردار</b> رایگان است.', '')}</p></section>`;
}
function pendingTable(l) {
  return `<section class="bdr-frame" dir="rtl"><h2><span class="bdr-no">32</span>${l.t('تصمیم‌های بیرون از نوبت (pending)', 'Decisions outside the normal turn (pending)')}</h2><p>${l.t('موتور در <code>state.pending</code> می‌گوید منتظر چه کسی و چه تصمیمی است؛ <code>pendingSeats</code> همین صندلی‌ها را برمی‌گرداند و UI نوار وضعیت را از آن می‌سازد («منتظر آرش: فراخوان نبرد»).', '')}</p>
 <table class="bdr-table"><thead><tr><th>${l.t('نوع', 'Kind')}</th><th>${l.t('چه کسی', 'Who')}</th><th>${l.t('کِی', 'When')}</th><th>${l.t('گزینه‌ها', 'Options')}</th><th>${l.t('طرح', 'Design')}</th></tr></thead><tbody>${PENDING.map(([k, who, when, opt, ds]) => `<tr><td><code>${k}</code></td><td>${who}</td><td>${when}</td><td>${opt}</td><td>${ds}</td></tr>`).join('')}</tbody></table></section>`;
}
function api(l) {
  return `<section class="bdr-frame" dir="rtl"><h2><span class="bdr-no">33</span>${l.t('قرارداد موتور در یک نگاه', 'Engine contract at a glance')}</h2><p>${l.t('متن کامل، نوع‌ها و نمونهٔ وضعیت در ENGINE.md و data/mock-state.json. ساختار مثل بقیهٔ بازی‌های <code>games/</code>: <code>definition.ts</code>، <code>rules.ts</code> (GameModule)، <code>types.ts</code>، <code>content/</code>، <code>renderer.tsx</code>، <code>renderer.css</code>.', '')}</p>
 <div class="bdr-api"><pre>// state (server, hidden parts included)
BloodRageState {
  players, clans[seat], age 1..3,
  phase: 'draft'|'action'|'discard'|'quest'
       |'ragnarok'|'valhalla'|'ended',
  first, turn, ragnarok[3], destroyed[],
  pillage{prov: {reward, pillaged}},
  figures[{id, seat, kind, monster?, where}],
  rage[], stats[{rage,axe,horn}], glory[],
  hands[][], quests[][], upgrades[],
  draft?, battle?, pending?, decks[3],
  discardPublic[], log[], outcome
}</pre><pre>// legalActions(state, viewer) -> ActionHint[]
{ type:'invade', figure:'f12', slot:9,
  cost:{rage:2}, effects:[{kind:'destroy',
  figures:['f31']}] }
{ type:'march', from:0, to:3,
  figures:['f0'], cost:{rage:1} }
{ type:'upgrade', card:61, slot:'monster',
  index:1, cost:{rage:1}, replaces:null }
{ type:'pillage', province:3, cost:{rage:0} }
{ type:'invade', disabled:true,
  reason:'HORNS_FULL' }</pre><pre>// publicSummary(state) (DS contract)
seats[k] = {
  primary:{label:'افتخار', value:glory},
  stats:[ {key:'rage', value:rage[k]},
          {key:'cards', value:hand count},
          {key:'map', value:'4/5'},
          {key:'quests', value:count} ],
  badges:[first player, out of rage],
  status:'playing'|'passed'|'done'
}
shared: age, phase, doom province</pre></div></section>`;
}

function components(l) {
  const s = M;
  const art = (names, dark) => `<div class="bdr-comp__art${dark ? ' is-dark' : ''}">${names.map((n) => IMG(n, 'alt=""')).join('')}</div>`;
  const c = (no, title, body, desc) => `<div class="bdr-comp"><h4><span class="bdr-no">${no}</span>${title}</h4>${body}<p>${desc}</p></div>`;
  const mine = s.figures.find((f) => f.seat === ME && f.kind === 'warrior');
  const list = [
    c(0, 'رنگ قبیله‌ها', `<div class="bdr-comp__art">${C.clans.map((k) => `<span class="bdr-swatch"><i style="background:${k.color}"></i>${k.nameFa} <code>${k.color}</code></span>`).join('')}</div>`, 'از دادهٔ BGA؛ متن روی سطح روشن با نسخهٔ <code>-ink</code>.'),
    c(1, 'نوار بازی (DS)', '<div class="bdr-comp__art"><span class="bdr-pill">bgv-gamebar</span><span class="bdr-pill">فا / EN</span></div>', 'همان نوار بالای همهٔ میزها؛ دکمهٔ زبان و قوانین.'),
    c(2, 'نوار وضعیت و اقدام', '<div class="bdr-comp__art"><span class="bdr-pill">bdr-bar</span><span class="bdr-pill">sticky</span></div>', 'متن نوبت، اقدام‌ها، قدم‌ها، هدف‌ها، خلاصه و ثبت.'),
    c(3, 'دکمه‌های اقدام', art(['icon-rage-mini']), 'برچسب‌های BGA: بازی مأموریت/ارتقا/هیولا (فقط با چنین کارتی)، یورش، لشکرکشی، غارت، کنار کشیدن؛ هزینه در «یورش با».'),
    c(4, 'هدف‌ها و خط اثر', art(['spot-target', 'hover-invade']), 'هدف‌ها فقط روی نقشه و صفحهٔ قبیله (BGA)؛ زیر نوار یک خط هزینه و اثر.'),
    c(5, 'جعبهٔ نقشه', art(['blood-rage-logo']), 'لوگو چپ بالا؛ نشان عصر و فلش بخش‌ها راست بالا؛ آخرین نبرد وسط؛ بزرگ‌نمایی چپ؛ بایگانی، دورریخته، والهالا چپ پایین.'),
    c(6, 'نقشه (۱۶۰۰)', `<div class="bdr-comp__art is-dark">${IMG('main-board', 'alt="" style="max-block-size:120px"')}</div>`, 'همهٔ جاها درصدی از ۱۶۰۰ واحد؛ layout.json.'),
    c(7, 'نشان غارت', art(['icon-yggdrasil', 'icon-rage', 'icon-axe', 'icon-horn', 'icon-glory']), 'وسط استان؛ پس از غارت پلاک تیرهٔ «غارت موفق توسط …» (BGA).'),
    c(8, 'استان نابودشده', art(['ragnarok'], true), 'قرص راگناروک روی مرکز استان (۱۰٫۶٪).'),
    c(9, 'نشان نابودی', art(['icon-destiny'], true), 'روی جای doom استانِ راگناروکِ این عصر.'),
    c(10, 'مهرهٔ روی نقشه', art([figArt(s, mine), `${slug(ME)}-leader-token`, `${slug(ME)}-ship-token`, `${slug(ME)}-card-026-troll-token`], true), 'توکن BGA با قدرت و نشان قبیله؛ ارتقا ← توکن ارتقایافته.'),
    c(11, 'جای مهره‌ها', art(['spot-target'], true), 'روستا = یک مهره؛ ایگدراسیل حلقه دور مرکز؛ کشتی‌ها ردیفی روی آبدره.'),
    c(12, 'هدف، شبح و پیش‌نمایش اثر', art(['spot-target', 'remove', 'hover-invade'], true), 'حلقهٔ کهربایی؛ شبح مهرهٔ در حال یورش؛ قرمز = نابود می‌شود.'),
    c(13, 'کارت دست', art([CARD[44].art]), 'تصویر انگلیسی BGA بدون زیرنویس؛ نام و متن فارسی در راهنما.'),
    c(14, 'راهنمای کارت', art([CARD[64].art]), 'hover / نگه‌داشتن: نام و متن فارسی و انگلیسی.'),
    c(15, 'صفحهٔ قبیله', art([`${slug(ME)}-icon-reference`, `${slug(ME)}-leader-reference`, 'slot-monster', 'slot-clan']), '۹ جایگاه BGA در ۵ ستون، همیشه چپ‌به‌راست؛ «ذخیره» و «مأموریت‌ها».'),
    c(16, 'پنجرهٔ ذخیره', art([figArt(s, mine), `${slug(ME)}-card-026-troll-token`]), 'همهٔ توکن‌های ذخیره در شبکه (BGA)؛ والهالا پنجرهٔ خودش.'),
    c(17, 'نشان عصر و مسیر عصرها', art(['icon-destiny', 'ragnarok']), 'نشان «عصر ۲» روی نقشه پنجرهٔ سه عصر و فازها را باز می‌کند.'),
    c(18, 'پنل بازیکن', art(['icon-clan-3', 'icon-rage', 'board-card', 'firstplayer']), 'BGA: نام، افتخار ★، نشان قبیله، خشم، کارت دست، بازیکن اول، سه ویژگی x/حداکثر، جزئیات آمار.'),
    c(19, 'گزارش', '<div class="bdr-comp__art"><span class="bdr-pill">bgv-log</span></div>', 'هر خط با رنگ قبیله؛ کارت‌ها با نام فارسی.'),
    c(20, 'هدایای خدایان', art([`age-2-back`]), 'دستهٔ رسیده، نگه‌داشته‌ها، منتظر بقیه.'),
    c(21, 'نبرد', art(['battle']), 'فراخوان، کارت پنهان، آشکار و نتیجه.'),
    c(22, 'پایان عصر', art(['ragnarok']), 'دور ریختن، مأموریت، راگناروک، والهالا.'),
    c(23, 'پایان بازی', art(['icon-glory']), 'امتیاز افسانه‌ای +۱۰/+۲۰ و رتبه.'),
    c(24, 'پنجره‌ها', art(['clan-statistics']), 'آمار قبیله، والهالا، مأموریت‌ها، راهنما.'),
    c('۲۵–۳۰', 'گوشی', '<div class="bdr-comp__art"><span class="bdr-pill">HUD</span><span class="bdr-pill">زبانه‌ها</span><span class="bdr-pill">داک</span><span class="bdr-pill">شیت</span></div>', 'یورش، اقدام‌ها، درفت، نبرد، قبیله، پایان عصر.')
  ];
  return `<section class="bdr-frame" dir="rtl"><h2><span class="bdr-no">34</span>${l.t('همهٔ کامپوننت‌ها با شمارهٔ COMPONENTS.md', 'Every component with its COMPONENTS.md number')}</h2><div class="bdr-comps">${list.join('')}</div></section>`;
}

const spec = (l) => `<div class="bdr-spec" dir="rtl"><div class="bdr-spec__two">${actionsTable(l)}${pendingTable(l)}</div>${api(l)}${components(l)}</div>`;
module.exports = { CSS, WIDTH: 2580, HEIGHT: 3300, spec };
