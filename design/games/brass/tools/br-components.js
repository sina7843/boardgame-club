// TM-style components sheet: every part of the Brass table, numbered exactly like COMPONENTS.md, with the real art and
// the class / hook each one becomes in the renderer.
const { G, M, COLORS, ROMAN, IMG, ICONS, cardArt, tileArt } = require('./br-lib');
const P = require('./br-parts');
const MB = require('./br-mobile');
const { ME, H } = P;

const CSS = `
.br-comp{padding:32px;display:grid;gap:22px;background:var(--surface-sunken);color:var(--text)}
.br-comp h1{margin:0;font-size:28px;font-weight:900;color:var(--heading)}
.br-comp>p{margin:0;max-inline-size:1000px;font-size:15px;line-height:1.8}
.br-csec{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;padding:18px;border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-card)}
.br-csec>header{display:grid;gap:6px;align-content:start}
.br-csec h2{margin:0;display:flex;align-items:center;gap:8px;font-size:17px;font-weight:900;color:var(--heading)}
.br-csec h2 span{display:inline-grid;place-items:center;min-inline-size:30px;block-size:30px;padding-inline:4px;border-radius:8px;background:var(--selected);color:var(--on-selected);font-size:14px}
.br-csec header p{margin:0;font-size:13px;line-height:1.7;color:var(--text-muted)}
.br-csec code{font-family:var(--font-mono,monospace);font-size:11.5px;direction:ltr;unicode-bidi:isolate;padding:0 4px;border-radius:4px;background:var(--surface-sunken);color:var(--heading)}
.br-cbody{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;min-inline-size:0}
.br-cbody figure{margin:0;display:grid;justify-items:center;gap:4px;font-size:11.5px;color:var(--text-muted);text-align:center}
.br-cbody figure img{display:block}
.br-cfelt{padding:12px;border-radius:var(--radius-md)}
.br-geo{inline-size:100%;border-collapse:collapse;font-size:12.5px}
.br-geo th,.br-geo td{padding:4px 8px;border-block-end:1px solid var(--line);text-align:start;vertical-align:top}
.br-geo th{color:var(--label);font-weight:900}
.br-geo td code{white-space:nowrap}
`;

function sec(n, l, fa, en, noteFa, noteEn, body) {
  return `<section class="br-csec" id="c${n}"><header><h2><span>${l.d(n)}</span>${l.t(fa, en)}</h2><p>${l.t(noteFa, noteEn)}</p></header><div class="br-cbody">${body}</div></section>`;
}
const fig = (img, cap, w) => `<figure>${img.replace('<img ', `<img style="inline-size:${w}px" `)}<span>${cap}</span></figure>`;

