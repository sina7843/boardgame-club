// Spec board (actions from the code, the engine prompt protocol, measured geometry drawn on the real art) and the
// Components board (every part numbered like COMPONENTS.md).
const fs = require('fs');
const path = require('path');
const X = require('./an-lib');
const { M, V, IMG, ICONS, MAP_W, MAP_H, hexXY, LEFT_XY, WORKER_XY, PARTNER_XY, UNI_XY, CLIP_X, MB_W, MB_H, appealXY, cpXY, repXY, breakXY,
  FOLDER_X, FOLDER, DECK_XY, DISCARD_XY, BONUS_XY, AB_W, AB_H, TASK_XY, ZOO_XY, UNI_AB, DONATE_XY, SEATS, at, ICON_ORDER, ICON_FILE, ACTIONS } = X;

const CSS = `
.an-spec{padding:28px;display:grid;gap:20px;background:var(--bg);color:var(--text)}
.an-spec h1{margin:0;font-size:26px;font-weight:900;color:var(--heading)}
.an-spec h2{margin:0 0 8px;font-size:18px;font-weight:900;color:var(--heading)}
.an-spec>p{margin:-10px 0 0;font-size:14px;color:var(--text-muted)}
.an-sec{padding:16px;display:grid;gap:10px}
.an-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.an-code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;direction:ltr;unicode-bidi:isolate;background:var(--surface-sunken);padding:1px 5px;border-radius:4px}
.an-dot{position:absolute;transform:translate(-50%,-50%);inline-size:12px;block-size:12px;border-radius:50%;background:#FF2BD6;box-shadow:0 0 0 2px #FFFFFF}
.an-dot--c{background:#00B7FF}.an-dot--y{background:#FFD400}.an-dot--g{background:#22C55E}
.an-dotl{position:absolute;transform:translate(-50%,-140%);font:700 10px/1 ui-monospace,Consolas,monospace;color:#FFFFFF;background:rgba(0,0,0,.7);padding:1px 3px;border-radius:3px;direction:ltr;white-space:nowrap}
.an-comp{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.an-ci{display:grid;gap:4px;justify-items:center;align-content:start;padding:8px;border-radius:var(--radius-sm);background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);font-size:12px;line-height:1.45;text-align:center}
.an-ci img{max-inline-size:100%;max-block-size:110px;inline-size:auto}
.an-ci b{font-size:12.5px;color:var(--heading)}
.an-ci code{font-family:ui-monospace,Consolas,monospace;font-size:11px;direction:ltr;color:var(--text-muted)}
.an-cnum{display:inline-grid;place-items:center;min-inline-size:34px;block-size:22px;padding-inline:5px;border-radius:6px;background:var(--selected);color:var(--on-selected);font-size:12px;font-weight:900}
.an-wide{grid-column:1/-1}
.an-ci .an-cnum{justify-self:center}
.an-ci .an-zoom>img{max-block-size:none;inline-size:300px}
.an-ci .an-panel img,.an-ci .an-ahead img,.an-ci .an-bar img{max-block-size:none}
.an-ci--wide{grid-column:span 2}
.an-ci--wide img{max-block-size:150px}
`;

