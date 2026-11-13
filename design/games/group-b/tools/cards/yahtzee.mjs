// Yahtzee / یاتزی on the shared table frame (group B). Rules as the repo engine: up to 3 rolls of 5 dice, keep any after
// the first, then write the dice into one empty box of 13 (0 if they don't fit); upper ≥ 63 → +35; 3/4 of a kind sum,
// full house 25, small straight 30, large 40, Yahtzee 50, chance sum; extra Yahtzee +100 with the joker rule.
// Mock (4 players, round 9, 8 boxes filled each; you play first): first roll gave 6 6 1 3 4, you hold the two sixes,
// 2 rolls left. Upper so far 32 → you need 31 more from fours + sixes for the bonus.
// Totals: you 32 + 100 = 132 · Reza 39 + 125 = 164 · Sara 57 + 87 = 144 · Niloufar 35 + 43 = 78.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const CATS = [
    ['ones', 'یک‌ها', 'جمع ۱ها'], ['twos', 'دوها', 'جمع ۲ها'], ['threes', 'سه‌ها', 'جمع ۳ها'], ['fours', 'چهارها', 'جمع ۴ها'], ['fives', 'پنج‌ها', 'جمع ۵ها'], ['sixes', 'شش‌ها', 'جمع ۶ها'],
    ['threeKind', 'سه‌تایی', '۳ یکسان: جمع'], ['fourKind', 'چهارتایی', '۴ یکسان: جمع'], ['fullHouse', 'فول‌هاوس', '۳+۲: ۲۵'], ['smallStraight', 'ردیف کوچک', '۴ پشت سر هم: ۳۰'], ['largeStraight', 'ردیف بزرگ', '۵ پشت سر هم: ۴۰'], ['yahtzee', 'یاتزی', '۵ یکسان: ۵۰'], ['chance', 'شانس', 'جمع تاس‌ها'],
  ];
  const sheets = [
    { ones: 2, twos: 6, threes: 9, fives: 15, threeKind: 22, fullHouse: 25, smallStraight: 30, chance: 23 },
    { ones: 3, threes: 6, fours: 12, sixes: 18, threeKind: 26, smallStraight: 30, yahtzee: 50, chance: 19 },
    { twos: 4, threes: 9, fives: 20, sixes: 24, fourKind: 0, fullHouse: 25, largeStraight: 40, chance: 22 },
    { ones: 1, twos: 8, fours: 16, fives: 10, threeKind: 18, fullHouse: 25, smallStraight: 0, yahtzee: 0 },
  ];
  const who = [['شما', 1], ['رضا', 6], ['سارا', 4], ['نیلوفر', 2]];
  // possible scores for 6 6 1 3 4 in your open boxes
  const opts = { fours: 4, sixes: 12, fourKind: 0, largeStraight: 0, yahtzee: 0 };
  const best = 'sixes';
  const upper = (s) => ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].reduce((a, k) => a + (s[k] ?? 0), 0);
  const lower = (s) => ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'].reduce((a, k) => a + (s[k] ?? 0), 0);
  const cell = (s, k, p) => {
    if (s[k] !== undefined) return `<td${s[k] === 0 ? ' class="is-zero"' : ''}>${fa(s[k])}</td>`;
    if (p === 0) return `<td class="yz-opt${k === best ? ' is-best' : ''}${opts[k] === 0 ? ' is-nil' : ''}"><button type="button" aria-label="${fa(opts[k])} امتیاز">${fa(opts[k])}</button></td>`;
    return '<td class="is-open">–</td>';
  };
  const head = (ph) => `<tr class="yz-h"><th scope="col">${ph ? 'خانه' : ''}</th>${who.map(([n, s], p) => `<th scope="col" class="${p === 0 ? 'is-me' : ''}"><i style="background:var(--seat-${s})"></i>${n}</th>`).join('')}</tr>`;
  const row = ([k, l, sub], ph) => `<tr><th scope="row"><b>${l}</b>${ph ? '' : `<small>${sub}</small>`}</th>${sheets.map((s, p) => cell(s, k, p)).join('')}</tr>`;
  const sec = (t) => `<tr class="yz-sec"><th colspan="5">${t}</th></tr>`;
  const upRows = (ph) => CATS.slice(0, 6).map((c) => row(c, ph)).join('') + `<tr class="yz-sum"><th scope="row">جمع بالا</th>${sheets.map((s) => `<td>${fa(upper(s))}${ph ? '' : `<small>/${fa(63)}</small>`}</td>`).join('')}</tr>` + (ph ? '' : `<tr class="yz-sum"><th scope="row">پاداش بالا (۳۵)</th>${sheets.map(() => '<td>…</td>').join('')}</tr>`);
  const loRows = (ph) => CATS.slice(6).map((c) => row(c, ph)).join('') + (ph ? '' : `<tr class="yz-sum"><th scope="row">پاداش یاتزی</th>${sheets.map(() => '<td>۰</td>').join('')}</tr>`);
  const total = `<tr class="yz-tot"><th scope="row">امتیاز کل</th>${sheets.map((s, p) => `<td${p === 1 ? ' class="is-lead"' : ''}>${fa(upper(s) + lower(s))}</td>`).join('')}</tr>`;
  const sheet = (ph) => ph
    ? `<table class="yz-sheet yz-sheet--ph" aria-label="جدول امتیاز">${head(true)}${sec('بخش بالا')}${upRows(true)}${sec('بخش پایین')}${loRows(true)}${total}</table>`
    : `<div class="yz-sheets"><table class="yz-sheet" aria-label="جدول امتیاز، بخش بالا">${head()}${sec('بخش بالا')}${upRows()}</table><table class="yz-sheet" aria-label="جدول امتیاز، بخش پایین">${head()}${sec('بخش پایین')}${loRows()}${total}</table></div>`;
  const dice = [[6, true], [6, true], [1], [3], [4]];
  const die = ([v, held]) => `<span class="yz-die${held ? ' is-held' : ''}">${img(`yahtzee-die-${v}`, `تاس ${fa(v)}${held ? '، نگه داشته' : ''}`)}${held ? '<small>نگه‌داشته</small>' : ''}</span>`;
  const tray = (ph) => `<div class="yz-tray${ph ? ' yz-tray--ph' : ''}">${img('yahtzee-tray', '')}<span class="yz-dice" role="group" aria-label="تاس‌ها؛ برای نگه داشتن بزنید">${dice.map(die).join('')}</span></div>`;
  const rollsLeft = `<span class="yz-left" aria-label="۲ پرتاب مانده"><i class="is-used"></i><i></i><i></i></span>`;
  const above = (ph) => `<div class="yz-ctl${ph ? ' yz-ctl--ph' : ''}">${tray(ph)}<div class="yz-btns">${rollsLeft}${btn(`دوباره بریز (${fa(2)} از ${fa(3)})`, 'primary', 'repeat')}${ph ? '' : btn('ثبت در جدول', 'secondary', 'check', ' disabled')}</div></div>`;
  const { modal } = H;
  const withSheet = (s0, o, fn) => (ph) => { const keep = sheets[0], ko = { ...opts }; sheets[0] = s0; for (const k in opts) delete opts[k]; Object.assign(opts, o); let out = fn(ph); sheets[0] = keep; for (const k in opts) delete opts[k]; Object.assign(opts, ko);
    return out.replace(`<td class="yz-opt"><button type="button" aria-label="${fa(25)} امتیاز">`, `<td class="yz-opt is-best"><button type="button" aria-label="${fa(25)} امتیاز">`); };
  const ME_J = { ones: 2, twos: 6, threes: 9, fours: 12, sixes: 18, threeKind: 22, fullHouse: 25, smallStraight: 30, yahtzee: 50, chance: 23 };
  const jokerTray = (ph) => `<div class="yz-ctl${ph ? ' yz-ctl--ph' : ''}"><div class="yz-tray${ph ? ' yz-tray--ph' : ''}">${img('yahtzee-tray', '')}<span class="yz-dice">${[5, 5, 5, 5, 5].map((v) => `<span class="yz-die is-held">${img(`yahtzee-die-${v}`, `تاس ${fa(v)}`)}</span>`).join('')}</span></div><div class="yz-btns"><span class="yz-bonus">یاتزی اضافه: ${fa(100)}+</span>${ph ? '' : btn('ثبت در «پنج‌ها»', 'primary', 'check')}</div></div>`;
  const joker = (ph) => modal('یاتزی دوم! ۱۰۰ امتیاز پاداش', `<p>پنج تا ۵ آوردید و خانهٔ «یاتزی» شما پیش‌تر ${fa(50)} گرفته؛ پس <b>${fa(100)} امتیاز پاداش</b> می‌گیرید و این تاس‌ها جوکرند.</p><ul class="yz-why"><li class="is-ok">${ic('check')}<span><b>پنج‌ها: ${fa(25)}</b> خانهٔ بالای همین عدد خالی است، پس <b>باید</b> همین‌جا بنویسید.</span></li><li>${ic('x')}<span><b>چهارتایی، ردیف بزرگ:</b> فقط وقتی باز می‌شوند که «پنج‌ها» پر باشد (با امتیاز کامل: ردیف بزرگ ${fa(40)}).</span></li></ul>`, `${btn('ثبت ۲۵ در پنج‌ها', 'primary', 'check')}`);
  const tblY = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((h, k) => `<th${k ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((cc, k) => `<td${k ? ' class="n"' : ''}>${cc}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ending = (ph) => modal('پایان بازی: ۱۳ دور', `${tblY(['رتبه', 'بازیکن', 'بالا', 'پاداش بالا', 'پایین', 'پاداش یاتزی', 'جمع'], [
      { c: [fa(1), 'شما', fa(72), fa(35), fa(200), fa(100), fa(407)], win: true },
      { c: [fa(2), 'رضا', fa(66), fa(35), fa(214), fa(0), fa(315)] },
      { c: [fa(3), 'سارا', fa(70), fa(35), fa(167), fa(0), fa(272)] },
      { c: [fa(4), 'نیلوفر', fa(54), fa(0), fa(118), fa(0), fa(172)] },
    ])}<p class="cx-note">پاداش بالا با جمع بالای ${fa(63)} یا بیشتر (${fa(35)} امتیاز). امتیاز برابر یعنی رتبهٔ مشترک.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'Yahtzee', fa: 'یاتزی', latin: 'Yahtzee', meta: ['زنده', '۴ نفر', 'دور ۹ از ۱۳'],
    opps: [
      { name: 'رضا', av: 'ر', seat: 6, clock: '1:00', meta: `<span class="yz-m">امتیاز <b>${fa(164)}</b></span><span class="gc-tag gc-tag--soft">اول</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '1:00', meta: `<span class="yz-m">امتیاز <b>${fa(144)}</b></span>` },
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:00', meta: `<span class="yz-m">امتیاز <b>${fa(78)}</b></span>` },
    ],
    me: { cards: [], clock: '0:47', turn: true, note: `<span class="yz-m yz-m--me">امتیاز <b>${fa(132)}</b><span class="bgv-sep"></span>پرتاب ${fa(1)} از ${fa(3)}</span>`, above },
    table: (ph) => sheet(ph),
    status: '<b>نوبت شماست؛ پرتاب اول.</b> دو ششِ نگه‌داشته را نگه دارید و بقیه را دوباره بریزید (۲ بار مانده)، یا همین حالا یک خانه را پر کنید. عددهای طلایی امتیاز همین تاس‌ها در خانه‌های خالی شماست.',
    pstatus: '<b>نوبت شما.</b> نگه دارید و دوباره بریزید یا یک خانه را پر کنید.',
    railCard: `<section class="cx-card"><h3>پاداش بخش بالا</h3><div class="gc-pills"><span class="bgv-chip">جمع بالا: ${fa(32)} از ${fa(63)}</span><span class="bgv-chip">${fa(31)} تا پاداش</span></div><div class="ga-rule">${ic('info')}<span>بعد از هر پرتاب تاس‌هایی را که می‌خواهید بزنید تا بمانند؛ نوبت با پر کردن یک خانه تمام می‌شود. اگر تاس‌ها به خانه‌ای نخورند، صفر می‌گیرد. جمع بالای ۶۳ یعنی ۳۵ امتیاز پاداش.</span></div></section>`,
    logNote: 'دور ۸',
    log: [[1, 'شما در «ردیف کوچک» ۳۰ نوشتید'], [6, 'رضا در «یاتزی» ۵۰ نوشت'], [4, 'سارا در «چهارتایی» ۰ نوشت'], [2, 'نیلوفر در «یاتزی» ۰ نوشت'], [1, 'دور ۹: شما ۶، ۶، ۱، ۳ و ۴ آوردید و دو شش را نگه داشتید']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['check', 'ثبت'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'یاتزی اضافه و جوکر', turnSub: '+۱۰۰ و خانه‌های مجاز با دلیل', meta: ['زنده', '۴ نفر', 'دور ۱۱ از ۱۳'],
        table: withSheet(ME_J, { fives: 25, fourKind: 0, largeStraight: 0 }, sheet), overlay: joker,
        me: { above: jokerTray, note: `<span class="yz-m yz-m--me">امتیاز <b>${fa(297)}</b></span>` },
        status: '<b>یاتزی دوم!</b> ۱۰۰ امتیاز پاداش گرفتید. چون «پنج‌ها» خالی است باید ۲۵ را آنجا بنویسید؛ بقیهٔ خانه‌ها با دلیل خاموش‌اند.',
        pstatus: '<b>یاتزی دوم:</b> ۱۰۰+؛ ثبت در پنج‌ها.',
        log: [[2, 'نیلوفر در «شانس» ۲۱ نوشت'], [1, 'شما پنج تا ۵ آوردید: یاتزی دوم']],
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جمع بخش‌ها، پاداش‌ها و رتبه', overlay: ending, meta: ['تمام شد', '۴ نفر', 'دور ۱۳ از ۱۳'],
        table: withSheet(ME_J, {}, sheet),
        me: { turn: false, clock: '', above: () => '', note: `<span class="yz-m yz-m--me">امتیاز <b>${fa(407)}</b></span>` }, railCard: '',
        status: '<b>بازی تمام شد.</b> شما با ۴۰۷ امتیاز بردید.',
        log: [[2, 'نیلوفر آخرین خانه را پر کرد'], [1, 'شما بردید']],
      },
    ],    css: `.yz-m{display:inline-flex;gap:4px;white-space:nowrap}.yz-m b{color:var(--felt-ink)}.cx-pbar .yz-m b{color:inherit}
.yz-sheets{display:grid;grid-template-columns:1fr 1fr;gap:12px;inline-size:100%;align-items:start}
.yz-sheet{inline-size:100%;border-collapse:collapse;background:#F7EED9;color:#2B1D12;border-radius:10px;overflow:hidden;box-shadow:0 0 0 3px #7A1F1A,0 14px 24px -12px rgba(0,0,0,.7);font-size:14.5px;table-layout:fixed}
.yz-sheet th,.yz-sheet td{padding:0 6px;block-size:34px;border-block-end:1px solid rgba(43,29,18,.13);text-align:center;font-variant-numeric:normal}
.yz-sheet tr>*:first-child{text-align:start;inline-size:34%}
.yz-sheet th[scope=row]{font-weight:400;line-height:1.15}.yz-sheet th[scope=row] b{display:block;font-size:14px;font-weight:700}.yz-sheet th[scope=row] small{display:block;font-size:10.5px;color:#7A6552}
.yz-h th{background:#8E241D;color:#FBEFD9;font-size:13px;font-weight:700;block-size:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.yz-h th i{display:inline-block;inline-size:7px;block-size:7px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}
.yz-h th.is-me{background:#B8862E;color:#2B1D12}
.yz-sec th{background:#2B1D12;color:#F7EED9;font-size:11.5px;font-weight:700;block-size:20px;text-align:start}
.yz-sheet td:nth-child(2){background:rgba(232,166,66,.16)}
.yz-sheet td.is-open{color:#B4A38E}.yz-sheet td.is-zero{color:#9A8670}
.yz-opt button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-grid;place-items:center;min-inline-size:40px;block-size:25px;border-radius:6px;border:1.5px dashed #B8862E;color:#8A5A12;font-weight:800;background:#FFF7E6}
.yz-opt.is-nil button{border-color:#C9B8A0;color:#9A8670;font-weight:600}
.yz-opt.is-best button{background:#E8A642;border:2px solid #2B1D12;color:#2B1D12}
.yz-sum th,.yz-sum td{background:rgba(43,29,18,.06);font-size:13px;font-weight:700;block-size:30px}.yz-sum small{font-size:10px;color:#9A8670;font-weight:400}
.yz-tot th,.yz-tot td{background:#EBD9B4;font-size:16px;font-weight:800;block-size:38px;border:0}.yz-tot td.is-lead{color:#7A1F1A}
.yz-bonus{padding:4px 12px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-weight:800;font-size:13px;white-space:nowrap}
.yz-why{list-style:none;margin:0;padding:0;display:grid;gap:8px}.yz-why li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.7}.yz-why li .bgv-icon{flex:none;margin-block-start:4px;color:#C8553D}.yz-why li.is-ok .bgv-icon{color:#2E8B57}.yz-ctl{display:flex;align-items:center;gap:14px;inline-size:100%}
.yz-tray{position:relative;flex:1;min-inline-size:0}.yz-tray>img{display:block;inline-size:100%;block-size:auto;border-radius:8px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.yz-dice{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:4%;direction:ltr}
.yz-die{position:relative;inline-size:11%;display:grid;justify-items:center}
.yz-die img{display:block;inline-size:100%;block-size:auto;border-radius:12%;box-shadow:0 3px 5px rgba(0,0,0,.45)}
.yz-die.is-held img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 4px 6px rgba(0,0,0,.5);transform:translateY(-6px)}
.yz-die small{position:absolute;inset-block-start:calc(100% - 2px);font-size:10.5px;font-weight:700;color:#FAF5EC;background:#142B3B;border-radius:999px;padding:0 6px;white-space:nowrap}
.yz-btns{display:grid;gap:8px;justify-items:stretch;flex:none}.yz-btns .bgv-btn{white-space:nowrap}
.yz-left{display:flex;gap:6px;justify-content:center}.yz-left i{inline-size:10px;block-size:10px;border-radius:50%;background:var(--felt-gold)}.yz-left i.is-used{background:rgba(250,245,236,.25)}
.yz-sheet--ph{inline-size:calc(100% - 20px);margin-inline:10px;font-size:12px;box-shadow:0 0 0 2px #7A1F1A}
.yz-sheet--ph th,.yz-sheet--ph td{block-size:19px;padding:0 3px}.yz-sheet--ph th[scope=row] b{font-size:11.5px}.yz-sheet--ph .yz-h th{font-size:11px;block-size:22px}.yz-sheet--ph .yz-h th i{display:none}
.yz-sheet--ph .yz-sec th{block-size:16px;font-size:10px}.yz-sheet--ph .yz-opt button{min-inline-size:28px;block-size:17px;font-size:11px}.yz-sheet--ph .yz-tot th,.yz-sheet--ph .yz-tot td{block-size:24px;font-size:12.5px}
.yz-ctl--ph{margin-inline:10px;inline-size:auto;gap:8px}.yz-ctl--ph .yz-btns{gap:4px}.yz-ctl--ph .yz-btns .bgv-btn{font-size:12.5px;padding-inline:10px;min-block-size:36px}.yz-ctl--ph .yz-die small{display:none}.yz-ctl--ph .yz-die.is-held img{box-shadow:0 0 0 2px #FAF5EC,0 0 0 4px var(--felt-gold)}`,
    shotTitle: 'نوبت شما', turnSub: 'نگه داشتن و پرتاب دوباره',
    diffs: [
      ['جدول به جای صفحه', 'صفحه ندارد؛ وسط میز جدول امتیاز همهٔ بازیکن‌ها در دو نیمه (بالا و پایین) کنار هم تا هر ۱۳ خانه بی‌اسکرول دیده شود. جدول با HTML ساخته شده چون برگهٔ آماده خالی و ثابت است'],
      ['امتیاز ممکن', 'در خانه‌های خالی ستون شما امتیاز همین تاس‌ها به شکل دکمهٔ خط‌چین؛ بهترین گزینه طلایی است و صفرها کم‌رنگ. ستون حریف‌ها فقط عدد ثبت‌شده یا خط تیره'],
      ['تاس‌ها', 'تاس‌های آماده روی سینی آماده بالای نوار شما؛ تاس نگه‌داشته بالا آمده، حلقهٔ طلایی و برچسب «نگه‌داشته» دارد. نشان ضربدر قرمز بستهٔ آماده استفاده نشد چون معنی‌اش با «نگه داشتن» جور نیست'],
      ['پرتاب‌ها', 'سه نقطه کنار دکمه نشان می‌دهد چند پرتاب مانده؛ «ثبت در جدول» تا انتخاب خانه خاموش است'],
      ['چیپ حریف‌ها', 'به جای تعداد کارت: امتیاز کل و برچسب نفر اول'],
      ['قوانین', 'مثل موتور: ۲ تا ۶ نفر، ۱۳ دور، پاداش ۳۵ برای جمع بالای ۶۳، یاتزی اضافه ۱۰۰ با قانون جوکر'],
    ],
  };
}
