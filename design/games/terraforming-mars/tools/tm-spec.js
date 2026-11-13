// Desktop setup/research screens and the two spec artboards (actions from rules.ts/core.ts, measured board geometry).
const { M, BW, BH, PW, PH, hex, trPos, oxyPos, tempPos, MILESTONE_XY, AWARD_XY, SP_Y, PROD, COUNT_XY, RES, SEATS, pct, at, IMG, ICONS } = require('./tm-lib');

const CSS = `
.tm-spec{padding:32px 40px;display:grid;gap:22px;background:var(--surface-sunken);color:var(--text);font-size:14px;line-height:1.75}
.tm-spec h1{margin:0;font-size:28px;font-weight:900;color:var(--heading)}
.tm-spec h2{margin:0 0 8px;font-size:18px;font-weight:900;color:var(--heading)}
.tm-spec p{margin:0}
.tm-spec .bgv-card{padding:18px 20px;display:grid;gap:10px}
.tm-spec table{inline-size:100%;border-collapse:collapse;font-size:13px;line-height:1.6}
.tm-spec th,.tm-spec td{padding:7px 8px;border-block-end:1px solid var(--line);text-align:start;vertical-align:top}
.tm-spec th{font-weight:700;color:var(--label);font-size:12.5px;background:var(--surface-sunken)}
.tm-spec code{font-family:ui-monospace,Consolas,monospace;font-size:12px;padding:1px 5px;border-radius:5px;background:var(--surface-sunken);color:var(--heading);direction:ltr;unicode-bidi:isolate}
.tm-spec ul{margin:0;padding-inline-start:20px;display:grid;gap:4px}
.tm-g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
.tm-g1{display:grid;gap:18px}
.tm-g1 .tm-measure{max-inline-size:1024px;justify-self:center}
.tm-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}
.tm-flow{display:grid;gap:8px;padding:12px;border-radius:var(--radius-md);background:var(--surface-sunken)}
.tm-flow b{color:var(--heading)}
.tm-mini{position:static}
.tm-measure{position:relative;inline-size:100%;border-radius:var(--radius-md);overflow:hidden}
.tm-measure>img{display:block;inline-size:100%;block-size:auto}
.tm-dot{position:absolute;transform:translate(-50%,-50%);min-inline-size:18px;block-size:18px;padding:0 3px;border-radius:9px;background:rgba(13,26,35,.85);color:#FFFFFF;font:700 10px/18px var(--font-latin);text-align:center;box-shadow:0 0 0 1px #FFFFFF;direction:ltr}
.tm-dot--s{min-inline-size:8px;block-size:8px;padding:0;border-radius:50%;background:#E8A642;box-shadow:0 0 0 1px #0D1A23}
.tm-box{position:absolute;transform:translate(-50%,-50%);border:2px dashed #E8A642;border-radius:6px}
.tm-box--crop{border:3px dashed #5AA9F0;border-radius:0}
.tm-legend{display:grid;gap:4px;font-size:13px}
.tm-pickzone{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start}
.tm-corppick{display:grid;gap:10px;--cw:250px}
.tm-sum{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--felt-ink);font-size:14px}
.tm-sum b{font-weight:900}
.tm-ready{display:flex;gap:6px;flex-wrap:wrap}
.tm-ready span{display:inline-flex;align-items:center;gap:5px;block-size:28px;padding-inline:9px;border-radius:var(--radius-pill);background:var(--felt-plate);color:var(--felt-ink);font-size:12.5px;font-weight:700}
.tm-ready span .bgv-icon{inline-size:14px;block-size:14px;color:var(--success)}
`;

const icon = (n) => IMG('i-' + n, 'class="tm-ic" alt=""');
const seatStyle = (k) => `--seat-c:var(--tm-${SEATS[k].color})`;
const ready = (l, list) => `<div class="tm-ready">${list.map(([k, r, fa, en]) => `<span><i class="bgv-seat" style="${seatStyle(k)}"></i>${l.name(k)} ${r ? ICONS.check : ''}${l.t(fa, en)}</span>`).join('')}</div>`;

