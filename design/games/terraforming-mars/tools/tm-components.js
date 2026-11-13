// TM-Components artboard: every component of COMPONENTS.md on one sheet, with its number, art file, size and states.
const { M, CROP, SEATS, IMG, ICONS, CORP_FILE } = require('./tm-lib');
const P = require('./tm-parts');
const MB = require('./tm-mobile');

const CSS = `
.tmc{padding:32px 40px;display:grid;gap:26px;background:var(--surface-sunken);color:var(--text);font-size:14px;line-height:1.7}
.tmc h1{margin:0;font-size:28px;font-weight:900;color:var(--heading)}
.tmc>p{margin:0}
.tmc-sec{display:grid;gap:14px;padding:18px 20px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line)}
.tmc-sec>h2{margin:0;font-size:19px;font-weight:900;color:var(--heading)}
.tmc-row{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.tmc-item{display:grid;gap:8px;justify-items:start;align-content:start}
.tmc-cap{font-size:12.5px;line-height:1.6;color:var(--text-muted);max-inline-size:300px}
.tmc-cap b{color:var(--heading);font-weight:900}
.tmc-cap code,.tmc-sec code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:0 4px;border-radius:4px;background:var(--surface-sunken);color:var(--heading);direction:ltr;unicode-bidi:isolate}
.tmc-felt{padding:14px;border-radius:var(--radius-md)}
.tmc-sw{display:grid;gap:4px;justify-items:center;font-size:11.5px;color:var(--text-muted)}
.tmc-sw i{display:block;inline-size:54px;block-size:34px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
.tmc-mini{position:relative;inline-size:210px}
.tmc-mini .tm-board{border-radius:8px}
.tmc-ph{inline-size:358px;display:grid;gap:8px}
.tmc-ph .bgv-actiondock{position:static}
.tmc-ph .bgv-sheet{position:static;max-block-size:none}
.tmc-chip{display:inline-flex;align-items:center;gap:6px;block-size:44px;padding-inline:12px}
.tmc .tm-rail{position:static;grid-column:auto;grid-row:auto;max-block-size:none;inline-size:360px}
.tmc .tm-bar{position:static}
.tmc-stepper{display:inline-flex;align-items:center;gap:10px;font-size:18px;font-weight:900;color:var(--heading)}
`;

const cap = (num, title, text) => `<span class="tmc-cap"><b>${num} ${title}</b><br>${text}</span>`;
const item = (inner, c) => `<div class="tmc-item">${inner}${c}</div>`;
const sec = (title, body) => `<section class="tmc-sec"><h2>${title}</h2>${body}</section>`;
const seat = (k) => `--seat-c:var(--tm-${SEATS[k].color})`;