function components(l) {
  const S = M.main, s = S.state;
  const pick = H(S, 'build').find((h) => h.loc === 'birmingham' && h.slot === 3);
  const sales = H(S, 'sell');
  const crop = (x, y, w, opts) => `<div style="position:relative;inline-size:420px;block-size:280px;overflow:hidden;border-radius:10px">${P.board(l, S, opts).replace('<div class="br-board br__map"', `<div class="br-board br__map" style="position:absolute;inline-size:${w}px;left:${-x * w / 1000}px;top:${-y * w / 1000}px"`)}</div>`;
  const rows = [
    ['SLOTS', l.t('مرکز ۶۰ خانهٔ ساخت (۲۰ شهر + ۲ آبجوسازی)، ضلع ۴۶٫۲۵', 'centre of the 60 build spaces (20 towns + 2 farms), side 46.25'), 'find-slots2.py'],
    ['LINKS', l.t('مرکز و زاویهٔ ۳۹ خط؛ کاشی ۵۲ × ۲۲', 'centre and angle of the 39 lines; tile 52 × 22'), 'strip.py + overlay.py'],
    ['MERCHANTS', l.t('خانه‌های تاجر، جای بشکه و پاداش', 'merchant spaces, barrel spots, bonus'), 'strip.py'],
    ['ROW_Y / COAL_X / IRON_X', l.t('بازار: ردیف قیمت ۱ تا ۸، دو ستون', 'markets: price rows 1–8, two columns'), 'strip.py'],
    ['TRACK', l.t('۱۰۰ خانهٔ مسیر پیشرفت (امتیاز و درآمد)', 'the 100 progress-track spaces (VP and income)'), 'strip.py'],
    ['ORDER / FRAMES', l.t('۴ بشکهٔ ترتیب نوبت؛ ۳ قاب کارت', '4 turn-order barrels; 3 card frames'), 'strip.py'],
    ['MAT', l.t('۲۹ قاب سطح روی صفحهٔ بازیکن', 'the 29 level frames on the player mat'), 'find-frames.py']
  ];
  return `<div class="br-comp">
 <h1>${l.t('برس: همهٔ کامپوننت‌ها با شمارهٔ COMPONENTS.md', 'Brass: every component, numbered as COMPONENTS.md')}</h1>
 <p>${l.t('هر قطعه همان فایل مجموعهٔ ready to use - flat است و هیچ قطعه‌ای در CSS یا SVG کشیده نشده. همه‌چیز زیر <code>.br</code> است و هیچ فایل دیزاین سیستم عوض نمی‌شود (بخش ۱۴ COMPONENTS.md). مختصات در قاب ۰ تا ۱۰۰۰ تصویر شب صفحه است.', 'Every piece is the file from ready to use - flat; nothing is drawn in CSS or SVG. Everything lives under <code>.br</code> and no design-system file changes (COMPONENTS.md §14). Coordinates are in the 0–1000 frame of the night board image.')}</p>
 ${sec(1, l, 'نقشه (روی شب)', 'Board (night side)', 'تصویر کامل ۲۴۰۰ پیکسل، مربع. هر قطعه با left/top درصدی و translate(-50%,-50%). کلاس br-board، هوک br__map.', 'Full 2400 px square image. Every piece uses % left/top and translate(-50%,-50%). Class br-board, hook br__map.', `<div class="bgv-felt br-cfelt" style="inline-size:520px">${P.board(l, S)}</div>`)}
 ${sec(2, l, 'کاشی صنعت', 'Industry tile', 'روی = برنگشته، پشت = برگشته (رنگ صندلی). مکعب/بشکهٔ روی کاشی زیر آن ردیف می‌شود. data-flip="tile-{loc}-{slot}".', 'Front = not flipped, back = flipped (seat colour). Cubes/barrels on the tile line up under it. data-flip="tile-{loc}-{slot}".', COLORS.map((c, k) => fig(IMG(tileArt('cotton', 2, k), 'alt=""'), `${l.ind('cotton')} II · ${l.name(k)}`, 74) + fig(IMG(tileArt('cotton', 2, k, 'back'), 'alt=""'), l.t('برگشته', 'flipped'), 74)).join('') + fig(IMG('coal-cube', 'alt=""'), l.t('زغال', 'coal'), 26) + fig(IMG('iron-cube', 'alt=""'), l.t('آهن', 'iron'), 26) + fig(IMG('beer-barrel', 'alt=""'), l.t('آبجو', 'beer'), 22))}
 ${sec(3, l, 'کاشی مسیر', 'Link tile', 'کانال در دورهٔ کانال، ریل در راه‌آهن؛ چرخش از جدول LINKS. data-flip="link-{id}" (تست e2e).', 'Canal in the Canal Era, rail in the Rail Era; rotation from LINKS. data-flip="link-{id}" (e2e test).', COLORS.map((c) => fig(IMG(`link-${c}-canal`, 'alt=""'), l.t('کانال', 'canal'), 96) + fig(IMG(`link-${c}-rail`, 'alt=""'), l.t('ریل', 'rail'), 96)).join(''))}
 ${sec(4, l, 'تاجر و آبجوی تاجر', 'Merchant and merchant beer', 'کاشی تاجر روی قاب قوسی؛ کاشی خالی چیزی نمی‌خرد و آبجو نمی‌گیرد. بشکه data-flip="beer-{m}-{i}".', 'Merchant tile on the arched frame; a blank tile buys nothing and gets no beer. Barrel data-flip="beer-{m}-{i}".', ['merchant-cotton', 'merchant-manufacturer', 'merchant-pottery', 'merchant-all', 'merchant-blank', 'merchant-back'].map((m) => fig(IMG(m, 'alt=""'), m.replace('merchant-', ''), 70)).join(''))}
 ${sec(5, l, 'بازار زغال و آهن', 'Coal and iron markets', 'مکعب‌ها گران‌ترین خانه‌ها را پر می‌کنند؛ قیمت خرید = ارزان‌ترین خانهٔ پر. خالی: زغال £۸، آهن £۶.', 'Cubes fill the most expensive spaces; buy price = cheapest filled space. Empty: coal £8, iron £6.', crop(800, 280, 1500))}
 ${sec(6, l, 'مسیر پیشرفت: امتیاز و درآمد', 'Progress track: VP and income', 'نشانگر شش‌ضلعی = امتیاز، دیسک = درآمد (خانهٔ ۰ تا ۹۹؛ سطح با incomeLevel). چند نشانگر روی یک خانه کنار هم می‌نشینند.', 'Hexagon = VP, disc = income (space 0–99; level via incomeLevel). Markers on one space sit side by side.', COLORS.map((c, k) => fig(IMG(`vp-${c}`, 'alt=""'), l.name(k), 34) + fig(IMG(`income-${c}`, 'alt=""'), '', 22)).join('') + crop(0, 0, 1500))}
 ${sec(7, l, 'ترتیب نوبت', 'Turn order', 'روی شخصیت هر صندلی روی بشکه‌های ۱ تا ۴ به ترتیب order؛ نفر در نوبت حلقهٔ کهربایی. پشت شخصیت‌ها استفاده نمی‌شود.', 'Each seat\'s character front on barrels 1–4 in order; the player to move has the amber ring. Character backs are not used.', COLORS.map((c, k) => fig(IMG(`character-${c}-front`, 'alt=""'), l.name(k), 60)).join('') + crop(60, 600, 1400))}
 ${sec(8, l, 'کارت‌ها و کپه‌ها', 'Cards and piles', 'کارت شهر، کارت صنعت (چند طرح، یک قانون)، دو کارت آزاد و پشت کارت. سه قاب چپ نقشه: دسته، شهر آزاد، صنعت آزاد با شمار.', 'Location card, industry card (several prints, one rule), two wilds and the back. Three frames left on the board: deck, wild location, wild industry, with counts.', [cardArt(s.hands[ME][3]), cardArt(61), 'card-wild-location', 'card-wild-industry', 'card-back'].map((c) => fig(IMG(c, 'alt=""'), c.replace('card-', ''), 92)).join(''))}
 ${sec(9, l, 'دست و حالت کارت', 'Hand and card states', 'selectable = خط‌چین کهربایی، picked = بالا آمده + تیک، none = بدون حلقه (کم‌رنگ نمی‌شود). هوک‌ها: br__hand، br-card، data-flip="card-{id}".', 'selectable = amber dashed, picked = raised + tick, none = no ring (never faded). Hooks: br__hand, br-card, data-flip="card-{id}".', `<div class="bgv-felt br-cfelt" style="display:flex;flex-direction:row;gap:14px;align-items:flex-end">${P.handCard(l, 61, 'selectable', 96)}${P.handCard(l, 61, 'picked', 96)}${P.handCard(l, s.hands[ME][3], 'none', 96)}</div>`)}
 ${sec(10, l, 'صفحهٔ صنعت بازیکن', 'Player industry mat', 'در پنجره (+ پنل) و سربرگ «صفحهٔ من» گوشی، نه زیر نقشه (BGA). صفحهٔ شب؛ کاشی‌های باقی روی قاب سطح خودشان با سایهٔ دسته و «×n». کاشی بعدی هر صنعت (فقط برای خودتان) حلقهٔ کهربایی. قاب خالی = چاپ صفحه.', 'In a dialog (panel +) and the phone «My mat» tab, not under the board (BGA). Night mat; remaining tiles on their level frame with a stack shadow and «×n». The next tile of each industry (own mat only) is ringed. Empty frame = printed mat.', `<div style="inline-size:560px">${P.mat(l, s, ME)}</div>`)}
 ${sec(11, l, 'پنل بازیکن در ریل', 'Rail player panel', 'به ترتیب نوبت این دور (مثل BGA). امتیاز، پول، سطح درآمد، خرج این دور، کارت، مسیر باقی، کاشی روی نقشه، آخرین کارت دورریخته؛ ردیف مسیر درآمد (نشانگر روی سطح فعلی) و ردیف کاشی بعدی هر صنعت با نقطهٔ تعداد و دکمهٔ + برای پنجرهٔ صفحه.', 'In this round\'s turn order. VP (circle), money, income level, spent this round, cards, links left, tiles on the map, top discard.', `<div style="inline-size:360px">${P.panel(l, S, ME)}</div>`)}
 ${sec(12, l, 'سربرگ صفحهٔ بازیکن', 'Player area header', 'سر پنجرهٔ صفحهٔ صنعت؛ پلاک روشن در همهٔ تم‌ها. br-pl--me برای خودتان، br-pl برای بقیه (تست e2e: در DOM می‌ماند، پنجره بسته باشد هم).', 'Light plate in every theme with dark text (as in TM). br-pl--me for you, br-pl for the others (e2e test).', `<div style="inline-size:760px">${P.areaHead(l, S, ME)}</div>`)}
 ${sec(13, l, 'نوار اقدام', 'Action bar', 'هفت اقدام با هزینه؛ aria-label هر دکمه دقیقاً نام اقدام است («ساخت صنعت»، «رد کردن»، تست e2e). گروه br-kinds، فهرست هدف role=listbox با br-target، «ثبت» در br__actions.', 'Seven actions with their cost; each button\'s aria-label is exactly the action name («ساخت صنعت», «رد کردن», e2e). Group br-kinds, target list role=listbox with br-target, «ثبت» inside br__actions.', `<div style="inline-size:1040px">${P.actionBar(l, S)}</div>`)}
 ${sec(14, l, 'هدف روی نقشه', 'Map targets', 'خانه (br-slot)، خط (br-linkbtn، کپسول چرخیده) و تاجر (br-mbtn): خط‌چین = مجاز، توپر + تیک = انتخاب‌شده. پیش‌نمایش کاشی با is-ghost. راهنما (br-tip) با هزینهٔ واقعی.', 'Space (br-slot), line (br-linkbtn, rotated capsule) and merchant (br-mbtn): dashed = legal, solid + tick = picked. Tile preview with is-ghost. Tooltip (br-tip) with the real cost.', crop(560, 600, 1600, { slots: H(S, 'build').map((h) => ({ loc: h.loc, slot: h.slot, picked: h === pick, ghost: h === pick ? { industry: 'manufacturer', level: 2 } : null })) }) + crop(200, 0, 1100, { links: H(S, 'network').filter((h) => h.links.length === 1).map((h, i) => ({ id: h.links[0], picked: i === 0 })), merchants: sales.map((h) => ({ m: h.merchant, space: h.cost.beerMerchant[0].space })) }))}
 ${sec(15, l, 'گوشی: نوار بازیکنان، سربرگ‌ها، داک و شیت', 'Phone: player strip, tabs, dock and sheet', 'نوار HUD دیزاین سیستم، چهار سربرگ (نقشه، دست، صفحهٔ من، بازیکنان)، داک اقدام با مراحل و هزینه، شیت هفت اقدام.', 'DS HUD strip, four tabs (map, hand, my mat, players), action dock with steps and cost, the seven-action sheet.', `<div style="inline-size:390px;display:grid;gap:8px">${MB.hud(l, S)}${MB.tabs(l, 'map')}</div>`)}
 ${sec(16, l, 'مختصات اندازه‌گیری‌شده', 'Measured geometry', 'همه در tools/geo.js و layout.json؛ روی تصویر واقعی با overlay.py بررسی شد.', 'All in tools/geo.js and layout.json; checked on the real image with overlay.py.', `<table class="br-geo"><thead><tr><th>${l.t('نام', 'Name')}</th><th>${l.t('چیست', 'What')}</th><th>${l.t('ابزار', 'Tool')}</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td><code>${a}</code></td><td>${b}</td><td><code>${c}</code></td></tr>`).join('')}</tbody></table>`)}
 ${sec(17, l, 'جعبهٔ نقشه و نوار ابزار', 'Map box and toolbar', 'مثل BGA: بزرگ‌نمایی (−، درصد، +، کل نقشه)، پلاک دوره، دور، دسته و قیمت بازار، راهنما و تنظیمات؛ جعبه با کشیدن جابه‌جا و با چرخ یا دو انگشت بزرگ می‌شود. کلاس br-mapzone، br-maptools، br-mapbox.', 'As on BGA: zoom (−, percent, +, whole board), era / round / deck / market plate, aid and settings; the box pans by drag and zooms by wheel or pinch. Classes br-mapzone, br-maptools, br-mapbox.', `<div style="inline-size:1040px">${P.mapZone(l, S, {}, true)}</div>`)}
</div>`;
}

module.exports = { CSS, components };