function simpleRail(l, list) {
  return `<aside class="tm-rail" dir="${l.dir}" aria-label="${l.t('بازیکنان', 'Players')}">${list.map(([k, r]) => `<div class="bgv-pcard tm-panel"><div class="tm-panel__head"><span class="bgv-avatar bgv-avatar--sm${k === 0 ? ' is-you' : ''}" style="${seatStyle(k)}">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="tm-panel__id"><b><i class="bgv-seat" style="${seatStyle(k)}"></i>${l.name(k)}</b><small>${r ? l.t('آماده؛ انتخاب پنهان است', 'Ready; choice hidden') : l.t('در حال انتخاب', 'Choosing')}</small></div><span class="tm-tr"><b>${l.d(20)}</b></span></div>${r ? `<div class="tm-panel__foot"><span class="bgv-pstate bgv-pstate--done">${ICONS.check}${l.t('آماده', 'Ready')}</span></div>` : ''}</div>`).join('')}</aside>`;
}
function deskShell(l, P, main, railHtml) {
  return `<div class="bgv-tablescreen bgv-tablescreen--desk tm-desk" dir="ltr">
${P.gamebar(l)}
<div class="tm-main" dir="${l.dir}">
${main}
</div>
${railHtml}
</div>`;
}
const bar = (l, P, text, btns) => `<section class="tm-bar" aria-live="polite" data-tm-actbar=""><div class="tm-bar__row"><span class="tm-bar__text">${text}</span>${P.clock(l)}</div><div class="tm-bar__row">${btns}</div></section>`;

