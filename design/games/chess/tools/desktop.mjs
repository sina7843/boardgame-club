// Desktop artboard: 12 full table frames 1440×900 + result-reason grid.
import { S } from './scenes.mjs';
import { ME, OPP, felt, desk, railStd, status, tourStrip, resultCard, chatCol, actionsRow, btn, ibtn, mlist, fa, ic, aic, pc, board, clock, gamebar } from './parts.mjs';

const cap = (n, title, sub, notes) => `<header class="cx-cap"><h2><span class="cx-tag">${fa(n)}</span>${title}${sub ? `<small>${sub}</small>` : ''}</h2>${notes ? `<ul>${notes.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</header>`;
const shot = (n, title, sub, notes, frame) => `<section class="cx-shot" id="d${n}">${cap(n, title, sub, notes)}${frame}</section>`;
const GB5 = { meta: ['بلیتس ۵ دقیقه', 'رتبه‌دار'] };

// ---------- §1 lobby + seeking ----------
const tile = (label, on, inc) => `<button class="cx-tile${inc ? ' cx-tile--inc' : ''}" type="button" aria-pressed="${on}"><b>${label}</b></button>`;
/** Time picker grouped by category (chess.com layout): the category name appears once, as the row label. */
export function picker(o = {}) {
  const sel = o.sel ?? '3';
  const rows = [
    ['bullet', 'بولت', ['1'], ['1+1']],
    ['lightning', 'بلیتس', ['3', '5'], ['3+2', '5+3']],
    ['stopwatch', 'رپید', ['10'], ['10+5']],
  ].map(([icon, name, main, inc]) => `<div class="cx-catrow"><span class="cx-cat">${aic(icon)}${name}</span><div class="cx-catrow__tiles">${main.map((m) => tile(`<span>${fa(m)}</span><span>دقیقه</span>`, sel === m)).join('')}${o.more ? inc.map((m) => tile(`<span class="cx-inc" dir="ltr">${m.split('+').map(fa).join('<i>+</i>')}</span>`, sel === m, true)).join('') : ''}</div></div>`).join('');
  return `<div class="bgv-seg bgv-seg--block" role="tablist" aria-label="حریف"><button class="bgv-seg__item" role="tab" aria-selected="true">${ic('globe')}آنلاین</button><button class="bgv-seg__item" role="tab" aria-selected="false">${ic('users')}با دوست</button><button class="bgv-seg__item" role="tab" aria-selected="false">${ic('bot')}با ربات</button></div>
<div class="cx-tc">${rows}</div>
<button class="cx-more" type="button" aria-expanded="${o.more ? 'true' : 'false'}">${ic('chevdown')}${o.more ? 'زمان‌های کمتر' : 'زمان‌های بیشتر'}</button>
${o.more ? `<p class="cx-hint">در «۳ + ۲» بعد از هر حرکت ۲ ثانیه به ساعت شما اضافه می‌شود. این زمان‌ها برای بازی با دوست و مسابقه است.</p>` : ''}
<div class="cx-row cx-row--between"><span class="cx-cat">نوع رقابت</span><div class="bgv-seg" role="radiogroup" aria-label="نوع رقابت"><button class="bgv-seg__item" role="radio" aria-checked="false">دوستانه</button><button class="bgv-seg__item" role="radio" aria-checked="true" aria-selected="true">رتبه‌دار</button></div></div><p class="cx-hint">نتیجه روی رتبهٔ بلیتس شما اثر دارد. حریف بر اساس مهارت انتخاب می‌شود.</p>`;
}
function lobby() {
  const side = `<h2 class="cx-h">بازی جدید شطرنج</h2>${picker({ sel: '3', more: true })}
${btn('لغو', 'secondary bgv-btn--lg cx-cta', 'x')}`;
  const stage = `<div class="cx-seek" role="status"><div class="cx-ring" aria-hidden="true"></div><h3>دنبال حریف می‌گردیم…</h3><p>۳ دقیقه، بلیتس، رتبه‌دار</p><span class="cx-seek__t">${fa('0:07')}</span></div>`;
  return `<div class="cx-frame bgv" data-theme="light" dir="rtl"><div style="display:grid;grid-template-rows:var(--gamebar-h) 1fr;block-size:900px">${gamebar({ meta: ['شطرنج', 'بازی جدید'] })}<div class="cx-lobby"><div class="cx-lobby__side">${side}</div><div class="cx-lobby__stage">${stage}</div></div></div></div>`;
}

// ---------- frames ----------
function myTurn(theme = 'light') {
  const sc = S.main;
  const sel = 'b3';
  return desk({
    theme, gb: GB5,
    rail: railStd(sc, { status: status('<b>نوبت شماست.</b> مهره را بکشید یا رویش کلیک کنید.'), opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, 'w', { w: clock('3:42', 'run', { who: 'شما' }), b: clock('4:05', 'idle', { who: 'نیلوفر' }) }, { sel, dots: sc.legal(sel), hover: 'b7' }),
    chat: chatCol({ msgs: [['sys', 'بازی شروع شد. <b>مینا</b> سفید است، <b>نیلوفر</b> سیاه'], ['opp', 'سلام، بازی خوبی داشته باشیم'], ['me', 'سلام، همچنین 🙂']] }),
  });
}
function check() {
  const sc = S.check;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>کیش!</b> شاه شما زیر حملهٔ فیل b4 است. فقط حرکت‌هایی مجازند که کیش را رفع کنند.', { check: true, icon: ic('info') }), opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, 'w', { w: clock('4:31', 'run', { who: 'شما' }), b: clock('4:48', 'idle', { who: 'نیلوفر' }) }, { sel: 'c1', dots: sc.legal('c1') }),
  });
}
function promo() {
  const sc = S.promo;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>سرباز به خط آخر رسید.</b> انتخاب کنید به چه مهره‌ای تبدیل شود.') }),
    feltHtml: felt(sc, 'w', { w: clock('1:02', 'run', { who: 'شما' }), b: clock('0:47', 'idle', { who: 'نیلوفر' }) }, { sel: 'e7', last: ['e7', 'e8'], promo: { sq: 'e8', color: 'w' }, ghost: 'e7', overlay: '<i class="cx-scrim-board"></i>' }),
  });
}
function premove() {
  const sc = S.pre;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>نوبت نیلوفر.</b> پری‌موو شما آماده است: <b dir="ltr">Nh5</b>. برای لغو، روی یک خانهٔ خالی بزنید.', { icon: ic('zap') }), opening: 'دفاع سیسیلی، نایدورف' }),
    feltHtml: felt(sc, 'b', { w: clock('0:41', 'run', { who: 'نیلوفر' }), b: clock('0:19', 'warn', { who: 'شما' }) }, { pre: ['f6', 'h5'], last: sc.last }),
  });
}
function enPassant() {
  const sc = S.ep;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>آن‌پاسان ممکن است.</b> سرباز سیاه همین الان دو خانه جلو آمد و کنار سرباز شما ایستاد. با رفتن به d6 آن را می‌زنید؛ فقط در همین حرکت.', { icon: ic('info') }), opening: 'دفاع فرانسوی' }),
    feltHtml: felt(sc, 'w', { w: clock('4:51', 'run', { who: 'شما' }), b: clock('4:56', 'idle', { who: 'نیلوفر' }) }, { sel: 'e5', dots: sc.legal('e5'), ring: ['d5'] }),
  });
}
function lowTime() {
  const sc = S.low;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>کمتر از ۱۰ ثانیه وقت دارید.</b> ساعت قرمز شده و دهم ثانیه را نشان می‌دهد.', { check: true, icon: ic('clock') }) }),
    feltHtml: felt(sc, 'w', { w: clock('0:08.4', 'crit', { who: 'شما' }), b: clock('0:31', 'idle', { who: 'نیلوفر' }) }, {}),
  });
}
function drawOffer() {
  const sc = S.draw;
  const offer = `<section class="cx-offer" role="alertdialog" aria-label="پیشنهاد مساوی"><div class="cx-offer__t">${ic('hand')}<span><b>نیلوفر پیشنهاد مساوی داد.</b></span></div><div class="cx-offer__row">${btn('قبول', 'primary', 'check')}${btn('رد', 'secondary', 'x')}</div><span class="cx-note">اگر حرکت کنید، یعنی رد کرده‌اید.</span></section>`;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>نوبت شماست.</b>'), mid: offer }),
    feltHtml: felt(sc, 'w', { w: clock('2:14', 'run', { who: 'شما' }), b: clock('2:09', 'idle', { who: 'نیلوفر' }) }, {}),
    chat: chatCol({ msgs: [['sys', 'بازی شروع شد. <b>مینا</b> سفید است، <b>نیلوفر</b> سیاه'], ['game', '<i class="bgv-seat seat-2"></i><b>نیلوفر</b> مساوی پیشنهاد داد']] }),
  });
}
function resign() {
  const sc = S.main;
  const over = `<div class="cx-over"><div class="bgv-dialog" role="alertdialog" aria-label="تسلیم"><div class="bgv-dialog__head"><span class="bgv-dialog__title">تسلیم می‌شوید؟</span>${ibtn('x', 'بستن')}</div><div style="padding:0 20px 8px;font-size:15px;line-height:1.8;color:var(--text)">بازی را می‌بازید و رتبهٔ بلیتس شما حدود ${fa(8)} امتیاز کم می‌شود.</div><div style="display:flex;gap:10px;padding:12px 20px 20px">${btn('ادامهٔ بازی', 'secondary')}${btn('تسلیم', 'leave', 'flag')}</div></div></div>`;
  const sent = `<section class="cx-offer" style="background:var(--surface-sunken);box-shadow:var(--shadow-ring)"><div class="cx-offer__t">${ic('hand')}<span>پیشنهاد مساوی فرستاده شد. منتظر جواب نیلوفر بمانید.</span></div><span class="cx-note">تا ۵ حرکت دیگر نمی‌توانید دوباره پیشنهاد بدهید.</span></section>`;
  return desk({
    gb: GB5, over,
    rail: railStd(sc, { status: status('<b>نوبت نیلوفر.</b>', { icon: ic('clock') }), mid: sent, drawLabel: 'فرستاده شد', drawDisabled: true, opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, 'w', { w: clock('3:30', 'idle', { who: 'شما' }), b: clock('3:58', 'run', { who: 'نیلوفر' }) }, {}),
  });
}
function gameOver() {
  const sc = S.mate;
  const over = `<div class="cx-over" style="background:rgba(7,19,28,.55)">${resultCard({ title: 'بردید!', reason: 'حریف را مات کردید', win: 'me', score: '1 - 0', rMe: 1620, dMe: 8, rOpp: 1676, dOpp: -8 })}</div>`;
  return desk({
    gb: { meta: ['بلیتس ۵ دقیقه', 'بازی تمام شد'] }, over,
    rail: railStd(sc, { status: status('<b>بازی تمام شد.</b> سفید مات کرد و برد (۱-۰).', { icon: ic('trophy') }), actions: `<div class="cx-actions" style="grid-template-columns:1fr 1fr">${btn('بازی دوباره', 'primary', 'repeat')}${btn('آنالیز بازی', 'secondary', 'eye')}</div>` }),
    feltHtml: felt(sc, 'w', { w: clock('1:12', 'idle', { who: 'شما' }), b: clock('0:58', 'idle', { who: 'نیلوفر' }) }, {}),
    chat: chatCol({ msgs: [['sys', 'بازی شروع شد. <b>مینا</b> سفید است، <b>نیلوفر</b> سیاه'], ['game', '<i class="bgv-seat seat-1"></i><b>مینا</b> با <span dir="ltr">Rd8#</span> مات کرد'], ['opp', 'آفرین، ردیف آخر رو ندیده بودم'], ['me', 'بازی خوبی بود']] }),
  });
}
const REASONS = [
  ['w', 'بردید!', 'حریف را مات کردید', 'checkmate'], ['w', 'بردید!', 'وقت حریف تمام شد', 'timeout'], ['w', 'بردید!', 'حریف تسلیم شد', 'resign'],
  ['l', 'باختید', 'مات شدید', 'checkmate'], ['l', 'باختید', 'وقت شما تمام شد', 'timeout'],
  ['d', 'مساوی', 'پات شد', 'stalemate'], ['d', 'مساوی', 'تکرار سه‌باره', 'repetition'], ['d', 'مساوی', 'قانون ۵۰ حرکت', 'fiftyMove'],
  ['d', 'مساوی', 'مهرهٔ کافی برای مات نمانده', 'material'], ['d', 'مساوی', 'با توافق دو طرف', 'agreement'],
  ['d', 'مساوی', 'وقت شما تمام شد، ولی حریف مهرهٔ کافی برای مات نداشت', 'timeoutMaterial'], ['x', 'بازی لغو شد', 'حرکت اول زده نشد. رتبه تغییر نمی‌کند', 'aborted (پلتفرم)'],
  ['l', 'باختید', 'تسلیم شدید', 'resign'], ['w', 'بردید (آرماگدون)', 'در آرماگدون مساوی یعنی برد سیاه', 'armageddon'], ['w', 'برد فورفه', 'حریف سر میز مسابقه نیامد', 'forfeit (مسابقه)'],
];
const reasons = () => `<div class="cx-reasons">${REASONS.map(([k, t, r, code]) => `<div class="cx-reason cx-reason--${k}"><b>${t}</b><span>${r}</span><code>${code}</code></div>`).join('')}</div>`;

function reconnect() {
  const sc = S.main;
  const ban = `<div class="cx-banner cx-banner--retry" role="status"><i class="cx-spin" aria-hidden="true"></i><span><b>اتصال شما قطع شد.</b> در حال وصل شدن دوباره… ساعت شما همچنان کار می‌کند.</span>${btn('تلاش دوباره', 'secondary bgv-btn--sm')}</div>`;
  return desk({
    gb: { ...GB5, meta: ['بلیتس ۵ دقیقه', '<span class="bgv-conn bgv-conn--retry">در حال اتصال</span>'] },
    rail: railStd(sc, { status: status('<b>نوبت شماست.</b> تا وصل نشوید، حرکت‌ها فرستاده نمی‌شوند.', { icon: ic('wifioff') }), drawDisabled: true, resignDisabled: true, opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, 'w', { w: clock('3:12', 'run', { who: 'شما' }), b: clock('4:05', 'idle', { who: 'نیلوفر' }) }, { overlay: '<i class="cx-scrim-board" style="background:rgba(13,26,35,.35)"></i>' }, { bannerTop: ban }),
  });
}
function oppOffline() {
  const sc = S.mainB;
  const ban = `<div class="cx-banner cx-banner--info" role="status">${ic('wifioff')}<span><b>نیلوفر قطع شد.</b> ساعتش کار می‌کند؛ اگر وقتش تمام شود، شما می‌برید.</span></div>`;
  return desk({
    gb: GB5,
    rail: railStd(sc, { status: status('<b>نوبت نیلوفر.</b> منتظر وصل شدن حریف هستیم.', { icon: ic('wifioff') }), opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, 'w', { w: clock('3:42', 'idle', { who: 'شما' }), b: clock('1:46', 'off', { who: 'نیلوفر' }) }, {}, { bannerTop: ban, b: { note: '<span class="cx-pill cx-pill--off">قطع</span>' } }),
  });
}
function spectator() {
  const sc = S.main;
  const stand = `<div class="cx-mini" role="table" aria-label="جدول بعد از دور ۲"><span>۱</span><span>آرش</span><span>۲</span><span>${fa('1802')}</span><span>۲</span><span>نیلوفر</span><span>۲</span><span>${fa('1684')}</span><span>۳</span><span>مینا</span><span>۱٫۵</span><span>${fa('1612')}</span><span>۴</span><span>سارا</span><span>۱٫۵</span><span>${fa('1590')}</span><span>۵</span><span>کیان</span><span>۱</span><span>${fa('1655')}</span></div>`;
  const top = tourStrip({ round: 3, board: 2, more: `<div class="cx-note">سوئیس، ۳+۲. دور بعد وقتی همهٔ میزها تمام شوند شروع می‌شود.</div>${stand}${btn('جدول کامل مسابقه', 'ghost bgv-btn--sm', 'list')}` });
  const P = { w: clock('2:51', 'run', { who: 'مینا' }), b: clock('3:20', 'idle', { who: 'نیلوفر' }) };
  return desk({
    gb: { meta: ['مسابقهٔ شطرنج', 'دور ۳', 'میز ۲', '<span class="bgv-spectators">' + ic('eye') + '۱۲ تماشاچی</span>'] },
    rail: railStd(sc, { top, tail: 6, status: status('<b>تماشا می‌کنید.</b> نوبت مینا (سفید).', { icon: ic('eye') }), actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('میز بعدی مسابقه', 'secondary', 'swords')}${ibtn('flip', 'چرخاندن صفحه', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`, opening: 'گشایش ایتالیایی' }),
    feltHtml: felt(sc, null, P, {}, { w: { you: false }, b: { you: false } }),
    chat: chatCol({ title: 'گفت‌وگوی تماشاچی‌ها', readonly: 'بازیکن‌ها در مسابقه پیام تماشاچی‌ها را نمی‌بینند.', msgs: [['sys', 'دور ۳ شروع شد'], ['opp', 'Qb3 حرکت قشنگی بود']] }),
  });
}