// ---------------- spec ----------------
function spec(l, P) {
  const d = l.d;
  const actRows = [
    ['animals', 'I: قدرت ۱ هیچ، ۲ تا ۴ یک حیوان، ۵ دو حیوان. فقط از دست.', 'II: قدرت ۱–۲ یک، ۳–۵ دو حیوان؛ از ویترین در محدودهٔ اعتبار هم (+شمارهٔ پوشه پول)؛ قدرت ۵ = ۱ اعتبار در آغاز.', 'animalMax(str, up) → [0,1,1,1,2] / [1,1,2,2,2]'],
    ['build', 'I: یک ساختمان تا اندازهٔ قدرت.', 'II: چند ساختمانِ متفاوت با جمع خانه‌های ≤ قدرت؛ خانهٔ خزندگان و قفس پرندگان؛ خانه‌های علامت‌دار.', 'buildKinds / placements; ۲ پول هر خانه'],
    ['cards', 'I: ۱=۱ بکش ۱ بریز، ۲=۱، ۳=۲/۱، ۴=۲، ۵=۳/۱ یا قاپیدن.', 'II: ۱=۱، ۲=۲/۱، ۳=۲، ۴=۳/۱، ۵=۴/۱؛ هر کارت از دسته یا پوشه در محدوده؛ قاپیدن از ۳.', 'cardsTable(str, up); مسیر استراحت +۲'],
    ['association', 'I: یک کار: ۲ اعتبار (۲)، باغ‌وحش همکار (۳)، دانشگاه (۴)، پروژه (۵).', 'II: چند کار متفاوت با جمع ≤ قدرت؛ پروژه از ویترین؛ یک اهدا پس از یک کار.', 'assocOptions / taskValue / workersNeeded'],
    ['sponsors', 'I: یک حامی از دست با سطح ≤ قدرت.', 'II: چند حامی با جمع سطح ≤ قدرت+۱، از دست یا پوشه (پرداخت شمارهٔ پوشه).', 'sponsorOptions; یا: استراحت +قدرت و پول = قدرت (II: ۲×)']
  ];
  const table = `<table class="an-tbl"><thead><tr><th>${l.t('کارت', 'Card')}</th><th>${l.t('سمت I', 'Side I')}</th><th>${l.t('سمت II', 'Side II')}</th><th>${l.t('در کد', 'In code')}</th></tr></thead><tbody>${actRows.map(([k, a, b, c]) => `<tr><td>${IMG('ui/act-' + k, 'class="an-ic" alt=""')} <b>${l.act(k)}</b></td><td>${d(a)}</td><td>${d(b)}</td><td><span class="an-code">${c}</span></td></tr>`).join('')}</tbody></table>`;
  const proto = [
    ['option', 'گزینه‌ها: دکمهٔ <span class="an-code">.an-opt[data-opt]</span> در <span class="an-code">.an-options</span>؛ گزینه‌های X با <span class="an-code">data-x</span>', 'a:animals:1 · x:build · 486@7@0 · pr:101:0:0:board:0:0 · sp:210:0 · zoo:australia · uni:rep · rep · donate · deck · f3 · s5 · break · tile:mult · up:cards · worker · money'],
    ['pick', 'انتخاب کارت: <span class="an-code">[data-act=pick][data-min]</span> و <span class="an-code">button.an-card</span>، ارسال <span class="an-code">[data-act=submit]</span>', 'دور ریختن، کارت پایانی، استراحت'],
    ['place', 'جای ساختمان: کلیک خانه یا <span class="an-code">select[data-act=placements]</span>، تأیید <span class="an-code">[data-act=place]</span>', '{ kind, cells } از placements موتور'],
    ['skip', 'پرسش اختیاری: <span class="an-code">[data-act=skip]</span> «رد کردن»', 'answer { skip: true }'],
    ['draft', 'انتخاب آغازین: <span class="an-code">[data-act=draft-cards] button.an-card</span> و <span class="an-code">[data-act=draft]</span>', '{ type: draft, keep[4], map? }']
  ];
  const protoT = `<table class="an-tbl"><thead><tr><th>${l.t('پرسش', 'Prompt')}</th><th>${l.t('رابط و هوک تست (همان e2e/ark-nova.spec.ts)', 'UI and test hook')}</th><th>${l.t('مقدار پاسخ', 'Answer value')}</th></tr></thead><tbody>${proto.map(([k, a, b]) => `<tr><td><span class="an-code">${k}</span></td><td>${a}</td><td><span class="an-code">${b}</span></td></tr>`).join('')}</tbody></table>`;
  // map with every hex centre + side slots
  let mapDots = '';
  for (let x = 0; x <= 8; x++) for (let y = x % 2 ? 0 : 1; y <= 12; y += 2) { const c = `${x}_${y}`; const [px, py] = hexXY(c); mapDots += `<span class="an-dot" style="${at(px, py, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, py, MAP_W, MAP_H)}">${c}</span>`; }
  LEFT_XY.forEach(([px, py], i) => { mapDots += `<span class="an-dot an-dot--c" style="${at(px, py, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, py, MAP_W, MAP_H)}">L${i + 1}</span>`; });
  WORKER_XY.forEach(([px, py], i) => { mapDots += `<span class="an-dot an-dot--y" style="${at(px, py, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, py, MAP_W, MAP_H)}">W${i + 1}</span>`; });
  PARTNER_XY.forEach(([px, py], i) => { mapDots += `<span class="an-dot an-dot--g" style="${at(px, py, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, py, MAP_W, MAP_H)}">P${i + 1}</span>`; });
  UNI_XY.forEach(([px, py], i) => { mapDots += `<span class="an-dot an-dot--g" style="${at(px, py, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, py, MAP_W, MAP_H)}">U${i + 1}</span>`; });
  CLIP_X.forEach((px, i) => { mapDots += `<span class="an-dot an-dot--y" style="${at(px, 960, MAP_W, MAP_H)}"></span><span class="an-dotl" style="${at(px, 960, MAP_W, MAP_H)}">A${i + 1}</span>`; });
  const mapImg = `<div class="an-boardimg" style="aspect-ratio:2000/1041">${IMG('boards/map-A', 'class="an-base" alt=""')}${mapDots}</div>`;
  // BGA strips and board (layout measured on the live BGA DOM)
  let rpDots = '';
  for (let r = 1; r <= 15; r++) { const x = X.repX(r) * 100; rpDots += `<span class="an-dot an-dot--c" style="left:${x}%;top:50%"></span><span class="an-dotl" style="left:${x}%;top:50%">r${r}</span>`; }
  const rpImg = `<div class="an-boardimg" style="aspect-ratio:2752/95;overflow:visible">${IMG('bga/reputation-track', 'class="an-base" alt=""')}${rpDots}</div>`;
  let csDots = '';
  for (let c = 0; c <= 10; c++) { const x = X.cpX(c) * 100; csDots += `<span class="an-dot an-dot--g" style="left:${x}%;top:22.5%"></span><span class="an-dotl" style="left:${x}%;top:22.5%">cp${c}</span>`; }
  for (const m of ['5', '8']) X.CP_TILE[m].forEach(([x, y]) => { csDots += `<span class="an-dot an-dot--y" style="left:${x * 100}%;top:${y * 100}%"></span>`; });
  const csImg = `<div class="an-boardimg" style="aspect-ratio:3188/330">${IMG('bga/conservation-track', 'class="an-base" alt=""')}${csDots}</div>`;
  let abDots = '';
  const atb = (x, y) => at(x, y, X.BAB_W, X.BAB_H);
  for (const [k, [px, py]] of Object.entries(X.BAB_TASK)) abDots += `<span class="an-dot an-dot--y" style="${atb(px, py)}"></span><span class="an-dotl" style="${atb(px, py)}">${k}</span>`;
  for (const [k, [px, py]] of [...Object.entries(X.BAB_ZOO), ...Object.entries(X.BAB_UNI)]) abDots += `<span class="an-dot an-dot--g" style="${atb(px, py)}"></span><span class="an-dotl" style="${atb(px, py)}">${k}</span>`;
  X.BAB_DONATE.forEach(([px, py], i) => { abDots += `<span class="an-dot an-dot--c" style="${atb(px, py)}"></span><span class="an-dotl" style="${atb(px, py)}">d${i + 1}</span>`; });
  const abImg = `<div class="an-boardimg" style="aspect-ratio:3335/986">${IMG('bga/association-board', 'class="an-base" alt=""')}${abDots}</div>`;
  return `<div class="an-spec" dir="rtl"><h1>${l.t('آرک نوا: کنش‌ها، پروتکل موتور و اندازه‌گیری', 'Ark Nova: actions, engine protocol and geometry')}</h1><p>${l.t('از games/ark-nova/src (flow.ts, core.ts, rules.ts, hex.ts). نقطه‌ها = مختصات layout.json روی تصویر واقعی.', 'From the code; dots = layout.json on the real art.')}</p>
  <section class="bgv-card an-sec"><h2>${l.t('۵ کارت کنش', '5 action cards')}</h2>${table}<p class="an-note">${l.t('قدرت = شمارهٔ خانه (۱ تا ۵) + نشان X خرج‌شده − ۲ برای هر نشان فشار. بعد از کنش، کارت به خانهٔ ۱ می‌رود. «کنش نشان X»: کارت به خانهٔ ۱ و +۱ نشان X (حداکثر ۵؛ هر دوبرابرکنندهٔ روی کارت +۱). کنشی که هیچ کاری نکند مجاز نیست (canDo) و دکمه‌اش با دلیل غیرفعال است.', '')}</p></section>
  <section class="bgv-card an-sec"><h2>${l.t('پروتکل پرسش‌ها (هر تصمیم = پاسخ به سر صف state.queue)', 'Prompt protocol')}</h2>${protoT}<p class="an-note">${l.t('برچسب‌های موتور رقم لاتین دارند («۴ پول» به‌صورت 4)؛ رندرر آن‌ها را با fa() فارسی می‌کند. پیام خطا فقط ترجمهٔ کد خطای موتور است: CONDITIONS، CANNOT_AFFORD، NO_ENCLOSURE، ANIMAL_FORBIDDEN، NO_ROOM.', '')}</p></section>
  <section class="bgv-card an-sec"><h2>${l.t('نقشهٔ باغ‌وحش (همهٔ ۱۰ نقشه یک شبکه دارند)', 'Zoo map grid (same for all 10 maps)')}</h2><p class="an-note">${l.t('مرکز خانهٔ x_y = (۳۲۷ + ۱۰۰٫۶x ، ۱۳۲٫۳ + ۵۷٫۷۵y) در تصویر ۲۰۰۰×۱۰۴۱؛ R = ۶۶٫۹. با tools/check-maps.py روی آب، صخره، پاداش و خانه‌های ساخت II هر ۱۰ نقشه چک شد. ساختمان‌ها = تصویر ناشر با چرخش k×۳۰° که خانه‌هایش روی خانه‌های موتور بنشیند (building-cells.json). L = نشان‌های لبه، W = کارمندان، P/U = باغ‌وحش همکار/دانشگاه، A = گیرهٔ کارت کنش.', '')}</p>${mapImg}</section>
  <section class="bgv-card an-sec"><h2>${l.t('چیدمان BGA: مسیر اعتبار، مسیر حفاظت، بورد انجمن', 'BGA layout: reputation, conservation, association')}</h2><p class="an-note">${l.t('مثل جدول BGA (اندازه‌گیری روی DOM یک میز زندهٔ BGA، ۲۰۲۶-۱۰-۳۰): ویترین ۶ پوشه با کارت بزرگ، زیرش نوار اعتبار؛ بعد نوار حفاظت (۰ تا ۱۰؛ بالای ۱۰ عدد روی شمارنده)، پروژه‌های بازی‌شده بالای بورد انجمن و پروژه‌های پایه زیر آن (فقط نوار پایین کارت با سطح‌ها)؛ هر بار فقط یک باغ‌وحش (چشمِ پنل). مسیر جذابیت در BGA روی صفحه نیست: دکمهٔ «بورد امتیاز» بورد اصلی را در پنجره نشان می‌دهد. نقشه بدون متن قوانین و راهنمای ساختمان بریده می‌شود (۱۴۰۵×۹۰۵) و نوار گیره‌ها (y ۹۰۵ تا ۱۰۴۱) نوار کارت‌های کنش است. نقطه‌ها = layout.json.', '')}</p>${rpImg}${csImg}${abImg}</section>
 </div>`;
}

