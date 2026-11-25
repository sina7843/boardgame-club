// Phone artboard: 18 screens at 390×844 (3 rows × 6).
import { S } from './scenes.mjs';
import { picker, tabs, colors, botPicker, ghost } from './desktop.mjs';
import { TOKENS } from './lib.mjs';
import { felt, mstrip, mlist, status, resultCard, btn, ibtn, fa, num, ic, aic, clock, gamebar } from './parts.mjs';

const GB = (meta = ['بلیتس ۵ دقیقه', 'رتبه‌دار'], extra = {}) => gamebar({ phone: true, meta, ...extra });
const ck = (t, s, who) => clock(t, s, { sm: true, who });
function dock(o = {}) {
  const b = (icon, label, x = '') => `<button type="button"${x}>${ic(icon)}${label}</button>`;
  return `<nav class="cx-pdock" aria-label="دکمه‌های بازی">${o.items ?? `${b('more', 'گزینه‌ها')}${b('hand', o.draw ?? 'مساوی', o.drawX ?? '')}${b('flag', 'تسلیم', o.resignX ?? '')}${b('next', 'قبلی')}${b('prev', 'بعدی', ' disabled')}`}</nav>`;
}
function phone({ theme = 'light', gb = GB(), sc, you = 'w', clocks, bo = {}, fo = {}, stat = '', strip = true, over = '', dk = dock() }) {
  return `<div class="cx-phone bgv" data-theme="${theme}" dir="rtl">${gb}<main class="cx-pfelt" aria-label="میز شطرنج">${fo.bannerTop ?? ''}${felt(sc, you, clocks, bo, { sm: true, ...fo, bannerTop: '' })}${stat}${strip ? mstrip(sc) : ''}</main>${dk}${over}</div>`;
}
const pstat = (html, cls = '') => `<div class="cx-pstat${cls ? ' cx-pstat--' + cls : ''}">${html}</div>`;
const ph = (n, title, sub, note, body) => ({ n, title, html: `<div class="cx-ph"><div class="cx-ph__cap">${fa(n)}. ${title}${sub ? `<small>${sub}</small>` : ''}</div>${body}${note ? `<p class="cx-ph__note">${note}</p>` : ''}</div>` });
const sheet = (inner, o = {}) => `<div class="cx-sheetwrap"><section class="bgv-sheet" aria-label="${o.label ?? ''}"><i class="bgv-sheet__handle"></i>${o.head ? `<div style="display:flex;align-items:center;gap:8px;padding:6px 20px 0"><b style="flex:1;font-size:19px;color:var(--heading)">${o.head}</b>${ibtn('x', 'بستن')}</div>` : ''}<div class="cx-sheet__body">${inner}</div></section></div>`;