const SHOTS = () => [
  ['lobby', 'انتخاب زمان و پیدا کردن حریف', 'لابی', ['زمان‌ها در سه ردیف بولت، بلیتس و رپید. زمان‌های با اضافه‌زمان زیر «زمان‌های بیشتر» هستند.', 'بعد از «بازی کن» دکمه «لغو» می‌شود و تا پیدا شدن حریف شمارنده نشان داده می‌شود.'], lobby()],
  ['turn', 'نوبت شما', 'حرکت‌های مجاز', ['مهرهٔ انتخاب‌شده زرد می‌شود. نقطه یعنی خانهٔ مجاز، حلقه یعنی زدن مهره.', 'زیر اسم هر بازیکن مهره‌هایی که زده و اختلاف امتیاز مهره‌ها (+۱، +۲…) دیده می‌شود.'], myTurn()],
  ['check', 'کیش', '', ['شاهِ کیش‌شده هالهٔ قرمز دارد و فقط حرکت‌هایی مجازند که کیش را رفع کنند.'], check()],
  ['promotion', 'ارتقای سرباز', '', ['روی خانهٔ آخر ستون انتخاب باز می‌شود: وزیر، اسب، رخ، فیل. با ✕ حرکت لغو می‌شود.'], promo()],
  ['premove', 'پری‌موو در نوبت حریف', 'شما با سیاه', ['حرکتِ از قبل چیده‌شده روی دو خانهٔ قرمز دیده می‌شود و به محض رسیدن نوبت زده می‌شود.', 'ساعت شما زیر ۲۰ ثانیه نارنجی می‌شود.'], premove()],
  ['lowtime', 'وقت کم', 'زیر ۱۰ ثانیه', ['ساعت قرمز می‌شود و دهم ثانیه را هم نشان می‌دهد.'], lowTime()],
  ['draw-offer', 'پیشنهاد مساوی از حریف', '', ['پیشنهاد در ستون کنار صفحه می‌آید و صفحه را نمی‌پوشاند. حرکت کردن یعنی رد.'], drawOffer()],
  ['resign', 'تسلیم و پیشنهاد فرستاده‌شده', '', ['تسلیم همیشه تأیید می‌خواهد. بعد از پیشنهاد مساوی، دکمه تا ۵ حرکت غیرفعال است.'], resign()],
  ['game-over', 'پایان بازی', 'نتیجه و دلیل', ['پنجرهٔ نتیجه با تغییر رتبهٔ هر دو نفر. «بازی دوباره» با همان زمان و جابه‌جایی رنگ‌ها.', 'همهٔ حالت‌های پایان در جدول زیر.'], gameOver() + reasons()],
  ['reconnect', 'قطع شدن اتصال شما', '', ['ساعت نمی‌ایستد. تا وصل شوید صفحه کم‌رنگ و دکمه‌ها غیرفعال است.'], reconnect()],
  ['opp-offline', 'قطع شدن حریف', '', ['ساعتِ حریفِ قطع‌شده خط‌چین می‌شود و همچنان کم می‌شود.'], oppOffline()],
  ['spectator', 'تماشاچی و مسابقه', 'دور ۳، میز ۲', ['تماشاچی دکمهٔ بازی ندارد. کارت مسابقه دور، میز و جدول را نشان می‌دهد.', 'گفت‌وگوی تماشاچی‌ها جداست و بازیکن‌ها در مسابقه آن را نمی‌بینند.'], spectator()],
  ['dark', 'حالت تیره', 'نوبت شما', null, myTurn('dark')],
  ['en-passant', 'آن‌پاسان', 'زدن در حال عبور', ['تنها حرکت سرباز e5 آن‌پاسان است (e6 بسته است). حلقهٔ روی d5 سربازی را نشان می‌دهد که زده می‌شود.', 'در فهرست حرکت‌ها <span dir="ltr">exd6</span> ثبت می‌شود (موتور: تست‌های E1 تا E4).'], enPassant()],
];
/** One artboard per screen: { slug, n, title, html }. */
export function desktopShots() {
  return SHOTS().map(([slug, title, sub, notes, frame], i) => ({ slug, n: i + 1, title, html: `<div class="cx-doc" data-page="desktop">${shot(i + 1, title, sub, notes, frame)}</div>` }));
}
export function desktopBody() {
  return desktopShots().map((x) => x.html).join('');
}