function setupDesktop(l, P) {
  const SETUP = require('./tm-mobile').SETUP;
  const corps = SETUP.corps.map((id) => `<button class="tm-card" type="button" data-pick="${id === SETUP.corp ? 'picked' : 'selectable'}" aria-pressed="${id === SETUP.corp}" style="--cw:250px" aria-label="${l.fa ? M.cards[id].nameFa : M.cards[id].name}">${IMG('corp-' + require('./tm-lib').CORP_FILE[id], 'alt=""')}${id === SETUP.corp ? `<span class="tm-check" aria-hidden="true">${ICONS.check}</span>` : ''}</button>`).join('');
  const cards = SETUP.offer.map((id) => P.handCard(l, { id, cost: 3, printed: 3, error: null }, { pick: SETUP.picked.includes(id) ? 'picked' : 'selectable', noCost: true })).join('');
  const main = `${bar(l, P, `<b>${l.t('نسل ۱', 'Generation 1')}</b>${l.t(': یک شرکت و هر تعداد از ۱۰ کارت را انتخاب کنید؛ هر کارت ۳ مگاکردیت از پول شرکت. انتخاب همه هم‌زمان و پنهان است.', ': choose a corporation and any of the 10 cards; each card costs 3 M€ from the corporation\'s money. Everyone chooses at once, in secret.')}`,
    `<span class="tm-costpill">${l.t('اکولاین + ۴ کارت = ۱۲ از ۳۶', 'Ecoline + 4 cards = 12 of 36')}${icon('mc')}</span><span class="bgv-spacer"></span><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="corp">${ICONS.check}${l.t('تأیید انتخاب', 'Confirm choice')}</button>`)}
<section class="bgv-felt tm-zone" aria-label="${l.t('انتخاب آغازین', 'Starting choice')}" data-tm-pending="corp">
 <div class="tm-zone__head"><h2>${l.t('انتخاب آغازین', 'Starting choice')}</h2><small>${l.t('شرکت ۱ از ۲ · کارت ۴ از ۱۰', 'corporation 1 of 2 · cards 4 of 10')}</small></div>
 <div class="tm-pickzone"><div class="tm-corppick">${corps}</div><div class="tm-hand" style="--cw:128px">${cards}</div></div>
 ${ready(l, [[1, true, 'آماده', 'ready'], [2, false, 'در حال انتخاب', 'choosing'], [3, false, 'در حال انتخاب', 'choosing']])}
</section>
<main class="bgv-felt tm-zone" aria-label="${l.t('صفحهٔ مریخ', 'Mars board')}">${P.board(l, { empty: true, plates: true })}</main>`;
  return deskShell(l, P, main, simpleRail(l, [[0, false], [1, true], [2, false], [3, false]]));
}
function researchDesktop(l, P) {
  const offer = [['146', true], ['159', true], ['184', false], ['203', false]];
  const cards = offer.map(([id, pick]) => P.handCard(l, { id, cost: 3, printed: 3, error: null }, { pick: pick ? 'picked' : 'selectable', noCost: true })).join('');
  const draft = ['148', '073', '025', '131'].map((id) => P.handCard(l, { id, cost: 0, printed: 0, error: null }, { pick: id === '073' ? 'picked' : 'selectable', noCost: true })).join('');
  const main = `${bar(l, P, `<b>${l.t('پژوهش نسل ۶', 'Research, generation 6')}</b>${l.t(': هر تعداد از ۴ کارت را بخرید، هر کدام ۳ مگاکردیت. بقیه دور ریخته می‌شود.', ': buy any of the 4 cards, 3 M€ each. The rest are discarded.')}`,
    `<span class="tm-costpill">${l.t('۲ کارت = ۶ از ۳۴', '2 cards = 6 of 34')}${icon('mc')}</span><span class="bgv-spacer"></span><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="research">${ICONS.check}${l.t('تأیید خرید', 'Confirm purchase')}</button>`)}
<section class="bgv-felt tm-zone" aria-label="${l.t('پژوهش', 'Research')}" data-tm-pending="research">
 <div class="tm-zone__head"><h2>${l.t('پژوهش', 'Research')}</h2><small>${l.t('بعد از «تأیید» عوض نمی‌شود؛ خریدها وقتی همه آماده شدند آشکار و پرداخت می‌شوند.', 'Cannot change after «Confirm»; purchases are revealed and paid when everyone is ready.')}</small></div>
 <div class="tm-hand" style="--cw:150px">${cards}</div>
 ${ready(l, [[3, true, 'آماده', 'ready'], [1, true, 'آماده', 'ready'], [2, false, 'در حال انتخاب', 'choosing']])}
</section>
<section class="bgv-felt tm-zone" aria-label="${l.t('درفت', 'Draft')}" data-tm-pending="draft">
 <div class="tm-zone__head"><h2>${l.t('اگر میزبان «درفت» را روشن کرده باشد، پیش از خرید:', 'If the host turned «Draft» on, before buying:')}</h2><small>${l.t('از هر بسته یکی را نگه دارید و «نگه دار» بزنید؛ بقیه به نفر بعدی (نسل زوج) یا قبلی (نسل فرد) می‌رسد. سه بار؛ کارت چهارم خودکار. سپس همین خرید.', 'Keep one card of each pack and press «Keep»; the rest go to the next player (even generations) or the previous one (odd). Three times; the fourth card is automatic. Then the purchase above.')}</small><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="draft">${l.t('نگه دار', 'Keep')}</button></div>
 <div class="tm-hand" style="--cw:118px">${draft}</div>
</section>
${P.handZone(l).replace(/data-pick="(selectable|dim)"/g, 'data-pick="none"').replace(/<span class="tm-why">[^<]*<\/span>/g, '').replace('دست شما</h2>', 'دست شما</h2><small>' + l.t('در پژوهش فقط دیدنی است', 'view only during research') + '</small>')}`;
  return deskShell(l, P, main, P.rail(l));
}