export function phoneShots() {
  const m = S.main;
  const list = [];
  // 1 picker
  list.push(ph(1, 'بازی جدید', 'انتخاب زمان', 'زمان‌ها در سه ردیف بولت، بلیتس و رپید. زمان‌های با اضافه‌زمان فقط در «با دوست» و مسابقه است.', `<div class="cx-phone bgv" data-theme="light" dir="rtl">${GB(['شطرنج', 'بازی جدید'])}<main class="cx-pfelt" style="justify-content:center;align-items:center;opacity:.5">${felt(m, 'w', { w: ck('5:00', 'pre'), b: ck('5:00', 'pre') }, {}, { sm: true })}</main>${sheet(`${picker({ sel: '5', more: true })}${btn('بازی کن', 'primary bgv-btn--lg cx-cta', 'zap')}`, { head: 'بازی جدید شطرنج', label: 'بازی جدید' })}</div>`));
  // 2 seeking
  list.push(ph(2, 'دنبال حریف', '', 'تا حریف پیدا شود شمارنده و دکمهٔ لغو دیده می‌شود. بعد میز خودش باز می‌شود.', `<div class="cx-phone bgv" data-theme="light" dir="rtl">${GB(['شطرنج', '۵ دقیقه'])}<main class="cx-pfelt" style="justify-content:center;align-items:center;padding:20px"><div class="cx-seek" role="status" style="inline-size:100%;box-sizing:border-box"><div class="cx-ring" aria-hidden="true"></div><h3>دنبال حریف می‌گردیم…</h3><p>۵ دقیقه، بلیتس، رتبه‌دار</p><span class="cx-seek__t">${fa('0:12')}</span>${btn('لغو', 'secondary', 'x')}</div></main>${dock({ items: '' }).replace('<nav class="cx-pdock"', '<nav class="cx-pdock" style="display:none"')}</div>`));
  // 3 my turn
  list.push(ph(3, 'نوبت شما', 'حرکت‌های مجاز', 'صفحه تمام عرض گوشی است و ساعت کنار اسم هر بازیکن. حرکت‌ها زیر صفحه در یک ردیف افقی می‌آیند.', phone({ sc: m, clocks: { w: ck('3:42', 'run', 'شما'), b: ck('4:05', 'idle', 'نیلوفر') }, bo: { sel: 'b3', dots: m.legal('b3') }, stat: pstat('<i class="cx-dot-turn"></i><span><b>نوبت شماست.</b> مهره را بکشید یا لمس کنید.</span>') })));
  // 4 check
  const c = S.check;
  list.push(ph(4, 'کیش', '', 'فقط حرکت‌هایی مجازند که کیش را رفع کنند.', phone({ sc: c, clocks: { w: ck('4:31', 'run', 'شما'), b: ck('4:48', 'idle', 'نیلوفر') }, bo: { sel: 'c1', dots: c.legal('c1') }, stat: pstat(`${ic('info')}<span><b>کیش!</b> شاه را از حمله نجات بدهید.</span>`, 'check') })));
  // 5 promotion
  const p = S.promo;
  list.push(ph(5, 'ارتقای سرباز', '', 'ستون انتخاب مهره روی خانهٔ آخر باز می‌شود.', phone({ sc: p, clocks: { w: ck('1:02', 'run', 'شما'), b: ck('0:47', 'idle', 'نیلوفر') }, bo: { sel: 'e7', last: ['e7', 'e8'], promo: { sq: 'e8', color: 'w' }, ghost: 'e7', overlay: '<i class="cx-scrim-board"></i>' }, stat: pstat('<span><b>سرباز به خط آخر رسید.</b> مهرهٔ جدید را انتخاب کنید.</span>') })));
  // 6 premove (black)
  const pr = S.pre;
  list.push(ph(6, 'پری‌موو در نوبت حریف', 'شما با سیاه', 'در نوبت حریف حرکتتان را از قبل بچینید؛ به محض رسیدن نوبت زده می‌شود.', phone({ sc: pr, you: 'b', clocks: { w: ck('0:41', 'run', 'نیلوفر'), b: ck('0:19', 'warn', 'شما') }, bo: { pre: ['f6', 'h5'] }, stat: pstat(`${ic('zap')}<span>پری‌موو: <b dir="ltr">Nh5</b>. برای لغو، یک خانهٔ خالی را لمس کنید.</span>`, 'pre') })));
  // 7 low time
  const l = S.low;
  list.push(ph(7, 'وقت کم', 'زیر ۱۰ ثانیه', 'ساعت قرمز با دهم ثانیه. صدا و لرزش اگر در تنظیمات روشن باشد.', phone({ sc: l, clocks: { w: ck('0:08.4', 'crit', 'شما'), b: ck('0:31', 'idle', 'نیلوفر') }, stat: pstat(`${ic('clock')}<span><b>کمتر از ۱۰ ثانیه وقت دارید.</b></span>`, 'check') })));
  // 8 draw offer received
  const d = S.draw;
  const offer = `<div class="cx-offerbar" role="alertdialog" aria-label="پیشنهاد مساوی">${ic('hand')}<span><b>نیلوفر</b> مساوی پیشنهاد داد.</span>${btn('قبول', 'primary bgv-btn--sm', 'check')}${ibtn('x', 'رد', 'secondary')}</div>`;
  list.push(ph(8, 'پیشنهاد مساوی از حریف', '', 'یک نوار یک‌خطی زیر صفحه؛ نوار وضعیت (مثلاً «کیش!») سر جایش می‌ماند. حرکت کردن یعنی رد.', phone({ sc: d, clocks: { w: ck('2:14', 'run', 'شما'), b: ck('2:09', 'idle', 'نیلوفر') }, stat: pstat('<i class="cx-dot-turn"></i><span><b>نوبت شماست.</b></span>') + offer })));
  // 9 resign confirm
  list.push(ph(9, 'تأیید تسلیم', '', 'با دکمهٔ «تسلیم» پایین صفحه باز می‌شود.', phone({ sc: m, clocks: { w: ck('3:30', 'run', 'شما'), b: ck('3:58', 'idle', 'نیلوفر') }, over: sheet(`<p style="margin:0;font-size:15px;line-height:1.8;color:var(--text)">بازی را می‌بازید و رتبهٔ بلیتس شما حدود ${fa(8)} امتیاز کم می‌شود.</p><div style="display:grid;gap:10px">${btn('تسلیم', 'leave bgv-btn--lg', 'flag')}${btn('ادامهٔ بازی', 'secondary bgv-btn--lg')}</div>`, { head: 'تسلیم می‌شوید؟', label: 'تسلیم' }) })));
  // 10 game over win
  const mt = S.mate;
  list.push(ph(10, 'بردید', 'مات', 'امتیاز به ترتیب شطرنج (سفید چپ). با ✕ پنجره بسته می‌شود و صفحهٔ آخر دیده می‌شود؛ چیپ نتیجه بالای صفحه دوباره بازش می‌کند.', phone({ sc: mt, gb: GB(['بلیتس ۵ دقیقه', 'بازی تمام شد']), clocks: { w: ck('1:12', 'idle', 'شما'), b: ck('0:58', 'idle', 'نیلوفر') }, over: `<div class="cx-over">${resultCard({ title: 'بردید!', reason: 'حریف را مات کردید', win: 'me', white: 'me', score: '1 - 0', rMe: 1620, dMe: 8, rOpp: 1676, dOpp: -8 })}</div>`, dk: dock({ items: '' }) })));
  // 11 draw repetition
  const r = S.rep;
  list.push(ph(11, 'مساوی', 'تکرار سه‌باره', 'همان پنجره با دلیل مساوی.', phone({ sc: r, gb: GB(['بلیتس ۵ دقیقه', 'بازی تمام شد']), clocks: { w: ck('1:40', 'idle', 'شما'), b: ck('1:21', 'idle', 'نیلوفر') }, over: `<div class="cx-over">${resultCard({ title: 'مساوی', icon: 'flag', reason: 'تکرار سه‌بارهٔ یک وضعیت', score: '½ - ½', rMe: 1613, dMe: 1, rOpp: 1683, dOpp: -1 })}</div>`, dk: dock({ items: '' }) })));
  // 12 move list sheet
  list.push(ph(12, 'همهٔ حرکت‌ها', 'از گزینه‌ها', 'از دکمهٔ «گزینه‌ها»: حرکت‌ها، چرخاندن صفحه، تنظیمات، دانلود PGN.', phone({ sc: m, clocks: { w: ck('3:42', 'run', 'شما'), b: ck('4:05', 'idle', 'نیلوفر') }, over: sheet(`<div class="cx-mlhead"><span>#</span><span>سفید</span><span>سیاه</span></div>${mlist(m)}<div class="cx-row" style="gap:8px">${btn('چرخاندن صفحه', 'secondary bgv-btn--sm', 'flip')}${btn('تنظیمات', 'secondary bgv-btn--sm', 'settings')}${btn('PGN', 'ghost bgv-btn--sm', 'download')}</div>`, { head: 'حرکت‌ها <span class="cx-note" style="font-weight:400">گشایش ایتالیایی</span>', label: 'حرکت‌ها' }) })));
  // 13 reconnect (me)
  list.push(ph(13, 'قطع شدن اتصال شما', '', 'ساعت نمی‌ایستد. تا وصل شوید دکمه‌ها غیرفعال است. روی گوشی پیام زیر صفحه می‌آید، نه روی آن؛ هیچ خانه‌ای پوشیده نمی‌شود.', phone({ sc: m, gb: GB(['بلیتس ۵ دقیقه', '<span class="bgv-conn bgv-conn--retry">در حال اتصال</span>']), clocks: { w: ck('3:12', 'run', 'شما'), b: ck('4:05', 'idle', 'نیلوفر') }, bo: { overlay: '<i class="cx-scrim-board" style="background:rgba(13,26,35,.35)"></i>' }, stat: pstat(`<i class="cx-spin" aria-hidden="true"></i><span><b>اتصال قطع شد.</b> در حال وصل شدن دوباره…</span>`, 'pre'), dk: dock({ drawX: ' disabled', resignX: ' disabled' }) })));
  // 14 opponent offline
  const mb = S.mainB;
  list.push(ph(14, 'قطع شدن حریف', '', 'ساعتِ حریفِ قطع‌شده خط‌چین می‌شود و همچنان کم می‌شود.', phone({ sc: mb, clocks: { w: ck('3:42', 'idle', 'شما'), b: ck('1:46', 'off', 'نیلوفر') }, fo: { b: { note: '<span class="cx-pill cx-pill--off">قطع</span>' } }, stat: pstat(`${ic('wifioff')}<span><b>نیلوفر قطع شد.</b> اگر وقتش تمام شود، شما می‌برید.</span>`) })));
  // 15 spectator
  list.push(ph(15, 'تماشاچی', 'مسابقه', 'تماشاچی دکمهٔ بازی ندارد؛ پایین صفحه: حرکت‌ها، چرخاندن، گفت‌وگو، جدول، میز بعدی.', phone({ sc: m, you: null, gb: GB(['مسابقهٔ شطرنج', 'دور ۳', 'میز ۲'], { extra: '' }), clocks: { w: ck('2:51', 'run', 'مینا'), b: ck('3:20', 'idle', 'نیلوفر') }, fo: { w: { you: false } }, stat: pstat(`${ic('eye')}<span><b>تماشا می‌کنید.</b> ۱۲ نفر دیگر هم تماشا می‌کنند.</span>`), dk: dock({ items: ['list|حرکت‌ها', 'flip|چرخاندن', 'chat|گفت‌وگو', 'trophy|جدول', 'swords|میز بعدی'].map((x) => { const [i, t] = x.split('|'); return `<button type="button">${ic(i)}${t}</button>`; }).join('') }) })));
  // 16 tournament between rounds
  const stand = [['۱', 'آرش', '۲٫۵', '1802'], ['۲', 'مینا', '۲٫۵', '1620', true], ['۳', 'نیلوفر', '۲', '1676'], ['۴', 'سارا', '۲', '1590'], ['۵', 'کیان', '۱٫۵', '1655'], ['۶', 'پویا', '۱', '1540']];
  const tbl = `<div class="cx-mini" style="grid-template-columns:24px 1fr auto auto">${stand.map(([n, nm, pt, rt, me]) => `<span>${n}</span><span class="${me ? 'is-you' : ''}">${nm}${me ? ' (شما)' : ''}</span><span>${pt}</span><span>${num(rt)}</span>`).join('')}</div>`;
  list.push(ph(16, 'بین دو دور مسابقه', 'سوئیس', 'امتیاز تا اینجا، حریف دور بعد، شمارش معکوس و جدول. میز دور بعد خودش باز می‌شود.', `<div class="cx-phone bgv" data-theme="light" dir="rtl" style="background:var(--bg)">${GB(['مسابقهٔ شطرنج', 'سوئیس ۵ دور', '۳+۲'])}<main style="flex:1;padding:14px;display:grid;gap:12px;align-content:start;overflow:hidden"><section class="cx-card"><div class="cx-round">${ic('trophy')}<span><b>دور ۳ تمام شد.</b> امتیاز شما: ۲٫۵ از ۳</span></div><div class="cx-tourcard" style="grid-template-columns:auto 1fr"><span class="bgv-avatar seat-2">آ</span><div><b>دور ۴: شما و آرش (${num(1802)})</b><span>شما با سیاه، میز ۱</span></div></div><div style="display:flex;align-items:baseline;gap:8px;justify-content:center"><span class="cx-note">شروع دور بعد تا</span><b style="font:900 30px/1 var(--font-fa);color:var(--heading);direction:ltr">${fa('1:45')}</b></div>${btn('آماده‌ام', 'primary bgv-btn--lg', 'check')}</section><section class="cx-card"><h3>جدول بعد از دور ۳</h3>${tbl}${btn('جدول کامل', 'ghost bgv-btn--sm', 'list')}</section></main></div>`));
  // 17 dark my turn
  list.push(ph(17, 'حالت تیره: نوبت شما', '', '', phone({ theme: 'dark', sc: m, clocks: { w: ck('3:42', 'run', 'شما'), b: ck('4:05', 'idle', 'نیلوفر') }, bo: { sel: 'b3', dots: m.legal('b3') }, stat: pstat('<i class="cx-dot-turn"></i><span><b>نوبت شماست.</b></span>') })));
  // 18 dark lose on time
  const ep = S.ep;
  list.push(ph(19, 'آن‌پاسان', '', 'سرباز e5 می‌تواند به d6 برود و سرباز d5 را بزند؛ فقط در همین حرکت.', phone({ sc: ep, clocks: { w: ck('4:51', 'run', 'شما'), b: ck('4:56', 'idle', 'نیلوفر') }, bo: { sel: 'e5', dots: ep.legal('e5'), ring: ['d5'] }, stat: pstat(`${ic('info')}<span><b>آن‌پاسان ممکن است:</b> با رفتن به d6، سرباز d5 زده می‌شود.</span>`) })));
  list.push(ph(18, 'حالت تیره: باخت با وقت', '', 'روی ساعتِ تمام‌شده پرچم می‌آید.', phone({ theme: 'dark', sc: l, gb: GB(['بلیتس ۵ دقیقه', 'بازی تمام شد']), clocks: { w: ck('0:00', 'flag', 'شما'), b: ck('0:24', 'idle', 'نیلوفر') }, over: `<div class="cx-over">${resultCard({ title: 'باختید', icon: 'flag', reason: 'وقت شما تمام شد', win: 'opp', white: 'me', score: '0 - 1', rMe: 1604, dMe: -8, rOpp: 1692, dOpp: 8 })}</div>`, dk: dock({ items: '' }) })));

  // ---------- v1.3 (2026-11-24) ----------
  // 20 board settings sheet: labels follow the switch state; site theme, animation speed, volume (chess.com has all three)
  const BOARD_FA = { 'tournament-green': 'سبز مسابقه‌ای', walnut: 'گردو', 'ink-navy': 'سرمه‌ای', 'persian-kashi': 'کاشی ایرانی' };
  const minis = Object.entries(BOARD_FA).map(([id, nm]) => { const t = TOKENS[id]; const PCS = { 0: 'br', 5: 'bp', 10: 'wn', 15: 'wq' }; return `<div class="cx-sw${id === 'tournament-green' ? ' is-def' : ''}"><div class="cx-sw__b">${Array.from({ length: 16 }, (_, i) => `<span class="cx-sw__c" style="background:${(Math.floor(i / 4) + i) % 2 ? t.dark : t.light}">${PCS[i] ? `<i class="pc pc-${PCS[i]}"></i>` : ''}</span>`).join('')}</div>${nm}</div>`; }).join('');
  const sw = (label, on) => `<div class="cx-srow"><span>${label}</span><button class="bgv-switch" type="button" role="switch" aria-checked="${on}"><span class="bgv-switch__state">${on ? 'روشن' : 'خاموش'}</span><span class="bgv-switch__track"></span></button></div>`;
  const seg = (label, items, sel) => `<div class="cx-srow"><span>${label}</span><div class="bgv-seg" role="radiogroup" aria-label="${label}">${items.map((x, i) => `<button class="bgv-seg__item" role="radio" aria-checked="${i === sel}" aria-selected="${i === sel}">${x}</button>`).join('')}</div></div>`;
  const settings = `<div class="cx-sgroup"><h4>صفحه (۷ تم؛ ۴ تای اول)</h4><div class="cx-minis">${minis}</div></div>
${seg('تم سایت', ['روشن', 'تیره', 'مثل سیستم'], 2)}
${seg('سرعت حرکت', ['خاموش', 'آهسته', 'متوسط', 'سریع'], 2)}
<div class="cx-srow"><span>بلندی صدا</span><div class="cx-vol" style="inline-size:180px">${ic('volume')}<input class="bgv-range" type="range" min="0" max="100" value="70" style="--_p:70%" aria-label="بلندی صدا"></div></div>
${sw('مختصات', true)}${sw('نمایش حرکت‌های مجاز', true)}${sw('پری‌موو', true)}${sw('ارتقای خودکار به وزیر', false)}`;
  list.push(ph(20, 'تنظیمات صفحه', 'از گزینه‌ها', 'متن کنار هر کلید با وضعیت خودش یکی است («روشن» وقتی روشن است). تم سایت، سرعت حرکت مهره (گزینه‌ای که Chess.com هم دارد) و بلندی صدا هم اینجاست.', phone({ sc: m, clocks: { w: ck('3:42', 'run', 'شما'), b: ck('4:05', 'idle', 'نیلوفر') }, over: sheet(settings, { head: 'تنظیمات صفحه', label: 'تنظیمات صفحه' }) })));
  // 21 rematch request (opponent's view)
  const rm = `<div class="cx-offerbar" role="alertdialog" aria-label="درخواست بازی دوباره">${ic('repeat')}<span><b>نیلوفر</b> بازی دوباره می‌خواهد؛ رنگ‌ها جابه‌جا. <b dir="ltr">${fa('0:24')}</b></span>${btn('قبول', 'primary bgv-btn--sm', 'check')}${ibtn('x', 'رد', 'secondary')}</div>`;
  list.push(ph(21, 'درخواست بازی دوباره', 'دید حریف', 'بعد از بستن پنجرهٔ نتیجه، درخواست حریف با شمارش معکوس ۳۰ ثانیه و صدای «اعلان» زیر صفحه می‌آید.', phone({ sc: mt, gb: GB(['بلیتس ۵ دقیقه', 'بازی تمام شد']), clocks: { w: ck('1:12', 'idle', 'شما'), b: ck('0:58', 'idle', 'نیلوفر') }, bo: { overlay: `<button class="cx-resultchip" type="button">${aic('crown', 'cx-aic')}بردید! دیدن نتیجه</button>` }, stat: rm, dk: dock({ items: ['repeat|بازی دوباره', 'search|حریف جدید', 'list|مرور بازی', 'share|اشتراک', 'download|PGN'].map((x) => { const [i, t] = x.split('|'); return `<button type="button">${ic(i)}${t}</button>`; }).join('') }) })));
  // 22 friend invite
  const inv = `<div class="cx-stagecard" style="inline-size:100%"><div class="cx-ring" aria-hidden="true"></div><h3>منتظر دوستتان هستیم…</h3><p>لینک را بفرستید. وقتی دوستتان آن را باز کند، بازی خودش شروع می‌شود.</p><div class="cx-link"><input class="bgv-input" readonly value="boardgameverse.ir/t/K7Q2MX" aria-label="لینک دعوت">${btn('کپی', 'primary', 'copy')}</div><p style="font-size:13px">رپید ۱۰ دقیقه، دوستانه، رنگ تصادفی</p>${btn('لغو دعوت', 'secondary', 'x')}</div>`;
  list.push(ph(22, 'دعوت دوست', 'شروع خودکار', 'بدون مرحلهٔ «آماده‌ام»؛ با ورود دوست بازی شروع می‌شود. ناوبری پایین سایت روی صفحهٔ میز نیست.', `<div class="cx-phone bgv" data-theme="light" dir="rtl">${GB(['شطرنج', 'با دوست'])}<main class="cx-pfelt" style="justify-content:center;padding:16px">${inv}</main></div>`));
  // 23 bot picker
  list.push(ph(23, 'بازی جدید با ربات', 'سطح و رنگ', 'سه سطح با رتبهٔ تقریبی و انتخاب رنگ. چهره‌ها فعلاً حرف اول نام است. نام‌ها و رتبه‌ها نمونه‌اند؛ از bot.ts کالیبره شود.', `<div class="cx-phone bgv" data-theme="light" dir="rtl">${GB(['شطرنج', 'بازی جدید'])}<main class="cx-pfelt" style="justify-content:center;align-items:center;opacity:.5">${felt(S.start, 'w', { w: '', b: '' }, {}, { sm: true })}</main>${sheet(`${tabs('bot')}${botPicker(1)}${colors('random')}<p class="cx-hint">دوستانه، بدون ساعت، بدون اثر روی رتبه.</p>${btn('بازی کن', 'primary bgv-btn--lg cx-cta', 'zap')}`, { head: 'بازی جدید شطرنج', label: 'بازی جدید' })}</div>`));
  return list.map((x) => ({ ...x, html: `<div class="cx-doc" data-page="phone">${x.html}</div>` }));
}
export function phoneBody() { return phoneShots().map((x) => x.html).join(''); }

