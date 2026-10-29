// Builds the playable mobile set from the FA desktop build + the mobile turn artboard:
// node gen-mobile.js <gaiaDir>
// Board overlays are percent-based, so the desktop blocks scale down to the phone unchanged.
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const desk = fs.readFileSync(path.join(dir, 'Gaia-Table-Desktop.dc.html'), 'utf8');
const turn = fs.readFileSync(path.join(dir, 'Gaia-Turn-Mobile.dc.html'), 'utf8');

const between = (s, start, end, incEnd = true) => {
  const i = s.indexOf(start); if (i < 0) throw new Error('missing ' + start.slice(0, 50));
  const j = s.indexOf(end, i + start.length); if (j < 0) throw new Error('missing end ' + end.slice(0, 50));
  return s.slice(i, incEnd ? j + end.length : j);
};

// desktop CSS without its page layout (the phone keeps its own shell, tabs and map rules)
const skip = /^\s*(body|\.gp\{|\.gp-(desk|rail|zone|panel|status|tabs|lang|log|map|piece|grid|hex|tag|check|zoom|mapinfo|steps?|r\b|planet|bowl|gp-lead))|\.bgv-tablescreen|@media/;
const deskCss = between(desk, '<style>', '</style>').replace('<style>', '').replace('</style>', '')
  .split('\n').filter((l) => l.trim() && !skip.test(l)).join('\n');
const turnCss = between(turn, '<style>', '</style>').replace('<style>', '').replace('</style>', '');
const mobileCss = `
.gp-bview{position:relative;flex:1;min-block-size:0;overflow:auto;display:flex;flex-direction:column;gap:10px;border-radius:var(--radius-md);scrollbar-width:none}
.gp-bview>*{flex:none}
.gp-ptabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.gp-ptabs button{flex:none;display:inline-flex;align-items:center;gap:6px;block-size:32px;padding-inline:10px;border:0;border-radius:var(--radius-pill);background:var(--felt-plate);color:var(--felt-muted);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.gp-ptabs button[aria-selected="true"]{background:var(--felt-control);color:var(--brand-ink)}
.gp-owned{gap:10px;padding:10px}
.gp-owned img{block-size:72px}
.gp-cnt b{font-size:11px}
.gp-fwrap{gap:6px}
.gp-boosters{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.gp-fed{padding:8px 10px}
.gp-fed__t img{block-size:40px}
.gp-sheetwrap{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:flex-end}
.gp-sheet{position:relative;max-block-size:78%;padding:0 14px 14px;gap:10px}
.gp-sheet__head{display:flex;align-items:center;gap:8px;font-size:14px;line-height:1.6}
.gp-sheet__head b{color:var(--heading);font-weight:900}
.gp-sheet__head .bgv-clock{margin-inline-start:auto;flex:none}
.gp-main{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gp-main .bgv-btn{inline-size:100%;block-size:auto;min-block-size:48px;padding:6px 10px;flex-direction:column;gap:2px;white-space:normal;line-height:1.4}
.gp-main .bgv-btn small{font-size:11.5px;font-weight:400;color:var(--text-muted)}
.gp-free{display:flex;flex-wrap:wrap;gap:6px}
.gp-free .gp-chipbtn{block-size:36px}
.gp-sheet .gp-label{font-size:12px;font-weight:700;color:var(--label)}
.gp-sheet .gp-row{display:flex;align-items:center;gap:8px}
.gp-sheet .gp-row .bgv-btn{flex:1}
.gp-sheet .gp-hint2{margin:0;font-size:12px;line-height:1.6;color:var(--text-muted)}
.gp-dockbar{display:flex;align-items:center;gap:8px}
.gp-dockbar>span{flex:1;min-inline-size:0;font-size:14px;line-height:1.5}
.gp-dockbar b{color:var(--heading);font-weight:900}
.gp-chk{display:flex;gap:8px;align-items:center;font-size:13px}
`;

const head = turn.slice(0, turn.indexOf('<main'));
const helmetHead = head.replace(/<style>[\s\S]*?<\/style>/, `<style>\n${deskCss}\n${turnCss}\n${mobileCss}\n</style>`);
const tail = turn.slice(turn.indexOf('</x-dc>'));

const turnRow = between(turn, '<div class="bgv-felt-row"', '</div>');
const tabs = (sel) => {
  const names = ['نقشه', 'پژوهش', 'امتیاز', 'صفحهٔ من'];
  return ` <div class="gp-tabs" role="tablist" aria-label="کدام صفحه از بازی">${names.map((n, i) => `<button type="button" role="tab" aria-selected="${i === sel}">${n}</button>`).join('')}</div>`;
};
// the map tab without the "build a mine" picks
const mapView = between(turn, '<div class="gp-mview"', '<span class="bgv-felt-plate gp-mapinfo">', false)
  .split('\n').filter((l) => !/gp-picks|gp-hexbtn|gp-check|gp-tag/.test(l)).join('\n') + '\n  </div>';

const mainRow = between(desk, '<div class="gp-actbar__row" role="toolbar"', '\n </div>');
const freeRow = between(desk, '<div class="gp-actbar__row gp-actbar__free"', '\n </div>');
const scoring = between(desk, '<div class="gp-board" dir="ltr" role="group" aria-label="صفحهٔ امتیاز">', '<p class="gp-hint">', false)
  + '<p class="gp-hint">هنگام پاس، بوستر خود را برمی‌گردانید و یکی از سه بوستر آزاد را برمی‌دارید.</p>';
const fed = between(desk, '<div class="gp-fed"', '</div></div>');
const faction = between(desk, '<div class="gp-fwrap"', '<p class="gp-hint">', false)
  + '<p class="gp-hint">تبدیل‌ها و اقدام‌های این صفحه را بزنید؛ لمس طولانی توضیح را نشان می‌دهد و ساختمان زیرش را نمایان می‌کند.</p>';

// main actions as big two-column buttons; a disabled one says why underneath
const mainButtons = [...mainRow.matchAll(/<button class="bgv-btn bgv-btn--(\w+) bgv-btn--sm" type="button"( disabled="")?(?: title="([^"]*)")?>([\s\S]*?)<\/button>/g)]
  .map(([, v, dis, why, label]) => `<button class="bgv-btn bgv-btn--${v === 'ghost' ? 'secondary' : v}" type="button"${dis || ''}>${label.trim()}${why ? `<small>${why}</small>` : ''}</button>`).join('\n   ');
const freeButtons = freeRow.replace(/^<div[^>]*>\s*<span class="gp-actbar__label">[^<]*<\/span>/, '').replace(/\n <\/div>$/, '');

const clock = '<span class="bgv-clock bgv-clock--chip" data-state="calm" style="--p:0.875;" role="timer" aria-label="زمان نوبت شما"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">۲۱ ساعت</span></span>';
const dockBar = `<section class="bgv-actiondock" aria-label="نوار کنش">
 <div class="gp-dockbar"><span><b>نوبت شماست</b></span>${clock}<button class="bgv-btn bgv-btn--primary" type="button" aria-haspopup="dialog"><svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>کنش‌ها</button></div>
</section>`;

const page = (title, body, after) => helmetHead.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`) + body + '\n' + after + '\n</div>\n</div>\n' + tail;
const felt = (inner, label) => `<main class="bgv-felt" style="padding:12px;gap:8px" aria-label="${label}">\n ${turnRow}\n${inner}\n</main>`;
const ptabs = ' <div class="gp-ptabs" role="tablist" aria-label="صفحهٔ کدام بازیکن"><button type="button" role="tab" aria-selected="true"><i class="bgv-seat seat-1"></i>مینا، شما</button><button type="button" role="tab" aria-selected="false"><i class="bgv-seat seat-2"></i>نیلوفر</button><button type="button" role="tab" aria-selected="false"><i class="bgv-seat seat-4"></i>سارا</button><button type="button" role="tab" aria-selected="false"><i class="bgv-seat seat-3"></i>آرش</button></div>';

const out = {};
// 1) the action sheet: same actions as the desktop bar
out['Gaia-Actions-Mobile'] = page('پروژه گایا، کنش‌ها، موبایل',
  felt(tabs(0) + '\n ' + mapView, 'میز پروژه گایا'),
  `<div class="gp-sheetwrap"><div class="bgv-scrim"></div>
<section class="bgv-sheet gp-sheet" role="dialog" aria-label="کنش‌های نوبت شما">
 <div class="bgv-sheet__handle" aria-hidden="true"></div>
 <div class="gp-sheet__head"><span><b>نوبت شماست</b>: یک کنش انتخاب کنید</span>${clock}</div>
 <span class="gp-label">کنش اصلی</span>
 <div class="gp-main" role="toolbar" aria-label="کنش‌های اصلی">
   ${mainButtons}
 </div>
 <span class="gp-label">تبدیل رایگان (تا «تأیید» موقت است)</span>
 <div class="gp-free" role="toolbar" aria-label="تبدیل‌های رایگان">${freeButtons}
 </div>
 <p class="gp-hint2">اقدام‌های بنفش، سبز و نارنجی روی خود صفحه‌ها هستند: سربرگ «پژوهش» یا «صفحهٔ من» را بزنید، کنش‌ها همان‌جا حلقهٔ کهربایی دارند.</p>
 <div class="gp-row"><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" aria-haspopup="dialog"><img class="gp-ic" src="../assets/games/gaia/power.webp" alt="">شارژ خودکار: رایگان (۱)</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">بستن</button></div>
</section></div>`);

// 2) my board tab
out['Gaia-Board-Mobile'] = page('پروژه گایا، صفحهٔ من، موبایل',
  felt(tabs(3) + `\n <div class="gp-bview" role="tabpanel" aria-label="صفحهٔ بازیکن">\n${ptabs}\n ${faction}\n </div>`, 'میز پروژه گایا'),
  dockBar);

// 3) scoring tab with boosters and the federation supply
out['Gaia-Scoring-Mobile'] = page('پروژه گایا، امتیاز، موبایل',
  felt(tabs(2) + `\n <div class="gp-bview" role="tabpanel" aria-label="صفحهٔ امتیاز، بوسترها و توکن‌های فدراسیون">\n ${scoring}\n ${fed}\n </div>`, 'میز پروژه گایا'),
  dockBar);

// 4) out of turn: a power charge offer
const othersTurn = turnRow.replace('bgv-turn--mine', 'bgv-turn--other').replace('نوبت شماست', 'نوبت سارا');
out['Gaia-Leech-Mobile'] = page('پروژه گایا، شارژ قدرت، موبایل',
  `<main class="bgv-felt" style="padding:12px;gap:8px" aria-label="میز پروژه گایا">\n ${othersTurn}\n${tabs(0)}\n ${mapView}\n</main>`,
  `<section class="bgv-actiondock" aria-label="تصمیم شما: شارژ قدرت">
 <div class="bgv-actiondock__prompt"><span style="min-inline-size:0;font-size:14px;line-height:1.6"><b style="color:var(--heading)">سارا</b> کنار شما معدن ساخت. <b>۲</b><img class="gp-ic" src="../assets/games/gaia/power.webp" alt="قدرت"> شارژ می‌کنید؟ هزینه <span class="gp-costpill">۱ امتیاز</span></span></div>
 <div class="bgv-actiondock__actions"><button class="bgv-btn bgv-btn--primary" type="button">شارژ ۲ قدرت</button><button class="bgv-btn bgv-btn--secondary" type="button">رد</button></div>
 <div class="gp-row" style="display:flex;align-items:center;gap:8px"><label class="gp-chk" style="flex:1"><input type="checkbox"> دفعهٔ بعد نپرس</label><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" aria-haspopup="dialog">تنظیم شارژ خودکار</button></div>
</section>`);

for (const [name, html] of Object.entries(out)) fs.writeFileSync(path.join(dir, name + '.dc.html'), html);
console.log(Object.keys(out).join(', '));