// ---------------- actions spec ----------------
function actionsSpec(l, P) {
  const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  const actions = [
    ['بازی کارت', 'دست (کارت با حلقه) یا «بازی کارت» در نوار', '<code>cost</code> در <code>legalActions</code> (بعد از تخفیف)؛ فولاد اگر <code>steel</code>، تیتانیوم اگر <code>titanium</code>؛ هلیون: گرما', 'کارت ← پرداخت ← تأیید ← تصمیم‌های کارت', '<code>play {card, pay}</code>', 'REQUIREMENTS_NOT_MET, CANNOT_AFFORD, PRODUCTION_TOO_LOW, NOT_ENOUGH_RESOURCES, NO_TARGET, CANNOT_PLAY, NO_SPACE'],
    ['کنش کارت آبی یا شرکت', 'روی کارت در تابلو (حلقهٔ کهربایی) یا «کنش کارت»', '<code>action.cost</code>، <code>payWith</code>', 'کارت ← (پرداخت) ← تأیید ← تصمیم', '<code>cardAction {card, pay}</code>', 'ACTION_USED, CANNOT_USE, CANNOT_AFFORD'],
    ['پروژهٔ استاندارد', 'پنل چاپ‌شده روی صفحهٔ مریخ یا نوار', '<code>projectCost</code> (تورگیت: نیروگاه ۸)', 'پروژه ← (فروش: انتخاب کارت‌ها) ← پرداخت ← تأیید ← جای کاشی', '<code>project {project, pay, cards}</code>', 'PARAMETER_MAXED, NO_SPACE, CANNOT_AFFORD, BAD_CARDS'],
    ['ثبت نقطهٔ عطف', 'پلاک روی صفحه یا نوار', '<code>MILESTONE_COST</code> = ۸', 'پلاک ← پرداخت ← تأیید', '<code>milestone {id, pay}</code>', 'MILESTONE_TAKEN, MILESTONE_NOT_REACHED, CANNOT_AFFORD'],
    ['تأمین جایزه', 'پلاک روی صفحه یا نوار', '<code>AWARD_COSTS[awards.length]</code> = ۸ / ۱۴ / ۲۰', 'پلاک ← پرداخت ← تأیید', '<code>award {id, pay}</code>', 'AWARD_TAKEN, CANNOT_AFFORD'],
    ['گیاه ← فضای سبز', 'جعبهٔ گیاه صفحهٔ بازیکن یا نوار', '<code>greeneryPlants</code> (۸؛ اکولاین ۷)', 'تأیید ← جای فضای سبز', '<code>convertPlants</code>', 'CANNOT_CONVERT'],
    ['گرما ← دما', 'جعبهٔ گرما یا نوار', '۸ گرما', 'تأیید', '<code>convertHeat</code>', 'CANNOT_CONVERT'],
    ['کنش اول شرکت', 'تنها دکمهٔ نوار در اولین نوبت', '—', 'تأیید', '<code>firstAction</code>', 'FIRST_ACTION_REQUIRED (برای هر کنش دیگر)'],
    ['پایان نوبت', 'نوار، فقط بعد از کنش اول', '—', 'یک زدن', '<code>endTurn</code>', 'NO_ACTION_TAKEN'],
    ['پاس', 'نوار', '—', 'تأیید (با پرسش «تا آخر نسل»)', '<code>pass</code>', '—'],
    ['انتخاب آغازین', 'ناحیهٔ دست', '۳ × کارت؛ شرکت تازه‌کار رایگان', 'شرکت + کارت‌ها ← تأیید', '<code>corp {corp, cards}</code>', 'ALREADY_CHOSEN, BAD_CARDS, CANNOT_AFFORD'],
    ['درفت', 'ناحیهٔ دست', '—', 'کارت ← نگه دار', '<code>draft {card}</code>', 'ALREADY_CHOSEN, BAD_CARDS'],
    ['پژوهش', 'ناحیهٔ دست', '۳ × کارت؛ سقف <code>max</code> در <code>legalActions</code>', 'کارت‌ها ← تأیید', '<code>research {cards}</code>', 'ALREADY_CHOSEN, BAD_CARDS, CANNOT_AFFORD'],
    ['پاسخ به تصمیم', 'داک/نوار + روی صفحه', '—', 'انتخاب ← تأیید', '<code>respond {space | seat | card | index | cards | amount | skip}</code>', 'BAD_SPACE, BAD_TARGET, BAD_CHOICE, BAD_CARDS, BAD_AMOUNT, NOT_OPTIONAL']
  ];
  const prompts = [
    ['<code>space</code>', 'گذاشتن کاشی (اقیانوس، فضای سبز، شهر، ویژه) یا نشانهٔ ادعا', 'خانه‌های <code>options</code> روی صفحهٔ مریخ با خط‌چین کهربایی و پاداش چاپ‌شده؛ گوشی خودکار روی آن‌ها زوم می‌کند'],
    ['<code>player</code>', 'برداشتن منبع یا کاهش تولید یک بازیکن', 'دکمهٔ هر بازیکن مجاز با رنگش و مقدارش؛ اگر <code>optional</code>، «هیچ‌کس»'],
    ['<code>card</code>', 'افزودن منبع به یکی از کارت‌های شما', 'همان کارت‌های تابلو انتخاب‌پذیر (کیت ۱)'],
    ['<code>choice</code>', 'یکی از چند اثر کارت', 'دکمه با متن <code>options</code> موتور (مثل «۲ میکروب بردارید: اکسیژن ۱ پله»)'],
    ['<code>cards</code>', 'انتخاب چند کارت از کارت‌های دیده‌شده', 'کارت‌ها در ناحیهٔ دست، چندانتخابی بین <code>min</code> و <code>max</code>'],
    ['<code>amount</code>', 'یک عدد (مثلاً چقدر گرما خرج شود)', 'شمارنده با − و + بین <code>min</code> و <code>max</code>']
  ];
  const codes = [['REQUIREMENTS_NOT_MET', 'شرط کارت برقرار نیست'], ['CANNOT_AFFORD', 'پول کافی ندارید (با فولاد/تیتانیوم/گرمای مجاز)'], ['NO_SPACE', 'جای مجاز روی نقشه نیست'], ['PRODUCTION_TOO_LOW', 'تولید برای این کاهش کافی نیست'], ['NOT_ENOUGH_RESOURCES', 'منبع لازم را ندارید'], ['NO_TARGET', 'هیچ بازیکنی این تولید را ندارد'], ['PARAMETER_MAXED', 'این پارامتر کامل شده'], ['ACTION_USED', 'این نسل استفاده شده'], ['MILESTONE_TAKEN', 'ثبت شده (نام صاحب)'], ['MILESTONE_NOT_REACHED', 'هنوز نرسیده‌اید (مقدار شما از نیاز)'], ['AWARD_TAKEN', 'تأمین شده (نام تأمین‌کننده)'], ['CANNOT_CONVERT', 'گیاه/گرمای کافی ندارید یا جای مجاز نیست'], ['NOT_YOUR_TURN', 'نوبت شما نیست'], ['FIRST_ACTION_REQUIRED', 'اول کنش شرکتتان']];
  return `<div class="tm-spec" dir="rtl">
<h1>ترافورمینگ مارس: نوار کنش و همهٔ جریان‌ها</h1>
<p>همه از <code>rules.ts</code> (<code>legalActions</code>، <code>validateAction</code>) و <code>core.ts</code> (<code>playError</code>، <code>projectCost</code>، <code>autoPay</code>، <code>legalSpaces</code>). رندرر قانون را تکرار نمی‌کند: دکمه‌ها از <code>legalActions</code>، دلیل غیرفعال از کد خطا، جای مجاز از <code>respond.options</code>.</p>
<div class="tm-g2">
 <section class="bgv-card"><h2>ساختار نوبت</h2><ul>
  <li>هر نسل: <b>پژوهش</b> (هم‌زمان؛ با «درفت» اگر میزبان روشن کند) ← <b>کنش‌ها</b> (به ترتیب نوبت، ۱ یا ۲ کنش، تا همه پاس دهند) ← <b>تولید</b> (خودکار، فقط در گزارش).</li>
  <li>نسل ۱: انتخاب شرکت و ۱۰ کارت هم‌زمان و پنهان؛ اگر شرکت کنش اول دارد (جمهوری تارسیس: شهر، اینونتریکس: ۳ کارت) نوار فقط همان را نشان می‌دهد.</li>
  <li>بعد از کنش اول: «پایان نوبت» یا کنش دوم. «پاس» یعنی بیرون تا آخر نسل.</li>
  <li>وقتی دما، اکسیژن و اقیانوس کامل شد: دور پایانی فضای سبز، فقط «گیاه ← فضای سبز» و «پاس».</li>
  <li><b>برگشت فقط پیش از «تأیید».</b> انتخاب کارت، پرداخت و انتخاب پلاک تا تأیید موقت‌اند و «برگرد» یکی‌یکی برمی‌گرداند. بعد از تأیید برگشت نیست. <b>تأیید خودکار نداریم.</b></li>
  <li>تصمیم‌هایی که بعد از تأیید از موتور می‌آیند (جای کاشی، هدف، انتخاب) برگشت ندارند، اما تا «تأیید» خودشان می‌شود گزینهٔ دیگری زد.</li>
 </ul></section>
 <section class="bgv-card"><h2>پرداخت (کیت ۳، داک چندمرحله‌ای)</h2><ul>
  <li>پیش‌فرض = <code>autoPay</code> موتور: تیتانیوم و فولاد بدون اضافه‌پرداخت، بعد مگاکردیت، بعد گرمای هلیون.</li>
  <li>کاربر فولاد/تیتانیوم/گرما را با − و + عوض می‌کند؛ مگاکردیت بقیه را پر می‌کند. ارزش هر واحد از <code>values()</code> (پیشرفته: فولاد ۳، تیتانیوم ۴).</li>
  <li>فولاد فقط برای نشان ساختمان، تیتانیوم فقط نشان فضا (<code>legalActions</code>: <code>steel</code>، <code>titanium</code>)؛ ردیف غیرمجاز کم‌رنگ با دلیل.</li>
  <li>اضافه‌پرداخت با فولاد/تیتانیوم پس داده نمی‌شود: دکمهٔ تأیید قرمز با متن «اضافه‌پرداخت ۱» مثل BGA. خطای سرور: <code>BAD_PAYMENT</code>.</li>
 </ul>
 <div class="tm-flow"><b>نمونه روی دسکتاپ (نوار، بعد از زدن «دهانهٔ گنبدی»):</b>
  <div class="tm-bar tm-mini"><div class="tm-bar__row"><span class="tm-steps"><span class="tm-step is-done">${ICONS.check}کارت</span><span class="tm-step is-cur">پرداخت</span><span class="tm-step">تأیید</span></span><span class="tm-bar__text">بازی <b>دهانهٔ گنبدی</b> <span class="tm-costpill">۲۴${icon('mc')}</span>: ${icon('steel')} <b>۲</b> (۴) + ${icon('mc')} <b>۲۰</b></span></div>
  <div class="tm-bar__row"><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">− ${icon('steel')}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" disabled="">+ ${icon('steel')}</button><span class="bgv-spacer"></span><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button">${ICONS.check}تأیید</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${ICONS.undo}برگرد</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">لغو کنش</button></div></div>
 </div></section>
</div>
<section class="bgv-card"><h2>همهٔ کنش‌ها</h2><table><thead><tr><th>کنش</th><th>کجا</th><th>هزینه از</th><th>مراحل</th><th>حرکت</th><th>خطاهای ممکن (دلیل غیرفعال)</th></tr></thead><tbody>${actions.map(row).join('')}</tbody></table></section>
<div class="tm-g2">
 <section class="bgv-card"><h2>تصمیم‌های میانی (<code>prompt.kind</code>)</h2><p>جملهٔ نوار = <code>labelFa</code> موتور. اگر <code>optional</code>، دکمهٔ «رد کردن» (<code>skip</code>). تصمیم بازیکن دیگر: نوار خاکستری «سارا در حال تصمیم» (<code>promptSeat</code>).</p><table><thead><tr><th>نوع</th><th>کی</th><th>نمایش</th></tr></thead><tbody>${prompts.map(row).join('')}</tbody></table></section>
 <section class="bgv-card"><h2>دلیل غیرفعال (کد ← متن)</h2><table><thead><tr><th>کد موتور</th><th>متن زیر دکمه/کارت</th></tr></thead><tbody>${codes.map(([c, t]) => row([`<code>${c}</code>`, t])).join('')}</tbody></table></section>
</div>
<div class="tm-g3">
 <section class="bgv-card"><h2>خارج از نوبت</h2><p>نوار خاکستری «نوبت سارا» با ساعت او. دست، تابلو و صفحه‌ها دیدنی و بزرگ‌نمایی‌پذیرند ولی هیچ کنشی زدنی نیست.</p></section>
 <section class="bgv-card"><h2>مرحله‌های هم‌زمان</h2><p>انتخاب آغازین، درفت و پژوهش: کنار هر بازیکن «آماده» یا «در حال انتخاب» (<code>ready</code> در view). انتخاب شما تا «تأیید» با «برگرد» عوض می‌شود؛ بعد از آن <code>ALREADY_CHOSEN</code>.</p></section>
 <section class="bgv-card"><h2>پایان زمان</h2><p>متن قانون از <code>timeoutPolicyFa</code>: در کنش‌ها تصمیم‌های باز با اولین گزینه بسته می‌شوند و بازیکن پاس می‌دهد؛ در پژوهش کارتی خریده نمی‌شود.</p></section>
</div>
</div>`;
}