function components(l) {
  const S = M.state;
  // §0 tokens
  const sw = [['#E8A642', '--pick'], ['#E5483F', '--tm-red'], ['#3F8FE5', '--tm-blue'], ['#4FBF5A', '--tm-green'], ['#F0C419', '--tm-yellow'], ['#2B2B2B', '--tm-black'], ['#6B3A1C', '--tm-prod'], ['linear-gradient(180deg,#F6ECDD,#E4CDAE)', 'خاک مریخ'], ['#5E6A72', 'ستاد'], ['#3E8E3A', 'خودکار'], ['#2F6FB0', 'اثر/کنش'], ['#B23A31', 'رویداد']]
    .map(([c, n]) => `<span class="tmc-sw"><i style="background:${c}"></i>${n}</span>`).join('');
  // §2 rail
  const rail = `<div class="tm-rail" dir="rtl">${P.dashboard(l)}${P.panel(l, 0)}</div>`;
  // §3 board pieces
  const tiles = ['tile-greenery', 'tile-city', 'tile-ocean', 'tile-mining-area'].map((t) => IMG(t, 'alt="" style="inline-size:60px"')).join('');
  const cubes = ['red', 'blue', 'green', 'yellow', 'black', 'white'].map((c) => IMG('cube-' + c, 'alt="" style="inline-size:24px"')).join('');
  const board = P.board(l, { plates: true, picks: ['40', '46', '48'], picked: '40', bonus: true }).replace('<div class="tm-board"', '<div class="tm-board" style="inline-size:620px"');
  // §4 hand states
  const h = M.hand;
  const hand = [
    [P.handCard(l, h.find((x) => !x.error)), cap('4.1', 'قابل بازی', 'خط‌چین <code>--pick</code>؛ کلیک = شروع «بازی کارت»')],
    [P.handCard(l, h.find((x) => !x.error && x.id !== h.find((y) => !y.error).id), { pick: 'picked' }), cap('4.1', 'انتخاب‌شده', 'خط پر ۳px + تیک؛ داک پرداخت باز است')],
    [P.handCard(l, h.find((x) => x.error)), cap('4.1', 'غیرقابل بازی', 'مثل BGA کم‌رنگ نمی‌شود و هزینه زیرش نیست؛ <code>aria-disabled</code>، دلیل در <code>title</code> و زوم')],
    [`<div class="tm-hcard" style="--cw:200px"><div class="tm-card">${IMG('card-016', 'alt=""')}</div></div>`, cap('10.2', 'زوم کارت', 'هاور ۳۰۰ms یا فوکوس؛ تصویر ۳۲۰px بومی؛ Esc می‌بندد؛ گوشی: لمس طولانی، داک')]
  ].map(([a, b]) => item(`<div class="bgv-felt tmc-felt" style="--cw:134px">${a}</div>`, b)).join('');
  // §5 area
  const area = P.playerArea(l, 0);
  const closed = P.sections(l, 0, 150, { collapsed: ['hq', 'automated', 'effects', 'actions', 'events'] });
  // §6 action bar states
  const barIdle = P.actionBar(l);
  const barFlow = `<section class="tm-bar" data-tm-actbar=""><div class="tm-bar__row"><span class="tm-steps"><span class="tm-step is-done">${ICONS.check}${l.t('کارت', 'Card')}</span><span class="tm-step is-cur">${l.t('پرداخت', 'Payment')}</span><span class="tm-step">${l.t('تأیید', 'Confirm')}</span></span><span class="tm-bar__text">${l.t('بازی', 'Play')} <b>${l.card('016')}</b> <span class="tm-costpill">۲۴${P.icon('mc')}</span>: ${P.icon('steel')} <b>۲</b> (۴) + ${P.icon('mc')} <b>۲۰</b></span>${P.clock(l)}</div><div class="tm-bar__row"><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">− ${P.icon('steel')}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" disabled="">+ ${P.icon('steel')}</button><span class="bgv-spacer"></span><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="pay">${ICONS.check}${l.t('تأیید', 'Confirm')}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button">${ICONS.undo}${l.t('برگرد', 'Back')}</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">${l.t('لغو کنش', 'Cancel action')}</button></div></section>`;
  const barWait = `<section class="tm-bar is-waiting" data-tm-actbar=""><div class="tm-bar__row"><span class="tm-bar__text"><b>${l.t('نوبت سارا', 'Sara\'s turn')}</b>${l.t(': منتظر بمانید. کارت‌ها و صفحه‌ها دیدنی و بزرگ‌نمایی‌پذیرند.', ': please wait. Cards and boards can still be viewed and zoomed.')}</span>${P.clock(l)}</div></section>`;
  // §8 prompts
  const dock = (kind, prompt, body) => `<section class="bgv-actiondock" data-tm-pending="${kind}"><div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span>${prompt}</span>${body}</span></div>${MB.dockBtns(l, { back: false, cancel: false })}</section>`;
  const prompts = [
    ['8.2 player', dock('player', l.t('<b>کاهش ۱ تولید گیاه</b> یک بازیکن', '<b>Reduce 1 plant production</b> of a player'), `<div class="tmc-row" style="gap:6px">${[1, 2, 3].map((k) => `<button class="bgv-btn bgv-btn--secondary tmc-chip" type="button"${k === 1 ? ' aria-pressed="true"' : ''}><i class="bgv-seat" style="${seat(k)}"></i>${l.name(k)} ${P.icon('plant')}<b>${l.d(S.players[k].prod.plants)}</b></button>`).join('')}</div>`)],
    ['8.4 choice', dock('choice', `<b>${l.card('033')}</b>`, `<div class="tm-choice"><button class="bgv-btn bgv-btn--secondary" type="button" aria-pressed="false">${l.t('۱ میکروب به این کارت', 'Add 1 microbe')}</button><button class="bgv-btn bgv-btn--secondary" type="button" aria-pressed="true">${l.t('۲ میکروب بردارید: اکسیژن ۱ پله', 'Remove 2 microbes: +1 oxygen')}</button></div>`)],
    ['8.6 amount', dock('amount', l.t('<b>چند گرما خرج شود؟</b> (۰ تا ۹)', '<b>How much heat?</b> (0 to 9)'), `<span class="tmc-stepper"><button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="−">${ICONS.minus}</button>${P.icon('heat')} ۴<button class="bgv-btn bgv-btn--icon bgv-btn--secondary" type="button" aria-label="+">${ICONS.plus}</button></span>`)],
    ['8.5 cards', dock('cards', l.t('<b>تا ۲ کارت نگه دارید</b> (کسب‌وکار تماس‌ها)', '<b>Keep up to 2 cards</b> (Business Contacts)'), `<div class="tmc-row" style="gap:6px;--cw:70px">${['146', '159', '184', '203'].map((id, i) => `<button class="tm-card" type="button" data-pick="${i < 2 ? 'picked' : 'selectable'}">${IMG('card-' + id, 'alt=""')}</button>`).join('')}</div>`)]
  ].map(([n, d]) => item(`<div class="tmc-ph">${d}</div>`, cap(n.split(' ')[0], n.split(' ')[1], `<code>prompt.kind = ${n.split(' ')[1]}</code>؛ متن از <code>labelFa</code> موتور`))).join('');
  // §9 phone pieces
  const phone = [
    [`<div class="tmc-ph">${MB.tabs(l, 'mars')}</div>`, cap('9.3', 'سربرگ‌ها', 'مریخ، دست، بازیکنان؛ در مرحلهٔ هم‌زمان سربرگ دوم «انتخاب آغازین/درفت/پژوهش»')],
    [`<div class="tmc-ph"><section class="bgv-actiondock"><div class="bgv-actiondock__prompt"><span class="tm-dockprompt"><span><b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': کنش ۱ از ۲', ': action 1 of 2')}</span></span></div><div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button">${l.t('کنش‌ها', 'Actions')}</button><button class="bgv-btn bgv-btn--ghost" type="button">${l.t('پاس', 'Pass')}</button></div></section></div>`, cap('9.7', 'نوار جمع‌شده', 'همیشه پایین؛ «کنش‌ها» شیت ۹.۸ را باز می‌کند')]
  ].map(([a, b]) => item(a, b)).join('');

  return `<div class="tmc" dir="rtl">
<h1>${l.t('ترافورمینگ مارس: همهٔ کامپوننت‌ها', 'Terraforming Mars: all components')}</h1>
<p>${l.t('هر قطعه با شمارهٔ بندش در <code>COMPONENTS.md</code>، فایل هنر، اندازه و حالت‌هایش. هنر فقط از <code>art/</code>؛ هیچ قطعه‌ای با CSS ساخته نمی‌شود. همهٔ کلاس‌ها <code>tm-*</code> و همهٔ رنگ‌ها زیر <code>.tm</code>: هیچ فایل دیزاین سیستم عوض نمی‌شود.', 'Every piece with its COMPONENTS.md number, art file, size and states.')}</p>
${sec('§۰ توکن‌های بازی (فقط داخل <code>.tm</code>، در <code>renderer.css</code>)', `<div class="tmc-row">${sw}</div>`)}
${sec('§۲ ریل: داشبورد پارامترها و پنل بازیکن (ریل ۳۶۰px)', `<div class="tmc-row">${item(rail, cap('2.0 تا 2.4', 'داشبورد و پنل', 'داشبورد: زوم، راهنما، تنظیمات، اکسیژن، دما، اقیانوس، نسل. پنل: نام به رنگ بازیکن، امتیاز کل (دایرهٔ قهوه‌ای)، نفر اول، TR، کارت در دست، لوگوی شرکت (<code>markers/corp-logos</code>)، ۶ منبع ۴۴px با عدد روی پلاک تیره و تولید قهوه‌ای زیرش، ۱۱ نشان + شهر و فضای سبز ۴۰px (<code>markers/tags</code>)'))}${item(`<div class="tm-rail" dir="rtl">${P.panel(l, 2)}</div>`, cap('2.1', 'پاس داده', 'وضعیت «پاس داده» زیر نام؛ کارت پنل همان، بدون حالت نوبت'))}${item(`<div class="tm-rail" dir="rtl">${P.panel(l, 3)}</div>`, cap('2.1', 'نفر اول این نسل', 'نشانگر نفر اول (<code>markers/first-player-marker</code>) کنار امتیاز؛ نشان‌های صفر کم‌رنگ'))}</div>`)}
${sec('§۳ صفحهٔ تارسیس (پنجره ۹۲۰×۷۷۴، بدون قاب رتبه)', `<div class="tmc-row">${item(`<div class="bgv-felt tmc-felt">${board}</div>`, cap('3.1 تا 3.12', 'صفحه با انتخاب خانه', 'کاشی‌ها و مکعب صاحب، اکسیژن و دما با مکعب سفید، پلاک‌ها، دکمه‌های پروژه، پلاک «دسته/دورریز» و «نسل»؛ تصمیم <code>space</code>: خط‌چین، انتخاب‌شده پر + تیک، برچسب پاداش'))}${item(`<div class="bgv-felt tmc-felt"><div class="tmc-row" style="gap:6px">${tiles}</div></div>`, cap('3.3', 'کاشی‌ها', '<code>art/tiles/*</code>، عرض ۷٫۳۵٪ پنجره؛ ویژه با <code>specialTiles[card]</code>'))}${item(`<div class="bgv-felt tmc-felt"><div class="tmc-row" style="gap:8px">${cubes}</div></div>`, cap('3.4، 3.7، 3.10', 'مکعب‌ها', 'صاحب ۲٪، اکسیژن/دما ۲٫۹٪، پلاک ۲٫۵۶٪؛ رنگ صندلی؛ سفید برای اکسیژن و دما'))}</div>`)}
${sec('§۴ دست و ناحیه‌های انتخاب', `<div class="tmc-row">${hand}</div>`)}
${sec('§۵ محوطهٔ بازیکن (بدون صفحهٔ بازیکن)', `<div class="tmc-row">${item(`<div class="bgv-felt tmc-felt" style="inline-size:1040px">${area}</div>`, cap('5.1 تا 5.8', 'سر «خاک مریخ» و بخش‌ها', 'سر: نام، لوگو، امتیاز، TR، دست، هر منبع با جعبهٔ سفید و نوار تولید، نشان‌ها. بخش‌ها: ستاد (شبکه)، خودکار، اثرها، کنش‌ها، رویدادها (دسته)؛ منبع روی کارت، مکعب کنش استفاده‌شده، حلقهٔ کنش در دسترس'))}${item(`<div class="bgv-felt tmc-felt" style="inline-size:1040px">${closed}</div>`, cap('5.3', 'همهٔ بخش‌ها بسته', 'زدن سر بخش باز/بسته می‌کند (<code>aria-expanded</code>)؛ ≡ شبکه ↔ دسته؛ هر دو تنظیم محلی'))}</div>`)}
${sec('§۶ و §۷ نوار کنش و پرداخت', `<div class="tmc-row" style="display:grid;gap:12px">${item(barIdle, cap('6.1 تا 6.11', 'بیکار، نوبت شما', 'دکمه‌ها از <code>legalActions</code>، هزینه در قرص، دلیل غیرفعال در <code>title</code>'))}${item(barFlow, cap('6.9، 7', 'جریان و پرداخت', 'مراحل، پیش‌فرض <code>autoPay</code>، −/+ فولاد/تیتانیوم/گرما؛ «تأیید» فقط وقتی کامل است؛ «برگرد» فقط پیش از تأیید'))}${item(barWait, cap('6.1', 'خارج از نوبت', '<code>is-waiting</code>؛ هیچ کنشی زدنی نیست'))}</div>`)}
${sec('§۸ تصمیم‌های میانی (داک گوشی؛ روی دسکتاپ همین محتوا در نوار)', `<div class="tmc-row">${prompts}</div>`)}
${sec('§۹ قطعه‌های گوشی', `<div class="tmc-row">${phone}</div>`)}
</div>`;
}
module.exports = { CSS, components };