// ---------------- components ----------------
function components(l, P) {
  const ART = path.join(__dirname, '..', 'art');
  const ls = (dir) => fs.readdirSync(path.join(ART, dir)).filter((f) => f.endsWith('.webp')).map((f) => dir + '/' + f.slice(0, -5));
  const ci = (n, img, title, file, wide = false) => `<div class="an-ci${wide ? ' an-ci--wide' : ''}"><span class="an-cnum">15.${n}</span>${img}<b>${title}</b><code>${file}</code></div>`;
  const imgs = (n, files, title = (f) => f.split('/').pop()) => files.map((f, i) => ci(`${n}.${i + 1}`, IMG(f, 'alt=""'), title(f), 'art/' + f + '.webp')).join('');
  const sec = (n, title, body, note = '') => `<section class="bgv-card an-sec"><h2>§15.${n} ${title}</h2>${note ? `<p class="an-note">${note}</p>` : ''}<div class="an-comp">${body}</div></section>`;
  const live = (n, html, title) => `<div class="an-ci an-wide" style="justify-items:stretch;text-align:start"><span class="an-cnum">15.${n}</span>${html}<b>${title}</b></div>`;
  return `<div class="an-spec" dir="rtl"><h1>${l.t('آرک نوا: همهٔ کامپوننت‌ها (COMPONENTS.md §۱۵)', 'Ark Nova: every component')}</h1><p>${l.t('فقط هنر ناشر (ready to use - flat) و آیکون‌های BGA؛ هیچ قطعه‌ای کشیده نشده. رنگ صندلی‌ها: قرمز، آبی، زرد، مشکی.', '')}</p>
  ${sec(1, l.t('قاب میز و پنل‌ها', 'Table frame and panels'), live('1.1', `<div style="max-inline-size:360px">${P.panel(l, 0)}</div>`, l.t('پنل بازیکن در ریل (BGA): امتیاز، پول، جذابیت، حفاظت، اعتبار، X، دست، کارمند، هدف، نمادها', 'Rail panel')) + live('1.2', P.actionBar(l), l.t('نوار کنش (چسبان بالای ستون)', 'Action bar')) + live('1.3', `<div class="bgv-felt" style="padding:8px">${P.areaHead(l, 1)}</div>`, l.t('سربرگ باغ‌وحش', 'Zoo header')) + live('1.4', P.zoomCard(l, 486), l.t('بزرگ‌نمایی کارت با متن فارسی (textFa کد)', 'Card zoom')))}
  ${sec(2, l.t('بوردها و ۱۰ نقشه', 'Boards and 10 maps'), ci('2.1', IMG('boards/main-board', 'alt=""'), l.t('بورد اصلی (فقط در پنجرهٔ «بورد امتیاز»)', 'Main board (score-board dialog only)'), 'art/boards/main-board.webp', true) + ci('2.1b', IMG('bga/reputation-track', 'alt=""'), l.t('نوار اعتبار (BGA)', 'Reputation strip (BGA)'), 'art/bga/reputation-track.webp', true) + ci('2.1c', IMG('bga/conservation-track', 'alt=""'), l.t('نوار حفاظت (BGA)', 'Conservation strip (BGA)'), 'art/bga/conservation-track.webp', true) + ci('2.2b', IMG('bga/association-board', 'alt=""'), l.t('بورد انجمن BGA (روی میز)', 'BGA association board (on the table)'), 'art/bga/association-board.webp', true) + ci('2.2', IMG('boards/association-board', 'alt=""'), l.t('بورد انجمن', 'Association board'), 'art/boards/association-board.webp', true) + imgs(2.3, ls('boards').filter((f) => f.includes('map-')), (f) => { const id = f.split('map-')[1]; return `${l.t('نقشهٔ', 'Map')} ${l.d(id)}: ${M.maps[id].nameFa}`; }))}
  ${sec(3, l.t('ساختمان‌ها', 'Buildings'), imgs(3.1, ls('enclosures'), (f) => f.split('/').pop().replace('enclosure-', l.t('محوطهٔ ', 'enclosure ')).replace('-empty', l.t(' خالی', ' empty')).replace('-occupied', l.t(' پر', ' occupied'))) + imgs(3.2, ls('special-buildings')) + imgs(3.3, ls('unique-buildings')), l.t('روی نقشه با چرخش k×۳۰° (و قرینه) روی خانه‌های موتور می‌نشینند؛ پر/خالی = Building.full.', ''))}
  ${sec(4, l.t('کارت‌های کنش', 'Action cards'), imgs(4.1, ls('cards-action')))}
  ${sec(5, l.t('قطعه‌های چوبی، نشان‌ها، پول', 'Wooden pieces, tokens, money'), imgs(5.1, ls('pieces')) + imgs(5.2, ['wooden-pieces/break-token']) + imgs(5.3, ls('tokens')) + imgs(5.4, ls('money')), l.t('مکعب = نشان لبهٔ نقشه، حمایت پروژه؛ شمارنده = جذابیت، حفاظت، اعتبار؛ کارمند = انجمن. ۴ رنگ از تصویر ۴رنگ ناشر بریده شده (pack-art.py).', ''))}
  ${sec(6, l.t('آیکون‌ها', 'Icons'), imgs(6.1, ICON_ORDER.map((i) => 'icons/' + ICON_FILE[i]), (f) => l.icon(ICON_ORDER.find((i) => f.endsWith(ICON_FILE[i])))) + imgs(6.2, ls('ui')), l.t('۶.۲ از sprite محلی BGA (img__icons.png) با cut-bga-icons.py؛ دانلود تازه نشده.', ''))}
  ${sec(7, l.t('کارت‌ها (یکی از هر نوع) و پشت‌ها', 'Cards (one of each) and backs'), ci('7.1', IMG('cards-animal/card-486', 'alt=""'), l.t('حیوان ×۱۲۸', 'Animal ×128'), 'art/cards-animal/') + ci('7.2', IMG('cards-sponsor/card-210', 'alt=""'), l.t('حامی ×۶۴', 'Sponsor ×64'), 'art/cards-sponsor/') + ci('7.3', IMG('cards-base-project/card-101', 'alt=""'), l.t('پروژهٔ پایه ×۱۲', 'Base project ×12'), 'art/cards-base-project/') + ci('7.4', IMG('cards-conservation/card-127', 'alt=""'), l.t('پروژهٔ حفاظت ×۲۰', 'Conservation ×20'), 'art/cards-conservation/') + ci('7.5', IMG('cards-final-scoring/card-007', 'alt=""'), l.t('امتیاز پایانی ×۱۱', 'Final scoring ×11'), 'art/cards-final-scoring/') + imgs(7.6, ls('card-backs')))}
  ${sec(8, l.t('کاشی‌ها', 'Tiles'), imgs(8.1, ls('bonus-tiles')) + imgs(8.2, ls('partner-zoos')) + imgs(8.3, ls('universities')) + imgs(8.4, ['solo/solo-tile', 'reference-pages/unique-buildings-reference']), l.t('باغ‌وحش همکار ۱۹۱×۱۵۷ و دانشگاه ۱۴۵×۱۱۶ کم‌وضوح‌اند (تا حدود ۷۰px خوب). سولو در موتور نیست.', ''))}
 </div>`;
}

module.exports = { CSS, spec, components };