// ---------------- board measurement spec ----------------
function boardSpec(l, P) {
  let b = `<div class="tm-measure" dir="ltr">${IMG('board-tharsis', 'alt="" width="1024" height="870"')}`;
  for (const s of M.spaces) { const [x, y] = hex(s.id); b += `<span class="tm-dot" style="${at(x, y, BW, BH)}">${s.id}</span>`; }
  for (let v = 0; v <= 100; v += 1) { const [x, y] = trPos(v); b += v % 5 ? `<span class="tm-dot tm-dot--s" style="${at(x, y, BW, BH)}"></span>` : `<span class="tm-dot" style="${at(x, y, BW, BH)}">${v}</span>`; }
  for (let v = 0; v <= 14; v++) { const [x, y] = oxyPos(v); b += `<span class="tm-dot tm-dot--s" style="${at(x, y, BW, BH)}"></span>`; }
  for (let t = -30; t <= 8; t += 2) { const [x, y] = tempPos(t); b += `<span class="tm-dot tm-dot--s" style="${at(x, y, BW, BH)}"></span>`; }
  MILESTONE_XY.forEach(([x, y]) => { b += `<span class="tm-box" style="${at(x, y + 8, BW, BH)};inline-size:8.2%;block-size:6.2%"></span>`; });
  AWARD_XY.forEach(([x, y]) => { b += `<span class="tm-box" style="${at(x, y + 10, BW, BH)};inline-size:8.2%;block-size:6.2%"></span>`; });
  SP_Y.forEach((y) => { b += `<span class="tm-box" style="${at(148, y, BW, BH)};inline-size:14.3%;block-size:3.5%"></span>`; });
  b += `<span class="tm-box tm-box--crop" style="${at(512, 435, BW, BH)};inline-size:89.84%;block-size:88.97%"></span>`;
  b += '</div>';
  let p = `<div class="tm-measure" dir="ltr">${IMG('player-board', 'alt="" width="889" height="653"')}`;
  for (const r of RES) {
    const vals = r === 'mc' ? [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const v of vals) { const [x, y] = PROD[r](v); p += `<span class="tm-dot tm-dot--s" style="${at(x, y, PW, PH)}"></span>`; }
    const [cx, cy] = COUNT_XY[r]; p += `<span class="tm-dot" style="${at(cx, cy, PW, PH)}">${r}</span>`;
  }
  p += '</div>';
  return `<div class="tm-spec" dir="rtl">
<h1>ترافورمینگ مارس: اندازه‌گیری روی تصویرهای واقعی</h1>
<p>همهٔ عددها پیکسل تصویر منبع‌اند و در <code>layout.json</code> هستند. قطعه با <code>left = x/W</code>، <code>top = y/H</code>، <code>translate(-50%,-50%)</code> و عرض درصدی از عرض صفحه گذاشته می‌شود؛ پس در هر عرضی درست می‌نشیند.</p>
<div class="tm-g1">
 <section class="bgv-card"><h2>صفحهٔ تارسیس (۱۰۲۴×۸۷۰)</h2>${b}<div class="tm-legend">
  <span><b>کادر آبی = پنجرهٔ نمایش روی میز</b> (x ۵۲ تا ۹۷۲، y ۴۸ تا ۸۲۲): مثل BGA قاب مسیر رتبه نشان داده نمی‌شود؛ رتبه و امتیاز در پنل بازیکن و نسل در داشبورد ریل است. همهٔ مختصات پایین پیکسل تصویر کامل‌اند؛ روی میز <code>x−52</code> و <code>y−48</code> از ۹۲۰×۷۷۴.</span>
  <span>خانه‌ها (عدد = شناسهٔ <code>board.ts</code>): <code>x = 246 + 33.4·|row−4| + 66.8·col</code>، <code>y = 201 + 58·row</code>؛ شش‌ضلعی نوک‌بالا، شعاع ۳۸٫۶. گانیمد <code>01</code> (۱۵۵، ۳۶۰)، فوبوس <code>02</code> (۱۷۵، ۱۴۸).</span>
  <span>کاشی: عرض ۷٫۳۵٪ پنجره؛ مکعب صاحب وسط کاشی، ۲٪. نقطه‌های دور صفحه (مسیر رتبه) فقط برای سابقه است و روی میز استفاده نمی‌شود.</span>
  <span>اکسیژن: مرکز (۵۱۴، ۴۴۸)، شعاع ۳۴۰، زاویه <code>−42.7 + 6·v</code> درجه از عمود. دما: <code>x = 905</code>، <code>y = 612 − (t+28)/2·25</code>؛ ۳۰− روی حباب (۹۰۵، ۶۶۰).</span>
  <span>کادرهای خط‌چین = دکمه‌های پروژهٔ استاندارد (۱۴٫۳٪×۳٫۵٪) و پلاک نقطه‌های عطف و جایزه‌ها (۸٫۲٪×۶٫۲٪)؛ مکعب صاحب روی آیکون پلاک، ۲٫۳٪.</span>
 </div></section>
 <section class="bgv-card"><h2>صفحهٔ بازیکن (۸۸۹×۶۵۳)</h2>${p}<div class="tm-legend">
  <span>نقطه‌ها = خانه‌های مسیر تولید هر منبع (مگاکردیت ۵− تا ۱۰، بقیه ۰ تا ۱۰)؛ مکعب رنگ بازیکن، ۳٫۴٪ عرض صفحه.</span>
  <span>برچسب‌ها = جای عدد موجودی هر منبع (روی گوشهٔ آیکون جعبه).</span>
  <span>مگاکردیت: ۰ تا ۵ در (۱۶۴ + ۳۳٫۴·v، ۲۸۷)، ۶ تا ۱۰ در ردیف ۳۲۲، منفی‌ها در ردیف ۲۵۲. فولاد ۰ در (۴۰۲، ۲۵۶)، تیتانیوم ۰ در (۶۴۰، ۲۵۶)، ردیف دوم ۲۹۰. گیاه ۰ در (۹۲٫۵، ۳۹۱)، انرژی (۳۶۳٫۵، ۳۹۱)، گرما (۶۲۵، ۳۹۱)، ردیف دوم ۴۲۷٫۵. گام ۳۳ تا ۳۴.</span>
 </div></section>
</div>
</div>`;
}

module.exports = { CSS, setupDesktop, researchDesktop, actionsSpec, boardSpec };
